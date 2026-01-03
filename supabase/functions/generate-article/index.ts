import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

// Fetch and parse sitemap to get relevant URLs
async function fetchSitemapUrls(sitemapUrl: string, sitemapType: string = 'auto'): Promise<string[]> {
  try {
    let actualUrl = sitemapUrl.replace(/\/$/, '');
    
    if (sitemapType === 'wordpress') {
      actualUrl = `${actualUrl}/wp-sitemap.xml`;
    } else if (sitemapType === 'yoast' || sitemapType === 'rankmath') {
      actualUrl = `${actualUrl}/sitemap_index.xml`;
    } else if (sitemapType === 'standard') {
      actualUrl = `${actualUrl}/sitemap.xml`;
    } else if (sitemapType === 'auto') {
      const tryUrls = [
        `${actualUrl}/wp-sitemap.xml`,
        `${actualUrl}/sitemap_index.xml`,
        `${actualUrl}/sitemap.xml`,
      ];
      
      for (const tryUrl of tryUrls) {
        try {
          const testResponse = await fetch(tryUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)' }
          });
          if (testResponse.ok) {
            actualUrl = tryUrl;
            console.log('Auto-detected sitemap at:', actualUrl);
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }
    
    console.log('Fetching sitemap from:', actualUrl);
    const response = await fetch(actualUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)' }
    });
    
    if (!response.ok) {
      console.log('Sitemap fetch failed:', response.status);
      return [];
    }
    
    const text = await response.text();
    const isSitemapIndex = text.includes('<sitemapindex') || text.includes('sitemap-posts') || text.includes('wp-sitemap-posts');
    
    if (isSitemapIndex) {
      console.log('Detected sitemap index, fetching child sitemaps...');
      
      const sitemapMatches = text.match(/<loc>([^<]+\.xml)<\/loc>/g) || [];
      const childSitemaps = sitemapMatches.map(match => match.replace(/<\/?loc>/g, ''));
      
      const relevantSitemaps = childSitemaps.filter(url => 
        url.includes('post') || url.includes('page') || url.includes('article') ||
        url.includes('recipe') || url.includes('blog')
      );
      
      console.log(`Found ${relevantSitemaps.length} relevant child sitemaps out of ${childSitemaps.length} total`);
      
      const allUrls: string[] = [];
      
      for (const childUrl of relevantSitemaps.slice(0, 5)) {
        try {
          const childResponse = await fetch(childUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)' }
          });
          
          if (childResponse.ok) {
            const childText = await childResponse.text();
            const urlMatches = childText.match(/<loc>([^<]+)<\/loc>/g) || [];
            const urls = urlMatches
              .map(match => match.replace(/<\/?loc>/g, ''))
              .filter(url => !url.endsWith('.xml'));
            
            allUrls.push(...urls);
            console.log(`Fetched ${urls.length} URLs from ${childUrl}`);
          }
        } catch (e) {
          console.error(`Error fetching child sitemap ${childUrl}:`, e);
        }
      }
      
      console.log(`Total URLs collected: ${allUrls.length}`);
      return allUrls.slice(0, 200);
    }
    
    const urlMatches = text.match(/<loc>([^<]+)<\/loc>/g) || [];
    const urls = urlMatches
      .map(match => match.replace(/<\/?loc>/g, ''))
      .filter(url => !url.endsWith('.xml'));
    
    console.log(`Found ${urls.length} URLs in sitemap`);
    return urls.slice(0, 200);
  } catch (error) {
    console.error('Error fetching sitemap:', error);
    return [];
  }
}

// Call Lovable AI Gateway for text generation
async function callLovableAI(prompt: string, systemPrompt: string, LOVABLE_API_KEY: string): Promise<string> {
  console.log('Calling Lovable AI Gateway...');
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Lovable AI error:', response.status, errorText);
    
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (response.status === 402) {
      throw new Error('Payment required. Please add credits to your Lovable workspace.');
    }
    throw new Error(`Lovable AI error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Call Lovable AI for image generation
async function callLovableImageAI(prompt: string, LOVABLE_API_KEY: string): Promise<string | null> {
  try {
    console.log('Generating image with Lovable AI...');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI image error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    // Check if the response contains base64 image data
    if (content && typeof content === 'string') {
      // The image might be in different formats, check for base64
      if (content.startsWith('data:image')) {
        return content;
      }
      // Try to extract base64 from markdown image format
      const base64Match = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
      if (base64Match) {
        return base64Match[0];
      }
    }
    
    // Check if there's an image in the response structure
    if (data.choices?.[0]?.message?.images?.[0]) {
      const imageData = data.choices[0].message.images[0];
      if (imageData.url) return imageData.url;
      if (imageData.base64) return `data:image/webp;base64,${imageData.base64}`;
    }
    
    console.log('No image found in response');
    return null;
  } catch (error) {
    console.error('Lovable AI image generation error:', error);
    return null;
  }
}

// Find relevant URLs from sitemap
async function findRelevantUrls(
  sitemapUrls: string[], 
  topic: string, 
  LOVABLE_API_KEY: string
): Promise<Array<{ url: string; anchorText: string }>> {
  if (sitemapUrls.length === 0) return [];
  
  try {
    const prompt = `Topic: "${topic}"

Available URLs:
${sitemapUrls.slice(0, 50).join('\n')}

Find 3-5 URLs most relevant to this topic for internal linking. Return JSON array:
[{"url": "full_url", "anchorText": "natural anchor text for the link"}]

Only return valid JSON array, nothing else.`;

    const content = await callLovableAI(prompt, 'You analyze URLs and find ones relevant to a cooking topic. Return JSON array only.', LOVABLE_API_KEY);
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

const QUALITY_SUFFIXES: Record<string, string> = {
  low: '512px resolution, quick render',
  medium: '1024px resolution, balanced quality',
  high: '2K resolution, ultra detailed, maximum quality, 4K textures'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Store request body for error handling
  let requestBody: any = null;
  
  try {
    requestBody = await req.json();
    const { recipeId, title: focusKeyword, sitemapUrl, sitemapType = 'auto', imageQuality = 'medium', aspectRatio = '16:9' } = requestBody;
    
    console.log(`Generating article for focus keyword: ${focusKeyword} (ID: ${recipeId})`);
    console.log(`Image settings: quality=${imageQuality}, aspectRatio=${aspectRatio}, sitemapType=${sitemapType}`);

    // Use Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

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

    // Step 0: Generate SEO-optimized title from focus keyword
    console.log('Generating SEO title from focus keyword...');
    
    const titleSystemPrompt = `You are an SEO expert and professional content writer. Generate a beautiful, click-worthy title that:
1. MUST include the exact focus keyword naturally (can add words before/after)
2. Is engaging and makes readers want to click
3. Is between 50-70 characters (optimal for SEO)
4. Uses power words like "Easy", "Best", "Ultimate", "Simple", "Delicious", "Perfect"
5. Can include a dash with a subtitle for extra appeal

Examples:
- Focus: "chocolate chip cookies" → "Perfect Chocolate Chip Cookies – Soft, Chewy, and Irresistible"
- Focus: "easy dinner recipes" → "Easy Dinner Recipes for Busy Weeknights – Ready in 30 Minutes"

Return ONLY the title, nothing else.`;

    const titlePrompt = `Generate an SEO-optimized, beautiful title for this focus keyword: "${focusKeyword}"`;
    
    let seoTitle = focusKeyword;
    try {
      const generatedTitle = await callLovableAI(titlePrompt, titleSystemPrompt, LOVABLE_API_KEY);
      if (generatedTitle && generatedTitle.trim().length > 0) {
        seoTitle = generatedTitle.trim().replace(/^["']|["']$/g, '').trim();
        console.log(`Generated SEO title: ${seoTitle}`);
        
        await supabase
          .from('recipes')
          .update({ title: seoTitle })
          .eq('id', recipeId);
      }
    } catch (e) {
      console.log('Using focus keyword as title:', focusKeyword);
    }

    // Fetch sitemap URLs if provided
    let relevantLinks: Array<{ url: string; anchorText: string }> = [];
    if (sitemapUrl) {
      const sitemapUrls = await fetchSitemapUrls(sitemapUrl, sitemapType);
      relevantLinks = await findRelevantUrls(sitemapUrls, seoTitle, LOVABLE_API_KEY);
      console.log(`Found ${relevantLinks.length} relevant internal links`);
    }

    // Step 1: Generate realistic image prompts
    console.log('Generating image prompts...');
    
    const imagePromptsSystemPrompt = `You generate HYPER-REALISTIC food photography prompts for AI image generation.

CRITICAL REQUIREMENTS:
- Specify REAL camera and lens (Canon 5D Mark IV, Sony A7III, 85mm f/1.4)
- Include IMPERFECTIONS: slight steam blur, natural shadows, crumbs on table
- Describe REAL lighting: window light, golden hour, kitchen lighting
- Mention AUTHENTIC props: wooden cutting boards, ceramic plates, linen napkins
- Include human elements: hand reaching for food, fork mid-bite

Return exactly 4 prompts as JSON array.`;

    const imagePromptsPrompt = `Generate 4 HYPER-REALISTIC food photography prompts for: "${seoTitle}"

1. Hero shot - overhead or 45-degree angle
2. Ingredient close-up - raw ingredients 
3. Cooking action - steam, sizzle, motion
4. Served dish - on table with authentic styling

Return as JSON: ["prompt1", "prompt2", "prompt3", "prompt4"]`;

    let imagePrompts = [
      `Hyper-realistic food photography of ${seoTitle}, shot on Canon 5D Mark IV with 50mm f/1.4 lens, natural window light, overhead angle on weathered oak table, rustic ceramic plate, fresh herbs scattered naturally, slight steam rising, shallow depth of field, editorial food magazine quality`,
      `Close-up of fresh ingredients for ${seoTitle}, shot on Sony A7III with 85mm lens, morning kitchen light, worn wooden cutting board, moisture droplets on vegetables, natural color variations`,
      `Action shot of ${seoTitle} being cooked, real kitchen environment, natural steam and sizzle, chef's hand visible, warm kitchen lighting, oil splatter on pan edges`,
      `${seoTitle} served on vintage stoneware plate, real dining table setting with linen napkin, fork resting naturally, warm evening light, lifestyle food photography`
    ];

    try {
      const promptsText = await callLovableAI(imagePromptsPrompt, imagePromptsSystemPrompt, LOVABLE_API_KEY);
      const jsonMatch = promptsText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        imagePrompts = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.log('Using default realistic image prompts');
    }

    console.log('Image prompts ready:', imagePrompts.length);

    // Step 2: Generate images and upload to storage
    console.log('Generating images...');
    const imageUrls: string[] = [];
    
    for (let i = 0; i < Math.min(imagePrompts.length, 4); i++) {
      try {
        const realismBooster = ` Professional DSLR camera, natural lighting with visible shadows, authentic food styling. ${qualitySuffix}. ${aspectRatio} aspect ratio, ${dimensions.width}x${dimensions.height} pixels.`;
        
        const base64Url = await callLovableImageAI(imagePrompts[i] + realismBooster, LOVABLE_API_KEY);
        
        if (base64Url && (base64Url.startsWith('data:image') || base64Url.startsWith('http'))) {
          if (base64Url.startsWith('data:image')) {
            // Upload base64 to Supabase Storage
            const imageBytes = base64ToUint8Array(base64Url);
            const fileName = `${recipeId}/image-${i + 1}-${Date.now()}.webp`;
            
            const { error: uploadError } = await supabase.storage
              .from('article-images')
              .upload(fileName, imageBytes, {
                contentType: 'image/webp',
                upsert: true
              });
            
            if (!uploadError) {
              const { data: urlData } = supabase.storage
                .from('article-images')
                .getPublicUrl(fileName);
              
              if (urlData?.publicUrl) {
                imageUrls.push(urlData.publicUrl);
                console.log(`Image ${i + 1} uploaded successfully`);
              }
            } else {
              console.error(`Upload error for image ${i + 1}:`, uploadError);
            }
          } else {
            // Use URL directly
            imageUrls.push(base64Url);
            console.log(`Image ${i + 1} ready (URL)`);
          }
        }
      } catch (imgError) {
        console.error(`Error generating image ${i + 1}:`, imgError);
      }
      
      // Delay between image generations to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Generated ${imageUrls.length} images`);

    // Build internal links section
    let internalLinksInstruction = '';
    if (relevantLinks.length > 0) {
      internalLinksInstruction = `

INTERNAL LINKING REQUIREMENT:
Naturally incorporate these internal links within the article content:
${relevantLinks.map(link => `- <a href="${link.url}">${link.anchorText}</a>`).join('\n')}

Place these links naturally within paragraphs where they make sense.`;
    }

    // Step 3: Generate SEO-optimized article content
    console.log('Generating article content...');
    
    const articleSystemPrompt = `You are a professional food blogger. Write a complete SEO-optimized recipe article in English using the exact structure below.
${internalLinksInstruction}

STRUCTURE TO FOLLOW:

<h1>[Recipe Title]</h1>

{{IMAGE_1}}

<h2>Introduction</h2>
<p>Brief overview of the dish. 2-3 paragraphs.</p>

<h2>Why You'll Love This Recipe</h2>
<ul><li>3-5 bullet points highlighting key benefits</li></ul>

<h2>Ingredients</h2>
<p>Brief intro line</p>
<ul><li>Full ingredient list with exact measurements</li></ul>

<h2>Equipment Needed</h2>
<ul><li>List required kitchen tools</li></ul>

{{IMAGE_2}}

<h2>Instructions</h2>
<p>Brief intro line</p>
<ol><li>Step-by-step cooking instructions. Use <strong> for key actions.</li></ol>

{{IMAGE_3}}

<h2>Tips & Variations</h2>
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
<p>Estimated calories and basic macros per serving.</p>

{{IMAGE_4}}

<h2>FAQs</h2>
<h3>Question 1?</h3>
<p>Answer</p>
(Include 3-5 common questions)

<h2>Final Thoughts</h2>
<p>Short summary with call-to-action.</p>

GUIDELINES:
- Use proper H1, H2, H3 headings
- Keep paragraphs short (2-3 sentences)
- Natural, human-like English
- No emojis
- Use <strong> for key points
- Output clean HTML only`;

    const articlePrompt = `RECIPE TOPIC: "${seoTitle}"
FOCUS KEYWORD: "${focusKeyword}"

Write a complete SEO-optimized recipe article following the structure above. Include the focus keyword "${focusKeyword}" naturally. Include all 4 image placeholders: {{IMAGE_1}}, {{IMAGE_2}}, {{IMAGE_3}}, {{IMAGE_4}}`;

    const articleContent = await callLovableAI(articlePrompt, articleSystemPrompt, LOVABLE_API_KEY);

    if (!articleContent) {
      throw new Error("No content generated");
    }

    // Step 4: Replace image placeholders with actual URLs
    let finalContent = articleContent;
    for (let i = 0; i < 4; i++) {
      const placeholder = `{{IMAGE_${i + 1}}}`;
      if (imageUrls[i]) {
        finalContent = finalContent.replace(
          placeholder,
          `<figure class="article-image"><img src="${imageUrls[i]}" alt="${seoTitle} - Image ${i + 1}" loading="lazy" /></figure>`
        );
      } else {
        finalContent = finalContent.replace(placeholder, '');
      }
    }

    console.log(`Article generated successfully for: ${seoTitle}`);

    // Update recipe with generated content
    const { error: updateError } = await supabase
      .from('recipes')
      .update({ 
        status: 'completed', 
        article_content: finalContent,
        error_message: null 
      })
      .eq('id', recipeId);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Article generated successfully',
      imageCount: imageUrls.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-article:', error);
    
    // Try to update recipe status to error
    try {
      const recipeId = requestBody?.recipeId;
      if (recipeId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from('recipes')
          .update({ 
            status: 'error', 
            error_message: error instanceof Error ? error.message : 'Unknown error' 
          })
          .eq('id', recipeId);
      }
    } catch (e) {
      console.error('Failed to update error status:', e);
    }

    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
