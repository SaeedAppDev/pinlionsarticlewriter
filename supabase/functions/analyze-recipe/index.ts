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
    const { recipeText, recipeUrl, focusAngle } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a Pinterest marketing expert and recipe analyzer. Your job is to analyze recipes and generate Pinterest-optimized content.

When given a recipe (either as text or a description from a URL), you must:
1. Extract key recipe information
2. Generate 5 compelling Pinterest headlines using different angles
3. Create Pinterest SEO copy (title, description, hashtags)
4. Score the viral potential

Focus angle preference: ${focusAngle || 'balanced'}

ALWAYS respond with valid JSON in this exact format:
{
  "dishName": "string",
  "ingredients": ["array of main ingredients"],
  "cookingTime": "string (e.g., '30 minutes')",
  "tags": ["healthy", "quick", "vegan", etc.],
  "headlines": [
    {
      "text": "headline text",
      "angle": "quick|healthy|family|budget|viral"
    }
  ],
  "seo": {
    "title": "Pinterest pin title (60 chars max)",
    "description": "Pinterest description (150-200 chars)",
    "hashtags": ["array", "of", "hashtags"]
  },
  "viralityScore": {
    "overall": 0-100,
    "breakdown": {
      "visualClarity": 0-100,
      "textOverlayStrength": 0-100,
      "keywordRelevance": 0-100,
      "scrollStopPotential": 0-100
    }
  },
  "imagePrompts": [
    {
      "prompt": "detailed image generation prompt for food photography",
      "angle": "quick|healthy|family|budget|viral",
      "overlayText": "text to overlay on the image"
    }
  ]
}

Generate 5 unique headlines and 5 image prompts covering different angles (quick, healthy, family, budget, viral curiosity).`;

    const userContent = recipeUrl 
      ? `Analyze this recipe URL and create Pinterest content: ${recipeUrl}\n\nNote: I cannot fetch URLs directly, so please infer what you can from the URL structure and create compelling Pinterest content based on typical recipes from this source. If you need the actual recipe content, here it is:\n\n${recipeText || 'No additional text provided'}`
      : `Analyze this recipe and create Pinterest content:\n\n${recipeText}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
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
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse JSON from AI response");
    }

    const analysisResult = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(analysisResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in analyze-recipe:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to analyze recipe" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
