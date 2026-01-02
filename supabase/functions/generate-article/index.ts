import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipeId, title } = await req.json();
    console.log(`Generating article for: ${title} (ID: ${recipeId})`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update status to processing
    await supabase
      .from('recipes')
      .update({ status: 'processing' })
      .eq('id', recipeId);

    // Step 1: Generate image prompts for the article
    console.log('Generating image prompts...');
    const imagePromptsResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You generate image prompts for food blog articles. Return exactly 4 image prompts as a JSON array.
Each prompt should be detailed, photographic style, food photography focused.
Return ONLY valid JSON array, no other text.`
          },
          {
            role: "user",
            content: `Generate 4 food photography image prompts for an article about: "${title}"

The images should be:
1. Hero image - beautiful overhead or 45-degree shot of the finished dish
2. Ingredient/prep shot - closeup of key ingredients or preparation step
3. Cooking process - action shot showing technique
4. Final presentation - styled plate with garnish

Return as JSON array like: ["prompt1", "prompt2", "prompt3", "prompt4"]`
          }
        ],
      }),
    });

    let imagePrompts = [
      `Professional food photography of ${title}, overhead shot, natural lighting, rustic wooden table, fresh ingredients visible, ultra high resolution`,
      `Closeup of ingredients for ${title}, kitchen prep scene, soft lighting, shallow depth of field`,
      `Cooking process shot for ${title}, steam rising, action shot, warm kitchen lighting`,
      `Beautifully plated ${title}, restaurant style presentation, garnished, food magazine quality`
    ];

    if (imagePromptsResponse.ok) {
      try {
        const promptsData = await imagePromptsResponse.json();
        const promptsText = promptsData.choices?.[0]?.message?.content || '';
        const jsonMatch = promptsText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          imagePrompts = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.log('Using default image prompts');
      }
    }

    console.log('Image prompts ready:', imagePrompts.length);

    // Step 2: Generate images using Nano banana model
    console.log('Generating images...');
    const generatedImages: string[] = [];
    
    for (let i = 0; i < Math.min(imagePrompts.length, 4); i++) {
      try {
        const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                content: imagePrompts[i] + ". Professional food photography, 16:9 aspect ratio, ultra high resolution."
              }
            ],
            modalities: ["image", "text"]
          }),
        });

        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          const imageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          if (imageUrl) {
            generatedImages.push(imageUrl);
            console.log(`Image ${i + 1} generated successfully`);
          }
        }
      } catch (imgError) {
        console.error(`Error generating image ${i + 1}:`, imgError);
      }
      
      // Small delay between image generations
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Generated ${generatedImages.length} images`);

    // Step 3: Generate article content with proper HTML formatting
    console.log('Generating article content...');
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are an expert recipe writer and food blogger. Write detailed, engaging recipe articles in HTML format.

IMPORTANT: Write in a warm, conversational, slightly witty tone. Use short paragraphs. Be engaging and fun to read.

Your article MUST follow this exact structure with HTML tags:

1. Start with an engaging introduction (2-3 short paragraphs) - no heading needed
2. Multiple sections with <h2> headings, each followed by relevant content
3. Use <h3> for subsections within h2 sections
4. Use <ul> with <li> for lists (tips, ingredients, etc.)
5. Use <ol> with <li> for numbered steps
6. Use <strong> for emphasis on key points
7. Include an FAQ section with <h3> for each question
8. End with a brief conclusion

IMAGE PLACEHOLDERS: Include exactly 4 image placeholders in your article using this format:
{{IMAGE_1}} - Place after introduction
{{IMAGE_2}} - Place after second h2 section
{{IMAGE_3}} - Place in middle of article
{{IMAGE_4}} - Place near the end before FAQ

Each image placeholder should have a caption below it like:
{{IMAGE_1}}
<p class="caption"><em>Description of what the image shows</em></p>

Target 1500-2000 words. Make it SEO-friendly with natural keyword usage.`
          },
          {
            role: "user",
            content: `Write a complete recipe article for: "${title}"

Remember to:
- Be conversational and engaging
- Include practical tips
- Add personality and occasional humor
- Use proper HTML structure
- Include all 4 image placeholders: {{IMAGE_1}}, {{IMAGE_2}}, {{IMAGE_3}}, {{IMAGE_4}}`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        await supabase
          .from('recipes')
          .update({ status: 'error', error_message: 'Rate limit exceeded. Please try again later.' })
          .eq('id', recipeId);
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        await supabase
          .from('recipes')
          .update({ status: 'error', error_message: 'Payment required. Please add credits.' })
          .eq('id', recipeId);
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    let articleContent = data.choices?.[0]?.message?.content;

    if (!articleContent) {
      throw new Error("No content generated");
    }

    // Step 4: Replace image placeholders with actual images
    for (let i = 0; i < 4; i++) {
      const placeholder = `{{IMAGE_${i + 1}}}`;
      if (generatedImages[i]) {
        articleContent = articleContent.replace(
          placeholder,
          `<figure class="article-image"><img src="${generatedImages[i]}" alt="${title} - Image ${i + 1}" loading="lazy" /></figure>`
        );
      } else {
        // Remove placeholder if no image was generated
        articleContent = articleContent.replace(placeholder, '');
      }
    }

    console.log(`Article generated successfully for: ${title}`);

    // Update recipe with generated content
    const { error: updateError } = await supabase
      .from('recipes')
      .update({ 
        status: 'completed', 
        article_content: articleContent,
        error_message: null 
      })
      .eq('id', recipeId);

    if (updateError) {
      console.error("Update error:", updateError);
      throw updateError;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      recipeId,
      contentLength: articleContent.length,
      imagesGenerated: generatedImages.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-article function:', error);
    
    // Try to update status to error
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { recipeId } = await req.clone().json().catch(() => ({}));
      if (recipeId) {
        await supabase
          .from('recipes')
          .update({ status: 'error', error_message: error instanceof Error ? error.message : 'Unknown error' })
          .eq('id', recipeId);
      }
    } catch (e) {
      console.error('Could not update error status:', e);
    }
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
