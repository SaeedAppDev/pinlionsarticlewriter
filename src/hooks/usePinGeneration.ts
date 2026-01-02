import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GeneratedPin, ImagePrompt, Headline } from '@/types/recipe';
import { toast } from 'sonner';

export function usePinGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPins, setGeneratedPins] = useState<GeneratedPin[]>([]);
  const [progress, setProgress] = useState(0);

  const generatePins = async (
    imagePrompts: ImagePrompt[],
    headlines: Headline[],
    dishName: string
  ) => {
    setIsGenerating(true);
    setProgress(0);
    setGeneratedPins([]);

    const pins: GeneratedPin[] = [];
    const totalPins = Math.min(imagePrompts.length, 5);

    for (let i = 0; i < totalPins; i++) {
      try {
        const imagePrompt = imagePrompts[i];
        const headline = headlines[i] || headlines[0];

        const { data, error } = await supabase.functions.invoke('generate-pin-image', {
          body: { prompt: imagePrompt.prompt, dishName },
        });

        if (error) throw error;

        if (data.error) {
          console.error('Image generation error:', data.error);
          continue;
        }

        const pin: GeneratedPin = {
          id: `pin-${Date.now()}-${i}`,
          imageUrl: data.imageUrl,
          overlayText: imagePrompt.overlayText,
          angle: imagePrompt.angle,
          headline,
        };

        pins.push(pin);
        setGeneratedPins([...pins]);
        setProgress(((i + 1) / totalPins) * 100);
      } catch (error) {
        console.error(`Failed to generate pin ${i + 1}:`, error);
      }
    }

    setIsGenerating(false);
    
    if (pins.length > 0) {
      toast.success(`Generated ${pins.length} Pinterest pins!`);
    } else {
      toast.error('Failed to generate any pins. Please try again.');
    }

    return pins;
  };

  const resetPins = () => {
    setGeneratedPins([]);
    setProgress(0);
  };

  return {
    isGenerating,
    generatedPins,
    progress,
    generatePins,
    resetPins,
  };
}
