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

// Fetch and parse sitemap to get relevant URLs
async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  try {
    console.log('Fetching sitemap from:', sitemapUrl);
    const response = await fetch(sitemapUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)' }
    });
    
    if (!response.ok) {
      console.log('Sitemap fetch failed:', response.status);
      return [];
    }
    
    const text = await response.text();
    
    // Parse URLs from XML sitemap
    const urlMatches = text.match(/<loc>([^<]+)<\/loc>/g) || [];
    const urls = urlMatches.map(match => match.replace(/<\/?loc>/g, ''));
    
    console.log(`Found ${urls.length} URLs in sitemap`);
    return urls.slice(0, 100); // Limit to first 100 URLs
  } catch (error) {
    console.error('Error fetching sitemap:', error);
    return [];
  }
}

// Find relevant URLs from sitemap based on recipe topic
async function findRelevantUrls(
  sitemapUrls: string[], 
  topic: string, 
  LOVABLE_API_KEY: string
): Promise<Array<{ url: string; anchorText: string }>> {
  if (sitemapUrls.length === 0) return [];
  
  try {
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
            content: `You analyze URLs and find ones relevant to a cooking topic. Return JSON array only.`
          },
          {
            role: "user",
            content: `Topic: "${topic}"

Available URLs:
${sitemapUrls.slice(0, 50).join('\n')}

Find 3-5 URLs most relevant to this topic for internal linking. Return JSON array:
[{"url": "full_url", "anchorText": "natural anchor text for the link"}]

Only return valid JSON array, nothing else.`
          }
        ],
      }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Error finding relevant URLs:', error);
  }
  
  return [];
}

// Aspect ratio to dimensions mapping
const ASPECT_RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1920, height: 1080 },
  '4:3': { width: 1024, height: 768 },
  '3:2': { width: 1200, height: 800 },
  '2:3': { width: 800, height: 1200 },
  '9:16': { width: 1080, height: 1920 },
  '3:4': { width: 768, height: 1024 },
  '21:9': { width: 1680, height: 720 },
};

// Quality to prompt suffix mapping
const QUALITY_SUFFIXES: Record<string, string> = {
  low: '512px resolution, quick render',
  medium: '1024px resolution, balanced quality',
  high: '2K resolution, ultra detailed, maximum quality, 4K textures'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipeId, title, sitemapUrl, imageQuality = 'medium', aspectRatio = '16:9' } = await req.json();
    console.log(`Generating article for: ${title} (ID: ${recipeId})`);
    console.log(`Image settings: quality=${imageQuality}, aspectRatio=${aspectRatio}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get dimensions for aspect ratio
    const dimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio] || ASPECT_RATIO_DIMENSIONS['16:9'];
    const qualitySuffix = QUALITY_SUFFIXES[imageQuality] || QUALITY_SUFFIXES['medium'];

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update status to processing
    await supabase
      .from('recipes')
      .update({ status: 'processing' })
      .eq('id', recipeId);

    // Fetch sitemap URLs if provided
    let relevantLinks: Array<{ url: string; anchorText: string }> = [];
    if (sitemapUrl) {
      const sitemapUrls = await fetchSitemapUrls(sitemapUrl);
      relevantLinks = await findRelevantUrls(sitemapUrls, title, LOVABLE_API_KEY);
      console.log(`Found ${relevantLinks.length} relevant internal links`);
    }

    // Step 1: Generate REALISTIC image prompts for the article
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
            content: `You generate HYPER-REALISTIC food photography prompts. The goal is to create images that look like REAL photographs taken by a professional food photographer, NOT AI-generated looking images.

CRITICAL REQUIREMENTS for realistic images:
- Specify REAL camera and lens (Canon 5D Mark IV, Sony A7III, 85mm f/1.4, 50mm f/1.8)
- Include IMPERFECTIONS: slight steam blur, natural shadows, crumbs on table, sauce drips
- Describe REAL lighting: window light, golden hour, kitchen lighting with shadows
- Mention AUTHENTIC props: used wooden cutting boards with knife marks, vintage ceramic plates with minor chips, linen napkins with wrinkles
- Include human elements: hand reaching for food, fork mid-bite, napkin slightly askew
- Describe NATURAL food appearance: slightly uneven browning, natural color variations, visible texture
- Avoid: perfect symmetry, unnaturally vibrant colors, floating food, fake-looking steam

Return exactly 4 prompts as JSON array.`
          },
          {
            role: "user",
            content: `Generate 4 HYPER-REALISTIC food photography prompts for: "${title}"

1. Hero shot - overhead or 45-degree, looks like editorial food magazine
2. Ingredient close-up - raw ingredients with natural imperfections
3. Cooking action - steam, sizzle, motion blur, real kitchen environment
4. Served dish - on a real table with authentic styling, human presence

Return as JSON: ["prompt1", "prompt2", "prompt3", "prompt4"]`
          }
        ],
      }),
    });

    let imagePrompts = [
      `Hyper-realistic food photography of ${title}, shot on Canon 5D Mark IV with 50mm f/1.4 lens, natural window light casting soft shadows, overhead angle on weathered oak table with visible grain, rustic ceramic plate with slight imperfections, fresh herbs scattered naturally with some fallen leaves, slight steam rising naturally, shallow depth of field, editorial food magazine quality, NOT AI generated, real photograph`,
      `Close-up of fresh ingredients for ${title}, shot on Sony A7III with 85mm lens, morning kitchen light, ingredients on worn wooden cutting board with knife marks, some moisture droplets on vegetables, natural color variations, slightly uneven arrangement, real textures visible, professional food photography, authentic imperfections`,
      `Action shot of ${title} being cooked, real kitchen environment with visible stovetop, natural steam and sizzle with slight motion blur, chef's hand visible stirring or flipping, warm tungsten kitchen lighting mixed with daylight, oil splatter on pan edges, authentic cooking moment, documentary style food photography`,
      `${title} served on vintage stoneware plate with hairline cracks, real dining table setting with wrinkled linen napkin, fork resting naturally with food partially eaten, wine glass with fingerprints, breadcrumbs scattered on table, warm evening light from nearby window, human presence implied, lifestyle food photography, magazine editorial quality`
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
        console.log('Using default realistic image prompts');
      }
    }

    console.log('Image prompts ready:', imagePrompts.length);

    // Step 2: Generate images in WEBP format and upload to storage
    console.log('Generating images in WebP format...');
    const imageUrls: string[] = [];
    
    for (let i = 0; i < Math.min(imagePrompts.length, 4); i++) {
      try {
        // Add realism boosters and quality/aspect ratio to each prompt
        const realismBooster = ` Captured with professional DSLR camera, natural lighting with visible shadows, authentic food styling with intentional imperfections, NOT computer generated, real photograph with film grain texture, slightly desaturated natural colors. ${qualitySuffix}. ${aspectRatio} aspect ratio, ${dimensions.width}x${dimensions.height} pixels.`;
        
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
                content: imagePrompts[i] + realismBooster
              }
            ],
            modalities: ["image", "text"]
          }),
        });

        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          const base64Url = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          
          if (base64Url && base64Url.startsWith('data:image')) {
            // Upload to Supabase Storage as WEBP
            const imageBytes = base64ToUint8Array(base64Url);
            const fileName = `${recipeId}/image-${i + 1}-${Date.now()}.webp`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('article-images')
              .upload(fileName, imageBytes, {
                contentType: 'image/webp',
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
                console.log(`Image ${i + 1} uploaded successfully as WebP`);
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

    // Build internal links section for the prompt
    let internalLinksInstruction = '';
    if (relevantLinks.length > 0) {
      internalLinksInstruction = `

INTERNAL LINKING REQUIREMENT:
Naturally incorporate these internal links within the article content where contextually relevant:
${relevantLinks.map(link => `- <a href="${link.url}">${link.anchorText}</a>`).join('\n')}

Place these links naturally within paragraphs where they make sense. Do not create a separate "Related Links" section.`;
    }

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
${internalLinksInstruction}

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
          `<figure class="article-image"><img src="${imageUrls[i]}" alt="${title} - Image ${i + 1}" loading="lazy" /></figure>`
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
      imagesGenerated: imageUrls.length,
      internalLinksAdded: relevantLinks.length
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