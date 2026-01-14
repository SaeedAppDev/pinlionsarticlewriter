import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Save, FileText, List, Code, Image as ImageIcon, Check } from 'lucide-react';
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

const Settings = () => {
  const [openaiKey, setOpenaiKey] = useState('');
  const [replicateToken, setReplicateToken] = useState('');
  const [replicateModel, setReplicateModel] = useState('google-nano-banana-pro');
  const [imageGenModel, setImageGenModel] = useState('z-image-turbo');
  const [generateInTextImages, setGenerateInTextImages] = useState(true);
  const [inTextImageCount, setInTextImageCount] = useState('4');
  const [inTextAspectRatio, setInTextAspectRatio] = useState('9:16');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_api_settings')
        .select('openai_api_key, replicate_api_token, replicate_model')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setOpenaiKey(data.openai_api_key || '');
        setReplicateToken(data.replicate_api_token || '');
        setReplicateModel(data.replicate_model || 'google-nano-banana-pro');
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

      const { error } = await supabase
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

      if (error) throw error;
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
    </div>
  );
};

export default Settings;
