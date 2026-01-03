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

    // Enhanced HYPER-REALISTIC prompt
    const enhancedPrompt = `HYPER-REALISTIC professional food photography of ${dishName}. ${prompt}. 
Shot on Canon 5D Mark IV with 85mm f/1.4 lens, natural window light with soft shadows, NOT AI generated.
Real photograph with authentic imperfections: slight asymmetry, natural color variations, visible food texture.
Weathered wooden surface with genuine patina, vintage ceramic plate with minor wear.
Fresh herbs with some wilted edges, slight sauce drips on plate rim, breadcrumbs scattered naturally.
Shallow depth of field, warm but slightly desaturated colors like editorial food magazine.
Pinterest-worthy vertical composition 1000x1500, lifestyle food photography, authentic home cooking aesthetic.
Film grain texture, captured moment, human presence implied, NOT computer generated.`;

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
            content: enhancedPrompt,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("Image generation error:", response.status, errorText);
      throw new Error(`Image generation failed: ${response.status}`);
    }

    const data = await response.json();
    const base64Url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!base64Url) {
      throw new Error("No image in response");
    }

    // Upload to Supabase Storage as WebP
    const imageBytes = base64ToUint8Array(base64Url);
    const fileName = `pins/pin-${Date.now()}.webp`;
    
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
