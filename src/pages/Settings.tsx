import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Save, Key, FileText, Image as ImageIcon, Sparkles, Globe, Plus, CheckCircle, RotateCcw, Trash2, Cpu, Link } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';

const DEFAULT_ARTICLE_PROMPT = `Write an engaging, conversational article about "{title}".

Target length: Around 1000 words.

STRUCTURE:
1. Start with a short, punchy introduction (3-4 sentences) that immediately gets to the point. Hook the reader fast. No generic phrases like "In today's world..." or "In modern times...". Do NOT include any H1 title – start directly with the introduction paragraph.

2. Create 5-7 main content sections using <h2> headings. Let the headings flow naturally based on the topic.

3. After some sections, include H3 subsections where it makes sense for deeper dives into specific points.

4. Include an FAQ section with 4-6 questions formatted as <h3> tags, with answers in paragraphs.

5. End with a brief conclusion section using an <h2> tag.

TONE & STYLE:
- Conversational and informal - write like you're chatting with a friend
- Approachable, light-hearted, and occasionally sarcastic
- Use active voice only - avoid passive constructions entirely
- Keep paragraphs SHORT (3-4 sentences max) - make it scannable
- Use rhetorical questions to engage readers and break up text
- Sprinkle in internet slang sparingly: "FYI", "IMO" (2-3 times max per article)
- Include occasional humor to keep things fun
- Bold key information with <strong> tags (but NOT in the introduction)

FORMATTING:
- Use proper HTML: <h2> for main sections, <h3> for subsections
- Use lists when appropriate: <ul> with <li> for bullets, <ol> with <li> for numbered
- Break down technical details into easy-to-read lists
- Avoid dense blocks of text
- NO Markdown, code fences, or backticks
- No extraneous preamble before content starts`;

const DEFAULT_IMAGE_PROMPT = `Based on this article about "{title}", create {count} SPECIFIC image prompts for ultra-realistic professional photography.

Article excerpt:
{content}

Requirements:
- Each prompt should be SHORT (under 15 words)
- Be SPECIFIC to this article topic
- Simple subjects only - avoid complex scenes
- Ultra-realistic, high-quality professional photography style
- Natural lighting, sharp focus, magazine-quality
- Examples of GOOD prompts:
  - "chocolate chip cookies on white marble counter, natural light, steam rising"
  - "golden retriever puppy playing in grass, soft bokeh background"
  - "modern minimalist kitchen with marble countertops, morning light"

BAD prompts (too generic):
- "a dog"
- "cookies"

Create {count} SPECIFIC prompts with realistic details related to this article.

Format as a numbered list:
1. [specific detailed prompt]
2. [specific detailed prompt]
etc.`;

const DEFAULT_IMAGE_PROMPTS: Record<string, string> = {
  general: DEFAULT_IMAGE_PROMPT,
  food: `Based on this food/recipe article about "{title}", create {count} SPECIFIC image prompts for ultra-realistic food photography.

Article excerpt:
{content}

FOOD PHOTOGRAPHY REQUIREMENTS:
- Each prompt should be SHORT (under 15 words)
- Focus on appetizing, mouth-watering food visuals
- Ultra-realistic, professional food photography style
- Natural lighting, shallow depth of field, steam/freshness visible
- Include plating details, textures, and garnishes
- Magazine-quality food styling

Examples of GOOD food prompts:
- "creamy pasta carbonara on white plate, parmesan shavings, fresh basil, steam rising"
- "stack of fluffy pancakes with maple syrup drizzle, butter pat melting"
- "colorful buddha bowl with quinoa, roasted vegetables, tahini drizzle, overhead shot"
- "fresh sushi rolls on black slate, chopsticks, wasabi, ginger, minimalist"

Create {count} SPECIFIC food photography prompts related to this article.

Format as a numbered list:
1. [specific food prompt]
2. [specific food prompt]
etc.`,
  home: `Based on this home decor article about "{title}", create {count} SPECIFIC image prompts for ultra-realistic interior design photography.

Article excerpt:
{content}

HOME DECOR PHOTOGRAPHY REQUIREMENTS:
- Each prompt should be SHORT (under 15 words)
- Focus on beautiful, aspirational interior spaces
- Ultra-realistic, professional interior photography style
- Natural lighting, styled spaces, magazine-quality
- Include textures, materials, and decor details
- Warm, inviting atmosphere

Examples of GOOD home decor prompts:
- "cozy living room with velvet emerald sofa, brass accents, morning light streaming"
- "minimalist bedroom with white linen bedding, wooden headboard, potted plants"
- "modern farmhouse kitchen with open shelving, copper pots, marble countertops"
- "bohemian reading nook with hanging macrame, floor cushions, warm sunset light"

Create {count} SPECIFIC interior design prompts related to this article.

Format as a numbered list:
1. [specific interior prompt]
2. [specific interior prompt]
etc.`,
  fashion: `Based on this fashion/outfit article about "{title}", create {count} SPECIFIC image prompts for ultra-realistic fashion photography.

Article excerpt:
{content}

FASHION PHOTOGRAPHY REQUIREMENTS:
- Each prompt should be SHORT (under 15 words)
- Focus on stylish outfits and clothing details
- Ultra-realistic, professional fashion photography style
- Natural or studio lighting, clean backgrounds
- Show fabric textures, fits, and styling details
- Editorial, magazine-quality fashion shots
- NEVER use words like "nude" or "naked" - use "beige", "tan", "cream" instead

Examples of GOOD fashion prompts:
- "oversized cream knit sweater with gold jewelry, soft natural light, cozy"
- "high-waisted black jeans with white blouse, minimalist studio shot"
- "tan trench coat over floral dress, autumn street style, golden hour"
- "layered boho outfit with turquoise accessories, desert backdrop, warm tones"

Create {count} SPECIFIC fashion photography prompts related to this article.

Format as a numbered list:
1. [specific fashion prompt]
2. [specific fashion prompt]
etc.`,
};

interface WordPressSite {
  id: string;
  name: string;
  url: string;
  username: string;
  apiKey: string;
}

interface InternalLink {
  id: string;
  keyword: string;
  url: string;
  title: string;
  category?: string;
}

interface SettingsData {
  replicateApiKey: string;
  aiProvider: 'lovable' | 'groq' | 'openai';
  groqApiKey: string;
  openaiApiKey: string;
  articleStyle: 'recipe' | 'general' | 'listicle';
  articleLength: string;
  generateImages: boolean;
  imageCount: string;
  imageAspectRatio: string;
  imageModel: 'seedream' | 'zimage';
  articlePrompt: string;
  imagePrompt: string;
  imagePrompts: Record<string, string>;
  wordpressSites: WordPressSite[];
  enableInternalLinking: boolean;
  internalLinks: InternalLink[];
  sitemapUrl: string;
  sitemapUrls: string[];
  // Pinterest settings
  pinterestStyleGuidelines: string;
  pinterestTitlePrompt: string;
  // Listicle settings
  listicleCategory: 'general' | 'food' | 'home' | 'fashion';
  listiclePrompts: Record<string, string>;
}

const DEFAULT_LISTICLE_PROMPTS: Record<string, string> = {
  general: `CRITICAL: Start your response with an <h1> title tag. Do NOT start with anything else.

Write a conversational, friendly listicle article about: "{title}". 

Target length: approximately 1500 words.

CRITICAL: Create EXACTLY {itemCount} numbered sections — no more, no less. The title specifies {itemCount} items, so deliver exactly that many.

FIRST LINE MUST BE: An <h1> title that's MORE VIRAL than the original:

   - Maximum 15 words

   - MUST include the exact core phrase from the original title (e.g., if original is '5 Home Decor Ideas', the new title MUST contain '5 Home Decor Ideas')

   - Add compelling words to make it click-worthy and engaging

   - Use proper title case capitalization (First Letter Of Each Major Word Capitalized)

   - CRITICAL: Do NOT just capitalize the original title - ADD engaging words!

   - Example: Original '5 Home Decor Ideas' becomes '5 Home Decor Ideas That'll Make Your Friends Jealous'

2. Follow with a short, punchy introduction (3-4 sentences) that immediately gets to the point. Hook the reader fast with why these items are amazing. No generic phrases like "In today's world..." or "In modern times...". Jump straight into something that grabs attention.

3. Create EXACTLY {itemCount} numbered sections using <h2> headings with creative names (like '1. Layer Textures Like a Pro' instead of boring titles).

4. For EACH section, include:

   - A brief intro paragraph (2-3 sentences) explaining why this item is awesome

   - Use <h3> subsections when helpful (like "Key Points", "Tips", "Materials") but only where it makes sense

   - Include occasional <ul> lists for key elements when it helps with scannability

   - Mix short paragraphs with practical information

   - End with a brief note about benefits, applications, or when to use this

5. End with a brief, encouraging conclusion (2-3 sentences) that makes readers excited to try these ideas.

TONE & STYLE:

- Conversational and informal - write like you're chatting with a friend who loves trying new things

- Approachable, light-hearted, and occasionally sarcastic (but don't overdo the sarcasm)

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

The article should feel like getting advice from your most knowledgeable friend who doesn't take themselves too seriously.

EXAMPLE FORMAT:

<h1>5 Home Decor Ideas That'll Make Your Friends Jealous</h1>

<p>Ready to transform your space without breaking the bank? These ideas are about to become your new obsession.</p>

<h2>1. Layer Textures Like a Pro</h2>

<p>Want that cozy vibe everyone's obsessed with? It's all about layering different textures.</p>

<h3>Key Materials:</h3>

<ul>

<li>Turkish towels with tassels</li>

<li>Cotton rug (2x3 or runner)</li>

<li>Linen throw pillows</li>

</ul>

<p>Mix and match different fabrics to create depth. Trust me, your space will instantly feel more expensive.</p>`,
  food: `Write a conversational, friendly food recipe article about: "{title}". 

Target length: approximately 1500 words.

CRITICAL: Create EXACTLY {itemCount} numbered recipe sections - no more, no less. The title specifies {itemCount} recipes, so deliver exactly that many.

STRUCTURE:

1. Start with an engaging <h1> title that's more viral than the original:

   - Maximum 15 words

   - MUST include the exact core phrase from the original title (e.g., if original is '8 Italian Salads', the new title MUST contain '8 Italian salads')

   - Use proper title case capitalization (First Letter Of Each Major Word Capitalized)

   - Make it click-worthy and engaging while keeping the SEO keywords

   - Example: Original '8 Italian Salads to Try' becomes '8 Italian Salads That Will Transport You to Tuscany'

2. Follow with a short, punchy introduction (3-4 sentences) that immediately gets to the point. Hook the reader fast with why these recipes are amazing. No generic phrases like "In today's culinary world..." or "In modern times...". Jump straight into something that grabs attention.

3. Create EXACTLY {itemCount} numbered recipe sections using <h2> headings with creative names (like '1. Tuscan Panzanella That'll Ruin Store-Bought Salads Forever' instead of boring titles).

4. For EACH recipe section, include:

   - A brief intro paragraph (2-3 sentences) explaining why this recipe is awesome (what makes it special, when to serve it, why people love it)

   - <h3>Ingredients:</h3> section with a bulleted <ul> list of all ingredients with measurements

   - <h3>Instructions:</h3> section with numbered <ol> steps that are clear and easy to follow

   - A closing paragraph with serving suggestions, variations, or pro tips

5. End with a brief, encouraging conclusion (2-3 sentences) that makes readers excited to try these recipes.

TONE & STYLE:

- Conversational and informal - write like you're chatting with a foodie friend who loves trying new recipes

- Approachable, light-hearted, and occasionally sarcastic about food (but don't overdo the sarcasm)

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

The article should feel like a friendly conversation with your most food-savvy friend who doesn't take themselves too seriously.

EXAMPLE FORMAT:

<h1>8 Italian Salads That Will Transport You To Tuscany</h1>

<p>Ready to make your taste buds do a happy dance? These Italian salads are about to become your new obsession.</p>

<h2>1. Tuscan Panzanella That'll Ruin Store-Bought Salads Forever</h2>

<p>This bread salad is summer in a bowl. Seriously, once you try this, you'll never look at regular salad the same way.</p>

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
  home: `Write a conversational, friendly home decor article showcasing: "{title}". 

Target length: approximately 1500 words.

CRITICAL: Present EXACTLY {itemCount} completely different and distinct room designs - no more, no less. Each section must showcase a unique, complete design concept.

STRUCTURE:

1. Start with an engaging <h1> title that's more viral than the original:

   - Maximum 15 words

   - MUST include the exact core phrase from the original title

   - Use proper title case capitalization

   - Make it click-worthy and engaging while keeping the SEO keywords

   - Example: Original '7 Bedroom Ideas' becomes '7 Stunning Bedroom Ideas That'll Transform Your Sleep Space'

2. Follow with a short, punchy introduction (3-4 sentences) that immediately gets to the point. Hook the reader fast with why these designs are amazing. No generic phrases like "In today's world..." or "In modern times...". Jump straight into something that grabs attention.

3. Create EXACTLY {itemCount} numbered design sections using <h2> headings, each naming a specific, complete design concept (like '1. Moody Maximalist Paradise With Jewel Tones' instead of boring titles).

4. For EACH design section, describe the complete room vision naturally:

   - Start with a brief intro paragraph (2-3 sentences) painting the overall picture and mood

   - Describe specific details about colors, furniture, textiles, and decor that make this design unique

   - Use <h3> subsections when helpful (like "Color Palette", "Key Pieces", "Styling Tips") but only where it makes sense

   - Include occasional <ul> lists for key elements when it helps with scannability

   - End with a brief note about the vibe, who would love this, or when to use this style

5. End with a brief, encouraging conclusion (2-3 sentences) that inspires readers to try these designs.

TONE & STYLE:

- Conversational and informal - write like you're showing off your favorite room designs to a friend who loves home decor

- Approachable, light-hearted, and occasionally sarcastic about design trends (but don't overdo the sarcasm)

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

The article should feel like a friendly house tour with someone who has impeccable taste and doesn't take themselves too seriously.

EXAMPLE FORMAT:

<h1>7 Stunning Bedroom Ideas That'll Transform Your Sleep Space</h1>

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
  fashion: `Write a conversational, friendly fashion outfit listicle article about: "{title}". 

Target length: approximately 1500 words.

CRITICAL: Create EXACTLY {itemCount} numbered outfit sections - no more, no less. The title specifies {itemCount} outfits, so deliver exactly that many.

STRUCTURE:

1. Start with an engaging <h1> title that's more viral than the original:

   - Maximum 15 words

   - MUST include the exact core phrase from the original title (e.g., if original is '8 Fall Outfits for Women', the new title MUST contain '8 Fall Outfits for Women')

   - Use proper title case capitalization (First Letter Of Each Major Word Capitalized)

   - Make it click-worthy and engaging while keeping the SEO keywords

   - Example: Original '8 Fall Outfits for Women' becomes '8 Fall Outfits for Women That'll Make You Love Sweater Weather'

2. Follow with a short, punchy introduction (3-4 sentences) that immediately gets to the point. Hook the reader fast with why these outfits are amazing. No generic phrases like "In today's fashion world..." or "In modern times...". Jump straight into something that grabs attention.

3. Create EXACTLY {itemCount} numbered outfit sections using <h2> headings with creative outfit names (like '1. Cozy Oversized Sweater Combo That'll Make You Ditch Your Entire Wardrobe' instead of boring titles).

4. For EACH outfit section, include:

   - A brief intro paragraph (2-3 sentences) explaining why this outfit is amazing (what makes it special, where to wear it, why people love it)

   - <h3>Outfit Pieces:</h3> section with a bulleted <ul> list of all clothing items and accessories (e.g., oversized cream knit sweater, high-waisted black jeans, ankle boots, gold layered necklaces)

   - <h3>Styling Tips:</h3> section with specific advice on how to wear and style the outfit, fit guidance, and how to accessorize

   - A closing paragraph with occasion suggestions, variations, or pro styling tips

5. End with a brief, encouraging conclusion (2-3 sentences) that makes readers excited to try these outfits.

TONE & STYLE:

- Conversational and informal - write like you're chatting with a fashion-forward friend who loves putting together great outfits

- Approachable, light-hearted, and occasionally sarcastic about fashion trends (but don't overdo the sarcasm)

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

- NEVER use the word 'nude' or 'naked' in any context

- For neutral/beige colors, use alternative terms like: 'beige', 'tan', 'cream', 'camel', 'sand', 'neutral', 'skin-tone', 'natural'

- Keep all content family-friendly and appropriate

The article should feel like getting fashion advice from your most stylish friend who doesn't take themselves too seriously.

EXAMPLE FORMAT:

<h1>8 Fall Outfits For Women That'll Make You Love Sweater Weather</h1>

<p>Ready to turn sidewalk into your personal runway? These fall outfits are about to become your new wardrobe essentials.</p>

<h2>1. Cozy Oversized Sweater Combo That'll Make You Ditch Your Entire Wardrobe</h2>

<p>This outfit is pure comfort meets style gold. Seriously, you'll want to wear this every single day.</p>

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
};

const DEFAULT_PINTEREST_STYLE_GUIDELINES = `Viral Pinterest pin. Text overlay directly in the middle. Two images - one at the top, one at the bottom. Text with modern white bold font.

OR

Use MY BRAND colors: coral pink (#FF6B9D) and navy.
Signature: 'by YourBrand'

The AI will follow these guidelines when generating prompts.`;

const DEFAULT_PINTEREST_TITLE_PROMPT = `You're a Pinterest content writer optimizing blog posts for maximum search visibility and clicks.

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

const DEFAULT_SETTINGS: SettingsData = {
  replicateApiKey: '',
  aiProvider: 'lovable',
  groqApiKey: '',
  openaiApiKey: '',
  articleStyle: 'general',
  articleLength: 'long',
  generateImages: true,
  imageCount: '3',
  imageAspectRatio: '9:16',
  imageModel: 'zimage',
  articlePrompt: DEFAULT_ARTICLE_PROMPT,
  imagePrompt: DEFAULT_IMAGE_PROMPT,
  imagePrompts: DEFAULT_IMAGE_PROMPTS,
  wordpressSites: [],
  enableInternalLinking: false,
  internalLinks: [],
  sitemapUrl: '',
  sitemapUrls: [],
  pinterestStyleGuidelines: '',
  pinterestTitlePrompt: '',
  listicleCategory: 'general',
  listiclePrompts: DEFAULT_LISTICLE_PROMPTS,
};

const Settings = () => {
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [newSite, setNewSite] = useState({ name: '', url: '', username: '', apiKey: '' });
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  useEffect(() => {
    const savedSettings = localStorage.getItem('article_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem('article_settings', JSON.stringify(settings));
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const resetArticlePrompt = () => {
    setSettings({ ...settings, articlePrompt: DEFAULT_ARTICLE_PROMPT });
    toast.info('Article prompt reset to default');
  };

  const resetImagePrompt = () => {
    setSettings({ ...settings, imagePrompt: DEFAULT_IMAGE_PROMPT });
    toast.info('Image prompt reset to default');
  };

  const [connectionResult, setConnectionResult] = useState<{ siteId: string; data: any } | null>(null);

  const testConnection = async (siteId: string) => {
    setTestingConnection(siteId);
    setConnectionResult(null);
    
    const site = siteId === 'new' ? newSite : settings.wordpressSites.find(s => s.id === siteId);
    if (!site) {
      toast.error('Site not found');
      setTestingConnection(null);
      return;
    }

    try {
      const { data, error } = await (await import('@/integrations/supabase/client')).supabase.functions.invoke('send-to-wordpress', {
        body: {
          siteUrl: site.url,
          apiKey: site.apiKey,
          testOnly: true,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setConnectionResult({ siteId, data: data.site });
        toast.success('Connection successful!');
      } else {
        throw new Error(data?.error || 'Connection failed');
      }
    } catch (err) {
      console.error('Connection test failed:', err);
      toast.error(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setTestingConnection(null);
    }
  };

  const addWordPressSite = () => {
    if (!newSite.name || !newSite.url || !newSite.apiKey) {
      toast.error('Please fill in all fields');
      return;
    }
    
    const site: WordPressSite = {
      id: Date.now().toString(),
      ...newSite,
    };
    
    setSettings({
      ...settings,
      wordpressSites: [...settings.wordpressSites, site],
    });
    setNewSite({ name: '', url: '', username: '', apiKey: '' });
    toast.success('WordPress site added');
  };

  const removeSite = (id: string) => {
    setSettings({
      ...settings,
      wordpressSites: settings.wordpressSites.filter(s => s.id !== id),
    });
    toast.success('Site removed');
  };


  return (
    <AppLayout>
      <div className="p-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="page-title mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Configure your API keys and generation preferences
          </p>
        </div>

        <div className="space-y-6">
          {/* AI Provider Selection */}
          <div className="card-modern p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">AI Provider</h2>
                <p className="text-sm text-muted-foreground">Choose which AI to use for article generation</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Select AI Provider</Label>
                <Select
                  value={settings.aiProvider}
                  onValueChange={(value: 'lovable' | 'groq' | 'openai') => setSettings({ ...settings, aiProvider: value })}
                >
                  <SelectTrigger className="mt-1.5 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lovable">Lovable AI (Default - Uses Credits)</SelectItem>
                    <SelectItem value="groq">Groq (Free - Llama 3.3 70B)</SelectItem>
                    <SelectItem value="openai">OpenAI (GPT-4o-mini)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1.5">
                  {settings.aiProvider === 'lovable' && 'Uses Lovable AI credits. If you run out of credits, switch to Groq or OpenAI.'}
                  {settings.aiProvider === 'groq' && 'Free tier available. Fast and high quality with Llama 3.3 70B model.'}
                  {settings.aiProvider === 'openai' && 'Requires OpenAI API key. Uses GPT-4o-mini for cost efficiency.'}
                </p>
              </div>

              {settings.aiProvider === 'groq' && (
                <div>
                  <Label htmlFor="groq-key">Groq API Key</Label>
                  <Input
                    id="groq-key"
                    type="password"
                    placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={settings.groqApiKey}
                    onChange={(e) => setSettings({ ...settings, groqApiKey: e.target.value })}
                    className="mt-1.5 bg-background"
                  />
                  <p className="text-sm text-muted-foreground mt-1.5">
                    Get your free API key from{' '}
                    <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      console.groq.com
                    </a>
                  </p>
                </div>
              )}

              {settings.aiProvider === 'openai' && (
                <div>
                  <Label htmlFor="openai-key">OpenAI API Key</Label>
                  <Input
                    id="openai-key"
                    type="password"
                    placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={settings.openaiApiKey}
                    onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                    className="mt-1.5 bg-background"
                  />
                  <p className="text-sm text-muted-foreground mt-1.5">
                    Get your API key from{' '}
                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      platform.openai.com
                    </a>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Replicate API for Images */}
          <div className="card-modern p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Key className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="font-semibold text-lg">Image Generation API</h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="replicate-key">Replicate API Token</Label>
                <Input
                  id="replicate-key"
                  type="password"
                  placeholder="••••••••••••••••••••••••••••••••••••••"
                  value={settings.replicateApiKey}
                  onChange={(e) => setSettings({ ...settings, replicateApiKey: e.target.value })}
                  className="mt-1.5 bg-background"
                />
                <p className="text-sm text-muted-foreground mt-1.5">
                  For Seedream-4 image generation.{' '}
                  <a href="https://replicate.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Get yours at replicate.com
                  </a>
                </p>
              </div>
            </div>
          </div>

          <div className="card-modern p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                <FileText className="w-5 h-5 text-pink-600 dark:text-pink-400" />
              </div>
              <h2 className="font-semibold text-lg">Article Settings</h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Article Style</Label>
                <Select
                  value={settings.articleStyle}
                  onValueChange={(value: 'recipe' | 'general' | 'listicle') => setSettings({ ...settings, articleStyle: value })}
                >
                  <SelectTrigger className="mt-1.5 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recipe">
                      <span className="flex items-center gap-2">🍳 Recipe Style</span>
                    </SelectItem>
                    <SelectItem value="general">
                      <span className="flex items-center gap-2">⭐ General Blog Style</span>
                    </SelectItem>
                    <SelectItem value="listicle">
                      <span className="flex items-center gap-2">📝 Listicle Style</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1.5">
                  <strong>Recipe:</strong> Casual, fun tone with sections like "Why it works", "Ingredients", "Quick method", "FAQ", etc.<br />
                  <strong>General:</strong> Conversational blog format with intro, main sections, FAQ, and conclusion.<br />
                  <strong>Listicle:</strong> Numbered list format like "10 Best...", "15 Ways to...", perfect for ranking articles.
                </p>
              </div>
              <div>
                <Label>Article Length</Label>
                <Select
                  value={settings.articleLength}
                  onValueChange={(value) => setSettings({ ...settings, articleLength: value })}
                >
                  <SelectTrigger className="mt-1.5 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short (500-700 words)</SelectItem>
                    <SelectItem value="medium">Medium (700-900 words)</SelectItem>
                    <SelectItem value="long">Long (900-1200 words)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1.5">
                  Choose the target length for generated articles
                </p>
              </div>
            </div>
          </div>

          <div className="card-modern p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <h2 className="font-semibold text-lg">Image Settings</h2>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Image Generation Model</Label>
                <Select
                  value={settings.imageModel}
                  onValueChange={(value: 'seedream' | 'zimage') => setSettings({ ...settings, imageModel: value })}
                >
                  <SelectTrigger className="mt-1.5 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seedream">Seedream 4.5 (ByteDance) - $0.04 per image</SelectItem>
                    <SelectItem value="zimage">Z-Image Turbo (Pruna AI) - $0.01 per image</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1.5">
                  Choose the AI model for generating featured and in-text images (pricing shown per image)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="generate-images"
                  checked={settings.generateImages}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, generateImages: checked as boolean })
                  }
                />
                <Label htmlFor="generate-images" className="cursor-pointer">
                  Generate in-text images
                </Label>
              </div>
              
              {settings.generateImages && (
                <>
                  <div>
                    <Label>Number of In-Text Images</Label>
                    <Select
                      value={settings.imageCount}
                      onValueChange={(value) => setSettings({ ...settings, imageCount: value })}
                    >
                      <SelectTrigger className="mt-1.5 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">No In-Text Images</SelectItem>
                        <SelectItem value="1">1 Image</SelectItem>
                        <SelectItem value="2">2 Images</SelectItem>
                        <SelectItem value="3">3 Images</SelectItem>
                        <SelectItem value="4">4 Images</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground mt-1.5">
                      Images will be placed throughout the article at strategic H2 positions
                    </p>
                  </div>

                  <div>
                    <Label>In-Text Image Aspect Ratio</Label>
                    <Select
                      value={settings.imageAspectRatio}
                      onValueChange={(value) => setSettings({ ...settings, imageAspectRatio: value })}
                    >
                      <SelectTrigger className="mt-1.5 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="9:16">9:16 - Vertical (Portrait)</SelectItem>
                        <SelectItem value="16:9">16:9 - Horizontal (Landscape)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground mt-1.5">
                      Choose vertical (9:16) for portrait-style images or horizontal (16:9) for landscape-style images
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Internal Linking Settings */}
          <div className="card-modern p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                <Link className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Internal Linking</h2>
                <p className="text-sm text-muted-foreground">Auto-link related content in articles</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="enable-linking"
                  checked={settings.enableInternalLinking}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, enableInternalLinking: checked as boolean })
                  }
                />
                <Label htmlFor="enable-linking" className="cursor-pointer">
                  Enable automatic internal linking
                </Label>
              </div>

              {settings.enableInternalLinking && (
                <>
                  <div>
                    <Label>Sitemap URLs</Label>
                    <div className="space-y-2 mt-1.5">
                      {(settings.sitemapUrls.length === 0 ? [''] : settings.sitemapUrls).map((url, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            placeholder="https://yoursite.com/post-sitemap.xml"
                            value={url}
                            onChange={(e) => {
                              const newUrls = [...settings.sitemapUrls];
                              if (newUrls.length === 0) newUrls.push('');
                              newUrls[index] = e.target.value;
                              setSettings({ ...settings, sitemapUrls: newUrls });
                            }}
                            className="bg-background flex-1"
                          />
                          {settings.sitemapUrls.length > 1 && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="text-destructive hover:text-destructive shrink-0"
                              onClick={() => {
                                const newUrls = settings.sitemapUrls.filter((_, i) => i !== index);
                                setSettings({ ...settings, sitemapUrls: newUrls });
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => setSettings({ ...settings, sitemapUrls: [...settings.sitemapUrls, ''] })}
                      >
                        <Plus className="w-4 h-4" />
                        Add Another Sitemap
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Add multiple sitemap URLs (e.g., post-sitemap.xml, page-sitemap.xml). AI will find relevant articles from all sitemaps.
                    </p>
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1 bg-muted/30 p-3 rounded-lg">
                    <p><strong>🔗 How it works:</strong></p>
                    <p>• AI fetches all URLs from your sitemaps automatically</p>
                    <p>• Analyzes article content to find relevant internal links</p>
                    <p>• Inserts contextual links naturally within your article</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card-modern p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">Classic Article Prompt</h2>
                  <p className="text-sm text-muted-foreground">Used for standard article generation</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={resetArticlePrompt}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset to Default
              </Button>
            </div>
            <div className="space-y-3">
              <Label>Custom AI Prompt</Label>
              <Textarea
                value={settings.articlePrompt}
                onChange={(e) => setSettings({ ...settings, articlePrompt: e.target.value })}
                className="min-h-[200px] font-mono text-sm bg-background"
              />
              <div className="text-sm text-muted-foreground space-y-1">
                <p>🎯 <strong>How to use:</strong> This prompt controls how AI generates article content for your articles.</p>
                <p>💡 <strong>Placeholders:</strong> Use <code className="bg-muted px-1 py-0.5 rounded">{'{title}'}</code> for the article title.</p>
                <p>✨ <strong>Examples:</strong> Change style (realistic, artistic, minimalist), modify format (short/long descriptions), adjust tone (professional, casual, creative).</p>
              </div>
            </div>
          </div>

          {/* Listicle Prompts */}
          <div className="card-modern p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">Listicle Prompts</h2>
                  <p className="text-sm text-muted-foreground">Select category and customize its prompt</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setSettings({ 
                    ...settings, 
                    listiclePrompts: {
                      ...settings.listiclePrompts,
                      [settings.listicleCategory]: DEFAULT_LISTICLE_PROMPTS[settings.listicleCategory]
                    }
                  });
                  toast.info('Listicle prompt reset to default');
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset to Default
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Listicle Category</Label>
                <Select
                  value={settings.listicleCategory}
                  onValueChange={(value: 'general' | 'food' | 'home' | 'fashion') => setSettings({ ...settings, listicleCategory: value })}
                >
                  <SelectTrigger className="mt-1.5 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">
                      <span className="flex items-center gap-2">⭐ Default (General)</span>
                    </SelectItem>
                    <SelectItem value="food">
                      <span className="flex items-center gap-2">🍳 Food & Recipes</span>
                    </SelectItem>
                    <SelectItem value="home">
                      <span className="flex items-center gap-2">🏠 Home Decor</span>
                    </SelectItem>
                    <SelectItem value="fashion">
                      <span className="flex items-center gap-2">👗 Fashion & Outfits</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Textarea
                  value={settings.listiclePrompts?.[settings.listicleCategory] || DEFAULT_LISTICLE_PROMPTS[settings.listicleCategory]}
                  onChange={(e) => setSettings({ 
                    ...settings, 
                    listiclePrompts: {
                      ...settings.listiclePrompts,
                      [settings.listicleCategory]: e.target.value
                    }
                  })}
                  className="min-h-[250px] font-mono text-sm bg-background"
                />
                <div className="text-sm text-muted-foreground space-y-1 mt-3">
                  <p>📝 <strong>How to use:</strong> This prompt controls how classic articles are generated.</p>
                  <p>💡 <strong>Placeholder:</strong> Use <code className="bg-muted px-1 py-0.5 rounded">{'{title}'}</code> where you want the article title inserted.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card-modern p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">Image Generation Prompts</h2>
                  <p className="text-sm text-muted-foreground">Category-specific ultra-realistic image prompts</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setSettings({ 
                    ...settings, 
                    imagePrompts: {
                      ...settings.imagePrompts,
                      [settings.listicleCategory]: DEFAULT_IMAGE_PROMPTS[settings.listicleCategory]
                    }
                  });
                  toast.info('Image prompt reset to default for this category');
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset to Default
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Image Category</Label>
                <Select
                  value={settings.listicleCategory}
                  onValueChange={(value: 'general' | 'food' | 'home' | 'fashion') => setSettings({ ...settings, listicleCategory: value })}
                >
                  <SelectTrigger className="mt-1.5 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">
                      <span className="flex items-center gap-2">⭐ General (Default)</span>
                    </SelectItem>
                    <SelectItem value="food">
                      <span className="flex items-center gap-2">🍳 Food & Recipes</span>
                    </SelectItem>
                    <SelectItem value="home">
                      <span className="flex items-center gap-2">🏠 Home Decor</span>
                    </SelectItem>
                    <SelectItem value="fashion">
                      <span className="flex items-center gap-2">👗 Fashion & Outfits</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1.5">
                  Select a category to customize its image generation prompt. Images will match the selected style.
                </p>
              </div>
              <div>
                <Label>Custom AI Prompt for {settings.listicleCategory === 'general' ? 'General' : settings.listicleCategory === 'food' ? 'Food & Recipes' : settings.listicleCategory === 'home' ? 'Home Decor' : 'Fashion & Outfits'}</Label>
                <Textarea
                  value={settings.imagePrompts?.[settings.listicleCategory] || DEFAULT_IMAGE_PROMPTS[settings.listicleCategory]}
                  onChange={(e) => setSettings({ 
                    ...settings, 
                    imagePrompts: {
                      ...settings.imagePrompts,
                      [settings.listicleCategory]: e.target.value
                    }
                  })}
                  className="min-h-[200px] font-mono text-sm bg-background mt-1.5"
                />
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>📸 <strong>How to use:</strong> Each category has optimized prompts for ultra-realistic images.</p>
                <p>💡 <strong>Placeholders:</strong> Use <code className="bg-muted px-1 py-0.5 rounded">{'{title}'}</code>, <code className="bg-muted px-1 py-0.5 rounded">{'{count}'}</code>, and <code className="bg-muted px-1 py-0.5 rounded">{'{content}'}</code>.</p>
                <p>✨ <strong>Categories:</strong> Food prompts focus on appetizing shots, Home on interior design, Fashion on outfit styling.</p>
              </div>
            </div>
          </div>

          {/* Pinterest Settings */}
          <div className="card-modern p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-pink-600 dark:text-pink-400" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Pinterest Pin Settings</h2>
                <p className="text-sm text-muted-foreground">Configure pin generation prompts and style guidelines</p>
              </div>
            </div>
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="font-medium">Custom Style Guidelines (Optional)</Label>
                <Textarea
                  value={settings.pinterestStyleGuidelines}
                  onChange={(e) => setSettings({ ...settings, pinterestStyleGuidelines: e.target.value })}
                  placeholder={DEFAULT_PINTEREST_STYLE_GUIDELINES}
                  className="min-h-[120px] font-mono text-sm bg-background"
                />
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Define your brand style guidelines that the AI will follow when generating pin descriptions.</p>
                  <p><strong>Note:</strong> Your guidelines will be used as instructions to generate prompts that match your brand style.</p>
                  <p>All prompts will automatically start with "This Pinterest pin is viral" and include the URL topic.</p>
                  <p>This will be used when you select "Custom" as the pin style.</p>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="font-medium">Title & Description Generation Prompt (Optional)</Label>
                <Textarea
                  value={settings.pinterestTitlePrompt}
                  onChange={(e) => setSettings({ ...settings, pinterestTitlePrompt: e.target.value })}
                  placeholder={DEFAULT_PINTEREST_TITLE_PROMPT}
                  className="min-h-[200px] font-mono text-sm bg-background"
                />
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Customize the prompt sent to AI for generating Pinterest titles and descriptions.</p>
                  <p><strong>Available variables:</strong> <code className="bg-muted px-1 py-0.5 rounded">{`\${url}`}</code> - Blog post URL, <code className="bg-muted px-1 py-0.5 rounded">{`\${interestsNote}`}</code> - Annotated interests</p>
                  <p><strong>Tip:</strong> Adjust character limits, sentence count, keyword rules, or tone to match your brand.</p>
                  <p>Leave empty to use the default prompt.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card-modern p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">WordPress Sites</h2>
                  <p className="text-sm text-muted-foreground">Manage multiple WordPress sites</p>
                </div>
              </div>
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                {settings.wordpressSites.length} sites
              </span>
            </div>

            {settings.wordpressSites.length > 0 && (
              <div className="space-y-3 mb-6">
                {settings.wordpressSites.map((site) => (
                  <div key={site.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Globe className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">{site.name}</p>
                      <p className="text-sm text-muted-foreground">{site.url}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSite(site.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="border-2 border-dashed border-border rounded-lg p-4 bg-emerald-50/50 dark:bg-emerald-950/20">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add New Site
              </h3>
              <div className="space-y-4">
                <div>
                  <Label>Site Name</Label>
                  <Input
                    placeholder="My Food Blog"
                    value={newSite.name}
                    onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                    className="mt-1.5 bg-background"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Friendly name to identify this site
                  </p>
                </div>
                <div>
                  <Label>WordPress Site URL</Label>
                  <Input
                    placeholder="https://yoursite.com"
                    value={newSite.url}
                    onChange={(e) => setNewSite({ ...newSite, url: e.target.value })}
                    className="mt-1.5 bg-background"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Your WordPress site URL (without trailing slash)
                  </p>
                </div>
                <div>
                  <Label>WordPress Username</Label>
                  <Input
                    placeholder="admin"
                    value={newSite.username}
                    onChange={(e) => setNewSite({ ...newSite, username: e.target.value })}
                    className="mt-1.5 bg-background"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Your WordPress admin username
                  </p>
                </div>
                <div>
                  <Label>Application Password</Label>
                  <Input
                    type="password"
                    placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                    value={newSite.apiKey}
                    onChange={(e) => setNewSite({ ...newSite, apiKey: e.target.value })}
                    className="mt-1.5 bg-background"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Generate in WordPress: Users → Profile → Application Passwords
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => testConnection('new')}
                    disabled={testingConnection === 'new' || !newSite.url || !newSite.apiKey}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {testingConnection === 'new' ? 'Testing...' : 'Test Connection'}
                  </Button>
                  <Button
                    onClick={addWordPressSite}
                    disabled={!newSite.name || !newSite.url || !newSite.apiKey}
                    className="gradient-button border-0"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Site
                  </Button>
                </div>

                {connectionResult && connectionResult.siteId === 'new' && (
                  <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium mb-2">
                      <CheckCircle className="w-5 h-5" />
                      Connection Successful! ✅
                    </div>
                    <div className="text-sm space-y-1 text-emerald-800 dark:text-emerald-300">
                      <p><strong>Site:</strong> {connectionResult.data.name}</p>
                      <p><strong>URL:</strong> {connectionResult.data.url}</p>
                      <p><strong>Posts:</strong> {connectionResult.data.posts} published</p>
                      <p><strong>WordPress:</strong> {connectionResult.data.version}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="sticky bottom-6">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              size="lg"
              className="w-full gradient-button border-0"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Settings;
