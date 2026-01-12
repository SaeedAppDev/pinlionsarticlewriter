import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls, pinStyle, customStyleGuidelines, titleDescriptionPrompt, articleContent } = await req.json();
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      throw new Error("URLs array is required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const results = [];

    for (const url of urls) {
      try {
        // Check if this is an article reference (starts with article://)
        const isArticle = url.startsWith('article://');
        let topic = '';
        
        if (isArticle) {
          // Extract title from article reference
          topic = url.replace('article://', '');
        } else {
          // Extract topic from URL
          const urlParts = url.split('/').filter(Boolean);
          const slug = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || 'recipe';
          topic = slug.replace(/-/g, ' ').replace(/\//g, '');
        }
        
        // If we have article content, use AI to generate a better prompt
        let stylePrompt = '';
        if (articleContent && isArticle) {
          // Extract key details from article content for better image generation
          const textContent = articleContent.replace(/<[^>]*>/g, ' ').substring(0, 2000);
          
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content: "You generate Pinterest image prompts. Create a detailed, professional food photography prompt based on the article content. Include: lighting, composition, styling, colors, and atmosphere. Make it viral-worthy. Max 100 words. Just return the prompt, nothing else."
                },
                {
                  role: "user",
                  content: `Article title: ${topic}\n\nArticle excerpt:\n${textContent}`
                }
              ],
            }),
          });

          const aiData = await aiResponse.json();
          stylePrompt = aiData.choices?.[0]?.message?.content?.trim() || '';
        }
        
        // Fallback to template if AI prompt failed or no article content
        if (!stylePrompt) {

          const styleTemplates: Record<string, string> = {
            'basic-top': `Professional food photography of ${topic}. Bright, natural lighting with clean composition. Text overlay area at the TOP of the image. Rustic wooden table or marble surface. Shallow depth of field.`,
            'basic-middle': `Appetizing overhead shot of ${topic}. Vibrant colors with perfect styling. Semi-transparent text overlay area in the MIDDLE. Fresh ingredients visible. Magazine-quality presentation.`,
            'basic-bottom': `Stunning close-up of ${topic}. Steam rising, fresh herbs as garnish. Text overlay area at the BOTTOM. Warm, inviting atmosphere. High-end restaurant presentation.`,
            'collage': `Collage style Pinterest pin showing ${topic} from multiple angles. Two images - one at top showing the final dish, one at bottom showing a detail or ingredient. Modern food photography style.`,
          };
          stylePrompt = styleTemplates[pinStyle] || styleTemplates['basic-bottom'];
        }

        // Generate overlay text
        const overlayResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: "You generate SHORT, punchy Pinterest overlay text. Max 4-5 words. Use ALL CAPS. Be catchy and clickable. Just return the text, nothing else."
              },
              {
                role: "user",
                content: `Generate Pinterest overlay text for: ${topic}`
              }
            ],
          }),
        });

        const overlayData = await overlayResponse.json();
        const overlayText = overlayData.choices?.[0]?.message?.content?.trim()?.toUpperCase() || topic.toUpperCase();

        results.push({
          url,
          topic,
          imagePrompt: stylePrompt,
          overlayText: overlayText.substring(0, 40), // Limit length
        });
      } catch (error: unknown) {
        console.error(`Error processing URL ${url}:`, error);
        results.push({
          url,
          topic: url.split('/').pop() || 'unknown',
          imagePrompt: `Professional food photography, appetizing presentation, rustic setting`,
          overlayText: 'DELICIOUS RECIPE',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return new Response(JSON.stringify({ success: true, prompts: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in generate-pinterest-prompts:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
