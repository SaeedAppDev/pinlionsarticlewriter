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

  // Category-specific system prompts - DETAILED PROMPTS (50-100 words each)
  let categoryExamples: string;
  let categoryContext: string;
  
  if (articleCategory === 'home') {
    categoryExamples = `Examples of EXCELLENT DETAILED prompts for home decor:
- "A Scandinavian minimalist living room with a cream boucle sofa, natural oak coffee table, woven jute rug, tall fiddle leaf fig plant in terracotta pot, floor-to-ceiling windows with sheer linen curtains, soft afternoon sunlight creating warm shadows, editorial interior design photography, Architectural Digest style, 8K resolution"
- "Modern farmhouse kitchen with white shaker cabinets, black iron handles, butcher block island countertop, open wooden shelving displaying ceramic dishes, copper pendant lights, subway tile backsplash, natural window light, professional real estate photography quality"`;
    categoryContext = "professional interior design and home decor photography";
  } else if (articleCategory === 'fashion') {
    categoryExamples = `Examples of EXCELLENT DETAILED prompts for fashion:
- "Elegant autumn layered outfit on model, camel wool coat over cream turtleneck sweater, high-waisted dark denim jeans, brown leather ankle boots, gold minimalist jewelry, standing in urban setting with brick wall background, soft overcast lighting, Vogue editorial style, natural skin texture visible, 8K fashion photography"
- "Summer beach casual outfit flat lay on white linen backdrop, flowing white cotton maxi dress, woven straw tote bag, gold sandals, shell necklace, sunglasses, fresh flowers accent, overhead shot, soft diffused natural light, Harper's Bazaar style product photography"`;
    categoryContext = "professional fashion and style photography";
  } else {
    categoryExamples = `Examples of EXCELLENT DETAILED prompts for food (TastyWithTina.com quality):
- "Freshly baked chocolate chip cookies cooling on wire rack, perfectly golden brown edges with soft chewy centers, visible gooey chocolate chunks, small cracks on surface showing dense texture, light dusting of sea salt flakes, warm natural window light from left side, shallow depth of field, clean white marble countertop, professional food blog photography, 8K editorial cookbook quality"
- "Homemade carrot cake slice on white ceramic plate, visible orange carrot shreds in moist dense crumb, thick cream cheese frosting with rustic swirls, chopped walnut garnish, soft natural daylight, light oak wooden table, single fork beside plate, TastyWithTina style clean bright appetizing food photography, room temperature completely still"
- "Stack of fluffy buttermilk pancakes on round white plate, golden brown surface with small bubbles visible, pat of melting butter on top, maple syrup drizzling down sides, fresh blueberries scattered, clean bright natural light, minimal background, professional food magazine quality photograph"`;
    categoryContext = "professional food photography matching TastyWithTina.com quality";
  }

  const systemPrompt = `You are an expert at creating DETAILED, SPECIFIC image prompts for ${categoryContext}.

CRITICAL RULES:
- Each prompt must be DETAILED and DESCRIPTIVE (50-100 words)
- Include SPECIFIC textures: crumb structure, golden edges, gooey centers, visible ingredients
- Include EXACT lighting: natural window light from left, soft diffused daylight, gentle shadows
- Include CAMERA details: shallow depth of field, 45-degree angle, sharp focus on main subject
- Include STYLING: clean white plate, wooden table, minimal props, professional food blog aesthetic
- For food: Describe the food as COLD, ROOM TEMPERATURE, COMPLETELY STILL - never mention hot/warm/steam
- Reference TastyWithTina.com style: clean, bright, natural, appetizing, editorial cookbook quality

${categoryExamples}

BAD prompts (too short/generic):
- "chocolate chip cookies" ❌
- "nice cake" ❌  
- "food on plate" ❌

GOOD prompts describe: subject + textures + colors + lighting + camera angle + styling + quality reference

Output EXACTLY ${imageCount} DETAILED prompts, one per line, numbered 1-${imageCount}.`;

  const userPrompt = `Based on this article about "${extractedTitle}", create ${imageCount} ULTRA-DETAILED image prompts for ${categoryContext}.

Article excerpt:
${excerpt}

Requirements for EACH prompt (50-100 words):
1. SUBJECT: Exactly what food/item is shown, with specific details
2. TEXTURES: Describe visible textures (crumbs, golden edges, gooey centers, frosting swirls)
3. COLORS: Specific colors and tones visible
4. PLATING: Type of plate/surface, arrangement, garnishes
5. LIGHTING: Natural window light, soft shadows, bright and clean
6. CAMERA: Shallow depth of field, shooting angle, focus point
7. STYLING: Minimal props, clean background, professional food blog aesthetic
8. QUALITY: Reference TastyWithTina.com or editorial cookbook style
9. For food: Describe as COLD and STILL (room temperature, no steam, motionless)

Create ${imageCount} DETAILED prompts that would generate images matching TastyWithTina.com quality.

Format as numbered list:
1. [detailed 50-100 word prompt with all elements above]
2. [detailed 50-100 word prompt with all elements above]
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
      // Accept LONGER prompts now (50-300 words / up to 1500 chars)
      if (cleanedPrompt.length > 30 && cleanedPrompt.length < 1500) {
        prompts.push(cleanedPrompt);
      }
    }
    
    // Generate DETAILED fallback prompts based on category (matching TastyWithTina quality)
    const getFallbackPrompts = (category: string, subject: string): string[] => {
      if (category === 'home') {
        return [
          `${subject} in a bright modern living room with natural daylight streaming through large windows, neutral color palette, comfortable seating, decorative accents, professional interior design photography, Architectural Digest quality, 8K resolution`,
          `${subject} bedroom styling with soft neutral bedding, natural wood furniture, ambient morning light, clean minimalist aesthetic, editorial home decor photography`,
          `${subject} modern kitchen with clean countertops, natural wood accents, pendant lighting, bright window light, professional real estate photography quality`,
          `${subject} bathroom design with spa-like aesthetic, natural materials, soft lighting, clean lines, magazine quality interior photography`,
          `${subject} entryway with welcoming decor, natural light, organized storage, inviting atmosphere, professional home staging photography`,
          `${subject} dining room with elegant table setting, natural centerpiece, ambient lighting, sophisticated style, editorial interior photography`,
          `${subject} home office with organized workspace, natural light, comfortable seating, productive atmosphere, professional interior design photo`
        ];
      } else if (category === 'fashion') {
        return [
          `${subject} outfit styled on model with natural skin texture, soft studio lighting, fashion editorial composition, Vogue magazine quality, 8K resolution professional photography`,
          `${subject} accessory detail shot on neutral background, soft diffused lighting, sharp focus on textures, luxury product photography style`,
          `${subject} full look styling in urban setting, natural daylight, editorial fashion photography, magazine quality`,
          `${subject} layered outfit with visible fabric textures, professional fashion photography, Harper's Bazaar style`,
          `${subject} footwear styling with clean background, product photography lighting, sharp detail focus`,
          `${subject} seasonal look with appropriate styling, natural outdoor lighting, editorial fashion aesthetic`,
          `${subject} casual ensemble in lifestyle setting, soft natural light, approachable fashion photography`
        ];
      }
      // DETAILED food prompts matching TastyWithTina.com quality
      return [
        `${subject} hero shot from 45-degree angle on clean white ceramic plate, visible textures and colors, perfectly styled with minimal garnish, natural window light from left side creating soft shadows, light oak wooden table, shallow depth of field with creamy bokeh background, professional food blog photography matching TastyWithTina.com, room temperature completely still, 8K editorial cookbook quality`,
        `${subject} close-up texture shot showing detailed surface, visible crumbs or layers or ingredients, natural matte appearance, sharp focus on main subject, soft diffused daylight, clean minimal background, professional food photography, cold and motionless, appetizing editorial style`,
        `${subject} ingredients beautifully arranged on marble countertop, overhead flat lay shot, natural daylight, organized composition, fresh and appetizing appearance, professional food blog styling, clean bright aesthetic`,
        `${subject} being plated on white dish, action frozen in time, natural kitchen setting, bright window light, professional food photography, TastyWithTina style clean and inviting`,
        `${subject} elegantly plated on restaurant-quality white plate, artistic garnish placement, 45-degree angle shot, shallow depth of field, natural light from window, professional editorial food photography, completely still room temperature`,
        `${subject} multiple servings arranged on wooden cutting board, family-style presentation, natural rustic styling, soft window light, professional food blog photography, warm inviting atmosphere`,
        `${subject} final presentation beauty shot, perfect styling with fresh garnish, natural daylight, clean white background, professional editorial cookbook photography matching TastyWithTina.com quality, 8K resolution`
      ];
    };
    
    const fallbacks = getFallbackPrompts(articleCategory, dishName);
    let fallbackIndex = 0;
    
    while (prompts.length < imageCount && fallbackIndex < fallbacks.length) {
      prompts.push(fallbacks[fallbackIndex]);
      fallbackIndex++;
    }
    
    // If still not enough, create detailed variations
    while (prompts.length < imageCount) {
      prompts.push(`${dishName} professionally styled on clean white plate, natural window light from left, visible textures and colors, shallow depth of field, 45-degree shooting angle, TastyWithTina.com style food photography, room temperature completely still, 8K editorial cookbook quality, variation ${prompts.length + 1}`);
    }
    
    console.log(`Generated ${prompts.length} image prompts for category: ${articleCategory}`);
    return prompts.slice(0, imageCount);
    
  } catch (error) {
    console.error('Error analyzing article for prompts:', error);
    // DETAILED error fallbacks matching TastyWithTina quality
    const fallbacks = articleCategory === 'home' 
      ? Array.from({ length: imageCount }, (_, i) => `${dishName} in modern interior setting with natural daylight, clean aesthetic, professional interior design photography, Architectural Digest quality, variation ${i + 1}`)
      : articleCategory === 'fashion'
      ? Array.from({ length: imageCount }, (_, i) => `${dishName} fashion styling with natural lighting, visible fabric textures, professional editorial photography, Vogue style, variation ${i + 1}`)
      : Array.from({ length: imageCount }, (_, i) => `${dishName} on clean white ceramic plate, natural window light from left, visible textures, shallow depth of field, TastyWithTina.com style professional food photography, room temperature completely still, 8K cookbook quality, variation ${i + 1}`);
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
    // CRITICAL: Explicitly tell AI to NOT add any text, watermarks, or overlays!
    let realisticPrompt: string;
    
    // ULTRA-STRICT NO TEXT RULE - This must be at the START of prompt for maximum effect
    const noTextRulePrefix = "ABSOLUTE RULE: Generate ONLY a photograph with ZERO text. NO words, NO letters, NO numbers, NO titles, NO labels, NO captions, NO watermarks, NO logos, NO typography, NO overlays, NO writing of ANY kind anywhere in the image.";
    
    const noTextRuleSuffix = "REMINDER: This image must contain ABSOLUTELY NO TEXT OR WORDS OF ANY KIND. Pure photography only.";
    
    if (articleCategory === 'home') {
      realisticPrompt = `${noTextRulePrefix}

Generate: ${prompt}

Style requirements:
- Professional interior design photograph, REAL photography, NOT illustration, NOT digital art, NOT 3D render, NOT cartoon, NOT painting
- Ultra photorealistic with natural imperfections
- Natural daylight streaming through large windows
- Eye-level perspective with balanced composition
- Rich visible textures: soft fabrics, polished wood grain, woven rugs, brushed metals
- Authentic materials: real marble, genuine leather, natural linen, solid hardwood
- Subtle realistic shadows and ambient lighting
- Magazine editorial quality like Architectural Digest or Elle Decor
- 8K ultra high resolution, crisp details throughout
- Color grading: warm, inviting, sophisticated

${noTextRuleSuffix}`;
    } else if (articleCategory === 'fashion') {
      realisticPrompt = `${noTextRulePrefix}

Generate: ${prompt}

Style requirements:
- Professional fashion photograph, REAL photography, NOT illustration, NOT digital art, NOT 3D render
- Ultra photorealistic with natural skin texture
- Studio lighting with soft diffusion and gentle shadows
- Fashion editorial composition
- Visible fabric weave and texture details
- Authentic clothing drape and fit
- Magazine quality like Vogue or Harper's Bazaar
- 8K ultra high resolution, crisp details

${noTextRuleSuffix}`;
    } else {
      // SOLUTION: 100% POSITIVE PROMPT ONLY - Never mention what NOT to include
      // The AI adds steam when you mention steam AT ALL (even negatively)
      // Instead: Describe COLD, STILL, ROOM TEMPERATURE food with no movement
      realisticPrompt = `Professional food photography of ${prompt}.

EXACT SCENE: A ${dishName || prompt} photographed at room temperature after cooling completely for 30 minutes. The food is perfectly still and motionless on a clean white ceramic plate. The plate sits on a light oak wooden table near a bright window.

LIGHTING: Soft diffused natural daylight from a large window on the left side. Gentle shadows. No harsh highlights. The light is calm and even.

CAMERA: 35mm lens, f/2.8 aperture, slight bokeh in background. Shot from 45-degree angle above. Sharp focus on the food surface.

FOOD APPEARANCE: 
- Completely still and static, like a painting
- Natural matte textures (not shiny or wet-looking)
- Real crumb structure visible on cake/bread items
- Authentic colors as seen in natural daylight
- Small natural imperfections that make it look homemade
- Dense and solid appearance (nothing floating or moving)

BACKGROUND: Simple, clean, minimal. Maybe a white linen napkin or single fresh herb sprig. Creamy out-of-focus bokeh.

STYLE: Matches professional food blogs like TastyWithTina.com - clean, bright, natural, inviting, editorial cookbook quality.

This is a still life photograph. The food is cold and motionless. Pure clean photography with no effects.`;
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
      articleStyle: passedArticleStyle,
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
    console.log(`📋 Article type from DB: ${articleType}, Niche: ${niche}, Passed style: ${passedArticleStyle}`);
    
    // CRITICAL: Map article type from database to style
    // Database stores: 'classic' → use 'recipe' template, 'listicle' → use 'listicle' template
    let articleStyle = articleType || passedArticleStyle || 'recipe';
    
    // IMPORTANT: 'classic' type in database means recipe-style article!
    if (articleStyle === 'classic') {
      articleStyle = 'recipe';
      console.log(`📝 Mapped 'classic' type to 'recipe' style`);
    }
    console.log(`📝 Final article style: ${articleStyle}`);
    
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

    // Update status to processing with initial progress
    await supabase
      .from(tableName)
      .update({ 
        status: 'processing',
        generation_progress: { step: 'starting', status: 'processing' }
      })
      .eq('id', entityId);

    // Step 1: Generate SEO-optimized title
    console.log('📝 Generating SEO title from focus keyword...');
    await supabase
      .from(tableName)
      .update({ generation_progress: { step: 'generating_title', status: 'processing' } })
      .eq('id', entityId);
    
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
    await supabase
      .from(tableName)
      .update({ generation_progress: { step: 'generating_content', status: 'processing' } })
      .eq('id', entityId);

    let articleSystemPrompt: string;
    let articlePrompt: string;

    if (articleStyle === 'recipe') {
      // Recipe-style article - EXACT TASTYWITHTINA.COM STRUCTURE
      articleSystemPrompt = `SYSTEM ROLE: PROFESSIONAL FOOD & RECIPE BLOG WRITER

You are an elite food blogger with 10+ years experience writing for Bon Appétit, Food52, and Serious Eats. Write bakery-style, professional recipe blog posts that match the exact structure of TastyWithTina.com recipes.

=== ABSOLUTE RULES ===

RULE #1: EXACT STRUCTURE (NO DEVIATIONS)
Follow this EXACT section order with these EXACT section titles. Do not skip, combine, or reorder sections.

RULE #2: TONE & STYLE
- Warm, knowledgeable, like a skilled baker sharing secrets
- Conversational but professional
- Confident and helpful
- NO emoji
- NO slang like "slaps", "vibes", "chef's kiss"
- Write like a real food magazine, not a casual blog
${internalLinksInstruction}

=== MANDATORY STRUCTURE (EXACT LAYOUT) ===

{{IMAGE_1}}

<h1>[RECIPE TITLE – Subtitle]</h1>
Requirements:
- Descriptive, specific, appetizing
- Include key texture/flavor words
- Include a subtitle after a dash or colon
- Example: "Brookie Bars: Chocolate Chip Cookie Meets Fudge Brownie – The Best of Both Worlds"

<p>[OPENING PARAGRAPH 1 - 2-3 sentences]</p>
- Describe what makes this recipe special
- Paint a picture of the perfect bite
- Make reader want to make this NOW

<p>[OPENING PARAGRAPH 2 - 2-3 sentences]</p>
- Explain simplicity (no special equipment needed)
- Promise of the result
- What to expect

<p><a href="#recipe-pdf-download-container">Jump to Recipe Card</a></p>

<h2>What Makes This Special</h2>
{{IMAGE_2}}
- 5-6 SHORT bullet points (use <ul><li>)
- Each bullet is ONE benefit/feature
- Format: <li><strong>Key point:</strong> Brief explanation</li>
- Examples:
  * <li><strong>Two textures in one bite:</strong> Fudgy brownie base and chewy cookie top...</li>
  * <li><strong>Simple ingredients:</strong> Everything is easy to find...</li>

<h2>Ingredients</h2>

<h3>For the [First Component] Layer</h3>
{{IMAGE_3}}
- List each ingredient with bolded quantity
- Format: <strong>quantity unit</strong> ingredient name

<h3>For the [Second Component] Layer</h3>
- Continue ingredients list

{{IMAGE_4}}

<h3>To Finish</h3>
- Final ingredients/toppings

<h2>Step-by-Step Instructions</h2>
- Numbered steps as paragraphs (01, 02, 03, etc.)
- Each step starts with <strong>Step name:</strong>
- Include temperatures, times, visual cues
- 8-12 detailed steps typical
- Format:
  01. <strong>Prep your pan and oven:</strong> Heat the oven to 350°F (175°C)...
  02. <strong>Make the batter:</strong> Melt butter and chocolate together...

<h2>Storage Instructions</h2>
- 3 bullet points with <strong>bold storage type:</strong>
- Format:
  * <li><strong>Room temperature:</strong> Store in airtight container for 3-4 days...</li>
  * <li><strong>Refrigerator:</strong> Keeps well for up to 1 week...</li>
  * <li><strong>Freezer:</strong> Wrap bars individually and freeze up to 2 months...</li>

<h2>Health Benefits</h2>
- 4-5 bullet points (use <ul><li>)
- Honest but positive
- Format: <li><strong>Benefit name:</strong> Brief explanation</li>

<h2>What Not to Do</h2>
- 5-6 bullet points (use <ul><li>)
- Format: <li><strong>Don't [mistake]:</strong> Why it's bad and what to do instead</li>

<h2>Variations You Can Try</h2>
- 6-8 variations (use <ul><li>)
- Format: <li><strong>Variation name:</strong> Brief description with specific amounts</li>
- Include dietary alternatives (gluten-free, nut-free, etc.)

<h2>FAQ</h2>
Use <h3> for EACH question, followed by answer paragraph:

<h3>How do I know when they're done?</h3>
<p>Answer paragraph here with helpful, thorough guidance...</p>

<h3>Can I substitute ingredients?</h3>
<p>Answer paragraph here...</p>

(6-8 questions total, each with <h3> question and <p> answer)

<h2>Wrapping Up</h2>
<p>2-3 sentences only. Summarize the appeal. Encourage reader to try it. End with memorable line like "One pan, two classics, zero regrets."</p>

{{IMAGE_5}}

=== HTML FORMATTING (STRICT) ===
✅ <h1> for recipe title (ONLY ONE)
✅ <h2> for section titles (use EXACT titles above)
✅ <h3> for ingredient sub-groups AND FAQ questions
✅ <p> for paragraphs
✅ <strong> for bold quantities, step names, benefit names
✅ <ul>/<li> for bullet lists
✅ Keep paragraphs 2-4 lines max

❌ NO Markdown (##, **, -, etc.)
❌ NO emoji
❌ NO code fences
❌ NO generic filler phrases

=== IMAGE PLACEMENT (5 IMAGES REQUIRED) ===
- {{IMAGE_1}} = HERO IMAGE at very top before <h1>
- {{IMAGE_2}} = After "What Makes This Special" <h2>, before bullet list
- {{IMAGE_3}} = After first <h3> ingredient sub-group
- {{IMAGE_4}} = After ingredient sub-groups, before "To Finish"
- {{IMAGE_5}} = FINAL IMAGE after "Wrapping Up" (last element in article)`;

      articlePrompt = `RECIPE: "${seoTitle}"
FOCUS KEYWORD: "${focusKeyword}"

Write a professional, bakery-style recipe blog post following the EXACT TastyWithTina.com structure.

=== EXACT SECTION ORDER ===
1. {{IMAGE_1}} (hero at top)
2. <h1> Recipe Title with Subtitle
3. Two opening paragraphs
4. Jump to Recipe Card link
5. <h2>What Makes This Special</h2>
   - {{IMAGE_2}} right after h2
   - 5-6 bullet benefits
6. <h2>Ingredients</h2>
   - <h3>For the X Layer</h3>
   - {{IMAGE_3}} after first h3
   - More ingredients...
   - {{IMAGE_4}} between ingredient groups
   - <h3>To Finish</h3>
7. <h2>Step-by-Step Instructions</h2> - numbered paragraphs with bold names
8. <h2>Storage Instructions</h2> - 3 bullets
9. <h2>Health Benefits</h2> - 4-5 bullets
10. <h2>What Not to Do</h2> - 5-6 bullets
11. <h2>Variations You Can Try</h2> - 6-8 bullets
12. <h2>FAQ</h2> - 6-8 questions using <h3> for each question
13. <h2>Wrapping Up</h2> - 2-3 sentences
14. {{IMAGE_5}} (final image at end)

=== CRITICAL REQUIREMENTS ===
□ Hero image {{IMAGE_1}} MUST be FIRST element
□ FAQ questions use <h3> tags, NOT bold
□ Ingredient sub-groups use <h3> tags
□ Final image {{IMAGE_5}} MUST be LAST element
□ Focus keyword "${focusKeyword}" appears 8-12 times naturally
□ All output is valid HTML (no Markdown)

=== TARGET LENGTH ===
Approximately 2,000-2,500 words

CRITICAL: Pure HTML output only. Professional food magazine tone. Match TastyWithTina.com structure exactly.`;
    } else if (articleStyle === 'listicle') {
      // Generate image placeholder list for prompt
      const imagePlaceholderList = Array.from({ length: imageCount }, (_, i) => `{{IMAGE_${i + 1}}}`).join(', ');
      
      // Check if this is a Home Decor listicle
      if (articleCategory === 'home') {
        // HOME DECOR LISTICLE - Ultra-strict structure for quality
        articleSystemPrompt = `SYSTEM ROLE: HOME DECOR ARTICLE GENERATOR

You are an elite home decor content writer with 15+ years experience writing for Architectural Digest, Elle Decor, and House Beautiful.

=== ABSOLUTE NON-NEGOTIABLE RULES ===

RULE #1: EXACT COUNT = ${imageCount}
- You MUST write EXACTLY ${imageCount} room designs
- You MUST create EXACTLY ${imageCount} <h2> sections
- Count them: 1, 2, 3... up to ${imageCount}
- VERIFY your count before responding

RULE #2: FORBIDDEN SECTIONS (INSTANT FAIL IF INCLUDED)
❌ NO FAQ section
❌ NO conclusion/summary
❌ NO "tips" or "things to consider"
❌ NO bonus ideas
❌ NO comparison sections
❌ NO "how to choose" sections
❌ NO generic advice paragraphs
❌ Article ENDS immediately after design #${imageCount}

RULE #3: EACH DESIGN MUST BE 100% UNIQUE
- Different color palette
- Different furniture style
- Different mood/vibe
- Different target audience
- If 2 designs feel similar = FAIL
${internalLinksInstruction}

=== MANDATORY STRUCTURE ===

<h1>[VIRAL SEO TITLE]</h1>
Requirements:
- Maximum 15 words
- MUST contain the core phrase from: "${focusKeyword}"
- Proper Title Case capitalization
- Make it click-worthy and magazine-worthy
- Example: "8 Pink Bedroom Ideas" → "8 Stunning Pink Bedroom Ideas That Feel Luxe and Dreamy"

<p>[INTRODUCTION - 3-4 sentences ONLY]</p>
- Jump straight into value
- NO generic openers: "In today's world", "Looking to transform", "Are you tired of"
- Address reader directly
- Set clear expectations

THEN EXACTLY ${imageCount} DESIGNS:

<h2>1. [Creative Design Name]</h2>
<h2>2. [Creative Design Name]</h2>
... up to ...
<h2>${imageCount}. [Creative Design Name]</h2>

=== FOR EACH <h2> DESIGN SECTION ===

PARAGRAPH 1 (2-3 sentences): Set the mood
- Describe the overall vibe and feeling
- Who would love this space
- What emotion it evokes

PARAGRAPH 2-3 (detailed description):
- Specific colors with names (e.g., "dusty rose", "sage green", "warm terracotta")
- Specific furniture pieces (e.g., "velvet tufted sofa", "rattan accent chair")
- Textures and materials (e.g., "linen curtains", "marble side table", "jute rug")
- Lighting details (e.g., "brass pendant lights", "floor lamp with linen shade")
- Decor elements (e.g., "oversized abstract art", "ceramic vases", "stack of coffee table books")

OPTIONAL <h3> subsections when helpful:
- Color Palette
- Key Furniture Pieces
- Styling Details
- The Vibe

USE <ul> lists for:
- Specific product/furniture recommendations
- Color combinations
- Must-have elements

END each design with 1 SHORT sentence about who this is perfect for.

THEN: {{IMAGE_X}} placeholder on its own line

=== IMAGE PLACEHOLDERS ===
Place exactly one after each design:
${imagePlaceholderList}

=== WORD COUNTS ===
- Introduction: 50-80 words
- Each design section: 120-180 words
- Total article: approximately 1500 words

=== HTML FORMATTING (STRICT) ===
✅ <h1> for main title (ONLY ONE)
✅ <h2> for numbered designs: "<h2>1. Design Name</h2>"
✅ <h3> for optional subsections within designs
✅ <p> for paragraphs
✅ <strong> for bold key terms (colors, furniture, materials)
✅ <ul>/<li> for lists
✅ Keep paragraphs 2-4 lines max

❌ NO Markdown (##, **, -, etc.)
❌ NO emojis
❌ NO code fences
❌ NO generic filler phrases

=== TONE & STYLE ===
- Conversational but sophisticated
- Like a stylish friend giving home advice
- Occasional light humor (don't overdo it)
- Active voice only
- Specific and descriptive, not vague
- Use: "FYI", "IMO", "trust me", "seriously" (sparingly, 2-3 times max)`;

        articlePrompt = `TASK: Write a home decor listicle article

TITLE/TOPIC: "${seoTitle}"
FOCUS KEYWORD: "${focusKeyword}"
EXACT NUMBER OF DESIGNS REQUIRED: ${imageCount}

=== VERIFICATION CHECKLIST (MUST ALL BE TRUE) ===
□ Article has exactly 1 <h1> tag with viral SEO title
□ Article has EXACTLY ${imageCount} <h2> sections numbered 1-${imageCount}
□ Each <h2> follows format: "<h2>X. Creative Design Name</h2>"
□ Each design has 2-3 paragraphs of detailed description
□ Colors, furniture, textures are SPECIFIC (not generic)
□ Each design is COMPLETELY DIFFERENT from others
□ Focus keyword "${focusKeyword}" appears 8-12 times naturally
□ All ${imageCount} image placeholders used: ${imagePlaceholderList}
□ Each {{IMAGE_X}} appears AFTER its corresponding design
□ NO FAQ section exists
□ NO conclusion section exists
□ Article ENDS after design #${imageCount} and its image
□ All output is valid HTML (no Markdown)

=== STRUCTURE TO GENERATE ===

<h1>[Viral title based on "${seoTitle}"]</h1>

<p>[Introduction - 3-4 sentences, jump straight in]</p>

<h2>1. [Unique Design Name]</h2>
<p>[Mood paragraph]</p>
<p>[Detailed description with specific colors, furniture, textures]</p>
[Optional <h3> subsections if helpful]
<p>[Who this is for - 1 sentence]</p>
{{IMAGE_1}}

<h2>2. [Unique Design Name]</h2>
...content...
{{IMAGE_2}}

[Continue for ALL ${imageCount} designs]

<h2>${imageCount}. [Unique Design Name]</h2>
...content...
{{IMAGE_${imageCount}}}

[ARTICLE ENDS HERE - NO MORE CONTENT]

=== FINAL REMINDER ===
- EXACTLY ${imageCount} designs, no more, no less
- STOP after design #${imageCount}
- Pure HTML output only`;
      } else {
        // GENERAL LISTICLE - Original structure
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

3. THE MAIN LIST (This is the core - ${imageCount} numbered items)
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
${imagePlaceholderList}

Place them on their own lines between items or after key sections. Each list item should have its own image.`;

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
      }
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

    // Step 5: Generate images IN PARALLEL with progress tracking
    console.log(`🖼️ Generating ${imageCount} AI images with ${normalizedImageModel} (${articleCategory} style) - PARALLEL PROCESSING...`);
    
    // Update initial progress
    await supabase
      .from(tableName)
      .update({ 
        generation_progress: { 
          step: 'generating_images', 
          totalImages: imageCount,
          completedImages: 0,
          currentImage: 0,
          status: 'processing'
        } 
      })
      .eq('id', entityId);
    
    // Track completed images
    let completedCount = 0;
    const completedImageIds: number[] = [];
    
    // Create all image generation promises with progress tracking
    const imagePromises = Array.from({ length: imageCount }, async (_, i) => {
      console.log(`🚀 Starting image ${i + 1}/${imageCount} generation...`);
      
      try {
        const result = await generateUniqueImage(
          imagePrompts[i] || `${imageSubject} professional photo ${i + 1}`,
          i + 1,
          REPLICATE_API_KEY,
          supabase,
          aspectRatio,
          imageSubject,
          articleCategory,
          normalizedImageModel
        );
        
        // Update progress after each image completes
        completedCount++;
        completedImageIds.push(i + 1);
        
        await supabase
          .from(tableName)
          .update({ 
            generation_progress: { 
              step: 'generating_images', 
              totalImages: imageCount,
              completedImages: completedCount,
              completedImageIds,
              currentImage: i + 1,
              status: 'processing'
            } 
          })
          .eq('id', entityId);
        
        return result;
      } catch (error: any) {
        console.error(`❌ Image ${i + 1} failed:`, error.message);
        completedCount++;
        return ''; // Return empty string on failure
      }
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

    // Update article/recipe with generated content and clear progress
    const updateData: Record<string, any> = { 
      status: 'completed', 
      error_message: null,
      generation_progress: null  // Clear progress on completion
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
            error_message: error instanceof Error ? error.message : 'Unknown error',
            generation_progress: null  // Clear progress on error
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
