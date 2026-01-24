import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate image using Replicate or other models
async function generateImage(
  prompt: string,
  imageNumber: number,
  REPLICATE_API_KEY: string,
  supabase: any,
  aspectRatio: string = "4:3",
  imageModel: string = "zimage",
  articleCategory: string = "food"
): Promise<string> {
  try {
    console.log(`🖼️ Regenerating image ${imageNumber} with model: ${imageModel}`);
    
    // ULTRA-STRICT NO TEXT RULE - This must be at the START of prompt for maximum effect
    const noTextRulePrefix = "ABSOLUTE RULE: Generate ONLY a photograph with ZERO text. NO words, NO letters, NO numbers, NO titles, NO labels, NO captions, NO watermarks, NO logos, NO typography, NO overlays, NO writing of ANY kind anywhere in the image.";
    const noTextRuleSuffix = "REMINDER: This image must contain ABSOLUTELY NO TEXT OR WORDS OF ANY KIND. Pure photography only.";
    
    let realisticPrompt: string;
    if (articleCategory === 'home') {
      realisticPrompt = `${noTextRulePrefix}

Generate: ${prompt}

Style: Professional interior design photograph, REAL photography, NOT illustration, NOT digital art, NOT 3D render, NOT cartoon.
Ultra photorealistic with natural imperfections. Natural daylight. Rich visible textures. Magazine editorial quality. 8K ultra high resolution.

${noTextRuleSuffix}`;
    } else if (articleCategory === 'fashion') {
      realisticPrompt = `${noTextRulePrefix}

Generate: ${prompt}

Style: Professional fashion editorial photograph matching OutfitsTrendz.com quality. REAL photography showing full outfit on model, NOT illustration, NOT flat lay, NOT mannequin.

CRITICAL REQUIREMENTS:
- FACE MUST BE CLEARLY VISIBLE - show the model's full face with natural expression, do NOT crop or hide the face
- Full body shot of model wearing the complete outfit from head to toe
- Natural urban or lifestyle background with soft bokeh
- Natural daylight or golden hour lighting with soft shadows
- Model in confident, relaxed pose showing clothing naturally
- Visible fabric textures, stitching details, and material quality
- Natural skin with subtle makeup, beautiful facial features visible
- All accessories and shoes visible in frame
- Sharp focus on both face and clothing
- Editorial street style photography quality
- 8K ultra high resolution

${noTextRuleSuffix}`;
    } else {
      // SOLUTION: 100% POSITIVE PROMPT ONLY - Never mention what NOT to include
      // Describe COLD, STILL, ROOM TEMPERATURE food with no movement
      realisticPrompt = `Professional food photography of ${prompt}.

EXACT SCENE: Food photographed at room temperature after cooling completely for 30 minutes. The food is perfectly still and motionless on a clean white ceramic plate. The plate sits on a light oak wooden table near a bright window.

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

    // Get dimensions
    const getImageDimensions = (ar: string): { width: number; height: number } => {
      const ratioMap: { [key: string]: { width: number; height: number } } = {
        '1:1': { width: 1024, height: 1024 },
        '4:3': { width: 1024, height: 768 },
        '3:4': { width: 768, height: 1024 },
        '16:9': { width: 1280, height: 720 },
        '9:16': { width: 720, height: 1280 },
      };
      return ratioMap[ar] || { width: 1024, height: 768 };
    };

    const dimensions = getImageDimensions(aspectRatio);
    let imageUrl: string | null = null;

    // Handle nano-banana model (Lovable AI Gateway)
    if (imageModel === 'nano-banana') {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (LOVABLE_API_KEY) {
        try {
          const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash-image-preview',
              messages: [{ role: 'user', content: `Generate a professional photograph: ${realisticPrompt}` }],
              modalities: ['image', 'text']
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const b64Image = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
            if (b64Image && b64Image.startsWith('data:image')) {
              const base64Data = b64Image.split(',')[1];
              const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
              const fileName = `articles/regen-${Date.now()}-${imageNumber}.webp`;
              
              const { error: uploadError } = await supabase.storage
                .from('article-images')
                .upload(fileName, bytes, { contentType: 'image/webp', upsert: true });

              if (!uploadError) {
                const { data: urlData } = supabase.storage.from('article-images').getPublicUrl(fileName);
                imageUrl = urlData?.publicUrl;
                console.log(`✅ Nano Banana regenerated image ${imageNumber}`);
              }
            }
          }
        } catch (e) {
          console.error('Nano Banana error:', e);
        }
      }
    }

    // Replicate models (zimage, flux-schnell, seedream)
    if (!imageUrl && REPLICATE_API_KEY) {
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

      const modelConfig = modelVersions[imageModel] || modelVersions['zimage'];

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
        let prediction = await response.json();
        let attempts = 0;
        const maxAttempts = 60;

        while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
            headers: { 'Authorization': `Bearer ${REPLICATE_API_KEY}` },
          });
          if (statusResponse.ok) {
            prediction = await statusResponse.json();
          }
          attempts++;
        }

        if (prediction.status === 'succeeded' && prediction.output) {
          const rawUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
          
          // Download and upload to Supabase
          const imgResp = await fetch(rawUrl);
          if (imgResp.ok) {
            const bytes = new Uint8Array(await imgResp.arrayBuffer());
            const fileName = `articles/regen-${Date.now()}-${imageNumber}.webp`;
            
            const { error: uploadError } = await supabase.storage
              .from('article-images')
              .upload(fileName, bytes, { contentType: 'image/webp', upsert: true });

            if (!uploadError) {
              const { data: urlData } = supabase.storage.from('article-images').getPublicUrl(fileName);
              imageUrl = urlData?.publicUrl || rawUrl;
            } else {
              imageUrl = rawUrl;
            }
          }
          console.log(`✅ Replicate regenerated image ${imageNumber}`);
        }
      }
    }

    return imageUrl || '';
  } catch (error) {
    console.error(`Error regenerating image ${imageNumber}:`, error);
    return '';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { articleId, aspectRatio = '4:3', imageModel = 'zimage', customReplicateKey } = await req.json();
    
    if (!articleId) {
      throw new Error('articleId is required');
    }

    console.log(`🔄 Starting image regeneration for article: ${articleId}`);

    // Normalize image model
    let normalizedModel = imageModel;
    if (imageModel === 'z-image-turbo') normalizedModel = 'zimage';
    else if (imageModel === 'seedream-4.5') normalizedModel = 'seedream';
    else if (imageModel === 'google-nano-banana-pro') normalizedModel = 'nano-banana';

    const REPLICATE_API_KEY = customReplicateKey || Deno.env.get('REPLICATE_API_KEY');
    if (!REPLICATE_API_KEY && normalizedModel !== 'nano-banana') {
      throw new Error('REPLICATE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch article
    const { data: article, error: fetchError } = await supabase
      .from('articles')
      .select('title, content_html, niche')
      .eq('id', articleId)
      .single();

    if (fetchError || !article) {
      throw new Error('Article not found');
    }

    const content = article.content_html || '';
    const title = article.title || '';
    
    // Detect category
    let articleCategory = 'food';
    const titleLower = title.toLowerCase();
    if (titleLower.match(/kitchen|bedroom|living|bathroom|decor|interior|room|home|furniture/)) {
      articleCategory = 'home';
    } else if (titleLower.match(/outfit|fashion|style|wear|dress|clothing/)) {
      articleCategory = 'fashion';
    }
    if (article.niche === 'decor') articleCategory = 'home';
    else if (article.niche === 'fashion') articleCategory = 'fashion';

    // Find image placeholders or missing images
    const placeholderMatches = content.match(/\{\{IMAGE_(\d+)\}\}/g) || [];
    const missingImageNumbers: number[] = placeholderMatches.map((p: string) => {
      const match = p.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    }).filter((n: number) => n > 0);

    if (missingImageNumbers.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No missing images found',
        regeneratedCount: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📷 Found ${missingImageNumbers.length} missing images: ${missingImageNumbers.join(', ')}`);

    // Update progress
    await supabase
      .from('articles')
      .update({ 
        generation_progress: { 
          step: 'regenerating_images', 
          totalImages: missingImageNumbers.length,
          completedImages: 0,
          currentImage: 0
        } 
      })
      .eq('id', articleId);

    // Generate images for missing placeholders
    const getImageDimensions = (ar: string): { width: number; height: number } => {
      const dimensions: Record<string, { width: number; height: number }> = {
        '1:1': { width: 1024, height: 1024 },
        '16:9': { width: 1920, height: 1080 },
        '4:3': { width: 1024, height: 768 },
        '9:16': { width: 1080, height: 1920 },
      };
      return dimensions[ar] || { width: 1024, height: 768 };
    };
    
    const imgDimensions = getImageDimensions(aspectRatio);
    let updatedContent = content;
    let regeneratedCount = 0;

    for (let i = 0; i < missingImageNumbers.length; i++) {
      const imgNum = missingImageNumbers[i];
      
      // Update progress
      await supabase
        .from('articles')
        .update({ 
          generation_progress: { 
            step: 'regenerating_images', 
            totalImages: missingImageNumbers.length,
            completedImages: i,
            currentImage: imgNum
          } 
        })
        .eq('id', articleId);

      const prompt = `${title} professional photo ${imgNum}`;
      const imageUrl = await generateImage(
        prompt,
        imgNum,
        REPLICATE_API_KEY,
        supabase,
        aspectRatio,
        normalizedModel,
        articleCategory
      );

      if (imageUrl) {
        const placeholder = `{{IMAGE_${imgNum}}}`;
        updatedContent = updatedContent.replace(
          placeholder,
          `<figure class="article-image"><img src="${imageUrl}" alt="${title} - Image ${imgNum}" loading="lazy" width="${imgDimensions.width}" height="${imgDimensions.height}" style="width: 100%; height: auto; aspect-ratio: ${aspectRatio.replace(':', '/')};" /></figure>`
        );
        regeneratedCount++;
        console.log(`✅ Regenerated image ${imgNum}`);
      }
    }

    // Update article content
    await supabase
      .from('articles')
      .update({ 
        content_html: updatedContent,
        generation_progress: null 
      })
      .eq('id', articleId);

    console.log(`🎉 Regenerated ${regeneratedCount}/${missingImageNumbers.length} images`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Regenerated ${regeneratedCount} images`,
      regeneratedCount,
      totalMissing: missingImageNumbers.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in regenerate-images:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
