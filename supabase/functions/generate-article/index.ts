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
  
  const foodKeywords = analysisText.toLowerCase();
  const identifiedFoods: string[] = [];
  
  const foodPatterns = [
    'cake', 'cookie', 'brownie', 'pie', 'tart', 'cupcake', 'muffin', 'cheesecake',
    'pudding', 'mousse', 'ice cream', 'parfait', 'truffle', 'fudge', 'candy',
    'chocolate', 'vanilla', 'caramel', 'strawberry', 'blueberry', 'apple', 'pumpkin',
    'chicken', 'beef', 'pork', 'fish', 'salmon', 'shrimp', 'pasta', 'rice',
    'soup', 'salad', 'sandwich', 'burger', 'pizza', 'taco', 'curry', 'stir fry'
  ];
  
  for (const pattern of foodPatterns) {
    if (foodKeywords.includes(pattern)) {
      identifiedFoods.push(pattern);
    }
  }

  console.log(`📖 Extracted title: "${extractedTitle}"`);
  console.log(`📋 Identified foods: ${identifiedFoods.join(', ')}`);

  const excerpt = analysisText.length > 9000
    ? `${analysisText.slice(0, 4500)} ... ${analysisText.slice(-4500)}`
    : analysisText;

  const systemPrompt = `You are an expert food photographer and AI image prompt engineer.
Your job is to READ THE ARTICLE CONTENT CAREFULLY and generate image prompts that EXACTLY match what is described.

CRITICAL RULES:
1. READ the article title: "${extractedTitle}" - this is THE MAIN SUBJECT
2. IDENTIFY the specific food items mentioned: ${identifiedFoods.length > 0 ? identifiedFoods.join(', ') : 'analyze from content'}
3. NEVER generate prompts for foods NOT mentioned in the article
4. MATCH the article topic EXACTLY

FORBIDDEN:
- People, faces, portraits, landscapes, sky, animals
- Generic food that doesn't match the article topic
- Text, logos, watermarks

Output EXACTLY 7 prompts, one per line, numbered 1-7. Each prompt 40-70 words.
EVERY prompt MUST reference "${extractedTitle}" or the specific foods mentioned.`;

  const userPrompt = `Create 7 photorealistic food photography prompts for this article.

MAIN TOPIC: "${extractedTitle}"
DISH NAME: "${dishName}"
IDENTIFIED FOODS: ${identifiedFoods.join(', ') || 'analyze from article content'}

ARTICLE CONTENT:
${excerpt}

Create prompts for:
1. Hero shot of "${extractedTitle}" - main dish beauty shot
2. Texture close-up showing delicious details
3. Ingredients flat lay - all ingredients arranged beautifully
4. Cooking action shot - being prepared
5. Serving scene - ready to eat presentation
6. Multiple portions arranged together
7. Final beauty shot with garnish

Return only the 7 numbered lines.`;

  try {
    const response = await callAI(userPrompt, systemPrompt, AI_API_KEY, aiProvider as 'lovable' | 'groq' | 'openai');
    
    if (!response) {
      throw new Error('No response from AI for image prompts');
    }
    
    const lines = response.split('\n').filter(line => line.trim());
    const prompts: string[] = [];
    
    for (const line of lines) {
      const cleanedPrompt = line.replace(/^\d+[\.\)\:]\s*/, '').trim();
      if (cleanedPrompt.length > 20) {
        prompts.push(cleanedPrompt + ' Professional food photography, magazine quality. NO text, NO watermarks.');
      }
    }
    
    while (prompts.length < 7) {
      prompts.push(`Professional food photography of ${dishName}. Beautiful plating, natural lighting, appetizing presentation. NO text, NO watermarks.`);
    }
    
    console.log('Generated contextual image prompts:', prompts.slice(0, 7));
    return prompts.slice(0, 7);
    
  } catch (error) {
    console.error('Error analyzing article for prompts:', error);
    return [
      `Professional food photography of ${dishName}. Hero shot, overhead angle, beautifully plated. Natural lighting, appetizing. NO text.`,
      `Close-up macro food photography of ${dishName} showing texture details. Soft lighting, bokeh background. NO text.`,
      `Ingredients flat lay for ${dishName}. All ingredients arranged on marble surface. Bright lighting. NO text.`,
      `Action cooking shot of ${dishName} being prepared. Warm kitchen lighting. NO text.`,
      `Lifestyle food photography of ${dishName} on dining table. Golden hour lighting. NO text.`,
      `${dishName} storage and meal prep photo. Glass containers, organized kitchen. NO text.`,
      `Final beauty shot of ${dishName}. Single serving, dramatic lighting, restaurant quality. NO text.`
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
    
    const articleSystemPrompt = `You are writing a 1,500-word SEO article that is both engaging and informative. Write as if you are having a friendly, informal conversation with a fellow enthusiast. Follow every instruction precisely to produce a dynamic, user-friendly, and thoroughly human article.
${internalLinksInstruction}

=== STYLE & TONE REQUIREMENTS ===

CONVERSATIONAL AND INFORMAL:
- Write as if you're talking to a friend. The tone should be relaxed, engaging, and approachable.
- Use everyday language; avoid overly formal or academic language.
- Ensure the narrative flows naturally and doesn't sound scripted or robotic.

OCCASIONAL SARCASM & HUMOR:
- Inject light sarcasm and humor to keep the reader engaged. Use these elements sparingly—only enough to maintain a playful tone without overwhelming the content.
- The humor should be witty and subtle; ensure it does not detract from the main points.

PERSONAL TOUCH AND EXPERIENCE:
- Include personal opinions or anecdotes where relevant. This adds authenticity and builds trust with the reader.
- When describing features or comparing products, mention personal experiences to make the content more relatable.

ACTIVE VOICE ONLY:
- Write every sentence in the active voice. For example, use "I love this feature" instead of "This feature is loved by many."
- Double-check your sentences to avoid any passive constructions.

ENGAGEMENT THROUGH RHETORICAL QUESTIONS:
- Insert rhetorical questions throughout the article to engage the reader and provoke thought. For example: "Ever wondered why this works so well?"
- These questions should serve as conversation starters and not be overused.

USE OF SLANG & ABBREVIATIONS:
- Occasionally incorporate common internet slang such as "FYI", "IMO", etc., as well as a few emoticons (e.g., ":)" or ":/").
- Limit these to 2–3 instances per article to keep the content playful yet professional.

=== FORMATTING & STRUCTURAL REQUIREMENTS ===

INTRODUCTION:
- Begin with a short, punchy introduction that immediately hooks the reader.
- AVOID generic openers like "In today's world..." or "Let's dive into..."
- The introduction should quickly address the reader's needs and set the tone for the rest of the article.

HEADINGS AND SUBHEADINGS:
- Organize the article using H2 headings for each major section or point.
- Use H3 headings to break down subtopics within each H2 section when necessary.
- Ensure the headings are clear and descriptive to guide the reader through the content.

PARAGRAPH STRUCTURE:
- Keep paragraphs short and punchy—ideally 3–4 sentences per paragraph.
- Avoid long blocks of text to ensure readability on both desktop and mobile devices.
- Each paragraph should be focused and convey a single idea clearly.

BULLET POINTS & LISTS:
- When presenting technical details, features, or comparisons, use bullet points or numbered lists.
- These lists should break down information in an easy-to-digest format.

BOLD KEY INFORMATION:
- Throughout the article, bold the most important points, features, or pieces of information. This helps draw the reader's attention to the essential parts of your message.

=== CONTENT AND SEO REQUIREMENTS ===

CONCISENESS AND CLARITY:
- Every sentence should contribute directly to the article's purpose. Avoid filler phrases such as "dive into" or "in modern times."
- Be clear and direct—every point should have a reason for being there.

COMPARATIVE AND OPINION-BASED COMMENTARY:
- When comparing products, techniques, or ideas, include clear and honest comparisons that offer genuine insights.
- Support your opinions with logical reasoning and, when possible, real-life examples.

SEO OPTIMIZATION:
- Ensure the content is optimized for SEO by naturally including the focus keyword 8-12 times throughout.
- The language should be SEO-friendly without sacrificing readability or the conversational tone.

AVOID AI FLUFF:
- Do not include generic, AI-generated "fluff" such as overly used phrases like "dive into" or clichés.
- The writing must be human, direct, and purposeful, ensuring that every word adds value.

=== EXACT HTML STRUCTURE TO FOLLOW ===

<h1>[Create a captivating, click-worthy title that hooks the reader]</h1>

<a href="#recipe-card" class="jump-to-recipe">⬇️ Jump to Recipe</a>

{{IMAGE_1}}

<h2>[Opening Hook Section - Catchy H2 Title]</h2>
<p>Open with a captivating hook. Immediately address the reader's needs or concerns. State your personal connection or experience with the topic. Keep it SHORT and punchy.</p>
<p>No life story here—just enough to connect, then get to the good stuff. Ever wondered why certain recipes just work? Let me tell you...</p>

<h2>[Main Value Proposition - Why This Works]</h2>
<p>Explain the core value. Be specific and helpful. Use personal experience to back up your points.</p>
<ul>
<li><strong>Key benefit 1:</strong> explanation with personal touch</li>
<li><strong>Key benefit 2:</strong> why this matters to you</li>
<li><strong>Key benefit 3:</strong> the real-world advantage</li>
<li><strong>Key benefit 4:</strong> honest assessment</li>
</ul>
<p><strong>Real talk:</strong> Include an honest, relatable observation here.</p>

{{IMAGE_2}}

<h2>[Ingredients/What You Need Section]</h2>
<p>Quick, friendly intro. Keep it casual.</p>
<ul>
<li>Item 1 with measurement - add a tiny helpful note</li>
<li>Item 2 with measurement - maybe a substitution tip</li>
<li>Item 3 with measurement</li>
<li>Continue with all items needed</li>
</ul>
<p>FYI, you probably have most of this stuff already. :)</p>

{{IMAGE_3}}

<h2>[Step-by-Step Process Section]</h2>

<h3>Step 1: [Action-Based Title]</h3>
<p>Clear, active-voice instruction. Include a helpful tip in <strong>bold</strong>. Keep it conversational but informative. Think of how you'd explain this to a friend standing next to you.</p>

<h3>Step 2: [Action-Based Title]</h3>
<p>Continue with the next step. Short sentences. Active voice. Maybe throw in a rhetorical question—ever notice how this makes everything better?</p>

<h3>Step 3: [Action-Based Title]</h3>
<p>Keep the momentum going. Add personality. Include any timing tips or visual cues to look for.</p>

<h3>Step 4: [Continue as needed]</h3>
<p>Include 6-10 total steps depending on complexity. Each step should be actionable and clear.</p>

{{IMAGE_4}}

<h2>[Common Mistakes to Avoid]</h2>
<p>Learn from my failures (and the collective wisdom of the internet):</p>
<ul>
<li><strong>Mistake 1:</strong> What it is and why it ruins everything. I learned this the hard way.</li>
<li><strong>Mistake 2:</strong> The thing everyone does wrong—don't be that person.</li>
<li><strong>Mistake 3:</strong> The sneaky mistake you don't realize you're making.</li>
</ul>
<p><strong>Pro tip:</strong> Include your golden rule or key insight here.</p>

{{IMAGE_5}}

<h2>[Variations and Alternatives]</h2>
<p>Life happens. Here's how to adapt:</p>
<ul>
<li><strong>Substitution 1:</strong> What to use and why it works</li>
<li><strong>Dietary variation:</strong> specific swap for specific need</li>
<li><strong>Flavor twist:</strong> how to change it up</li>
<li><strong>Budget option:</strong> cheaper alternative that still delivers</li>
</ul>
<p>IMO, cooking should be flexible. Don't stress if you need to improvise.</p>

<h2>[Serving and Pairing Suggestions]</h2>
<p>Make this a complete experience:</p>
<ul>
<li>Pairing 1 - why it complements perfectly</li>
<li>Pairing 2 - for variety</li>
<li>Pairing 3 - if you're feeling fancy</li>
</ul>
<p>Or honestly? Enjoy it exactly as-is. Sometimes simple is best.</p>

{{IMAGE_6}}

<h2>[Storage and Make-Ahead Tips]</h2>
<h3>Storing</h3>
<p>How long it keeps and the best storage method. Be specific with timeframes.</p>

<h3>Reheating</h3>
<p>Best method to reheat without compromising quality. Include any tricks you've discovered.</p>

<h3>Make-Ahead Options</h3>
<p>What can be prepped in advance and how far ahead. Meal prep friendly? Say so!</p>

<h2>Frequently Asked Questions</h2>

<h3>Question 1 that readers commonly ask?</h3>
<p>Helpful, direct answer. Include specific advice or timing.</p>

<h3>Question 2 about modifications or alternatives?</h3>
<p>Clear answer with actionable suggestions.</p>

<h3>Question 3 about troubleshooting?</h3>
<p>Problem-solving advice based on common issues.</p>

<h3>Question 4 about variations?</h3>
<p>Enthusiastic response with specific recommendations.</p>

<h3>Question 5 relevant to the topic?</h3>
<p>Honest, helpful answer that adds value.</p>

{{IMAGE_7}}

<h2>[Concluding Section - Memorable Closing]</h2>
<p>End with a concise summary that reiterates the key points. Offer a final, engaging thought or call to action that encourages the reader to take the next step.</p>
<p>Leave them with a memorable final impression—maybe reintroduce a humorous or personal touch. You've got this. Now stop reading and start doing! :)</p>

=== CRITICAL REQUIREMENTS ===
- Write approximately 1,500 words
- Use ALL 7 image placeholders: {{IMAGE_1}} through {{IMAGE_7}}
- Maintain conversational, friend-to-friend tone throughout
- Use proper H1, H2, H3 heading hierarchy
- Include 2-3 emoticons maximum (:) or :/ only)
- Include 2-3 slang terms maximum (FYI, IMO, etc.)
- Use rhetorical questions to engage readers
- Bold key information and important points
- Keep paragraphs to 3-4 sentences maximum
- Active voice ONLY - no passive constructions
- Include the focus keyword naturally 8-12 times
- Output clean HTML only
- NO generic AI phrases like "dive into", "in today's world", "whether you're a seasoned..."`;

    const articlePrompt = `ARTICLE TITLE: "${seoTitle}"
FOCUS KEYWORD: "${focusKeyword}"

Write a 1,500-word SEO article following the exact structure and tone requirements above.

KEY REQUIREMENTS:
- Write as if talking to a friend - relaxed, engaging, approachable
- Include light sarcasm and witty humor throughout
- Add personal opinions and anecdotes for authenticity
- Use rhetorical questions to engage readers (e.g., "Ever wondered why...?")
- Use 2-3 instances of slang like "FYI", "IMO" and emoticons like ":)" or ":/"
- Bold all key information and important points
- Keep paragraphs SHORT (3-4 sentences max)
- ACTIVE VOICE ONLY - check every sentence
- Include the focus keyword "${focusKeyword}" naturally 8-12 times
- Use ALL 7 image placeholders: {{IMAGE_1}} through {{IMAGE_7}}
- Include the jump-to-recipe link after the H1
- Make it genuinely fun and engaging to read!

Remember: This should sound like a human wrote it, not AI. Be direct, be personal, be helpful.`;

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
