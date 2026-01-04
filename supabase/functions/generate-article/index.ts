import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// No recipe card - simpler article generation

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Fetch and parse sitemap to get relevant URLs
async function fetchSitemapUrls(sitemapUrl: string, sitemapType: string = 'auto'): Promise<string[]> {
  try {
    let actualUrl = sitemapUrl.replace(/\/$/, '');
    
    if (sitemapType === 'wordpress') {
      actualUrl = `${actualUrl}/wp-sitemap.xml`;
    } else if (sitemapType === 'yoast' || sitemapType === 'rankmath') {
      actualUrl = `${actualUrl}/sitemap_index.xml`;
    } else if (sitemapType === 'standard') {
      actualUrl = `${actualUrl}/sitemap.xml`;
    } else if (sitemapType === 'auto') {
      const tryUrls = [
        `${actualUrl}/wp-sitemap.xml`,
        `${actualUrl}/sitemap_index.xml`,
        `${actualUrl}/sitemap.xml`,
      ];
      
      for (const tryUrl of tryUrls) {
        try {
          const testResponse = await fetch(tryUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)' }
          });
          if (testResponse.ok) {
            actualUrl = tryUrl;
            console.log('Auto-detected sitemap at:', actualUrl);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    console.log('Fetching sitemap from:', actualUrl);
    const response = await fetch(actualUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)' }
    });
    
    if (!response.ok) {
      console.log('Sitemap fetch failed:', response.status);
      return [];
    }
    
    const text = await response.text();
    const isSitemapIndex = text.includes('<sitemapindex') || text.includes('sitemap-posts') || text.includes('wp-sitemap-posts');
    
    if (isSitemapIndex) {
      console.log('Detected sitemap index, fetching child sitemaps...');
      
      const sitemapMatches = text.match(/<loc>([^<]+\.xml)<\/loc>/g) || [];
      const childSitemaps = sitemapMatches.map(match => match.replace(/<\/?loc>/g, ''));
      
      const relevantSitemaps = childSitemaps.filter(url => 
        url.includes('post') || url.includes('page') || url.includes('article') ||
        url.includes('recipe') || url.includes('blog')
      );
      
      console.log(`Found ${relevantSitemaps.length} relevant child sitemaps out of ${childSitemaps.length} total`);
      
      const allUrls: string[] = [];
      
      for (const childUrl of relevantSitemaps.slice(0, 5)) {
        try {
          const childResponse = await fetch(childUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)' }
          });
          
          if (childResponse.ok) {
            const childText = await childResponse.text();
            const urlMatches = childText.match(/<loc>([^<]+)<\/loc>/g) || [];
            const urls = urlMatches
              .map(match => match.replace(/<\/?loc>/g, ''))
              .filter(url => !url.endsWith('.xml'));
            
            allUrls.push(...urls);
            console.log(`Fetched ${urls.length} URLs from ${childUrl}`);
          }
        } catch (e) {
          console.error(`Error fetching child sitemap ${childUrl}:`, e);
        }
      }
      
      console.log(`Total URLs collected: ${allUrls.length}`);
      return allUrls.slice(0, 200);
    }
    
    const urlMatches = text.match(/<loc>([^<]+)<\/loc>/g) || [];
    const urls = urlMatches
      .map(match => match.replace(/<\/?loc>/g, ''))
      .filter(url => !url.endsWith('.xml'));
    
    console.log(`Found ${urls.length} URLs in sitemap`);
    return urls.slice(0, 200);
  } catch (error) {
    console.error('Error fetching sitemap:', error);
    return [];
  }
}

// Call AI API for text generation - supports multiple providers
async function callAI(
  prompt: string, 
  systemPrompt: string, 
  apiKey: string, 
  provider: 'lovable' | 'groq' | 'openai' = 'lovable'
): Promise<string> {
  console.log(`Calling ${provider.toUpperCase()} AI...`);
  
  let url: string;
  let model: string;
  
  switch (provider) {
    case 'groq':
      url = 'https://api.groq.com/openai/v1/chat/completions';
      model = 'llama-3.3-70b-versatile';
      break;
    case 'openai':
      url = 'https://api.openai.com/v1/chat/completions';
      model = 'gpt-4o-mini';
      break;
    case 'lovable':
    default:
      url = 'https://ai.gateway.lovable.dev/v1/chat/completions';
      model = 'google/gemini-2.5-flash';
      break;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`${provider.toUpperCase()} AI error:`, response.status, errorText);
    
    if (response.status === 429) {
      throw new Error(`Rate limit exceeded for ${provider}. Please switch to a different API provider in Settings or wait and try again.`);
    }
    throw new Error(`${provider.toUpperCase()} AI error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Create a short, image-friendly subject from long SEO titles/keywords
function getImageSubject(focusKeyword: string, seoTitle: string): string {
  const base = (focusKeyword || seoTitle || '').trim();
  if (!base) return 'food recipe';

  return base
    .replace(/^get ready for( the)?/i, '')
    .replace(/^the /i, '')
    .replace(/\b(ultimate|super easy|easy|best|simple|quick)\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s-\s.*$/g, '')
    .trim() || base;
}

function safeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'image';
}

// Fallback image search
async function generateFallbackImage(
  dishName: string,
  imageContext: string,
  imageNumber: number,
  supabase: any
): Promise<string> {
  try {
    const query = `${dishName} ${imageContext} food photography`;
    const openverseUrl = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=10`;

    const ovResp = await fetch(openverseUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)' },
    });

    let candidateUrl: string | null = null;

    if (ovResp.ok) {
      const ovJson = await ovResp.json();
      const results = Array.isArray(ovJson?.results) ? ovJson.results : [];
      const first =
        results.find((r: any) => typeof r?.url === 'string' && r.url.startsWith('http')) ||
        results.find((r: any) => typeof r?.thumbnail === 'string' && r.thumbnail.startsWith('http'));

      candidateUrl = (first?.url || first?.thumbnail) ?? null;
    }

    if (!candidateUrl) return '';

    const imgResp = await fetch(candidateUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)' },
    });

    if (!imgResp.ok) {
      return candidateUrl;
    }

    const contentType = imgResp.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png')
      ? 'png'
      : contentType.includes('webp')
      ? 'webp'
      : contentType.includes('gif')
      ? 'gif'
      : 'jpg';

    const bytes = new Uint8Array(await imgResp.arrayBuffer());
    const fileName = `fallback/${safeSlug(dishName)}/${Date.now()}-${imageNumber}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('article-images')
      .upload(fileName, bytes, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error('Fallback upload error:', uploadError);
      return candidateUrl;
    }

    const { data: urlData } = supabase.storage
      .from('article-images')
      .getPublicUrl(fileName);

    return urlData?.publicUrl || candidateUrl;
  } catch (e) {
    console.error('Fallback image generation error:', e);
    return '';
  }
}

// Analyze article content and generate specific image prompts using AI
async function analyzeArticleForImagePrompts(
  articleContent: string,
  dishName: string,
  AI_API_KEY: string,
  aiProvider: string
): Promise<string[]> {
  console.log('🔍 AI Analysis: Extracting key content from article for image generation...');
  
  const analysisText = articleContent
    .replace(/\{\{IMAGE_\d\}\}/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const h1Match = articleContent.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const extractedTitle = h1Match ? h1Match[1].trim() : dishName;

  console.log(`📖 Extracted title: "${extractedTitle}"`);

  const excerpt = analysisText.length > 6000
    ? `${analysisText.slice(0, 3000)} ... ${analysisText.slice(-3000)}`
    : analysisText;

  const systemPrompt = `You are an expert at creating SHORT, SPECIFIC image prompts for professional food photography.

CRITICAL RULES:
- Each prompt must be SHORT (under 10 words)
- Be SPECIFIC to the article topic
- Simple subjects only - avoid complex scenes
- Professional, high-quality photography style

Examples of GOOD prompts:
- "chocolate chip cookies on white plate"
- "golden retriever puppy playing"
- "modern kitchen with marble countertops"

BAD prompts (too generic):
- "a dog"
- "cookies"

Output EXACTLY 7 prompts, one per line, numbered 1-7.`;

  const userPrompt = `Based on this article about "${extractedTitle}", create 7 SPECIFIC image prompts for professional photography.

Article excerpt:
${excerpt}

Requirements:
- Each prompt should be SHORT (under 10 words)
- Be SPECIFIC to this article topic
- Simple subjects only - avoid complex scenes
- Professional, high-quality photography style

Create 7 SPECIFIC prompts with details related to this article.

Format as a numbered list:
1. [specific detailed prompt]
2. [specific detailed prompt]
etc.`;

  try {
    const response = await callAI(userPrompt, systemPrompt, AI_API_KEY, aiProvider as 'lovable' | 'groq' | 'openai');
    
    if (!response) {
      throw new Error('No response from AI for image prompts');
    }
    
    const lines = response.split('\n').filter(line => line.trim());
    const prompts: string[] = [];
    
    for (const line of lines) {
      const cleanedPrompt = line.replace(/^\d+[\.\)\:]\s*/, '').trim();
      if (cleanedPrompt.length > 5 && cleanedPrompt.length < 100) {
        prompts.push(cleanedPrompt);
      }
    }
    
    while (prompts.length < 7) {
      prompts.push(`${dishName} on white plate`);
    }
    
    console.log('Generated short image prompts:', prompts.slice(0, 7));
    return prompts.slice(0, 7);
    
  } catch (error) {
    console.error('Error analyzing article for prompts:', error);
    return [
      `${dishName} hero shot overhead`,
      `${dishName} close-up texture`,
      `${dishName} ingredients arranged`,
      `${dishName} being prepared`,
      `${dishName} plated elegantly`,
      `${dishName} multiple servings`,
      `${dishName} final presentation`
    ];
  }
}

// Generate UNIQUE AI image using Replicate Flux
async function generateUniqueImage(
  prompt: string,
  imageNumber: number,
  REPLICATE_API_KEY: string,
  supabase: any,
  aspectRatio: string = "4:3",
  dishName: string = ""
): Promise<string> {
  try {
    console.log(`Generating image ${imageNumber} with prompt: ${prompt.substring(0, 100)}...`);

    const realisticPrompt = `Professional food photography, DSLR camera shot, ${prompt}. 
STYLE: Ultra-realistic photograph, NOT AI-generated, NOT illustration, NOT digital art.
CAMERA: Shot on Canon EOS R5, 50mm f/1.8 lens, natural lighting from window.
COMPOSITION: Overhead or 45-degree angle, wooden cutting board or marble surface, rustic kitchen background.
DETAILS: Visible texture, natural imperfections, authentic food styling, soft shadows.
QUALITY: 8K resolution, magazine-quality food photography, like Bon Appetit or Food Network.`;

    let prediction: any | null = null;
    const maxCreateAttempts = 8;

    for (let attempt = 0; attempt < maxCreateAttempts; attempt++) {
      const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${REPLICATE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: "black-forest-labs/flux-schnell",
          input: {
            prompt: realisticPrompt,
            go_fast: true,
            megapixels: "1",
            num_outputs: 1,
            aspect_ratio: aspectRatio,
            output_format: "webp",
            output_quality: 90,
            num_inference_steps: 4,
          },
        }),
      });

      if (response.ok) {
        prediction = await response.json();
        break;
      }

      const errorText = await response.text();
      console.error(`Replicate API error for image ${imageNumber}:`, response.status, errorText);

      if (response.status === 429) {
        let retryAfterMs = 6000;
        try {
          const parsed = JSON.parse(errorText);
          const retryAfter = Number(parsed?.retry_after);
          if (Number.isFinite(retryAfter) && retryAfter > 0) {
            retryAfterMs = retryAfter * 1000;
          }
        } catch {
          // ignore parse errors
        }

        const waitMs = retryAfterMs + 250;
        console.log(`Replicate throttled. Waiting ${waitMs}ms then retrying (attempt ${attempt + 1}/${maxCreateAttempts})...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      break;
    }

    if (!prediction) {
      return await generateFallbackImage(dishName, `image ${imageNumber}`, imageNumber, supabase);
    }

    // Poll for result
    let result = prediction;
    let attempts = 0;
    const maxAttempts = 30;
    
    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          'Authorization': `Bearer ${REPLICATE_API_KEY}`,
        },
      });
      
      if (statusResponse.ok) {
        result = await statusResponse.json();
      }
      attempts++;
    }

    if (result.status !== 'succeeded' || !result.output || result.output.length === 0) {
      console.error(`Replicate generation failed for image ${imageNumber}:`, result.status, result.error);
      return await generateFallbackImage(dishName, `image ${imageNumber}`, imageNumber, supabase);
    }

    const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
    console.log(`Replicate generated image ${imageNumber}:`, imageUrl);

    // Download and upload to Supabase Storage
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) {
      console.error(`Failed to download Replicate image ${imageNumber}`);
      return imageUrl;
    }

    const bytes = new Uint8Array(await imgResp.arrayBuffer());
    const fileName = `articles/article-${Date.now()}-${imageNumber}.webp`;

    const { error: uploadError } = await supabase.storage
      .from('article-images')
      .upload(fileName, bytes, {
        contentType: 'image/webp',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return imageUrl;
    }

    const { data: urlData } = supabase.storage
      .from('article-images')
      .getPublicUrl(fileName);

    console.log(`Image ${imageNumber} generated and uploaded successfully`);
    return urlData?.publicUrl || imageUrl;
  } catch (error) {
    console.error(`Error generating image ${imageNumber}:`, error);
    return await generateFallbackImage(dishName, `image ${imageNumber}`, imageNumber, supabase);
  }
}

// Find relevant URLs from sitemap
async function findRelevantUrls(
  sitemapUrls: string[], 
  topic: string, 
  apiKey: string,
  aiProvider: 'lovable' | 'groq' | 'openai' = 'lovable'
): Promise<Array<{ url: string; anchorText: string }>> {
  if (sitemapUrls.length === 0) return [];
  
  try {
    const prompt = `Topic: "${topic}"

Available URLs:
${sitemapUrls.slice(0, 50).join('\n')}

Find 3-5 URLs most relevant to this topic for internal linking. Return JSON array:
[{"url": "full_url", "anchorText": "natural anchor text for the link"}]

Only return valid JSON array, nothing else.`;

    const content = await callAI(prompt, 'You analyze URLs and find ones relevant to a cooking topic. Return JSON array only.', apiKey, aiProvider);
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Error finding relevant URLs:', error);
  }
  
  return [];
}

// Validate and fix internal links
function validateInternalLinks(
  content: string, 
  expectedLinks: Array<{ url: string; anchorText: string }>
): { isValid: boolean; missingLinks: Array<{ url: string; anchorText: string }> } {
  const missingLinks: Array<{ url: string; anchorText: string }> = [];
  
  for (const link of expectedLinks) {
    if (!content.includes(link.url)) {
      missingLinks.push(link);
    }
  }
  
  console.log(`Internal link validation: ${expectedLinks.length - missingLinks.length}/${expectedLinks.length} links found`);
  
  return {
    isValid: missingLinks.length === 0,
    missingLinks
  };
}

// Insert missing internal links
function insertMissingInternalLinks(
  content: string, 
  missingLinks: Array<{ url: string; anchorText: string }>
): string {
  if (missingLinks.length === 0) return content;
  
  console.log(`Inserting ${missingLinks.length} missing internal links...`);
  
  let updatedContent = content;
  
  for (const link of missingLinks) {
    const paragraphRegex = /<p>([^<]*?)(\.)<\/p>/g;
    let match;
    let inserted = false;
    
    while ((match = paragraphRegex.exec(updatedContent)) !== null && !inserted) {
      const paragraph = match[0];
      if (paragraph.length > 100 && !paragraph.includes('<a href')) {
        const insertPoint = match.index + match[1].length;
        const linkHtml = ` For more ideas, check out <a href="${link.url}">${link.anchorText}</a>`;
        updatedContent = updatedContent.slice(0, insertPoint) + linkHtml + updatedContent.slice(insertPoint);
        inserted = true;
        console.log(`Inserted link: ${link.url}`);
      }
    }
    
    if (!inserted) {
      const faqIndex = updatedContent.indexOf('<h2>FAQ');
      if (faqIndex > -1) {
        const linkHtml = `<p>You might also enjoy <a href="${link.url}">${link.anchorText}</a>.</p>\n\n`;
        updatedContent = updatedContent.slice(0, faqIndex) + linkHtml + updatedContent.slice(faqIndex);
        console.log(`Inserted link before FAQ: ${link.url}`);
      }
    }
  }
  
  return updatedContent;
}

// Recipe card generation removed - using simplified article structure

// ============================================================================
// MAIN SERVER HANDLER
// ============================================================================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestBody: any = null;
  
  try {
    requestBody = await req.json();
    const { 
      recipeId, 
      title: focusKeyword, 
      sitemapUrl, 
      sitemapType = 'auto', 
      aspectRatio = '4:3',
      aiProvider = 'lovable',
      customApiKey,
      customReplicateKey
    } = requestBody;
    
    console.log(`🚀 Starting article generation for: ${focusKeyword} (ID: ${recipeId})`);
    console.log(`⚙️ Settings - Aspect Ratio: ${aspectRatio}, AI Provider: ${aiProvider}`);

    // Determine which API key to use
    let AI_API_KEY: string;
    if (aiProvider === 'lovable') {
      AI_API_KEY = Deno.env.get('LOVABLE_API_KEY') || '';
      if (!AI_API_KEY) {
        throw new Error("LOVABLE_API_KEY is not configured");
      }
    } else if (customApiKey) {
      AI_API_KEY = customApiKey;
    } else {
      throw new Error(`Custom API key required for ${aiProvider} provider. Please add your API key in Settings.`);
    }
    
    const REPLICATE_API_KEY = customReplicateKey || Deno.env.get('REPLICATE_API_KEY');
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update status to processing
    await supabase
      .from('recipes')
      .update({ status: 'processing' })
      .eq('id', recipeId);

    // Step 1: Generate SEO-optimized title
    console.log('📝 Generating SEO title from focus keyword...');
    
    const titleSystemPrompt = `You are an SEO expert. Generate a beautiful, click-worthy title that:
1. MUST include the exact focus keyword naturally
2. Is engaging and makes readers want to click
3. Is between 50-70 characters
4. Uses power words like "Easy", "Best", "Ultimate", "Simple", "Delicious", "Perfect"
5. Can include a dash with a subtitle

Return ONLY the title, nothing else.`;

    const titlePrompt = `Generate an SEO-optimized, beautiful title for this focus keyword: "${focusKeyword}"`;
    
    let seoTitle = focusKeyword;
    try {
      const generatedTitle = await callAI(titlePrompt, titleSystemPrompt, AI_API_KEY, aiProvider);
      if (generatedTitle && generatedTitle.trim().length > 0) {
        seoTitle = generatedTitle.trim().replace(/^["']|["']$/g, '').trim();
        console.log(`✅ Generated SEO title: ${seoTitle}`);
        
        await supabase
          .from('recipes')
          .update({ title: seoTitle })
          .eq('id', recipeId);
      }
    } catch (e) {
      console.log('Using focus keyword as title:', focusKeyword);
    }

    // Fetch sitemap URLs if provided
    let relevantLinks: Array<{ url: string; anchorText: string }> = [];
    if (sitemapUrl) {
      const sitemapUrls = await fetchSitemapUrls(sitemapUrl, sitemapType);
      relevantLinks = await findRelevantUrls(sitemapUrls, seoTitle, AI_API_KEY, aiProvider);
      console.log(`🔗 Found ${relevantLinks.length} relevant internal links`);
    }

    const imageSubject = getImageSubject(focusKeyword, seoTitle);
    console.log(`📷 Image subject: ${imageSubject}`);

    // Build internal links instruction
    let internalLinksInstruction = '';
    if (relevantLinks.length > 0) {
      internalLinksInstruction = `

INTERNAL LINKING REQUIREMENT:
Naturally incorporate these internal links within the article content:
${relevantLinks.map(link => `- <a href="${link.url}">${link.anchorText}</a>`).join('\n')}

Place these links naturally within paragraphs where they make sense.`;
    }

    // Step 2: Generate article content (simplified - no recipe card)
    console.log('📄 Generating article content...');

    const articleSystemPrompt = `Write a long-form, engaging blog article using the EXACT structure below.

Do NOT skip any section.
Maintain a conversational, friendly, slightly witty tone.
Keep paragraphs short (2-4 lines max).
Avoid sounding robotic or academic.
${internalLinksInstruction}

STRUCTURE TO FOLLOW:

1. HOOK INTRODUCTION (3-4 short paragraphs)
   - Start directly, no title, no generic lines
   - Set the mood and introduce the problem + promise
   - Make the reader feel "this article is for me"

2. FOUNDATIONAL CONTEXT SECTION
   - Explain WHY this topic matters
   - Include benefits, usefulness, or relevance
   - Add light humor or personality

3. CLARIFICATION / COMPARISON SECTION
   - Clear a common confusion related to the topic
   - Compare two commonly misunderstood things
   - Give practical advice

4. CORE VALUE SECTION (Swaps / Methods / Frameworks)
   - Break into sub-points using <h3> tags
   - Use simple explanations
   - Focus on solutions that actually work

5. FLAVOR / PERSONALITY SECTION
   - Add a memorable, fun mini-section
   - Include opinionated commentary
   - Make it feel human, not AI-written

6. MAIN CONTENT SECTION (5-7 Items)
   - Numbered list using <ol> and <li>
   - Each item should include:
     - Short intro
     - Practical steps or tips
     - One smart trick or upgrade

7. PROBLEM-SOLVING SECTION
   - Common mistakes or issues
   - Explain WHY they happen
   - Give clear fixes

8. ADVANCED / REAL-LIFE USE CASE SECTION
   - Show how this applies in real situations
   - Hosting, planning, scaling, or practical application

9. FAQ SECTION
   - 4-6 real questions people actually ask
   - Format each question as <h3> tag
   - Clear, helpful answers in paragraphs
   - Keep tone friendly

10. CONCLUSION
    - Short summary
    - Encouraging ending
    - End with a relatable or humorous line

CRITICAL FORMATTING RULES:

- Output ONLY valid HTML - absolutely NO Markdown syntax
- Use <h2> for main sections, <h3> for subsections
- Use <ul> with <li> for bullet lists
- Use <ol> with <li> for numbered lists
- Use <strong> for bold text - NEVER use asterisks (*) or double asterisks (**)
- Use <em> for italic text - NEVER use underscores (_) or single asterisks (*)
- Use <p> tags for paragraphs
- NO code fences, backticks, or any Markdown formatting whatsoever
- NO asterisks anywhere in the output
- No extraneous preamble before content starts
- NO emojis
- NO fluff or filler
- Use simple English
- Write like an experienced human, not a teacher
- Add light humor where natural
- Avoid repetitive phrases

IMAGE PLACEHOLDERS:
Place these placeholders naturally throughout the article where images would enhance the content:
{{IMAGE_1}}, {{IMAGE_2}}, {{IMAGE_3}}, {{IMAGE_4}}, {{IMAGE_5}}, {{IMAGE_6}}, {{IMAGE_7}}

Place them on their own lines between sections or after key points.`;

    const articlePrompt = `ARTICLE TITLE: "${seoTitle}"
FOCUS KEYWORD: "${focusKeyword}"

Write a 2,000+ word SEO article following the EXACT 10-section structure in the system prompt.

SECTION ORDER (DO NOT SKIP ANY):
1. Hook Introduction (3-4 paragraphs, NO H1 title, start directly)
2. Foundational Context Section (H2)
3. Clarification / Comparison Section (H2)
4. Core Value Section with sub-points (H2 with H3 sub-sections)
5. Flavor / Personality Section (H2)
6. Main Content Section with 5-7 numbered items (H2 with numbered list)
7. Problem-Solving Section (H2)
8. Advanced / Real-Life Use Case Section (H2)
9. FAQ Section with 4-6 questions (H2 with H3 for each question)
10. Conclusion (H2)

KEY REQUIREMENTS:
- Include focus keyword "${focusKeyword}" naturally 10-15 times throughout
- Conversational, friendly, slightly witty tone
- Active voice only
- Short paragraphs (2-4 lines max)
- Use ALL 7 image placeholders distributed throughout
- Add light humor where natural
- NO emojis, NO fluff, NO filler
- Write like an experienced human sharing advice with a friend

CRITICAL: Output pure HTML only. Do NOT use any Markdown syntax like asterisks (*), underscores, backticks, or code blocks. Use <strong> for bold, <em> for italics.`;

    let articleContent = await callAI(articlePrompt, articleSystemPrompt, AI_API_KEY, aiProvider);

    if (!articleContent) {
      throw new Error("No content generated");
    }

    // Clean any markdown that slipped through
    // Convert **text** to <strong>text</strong>
    articleContent = articleContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Convert *text* to <em>text</em> (but not inside HTML tags)
    articleContent = articleContent.replace(/(?<!<[^>]*)\*([^*]+)\*(?![^<]*>)/g, '<em>$1</em>');
    // Remove any remaining stray asterisks
    articleContent = articleContent.replace(/\*+/g, '');
    // Clean up code fences
    articleContent = articleContent.replace(/```[a-z]*\n?/gi, '');
    articleContent = articleContent.replace(/`([^`]+)`/g, '$1');

    console.log('✅ Article content generated and cleaned successfully');

    // Step 4: Analyze article and generate image prompts
    const imagePrompts = await analyzeArticleForImagePrompts(
      articleContent,
      imageSubject,
      AI_API_KEY,
      aiProvider
    );
    console.log(`🎨 Generated ${imagePrompts.length} contextual image prompts`);

    // Step 5: Generate images
    console.log('🖼️ Generating AI images with Replicate Flux...');
    const imageUrls: string[] = [];
    
    for (let i = 0; i < 7; i++) {
      console.log(`Generating image ${i + 1}/7 with aspect ratio ${aspectRatio}...`);
      const imageUrl = await generateUniqueImage(
        imagePrompts[i],
        i + 1,
        REPLICATE_API_KEY,
        supabase,
        aspectRatio,
        imageSubject
      );
      imageUrls.push(imageUrl);
      
      if (i < 6) {
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
    }
    
    console.log(`✅ Generated ${imageUrls.length} images with aspect ratio: ${aspectRatio}`);

    // Step 6: Replace image placeholders
    const getImageDimensions = (ar: string): { width: number; height: number } => {
      const dimensions: Record<string, { width: number; height: number }> = {
        '1:1': { width: 1024, height: 1024 },
        '16:9': { width: 1920, height: 1080 },
        '4:3': { width: 1024, height: 768 },
        '3:2': { width: 1200, height: 800 },
        '2:3': { width: 800, height: 1200 },
        '9:16': { width: 1080, height: 1920 },
        '3:4': { width: 768, height: 1024 },
        '21:9': { width: 1680, height: 720 },
      };
      return dimensions[ar] || { width: 1024, height: 768 };
    };
    
    const imgDimensions = getImageDimensions(aspectRatio);
    console.log(`📐 Using image dimensions: ${imgDimensions.width}x${imgDimensions.height}`);
    
    let finalContent = articleContent;
    for (let i = 0; i < 7; i++) {
      const placeholder = `{{IMAGE_${i + 1}}}`;
      if (imageUrls[i]) {
        finalContent = finalContent.replace(
          placeholder,
          `<figure class="article-image"><img src="${imageUrls[i]}" alt="${seoTitle} - Image ${i + 1}" loading="lazy" width="${imgDimensions.width}" height="${imgDimensions.height}" style="width: 100%; height: auto; aspect-ratio: ${aspectRatio.replace(':', '/')};" /></figure>`
        );
      } else {
        finalContent = finalContent.replace(placeholder, '');
      }
    }

    // Recipe card removed - simplified article structure

    // Step 8: Validate and fix internal links
    if (relevantLinks.length > 0) {
      const linkValidation = validateInternalLinks(finalContent, relevantLinks);
      
      if (!linkValidation.isValid) {
        console.log(`🔧 Fixing ${linkValidation.missingLinks.length} missing internal links`);
        finalContent = insertMissingInternalLinks(finalContent, linkValidation.missingLinks);
      } else {
        console.log('✅ Internal linking validation passed');
      }
    }
    
    // Clean up broken links
    const brokenLinkPattern = /<a\s+href=["']?(?:javascript:|#|undefined|null|)["']?[^>]*>/gi;
    const brokenLinks = finalContent.match(brokenLinkPattern);
    if (brokenLinks && brokenLinks.length > 0) {
      console.log(`🧹 Removing ${brokenLinks.length} broken links`);
      finalContent = finalContent.replace(brokenLinkPattern, '');
    }

    console.log(`🎉 Article generated successfully for: ${seoTitle}`);

    // Update recipe with generated content
    const { error: updateError } = await supabase
      .from('recipes')
      .update({ 
        status: 'completed', 
        article_content: finalContent,
        error_message: null 
      })
      .eq('id', recipeId);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Article generated with AI images',
      imageCount: imageUrls.length,
      aspectRatio: aspectRatio,
      internalLinksCount: relevantLinks.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in generate-article:', error);
    
    try {
      const recipeId = requestBody?.recipeId;
      if (recipeId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from('recipes')
          .update({ 
            status: 'error', 
            error_message: error instanceof Error ? error.message : 'Unknown error' 
          })
          .eq('id', recipeId);
      }
    } catch (e) {
      console.error('Failed to update error status:', e);
    }

    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
