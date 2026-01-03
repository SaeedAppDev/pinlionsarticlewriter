import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Convert base64 to Uint8Array for upload
function base64ToUint8Array(base64: string): Uint8Array {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Generate image using Lovable AI Gateway
async function generateImage(prompt: string, LOVABLE_API_KEY: string): Promise<string | null> {
  try {
    console.log('Calling Lovable AI for image generation...');
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        modalities: ["image", "text"]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    console.log('Lovable AI response received');
    
    // Extract image from response
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (imageUrl) {
      return imageUrl;
    }
    
    console.error("No image in Lovable AI response");
    return null;
  } catch (error) {
    console.error("Image generation error:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, dishName } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client for storage
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Ultra-realistic food photography prompt - focused on REAL photo aesthetics
    const enhancedPrompt = `Create a REAL photograph of ${dishName}. ${prompt}.

CRITICAL REQUIREMENTS FOR REALISM:
- This must look like an actual photograph taken by a professional food photographer
- Shot on Canon EOS R5 with 100mm macro lens, f/2.8 aperture
- Natural daylight from a large window, soft diffused lighting
- Rustic wooden table or marble countertop background
- Beautiful ceramic plate or bowl with the dish
- Fresh garnishes: herbs, lemon wedges, or sauce drizzles
- Shallow depth of field with soft bokeh background
- Warm, appetizing color temperature
- Steam rising from hot dishes
- Real food textures: crispy edges, glossy sauce, visible seasoning
- Overhead or 45-degree angle shot
- Pinterest-worthy composition, portrait orientation 1000x1500
- Magazine quality food styling
- NO text, NO watermarks, NO logos
- Must look 100% like a real photograph, NOT AI generated`;

    console.log('Generating realistic food image for:', dishName);
    const base64Url = await generateImage(enhancedPrompt, LOVABLE_API_KEY);

    if (!base64Url) {
      throw new Error("No image generated from Lovable AI");
    }

    // Upload to Supabase Storage as WebP with compression
    const imageBytes = base64ToUint8Array(base64Url);
    const fileName = `pins/pin-${Date.now()}.webp`;
    
    console.log(`Image size: ${Math.round(imageBytes.length / 1024)} KB`);

    const { error: uploadError } = await supabase.storage
      .from('article-images')
      .upload(fileName, imageBytes, {
        contentType: 'image/webp',
        upsert: true
      });
    
    if (uploadError) {
      console.error('Upload error:', uploadError);
      // Return base64 as fallback
      return new Response(JSON.stringify({ imageUrl: base64Url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('article-images')
      .getPublicUrl(fileName);
    
    const imageUrl = urlData?.publicUrl || base64Url;
    console.log('Pin image generated and uploaded successfully:', imageUrl);

    return new Response(JSON.stringify({ imageUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-pin-image:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to generate image" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
