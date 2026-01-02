import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Convert base64 to Uint8Array for upload
function base64ToUint8Array(base64: string): Uint8Array {
  // Remove data URL prefix if present
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

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

    // Step 2: Generate images and upload to storage
    console.log('Generating images...');
    const imageUrls: string[] = [];
    
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
          const base64Url = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          
          if (base64Url && base64Url.startsWith('data:image')) {
            // Upload to Supabase Storage instead of using base64
            const imageBytes = base64ToUint8Array(base64Url);
            const fileName = `${recipeId}/image-${i + 1}-${Date.now()}.jpg`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('article-images')
              .upload(fileName, imageBytes, {
                contentType: 'image/jpeg',
                upsert: true
              });
            
            if (uploadError) {
              console.error(`Upload error for image ${i + 1}:`, uploadError);
            } else {
              // Get public URL
              const { data: urlData } = supabase.storage
                .from('article-images')
                .getPublicUrl(fileName);
              
              if (urlData?.publicUrl) {
                imageUrls.push(urlData.publicUrl);
                console.log(`Image ${i + 1} uploaded successfully`);
              }
            }
          }
        }
      } catch (imgError) {
        console.error(`Error generating image ${i + 1}:`, imgError);
      }
      
      // Small delay between image generations
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`Generated ${imageUrls.length} images`);

    // Step 3: Generate article content with conversational, fun tone
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
            content: `You are a fun, conversational food blogger. Write engaging recipe articles in HTML format - around 1000 words.

Keep the tone informal and playful—as if you're chatting with a friend who loves cooking (but doesn't take life too seriously).

Structure the article with these EXACT headings (use <h2> tags):

1. <p> Short, Catchy Intro (NO heading for intro): Start immediately with something engaging or humorous that hooks the reader. Avoid clichés like "In today's world..." Instead, go for something like, "So you're craving something tasty but too lazy to spend forever in the kitchen, huh? Same." :)

{{IMAGE_1}}
<p class="caption"><em>Beautiful shot of the finished dish</em></p>

2. <h2>Why This Recipe is Awesome</h2>: Highlight what's so great about the recipe. Feel free to use sarcasm or humor, like, "It's idiot-proof, even I didn't mess it up."

3. <h2>Ingredients You'll Need</h2>: List ingredients in <ul><li> bullet points. Keep descriptions simple, funny, or sarcastic where appropriate.

{{IMAGE_2}}
<p class="caption"><em>Fresh ingredients ready to go</em></p>

4. <h2>Step-by-Step Instructions</h2>: Use <ol><li> numbered list format, short and easy steps. Use active voice. Keep paragraphs short (3–4 sentences max).

{{IMAGE_3}}
<p class="caption"><em>The cooking process in action</em></p>

5. <h2>Common Mistakes to Avoid</h2>: List common mistakes in a humorous or mildly sarcastic tone. Example: "Thinking you don't need to preheat the oven—rookie mistake."

6. <h2>Alternatives & Substitutions</h2>: Suggest simple alternatives or ingredient substitutions. Add some personal commentary or opinions for flair.

7. <h2>FAQ (Frequently Asked Questions)</h2>: Include 5–7 FAQs using <h3> for each question. Use rhetorical questions, answering casually and humorously. Example: "Can I use margarine instead of butter? Well, technically yes, but why hurt your soul like that?"

{{IMAGE_4}}
<p class="caption"><em>The final beautiful presentation</em></p>

8. <h2>Final Thoughts</h2>: Wrap up with a casual, friendly ending. Keep it light-hearted and encouraging, maybe a gentle nudge: "Now go impress someone—or yourself—with your new culinary skills. You've earned it!"

STYLING RULES:
- Keep paragraphs concise and punchy (3-4 sentences max)
- Use <strong> to bold key tips and important points
- Occasional use of slang or abbreviations (FYI, IMO, etc.)—limit to 2-3 instances
- Avoid passive voice; keep the tone active and direct
- Engage readers with rhetorical questions occasionally
- Inject subtle humor or sarcasm to keep it engaging, but don't overdo it`
          },
          {
            role: "user",
            content: `Write a complete recipe article for: "${title}"

Be conversational, fun, and engaging. Use the exact structure provided with all 4 image placeholders: {{IMAGE_1}}, {{IMAGE_2}}, {{IMAGE_3}}, {{IMAGE_4}}`
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

    // Step 4: Replace image placeholders with actual image URLs
    for (let i = 0; i < 4; i++) {
      const placeholder = `{{IMAGE_${i + 1}}}`;
      if (imageUrls[i]) {
        articleContent = articleContent.replace(
          placeholder,
          `<figure class="article-image"><img src="${imageUrls[i]}" alt="${title} - Image ${i + 1}" /></figure>`
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
      imagesGenerated: imageUrls.length
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