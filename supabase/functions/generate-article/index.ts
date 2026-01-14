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
  aiProvider: string,
  imageCount: number = 7,
  articleCategory: string = "food"
): Promise<string[]> {
  console.log(`🔍 AI Analysis: Extracting key content from article for ${imageCount} images (category: ${articleCategory})...`);
  
  const analysisText = articleContent
    .replace(/\{\{IMAGE_\d+\}\}/g, ' ')
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

  // Category-specific system prompts
  let categoryExamples: string;
  let categoryContext: string;
  
  if (articleCategory === 'home') {
    categoryExamples = `Examples of GOOD prompts for home decor:
- "modern minimalist living room with white sofa"
- "scandinavian kitchen with wooden cabinets"
- "cozy bedroom with neutral bedding"
- "contemporary bathroom with marble tiles"`;
    categoryContext = "professional interior design and home decor photography";
  } else if (articleCategory === 'fashion') {
    categoryExamples = `Examples of GOOD prompts for fashion:
- "casual summer outfit with white linen pants"
- "elegant evening dress on mannequin"
- "street style layered look autumn"
- "minimalist accessories gold jewelry"`;
    categoryContext = "professional fashion and style photography";
  } else {
    categoryExamples = `Examples of GOOD prompts for food:
- "chocolate chip cookies on white plate"
- "fresh pasta with tomato sauce"
- "colorful salad bowl overhead shot"
- "grilled salmon with lemon wedges"`;
    categoryContext = "professional food photography";
  }

  const systemPrompt = `You are an expert at creating SHORT, SPECIFIC image prompts for ${categoryContext}.

CRITICAL RULES:
- Each prompt must be SHORT (under 10 words)
- Be SPECIFIC to the article topic
- Simple subjects only - avoid complex scenes
- Professional, high-quality photography style

${categoryExamples}

BAD prompts (too generic):
- "a room"
- "nice outfit"
- "food"

Output EXACTLY ${imageCount} prompts, one per line, numbered 1-${imageCount}.`;

  const userPrompt = `Based on this article about "${extractedTitle}", create ${imageCount} SPECIFIC image prompts for ${categoryContext}.

Article excerpt:
${excerpt}

Requirements:
- Each prompt should be SHORT (under 10 words)
- Be SPECIFIC to this article topic
- Simple subjects only - avoid complex scenes
- Professional, high-quality ${articleCategory === 'home' ? 'interior design' : articleCategory === 'fashion' ? 'fashion' : 'food'} photography style

Create ${imageCount} SPECIFIC prompts with details related to this article.

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
    
    // Generate fallback prompts based on category
    const getFallbackPrompts = (category: string, subject: string): string[] => {
      if (category === 'home') {
        return [
          `${subject} living room design`,
          `${subject} bedroom styling`,
          `${subject} kitchen layout`,
          `${subject} bathroom decor`,
          `${subject} entryway design`,
          `${subject} dining room setup`,
          `${subject} home office space`
        ];
      } else if (category === 'fashion') {
        return [
          `${subject} outfit styling`,
          `${subject} accessory detail`,
          `${subject} full look styling`,
          `${subject} layered outfit`,
          `${subject} footwear styling`,
          `${subject} seasonal look`,
          `${subject} casual ensemble`
        ];
      }
      return [
        `${subject} hero shot overhead`,
        `${subject} close-up texture`,
        `${subject} ingredients arranged`,
        `${subject} being prepared`,
        `${subject} plated elegantly`,
        `${subject} multiple servings`,
        `${subject} final presentation`
      ];
    };
    
    const fallbacks = getFallbackPrompts(articleCategory, dishName);
    let fallbackIndex = 0;
    
    while (prompts.length < imageCount && fallbackIndex < fallbacks.length) {
      prompts.push(fallbacks[fallbackIndex]);
      fallbackIndex++;
    }
    
    // If still not enough, duplicate with variations
    while (prompts.length < imageCount) {
      prompts.push(`${dishName} detail shot ${prompts.length + 1}`);
    }
    
    console.log(`Generated ${prompts.length} image prompts for category: ${articleCategory}`);
    return prompts.slice(0, imageCount);
    
  } catch (error) {
    console.error('Error analyzing article for prompts:', error);
    const fallbacks = articleCategory === 'home' 
      ? Array.from({ length: imageCount }, (_, i) => `modern interior design ${dishName} ${i + 1}`)
      : articleCategory === 'fashion'
      ? Array.from({ length: imageCount }, (_, i) => `stylish outfit ${dishName} ${i + 1}`)
      : Array.from({ length: imageCount }, (_, i) => `${dishName} food photography ${i + 1}`);
    return fallbacks;
  }
}

// Generate UNIQUE AI image using Replicate Flux
async function generateUniqueImage(
  prompt: string,
  imageNumber: number,
  REPLICATE_API_KEY: string,
  supabase: any,
  aspectRatio: string = "4:3",
  dishName: string = "",
  articleCategory: string = "food",
  imageModel: string = "zimage"
): Promise<string> {
  try {
    console.log(`🖼️ Generating image ${imageNumber} with model: ${imageModel}, category: ${articleCategory}`);
    console.log(`   Prompt: ${prompt.substring(0, 80)}...`);

    // Category-specific image prompts for ultra-realistic photography
    // IMPORTANT: Do NOT mention camera equipment names as AI will generate images OF cameras!
    let realisticPrompt: string;
    
    if (articleCategory === 'home') {
      realisticPrompt = `${prompt}, professional interior design photograph, ultra-realistic, NOT illustration, NOT digital art, NOT 3D render. 
Natural daylight from large windows, eye-level angle, balanced symmetry.
Visible textures on furniture and fabrics, realistic shadows, natural wood grain, authentic materials.
8K resolution, magazine-quality interior photography, Architectural Digest style.`;
    } else if (articleCategory === 'fashion') {
      realisticPrompt = `${prompt}, professional fashion photograph, ultra-realistic, NOT illustration, NOT digital art. 
Studio lighting with soft diffusion, fashion editorial style.
Visible fabric texture, natural skin tones, authentic clothing details, professional styling.
8K resolution, magazine-quality fashion photography, Vogue style.`;
    } else {
      // Default: food photography
      realisticPrompt = `${prompt}, professional food photograph, ultra-realistic, NOT illustration, NOT digital art.
Natural lighting, overhead or 45-degree angle, wooden cutting board or marble surface, rustic kitchen background.
Visible texture, natural imperfections, authentic food styling, soft shadows.
8K resolution, magazine-quality food photography, Bon Appetit style.`;
    }

    // Parse aspect ratio to get dimensions
    const getImageDimensions = (ar: string): { width: number; height: number } => {
      const ratioMap: { [key: string]: { width: number; height: number } } = {
        '1:1': { width: 1024, height: 1024 },
        '4:3': { width: 1024, height: 768 },
        '3:4': { width: 768, height: 1024 },
        '16:9': { width: 1280, height: 720 },
        '9:16': { width: 720, height: 1280 },
        '3:2': { width: 1024, height: 682 },
        '2:3': { width: 682, height: 1024 },
      };
      return ratioMap[ar] || { width: 1024, height: 768 };
    };

    const dimensions = getImageDimensions(aspectRatio);
    let imageUrl: string | null = null;

    // ============ GPT-IMAGE (OpenAI) ============
    if (imageModel === 'gpt-image') {
      const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
      if (!OPENAI_API_KEY) {
        console.log('⚠️ OPENAI_API_KEY not set, falling back to z-image');
        imageModel = 'zimage';
      } else {
        try {
          const sizeMap: { [key: string]: string } = {
            '1:1': '1024x1024',
            '4:3': '1536x1024',
            '3:4': '1024x1536',
            '16:9': '1536x1024',
            '9:16': '1024x1536',
          };
          const size = sizeMap[aspectRatio] || '1024x1024';

          const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-image-1',
              prompt: realisticPrompt,
              n: 1,
              size,
              quality: 'high',
              output_format: 'webp',
            }),
          });

          if (response.ok) {
            const data = await response.json();
            // gpt-image-1 returns base64
            const b64 = data.data?.[0]?.b64_json;
            if (b64) {
              // Upload to Supabase Storage
              const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
              const fileName = `articles/article-${Date.now()}-${imageNumber}.webp`;
              
              const { error: uploadError } = await supabase.storage
                .from('article-images')
                .upload(fileName, bytes, { contentType: 'image/webp', upsert: true });

              if (!uploadError) {
                const { data: urlData } = supabase.storage.from('article-images').getPublicUrl(fileName);
                imageUrl = urlData?.publicUrl;
                console.log(`✅ GPT-Image generated and uploaded: image ${imageNumber}`);
              }
            }
          } else {
            const errorText = await response.text();
            console.error(`OpenAI error for image ${imageNumber}:`, response.status, errorText);
          }
        } catch (e) {
          console.error(`GPT-Image error:`, e);
        }
      }
    }

    // ============ NANO BANANA (Lovable AI Gateway - Gemini) ============
    if (!imageUrl && imageModel === 'nano-banana') {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (LOVABLE_API_KEY) {
        try {
          console.log(`🍌 Generating image ${imageNumber} with Nano Banana (Gemini)...`);
          
          const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash-image-preview',
              messages: [
                {
                  role: 'user',
                  content: `Generate a professional photograph: ${realisticPrompt}`
                }
              ],
              modalities: ['image', 'text']
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const b64Image = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
            
            if (b64Image && b64Image.startsWith('data:image')) {
              // Extract base64 data from data URL
              const base64Data = b64Image.split(',')[1];
              const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
              const fileName = `articles/article-${Date.now()}-${imageNumber}.webp`;
              
              const { error: uploadError } = await supabase.storage
                .from('article-images')
                .upload(fileName, bytes, { contentType: 'image/webp', upsert: true });

              if (!uploadError) {
                const { data: urlData } = supabase.storage.from('article-images').getPublicUrl(fileName);
                imageUrl = urlData?.publicUrl;
                console.log(`✅ Nano Banana generated and uploaded: image ${imageNumber}`);
              } else {
                console.error(`Nano Banana upload error:`, uploadError);
              }
            }
          } else {
            const errorText = await response.text();
            console.error(`Nano Banana error for image ${imageNumber}:`, response.status, errorText);
          }
        } catch (e) {
          console.error(`Nano Banana error:`, e);
        }
      } else {
        console.log('⚠️ LOVABLE_API_KEY not set for Nano Banana, falling back to z-image');
      }
    }

    // ============ REPLICATE MODELS (zimage, flux-schnell, seedream) ============
    if (!imageUrl && (imageModel === 'zimage' || imageModel === 'flux-schnell' || imageModel === 'seedream' || imageModel === 'gpt-image' || imageModel === 'nano-banana')) {
      const modelVersions: { [key: string]: { version: string; input: any } } = {
        'zimage': {
          version: 'prunaai/z-image-turbo',
          input: {
            prompt: realisticPrompt,
            width: dimensions.width,
            height: dimensions.height,
            num_inference_steps: 8,
            guidance_scale: 0,
            output_format: 'webp',
            output_quality: 90,
          },
        },
        'flux-schnell': {
          version: 'black-forest-labs/flux-schnell',
          input: {
            prompt: realisticPrompt,
            go_fast: true,
            megapixels: '1',
            num_outputs: 1,
            aspect_ratio: aspectRatio,
            output_format: 'webp',
            output_quality: 90,
            num_inference_steps: 4,
          },
        },
        'seedream': {
          version: 'bytedance/seedream-4.5',
          input: {
            prompt: realisticPrompt,
            aspect_ratio: aspectRatio,
            output_format: 'webp',
          },
        },
      };

      // If gpt-image failed, fall back to zimage
      const selectedModel = imageModel === 'gpt-image' ? 'zimage' : imageModel;
      const modelConfig = modelVersions[selectedModel] || modelVersions['zimage'];

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
            version: modelConfig.version,
            input: modelConfig.input,
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

      if (prediction) {
        // Poll for result
        let result = prediction;
        let attempts = 0;
        const maxAttempts = 60; // Increased for slower models
        
        while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
            headers: { 'Authorization': `Bearer ${REPLICATE_API_KEY}` },
          });
          
          if (statusResponse.ok) {
            result = await statusResponse.json();
          }
          attempts++;
        }

        if (result.status === 'succeeded' && result.output) {
          const rawUrl = Array.isArray(result.output) ? result.output[0] : result.output;
          console.log(`✅ ${selectedModel} generated image ${imageNumber}`);

          // Download and upload to Supabase Storage
          const imgResp = await fetch(rawUrl);
          if (imgResp.ok) {
            const bytes = new Uint8Array(await imgResp.arrayBuffer());
            const fileName = `articles/article-${Date.now()}-${imageNumber}.webp`;

            const { error: uploadError } = await supabase.storage
              .from('article-images')
              .upload(fileName, bytes, { contentType: 'image/webp', upsert: true });

            if (!uploadError) {
              const { data: urlData } = supabase.storage.from('article-images').getPublicUrl(fileName);
              imageUrl = urlData?.publicUrl || rawUrl;
            } else {
              imageUrl = rawUrl;
            }
          } else {
            imageUrl = rawUrl;
          }
        } else {
          console.error(`Replicate generation failed for image ${imageNumber}:`, result.status, result.error);
        }
      }
    }

    // Fallback if all else fails
    if (!imageUrl) {
      return await generateFallbackImage(dishName, `image ${imageNumber}`, imageNumber, supabase);
    }

    return imageUrl;
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
      articleId,
      title: focusKeyword, 
      sitemapUrl, 
      sitemapType = 'auto', 
      aspectRatio = '4:3',
      aiProvider = 'lovable',
      articleStyle = 'recipe',
      imageModel = 'zimage',
      customApiKey,
      customReplicateKey,
      internalLinks = [],
      type: articleType,
      niche
    } = requestBody;
    
    // Support both articles and recipes tables
    const entityId = articleId || recipeId;
    const tableName = articleId ? 'articles' : 'recipes';
    const contentField = articleId ? 'content_html' : 'article_content';
    
    console.log(`🚀 Starting article generation for: ${focusKeyword} (ID: ${entityId}, Table: ${tableName})`);
    
    // Normalize image model names (settings use z-image-turbo, code expects zimage)
    let normalizedImageModel = imageModel;
    if (imageModel === 'z-image-turbo') {
      normalizedImageModel = 'zimage';
    } else if (imageModel === 'seedream-4.5') {
      normalizedImageModel = 'seedream';
    } else if (imageModel === 'google-nano-banana-pro') {
      normalizedImageModel = 'nano-banana';
    }
    
    console.log(`⚙️ Settings - Aspect Ratio: ${aspectRatio}, AI Provider: ${aiProvider}, Style: ${articleStyle}, Image Model: ${imageModel} → ${normalizedImageModel}`);
    
    // Detect image count from title (e.g., "12 Easy Kitchen Ideas" → 12)
    const numberMatch = focusKeyword.match(/\b(\d+)\b/);
    let imageCount = 7; // Default
    if (numberMatch) {
      const detectedCount = parseInt(numberMatch[1], 10);
      if (detectedCount >= 3 && detectedCount <= 25) {
        imageCount = detectedCount;
        console.log(`📊 Detected ${imageCount} items from title - will generate ${imageCount} images`);
      }
    }
    
    // Determine article category for image generation
    // Map articleStyle to image category: recipe→food, listicle can be home/fashion/food based on keywords
    let articleCategory = 'food';
    const titleLower = focusKeyword.toLowerCase();
    if (titleLower.includes('kitchen') || titleLower.includes('bedroom') || titleLower.includes('living') || 
        titleLower.includes('bathroom') || titleLower.includes('decor') || titleLower.includes('interior') ||
        titleLower.includes('room') || titleLower.includes('home') || titleLower.includes('furniture')) {
      articleCategory = 'home';
    } else if (titleLower.includes('outfit') || titleLower.includes('fashion') || titleLower.includes('style') ||
               titleLower.includes('wear') || titleLower.includes('dress') || titleLower.includes('clothing')) {
      articleCategory = 'fashion';
    }
    // Also use niche if provided
    if (niche) {
      if (niche === 'decor') articleCategory = 'home';
      else if (niche === 'fashion') articleCategory = 'fashion';
      else if (niche === 'food') articleCategory = 'food';
    }
    console.log(`🏷️ Article category detected: ${articleCategory}`);

    // Determine which API key to use
    let AI_API_KEY: string;
    if (aiProvider === 'lovable') {
      AI_API_KEY = Deno.env.get('LOVABLE_API_KEY') || '';
      if (!AI_API_KEY) {
        throw new Error("LOVABLE_API_KEY is not configured");
      }
    } else if (customApiKey) {
      AI_API_KEY = customApiKey;
      console.log(`🔑 Using custom ${aiProvider} API key`);
    } else {
      throw new Error(`Custom API key required for ${aiProvider} provider. Please add your API key in Settings.`);
    }
    
    const REPLICATE_API_KEY = customReplicateKey || Deno.env.get('REPLICATE_API_KEY');
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }
    console.log(`🖼️ Using Replicate API for image generation`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update status to processing
    await supabase
      .from(tableName)
      .update({ status: 'processing' })
      .eq('id', entityId);

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
          .from(tableName)
          .update({ title: seoTitle })
          .eq('id', entityId);
      }
    } catch (e) {
      console.log('Using focus keyword as title:', focusKeyword);
    }

    // Fetch sitemap URLs if provided
    let relevantLinks: Array<{ url: string; anchorText: string }> = [];
    if (sitemapUrl) {
      const sitemapUrls = await fetchSitemapUrls(sitemapUrl, sitemapType);
      relevantLinks = await findRelevantUrls(sitemapUrls, seoTitle, AI_API_KEY, aiProvider);
      console.log(`🔗 Found ${relevantLinks.length} relevant internal links from sitemap`);
    }
    
    // Add uploaded internal links from CSV
    if (internalLinks && Array.isArray(internalLinks) && internalLinks.length > 0) {
      console.log(`🔗 Processing ${internalLinks.length} uploaded internal links...`);
      
      // Find matching keywords in the title/topic
      const titleLower = seoTitle.toLowerCase();
      const focusLower = focusKeyword.toLowerCase();
      
      for (const link of internalLinks) {
        const keywordLower = (link.keyword || '').toLowerCase();
        const categoryLower = (link.category || '').toLowerCase();
        
        // Match by keyword, title similarity, or category
        const keywordMatch = titleLower.includes(keywordLower) || focusLower.includes(keywordLower) || keywordLower.includes(focusLower.split(' ')[0]);
        const categoryMatch = categoryLower && (titleLower.includes(categoryLower) || focusLower.includes(categoryLower));
        
        if (keywordMatch || categoryMatch) {
          relevantLinks.push({
            url: link.url,
            anchorText: link.title || link.keyword
          });
        }
      }
      
      // Limit to 5 internal links max
      relevantLinks = relevantLinks.slice(0, 5);
      console.log(`🔗 Total internal links to add: ${relevantLinks.length}`);
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

    // Step 2: Generate article content
    console.log(`📄 Generating article content (${articleStyle} style)...`);

    let articleSystemPrompt: string;
    let articlePrompt: string;

    if (articleStyle === 'recipe') {
      // Recipe-style article
      articleSystemPrompt = `You are an experienced food blogger with a casual, witty voice. Write a long-form recipe article using the EXACT structure below.

TONE: Conversational, fun, relatable. Write like you're texting a friend who loves food. Use phrases like "let's be real", "chef's kiss", "IMO", "slaps", "vibes". Short punchy sentences. No fluff.
${internalLinksInstruction}

EXACT STRUCTURE TO FOLLOW:

1. OPENING HOOK - "Why this combo works (and why it slaps)"
   - 2-3 short paragraphs explaining WHY the flavors work together
   - Use fun analogies and casual language
   - Make reader excited about the dish

2. INGREDIENTS SECTION - "Ingredients you'll need"
   - Brief intro line like "Let's keep the list tight and practical"
   - List each ingredient with quantity AND a short descriptor
   - Format: <strong>Ingredient:</strong> quantity, description
   - Group by category if needed

3. OPTIONAL ADD-INS - "Optional but awesome add-ins"
   - 3-5 optional ingredients that elevate the dish
   - Brief descriptions for each

4. QUICK METHOD - "Quick method (aka: dinner in X minutes)"
   - Break into clear numbered steps
   - Each step should be scannable
   - Include timing for each step
   - Add tips inline (e.g., "FYI, moisture is the enemy of crisp skin")

5. TEXTURE TIPS - "Texture tips you'll thank me for"
   - 3-4 quick tips about achieving perfect texture
   - Use question format where helpful (e.g., "Too thick? Do this...")

6. FLAVOR TWEAKS - "Flavor tweaks for your mood"
   - Brief intro about customization
   - List swaps by category: citrus, spices, sweeteners, herbs, heat
   - Keep each swap to one line with clear explanation

7. WHAT TO SERVE - "What to serve with it"
   - Brief intro about pairing philosophy
   - Categories: Starches, Veg, Salad, Wine/drink pairing
   - 2-3 options per category

8. PLATING - "Plating that looks pro"
   - 3-4 quick plating tips
   - Focus on easy wins that look impressive

9. TIMING & DONENESS - "Timing and doneness (aka: no overcooking)"
   - Internal temps with doneness levels
   - Visual cues to look for
   - Carryover cooking notes

10. MAKE-AHEAD - "Make-ahead, leftovers, and shortcuts"
    - Make-ahead tips with timing
    - Leftover ideas (be creative - tacos, bowls, etc.)
    - Shortcuts for busy nights

11. PANTRY RESCUE - "Pantry rescue if you're missing stuff"
    - 3-4 common substitutions
    - Format: "No X? Use Y"

12. FAQ SECTION - "FAQ"
    - 5-6 real questions in <h3> tags
    - Conversational answers
    - Questions like: Can I use frozen? Will this work with other proteins? How to make less sweet? Can I grill? Good for meal prep? Kid-friendly tweaks?

13. FINAL BITES - "Final bites"
    - 2-3 sentence wrap-up
    - Encouraging, casual ending
    - End with something memorable

CRITICAL FORMATTING:
- Output ONLY valid HTML - NO Markdown
- Use <h2> for section titles (copy exact titles above)
- Use <h3> for FAQ questions only
- Use <p> for paragraphs
- Use <strong> for bold - NEVER asterisks
- Use <ul>/<li> for ingredient lists
- Use <ol>/<li> for method steps
- Keep paragraphs SHORT (2-4 lines max)
- NO emojis
- NO generic phrases like "In conclusion" or "To summarize"

IMAGE PLACEHOLDERS:
Place these naturally between sections:
{{IMAGE_1}}, {{IMAGE_2}}, {{IMAGE_3}}, {{IMAGE_4}}, {{IMAGE_5}}, {{IMAGE_6}}, {{IMAGE_7}}`;

      articlePrompt = `RECIPE: "${seoTitle}"
FOCUS KEYWORD: "${focusKeyword}"

Write a 2,500+ word recipe blog post following the EXACT 13-section structure in the system prompt.

SECTION ORDER (USE THESE EXACT TITLES):
1. Why this combo works (and why it slaps)
2. Ingredients you'll need
3. Optional but awesome add-ins
4. Quick method (aka: dinner in XX minutes) - estimate time based on recipe
5. Texture tips you'll thank me for
6. Flavor tweaks for your mood
7. What to serve with it
8. Plating that looks pro
9. Timing and doneness (aka: no overcooking)
10. Make-ahead, leftovers, and shortcuts
11. Pantry rescue if you're missing stuff
12. FAQ (5-6 questions)
13. Final bites

REQUIREMENTS:
- Include "${focusKeyword}" naturally 8-12 times
- Sound like an experienced home cook sharing with a friend
- Use casual phrases: "let's be real", "IMO", "chef's kiss", "slaps", "vibes"
- Short punchy paragraphs
- Practical, actionable advice
- Add personality and light humor
- NO emojis, NO fluff
- Distribute ALL 7 image placeholders throughout

CRITICAL: Pure HTML only. NO Markdown. Use <strong> for bold, <em> for italics.`;
    } else if (articleStyle === 'listicle') {
      // Listicle-style article
      articleSystemPrompt = `You are an expert content writer specializing in engaging, SEO-optimized listicle articles. Write a comprehensive numbered list article using the EXACT structure below.

Do NOT skip any section.
Maintain a conversational, friendly, authoritative tone.
Keep paragraphs short (2-4 lines max).
Use power words and create curiosity.
${internalLinksInstruction}

STRUCTURE TO FOLLOW:

1. HOOK INTRODUCTION (3-4 short paragraphs)
   - Start with a bold claim or surprising fact
   - No title, no generic lines - jump right in
   - Address the reader directly ("you")
   - Set up WHY they need this list
   - Tease what they'll learn

2. QUICK OVERVIEW SECTION (Optional H2)
   - Brief context on the topic
   - What makes these items special
   - How items were selected/ranked

3. THE MAIN LIST (This is the core - 7-15 numbered items)
   - Each item gets an <h2> with number and item name (e.g., "1. Item Name" or "1. Best Item for X")
   - Under each H2:
     * 2-3 paragraphs explaining the item
     * Key benefits or features in a <ul> list
     * Pro tip or insider knowledge
     * When/why to choose this option
   - Vary the depth - some items get more detail than others
   - Include bold <strong> tags for key phrases

4. COMPARISON OR QUICK REFERENCE SECTION
   - Brief comparison of top picks
   - "Best for X" summary
   - Quick decision guide

5. FAQ SECTION
   - 4-6 real questions in <h3> tags
   - Concise, helpful answers
   - Questions people actually search for

6. CONCLUSION
   - 2-3 sentences summarizing key takeaways
   - Clear recommendation or next step
   - Encouraging, confident ending

CRITICAL FORMATTING RULES:

- Output ONLY valid HTML - absolutely NO Markdown syntax
- Use <h2> for each numbered list item: "<h2>1. Item Name</h2>"
- Use <h3> for FAQ questions only
- Use <ul> with <li> for bullet points within items
- Use <strong> for bold text - NEVER use asterisks
- Use <em> for italic text - NEVER use underscores
- Use <p> tags for paragraphs
- NO code fences, backticks, or any Markdown
- NO emojis
- Keep paragraphs SHORT and scannable

IMAGE PLACEHOLDERS:
Place these placeholders naturally between list items - one image per list item:
${Array.from({ length: imageCount }, (_, i) => `{{IMAGE_${i + 1}}}`).join(', ')}

Place them on their own lines between items or after key sections. Each list item should have its own image.`;

      // Generate image placeholder list for prompt
      const imagePlaceholderList = Array.from({ length: imageCount }, (_, i) => `{{IMAGE_${i + 1}}}`).join(', ');
      
      articlePrompt = `LISTICLE TITLE: "${seoTitle}"
FOCUS KEYWORD: "${focusKeyword}"
NUMBER OF LIST ITEMS: ${imageCount}

Write a comprehensive listicle article (2,500+ words) following the structure in the system prompt.

IMPORTANT: Write EXACTLY ${imageCount} numbered list items as detected from the title.
Each numbered item should be an H2 heading.

SECTION ORDER:
1. Hook Introduction (NO H1, start directly with engaging content)
2. Quick Overview (optional, brief H2)
3. The Numbered List - EXACTLY ${imageCount} items (each item as H2 with number: "1. Item Name")
4. Comparison/Quick Reference Section (H2)
5. FAQ (H2 with 4-6 H3 questions)
6. Conclusion (H2)

KEY REQUIREMENTS:
- Include focus keyword "${focusKeyword}" naturally 10-15 times
- Each list item needs 2-3 paragraphs + bullet points
- Conversational but authoritative tone
- Active voice, short paragraphs
- Use ALL ${imageCount} image placeholders: ${imagePlaceholderList}
- Place ONE image after each list item
- Make items specific and actionable
- Include pro tips and insider knowledge
- NO emojis, NO fluff

CRITICAL: Output pure HTML only. Use <strong> for bold, <em> for italics. Each numbered item MUST be an H2 tag like "<h2>1. First Item Name</h2>".`;
    } else {
      // General blog-style article
      articleSystemPrompt = `Write a long-form, engaging blog article using the EXACT structure below.

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

      articlePrompt = `ARTICLE TITLE: "${seoTitle}"
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
    }

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

    // Step 4: Analyze article and generate image prompts based on detected count
    const imagePrompts = await analyzeArticleForImagePrompts(
      articleContent,
      imageSubject,
      AI_API_KEY,
      aiProvider,
      imageCount,
      articleCategory
    );
    console.log(`🎨 Generated ${imagePrompts.length} contextual image prompts for ${articleCategory} category`);

    // Step 5: Generate images IN PARALLEL (matching detected count from title)
    console.log(`🖼️ Generating ${imageCount} AI images with ${normalizedImageModel} (${articleCategory} style) - PARALLEL PROCESSING...`);
    
    // Create all image generation promises at once for parallel execution
    const imagePromises = Array.from({ length: imageCount }, (_, i) => {
      console.log(`🚀 Starting image ${i + 1}/${imageCount} generation...`);
      return generateUniqueImage(
        imagePrompts[i] || `${imageSubject} professional photo ${i + 1}`,
        i + 1,
        REPLICATE_API_KEY,
        supabase,
        aspectRatio,
        imageSubject,
        articleCategory,
        normalizedImageModel
      ).catch(error => {
        console.error(`❌ Image ${i + 1} failed:`, error.message);
        return ''; // Return empty string on failure
      });
    });
    
    // Execute all image generations in parallel
    const imageUrls = await Promise.all(imagePromises);
    const successCount = imageUrls.filter(url => url !== '').length;
    
    console.log(`✅ Generated ${successCount}/${imageCount} images with aspect ratio: ${aspectRatio} (PARALLEL)`);

    // Step 6: Replace image placeholders (dynamic count)
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
    for (let i = 0; i < imageCount; i++) {
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
    
    // Also clean up any remaining placeholders that weren't generated
    finalContent = finalContent.replace(/\{\{IMAGE_\d+\}\}/g, '');

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

    // Update article/recipe with generated content
    const updateData: Record<string, any> = { 
      status: 'completed', 
      error_message: null 
    };
    updateData[contentField] = finalContent;
    
    const { error: updateError } = await supabase
      .from(tableName)
      .update(updateData)
      .eq('id', entityId);

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
      const entityId = requestBody?.articleId || requestBody?.recipeId;
      const tableName = requestBody?.articleId ? 'articles' : 'recipes';
      if (entityId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from(tableName)
          .update({ 
            status: 'error', 
            error_message: error instanceof Error ? error.message : 'Unknown error' 
          })
          .eq('id', entityId);
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
