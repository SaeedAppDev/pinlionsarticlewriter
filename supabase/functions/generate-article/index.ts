import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// Call Groq API for text generation (FREE tier - 14,000+ requests/day)
async function callGroqAI(prompt: string, systemPrompt: string, GROQ_API_KEY: string): Promise<string> {
  console.log('Calling Groq API (FREE tier)...');
  
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Groq API error:', response.status, errorText);
    
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a minute and try again.');
    }
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Get free food images from Pexels API (15,000 requests/month free)
async function getPexelsImages(query: string, count: number = 7): Promise<string[]> {
  const PEXELS_API_KEY = Deno.env.get('PEXELS_API_KEY');
  
  if (!PEXELS_API_KEY) {
    console.log('No Pexels API key, using Picsum fallback...');
    return getPicsumFallback(count);
  }
  
  try {
    const searchQuery = encodeURIComponent(`${query} food recipe`);
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${searchQuery}&per_page=${count}&orientation=landscape`,
      {
        headers: {
          'Authorization': PEXELS_API_KEY
        }
      }
    );
    
    if (!response.ok) {
      console.error('Pexels API error:', response.status);
      return getPicsumFallback(count);
    }
    
    const data = await response.json();
    const images = data.photos?.map((photo: any) => photo.src.large) || [];
    
    console.log(`Got ${images.length} images from Pexels`);
    
    // If not enough images, fill with Picsum
    if (images.length < count) {
      const fallback = getPicsumFallback(count - images.length);
      images.push(...fallback);
    }
    
    return images;
  } catch (error) {
    console.error('Error getting Pexels images:', error);
    return getPicsumFallback(count);
  }
}

// Fallback to Picsum (always works, random food-related images)
function getPicsumFallback(count: number): string[] {
  const images: string[] = [];
  // Using specific Picsum IDs that look like food/cooking
  const foodImageIds = [292, 493, 674, 1080, 1099, 225, 326, 429, 488, 835];
  
  for (let i = 0; i < count; i++) {
    const id = foodImageIds[i % foodImageIds.length];
    images.push(`https://picsum.photos/id/${id}/1200/800`);
  }
  
  console.log(`Generated ${images.length} Picsum fallback images`);
  return images;
}

// Find relevant URLs from sitemap
async function findRelevantUrls(
  sitemapUrls: string[], 
  topic: string, 
  GROQ_API_KEY: string
): Promise<Array<{ url: string; anchorText: string }>> {
  if (sitemapUrls.length === 0) return [];
  
  try {
    const prompt = `Topic: "${topic}"

Available URLs:
${sitemapUrls.slice(0, 50).join('\n')}

Find 3-5 URLs most relevant to this topic for internal linking. Return JSON array:
[{"url": "full_url", "anchorText": "natural anchor text for the link"}]

Only return valid JSON array, nothing else.`;

    const content = await callGroqAI(prompt, 'You analyze URLs and find ones relevant to a cooking topic. Return JSON array only.', GROQ_API_KEY);
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Error finding relevant URLs:', error);
  }
  
  return [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestBody: any = null;
  
  try {
    requestBody = await req.json();
    const { recipeId, title: focusKeyword, sitemapUrl, sitemapType = 'auto' } = requestBody;
    
    console.log(`Generating article for focus keyword: ${focusKeyword} (ID: ${recipeId})`);

    // Use FREE Groq API
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
    if (!GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is not configured. Get a FREE key from console.groq.com");
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

    // Step 0: Generate SEO-optimized title from focus keyword
    console.log('Generating SEO title from focus keyword...');
    
    const titleSystemPrompt = `You are an SEO expert. Generate a beautiful, click-worthy title that:
1. MUST include the exact focus keyword naturally
2. Is engaging and makes readers want to click
3. Is between 50-70 characters
4. Uses power words like "Easy", "Best", "Ultimate", "Simple", "Delicious", "Perfect"
5. Can include a dash with a subtitle

Examples:
- Focus: "chocolate chip cookies" → "Perfect Chocolate Chip Cookies – Soft, Chewy, and Irresistible"
- Focus: "easy dinner recipes" → "Easy Dinner Recipes for Busy Weeknights – Ready in 30 Minutes"

Return ONLY the title, nothing else.`;

    const titlePrompt = `Generate an SEO-optimized, beautiful title for this focus keyword: "${focusKeyword}"`;
    
    let seoTitle = focusKeyword;
    try {
      const generatedTitle = await callGroqAI(titlePrompt, titleSystemPrompt, GROQ_API_KEY);
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
      relevantLinks = await findRelevantUrls(sitemapUrls, seoTitle, GROQ_API_KEY);
      console.log(`Found ${relevantLinks.length} relevant internal links`);
    }

    // Step 1: Get FREE images from Pexels
    console.log('Getting FREE images from Pexels...');
    const imageUrls = await getPexelsImages(seoTitle, 7);
    console.log(`Got ${imageUrls.length} images`);

    // Build internal links section
    let internalLinksInstruction = '';
    if (relevantLinks.length > 0) {
      internalLinksInstruction = `

INTERNAL LINKING REQUIREMENT:
Naturally incorporate these internal links within the article content:
${relevantLinks.map(link => `- <a href="${link.url}">${link.anchorText}</a>`).join('\n')}

Place these links naturally within paragraphs where they make sense.`;
    }

    // Step 2: Generate SEO-optimized article content
    console.log('Generating article content with Groq (FREE)...');
    
    const articleSystemPrompt = `You are a professional food blogger and SEO expert. Write a COMPREHENSIVE, LONG, and detailed SEO-optimized recipe article in English. The article should be 2500-3500 words.
${internalLinksInstruction}

STRUCTURE TO FOLLOW:

<h1>[Recipe Title]</h1>

{{IMAGE_1}}

<h2>Introduction</h2>
<p>Engaging overview of the dish. 3-4 paragraphs covering why this recipe is special, perfect occasions to make it, and what makes it unique. Hook the reader.</p>

<h2>What Makes This Recipe Special</h2>
<p>2-3 paragraphs explaining the origins, history, or unique aspects of this dish.</p>

{{IMAGE_2}}

<h2>Why You'll Love This Recipe</h2>
<ul>
<li><strong>Reason 1:</strong> detailed explanation</li>
<li><strong>Reason 2:</strong> detailed explanation</li>
<li><strong>Reason 3:</strong> detailed explanation</li>
<li><strong>Reason 4:</strong> detailed explanation</li>
<li><strong>Reason 5:</strong> detailed explanation</li>
</ul>

<h2>Ingredients You'll Need</h2>
<p>Introduction paragraph about ingredient quality and sourcing.</p>

<h3>Main Ingredients</h3>
<ul><li>Full ingredient list with exact measurements and notes</li></ul>

<h3>For the Topping/Frosting (if applicable)</h3>
<ul><li>Additional ingredients</li></ul>

<h3>Optional Add-ins</h3>
<ul><li>Extra flavor options</li></ul>

{{IMAGE_3}}

<h2>Equipment Needed</h2>
<p>Brief intro about kitchen tools.</p>
<ul><li>List each required tool with explanation of why it's needed</li></ul>

<h2>Step-by-Step Instructions</h2>
<p>Let me walk you through the entire process in detail.</p>

<h3>Step 1: Preparation</h3>
<p>Detailed preparation instructions. 2-3 sentences with tips.</p>

<h3>Step 2: [Next Major Step]</h3>
<p>Continue with detailed instructions...</p>

(Continue with 6-8 detailed steps, each with its own H3)

{{IMAGE_4}}

<h2>Pro Tips for Perfect Results</h2>
<p>Introduction to tips section.</p>
<ul>
<li><strong>Tip 1:</strong> detailed practical advice</li>
<li><strong>Tip 2:</strong> detailed practical advice</li>
<li><strong>Tip 3:</strong> detailed practical advice</li>
<li><strong>Tip 4:</strong> detailed practical advice</li>
<li><strong>Tip 5:</strong> detailed practical advice</li>
</ul>

{{IMAGE_5}}

<h2>Ingredient Substitutions & Variations</h2>
<h3>Dietary Modifications</h3>
<ul>
<li><strong>Gluten-free:</strong> how to modify</li>
<li><strong>Dairy-free:</strong> how to modify</li>
<li><strong>Vegan:</strong> how to modify</li>
</ul>

<h3>Flavor Variations</h3>
<p>Different ways to customize the recipe with alternative flavors, spices, or ingredients.</p>

<h2>Serving Suggestions</h2>
<p>2-3 paragraphs with detailed serving ideas, side dishes, toppings, garnishes, and presentation tips.</p>

{{IMAGE_6}}

<h2>Storage & Meal Prep</h2>
<h3>Short-term Storage</h3>
<p>How to store for a few days, container recommendations.</p>

<h3>Freezing Instructions</h3>
<p>How to freeze, how long it lasts, thawing instructions.</p>

<h3>Reheating Tips</h3>
<p>Best methods to reheat while maintaining quality.</p>

<h2>Nutrition Information</h2>
<p>Detailed nutritional breakdown per serving with calories, protein, carbs, fat, fiber, sugar.</p>

<h2>Frequently Asked Questions</h2>

<h3>Can I make this ahead of time?</h3>
<p>Detailed answer about meal prep options.</p>

<h3>How do I know when it's done?</h3>
<p>Signs of doneness and testing methods.</p>

<h3>What if I don't have [key ingredient]?</h3>
<p>Substitution advice.</p>

<h3>Can I double this recipe?</h3>
<p>Scaling instructions and tips.</p>

<h3>Why did my [dish] turn out [common problem]?</h3>
<p>Troubleshooting common issues.</p>

{{IMAGE_7}}

<h2>Final Thoughts</h2>
<p>2-3 paragraphs summarizing the recipe, encouraging readers to try it, and inviting them to comment or share their results. Include a call-to-action.</p>

CRITICAL GUIDELINES:
- Write 2500-3500 words minimum
- Use ALL 7 image placeholders: {{IMAGE_1}} through {{IMAGE_7}}
- Use proper H1, H2, H3 headings hierarchy
- Keep paragraphs detailed but readable (3-5 sentences each)
- Natural, conversational English like a real food blogger
- No emojis
- Use <strong> to emphasize key points
- Output clean HTML only
- Include the focus keyword naturally 10-15 times throughout`;

    const articlePrompt = `RECIPE TOPIC: "${seoTitle}"
FOCUS KEYWORD: "${focusKeyword}"

Write a COMPREHENSIVE, LONG (2500-3500 words), SEO-optimized recipe article following the structure above. Include the focus keyword "${focusKeyword}" naturally 10-15 times throughout. Include ALL 7 image placeholders: {{IMAGE_1}}, {{IMAGE_2}}, {{IMAGE_3}}, {{IMAGE_4}}, {{IMAGE_5}}, {{IMAGE_6}}, {{IMAGE_7}}`;

    const articleContent = await callGroqAI(articlePrompt, articleSystemPrompt, GROQ_API_KEY);

    if (!articleContent) {
      throw new Error("No content generated");
    }

    // Step 3: Replace image placeholders with real image URLs
    let finalContent = articleContent;
    for (let i = 0; i < 7; i++) {
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
      message: 'Article generated successfully (FREE tier)',
      imageCount: imageUrls.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-article:', error);
    
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
