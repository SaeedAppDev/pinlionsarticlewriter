import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// Call Lovable AI Gateway for text generation (no rate limits!)
async function callLovableAI(prompt: string, systemPrompt: string, LOVABLE_API_KEY: string): Promise<string> {
  console.log('Calling Lovable AI Gateway...');
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
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
    console.error('Lovable AI error:', response.status, errorText);
    throw new Error(`Lovable AI error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Create a short, image-friendly subject from long SEO titles/keywords
function getImageSubject(focusKeyword: string, seoTitle: string): string {
  const base = (focusKeyword || seoTitle || '').trim();
  if (!base) return 'food recipe';

  // Remove common title fluff that harms image search / prompts
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

// Fallback that is STILL relevant: search Openverse (free) and upload the image to our storage bucket
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
      const first = results.find((r: any) => typeof r?.url === 'string' && r.url.startsWith('http'))
        || results.find((r: any) => typeof r?.thumbnail === 'string' && r.thumbnail.startsWith('http'));

      candidateUrl = (first?.url || first?.thumbnail) ?? null;
    }

    // Absolute last resort (should be rare)
    if (!candidateUrl) {
      const seed = `${Date.now()}-${imageNumber}`;
      return `https://picsum.photos/seed/${seed}/1200/800`;
    }

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
    const seed = `${Date.now()}-${imageNumber}`;
    return `https://picsum.photos/seed/${seed}/1200/800`;
  }
}

// Generate UNIQUE AI image for each recipe section using Replicate Flux
async function generateUniqueImage(
  dishName: string,
  imageContext: string,
  imageNumber: number,
  REPLICATE_API_KEY: string,
  supabase: any,
  aspectRatio: string = "4:3"
): Promise<string> {
  try {
    console.log(`Generating unique image ${imageNumber} for: ${dishName} - ${imageContext} (aspect: ${aspectRatio})`);

    // Create UNIQUE, SPECIFIC prompts for each image position
    const imagePrompts: Record<number, string> = {
      1: `Professional food photography of ${dishName}. Hero shot, overhead angle 45 degrees, the dish beautifully plated on a rustic wooden table. Natural window light, shallow depth of field. Steam rising if hot. Fresh garnishes. Magazine quality, appetizing, mouthwatering. NO text, NO watermarks.`,
      2: `Close-up macro food photography of ${dishName} showing texture details. Focus on the most appealing part - crispy edges, gooey center, glossy sauce, or flaky layers. Soft natural lighting, creamy bokeh background. Professional food styling. NO text.`,
      3: `Ingredients flat lay for ${dishName}. All raw ingredients beautifully arranged on marble or wooden surface. Fresh vegetables, spices in small bowls, eggs, flour. Bright natural lighting from above. Clean, organized, Pinterest-worthy composition. NO text.`,
      4: `Action cooking shot of ${dishName} being prepared. Hands stirring, pouring sauce, or sprinkling toppings. Motion blur on action, sharp focus on food. Warm kitchen lighting, homey atmosphere. Authentic cooking moment. NO text.`,
      5: `Lifestyle food photography of ${dishName} on a dining table setting. Beautiful ceramic plates, linen napkins, cutlery, wine glass nearby. Warm golden hour lighting. Cozy, inviting dinner scene. Magazine editorial style. NO text.`,
      6: `${dishName} storage and meal prep photo. Food in glass containers, some portions wrapped, organized in fridge or on counter. Clean, organized kitchen background. Meal prep inspiration style. Bright lighting. NO text.`,
      7: `Final beauty shot of ${dishName}. Single serving perfectly plated. Dramatic lighting with soft shadows. Sauce artfully drizzled. Fresh herb garnish. One bite taken to show inside texture. Restaurant quality presentation. NO text.`
    };

    const prompt = imagePrompts[imageNumber] || imagePrompts[1];

    // Call Replicate API with Flux Schnell model - use consistent aspect ratio from settings
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: "black-forest-labs/flux-schnell",
        input: {
          prompt: prompt,
          go_fast: true,
          megapixels: "1",
          num_outputs: 1,
          aspect_ratio: aspectRatio,
          output_format: "webp",
          output_quality: 80,
          num_inference_steps: 4
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Replicate API error for image ${imageNumber}:`, response.status, errorText);
      return await generateFallbackImage(dishName, imageContext, imageNumber, supabase);
    }

    const prediction = await response.json();
    
    // Poll for result (Replicate is async)
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
      return await generateFallbackImage(dishName, imageContext, imageNumber, supabase);
    }

    const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
    console.log(`Replicate generated image ${imageNumber}:`, imageUrl);

    // Download and upload to Supabase Storage for persistence
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) {
      console.error(`Failed to download Replicate image ${imageNumber}`);
      return imageUrl; // Return Replicate URL directly as fallback
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
      return imageUrl; // Return Replicate URL if upload fails
    }

    const { data: urlData } = supabase.storage
      .from('article-images')
      .getPublicUrl(fileName);

    console.log(`Image ${imageNumber} generated and uploaded successfully`);
    return urlData?.publicUrl || imageUrl;
  } catch (error) {
    console.error(`Error generating image ${imageNumber}:`, error);
    return await generateFallbackImage(dishName, imageContext, imageNumber, supabase);
  }
}


// Find relevant URLs from sitemap
async function findRelevantUrls(
  sitemapUrls: string[], 
  topic: string, 
  LOVABLE_API_KEY: string
): Promise<Array<{ url: string; anchorText: string }>> {
  if (sitemapUrls.length === 0) return [];
  
  try {
    const prompt = `Topic: "${topic}"

Available URLs:
${sitemapUrls.slice(0, 50).join('\n')}

Find 3-5 URLs most relevant to this topic for internal linking. Return JSON array:
[{"url": "full_url", "anchorText": "natural anchor text for the link"}]

Only return valid JSON array, nothing else.`;

    const content = await callLovableAI(prompt, 'You analyze URLs and find ones relevant to a cooking topic. Return JSON array only.', LOVABLE_API_KEY);
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Error finding relevant URLs:', error);
  }
  
  return [];
}

// Validate and fix internal links in article content
function validateInternalLinks(
  content: string, 
  expectedLinks: Array<{ url: string; anchorText: string }>
): { isValid: boolean; missingLinks: Array<{ url: string; anchorText: string }> } {
  const missingLinks: Array<{ url: string; anchorText: string }> = [];
  
  for (const link of expectedLinks) {
    // Check if the URL exists in the content
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

// Insert missing internal links into article content
function insertMissingInternalLinks(
  content: string, 
  missingLinks: Array<{ url: string; anchorText: string }>
): string {
  if (missingLinks.length === 0) return content;
  
  console.log(`Inserting ${missingLinks.length} missing internal links...`);
  
  let updatedContent = content;
  
  // Find paragraphs and insert links naturally
  for (const link of missingLinks) {
    // Look for the first <p> after the intro that doesn't already have a link
    const paragraphRegex = /<p>([^<]*?)(\.)<\/p>/g;
    let match;
    let inserted = false;
    
    while ((match = paragraphRegex.exec(updatedContent)) !== null && !inserted) {
      const paragraph = match[0];
      // Skip very short paragraphs or those that already have links
      if (paragraph.length > 100 && !paragraph.includes('<a href')) {
        const insertPoint = match.index + match[1].length;
        const linkHtml = ` For more ideas, check out <a href="${link.url}">${link.anchorText}</a>`;
        updatedContent = updatedContent.slice(0, insertPoint) + linkHtml + updatedContent.slice(insertPoint);
        inserted = true;
        console.log(`Inserted link: ${link.url}`);
      }
    }
    
    // If we couldn't insert in a paragraph, add before the FAQ section
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestBody: any = null;
  
  try {
    requestBody = await req.json();
    const { recipeId, title: focusKeyword, sitemapUrl, sitemapType = 'auto', aspectRatio = '4:3' } = requestBody;
    
    console.log(`Settings - Aspect Ratio: ${aspectRatio}`);
    
    console.log(`Generating article for focus keyword: ${focusKeyword} (ID: ${recipeId})`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }
    
    const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');
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

    // Step 0: Generate SEO-optimized title from focus keyword
    console.log('Generating SEO title from focus keyword...');
    
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
      const generatedTitle = await callLovableAI(titlePrompt, titleSystemPrompt, LOVABLE_API_KEY);
      if (generatedTitle && generatedTitle.trim().length > 0) {
        seoTitle = generatedTitle.trim().replace(/^["']|["']$/g, '').trim();
        console.log(`Generated SEO title: ${seoTitle}`);
        
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
      relevantLinks = await findRelevantUrls(sitemapUrls, seoTitle, LOVABLE_API_KEY);
      console.log(`Found ${relevantLinks.length} relevant internal links`);
    }

    // Step 1: Generate UNIQUE AI images for each section
    console.log('Generating UNIQUE AI images with Replicate Flux...');

    // IMPORTANT: Use a short food/topic phrase for images (not the full clickbait title)
    const imageSubject = getImageSubject(focusKeyword, seoTitle);
    console.log(`Image subject: ${imageSubject}`);
    
    const imageContexts = [
      'hero shot',
      'texture close-up',
      'ingredients flat lay',
      'cooking action',
      'table setting',
      'storage and meal prep',
      'final beauty shot'
    ];
    
    const imageUrls: string[] = [];
    
    // Generate images sequentially to avoid rate limits
    for (let i = 0; i < 7; i++) {
      console.log(`Generating image ${i + 1}/7 with aspect ratio ${aspectRatio}...`);
      const imageUrl = await generateUniqueImage(
        imageSubject,
        imageContexts[i],
        i + 1,
        REPLICATE_API_KEY,
        supabase,
        aspectRatio
      );
      imageUrls.push(imageUrl);
      
      // Small delay between image generations
      if (i < 6) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`Generated ${imageUrls.length} unique images with aspect ratio: ${aspectRatio}`);

    // Build internal links section
    let internalLinksInstruction = '';
    if (relevantLinks.length > 0) {
      internalLinksInstruction = `

INTERNAL LINKING REQUIREMENT:
Naturally incorporate these internal links within the article content:
${relevantLinks.map(link => `- <a href="${link.url}">${link.anchorText}</a>`).join('\n')}

Place these links naturally within paragraphs where they make sense.`;
    }

    // Step 2: Generate SEO-optimized article content
    console.log('Generating article content with Groq...');
    
    const articleSystemPrompt = `You are a fun, relatable food blogger writing for friends. Write a detailed, conversational, SEO-optimized recipe article in English (1000-1200 words).
${internalLinksInstruction}

TONE & STYLE RULES:
- Informal, playful tone like talking to a friend
- Use humor, mild sarcasm, and relatability
- Avoid cliches like "In today's world"
- Keep paragraphs SHORT and engaging (2-3 sentences max)
- Use bold to highlight key tips
- Use occasional slang like FYI or IMO (but limit to 2-3 times)
- Avoid passive voice as much as possible
- Make it mobile-friendly with short paragraphs
- No emojis

EXACT STRUCTURE TO FOLLOW:

<h1>[Create a catchy, fun, click-worthy title]</h1>

{{IMAGE_1}}

<h2>Short, Catchy Intro</h2>
<p>Start with humor or relatability. Hook the reader immediately. No formal textbook tone. Keep it light and friendly. 2-3 short paragraphs.</p>

<h2>Why This Recipe Is Awesome</h2>
<p>Explain why this recipe is great with fun tone, mild sarcasm allowed.</p>
<ul>
<li><strong>Beginner-friendly:</strong> playful explanation</li>
<li><strong>Comfort food level:</strong> 100/10</li>
<li><strong>Customizable:</strong> playful note</li>
<li><strong>Budget-friendly:</strong> basic ingredients, big flavor</li>
<li><strong>Crowd-pleaser:</strong> everyone is happy</li>
<li><strong>Reheats beautifully:</strong> future-you will thank present-you</li>
</ul>

{{IMAGE_2}}

<h2>Quick Recipe Overview</h2>
<ul>
<li><strong>Prep Time:</strong> X minutes</li>
<li><strong>Cook Time:</strong> X minutes</li>
<li><strong>Servings:</strong> X people</li>
<li><strong>Difficulty:</strong> Easy/Medium</li>
<li><strong>Flavor:</strong> describe flavor profile</li>
</ul>

<h2>Ingredients You Will Need</h2>
<p>Brief playful intro about ingredients.</p>
<ul>
<li>Ingredient 1 with measurement</li>
<li>Ingredient 2 with measurement</li>
(list all ingredients)
</ul>
<p><strong>Important tip:</strong> Season your food. Bland food is the villain of every kitchen story.</p>

{{IMAGE_3}}

<h2>Step-by-Step Instructions</h2>

<h3>1. First Step Title</h3>
<p>2-4 sentences max. Active voice. Include small helpful tip in <strong>bold</strong> if relevant.</p>

<h3>2. Second Step Title</h3>
<p>Continue with clear, fun instructions...</p>

(Continue with 6-10 numbered steps, each with H3)

{{IMAGE_4}}

<h2>Common Mistakes to Avoid</h2>
<p>A few traps people fall into (learn from them):</p>
<ul>
<li>mistake 1 with humorous explanation</li>
<li>mistake 2 with humorous explanation</li>
<li>mistake 3 with humorous explanation</li>
<li>mistake 4 with humorous explanation</li>
</ul>
<p><strong>Golden rule:</strong> Taste as you cook. Your tongue is your best tool.</p>

{{IMAGE_5}}

<h2>Alternatives and Substitutions</h2>
<p>This recipe is flexible - vibe with it:</p>
<ul>
<li><strong>No [ingredient]?</strong> use [alternative]</li>
<li><strong>Vegetarian version:</strong> replace with [option]</li>
<li><strong>Gluten-free:</strong> use [alternative]</li>
<li><strong>Low-carb:</strong> use [alternative]</li>
<li><strong>Extra cheesy:</strong> add [option] (you are welcome)</li>
</ul>
<p>Cooking is not a contract - it is controlled chaos.</p>

<h2>Serving Suggestions</h2>
<p>Want to make it feel fancy without actually trying?</p>
<ul>
<li>Side option 1</li>
<li>Side option 2</li>
<li>Side option 3</li>
</ul>
<p>Or straight out of the baking dish while standing over the stove - zero judgment.</p>

{{IMAGE_6}}

<h2>Storage, Freezing and Reheating</h2>
<h3>Refrigeration</h3>
<p>Store leftovers up to X days in an airtight container.</p>

<h3>Freezing</h3>
<p>Freeze portions for X months.</p>

<h3>Reheat</h3>
<p>Oven or microwave both work. Add a little extra cheese because you deserve happiness.</p>

<p><strong>Fun fact:</strong> it somehow tastes even better the next day.</p>

<h2>FAQ - [Recipe Name]</h2>

<h3>Is this [dish] spicy?</h3>
<p>Conversational answer with humor.</p>

<h3>Which [ingredient variation] works best?</h3>
<p>Helpful answer with personality.</p>

<h3>Can I make it ahead?</h3>
<p>Yes. Assemble, refrigerate, bake later. Easy.</p>

<h3>Can I skip the [optional ingredient]?</h3>
<p>You can. But your conscience might side-eye you.</p>

<h3>Can I add [common addition]?</h3>
<p>Absolutely. This recipe loves new friends.</p>

{{IMAGE_7}}

<h2>Final Thoughts</h2>
<p>2-3 short paragraphs with friendly encouragement. Keep tone playful and motivating. End with something like "Now go impress someone, even if it is just yourself."</p>
<p>And yes, licking the spoon is technically optional - but highly recommended.</p>

CRITICAL GUIDELINES:
- Write 1000-1200 words
- Use ALL 7 image placeholders: {{IMAGE_1}} through {{IMAGE_7}}
- Keep it FUN, conversational, like a friend sharing a recipe
- Use proper H1, H2, H3 headings hierarchy
- No emojis
- Output clean HTML only
- Include the focus keyword naturally 8-12 times throughout`;

    const articlePrompt = `RECIPE TOPIC: "${seoTitle}"
FOCUS KEYWORD: "${focusKeyword}"

Write a FUN, CONVERSATIONAL (1000-1200 words), SEO-optimized recipe article following the exact structure above. 
- Be playful, use humor, talk like a friend
- Include the focus keyword "${focusKeyword}" naturally 8-12 times
- Include ALL 7 image placeholders: {{IMAGE_1}}, {{IMAGE_2}}, {{IMAGE_3}}, {{IMAGE_4}}, {{IMAGE_5}}, {{IMAGE_6}}, {{IMAGE_7}}
- Keep paragraphs SHORT and punchy
- Make it genuinely fun to read!`;

    const articleContent = await callLovableAI(articlePrompt, articleSystemPrompt, LOVABLE_API_KEY);

    if (!articleContent) {
      throw new Error("No content generated");
    }

    // Step 3: Replace image placeholders with real image URLs
    // Use consistent image sizing based on aspect ratio from settings
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
    console.log(`Using image dimensions: ${imgDimensions.width}x${imgDimensions.height} (aspect: ${aspectRatio})`);
    
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

    // Step 4: Validate and fix internal links
    if (relevantLinks.length > 0) {
      const linkValidation = validateInternalLinks(finalContent, relevantLinks);
      
      if (!linkValidation.isValid) {
        console.log(`Internal linking validation failed: ${linkValidation.missingLinks.length} links missing`);
        finalContent = insertMissingInternalLinks(finalContent, linkValidation.missingLinks);
        
        // Re-validate after insertion
        const reValidation = validateInternalLinks(finalContent, relevantLinks);
        console.log(`After fix: ${relevantLinks.length - reValidation.missingLinks.length}/${relevantLinks.length} links present`);
      } else {
        console.log('Internal linking validation passed - all links present');
      }
    }
    
    // Check for broken links (links with empty href or placeholder text)
    const brokenLinkPattern = /<a\s+href=["']?(?:javascript:|#|undefined|null|)["']?[^>]*>/gi;
    const brokenLinks = finalContent.match(brokenLinkPattern);
    if (brokenLinks && brokenLinks.length > 0) {
      console.log(`Warning: Found ${brokenLinks.length} potentially broken links, removing them...`);
      finalContent = finalContent.replace(brokenLinkPattern, '');
    }
    
    // Check for duplicate internal links
    const linkHrefPattern = /<a\s+href=["']([^"']+)["']/gi;
    const foundHrefs: string[] = [];
    let duplicateMatch;
    while ((duplicateMatch = linkHrefPattern.exec(finalContent)) !== null) {
      const href = duplicateMatch[1];
      if (foundHrefs.includes(href)) {
        console.log(`Warning: Duplicate link found: ${href}`);
      } else {
        foundHrefs.push(href);
      }
    }

    console.log(`Article generated successfully for: ${seoTitle}`);

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
      message: 'Article generated with UNIQUE AI images and validated internal links',
      imageCount: imageUrls.length,
      aspectRatio: aspectRatio,
      internalLinksCount: relevantLinks.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-article:', error);
    
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
