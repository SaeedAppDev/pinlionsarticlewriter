import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Settings as SettingsIcon, Save, Image, Link2, Sparkles, FileCode, Key, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

// Aspect ratio options
const ASPECT_RATIOS = [
  { value: '1:1', label: '1:1', desc: 'Square', width: 1024, height: 1024 },
  { value: '16:9', label: '16:9', desc: 'Landscape', width: 1920, height: 1080 },
  { value: '4:3', label: '4:3', desc: 'Standard', width: 1024, height: 768 },
  { value: '3:2', label: '3:2', desc: 'Photo', width: 1200, height: 800 },
  { value: '2:3', label: '2:3', desc: 'Portrait', width: 800, height: 1200 },
  { value: '9:16', label: '9:16', desc: 'Vertical', width: 1080, height: 1920 },
  { value: '3:4', label: '3:4', desc: 'Portrait', width: 768, height: 1024 },
  { value: '21:9', label: '21:9', desc: 'Ultrawide', width: 1680, height: 720 },
];

// Quality options
const QUALITY_OPTIONS = [
  { value: 'low', label: 'Low', desc: 'Faster generation, smaller images' },
  { value: 'medium', label: 'Medium', desc: 'Balanced quality and speed' },
  { value: 'high', label: 'High', desc: 'Best quality, slower generation' },
];

// Sitemap type options
const SITEMAP_TYPES = [
  { value: 'auto', label: 'Auto Detect', desc: 'Automatically detect sitemap format' },
  { value: 'standard', label: 'Standard XML', desc: 'sitemap.xml - Standard XML sitemap' },
  { value: 'wordpress', label: 'WordPress Native', desc: 'wp-sitemap.xml - WordPress default sitemap index' },
  { value: 'yoast', label: 'Yoast SEO', desc: 'sitemap_index.xml - Yoast SEO plugin sitemap' },
  { value: 'rankmath', label: 'RankMath', desc: 'sitemap_index.xml - RankMath plugin sitemap' },
  { value: 'custom', label: 'Custom URL', desc: 'Enter your exact sitemap URL' },
];

// AI Provider options
const AI_PROVIDERS = [
  { value: 'lovable', label: 'Lovable AI (Default)', desc: 'Built-in AI - no API key needed' },
  { value: 'groq', label: 'Groq API', desc: 'Fast inference with Llama models' },
  { value: 'openai', label: 'OpenAI API', desc: 'GPT models from OpenAI' },
];

interface SettingsData {
  sitemapUrl: string;
  sitemapType: 'auto' | 'standard' | 'wordpress' | 'yoast' | 'rankmath' | 'custom';
  imageQuality: 'low' | 'medium' | 'high';
  aspectRatio: string;
  aiProvider: 'lovable' | 'groq' | 'openai';
  customApiKey: string;
  replicateApiKey: string;
}

const DEFAULT_SETTINGS: SettingsData = {
  sitemapUrl: '',
  sitemapType: 'auto',
  imageQuality: 'medium',
  aspectRatio: '16:9',
  aiProvider: 'lovable',
  customApiKey: '',
  replicateApiKey: '',
};

const Settings = () => {
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('recipe_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
    
    // Also check for legacy sitemap URL
    const legacySitemap = localStorage.getItem('recipe_sitemap_url');
    if (legacySitemap && !savedSettings) {
      setSettings(prev => ({ ...prev, sitemapUrl: legacySitemap }));
    }
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem('recipe_settings', JSON.stringify(settings));
      // Also save sitemap URL in legacy format for backward compatibility
      if (settings.sitemapUrl) {
        localStorage.setItem('recipe_sitemap_url', settings.sitemapUrl);
      } else {
        localStorage.removeItem('recipe_sitemap_url');
      }
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const getAspectRatioPreviewStyle = (ratio: string) => {
    const [w, h] = ratio.split(':').map(Number);
    const maxSize = 60;
    let width, height;
    
    if (w > h) {
      width = maxSize;
      height = (h / w) * maxSize;
    } else {
      height = maxSize;
      width = (w / h) * maxSize;
    }
    
    return { width: `${width}px`, height: `${height}px` };
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-3 px-4">
        <div className="container mx-auto flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/recipes')}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to List
          </Button>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            Settings
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-6 max-w-4xl">
        {/* Sitemap Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              Sitemap Configuration
            </CardTitle>
            <CardDescription>
              Configure your website's sitemap for automatic internal linking in generated articles.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Sitemap Type */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileCode className="w-4 h-4" />
                Sitemap Type
              </Label>
              <Select
                value={settings.sitemapType}
                onValueChange={(value) => setSettings({ ...settings, sitemapType: value as SettingsData['sitemapType'] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sitemap type" />
                </SelectTrigger>
                <SelectContent>
                  {SITEMAP_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{type.label}</span>
                        <span className="text-xs text-muted-foreground">{type.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {settings.sitemapType === 'wordpress' && 'WordPress native sitemap index at /wp-sitemap.xml with child sitemaps for posts, pages, and taxonomies.'}
                {settings.sitemapType === 'yoast' && 'Yoast SEO creates sitemap_index.xml with separate sitemaps for posts, pages, categories.'}
                {settings.sitemapType === 'rankmath' && 'RankMath creates sitemap_index.xml similar to Yoast structure.'}
                {settings.sitemapType === 'standard' && 'Standard XML sitemap with all URLs in a single file.'}
                {settings.sitemapType === 'auto' && 'Will automatically detect and parse the correct sitemap format.'}
                {settings.sitemapType === 'custom' && 'Enter the complete URL to your sitemap file.'}
              </p>
            </div>

            {/* Sitemap URL */}
            <div className="space-y-2">
              <Label>
                {settings.sitemapType === 'custom' ? 'Complete Sitemap URL' : 'Website Base URL'}
              </Label>
              <Input
                type="url"
                placeholder={
                  settings.sitemapType === 'custom' 
                    ? "https://yourwebsite.com/custom-sitemap.xml"
                    : "https://yourwebsite.com"
                }
                value={settings.sitemapUrl}
                onChange={(e) => setSettings({ ...settings, sitemapUrl: e.target.value })}
              />
              {settings.sitemapType !== 'custom' && settings.sitemapUrl && (
                <div className="text-sm bg-muted/50 p-2 rounded">
                  <span className="text-muted-foreground">Sitemap URL: </span>
                  <code className="text-primary">
                    {settings.sitemapUrl.replace(/\/$/, '')}
                    {settings.sitemapType === 'wordpress' && '/wp-sitemap.xml'}
                    {settings.sitemapType === 'yoast' && '/sitemap_index.xml'}
                    {settings.sitemapType === 'rankmath' && '/sitemap_index.xml'}
                    {settings.sitemapType === 'standard' && '/sitemap.xml'}
                    {settings.sitemapType === 'auto' && ' (auto-detect)'}
                  </code>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Image Quality */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Image Quality
            </CardTitle>
            <CardDescription>
              Control the quality vs speed tradeoff for generated images.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={settings.imageQuality}
              onValueChange={(value) => setSettings({ ...settings, imageQuality: value as 'low' | 'medium' | 'high' })}
              className="grid gap-3"
            >
              {QUALITY_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center space-x-3">
                  <RadioGroupItem value={option.value} id={`quality-${option.value}`} />
                  <Label htmlFor={`quality-${option.value}`} className="flex-1 cursor-pointer">
                    <div className="font-medium">{option.label}</div>
                    <div className="text-sm text-muted-foreground">{option.desc}</div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Aspect Ratio */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="w-5 h-5" />
              Image Aspect Ratio
            </CardTitle>
            <CardDescription>
              Select the aspect ratio for generated article images.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {ASPECT_RATIOS.map((ratio) => (
                <button
                  key={ratio.value}
                  onClick={() => setSettings({ ...settings, aspectRatio: ratio.value })}
                  className={cn(
                    "p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2",
                    settings.aspectRatio === ratio.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <div
                    className={cn(
                      "border-2 rounded",
                      settings.aspectRatio === ratio.value
                        ? "border-primary bg-primary/20"
                        : "border-muted-foreground/50"
                    )}
                    style={getAspectRatioPreviewStyle(ratio.value)}
                  />
                  <div className="text-center">
                    <div className="font-medium text-sm">{ratio.label}</div>
                    <div className="text-xs text-muted-foreground">{ratio.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            
            {/* Current selection preview */}
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Selected Dimensions:</span>
                <span className="font-mono font-medium">
                  {ASPECT_RATIOS.find(r => r.value === settings.aspectRatio)?.width || 1920} × {ASPECT_RATIOS.find(r => r.value === settings.aspectRatio)?.height || 1080} px
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              AI API Configuration
            </CardTitle>
            <CardDescription>
              Configure your AI provider for article generation. Switch providers if you hit rate limits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* AI Provider Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                AI Provider
              </Label>
              <Select
                value={settings.aiProvider}
                onValueChange={(value) => setSettings({ ...settings, aiProvider: value as SettingsData['aiProvider'] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select AI provider" />
                </SelectTrigger>
                <SelectContent>
                  {AI_PROVIDERS.map((provider) => (
                    <SelectItem key={provider.value} value={provider.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{provider.label}</span>
                        <span className="text-xs text-muted-foreground">{provider.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom API Key - only show for non-lovable providers */}
            {settings.aiProvider !== 'lovable' && (
              <div className="space-y-2">
                <Label>
                  {settings.aiProvider === 'groq' ? 'Groq API Key' : 'OpenAI API Key'}
                </Label>
                <Input
                  type="password"
                  placeholder={settings.aiProvider === 'groq' ? 'gsk_...' : 'sk-...'}
                  value={settings.customApiKey}
                  onChange={(e) => setSettings({ ...settings, customApiKey: e.target.value })}
                />
                <p className="text-sm text-muted-foreground">
                  {settings.aiProvider === 'groq' 
                    ? 'Get your free API key from console.groq.com'
                    : 'Get your API key from platform.openai.com'}
                </p>
              </div>
            )}

            {/* Replicate API Key for images */}
            <div className="space-y-2">
              <Label>Replicate API Key (for images)</Label>
              <Input
                type="password"
                placeholder="r8_..."
                value={settings.replicateApiKey}
                onChange={(e) => setSettings({ ...settings, replicateApiKey: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Optional: Use your own Replicate key for image generation. Leave empty to use default.
              </p>
            </div>

            {/* Status indicator */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  settings.aiProvider === 'lovable' ? "bg-green-500" : 
                  settings.customApiKey ? "bg-green-500" : "bg-yellow-500"
                )} />
                <span className="text-sm">
                  {settings.aiProvider === 'lovable' 
                    ? 'Using Lovable AI (built-in)' 
                    : settings.customApiKey 
                      ? `Using custom ${settings.aiProvider.toUpperCase()} API key`
                      : 'API key required for selected provider'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} size="lg">
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Settings;
