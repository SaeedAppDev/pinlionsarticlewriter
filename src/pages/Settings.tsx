import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Save, FileText, List, Code, Image as ImageIcon, Check, RotateCcw, Wand2, Plus, Trash2, Edit2, Sparkles } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { supabase } from '@/integrations/supabase/client';

interface ApiSettings {
  openai_api_key: string;
  replicate_api_token: string;
  replicate_model: string;
}

const replicateModels = [
  { value: 'google-nano-banana-pro', label: 'Nano Banana Pro', model_id: 'google/gemini-2.5-flash-image-preview', description: 'Balanced quality & speed (est. $0.02/ image)', gradient: 'from-amber-400 to-orange-500', bgGradient: 'from-amber-200 via-yellow-200 to-orange-200', icon: 'NB', link: 'https://replicate.com/google/nano-banana-pro' },
  { value: 'z-image-turbo', label: 'Z-Image Turbo', model_id: 'prunaai/z-image-turbo', description: 'Ultra fast drafts (est. $0.01/ image)', gradient: 'from-teal-400 to-cyan-500', bgGradient: 'from-teal-200 via-cyan-200 to-emerald-200', icon: 'ZT', link: 'https://replicate.com/prunaai/z-image-turbo' },
  { value: 'seedream-4.5', label: 'Seedream 4.5', model_id: 'bytedance/seedream-4.5', description: 'High detail (est. $0.04/ image)', gradient: 'from-pink-400 to-purple-500', bgGradient: 'from-pink-200 via-purple-200 to-violet-200', icon: 'SD', link: 'https://replicate.com/bytedance/seedream-4.5' },
  { value: 'flux-schnell', label: 'FLUX Schnell', model_id: 'black-forest-labs/flux-schnell', description: 'Fast general-purpose (~$0.02/ image)', gradient: 'from-blue-400 to-indigo-500', bgGradient: 'from-blue-200 via-indigo-200 to-purple-200', icon: 'FS', link: 'https://replicate.com/black-forest-labs/flux-schnell' },
  { value: 'flux-dev', label: 'FLUX Dev', model_id: 'black-forest-labs/flux-dev', description: 'Higher quality, slower (mid-tier)', gradient: 'from-violet-400 to-purple-500', bgGradient: 'from-violet-200 via-purple-200 to-fuchsia-200', icon: 'FD', link: 'https://replicate.com/black-forest-labs/flux-dev' },
  { value: 'flux-pro', label: 'FLUX Pro', model_id: 'black-forest-labs/flux-pro', description: 'Premium quality (higher cost)', gradient: 'from-rose-400 to-red-500', bgGradient: 'from-rose-200 via-red-200 to-orange-200', icon: 'FP', link: 'https://replicate.com/black-forest-labs/flux-pro' },
];

const imageGenModels = [
  { value: 'z-image-turbo', label: 'Z-Image Turbo (Pruna AI)', description: '$0.01 per image (cheap & very fast)' },
  { value: 'seedream-4.5', label: 'Seedream 4.5 (ByteDance)', description: '$0.04 per image (high quality)' },
];

const inTextImageCounts = [
  { value: '2', label: '2 Images' },
  { value: '3', label: '3 Images' },
  { value: '4', label: '4 Images' },
  { value: '5', label: '5 Images' },
  { value: '6', label: '6 Images' },
];

const aspectRatios = [
  { value: '9:16', label: '9:16 – Vertical (Portrait)' },
  { value: '16:9', label: '16:9 – Horizontal (Landscape)' },
  { value: '1:1', label: '1:1 – Square' },
  { value: '4:3', label: '4:3 – Standard' },
];

const defaultClassicPrompt = `Write an engaging, conversational article about "{title}". 

Target length: Around 1000 words.

STRUCTURE:

1. Start with a short, punchy introduction (3-4 sentences) that immediately gets to the point. Hook the reader fast. No generic phrases like "In today's world..." or "In modern times...". Do NOT include any H1 title - start directly with the introduction paragraph.

3. Create 5-7 main content sections using <h2> headings. Let the headings flow naturally based on the topic - don't force a template. Choose headings that make sense for this specific article topic.

4. After some sections, include H3 subsections where it makes sense for deeper dives into specific points.

5. Include an FAQ section with 4-6 questions formatted as <h3> tags, with answers in paragraphs.

6. End with a brief conclusion section using an <h2> tag.

TONE & STYLE:

- Conversational and informal - write like you are chatting with a friend or fellow enthusiast

- Approachable, light-hearted, and occasionally sarcastic (but do not overdo the sarcasm)

- Use active voice only - avoid passive constructions entirely

- Keep paragraphs SHORT (3-4 sentences max) - make it scannable

- Use rhetorical questions to engage readers and break up text

- Sprinkle in internet slang sparingly: "FYI", "IMO" (2-3 times max per article)

- Include occasional humor to keep things fun

- Personal opinions and commentary when appropriate

- Bold key information with <strong> tags (but NOT in the introduction)

FORMATTING:

- Use proper HTML: <h2> for main sections, <h3> for subsections

- Use lists when appropriate: <ul> with <li> for bullets, <ol> with <li> for numbered

- Break down technical details into easy-to-read lists

- Avoid dense blocks of text

- NO Markdown, code fences, or backticks

- No extraneous preamble before content starts

The article should feel like a friendly conversation with someone experienced who does not take themselves too seriously.`;

const listicleCategories = [
  { value: 'default', label: 'Default (General)', icon: '⭐' },
  { value: 'home-decor', label: 'Home Decor', icon: '🏠' },
  { value: 'fashion', label: 'Fashion', icon: '👗' },
  { value: 'food', label: 'Food & Recipes', icon: '🍳' },
  { value: 'travel', label: 'Travel', icon: '✈️' },
  { value: 'tech', label: 'Technology', icon: '💻' },
  { value: 'health', label: 'Health & Wellness', icon: '💪' },
];

const defaultListiclePrompts: Record<string, string> = {
  'default': `CRITICAL: Start your response with an <h1> title tag. Do NOT start with anything else.

Write a conversational, friendly listicle article about: "{title}". 

Target length: approximately 1500 words.

CRITICAL: Create EXACTLY {itemCount} numbered sections - no more, no less. The title specifies {itemCount} items, so deliver exactly that many.

FIRST LINE MUST BE: An <h1> title that is MORE VIRAL than the original:

   - Maximum 15 words

   - MUST include the exact core phrase from the original title (e.g., if original is "5 Home Decor Ideas", the new title MUST contain "5 Home Decor Ideas")

   - Add compelling words to make it click-worthy and engaging

   - Use proper title case capitalization (First Letter Of Each Major Word Capitalized)

   - CRITICAL: Do NOT just capitalize the original title - ADD engaging words!

   - Example: Original "5 Home Decor Ideas" becomes "5 Home Decor Ideas That Will Make Your Friends Jealous"

2. Follow with a short, punchy introduction (3-4 sentences) that immediately gets to the point. Hook the reader fast with why these items are amazing. No generic phrases like "In today is world..." or "In modern times...". Jump straight into something that grabs attention.

3. Create EXACTLY {itemCount} numbered sections using <h2> headings with creative names (like "1. Layer Textures Like a Pro" instead of boring titles).

4. For EACH section, include:

   - A brief intro paragraph (2-3 sentences) explaining why this item is awesome

   - Use <h3> subsections when helpful (like "Key Points", "Tips", "Materials") but only where it makes sense

   - Include occasional <ul> lists for key elements when it helps with scannability

   - Mix short paragraphs with practical information

   - End with a brief note about benefits, applications, or when to use this

5. End with a brief, encouraging conclusion (2-3 sentences) that makes readers excited to try these ideas.

TONE & STYLE:

- Conversational and informal - write like you are chatting with a friend who loves trying new things

- Approachable, light-hearted, and occasionally sarcastic (but do not overdo the sarcasm)

- Use active voice only - avoid passive constructions entirely

- Keep paragraphs SHORT (2-3 sentences max) - make it scannable

- Use rhetorical questions to engage readers and break up text

- Sprinkle in internet slang sparingly: "FYI", "IMO", "trust me", "seriously" (2-3 times max per article)

- Include occasional humor to keep things fun

- Personal opinions and commentary when appropriate

- Bold key terms and important phrases with <strong> tags (but NOT in the introduction)

FORMATTING:

- Use proper HTML: <h1> for title, <h2> for numbered items, <h3> for subsections when helpful

- Use <ul> with <li> for lists of key elements

- Use <p> for paragraphs

- Break up content with vivid descriptions and specific details

- Avoid dense blocks of text

- NO Markdown, code fences, or backticks (##, -, *, etc.)

- No extraneous preamble before content starts

The article should feel like getting advice from your most knowledgeable friend who does not take themselves too seriously.

EXAMPLE FORMAT:

<h1>5 Home Decor Ideas That Will Make Your Friends Jealous</h1>

<p>Ready to transform your space without breaking the bank? These ideas are about to become your new obsession.</p>

<h2>1. Layer Textures Like a Pro</h2>

<p>Want that cozy vibe everyone is obsessed with? It is all about layering different textures.</p>

<h3>Key Materials:</h3>

<ul>

<li>Turkish towels with tassels</li>

<li>Cotton rug (2x3 or runner)</li>

<li>Linen throw pillows</li>

</ul>

<p>Mix and match different fabrics to create depth. Trust me, your space will instantly feel more expensive.</p>`,
  'home-decor': `Write a conversational, friendly home decor article showcasing: "{title}".

Target length: approximately 1500 words.

CRITICAL: Present EXACTLY {itemCount} completely different and distinct room designs - no more, no less. Each section must showcase a unique, complete design concept.

STRUCTURE:

1. Start with an engaging <h1> title that is more viral than the original:

   - Maximum 15 words

   - MUST include the exact core phrase from the original title

   - Use proper title case capitalization

   - Make it click-worthy and engaging while keeping the SEO keywords

   - Example: Original "7 Bedroom Ideas" becomes "7 Stunning Bedroom Ideas That Will Transform Your Sleep Space"

2. Follow with a short, punchy introduction (3-4 sentences) that immediately gets to the point. Hook the reader fast with why these designs are amazing. No generic phrases like "In today is world..." or "In modern times...". Jump straight into something that grabs attention.

3. Create EXACTLY {itemCount} numbered design sections using <h2> headings, each naming a specific, complete design concept (like "1. Moody Maximalist Paradise With Jewel Tones" instead of boring titles).

4. For EACH design section, describe the complete room vision naturally:

   - Start with a brief intro paragraph (2-3 sentences) painting the overall picture and mood

   - Describe specific details about colors, furniture, textiles, and decor that make this design unique

   - Use <h3> subsections when helpful (like "Color Palette", "Key Pieces", "Styling Tips") but only where it makes sense

   - Include occasional <ul> lists for key elements when it helps with scannability

   - End with a brief note about the vibe, who would love this, or when to use this style

5. End with a brief, encouraging conclusion (2-3 sentences) that inspires readers to try these designs.

TONE & STYLE:

- Conversational and informal - write like you are showing off your favorite room designs to a friend who loves home decor

- Approachable, light-hearted, and occasionally sarcastic about design trends (but do not overdo the sarcasm)

- Use active voice only - avoid passive constructions entirely

- Keep paragraphs SHORT (2-3 sentences max) - make it scannable

- Use rhetorical questions to engage readers and break up text

- Sprinkle in internet slang sparingly: "FYI", "IMO", "trust me", "seriously" (2-3 times max per article)

- Include occasional humor to keep things fun

- Personal opinions and commentary when appropriate

- Bold key design terms, colors, and furniture pieces with <strong> tags (but NOT in the introduction)

FORMATTING:

- Use proper HTML: <h1> for title, <h2> for numbered designs, <h3> for subsections when helpful

- Use <ul> with <li> for lists of key elements/materials

- Use <p> for paragraphs

- Break up content with vivid descriptions and specific details

- Avoid dense blocks of text

- NO Markdown, code fences, or backticks (##, -, *, etc.)

- No extraneous preamble before content starts

The article should feel like a friendly house tour with someone who has impeccable taste and does not take themselves too seriously.

EXAMPLE FORMAT:

<h1>7 Stunning Bedroom Ideas That Will Transform Your Sleep Space</h1>

<p>Ready to fall in love with your bedroom all over again? These design concepts will make you want to spend all day in bed (and not just for sleep).</p>

<h2>1. Moody Maximalist Paradise With Jewel Tones</h2>

<p>Deep emerald walls meet gold accents in this dramatic sanctuary. Think velvet, brass, and layers upon layers of texture.</p>

<h3>Key Pieces:</h3>

<ul>

<li>Velvet tufted headboard in jewel tones (emerald or sapphire)</li>

<li>Layered Persian and Moroccan rugs</li>

<li>Brass pendant lights and table lamps</li>

</ul>

<p>This look is perfect if you want your bedroom to feel like a luxe hotel suite. Bold, dramatic, and unapologetically extra.</p>`,
  'fashion': `Write a conversational, friendly fashion outfit listicle article about: "{title}". 

Target length: approximately 1500 words.

CRITICAL: Create EXACTLY {itemCount} numbered outfit sections - no more, no less. The title specifies {itemCount} outfits, so deliver exactly that many.

STRUCTURE:

1. Start with an engaging <h1> title that is more viral than the original:

   - Maximum 15 words

   - MUST include the exact core phrase from the original title (e.g., if original is "8 Fall Outfits for Women", the new title MUST contain "8 Fall Outfits for Women")

   - Use proper title case capitalization (First Letter Of Each Major Word Capitalized)

   - Make it click-worthy and engaging while keeping the SEO keywords

   - Example: Original "8 Fall Outfits for Women" becomes "8 Fall Outfits for Women That Will Make You Love Sweater Weather"

2. Follow with a short, punchy introduction (3-4 sentences) that immediately gets to the point. Hook the reader fast with why these outfits are amazing. No generic phrases like "In today is fashion world..." or "In modern times...". Jump straight into something that grabs attention.

3. Create EXACTLY {itemCount} numbered outfit sections using <h2> headings with creative outfit names (like "1. Cozy Oversized Sweater Combo That Will Make You Ditch Your Entire Wardrobe" instead of boring titles).

4. For EACH outfit section, include:

   - A brief intro paragraph (2-3 sentences) explaining why this outfit is amazing (what makes it special, where to wear it, why people love it)

   - <h3>Outfit Pieces:</h3> section with a bulleted <ul> list of all clothing items and accessories (e.g., oversized cream knit sweater, high-waisted black jeans, ankle boots, gold layered necklaces)

   - <h3>Styling Tips:</h3> section with specific advice on how to wear and style the outfit, fit guidance, and how to accessorize

   - A closing paragraph with occasion suggestions, variations, or pro styling tips

5. End with a brief, encouraging conclusion (2-3 sentences) that makes readers excited to try these outfits.

TONE & STYLE:

- Conversational and informal - write like you are chatting with a fashion-forward friend who loves putting together great outfits

- Approachable, light-hearted, and occasionally sarcastic about fashion trends (but do not overdo the sarcasm)

- Use active voice only - avoid passive constructions entirely

- Keep paragraphs SHORT (2-3 sentences max) - make it scannable

- Use rhetorical questions to engage readers and break up text

- Sprinkle in internet slang sparingly: "FYI", "IMO", "trust me", "seriously" (2-3 times max per article)

- Include occasional humor to keep things fun

- Personal opinions and commentary when appropriate

- Bold key style terms and clothing items with <strong> tags (but NOT in the introduction)

FORMATTING:

- Use proper HTML: <h1> for title, <h2> for numbered outfits, <h3> for Outfit Pieces/Styling Tips subsections

- Use <ul> with <li> for outfit pieces lists

- Use <p> for paragraphs

- Break down outfits into easy-to-read lists

- Avoid dense blocks of text

- NO Markdown, code fences, or backticks (##, -, *, etc.)

- No extraneous preamble before content starts

IMPORTANT CONTENT RESTRICTIONS:

- NEVER use the word "nude" or "naked" in any context

- For neutral/beige colors, use alternative terms like: "beige", "tan", "cream", "camel", "sand", "neutral", "skin-tone", "natural"

- Keep all content family-friendly and appropriate

The article should feel like getting fashion advice from your most stylish friend who does not take themselves too seriously.

EXAMPLE FORMAT:

<h1>8 Fall Outfits For Women That Will Make You Love Sweater Weather</h1>

<p>Ready to turn sidewalk into your personal runway? These fall outfits are about to become your new wardrobe essentials.</p>

<h2>1. Cozy Oversized Sweater Combo That Will Make You Ditch Your Entire Wardrobe</h2>

<p>This outfit is pure comfort meets style gold. Seriously, you will want to wear this every single day.</p>

<h3>Outfit Pieces:</h3>

<ul>

<li>Oversized cream knit sweater</li>

<li>High-waisted black jeans</li>

<li>Tan ankle boots</li>

<li>Gold layered necklaces</li>

</ul>

<h3>Styling Tips:</h3>

<p>Tuck just the front corner of your sweater for that effortlessly chic vibe. Roll up the sleeves halfway to show off those layered necklaces.</p>

<p>Perfect for coffee runs, casual Fridays, or weekend brunches. Trust me on this one.</p>`,
  'food': `Write a conversational, friendly food recipe article about: "{title}". 

Target length: approximately 1500 words.

CRITICAL: Create EXACTLY {itemCount} numbered recipe sections - no more, no less. The title specifies {itemCount} recipes, so deliver exactly that many.

STRUCTURE:

1. Start with an engaging <h1> title that is more viral than the original:

   - Maximum 15 words

   - MUST include the exact core phrase from the original title (e.g., if original is "8 Italian Salads", the new title MUST contain "8 Italian salads")

   - Use proper title case capitalization (First Letter Of Each Major Word Capitalized)

   - Make it click-worthy and engaging while keeping the SEO keywords

   - Example: Original "8 Italian Salads to Try" becomes "8 Italian Salads That Will Transport You to Tuscany"

2. Follow with a short, punchy introduction (3-4 sentences) that immediately gets to the point. Hook the reader fast with why these recipes are amazing. No generic phrases like "In today is culinary world..." or "In modern times...". Jump straight into something that grabs attention.

3. Create EXACTLY {itemCount} numbered recipe sections using <h2> headings with creative names (like "1. Tuscan Panzanella That Will Ruin Store-Bought Salads Forever" instead of boring titles).

4. For EACH recipe section, include:

   - A brief intro paragraph (2-3 sentences) explaining why this recipe is awesome (what makes it special, when to serve it, why people love it)

   - <h3>Ingredients:</h3> section with a bulleted <ul> list of all ingredients with measurements

   - <h3>Instructions:</h3> section with numbered <ol> steps that are clear and easy to follow

   - A closing paragraph with serving suggestions, variations, or pro tips

5. End with a brief, encouraging conclusion (2-3 sentences) that makes readers excited to try these recipes.

TONE & STYLE:

- Conversational and informal - write like you are chatting with a foodie friend who loves trying new recipes

- Approachable, light-hearted, and occasionally sarcastic about food (but do not overdo the sarcasm)

- Use active voice only - avoid passive constructions entirely

- Keep paragraphs SHORT (2-3 sentences max) - make it scannable

- Use rhetorical questions to engage readers and break up text

- Sprinkle in internet slang sparingly: "FYI", "IMO", "trust me", "seriously" (2-3 times max per article)

- Include occasional humor to keep things fun

- Personal opinions and commentary when appropriate

- Bold key cooking terms and ingredients with <strong> tags (but NOT in the introduction)

FORMATTING:

- Use proper HTML: <h1> for title, <h2> for numbered recipes, <h3> for Ingredients/Instructions subsections

- Use <ul> with <li> for ingredients lists

- Use <ol> with <li> for numbered instruction steps

- Use <p> for paragraphs

- Break down recipes into easy-to-read lists and steps

- Avoid dense blocks of text

- NO Markdown, code fences, or backticks (##, -, *, etc.)

- No extraneous preamble before content starts

The article should feel like a friendly conversation with your most food-savvy friend who does not take themselves too seriously.

EXAMPLE FORMAT:

<h1>8 Italian Salads That Will Transport You To Tuscany</h1>

<p>Ready to make your taste buds do a happy dance? These Italian salads are about to become your new obsession.</p>

<h2>1. Tuscan Panzanella That Will Ruin Store-Bought Salads Forever</h2>

<p>This bread salad is summer in a bowl. Seriously, once you try this, you will never look at regular salad the same way.</p>

<h3>Ingredients:</h3>

<ul>

<li>4 cups day-old bread, cubed</li>

<li>6 ripe tomatoes, chopped</li>

<li>1/2 cup olive oil</li>

</ul>

<h3>Instructions:</h3>

<ol>

<li>Toast bread cubes until golden.</li>

<li>Toss with tomatoes and dressing.</li>

<li>Let sit for 10 minutes so bread soaks up all that goodness.</li>

</ol>

<p>Serve this at your next summer BBQ and watch it disappear. Trust me.</p>`,
  'travel': `Write an inspiring travel article about: "{title}".
Target length: approximately 1500 words.

CRITICAL: Present EXACTLY {itemCount} different destinations or travel tips.

Include practical advice, local insights, and an FAQ section.`,
  'tech': `Write an informative tech article about: "{title}".
Target length: approximately 1500 words.

CRITICAL: Present EXACTLY {itemCount} different products or solutions.

Include specs, pros/cons, and an FAQ section.`,
  'health': `Write a helpful health & wellness article about: "{title}".
Target length: approximately 1500 words.

CRITICAL: Present EXACTLY {itemCount} different tips or methods.

Include science-backed information and an FAQ section.`,
};

const Settings = () => {
  const [openaiKey, setOpenaiKey] = useState('');
  const [replicateToken, setReplicateToken] = useState('');
  const [replicateModel, setReplicateModel] = useState('google-nano-banana-pro');
  const [imageGenModel, setImageGenModel] = useState('z-image-turbo');
  const [generateInTextImages, setGenerateInTextImages] = useState(true);
  const [inTextImageCount, setInTextImageCount] = useState('4');
  const [inTextAspectRatio, setInTextAspectRatio] = useState('9:16');
  const [classicPrompt, setClassicPrompt] = useState(defaultClassicPrompt);
  const [selectedListicleCategory, setSelectedListicleCategory] = useState('default');
  const [listiclePrompts, setListiclePrompts] = useState<Record<string, string>>(defaultListiclePrompts);
  const [customPrompts, setCustomPrompts] = useState<Array<{ id: string; name: string; prompt_text: string }>>([]);
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptText, setNewPromptText] = useState('');
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [showAddPrompt, setShowAddPrompt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load API settings
      const { data: apiData } = await supabase
        .from('user_api_settings')
        .select('openai_api_key, replicate_api_token, replicate_model')
        .eq('user_id', user.id)
        .single();

      if (apiData) {
        setOpenaiKey(apiData.openai_api_key || '');
        setReplicateToken(apiData.replicate_api_token || '');
        setReplicateModel(apiData.replicate_model || 'google-nano-banana-pro');
      }

      // Load classic prompt
      const { data: promptData } = await supabase
        .from('prompts')
        .select('prompt_text')
        .eq('user_id', user.id)
        .eq('type', 'classic')
        .maybeSingle();

      if (promptData) {
        setClassicPrompt(promptData.prompt_text);
      }

      // Load listicle prompts
      const { data: listicleData } = await supabase
        .from('prompts')
        .select('niche, prompt_text')
        .eq('user_id', user.id)
        .eq('type', 'listicle');

      if (listicleData && listicleData.length > 0) {
        const loadedPrompts = { ...defaultListiclePrompts };
        listicleData.forEach(item => {
          loadedPrompts[item.niche] = item.prompt_text;
        });
        setListiclePrompts(loadedPrompts);
      }

      // Load custom prompts
      const { data: customData } = await supabase
        .from('prompts')
        .select('id, niche, prompt_text')
        .eq('user_id', user.id)
        .eq('type', 'custom');

      if (customData && customData.length > 0) {
        setCustomPrompts(customData.map(item => ({
          id: item.id,
          name: item.niche,
          prompt_text: item.prompt_text
        })));
      }
    } catch (error) {
      // No settings yet, that's fine
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Save API settings
      const { error: apiError } = await supabase
        .from('user_api_settings')
        .upsert({
          user_id: user.id,
          openai_api_key: openaiKey,
          replicate_api_token: replicateToken,
          replicate_model: replicateModel,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (apiError) throw apiError;

      // Check if classic prompt exists
      const { data: existingPrompt } = await supabase
        .from('prompts')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'classic')
        .maybeSingle();

      if (existingPrompt) {
        // Update existing prompt
        const { error: promptError } = await supabase
          .from('prompts')
          .update({
            prompt_text: classicPrompt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPrompt.id);

        if (promptError) throw promptError;
      } else {
        // Insert new prompt
        const { error: promptError } = await supabase
          .from('prompts')
          .insert({
            user_id: user.id,
            type: 'classic',
            niche: 'general',
            prompt_text: classicPrompt,
          });

        if (promptError) throw promptError;
      }

      // Save listicle prompts
      for (const [niche, promptText] of Object.entries(listiclePrompts)) {
        const { data: existingListicle } = await supabase
          .from('prompts')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'listicle')
          .eq('niche', niche)
          .maybeSingle();

        if (existingListicle) {
          await supabase
            .from('prompts')
            .update({
              prompt_text: promptText,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingListicle.id);
        } else {
          await supabase
            .from('prompts')
            .insert({
              user_id: user.id,
              type: 'listicle',
              niche: niche,
              prompt_text: promptText,
            });
        }
      }

      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const getSelectedModelLabel = () => {
    const model = replicateModels.find(m => m.value === replicateModel);
    return model ? `${model.label} ${model.description}` : 'Select a model';
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-foreground">Settings</h1>
        <p className="text-muted-foreground">
          Configure your API keys and generation preferences
        </p>
      </div>

      {/* Currently Active Prompts */}
      <Card className="p-6 mb-6 bg-card border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <h3 className="font-semibold text-foreground">Currently Active Prompts</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Both prompts are shown below. Edit them separately in their own sections.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Classic Articles Card */}
          <Card className="p-4 border-border hover:border-primary/50 transition-colors cursor-pointer">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Classic Articles
              </span>
            </div>
            <h4 className="font-semibold text-primary mb-1">Classic Article Prompt</h4>
            <p className="text-sm text-muted-foreground">Always uses classic article prompt</p>
          </Card>

          {/* Listicle Articles Card */}
          <Card className="p-4 border-primary bg-primary/5 cursor-pointer">
            <div className="flex items-center gap-2 mb-2">
              <List className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                Listicle Articles
              </span>
            </div>
            <h4 className="font-semibold text-primary mb-1">Home Decor Listicle</h4>
            <p className="text-sm text-muted-foreground">Currently selected listicle category</p>
          </Card>
        </div>
      </Card>

      {/* API Configuration */}
      <Card className="p-6 mb-6 bg-card border-border">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <Code className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">API Configuration</h3>
            <p className="text-sm text-muted-foreground">Article + Image generation providers</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Enter your API keys below. OpenAI will be used for article generation and Replicate for image generation.
        </p>

        <div className="space-y-6">
          {/* OpenAI API Key */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              OpenAI API Key (Articles)
            </label>
            <Input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="Enter your OpenAI API key"
              className="bg-card"
            />
          </div>

          {/* Replicate API Token */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Replicate API Token (Images)
            </label>
            <Input
              type="password"
              value={replicateToken}
              onChange={(e) => setReplicateToken(e.target.value)}
              placeholder="Enter your Replicate API token"
              className="bg-card"
            />
            <p className="text-xs text-muted-foreground">
              Your Replicate API token for image generation models. Get yours at{' '}
              <a href="https://replicate.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                replicate.com
              </a>
            </p>
          </div>

          {/* Replicate Image Model - Only show when API token is entered */}
          {replicateToken && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Replicate Image Model
                </label>
                <Select value={replicateModel} onValueChange={setReplicateModel}>
                  <SelectTrigger className="bg-card">
                    <SelectValue placeholder="Select a model">
                      {getSelectedModelLabel()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {replicateModels.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        <div className="flex items-center gap-2">
                          {replicateModel === model.value && <Check className="w-4 h-4" />}
                          <span>{model.label}</span>
                          <span className="text-muted-foreground">{model.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Pricing is approximate and based on public Replicate listings; always confirm in your Replicate dashboard.
                </p>
              </div>

              {/* Model Preview Cards */}
              <div className="grid md:grid-cols-3 gap-4">
                {replicateModels.slice(0, 6).map((model) => {
                  const isActive = replicateModel === model.value;
                  return (
                    <Card 
                      key={model.value}
                      className={`p-4 cursor-pointer transition-all duration-300 relative overflow-hidden ${
                        isActive 
                          ? 'border-primary border-2 shadow-lg shadow-primary/20 scale-[1.02]' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setReplicateModel(model.value)}
                    >
                      {/* Active Badge */}
                      {isActive && (
                        <div className="absolute top-2 right-2 animate-fade-in">
                          <div className="flex items-center gap-1.5 bg-gradient-to-r from-primary to-purple-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">
                            <Check className="w-3 h-3" />
                            <span className="tracking-wide uppercase">Activated</span>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-r ${model.gradient} flex items-center justify-center text-xs font-bold text-white ${isActive ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                          {model.icon}
                        </div>
                        <span className={`font-medium ${isActive ? 'text-primary' : 'text-foreground'}`}>
                          {model.label}
                        </span>
                      </div>
                      
                      <div className={`h-16 rounded-lg bg-gradient-to-r ${model.bgGradient} mb-3 transition-all duration-300 ${isActive ? 'ring-2 ring-primary/30' : ''}`} />
                      
                      <p className="text-xs text-muted-foreground">
                        {model.description}
                      </p>
                      
                      <button
                        className="mt-2 text-xs text-primary hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(model.link, '_blank');
                        }}
                      >
                        View on Replicate →
                      </button>
                    </Card>
                  );
                })}
              </div>
            </>
          )}

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="gradient-button text-white border-0"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save API Settings'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Image Settings */}
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-pink-500" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Image Settings</h3>
          </div>
        </div>

        <div className="space-y-6">
          {/* Image Generation Model */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Image Generation Model
            </label>
            <Select value={imageGenModel} onValueChange={setImageGenModel}>
              <SelectTrigger className="bg-card">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {imageGenModels.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label} – {model.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose the AI model for generating featured and in-text images (pricing shown per image)
            </p>
          </div>

          {/* Generate In-Text Images Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="generateInTextImages" 
              checked={generateInTextImages}
              onCheckedChange={(checked) => setGenerateInTextImages(checked as boolean)}
            />
            <label
              htmlFor="generateInTextImages"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Generate in-text images
            </label>
          </div>

          {/* Number and Aspect Ratio Row */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Number of In-Text Images */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Number of In-Text Images
              </label>
              <Select value={inTextImageCount} onValueChange={setInTextImageCount}>
                <SelectTrigger className="bg-card">
                  <SelectValue placeholder="Select count" />
                </SelectTrigger>
                <SelectContent>
                  {inTextImageCounts.map((count) => (
                    <SelectItem key={count.value} value={count.value}>
                      {count.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Images will be placed throughout the article at strategic H2 positions
              </p>
            </div>

            {/* In-Text Image Aspect Ratio */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                In-Text Image Aspect Ratio
              </label>
              <Select value={inTextAspectRatio} onValueChange={setInTextAspectRatio}>
                <SelectTrigger className="bg-card">
                  <SelectValue placeholder="Select ratio" />
                </SelectTrigger>
                <SelectContent>
                  {aspectRatios.map((ratio) => (
                    <SelectItem key={ratio.value} value={ratio.value}>
                      {ratio.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose vertical (9:16) for portrait-style images or horizontal (16:9) for landscape-style images
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Classic Article Prompt */}
      <Card className="p-6 mt-6 bg-card border-border">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Classic Article Prompt</h3>
              <p className="text-sm text-muted-foreground">Used for standard article generation</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setClassicPrompt(defaultClassicPrompt)}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Default
          </Button>
        </div>

        <div className="space-y-4">
          <label className="text-sm font-medium text-foreground">
            Custom AI Prompt
          </label>
          <Textarea
            value={classicPrompt}
            onChange={(e) => setClassicPrompt(e.target.value)}
            className="min-h-[300px] font-mono text-sm bg-card resize-y"
            placeholder="Enter your custom prompt..."
          />
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <span className="text-base">📝</span>
              <span><strong>How to use:</strong> This prompt controls how classic articles are generated.</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="text-base">💡</span>
              <span><strong>Placeholder:</strong> Use <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{'{title}'}</code> where you want the article title inserted.</span>
            </p>
          </div>
        </div>
      </Card>

      {/* Listicle Prompts */}
      <Card className="p-6 mt-6 bg-card border-border">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <List className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Listicle Prompts</h3>
              <p className="text-sm text-muted-foreground">Select category and customize its prompt</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setListiclePrompts(prev => ({
                ...prev,
                [selectedListicleCategory]: defaultListiclePrompts[selectedListicleCategory]
              }));
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Default
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Listicle Category
            </label>
            <Select value={selectedListicleCategory} onValueChange={setSelectedListicleCategory}>
              <SelectTrigger className="bg-card">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {listicleCategories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex items-center gap-2">
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              This category will be used for all listicle article generation. Edit its prompt below.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Custom AI Prompt for {listicleCategories.find(c => c.value === selectedListicleCategory)?.label}
            </label>
            <Textarea
              value={listiclePrompts[selectedListicleCategory] || ''}
              onChange={(e) => setListiclePrompts(prev => ({
                ...prev,
                [selectedListicleCategory]: e.target.value
              }))}
              className="min-h-[300px] font-mono text-sm bg-card resize-y"
              placeholder="Enter your custom listicle prompt..."
            />
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <span className="text-base">📝</span>
              <span><strong>How to use:</strong> This prompt controls how {listicleCategories.find(c => c.value === selectedListicleCategory)?.label.toLowerCase()} listicles are generated.</span>
            </p>
            <p className="flex items-center gap-2">
              <span className="text-base">💡</span>
              <span>
                <strong>Placeholders:</strong> Use{' '}
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{'{title}'}</code> and{' '}
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{'{itemCount}'}</code>
              </span>
            </p>
          </div>
        </div>
      </Card>

      {/* Custom Prompts */}
      <Card className="p-6 mt-6 bg-card border-border">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Custom Prompts</h3>
              <p className="text-sm text-muted-foreground">Create your own prompt templates for specific article types</p>
            </div>
          </div>
          <Button
            onClick={() => setShowAddPrompt(!showAddPrompt)}
            className="gradient-button text-white border-0"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Custom Prompt
          </Button>
        </div>

        {/* Add New Prompt Form */}
        {showAddPrompt && (
          <Card className="p-4 mb-6 border-primary/20 bg-primary/5">
            <h4 className="font-medium text-foreground mb-4">Create New Custom Prompt</h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Prompt Name
                </label>
                <Input
                  value={newPromptName}
                  onChange={(e) => setNewPromptName(e.target.value)}
                  placeholder="e.g., Beauty Tips, DIY Projects, Pet Care..."
                  className="bg-card"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Prompt Template
                </label>
                <Textarea
                  value={newPromptText}
                  onChange={(e) => setNewPromptText(e.target.value)}
                  className="min-h-[200px] font-mono text-sm bg-card resize-y"
                  placeholder={`Write a conversational article about: "{title}".

Target length: approximately 1500 words.

STRUCTURE:
1. Start with an engaging introduction...
2. Create numbered sections...
3. End with a conclusion...

Use {title} for the article title and {itemCount} for listicles.`}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddPrompt(false);
                    setNewPromptName('');
                    setNewPromptText('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!newPromptName.trim() || !newPromptText.trim()) {
                      toast.error('Please enter both name and prompt');
                      return;
                    }
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) throw new Error('Not authenticated');

                      const { data, error } = await supabase
                        .from('prompts')
                        .insert({
                          user_id: user.id,
                          type: 'custom',
                          niche: newPromptName.trim(),
                          prompt_text: newPromptText.trim(),
                        })
                        .select()
                        .single();

                      if (error) throw error;

                      setCustomPrompts(prev => [...prev, {
                        id: data.id,
                        name: data.niche,
                        prompt_text: data.prompt_text
                      }]);
                      setNewPromptName('');
                      setNewPromptText('');
                      setShowAddPrompt(false);
                      toast.success('Custom prompt created!');
                    } catch (error) {
                      console.error('Error creating prompt:', error);
                      toast.error('Failed to create prompt');
                    }
                  }}
                  className="gradient-button text-white border-0"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Prompt
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Custom Prompts List */}
        {customPrompts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No custom prompts yet</p>
            <p className="text-sm">Click "Add Custom Prompt" to create your first one</p>
          </div>
        ) : (
          <div className="space-y-4">
            {customPrompts.map((prompt) => (
              <Card key={prompt.id} className="p-4 border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 flex items-center justify-center text-xs font-bold text-white">
                      {prompt.name.charAt(0).toUpperCase()}
                    </div>
                    <h4 className="font-medium text-foreground">{prompt.name}</h4>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingPromptId(editingPromptId === prompt.id ? null : prompt.id)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={async () => {
                        try {
                          const { error } = await supabase
                            .from('prompts')
                            .delete()
                            .eq('id', prompt.id);

                          if (error) throw error;

                          setCustomPrompts(prev => prev.filter(p => p.id !== prompt.id));
                          toast.success('Prompt deleted');
                        } catch (error) {
                          console.error('Error deleting prompt:', error);
                          toast.error('Failed to delete prompt');
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {editingPromptId === prompt.id ? (
                  <div className="space-y-3">
                    <Input
                      value={prompt.name}
                      onChange={(e) => {
                        setCustomPrompts(prev => prev.map(p => 
                          p.id === prompt.id ? { ...p, name: e.target.value } : p
                        ));
                      }}
                      className="bg-card"
                      placeholder="Prompt name"
                    />
                    <Textarea
                      value={prompt.prompt_text}
                      onChange={(e) => {
                        setCustomPrompts(prev => prev.map(p => 
                          p.id === prompt.id ? { ...p, prompt_text: e.target.value } : p
                        ));
                      }}
                      className="min-h-[200px] font-mono text-sm bg-card resize-y"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingPromptId(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            const { error } = await supabase
                              .from('prompts')
                              .update({
                                niche: prompt.name,
                                prompt_text: prompt.prompt_text,
                                updated_at: new Date().toISOString(),
                              })
                              .eq('id', prompt.id);

                            if (error) throw error;

                            setEditingPromptId(null);
                            toast.success('Prompt updated!');
                          } catch (error) {
                            console.error('Error updating prompt:', error);
                            toast.error('Failed to update prompt');
                          }
                        }}
                        className="gradient-button text-white border-0"
                      >
                        Save Changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground line-clamp-3 font-mono">
                    {prompt.prompt_text}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}

        <div className="mt-4 space-y-2 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <span className="text-base">📝</span>
            <span><strong>How to use:</strong> Custom prompts can be selected when adding articles for specialized content types.</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="text-base">💡</span>
            <span>
              <strong>Placeholders:</strong> Use{' '}
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{'{title}'}</code> and{' '}
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{'{itemCount}'}</code>
            </span>
          </p>
        </div>
      </Card>
    </div>
  );
};

export default Settings;
