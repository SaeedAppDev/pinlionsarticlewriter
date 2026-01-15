import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  MessageSquare, 
  Upload, 
  Loader2, 
  Settings, 
  Copy, 
  FileText, 
  Download,
  Image as ImageIcon,
  RefreshCw,
  Sun,
  Moon
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useTheme } from '@/hooks/useTheme';

const pinStyles = [
  { value: 'basic-top', label: 'Basic - Text at Top' },
  { value: 'basic-middle', label: 'Basic - Text at Middle' },
  { value: 'basic-bottom', label: 'Basic - Text at Bottom' },
  { value: 'collage', label: 'Collage - Multiple Images' },
  { value: 'custom', label: 'Custom - Your Brand Guidelines' },
];

const aspectRatios = [
  { value: '9:16', label: '9:16 - Standard Pinterest (Recommended)' },
  { value: '2:3', label: '2:3 - Classic Portrait' },
  { value: '1:2', label: '1:2 - Tall Pin' },
];

const imageModels = [
  { value: 'ideogram', label: 'Ideogram' },
  { value: 'seedream', label: 'SeeDream-4' },
  { value: 'google-imagen', label: 'Google Imagen' },
];

interface GeneratedPin {
  id: string;
  url: string;
  annotatedInterests: string;
  aiPrompt: string;
  title: string;
  description: string;
  imageUrl?: string;
  imagePrompt: string;
  status: 'pending' | 'prompt_generated' | 'title_generated' | 'generating_image' | 'completed' | 'error';
}

const PinCreator = () => {
  const { theme, toggleTheme } = useTheme();
  const [urlInput, setUrlInput] = useState('');
  const [pinStyle, setPinStyle] = useState('basic-middle');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [imageModel, setImageModel] = useState('ideogram');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedPins, setGeneratedPins] = useState<GeneratedPin[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Settings state
  const [licenseKey, setLicenseKey] = useState('');
  const [replicateApiToken, setReplicateApiToken] = useState('');
  const [customStyleGuidelines, setCustomStyleGuidelines] = useState('');
  const [titleDescriptionPrompt, setTitleDescriptionPrompt] = useState('');

  const handleClearAll = () => {
    setUrlInput('');
    setGeneratedPins([]);
    toast.success('Cleared all URLs');
  };

  const handleGeneratePrompts = async () => {
    const urls = urlInput
      .split('\n')
      .map(url => url.trim())
      .filter(url => url && url.startsWith('http'));

    if (urls.length === 0) {
      toast.error('Please enter valid URLs');
      return;
    }

    setIsLoading(true);
    
    // Create pins with initial prompt for each URL
    const newPins: GeneratedPin[] = urls.map((url, index) => ({
      id: `pin-${Date.now()}-${index}`,
      url,
      annotatedInterests: '',
      aiPrompt: `This Pinterest pin is viral. A slow cooker filled with juicy chicken and colorful vegetables, ready for meal prep on a kitchen counter. Text Overlay: "${extractTitleFromUrl(url)}" in bold white font.`,
      title: '',
      description: '',
      imagePrompt: '',
      status: 'prompt_generated',
    }));
    
    setGeneratedPins(newPins);
    toast.success(`Generated prompts for ${urls.length} URLs`);
    setIsLoading(false);
  };

  const extractTitleFromUrl = (url: string): string => {
    try {
      const pathname = new URL(url).pathname;
      const slug = pathname.split('/').filter(Boolean).pop() || '';
      return slug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .substring(0, 50);
    } catch {
      return 'Delicious Recipe';
    }
  };

  const handleCreateTitlesDescriptions = async () => {
    setIsLoading(true);
    
    // Simulate AI generating titles and descriptions
    const updatedPins = generatedPins.map(pin => ({
      ...pin,
      title: `🍗 ${extractTitleFromUrl(pin.url)}`,
      description: `This **high-protein chicken crockpot recipes** guide helps you create **healthy**, delicious, and **make-ahead** meals effortlessly. Discover simple techniques to save time while fueling your body with nutrient-rich **meal prep** ideas. Perfect for busy weekdays and healthy living!`,
      status: 'title_generated' as const,
    }));
    
    setGeneratedPins(updatedPins);
    toast.success('Generated titles and descriptions for all pins');
    setIsLoading(false);
  };

  const handleCreateAllPins = async () => {
    setIsLoading(true);
    
    // Simulate image generation
    const updatedPins = generatedPins.map(pin => ({
      ...pin,
      imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&h=1000&fit=crop',
      imagePrompt: pin.aiPrompt,
      status: 'completed' as const,
    }));
    
    setGeneratedPins(updatedPins);
    toast.success('Created all pins');
    setIsLoading(false);
  };

  const handleCreateSinglePin = async (pinId: string) => {
    const pin = generatedPins.find(p => p.id === pinId);
    if (!pin) return;

    setGeneratedPins(prev => prev.map(p => 
      p.id === pinId ? { ...p, status: 'generating_image' } : p
    ));
    
    try {
      // Import supabase client
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Extract the title text without emoji for overlay
      const overlayText = pin.title.replace(/^[\p{Emoji}\s]+/u, '').trim() || extractTitleFromUrl(pin.url);
      
      // Call the edge function with the overlay text
      const { data, error } = await supabase.functions.invoke('generate-pinterest-image', {
        body: {
          prompt: pin.aiPrompt,
          aspectRatio: aspectRatio,
          imageModel: imageModel === 'ideogram' ? 'lovable' : 'replicate',
          overlayText: overlayText, // Pass the title as overlay text
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setGeneratedPins(prev => prev.map(p => 
        p.id === pinId ? {
          ...p,
          imageUrl: data.imageUrl,
          imagePrompt: pin.aiPrompt,
          status: 'completed',
        } : p
      ));
      toast.success('Pin created with text overlay!');
    } catch (error) {
      console.error('Error creating pin:', error);
      toast.error('Failed to create pin. Please try again.');
      setGeneratedPins(prev => prev.map(p => 
        p.id === pinId ? { ...p, status: 'title_generated' } : p
      ));
    }
  };

  const handleCopyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleExportCSV = () => {
    const headers = ['URL', 'Title', 'Description', 'Image URL'];
    const rows = generatedPins.map(pin => [
      pin.url,
      pin.title,
      pin.description.replace(/\*\*/g, ''),
      pin.imageUrl || '',
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pinterest-pins.csv';
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('CSV exported successfully');
  };

  const handleSaveSettings = () => {
    toast.success('Settings saved successfully');
    setSettingsOpen(false);
  };

  const updatePinField = (pinId: string, field: keyof GeneratedPin, value: string) => {
    setGeneratedPins(prev => prev.map(pin => 
      pin.id === pinId ? { ...pin, [field]: value } : pin
    ));
  };

  const renderDescription = (description: string) => {
    // Convert **keyword** to styled spans
    const parts = description.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const keyword = part.slice(2, -2);
        return (
          <span key={index} className="text-primary font-medium underline cursor-pointer">
            {keyword}
          </span>
        );
      }
      return part;
    });
  };

  const hasPins = generatedPins.length > 0;
  const hasPrompts = generatedPins.some(p => p.status !== 'pending');
  const hasTitles = generatedPins.some(p => p.title);
  const hasImages = generatedPins.some(p => p.imageUrl);

  return (
    <div className="flex flex-col h-full">
      {/* Top Header */}
      <div className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Pin Lions Pin Creator</h1>
            <p className="text-sm text-muted-foreground">AI-powered Pinterest pin creation</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </Button>
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Pin Creator Settings</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                {/* License Key */}
                <div className="space-y-2">
                  <Label htmlFor="licenseKey">License Key</Label>
                  <Input
                    id="licenseKey"
                    type="password"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    placeholder="Enter your license key"
                    className="bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your license key for accessing premium features
                  </p>
                </div>

                {/* Replicate API Token */}
                <div className="space-y-2">
                  <Label htmlFor="replicateToken">Replicate API Token</Label>
                  <Input
                    id="replicateToken"
                    type="password"
                    value={replicateApiToken}
                    onChange={(e) => setReplicateApiToken(e.target.value)}
                    placeholder="r8_xxxxxxxxxxxxxxxxxxxxxxxx"
                    className="bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    Get your API token from{' '}
                    <a
                      href="https://replicate.com/account/api-tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      replicate.com
                    </a>
                  </p>
                </div>

                {/* Custom Style Guidelines */}
                <div className="space-y-2">
                  <Label htmlFor="styleGuidelines">Custom Style Guidelines</Label>
                  <Textarea
                    id="styleGuidelines"
                    value={customStyleGuidelines}
                    onChange={(e) => setCustomStyleGuidelines(e.target.value)}
                    placeholder="Enter your custom style guidelines for pin generation...

Example:
- Use vibrant, warm colors
- Include food photography styling
- Add text overlay with recipe title
- Use modern, clean fonts"
                    className="min-h-[120px] bg-background resize-none"
                  />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Define your brand style guidelines that the AI will follow when generating pin descriptions.</p>
                    <p><strong>Note:</strong> Your guidelines will be used as instructions to generate prompts that match your brand style.</p>
                    <p>All prompts will automatically start with "This Pinterest pin is viral" and include the URL topic.</p>
                    <p>This will be used when you select "Custom" as the pin style.</p>
                  </div>
                </div>

                {/* Title & Description Generation Prompt */}
                <div className="space-y-2">
                  <Label htmlFor="titleDescPrompt">Title & Description Generation Prompt (Optional)</Label>
                  <Textarea
                    id="titleDescPrompt"
                    value={titleDescriptionPrompt}
                    onChange={(e) => setTitleDescriptionPrompt(e.target.value)}
                    placeholder={`You're a Pinterest content writer optimizing blog posts for maximum search visibility and clicks.

For this blog post URL, write:

1. A Pinterest title (under 80 characters) that starts with an emoji and includes the main keyword

2. A Pinterest description (EXACTLY 3 sentences, NO MORE) that clearly summarizes the post

CRITICAL RULES FOR DESCRIPTION:
- EXACTLY 3 sentences (not 4, not 5, just 3)
- Main keyword must appear in the first sentence
- Bold 3-4 searchable SEO keywords using **keyword** syntax
- Be concise and punchy - every word must count
- Focus on benefits and what readers will learn/get
- Keywords should flow naturally, not feel forced

Blog post URL: \${url}\${interestsNote}

Format your response EXACTLY like this example:

🥗 Vegan Buddha Bowl – Clean, Colorful, and Fully Customizable

This **vegan Buddha bowl** is packed with **plant-based ingredients**, quinoa, and roasted vegetables. Perfect for **meal prep** or a quick **healthy lunch**. Customizable, colorful, and delicious!

Generate the title and description now (remember: EXACTLY 3 sentences):`}
                    className="min-h-[200px] bg-background resize-none font-mono text-xs"
                  />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Customize the prompt sent to ChatGPT for generating Pinterest titles and descriptions.</p>
                    <p><strong>Available variables:</strong> <code className="bg-muted px-1 rounded">${'{url}'}</code> - Blog post URL, <code className="bg-muted px-1 rounded">${'{interestsNote}'}</code> - Annotated interests</p>
                    <p><strong>Tip:</strong> Adjust character limits, sentence count, keyword rules, or tone to match your brand.</p>
                    <p>Leave empty to use the default prompt.</p>
                  </div>
                </div>

                <Button onClick={handleSaveSettings} className="gradient-button text-white border-0">
                  Save & Close
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-80 border-r border-border bg-card p-6 flex flex-col gap-6 overflow-y-auto">
          {/* Input URLs Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground">Input URLs</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
                className="text-xs"
              >
                Clear All
              </Button>
            </div>
            <Textarea
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder={`Paste your URLs here (one per line)

Example:
https://example.com/vegan-recipe
https://example.com/baking-tips
https://example.com/chocolate-cake`}
              className="min-h-[200px] font-mono text-sm bg-background resize-none"
            />
          </div>

          {/* Pin Style */}
          <Card className="p-4 bg-card border-border">
            <label className="text-sm font-medium text-foreground mb-2 block">
              Pin Style:
            </label>
            <Select value={pinStyle} onValueChange={setPinStyle}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pinStyles.map((style) => (
                  <SelectItem key={style.value} value={style.value}>
                    {style.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          {/* Aspect Ratio */}
          <Card className="p-4 bg-card border-border">
            <label className="text-sm font-medium text-foreground mb-2 block">
              Aspect Ratio:
            </label>
            <Select value={aspectRatio} onValueChange={setAspectRatio}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {aspectRatios.map((ratio) => (
                  <SelectItem key={ratio.value} value={ratio.value}>
                    {ratio.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          {/* Image Model */}
          <Card className="p-4 bg-card border-border">
            <label className="text-sm font-medium text-foreground mb-2 block">
              Image Model:
            </label>
            <Select value={imageModel} onValueChange={setImageModel}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {imageModels.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          {/* Generate Prompts Button */}
          <Button
            onClick={handleGeneratePrompts}
            disabled={isLoading || !urlInput.trim()}
            className="gradient-button text-white border-0"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <MessageSquare className="w-4 h-4 mr-2" />
            )}
            Generate Prompts
          </Button>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 overflow-y-auto bg-background">
          {/* Action Buttons Header */}
          <div className="sticky top-0 z-10 bg-background border-b border-border px-8 py-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Generated Prompts & Pins
            </h2>
            {hasPins && (
              <div className="flex items-center gap-3">
                {!hasTitles && hasPrompts && (
                  <Button
                    variant="outline"
                    onClick={handleCreateTitlesDescriptions}
                    disabled={isLoading}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Create Titles & Descriptions
                  </Button>
                )}
                {hasTitles && !hasImages && (
                  <Button
                    onClick={handleCreateAllPins}
                    disabled={isLoading}
                    className="gradient-button text-white border-0"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Create All Pins
                  </Button>
                )}
                {hasImages && (
                  <>
                    <Button
                      onClick={handleCreateAllPins}
                      disabled={isLoading}
                      className="gradient-button text-white border-0"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Create All Pins
                    </Button>
                    <Button variant="outline" onClick={handleExportCSV}>
                      <FileText className="w-4 h-4 mr-2" />
                      Export CSV for Pinterest
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="p-8">
            {generatedPins.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
                <Upload className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-center">
                  Enter URLs above to generate Pinterest pin prompts
                </p>
              </div>
            ) : (
              /* Generated Pins List */
              <div className="space-y-6 max-w-2xl">
                {generatedPins.map((pin) => (
                  <Card key={pin.id} className="p-6 bg-card border-border">
                    {/* URL Header */}
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <a
                        href={pin.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-sm break-all flex-1"
                      >
                        {pin.url}
                      </a>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyToClipboard(pin.url, 'URL')}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </Button>
                    </div>

                    {/* Generated Image */}
                    {pin.imageUrl && (
                      <div className="mb-4">
                        <img
                          src={pin.imageUrl}
                          alt={pin.title}
                          className="w-full max-w-md mx-auto rounded-lg shadow-lg"
                          style={{ aspectRatio: aspectRatio.replace(':', '/') }}
                        />
                      </div>
                    )}

                    {/* Annotated Interests */}
                    <div className="mb-4">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">
                        Annotated Interests (for Titles/Descriptions)
                      </label>
                      <Input
                        value={pin.annotatedInterests}
                        onChange={(e) => updatePinField(pin.id, 'annotatedInterests', e.target.value)}
                        placeholder="e.g., vegan, healthy, meal prep"
                        className="bg-background"
                      />
                    </div>

                    {/* AI Generated Prompt (before title generation) */}
                    {pin.status === 'prompt_generated' && (
                      <>
                        <div className="mb-4">
                          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">
                            AI-Generated Prompt
                          </label>
                          <Textarea
                            value={pin.aiPrompt}
                            onChange={(e) => updatePinField(pin.id, 'aiPrompt', e.target.value)}
                            className="min-h-[100px] bg-background resize-none font-mono text-sm"
                          />
                        </div>
                        <Button
                          onClick={() => {
                            updatePinField(pin.id, 'title', `🍗 ${extractTitleFromUrl(pin.url)}`);
                            updatePinField(pin.id, 'description', `This **high-protein chicken crockpot recipes** guide helps you create **healthy**, delicious, and **make-ahead** meals effortlessly. Discover simple techniques to save time while fueling your body with nutrient-rich **meal prep** ideas. Perfect for busy weekdays and healthy living!`);
                            setGeneratedPins(prev => prev.map(p => 
                              p.id === pin.id ? { ...p, status: 'title_generated' } : p
                            ));
                          }}
                          className="gradient-button text-white border-0"
                          size="sm"
                        >
                          <ImageIcon className="w-4 h-4 mr-2" />
                          Create Pin
                        </Button>
                      </>
                    )}

                    {/* Title & Description (after generation) */}
                    {(pin.status === 'title_generated' || pin.status === 'generating_image' || pin.status === 'completed') && (
                      <>
                        {/* Title */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Title
                            </label>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyToClipboard(pin.title, 'Title')}
                              className="h-6 px-2"
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              Copy
                            </Button>
                          </div>
                          <p className="text-lg font-semibold text-foreground">{pin.title}</p>
                        </div>

                        {/* Description */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Description
                            </label>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyToClipboard(pin.description.replace(/\*\*/g, ''), 'Description')}
                              className="h-6 px-2"
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              Copy
                            </Button>
                          </div>
                          <p className="text-sm text-foreground leading-relaxed">
                            {renderDescription(pin.description)}
                          </p>
                        </div>

                        {/* Create Pin button (if not yet created) */}
                        {pin.status === 'title_generated' && (
                          <Button
                            onClick={() => handleCreateSinglePin(pin.id)}
                            className="gradient-button text-white border-0"
                            size="sm"
                          >
                            <ImageIcon className="w-4 h-4 mr-2" />
                            Create Pin
                          </Button>
                        )}

                        {/* Generating state */}
                        {pin.status === 'generating_image' && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Generating image...</span>
                          </div>
                        )}

                        {/* Image Prompt & Actions (after image generation) */}
                        {pin.status === 'completed' && (
                          <>
                            <div className="mb-4">
                              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">
                                Image Prompt (Editable)
                              </label>
                              <Textarea
                                value={pin.imagePrompt}
                                onChange={(e) => updatePinField(pin.id, 'imagePrompt', e.target.value)}
                                className="min-h-[80px] bg-background resize-none font-mono text-sm"
                              />
                            </div>
                            <div className="flex items-center gap-3">
                              <Button variant="outline" size="sm">
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Regenerate Image
                              </Button>
                              <Button 
                                className="gradient-button text-white border-0"
                                size="sm"
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Download Pin
                              </Button>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PinCreator;
