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

// Call Gemini API for image generation
async function callGeminiImage(prompt: string, GEMINI_API_KEY: string): Promise<string | null> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: prompt }] }
        ],
        generationConfig: {
          responseModalities: ["image", "text"],
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini Image API error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    
    for (const part of parts) {
      if (part.inlineData?.data) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Gemini Image generation error:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, dishName } = await req.json();
    
    // Use direct Gemini API key instead of Lovable AI
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
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

    console.log('Generating pin image with Gemini API...');
    const base64Url = await callGeminiImage(enhancedPrompt, GEMINI_API_KEY);

    if (!base64Url) {
      throw new Error("No image generated from Gemini API");
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
    console.log('Pin image generated and uploaded successfully');

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
