import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PROMPT = `You're a Pinterest content writer optimizing blog posts for maximum search visibility and clicks.

For this blog post URL, write:

1. A Pinterest title (under 80 characters) that starts with an emoji and includes the main keyword

2. A Pinterest description (EXACTLY 3 sentences, NO MORE) that clearly summarizes the post

CRITICAL RULES FOR DESCRIPTION:
- EXACTLY 3 sentences (not 4, not 5, just 3)
- Main keyword must appear in the first sentence
- Bold 3-4 searchable SEO keywords using **keyword** syntax (choose the most relevant ones)
- Be concise and punchy - every word must count
- Focus on benefits and what readers will learn/get
- Keywords should flow naturally, not feel forced

Blog post URL: \${url}\${interestsNote}

Format your response EXACTLY like this example:

🥗 Vegan Buddha Bowl – Clean, Colorful, and Fully Customizable

This **vegan Buddha bowl** is packed with **plant-based ingredients**, quinoa, and roasted vegetables. Perfect for **meal prep** or a quick **healthy lunch**. Customizable, colorful, and delicious!

Generate the title and description now (remember: EXACTLY 3 sentences):`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { urls, interests, customPrompt } = await req.json();
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      throw new Error("URLs array is required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const results = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const urlInterests = interests?.[i] || '';
      
      try {
        const interestsNote = urlInterests ? `\n\nAnnotated interests: ${urlInterests}` : '';
        
        // Use custom prompt or default
        let prompt = customPrompt || DEFAULT_PROMPT;
        prompt = prompt.replace(/\$\{url\}/g, url);
        prompt = prompt.replace(/\$\{interestsNote\}/g, interestsNote);

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
                role: "user",
                content: prompt,
              },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error(`AI request failed: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim() || '';
        
        // Parse the response - split by double newline to separate title from description
        const lines = content.split('\n').filter((l: string) => l.trim());
        const title = lines[0] || '';
        const description = lines.slice(1).join(' ').trim();

        results.push({
          url,
          title,
          description,
        });
      } catch (error: unknown) {
        console.error(`Error processing URL ${url}:`, error);
        const slug = url.split('/').pop()?.replace(/-/g, ' ') || 'recipe';
        results.push({
          url,
          title: `🍴 ${slug.charAt(0).toUpperCase() + slug.slice(1)}`,
          description: `Discover this amazing ${slug} recipe with simple ingredients and easy steps. Perfect for any occasion!`,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return new Response(JSON.stringify({ success: true, titles: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in generate-pinterest-title:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
