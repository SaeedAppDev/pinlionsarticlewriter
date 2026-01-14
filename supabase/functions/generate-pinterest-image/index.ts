import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function generateWithLovableAI(prompt: string, apiKey: string, aspectRatio: string): Promise<string | null> {
  try {
    // Map aspect ratio to dimensions for the prompt
    const aspectHint = aspectRatio === '9:16' ? 'vertical portrait 9:16' : 
                       aspectRatio === '2:3' ? 'vertical portrait 2:3' :
                       aspectRatio === '1:2' ? 'tall vertical 1:2' : 'vertical';

    // ULTRA-STRICT NO TEXT RULE
    const noTextRulePrefix = "ABSOLUTE RULE: Generate ONLY a photograph with ZERO text. NO words, NO letters, NO numbers, NO titles, NO labels, NO captions, NO watermarks, NO logos, NO typography anywhere in the image.";
    const noTextRuleSuffix = "REMINDER: ABSOLUTELY NO TEXT OR WORDS OF ANY KIND.";
    
    const enhancedPrompt = `${noTextRulePrefix}

Generate: ${prompt}

Style: ${aspectHint} aspect ratio. Professional food photography, REAL photograph, NOT illustration, NOT digital art. Ultra photorealistic, appetizing, magazine-quality, perfect natural lighting. 8K ultra high resolution.

${noTextRuleSuffix}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: enhancedPrompt,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      console.error("Lovable AI error:", response.status);
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (imageUrl && imageUrl.startsWith('data:image')) {
      return imageUrl;
    }
    
    return null;
  } catch (error) {
    console.error("Error with Lovable AI:", error);
    return null;
  }
}

async function generateWithReplicate(prompt: string, apiKey: string, aspectRatio: string): Promise<string | null> {
  try {
    const Replicate = (await import("https://esm.sh/replicate@0.25.2")).default;
    const replicate = new Replicate({ auth: apiKey });

    // ULTRA-STRICT NO TEXT RULE
    const noTextRulePrefix = "ABSOLUTE RULE: Generate ONLY a photograph with ZERO text. NO words, NO letters, NO numbers, NO titles, NO labels, NO captions, NO watermarks, NO logos, NO typography anywhere in the image.";
    const enhancedPrompt = `${noTextRulePrefix}

Generate: Professional Pinterest food photography of ${prompt}

Style: REAL photograph, NOT illustration, NOT digital art. Ultra photorealistic, appetizing, magazine-quality, perfect natural lighting, shallow depth of field. 8K ultra high resolution. ABSOLUTELY NO TEXT OR WORDS.`;

    const output = await replicate.run("black-forest-labs/flux-schnell", {
      input: {
        prompt: enhancedPrompt,
        go_fast: true,
        megapixels: "1",
        num_outputs: 1,
        aspect_ratio: aspectRatio,
        output_format: "webp",
        output_quality: 90,
        num_inference_steps: 4,
      },
    });

    if (Array.isArray(output) && output.length > 0) {
      return output[0];
    }
    
    return null;
  } catch (error) {
    console.error("Error with Replicate:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, aspectRatio = "9:16", imageModel = "lovable" } = await req.json();
    
    if (!prompt) {
      throw new Error("Prompt is required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    let imageUrl: string | null = null;
    let usedModel = imageModel;

    // Try the requested model first
    if (imageModel === "replicate" && REPLICATE_API_KEY) {
      imageUrl = await generateWithReplicate(prompt, REPLICATE_API_KEY, aspectRatio);
      usedModel = "replicate";
    } else if (LOVABLE_API_KEY) {
      imageUrl = await generateWithLovableAI(prompt, LOVABLE_API_KEY, aspectRatio);
      usedModel = "lovable";
    }

    // Fallback to other model if first fails
    if (!imageUrl) {
      if (usedModel === "lovable" && REPLICATE_API_KEY) {
        imageUrl = await generateWithReplicate(prompt, REPLICATE_API_KEY, aspectRatio);
        usedModel = "replicate";
      } else if (usedModel === "replicate" && LOVABLE_API_KEY) {
        imageUrl = await generateWithLovableAI(prompt, LOVABLE_API_KEY, aspectRatio);
        usedModel = "lovable";
      }
    }

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "Failed to generate image with any available model" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If it's a base64 image, upload to Supabase Storage
    let finalUrl = imageUrl;
    if (imageUrl.startsWith('data:image') && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        const base64Data = imageUrl.split(',')[1];
        const imageBytes = base64ToUint8Array(base64Data);
        
        const fileName = `pinterest-pins/${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;
        
        const { error: uploadError } = await supabase.storage
          .from('generated-images')
          .upload(fileName, imageBytes, {
            contentType: 'image/webp',
            upsert: false,
          });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('generated-images')
            .getPublicUrl(fileName);
          finalUrl = publicUrl;
        }
      } catch (uploadError) {
        console.error("Error uploading to storage:", uploadError);
        // Keep the base64 URL if upload fails
      }
    }

    return new Response(
      JSON.stringify({ success: true, imageUrl: finalUrl, model: usedModel }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in generate-pinterest-image:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
