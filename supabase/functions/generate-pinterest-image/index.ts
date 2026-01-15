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

// Generate a Pinterest pin WITH text overlay directly baked into the image
async function generatePinWithTextOverlay(
  foodDescription: string, 
  overlayText: string, 
  apiKey: string, 
  aspectRatio: string
): Promise<string | null> {
  try {
    const aspectHint = aspectRatio === '9:16' ? 'vertical 9:16 Pinterest pin format' : 
                       aspectRatio === '2:3' ? 'vertical 2:3 Pinterest format' :
                       aspectRatio === '1:2' ? 'tall vertical 1:2 format' : 'vertical Pinterest format';

    // Create a prompt that generates a Pinterest-style pin WITH text overlay at the TOP
    const pinPrompt = `Create a professional Pinterest food pin image:

LAYOUT (VERY IMPORTANT):
- The image must have TEXT AT THE TOP portion (upper 25-30% of image)
- The food photo fills the BOTTOM 70-75% of the image
- This is a ${aspectHint}

TEXT OVERLAY (AT THE TOP OF IMAGE):
- Place this exact text at the TOP of the image: "${overlayText}"
- Text should be LARGE, BOLD, and highly readable
- Use a clean sans-serif or modern font style
- Text color: WHITE or cream colored
- Add a subtle dark gradient or semi-transparent dark overlay behind the text for readability
- The text area should be at the TOP, above the main food image

FOOD PHOTO (BELOW THE TEXT):
- Professional food photography of: ${foodDescription}
- Appetizing, well-lit, magazine-quality food photo
- The food should be clearly visible and look delicious
- Natural lighting, shallow depth of field
- Clean, appealing food styling

OVERALL STYLE:
- Professional Pinterest pin design
- Clean, modern, eye-catching
- The text must be clearly readable
- High quality, 8K resolution
- Like a professional food blogger's Pinterest pin`;

    console.log("Generating Pinterest pin with text overlay:", overlayText);

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
            content: pinPrompt,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      console.error("Lovable AI error:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (imageUrl && imageUrl.startsWith('data:image')) {
      console.log("Successfully generated pin with text overlay");
      return imageUrl;
    }
    
    console.error("No image in response");
    return null;
  } catch (error) {
    console.error("Error generating pin with text overlay:", error);
    return null;
  }
}

// Fallback: Generate plain food image (without text) using Replicate
async function generateWithReplicate(prompt: string, apiKey: string, aspectRatio: string): Promise<string | null> {
  try {
    const Replicate = (await import("https://esm.sh/replicate@0.25.2")).default;
    const replicate = new Replicate({ auth: apiKey });

    const enhancedPrompt = `Professional Pinterest food photography of ${prompt}. REAL photograph, NOT illustration. Ultra photorealistic, appetizing, magazine-quality, perfect natural lighting, shallow depth of field. 8K ultra high resolution. NO TEXT OR WORDS IN THE IMAGE.`;

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
    const { prompt, aspectRatio = "9:16", imageModel = "lovable", overlayText = "" } = await req.json();
    
    if (!prompt) {
      throw new Error("Prompt is required");
    }

    console.log("=== Generate Pinterest Image ===");
    console.log("Prompt:", prompt);
    console.log("Overlay Text:", overlayText);
    console.log("Aspect Ratio:", aspectRatio);
    console.log("Image Model:", imageModel);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    let imageUrl: string | null = null;
    let usedModel = imageModel;

    // If overlay text is provided, generate a pin WITH text overlay using Lovable AI
    if (overlayText && overlayText.trim() && LOVABLE_API_KEY) {
      console.log("Generating pin WITH text overlay at the top...");
      imageUrl = await generatePinWithTextOverlay(prompt, overlayText.trim(), LOVABLE_API_KEY, aspectRatio);
      usedModel = "lovable";
    }

    // If no overlay text or generation failed, try regular image generation
    if (!imageUrl) {
      if (imageModel === "replicate" && REPLICATE_API_KEY) {
        imageUrl = await generateWithReplicate(prompt, REPLICATE_API_KEY, aspectRatio);
        usedModel = "replicate";
      } else if (LOVABLE_API_KEY) {
        // Generate plain food image without text
        imageUrl = await generatePinWithTextOverlay(prompt, overlayText || prompt, LOVABLE_API_KEY, aspectRatio);
        usedModel = "lovable";
      }
    }

    // Fallback to other model if first fails
    if (!imageUrl) {
      if (usedModel === "lovable" && REPLICATE_API_KEY) {
        imageUrl = await generateWithReplicate(prompt, REPLICATE_API_KEY, aspectRatio);
        usedModel = "replicate";
      } else if (usedModel === "replicate" && LOVABLE_API_KEY) {
        imageUrl = await generatePinWithTextOverlay(prompt, overlayText || prompt, LOVABLE_API_KEY, aspectRatio);
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
          .from('article-images')
          .upload(fileName, imageBytes, {
            contentType: 'image/webp',
            upsert: false,
          });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('article-images')
            .getPublicUrl(fileName);
          finalUrl = publicUrl;
          console.log("Uploaded to storage:", publicUrl);
        } else {
          console.error("Upload error:", uploadError);
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
