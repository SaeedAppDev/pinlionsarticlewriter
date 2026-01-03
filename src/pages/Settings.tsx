import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { ArrowLeft, Settings as SettingsIcon, Save, Image, Link2, Sparkles } from 'lucide-react';
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

interface SettingsData {
  sitemapUrl: string;
  imageQuality: 'low' | 'medium' | 'high';
  aspectRatio: string;
}

const DEFAULT_SETTINGS: SettingsData = {
  sitemapUrl: '',
  imageQuality: 'medium',
  aspectRatio: '16:9',
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
        {/* Sitemap URL */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              Default Sitemap URL
            </CardTitle>
            <CardDescription>
              Set your website's sitemap URL for automatic internal linking in generated articles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="url"
              placeholder="https://yourwebsite.com/sitemap.xml"
              value={settings.sitemapUrl}
              onChange={(e) => setSettings({ ...settings, sitemapUrl: e.target.value })}
            />
            <p className="text-sm text-muted-foreground mt-2">
              This URL will be used by default when generating articles to add relevant internal links.
            </p>
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
