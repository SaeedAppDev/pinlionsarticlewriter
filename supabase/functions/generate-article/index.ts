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

    // Step 3: Generate SEO-optimized article content
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
            content: `You are a professional food blogger. Write a complete SEO-optimized recipe article in English using the exact structure below.

Follow a food-blog style similar to professional recipe websites. Output clean HTML only, no markdown.

STRUCTURE TO FOLLOW (use these EXACT headings):

<h1>[Recipe Title]</h1>

{{IMAGE_1}}

<h2>Introduction</h2>
<p>Brief overview of the dish. Mention taste, aroma, and why readers will love it. 2-3 paragraphs.</p>

<h2>Why You'll Love This Recipe</h2>
<ul><li> 3-5 bullet points highlighting key benefits (easy to make, budget-friendly, crowd-pleaser, etc.)</li></ul>

<h2>Ingredients</h2>
<p>Brief intro line</p>
<ul><li>Full ingredient list with exact measurements in bullet points</li></ul>

<h2>Equipment Needed</h2>
<ul><li>List required kitchen tools</li></ul>

{{IMAGE_2}}

<h2>Instructions</h2>
<p>Brief intro line</p>
<ol><li>Step-by-step cooking instructions. Numbered steps. Clear and simple language. Use <strong> for key actions.</li></ol>

{{IMAGE_3}}

<h2>Tips & Variations</h2>
<p>Brief intro</p>
<ul>
<li><strong>Cooking tips:</strong> practical advice</li>
<li><strong>Ingredient substitutions:</strong> alternatives</li>
<li><strong>Flavor variations:</strong> different ways to customize</li>
</ul>

<h2>How to Serve</h2>
<p>Serving suggestions, side dishes, toppings, garnishes.</p>

<h2>Storage & Reheating</h2>
<ul>
<li><strong>Storage:</strong> How to store leftovers</li>
<li><strong>Reheating:</strong> Best reheating instructions</li>
</ul>

<h2>Nutrition Information</h2>
<p>Estimated calories and basic macros per serving (approximate values).</p>

{{IMAGE_4}}

<h2>FAQs (Frequently Asked Questions)</h2>
<h3>Question 1?</h3>
<p>Answer</p>
<h3>Question 2?</h3>
<p>Answer</p>
(Include 3-5 common questions with clear answers)

<h2>Final Thoughts</h2>
<p>Short summary. Encourage readers to try or save the recipe. End with a friendly call-to-action.</p>

IMPORTANT GUIDELINES:
- Use proper H1, H2, H3 headings as shown
- Keep paragraphs short and readable (2-3 sentences max)
- Use natural, human-like English
- Avoid emojis
- Make the content 100% original
- Use <strong> to bold key points and tips
- Output clean HTML only`
          },
          {
            role: "user",
            content: `RECIPE TOPIC: "${title}"

Write a complete SEO-optimized recipe article following the EXACT structure above. Include all 4 image placeholders: {{IMAGE_1}}, {{IMAGE_2}}, {{IMAGE_3}}, {{IMAGE_4}}`
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