import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// RECIPE CARD STYLES - Print-friendly, modern design
// ============================================================================
const RECIPE_CARD_STYLES = `
<style>
.recipe-card-container {
  font-family: 'Georgia', serif;
  max-width: 800px;
  margin: 2rem auto;
  background: linear-gradient(135deg, #fefefe 0%, #f8f5f0 100%);
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.1);
  overflow: hidden;
  border: 1px solid #e8e0d5;
}

.recipe-card-header {
  background: linear-gradient(135deg, #2d5a27 0%, #4a7c43 100%);
  color: white;
  padding: 2rem;
  text-align: center;
}

.recipe-card-header h2 {
  font-size: 1.8rem;
  margin: 0 0 0.5rem 0;
  font-weight: 700;
}

.recipe-card-header .recipe-tagline {
  font-style: italic;
  opacity: 0.9;
  font-size: 1rem;
}

.recipe-meta-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  padding: 1.5rem 2rem;
  background: #fff;
  border-bottom: 2px dashed #e8e0d5;
}

.recipe-meta-item {
  text-align: center;
}

.recipe-meta-item .meta-icon {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.recipe-meta-item .meta-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: #888;
  letter-spacing: 0.5px;
}

.recipe-meta-item .meta-value {
  font-size: 1.1rem;
  font-weight: 600;
  color: #2d5a27;
}

.recipe-card-body {
  padding: 2rem;
}

.recipe-section {
  margin-bottom: 2rem;
}

.recipe-section h3 {
  font-size: 1.3rem;
  color: #2d5a27;
  border-bottom: 2px solid #4a7c43;
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.recipe-section h3::before {
  content: '';
  width: 8px;
  height: 8px;
  background: #4a7c43;
  border-radius: 50%;
}

.ingredients-list {
  list-style: none;
  padding: 0;
  margin: 0;
  columns: 2;
  column-gap: 2rem;
}

.ingredients-list li {
  padding: 0.5rem 0;
  border-bottom: 1px dotted #ddd;
  break-inside: avoid;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.ingredients-list li::before {
  content: '✓';
  color: #4a7c43;
  font-weight: bold;
  flex-shrink: 0;
}

.instructions-list {
  list-style: none;
  padding: 0;
  margin: 0;
  counter-reset: step-counter;
}

.instructions-list li {
  padding: 1rem 0 1rem 3.5rem;
  border-bottom: 1px solid #eee;
  position: relative;
  line-height: 1.6;
}

.instructions-list li::before {
  counter-increment: step-counter;
  content: counter(step-counter);
  position: absolute;
  left: 0;
  top: 1rem;
  width: 2rem;
  height: 2rem;
  background: linear-gradient(135deg, #2d5a27 0%, #4a7c43 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.9rem;
}

.recipe-notes {
  background: #fff9e6;
  border-left: 4px solid #f0c14b;
  padding: 1rem 1.5rem;
  border-radius: 0 8px 8px 0;
  margin-top: 1.5rem;
}

.recipe-notes h4 {
  margin: 0 0 0.5rem 0;
  color: #8a6d3b;
  font-size: 1rem;
}

.recipe-notes p {
  margin: 0;
  font-size: 0.95rem;
  color: #666;
}

.recipe-card-footer {
  background: #f8f5f0;
  padding: 1.5rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 2px dashed #e8e0d5;
}

.recipe-card-actions {
  display: flex;
  gap: 1rem;
}

.recipe-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 25px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.3s ease;
  cursor: pointer;
  border: none;
  font-size: 0.9rem;
}

.recipe-btn-print {
  background: #2d5a27;
  color: white;
}

.recipe-btn-print:hover {
  background: #1e3d1a;
  transform: translateY(-2px);
}

.recipe-btn-save {
  background: transparent;
  border: 2px solid #2d5a27;
  color: #2d5a27;
}

.recipe-btn-save:hover {
  background: #2d5a27;
  color: white;
}

.nutrition-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-top: 1rem;
}

.nutrition-item {
  text-align: center;
  padding: 1rem;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e8e0d5;
}

.nutrition-item .nutrition-value {
  font-size: 1.3rem;
  font-weight: 700;
  color: #2d5a27;
}

.nutrition-item .nutrition-label {
  font-size: 0.75rem;
  color: #888;
  text-transform: uppercase;
}

/* Jump to Recipe Button */
.jump-to-recipe {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
  color: white;
  padding: 1rem 2rem;
  border-radius: 30px;
  font-weight: 700;
  text-decoration: none;
  font-size: 1.1rem;
  box-shadow: 0 4px 15px rgba(255, 107, 53, 0.4);
  transition: all 0.3s ease;
  margin: 1.5rem 0;
}

.jump-to-recipe:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(255, 107, 53, 0.5);
}

/* Print Styles */
@media print {
  .recipe-card-container {
    box-shadow: none;
    border: 2px solid #333;
    page-break-inside: avoid;
  }
  
  .jump-to-recipe,
  .recipe-btn,
  .recipe-card-actions {
    display: none !important;
  }
  
  .recipe-card-header {
    background: #333 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  
  .ingredients-list {
    columns: 1;
  }
  
  body {
    font-size: 12pt;
  }
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .recipe-meta-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .ingredients-list {
    columns: 1;
  }
  
  .nutrition-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .recipe-card-footer {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>
`;

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

// ============================================================================
// GENERATE RECIPE CARD WITH STRUCTURED DATA
// ============================================================================
function generateRecipeCardHTML(recipeData: any, heroImageUrl: string): string {
  const {
    name,
    description,
    prepTime,
    cookTime,
    totalTime,
    servings,
    difficulty,
    ingredients,
    instructions,
    tips,
    calories,
    protein,
    carbs,
    fat
  } = recipeData;

  // Generate JSON-LD Schema
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    "name": name,
    "description": description,
    "image": heroImageUrl,
    "author": {
      "@type": "Person",
      "name": "Recipe Writer"
    },
    "datePublished": new Date().toISOString().split('T')[0],
    "prepTime": `PT${prepTime}M`,
    "cookTime": `PT${cookTime}M`,
    "totalTime": `PT${totalTime}M`,
    "recipeYield": `${servings} servings`,
    "recipeCategory": "Main Course",
    "recipeCuisine": "International",
    "recipeIngredient": ingredients,
    "recipeInstructions": instructions.map((step: string, index: number) => ({
      "@type": "HowToStep",
      "position": index + 1,
      "text": step
    })),
    "nutrition": {
      "@type": "NutritionInformation",
      "calories": `${calories} calories`,
      "proteinContent": `${protein}g`,
      "carbohydrateContent": `${carbs}g`,
      "fatContent": `${fat}g`
    }
  };

  const ingredientsList = ingredients.map((ing: string) => `<li>${ing}</li>`).join('\n');
  const instructionsList = instructions.map((step: string) => `<li>${step}</li>`).join('\n');

  return `
<!-- Recipe Card with JSON-LD Schema -->
<script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
</script>

${RECIPE_CARD_STYLES}

<div class="recipe-card-container" id="recipe-card">
  <div class="recipe-card-header">
    <h2>${name}</h2>
    <p class="recipe-tagline">${description}</p>
  </div>
  
  <div class="recipe-meta-grid">
    <div class="recipe-meta-item">
      <div class="meta-icon">⏱️</div>
      <div class="meta-label">Prep Time</div>
      <div class="meta-value">${prepTime} min</div>
    </div>
    <div class="recipe-meta-item">
      <div class="meta-icon">🍳</div>
      <div class="meta-label">Cook Time</div>
      <div class="meta-value">${cookTime} min</div>
    </div>
    <div class="recipe-meta-item">
      <div class="meta-icon">🍽️</div>
      <div class="meta-label">Servings</div>
      <div class="meta-value">${servings}</div>
    </div>
    <div class="recipe-meta-item">
      <div class="meta-icon">📊</div>
      <div class="meta-label">Difficulty</div>
      <div class="meta-value">${difficulty}</div>
    </div>
  </div>
  
  <div class="recipe-card-body">
    <div class="recipe-section">
      <h3>Ingredients</h3>
      <ul class="ingredients-list">
        ${ingredientsList}
      </ul>
    </div>
    
    <div class="recipe-section">
      <h3>Instructions</h3>
      <ol class="instructions-list">
        ${instructionsList}
      </ol>
    </div>
    
    ${tips ? `
    <div class="recipe-notes">
      <h4>💡 Pro Tips</h4>
      <p>${tips}</p>
    </div>
    ` : ''}
    
    <div class="recipe-section">
      <h3>Nutrition Facts (per serving)</h3>
      <div class="nutrition-grid">
        <div class="nutrition-item">
          <div class="nutrition-value">${calories}</div>
          <div class="nutrition-label">Calories</div>
        </div>
        <div class="nutrition-item">
          <div class="nutrition-value">${protein}g</div>
          <div class="nutrition-label">Protein</div>
        </div>
        <div class="nutrition-item">
          <div class="nutrition-value">${carbs}g</div>
          <div class="nutrition-label">Carbs</div>
        </div>
        <div class="nutrition-item">
          <div class="nutrition-value">${fat}g</div>
          <div class="nutrition-label">Fat</div>
        </div>
      </div>
    </div>
  </div>
  
  <div class="recipe-card-footer">
    <div class="recipe-card-actions">
      <button class="recipe-btn recipe-btn-print" onclick="window.print()">
        🖨️ Print Recipe
      </button>
      <button class="recipe-btn recipe-btn-save" onclick="navigator.clipboard.writeText(window.location.href); alert('Recipe link copied!')">
        📋 Copy Link
      </button>
    </div>
  </div>
</div>
`;
}

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

    // Step 2: Generate structured recipe data for the recipe card
    console.log('🍳 Generating structured recipe data...');
    
    const recipeDataPrompt = `Generate structured recipe data for: "${seoTitle}"

Return a JSON object with this EXACT structure (no markdown, just JSON):
{
  "name": "Recipe Name",
  "description": "A short, appetizing description (1-2 sentences)",
  "prepTime": 15,
  "cookTime": 30,
  "totalTime": 45,
  "servings": 4,
  "difficulty": "Easy",
  "ingredients": [
    "1 cup flour",
    "2 eggs",
    "etc..."
  ],
  "instructions": [
    "Step 1 instruction text",
    "Step 2 instruction text",
    "etc..."
  ],
  "tips": "One helpful cooking tip",
  "calories": 350,
  "protein": 25,
  "carbs": 30,
  "fat": 15
}

Make it realistic and delicious. Return ONLY valid JSON.`;

    const recipeDataSystemPrompt = `You are a professional chef creating recipe data. Return ONLY valid JSON with realistic cooking information. No markdown formatting.`;

    let recipeData = {
      name: seoTitle,
      description: `A delicious ${imageSubject} recipe that everyone will love`,
      prepTime: 15,
      cookTime: 30,
      totalTime: 45,
      servings: 4,
      difficulty: "Easy",
      ingredients: ["See recipe below for full ingredients list"],
      instructions: ["Follow the detailed instructions in the article"],
      tips: "Season to taste and adjust spices based on preference",
      calories: 350,
      protein: 25,
      carbs: 30,
      fat: 15
    };

    try {
      const recipeDataResponse = await callAI(recipeDataPrompt, recipeDataSystemPrompt, AI_API_KEY, aiProvider);
      const jsonMatch = recipeDataResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        recipeData = JSON.parse(jsonMatch[0]);
        console.log('✅ Generated structured recipe data');
      }
    } catch (e) {
      console.log('Using default recipe data structure');
    }

    // Step 3: Generate article content
    console.log('📄 Generating article content...');
    
    const articleSystemPrompt = `Write an engaging, conversational article about "${seoTitle}".

Target length: Around 1,500 words.
${internalLinksInstruction}

=== EXACT ARTICLE STRUCTURE ===

1. **INTRODUCTION** (NO heading - just start with content):
   - Start with a short, punchy intro paragraph (3-4 sentences)
   - Hook the reader immediately. No generic phrases like "In today's world..." or "In modern times..."
   - Be direct and engaging - get straight to the point
   - After intro paragraph, place: <a href="#recipe-card" class="jump-to-recipe">⬇️ Jump to Recipe</a>
   - Then place {{IMAGE_1}}

2. **FIRST H2 SECTION** - "Why [Topic] Rules/Matters/Works" or similar benefit-focused heading:
   - 2-3 paragraphs explaining the main benefits/appeal
   - Include an H3 subsection for a specific related point
   - Use <strong>FYI:</strong> or similar to highlight key tips inline

3. **SECOND H2 SECTION** - "Key [Tips/Swaps/Techniques] That Actually Work":
   - Short intro sentence
   - Bullet list with format: <li><strong>Label:</strong> Description text</li>
   - Cover 5-7 key items
   - Place {{IMAGE_2}} after this section

4. **OPTIONAL H3 SUBSECTION** - Deeper dive on a specific topic:
   - 1-2 paragraphs with practical details
   - Place {{IMAGE_3}} if appropriate

5. **MAIN CONTENT H2 SECTION** - "X [Recipes/Items/Options] Everyone [Loves/Fights Over/Needs]":
   - Short intro sentence ("These are party-proof, potluck-proof, and picky-eater-proof.")
   - Then numbered H3 items like: <h3>1) Item Name (Key Details, More Info)</h3>
   - Each H3 item has:
     - Short description sentence
     - Bullet list with <strong>Label:</strong> format for specifics (Base:, Upgrades:, Bake:, etc.)
   - Include 4-6 numbered items
   - Place {{IMAGE_4}} after 2-3 items
   - Place {{IMAGE_5}} after remaining items

6. **TIPS/TECHNIQUES H2 SECTION** - "Getting [Result] Right" or troubleshooting section:
   - Intro sentence about the challenge
   - Bullet list with <strong>Label:</strong> format
   - Include an H3 subsection for specific technique (like "Binding Without Eggs")
   - More bullet points with practical tips

7. **ADDITIONAL TIPS H2 SECTION** - "[Flavor/Style/Safety] Tips You'll Actually Use":
   - Intro sentence
   - Bullet list with <strong>Label:</strong> format
   - Include H3 subsection if needed for related topic
   - More bullet points
   - Place {{IMAGE_6}} after this section

8. **FAQ SECTION** - Use <h2>FAQ</h2>:
   - Include 5-7 common questions
   - Each question as <h3>Question text?</h3>
   - Each answer as a regular paragraph (2-4 sentences)
   - Place {{IMAGE_7}} before this section

9. **CONCLUSION** - Use <h2>Conclusion</h2>:
   - 1-2 paragraphs wrapping up the topic
   - Encouraging, friendly tone
   - Light humor at the end

=== TONE & STYLE ===

- Conversational and informal - write like you're chatting with a friend
- Approachable, light-hearted, and occasionally witty
- Use active voice only - avoid passive constructions
- Keep paragraphs SHORT (2-4 sentences max)
- Use rhetorical questions occasionally
- Sprinkle in internet slang: "FYI", "IMO" (2-3 times max)
- Include occasional humor
- Bold key information inline with <strong>Label:</strong> format

=== FORMATTING RULES ===

- Use <h2> for main sections
- Use <h3> for subsections and numbered items
- For bullet lists: <ul><li><strong>Label:</strong> Description text here.</li></ul>
- NO Markdown, code fences, or backticks
- NO H1 tags (title is separate)
- Keep everything scannable

=== IMAGE PLACEHOLDERS ===

You MUST use all 7 placeholders in this order:
- {{IMAGE_1}} - After intro and jump-to-recipe link
- {{IMAGE_2}} - After the key swaps/tips section
- {{IMAGE_3}} - After a subsection or between main sections
- {{IMAGE_4}} - Middle of the numbered recipes/items list
- {{IMAGE_5}} - End of the numbered recipes/items list
- {{IMAGE_6}} - Before FAQ section
- {{IMAGE_7}} - After FAQ, before conclusion

=== CRITICAL REQUIREMENTS ===
- Write approximately 1,500 words
- Use ALL 7 image placeholders
- Follow the EXACT structure above with H2 and H3 tags
- Use <strong>Label:</strong> format in bullet lists
- Number the main items like "1) Item Name (Details)"
- Include 5-7 FAQ questions as H3 tags
- Active voice ONLY
- Include the focus keyword naturally 8-12 times
- Output clean HTML only`;

    const articlePrompt = `ARTICLE TITLE: "${seoTitle}"
FOCUS KEYWORD: "${focusKeyword}"

Write a 1,500-word SEO article following the EXACT structure in the system prompt.

KEY REQUIREMENTS:
- Start with engaging intro paragraph (NO H1 tag)
- Use H2 for main sections, H3 for subsections and numbered items
- Format bullet lists with <strong>Label:</strong> Description pattern
- Number main content items as "1) Name (Details)" format
- Include 5-7 FAQ questions with H3 tags and paragraph answers
- End with H2 Conclusion
- Use ALL 7 image placeholders in order
- Include focus keyword "${focusKeyword}" naturally 8-12 times
- Conversational, friendly tone throughout
- Active voice only

Remember: Follow the exact structure. This should read like a helpful friend sharing expert advice.`;

    const articleContent = await callAI(articlePrompt, articleSystemPrompt, AI_API_KEY, aiProvider);

    if (!articleContent) {
      throw new Error("No content generated");
    }

    console.log('✅ Article content generated successfully');

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

    // Step 7: Generate and append recipe card with structured data
    console.log('🃏 Generating recipe card with JSON-LD schema...');
    const recipeCardHTML = generateRecipeCardHTML(recipeData, imageUrls[0] || '');
    
    // Insert recipe card before the FAQ section or at the end
    const faqIndex = finalContent.indexOf('<h2>FAQ');
    if (faqIndex > -1) {
      finalContent = finalContent.slice(0, faqIndex) + recipeCardHTML + '\n\n' + finalContent.slice(faqIndex);
    } else {
      finalContent = finalContent + '\n\n' + recipeCardHTML;
    }

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
      message: 'Article generated with Recipe Card, JSON-LD schema, and AI images',
      imageCount: imageUrls.length,
      aspectRatio: aspectRatio,
      internalLinksCount: relevantLinks.length,
      hasRecipeCard: true,
      hasSchema: true
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
