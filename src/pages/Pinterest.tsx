import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Loader2,
  Search,
  Copy,
  Download,
  RefreshCw,
  Image as ImageIcon,
  FileText,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';

interface PinData {
  url: string;
  topic: string;
  imagePrompt: string;
  overlayText: string;
  interests: string;
  imageUrl?: string;
  isGenerating?: boolean;
  title?: string;
  description?: string;
}

type PinStyle = 'basic-top' | 'basic-middle' | 'basic-bottom' | 'collage' | 'custom';
type AspectRatio = '9:16' | '2:3' | '1:2';
type ImageModel = 'lovable' | 'replicate';

const PIN_STYLES = [
  { value: 'basic-top', label: 'Basic - Text at Top' },
  { value: 'basic-middle', label: 'Basic - Text at Middle' },
  { value: 'basic-bottom', label: 'Basic - Text at Bottom' },
  { value: 'collage', label: 'Collage - Multiple Images' },
  { value: 'custom', label: 'Custom - Your Brand Guidelines' },
];

const ASPECT_RATIOS = [
  { value: '9:16', label: '9:16 - Standard Pinterest (Recommended)' },
  { value: '2:3', label: '2:3 - Classic Portrait' },
  { value: '1:2', label: '1:2 - Tall Pin' },
];

const IMAGE_MODELS = [
  { value: 'lovable', label: 'Lovable AI' },
  { value: 'replicate', label: 'Replicate (Flux)' },
];

const Pinterest = () => {
  const [urlInput, setUrlInput] = useState('');
  const [pins, setPins] = useState<PinData[]>([]);
  const [pinStyle, setPinStyle] = useState<PinStyle>('basic-bottom');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [imageModel, setImageModel] = useState<ImageModel>('lovable');
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [isGeneratingTitles, setIsGeneratingTitles] = useState(false);
  const [isCreatingAllPins, setIsCreatingAllPins] = useState(false);

  const getSettings = () => {
    try {
      const saved = localStorage.getItem('article_settings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to parse settings:', e);
    }
    return {};
  };

  const handleGeneratePrompts = async () => {
    const urls = urlInput
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.startsWith('http'));

    if (urls.length === 0) {
      toast.error('Please enter at least one valid URL');
      return;
    }

    setIsGeneratingPrompts(true);
    const settings = getSettings();

    try {
      const { data, error } = await supabase.functions.invoke('generate-pinterest-prompts', {
        body: {
          urls,
          pinStyle,
          customStyleGuidelines: settings.pinterestStyleGuidelines || '',
        },
      });

      if (error) throw error;

      if (data?.success && data?.prompts) {
        const newPins: PinData[] = data.prompts.map((p: any) => ({
          url: p.url,
          topic: p.topic,
          imagePrompt: p.imagePrompt,
          overlayText: p.overlayText,
          interests: '',
        }));
        setPins(newPins);
        toast.success(`Generated prompts for ${newPins.length} URLs`);
      }
    } catch (error) {
      console.error('Error generating prompts:', error);
      toast.error('Failed to generate prompts');
    } finally {
      setIsGeneratingPrompts(false);
    }
  };

  const handleCreatePin = async (index: number) => {
    const pin = pins[index];
    if (!pin) return;

    setPins(prev =>
      prev.map((p, i) => (i === index ? { ...p, isGenerating: true } : p))
    );

    try {
      const { data, error } = await supabase.functions.invoke('generate-pinterest-image', {
        body: {
          prompt: pin.imagePrompt,
          aspectRatio,
          imageModel,
        },
      });

      if (error) throw error;

      if (data?.success && data?.imageUrl) {
        setPins(prev =>
          prev.map((p, i) =>
            i === index ? { ...p, imageUrl: data.imageUrl, isGenerating: false } : p
          )
        );
        toast.success('Pin image generated!');
      } else {
        throw new Error(data?.error || 'Failed to generate image');
      }
    } catch (error) {
      console.error('Error generating pin:', error);
      toast.error('Failed to generate pin image');
      setPins(prev =>
        prev.map((p, i) => (i === index ? { ...p, isGenerating: false } : p))
      );
    }
  };

  const handleCreateAllPins = async () => {
    setIsCreatingAllPins(true);
    
    for (let i = 0; i < pins.length; i++) {
      if (!pins[i].imageUrl) {
        await handleCreatePin(i);
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    setIsCreatingAllPins(false);
    toast.success('All pins created!');
  };

  const handleRegenerateImage = async (index: number) => {
    setPins(prev =>
      prev.map((p, i) => (i === index ? { ...p, imageUrl: undefined } : p))
    );
    await handleCreatePin(index);
  };

  const handleGenerateTitles = async () => {
    if (pins.length === 0) {
      toast.error('Generate prompts first');
      return;
    }

    setIsGeneratingTitles(true);
    const settings = getSettings();

    try {
      const { data, error } = await supabase.functions.invoke('generate-pinterest-title', {
        body: {
          urls: pins.map(p => p.url),
          interests: pins.map(p => p.interests),
          customPrompt: settings.pinterestTitlePrompt || '',
        },
      });

      if (error) throw error;

      if (data?.success && data?.titles) {
        setPins(prev =>
          prev.map((p, i) => ({
            ...p,
            title: data.titles[i]?.title || p.title,
            description: data.titles[i]?.description || p.description,
          }))
        );
        toast.success('Titles and descriptions generated!');
      }
    } catch (error) {
      console.error('Error generating titles:', error);
      toast.error('Failed to generate titles');
    } finally {
      setIsGeneratingTitles(false);
    }
  };

// Extract focus keyword from title (first main word after emoji)
  const extractFocusKeyword = (title: string): string => {
    if (!title) return 'pin';
    // Remove emoji at start and get the main topic
    const cleaned = title.replace(/^[\u{1F300}-\u{1F9FF}\s]+/u, '').trim();
    // Get first 2-3 meaningful words for filename
    const words = cleaned.split(/[\s–-]+/).filter(w => w.length > 2).slice(0, 3);
    return words.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'pin';
  };

  const handleDownloadPin = useCallback(async (pin: PinData) => {
    if (!pin.imageUrl) {
      toast.error('No image to download');
      return;
    }

    try {
      const response = await fetch(pin.imageUrl);
      const blob = await response.blob();
      
      // Convert to WebP
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);
          resolve();
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(blob);
      });
      
      const webpBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/webp', 0.9);
      });
      
      const url = URL.createObjectURL(webpBlob);
      const focusKeyword = extractFocusKeyword(pin.title || pin.topic);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${focusKeyword}.webp`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      URL.revokeObjectURL(img.src);
      toast.success('Pin downloaded as WebP!');
    } catch (error) {
      console.error('Error downloading:', error);
      toast.error('Failed to download pin');
    }
  }, []);

  const handleDownloadAll = async () => {
    for (const pin of pins) {
      if (pin.imageUrl) {
        await handleDownloadPin(pin);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copied!');
  };

  const handleClearAll = () => {
    setUrlInput('');
    setPins([]);
  };

  const updatePinField = (index: number, field: keyof PinData, value: string) => {
    setPins(prev =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const hasImages = pins.some(p => p.imageUrl);

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title mb-1">Pinterest Pin Creator</h1>
            <p className="text-muted-foreground">Generate Pinterest pins from your blog URLs</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleGenerateTitles}
              disabled={pins.length === 0 || isGeneratingTitles}
              variant="outline"
              className="gap-2"
            >
              {isGeneratingTitles ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Create Titles & Descriptions
            </Button>
            <Button
              onClick={handleCreateAllPins}
              disabled={pins.length === 0 || isCreatingAllPins}
              className="gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white border-0"
            >
              {isCreatingAllPins ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ImageIcon className="w-4 h-4" />
              )}
              Create All Pins
            </Button>
            <Button
              onClick={handleDownloadAll}
              disabled={!hasImages}
              className="gap-2 bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 text-white border-0"
            >
              <Download className="w-4 h-4" />
              Download All Images
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Left Sidebar - Input & Settings */}
          <div className="col-span-3 space-y-4">
            {/* URL Input */}
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="font-semibold">Input URLs</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAll}
                    className="text-muted-foreground hover:text-foreground h-auto py-1 px-2"
                  >
                    Clear All
                  </Button>
                </div>
                <Textarea
                  placeholder={`Paste your URLs here (one per line)\n\nExample:\nhttps://example.com/vegan-recipe\nhttps://example.com/baking-tips\nhttps://example.com/chocolate-cake`}
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  className="min-h-[180px] text-sm font-mono"
                />
              </CardContent>
            </Card>

            {/* Pin Style */}
            <Card className="border-border">
              <CardContent className="p-4">
                <Label className="font-semibold mb-2 block">Pin Style:</Label>
                <Select value={pinStyle} onValueChange={(v: PinStyle) => setPinStyle(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PIN_STYLES.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Aspect Ratio */}
            <Card className="border-border">
              <CardContent className="p-4">
                <Label className="font-semibold mb-2 block">Aspect Ratio:</Label>
                <Select value={aspectRatio} onValueChange={(v: AspectRatio) => setAspectRatio(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASPECT_RATIOS.map(a => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Image Model */}
            <Card className="border-border">
              <CardContent className="p-4">
                <Label className="font-semibold mb-2 block">Image Model:</Label>
                <Select value={imageModel} onValueChange={(v: ImageModel) => setImageModel(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_MODELS.map(m => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Generate Button */}
            <Button
              onClick={handleGeneratePrompts}
              disabled={isGeneratingPrompts || !urlInput.trim()}
              className="w-full gap-2 gradient-button border-0"
            >
              {isGeneratingPrompts ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Generate Prompts
            </Button>
          </div>

          {/* Main Content - Generated Pins */}
          <div className="col-span-9">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Generated Prompts & Pins</h2>
            </div>

            {pins.length === 0 ? (
              <div className="card-modern p-12 text-center text-muted-foreground">
                <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Enter URLs and click "Generate Prompts" to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {pins.map((pin, index) => (
                  <Card key={index} className="border-border overflow-hidden">
                    <CardContent className="p-3 space-y-3">
                      {/* URL */}
                      <div className="flex items-center gap-2">
                        <a
                          href={pin.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline truncate flex-1"
                        >
                          {pin.url.length > 35 ? pin.url.substring(0, 35) + '...' : pin.url}
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleCopyUrl(pin.url)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>

                      {/* Image Preview */}
                      <div className="aspect-[9/16] bg-muted rounded-lg overflow-hidden relative">
                        {pin.isGenerating ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-muted">
                            <div className="text-center">
                              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
                              <p className="text-xs text-muted-foreground">Generating image...</p>
                            </div>
                          </div>
                        ) : pin.imageUrl ? (
                          <img
                            src={pin.imageUrl}
                            alt={pin.topic}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                          </div>
                        )}
                        {/* Overlay Text Preview */}
                        {pin.overlayText && !pin.imageUrl && (
                          <div className="absolute bottom-4 left-0 right-0 text-center">
                            <span className="bg-black/60 text-white text-xs font-bold px-3 py-1.5 rounded">
                              {pin.overlayText}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Interests */}
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                          Annotated Interests (for titles/descriptions)
                        </Label>
                        <Input
                          value={pin.interests}
                          onChange={e => updatePinField(index, 'interests', e.target.value)}
                          placeholder="e.g., vegan, healthy, meal prep"
                          className="mt-1 text-xs h-8"
                        />
                      </div>

                      {/* Image Prompt */}
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                          Image Prompt (Editable)
                        </Label>
                        <Textarea
                          value={pin.imagePrompt}
                          onChange={e => updatePinField(index, 'imagePrompt', e.target.value)}
                          className="mt-1 text-xs min-h-[60px]"
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            pin.imageUrl
                              ? handleRegenerateImage(index)
                              : handleCreatePin(index)
                          }
                          disabled={pin.isGenerating}
                          className="flex-1 gap-1 text-xs"
                        >
                          <RefreshCw className="w-3 h-3" />
                          {pin.imageUrl ? 'Regenerate' : 'Create Pin'}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleDownloadPin(pin)}
                          disabled={!pin.imageUrl}
                          className="flex-1 gap-1 text-xs bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white border-0"
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </Button>
                      </div>

                      {/* Title & Description if generated */}
                      {(pin.title || pin.description) && (
                        <div className="pt-2 border-t border-border space-y-2">
                          {pin.title && (
                            <div>
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Title</Label>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-2 text-xs gap-1"
                                  onClick={() => {
                                    navigator.clipboard.writeText(pin.title || '');
                                    toast.success('Title copied!');
                                  }}
                                >
                                  <Copy className="w-3 h-3" />
                                  Copy
                                </Button>
                              </div>
                              <p className="text-sm font-medium mt-1">{pin.title}</p>
                            </div>
                          )}
                          {pin.description && (
                            <div>
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Description</Label>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-2 text-xs gap-1"
                                  onClick={() => {
                                    // Copy without markdown formatting
                                    const plainText = (pin.description || '').replace(/\*\*([^*]+)\*\*/g, '$1');
                                    navigator.clipboard.writeText(plainText);
                                    toast.success('Description copied!');
                                  }}
                                >
                                  <Copy className="w-3 h-3" />
                                  Copy
                                </Button>
                              </div>
                              <p 
                                className="text-sm text-muted-foreground mt-1"
                                dangerouslySetInnerHTML={{
                                  __html: (pin.description || '').replace(
                                    /\*\*([^*]+)\*\*/g, 
                                    '<a href="#" class="text-primary font-medium hover:underline">$1</a>'
                                  )
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Pinterest;
