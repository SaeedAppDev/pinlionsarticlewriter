import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Code, Upload, Loader2, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  title: string;
  description: string;
  imageUrl?: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
}

const PinCreator = () => {
  const [urlInput, setUrlInput] = useState('');
  const [pinStyle, setPinStyle] = useState('basic-middle');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [imageModel, setImageModel] = useState('ideogram');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedPins, setGeneratedPins] = useState<GeneratedPin[]>([]);

  const handleClearAll = () => {
    setUrlInput('');
    setGeneratedPins([]);
    toast.success('Cleared all URLs');
  };

  const handleLoadUrls = async () => {
    const urls = urlInput
      .split('\n')
      .map(url => url.trim())
      .filter(url => url && url.startsWith('http'));

    if (urls.length === 0) {
      toast.error('Please enter valid URLs');
      return;
    }

    setIsLoading(true);
    
    // Create pending pins for each URL
    const newPins: GeneratedPin[] = urls.map((url, index) => ({
      id: `pin-${Date.now()}-${index}`,
      url,
      title: '',
      description: '',
      status: 'pending',
    }));
    
    setGeneratedPins(newPins);
    toast.success(`Loaded ${urls.length} URLs for processing`);
    setIsLoading(false);
  };

  return (
    <div className="flex h-full">
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
            className="min-h-[250px] font-mono text-sm bg-background resize-none"
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

        {/* Load URLs Button */}
        <Button
          onClick={handleLoadUrls}
          disabled={isLoading || !urlInput.trim()}
          className="gradient-button text-white border-0"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Code className="w-4 h-4 mr-2" />
          )}
          Load URLs
        </Button>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 p-8 overflow-y-auto bg-background">
        <h2 className="text-xl font-semibold text-foreground mb-6">
          Generated Prompts & Pins
        </h2>

        {generatedPins.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
            <Upload className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-center">
              Enter URLs above to generate Pinterest pin prompts
            </p>
          </div>
        ) : (
          /* Generated Pins Grid */
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {generatedPins.map((pin) => (
              <Card key={pin.id} className="p-4 bg-card border-border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {pin.url}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      setGeneratedPins(prev => prev.filter(p => p.id !== pin.id));
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {pin.status === 'pending' && (
                  <div className="aspect-[9/16] bg-muted rounded-lg flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Ready to generate</p>
                    </div>
                  </div>
                )}

                {pin.status === 'generating' && (
                  <div className="aspect-[9/16] bg-muted rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Generating...</p>
                    </div>
                  </div>
                )}

                {pin.status === 'completed' && pin.imageUrl && (
                  <div className="aspect-[9/16] bg-muted rounded-lg overflow-hidden">
                    <img
                      src={pin.imageUrl}
                      alt={pin.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {pin.title && (
                  <div className="mt-3">
                    <h4 className="font-medium text-foreground text-sm">{pin.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {pin.description}
                    </p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PinCreator;
