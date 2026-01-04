import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Save, Key, FileText, Image as ImageIcon, Sparkles, Globe, Plus, CheckCircle, RotateCcw, Trash2, Cpu, Link, Upload, FileSpreadsheet } from 'lucide-react';
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

const DEFAULT_IMAGE_PROMPT = `Based on this article about "{title}", create {count} SPECIFIC image prompts for professional photography.

Article excerpt:
{content}

Requirements:
- Each prompt should be SHORT (under 10 words)
- Be SPECIFIC to this article topic
- Simple subjects only - avoid complex scenes
- Professional, high-quality photography style
- Examples of GOOD prompts:
  - "chocolate chip cookies on white plate"
  - "golden retriever puppy playing"
  - "modern kitchen with marble countertops"

BAD prompts (too generic):
- "a dog"
- "cookies"

Create {count} SPECIFIC prompts with details related to this article.

Format as a numbered list:
1. [specific detailed prompt]
2. [specific detailed prompt]
etc.`;

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
  articleStyle: 'recipe' | 'general';
  articleLength: string;
  generateImages: boolean;
  imageCount: string;
  imageAspectRatio: string;
  articlePrompt: string;
  imagePrompt: string;
  wordpressSites: WordPressSite[];
  enableInternalLinking: boolean;
  internalLinks: InternalLink[];
  sitemapUrl: string;
}

const DEFAULT_SETTINGS: SettingsData = {
  replicateApiKey: '',
  aiProvider: 'lovable',
  groqApiKey: '',
  openaiApiKey: '',
  articleStyle: 'recipe',
  articleLength: 'long',
  generateImages: true,
  imageCount: '3',
  imageAspectRatio: '4:3',
  articlePrompt: DEFAULT_ARTICLE_PROMPT,
  imagePrompt: DEFAULT_IMAGE_PROMPT,
  wordpressSites: [],
  enableInternalLinking: false,
  internalLinks: [],
  sitemapUrl: '',
};

const Settings = () => {
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [newSite, setNewSite] = useState({ name: '', url: '', username: '', apiKey: '' });
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [isUploadingLinks, setIsUploadingLinks] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingLinks(true);
    
    try {
      const text = await file.text();
      const links: InternalLink[] = [];
      
      // Check if it's CSV
      if (file.name.endsWith('.csv')) {
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
        
        const keywordIdx = headers.findIndex(h => h === 'keyword' || h === 'keywords');
        const urlIdx = headers.findIndex(h => h === 'url' || h === 'link');
        const titleIdx = headers.findIndex(h => h === 'title' || h === 'anchor' || h === 'anchor text');
        const categoryIdx = headers.findIndex(h => h === 'category' || h === 'cat');
        
        if (keywordIdx === -1 || urlIdx === -1) {
          toast.error('CSV must have "keyword" and "url" columns');
          return;
        }
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          if (values[keywordIdx] && values[urlIdx]) {
            links.push({
              id: Date.now().toString() + i,
              keyword: values[keywordIdx],
              url: values[urlIdx],
              title: titleIdx !== -1 ? values[titleIdx] || values[keywordIdx] : values[keywordIdx],
              category: categoryIdx !== -1 ? values[categoryIdx] : undefined,
            });
          }
        }
      } else {
        // Handle Excel files - parse as CSV-like (basic XLSX parsing)
        toast.error('Please use CSV format. Excel support coming soon.');
        return;
      }
      
      if (links.length === 0) {
        toast.error('No valid links found in file');
        return;
      }
      
      setSettings({
        ...settings,
        internalLinks: [...settings.internalLinks, ...links],
      });
      
      toast.success(`${links.length} internal links imported successfully!`);
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Failed to parse file');
    } finally {
      setIsUploadingLinks(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const clearInternalLinks = () => {
    setSettings({ ...settings, internalLinks: [] });
    toast.success('All internal links cleared');
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
                  onValueChange={(value: 'recipe' | 'general') => setSettings({ ...settings, articleStyle: value })}
                >
                  <SelectTrigger className="mt-1.5 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recipe">Recipe Style</SelectItem>
                    <SelectItem value="general">General Blog Style</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-1.5">
                  <strong>Recipe:</strong> Casual, fun tone with sections like "Why it works", "Ingredients", "Quick method", "FAQ", etc.<br />
                  <strong>General:</strong> Conversational blog format with intro, main sections, FAQ, and conclusion.
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
              <div className="flex items-center gap-2">
                <Checkbox
                  id="generate-images"
                  checked={settings.generateImages}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, generateImages: checked as boolean })
                  }
                />
                <Label htmlFor="generate-images" className="cursor-pointer">
                  Generate in-text images using Seedream-4
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
                        <SelectItem value="1">1 Image</SelectItem>
                        <SelectItem value="2">2 Images</SelectItem>
                        <SelectItem value="3">3 Images</SelectItem>
                        <SelectItem value="4">4 Images</SelectItem>
                        <SelectItem value="5">5 Images</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground mt-1.5">
                      Images will be placed throughout the article at strategic H2 positions
                    </p>
                  </div>

                  <div>
                    <Label>Image Aspect Ratio</Label>
                    <Select
                      value={settings.imageAspectRatio}
                      onValueChange={(value) => setSettings({ ...settings, imageAspectRatio: value })}
                    >
                      <SelectTrigger className="mt-1.5 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1:1">1:1 (Square)</SelectItem>
                        <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                        <SelectItem value="16:9">16:9 (Widescreen)</SelectItem>
                        <SelectItem value="9:16">9:16 (Portrait/Pinterest)</SelectItem>
                        <SelectItem value="3:2">3:2 (Classic Photo)</SelectItem>
                        <SelectItem value="2:3">2:3 (Portrait Photo)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground mt-1.5">
                      Choose the aspect ratio for generated images
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
                    <Label>Sitemap URL (Optional)</Label>
                    <Input
                      placeholder="https://yoursite.com/sitemap.xml"
                      value={settings.sitemapUrl}
                      onChange={(e) => setSettings({ ...settings, sitemapUrl: e.target.value })}
                      className="mt-1.5 bg-background"
                    />
                    <p className="text-sm text-muted-foreground mt-1.5">
                      Enter your WordPress sitemap URL to auto-fetch links
                    </p>
                  </div>

                  <div className="border-2 border-dashed border-border rounded-lg p-4 bg-cyan-50/50 dark:bg-cyan-950/20">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      Upload Links (CSV)
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Upload a CSV file with columns: <strong>keyword</strong>, <strong>url</strong>, <strong>title</strong> (optional), <strong>category</strong> (optional)
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".csv"
                        className="hidden"
                      />
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingLinks}
                      >
                        <Upload className="w-4 h-4" />
                        {isUploadingLinks ? 'Uploading...' : 'Upload CSV'}
                      </Button>
                      {settings.internalLinks.length > 0 && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2 text-destructive hover:text-destructive"
                          onClick={clearInternalLinks}
                        >
                          <Trash2 className="w-4 h-4" />
                          Clear All
                        </Button>
                      )}
                    </div>
                    {settings.internalLinks.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium mb-2">
                          {settings.internalLinks.length} links loaded
                        </p>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {settings.internalLinks.slice(0, 5).map((link) => (
                            <div key={link.id} className="text-xs bg-muted/50 px-2 py-1 rounded flex justify-between">
                              <span className="truncate font-medium">{link.keyword}</span>
                              <span className="text-muted-foreground truncate ml-2">{link.url}</span>
                            </div>
                          ))}
                          {settings.internalLinks.length > 5 && (
                            <p className="text-xs text-muted-foreground">
                              +{settings.internalLinks.length - 5} more links
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1 bg-muted/30 p-3 rounded-lg">
                    <p><strong>How it works:</strong></p>
                    <p>• <strong>Keyword matching:</strong> Links are added when keywords appear in article text</p>
                    <p>• <strong>Title matching:</strong> Links are added when article titles are similar</p>
                    <p>• <strong>Category matching:</strong> Links are added based on topic relevance</p>
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
                <h2 className="font-semibold text-lg">Article Generation Prompt</h2>
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

          <div className="card-modern p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <h2 className="font-semibold text-lg">Image Generation Prompt</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={resetImagePrompt}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset to Default
              </Button>
            </div>
            <div className="space-y-3">
              <Label>Custom Image Prompt</Label>
              <Textarea
                value={settings.imagePrompt}
                onChange={(e) => setSettings({ ...settings, imagePrompt: e.target.value })}
                className="min-h-[200px] font-mono text-sm bg-background"
              />
              <div className="text-sm text-muted-foreground space-y-1">
                <p>🎯 <strong>How to use:</strong> This prompt controls how AI generates image descriptions for your articles.</p>
                <p>💡 <strong>Placeholders:</strong> Use <code className="bg-muted px-1 py-0.5 rounded">{'{title}'}</code>, <code className="bg-muted px-1 py-0.5 rounded">{'{count}'}</code>, and <code className="bg-muted px-1 py-0.5 rounded">{'{content}'}</code>.</p>
                <p>✨ <strong>Examples:</strong> Change style (realistic, artistic, minimalist), modify format (short/long descriptions), adjust tone (professional, casual, creative).</p>
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
