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
    
    // Category-specific prompts
    // CRITICAL: Explicitly tell AI to NOT add any text, watermarks, or overlays!
    const noTextRule = "CRITICAL: DO NOT add ANY text, words, letters, numbers, watermarks, logos, labels, captions, or typography on the image. Pure photography only, absolutely no text overlay.";
    
    let realisticPrompt: string;
    if (articleCategory === 'home') {
      realisticPrompt = `${prompt}. ${noTextRule} Professional interior design photograph, ultra-realistic, photorealistic, NOT illustration, NOT digital art, NOT 3D render, NOT AI-generated look. Natural daylight, ultra high resolution, premium quality, magazine-quality.`;
    } else if (articleCategory === 'fashion') {
      realisticPrompt = `${prompt}. ${noTextRule} Professional fashion photograph, ultra-realistic, photorealistic, studio lighting, ultra high resolution, premium quality, Vogue style.`;
    } else {
      realisticPrompt = `${prompt}. ${noTextRule} Professional food photograph, ultra-realistic, photorealistic, natural lighting, ultra high resolution, premium quality, Bon Appetit style.`;
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
