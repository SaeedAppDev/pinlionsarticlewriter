import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { articleContent, focusKeyword } = await req.json();

    if (!articleContent) {
      throw new Error("Article content is required");
    }

    console.log(`🔧 Starting article rewrite for keyword: ${focusKeyword || 'N/A'}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert content editor specializing in rewriting articles to be more engaging, SEO-optimized, and human-sounding. Your job is to completely transform low-quality articles into high-performing content.

=== OBJECTIVE ===
Completely rewrite the article to improve clarity, engagement, formatting, and SEO. Use a natural, informal tone as if you're chatting with a friend who's genuinely curious about the topic.

=== TONE, STYLE & VOICE REQUIREMENTS ===

CONVERSATIONAL AND INFORMAL:
- Write like you're talking to a friend—casual, fun, and engaging.
- Use simple, everyday language. Ditch anything that sounds stiff or academic.
- Keep the flow natural—like you're telling a story or giving advice.

LIGHT HUMOR AND SARCASM (Sprinkle, Don't Soak):
- Use light, witty sarcasm or humor to make the piece more enjoyable.
- Use it sparingly—just enough to give personality without distracting from the info.

PERSONAL OPINIONS AND REAL TALK:
- Add your own experiences or commentary if relevant.
- Give honest takes, not just surface-level rewrites.

ACTIVE VOICE ONLY:
- Every. Single. Sentence.
- Say: "I love this tip."
- Not: "This tip is loved by many."
- Double-check for passive voice and convert it to active.

USE OF SLANG & EMOTICONS (in moderation):
- Toss in occasional internet lingo (e.g., FYI, IMO, etc.)
- Add up to 2–3 emoticons, like ":)" or ":/"
- Keep it casual, but not chaotic.

=== STRUCTURE & FORMATTING ===

SHORT, SNAPPY INTRO:
- Hook the reader fast—skip generic intros like "In today's world…"
- Address the reader's need/pain point ASAP.
- If possible, add a personal anecdote or opinion.

CLEAR HEADINGS & SUBHEADINGS:
- Use H2s for main sections, H3s for subtopics.
- Make them clear, keyword-rich, and guide the reader through the article.

PARAGRAPH STYLE:
- Keep paras short and punchy (3–4 sentences max).
- Focus each paragraph on a single idea.
- No walls of text—especially for mobile readers.

LISTS & BULLETS:
- Use bullet points or numbered lists to break up dense info.
- Great for comparisons, features, or how-tos.

BOLD KEY INFO:
- Bold important takeaways, stats, or phrases.
- Helps readers quickly scan and absorb the juicy stuff.

=== SEO & CONTENT QUALITY ===

CLARITY IS KING:
- Cut the fluff.
- No filler lines like "let's dive in" or "in modern times…"
- Every sentence should pull its weight.

COMPARISONS & COMMENTARY:
- Add clear comparisons (pros/cons, features, opinions).
- Use personal examples or relatable situations where possible.

NATURAL SEO OPTIMIZATION:
- Make sure keywords related to the topic appear naturally.
- Don't stuff them. Focus on readability and flow first.
${focusKeyword ? `- Include the focus keyword "${focusKeyword}" naturally 8-12 times throughout.` : ''}

NO AI FLUFF:
- If it sounds generic or "AI-like," rework it.
- Replace bland phrases with something fresh, witty, or personal.

=== CONCLUSION REQUIREMENTS ===
- Wrap it up with a quick summary of the main takeaways.
- End with a fun or encouraging note to leave a strong impression.
- Include a call-to-action or reflection (e.g., "What do you think?" / "Give it a shot!")

=== OUTPUT FORMAT ===
- Return clean HTML only
- Keep all image placeholders ({{IMAGE_X}}) intact if present
- Keep any <a href="#recipe-card"> links intact
- Maintain proper H1, H2, H3 heading hierarchy
- Output should be similar length or longer than the original`;

    const userPrompt = `Rewrite the following article using the detailed instructions in your system prompt. The new version should be engaging, clear, and SEO-optimized while keeping a conversational and human tone.

${focusKeyword ? `FOCUS KEYWORD: "${focusKeyword}" (include naturally 8-12 times)` : ''}

ORIGINAL ARTICLE:
${articleContent}

Remember:
- Keep all image placeholders ({{IMAGE_X}}) exactly as they are
- Keep any recipe card links intact
- Maintain proper heading hierarchy
- Make it sound like a human wrote it, not AI
- Add personality, humor, and personal touches
- Use active voice throughout
- Bold key information
- Keep paragraphs short (3-4 sentences max)
- Add rhetorical questions to engage readers`;

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
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please wait a moment and try again.");
      }
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const rewrittenContent = data.choices?.[0]?.message?.content || '';

    if (!rewrittenContent) {
      throw new Error("No content generated");
    }

    console.log('✅ Article rewritten successfully');

    return new Response(JSON.stringify({ 
      success: true,
      rewrittenContent 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fix-article function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
