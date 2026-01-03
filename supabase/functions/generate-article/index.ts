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
    
    const articleSystemPrompt = `You are a fun, relatable food blogger writing for friends. Write a detailed, conversational, SEO-optimized recipe article in English (1000-1200 words).
${internalLinksInstruction}

TONE & STYLE RULES:
- Informal, playful tone like talking to a friend
- Use humor, mild sarcasm, and relatability
- Avoid clichés like "In today's world"
- Keep paragraphs SHORT and engaging (2-3 sentences max)
- Use bold to highlight key tips
- Use occasional slang like FYI or IMO (but limit to 2-3 times)
- Avoid passive voice as much as possible
- Make it mobile-friendly with short paragraphs
- No emojis

EXACT STRUCTURE TO FOLLOW:

<h1>[Create a catchy, fun, click-worthy title]</h1>

{{IMAGE_1}}

<h2>Short, Catchy Intro</h2>
<p>Start with humor or relatability. Hook the reader immediately. No formal textbook tone. Keep it light and friendly. 2-3 short paragraphs.</p>

<h2>Why This Recipe Is Awesome</h2>
<p>Explain why this recipe is great with fun tone, mild sarcasm allowed.</p>
<ul>
<li><strong>Beginner-friendly:</strong> playful explanation</li>
<li><strong>Comfort food level:</strong> 100/10</li>
<li><strong>Customizable:</strong> playful note</li>
<li><strong>Budget-friendly:</strong> basic ingredients, big flavor</li>
<li><strong>Crowd-pleaser:</strong> everyone's happy</li>
<li><strong>Reheats beautifully:</strong> future-you will thank present-you</li>
</ul>

{{IMAGE_2}}

<h2>Quick Recipe Overview</h2>
<ul>
<li><strong>Prep Time:</strong> X minutes</li>
<li><strong>Cook Time:</strong> X minutes</li>
<li><strong>Servings:</strong> X people</li>
<li><strong>Difficulty:</strong> Easy/Medium</li>
<li><strong>Flavor:</strong> describe flavor profile</li>
</ul>

<h2>Ingredients You'll Need</h2>
<p>Brief playful intro about ingredients.</p>
<ul>
<li>Ingredient 1 with measurement</li>
<li>Ingredient 2 with measurement</li>
(list all ingredients)
</ul>
<p><strong>Important tip:</strong> 👉 Season your food. Bland food is the villain of every kitchen story.</p>

{{IMAGE_3}}

<h2>Step-by-Step Instructions</h2>

<h3>1. First Step Title</h3>
<p>2-4 sentences max. Active voice. Include small helpful tip in <strong>bold</strong> if relevant.</p>

<h3>2. Second Step Title</h3>
<p>Continue with clear, fun instructions...</p>

(Continue with 6-10 numbered steps, each with H3)

{{IMAGE_4}}

<h2>Common Mistakes to Avoid</h2>
<p>A few traps people fall into (learn from them):</p>
<ul>
<li>❌ mistake 1 with humorous explanation</li>
<li>❌ mistake 2 with humorous explanation</li>
<li>❌ mistake 3 with humorous explanation</li>
<li>❌ mistake 4 with humorous explanation</li>
</ul>
<p><strong>Golden rule:</strong> 👉 Taste as you cook. Your tongue is your best tool.</p>

{{IMAGE_5}}

<h2>Alternatives & Substitutions</h2>
<p>This recipe is flexible — vibe with it:</p>
<ul>
<li><strong>No [ingredient]?</strong> → use [alternative]</li>
<li><strong>Vegetarian version:</strong> → replace with [option]</li>
<li><strong>Gluten-free:</strong> → use [alternative]</li>
<li><strong>Low-carb:</strong> → use [alternative]</li>
<li><strong>Extra cheesy:</strong> → add [option] (you're welcome)</li>
</ul>
<p>Cooking is not a contract — it's controlled chaos.</p>

<h2>Serving Suggestions</h2>
<p>Want to make it feel fancy without actually trying?</p>
<ul>
<li>Side option 1</li>
<li>Side option 2</li>
<li>Side option 3</li>
</ul>
<p>Or straight out of the baking dish while standing over the stove… zero judgment.</p>

{{IMAGE_6}}

<h2>Storage, Freezing & Reheating</h2>
<h3>Refrigeration</h3>
<p>Store leftovers up to X days in an airtight container.</p>

<h3>Freezing</h3>
<p>Freeze portions for X months.</p>

<h3>Reheat</h3>
<p>Oven or microwave both work. Add a little extra cheese because you deserve happiness.</p>

<p><strong>Fun fact:</strong> it somehow tastes even better the next day.</p>

<h2>FAQ – [Recipe Name]</h2>

<h3>Is this [dish] spicy?</h3>
<p>Conversational answer with humor.</p>

<h3>Which [ingredient variation] works best?</h3>
<p>Helpful answer with personality.</p>

<h3>Can I make it ahead?</h3>
<p>Yes. Assemble, refrigerate, bake later. Easy.</p>

<h3>Can I skip the [optional ingredient]?</h3>
<p>You can. But your conscience might side-eye you.</p>

<h3>Can I add [common addition]?</h3>
<p>Absolutely. This recipe loves new friends.</p>

{{IMAGE_7}}

<h2>Final Thoughts</h2>
<p>2-3 short paragraphs with friendly encouragement. Keep tone playful and motivating. End with something like "Now go impress someone, even if it's just yourself."</p>
<p>And yes, licking the spoon is technically optional… but highly recommended.</p>

CRITICAL GUIDELINES:
- Write 1000-1200 words
- Use ALL 7 image placeholders: {{IMAGE_1}} through {{IMAGE_7}}
- Keep it FUN, conversational, like a friend sharing a recipe
- Use proper H1, H2, H3 headings hierarchy
- No emojis except ❌ for mistakes and 👉 for tips
- Output clean HTML only
- Include the focus keyword naturally 8-12 times throughout`;

    const articlePrompt = `RECIPE TOPIC: "${seoTitle}"
FOCUS KEYWORD: "${focusKeyword}"

Write a FUN, CONVERSATIONAL (1000-1200 words), SEO-optimized recipe article following the exact structure above. 
- Be playful, use humor, talk like a friend
- Include the focus keyword "${focusKeyword}" naturally 8-12 times
- Include ALL 7 image placeholders: {{IMAGE_1}}, {{IMAGE_2}}, {{IMAGE_3}}, {{IMAGE_4}}, {{IMAGE_5}}, {{IMAGE_6}}, {{IMAGE_7}}
- Keep paragraphs SHORT and punchy
- Make it genuinely fun to read!`;

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
