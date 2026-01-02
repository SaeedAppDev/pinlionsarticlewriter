import { GeneratedPin } from '@/types/recipe';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRef } from 'react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';

interface PinPreviewProps {
  pin: GeneratedPin;
  index: number;
}

const angleEmojis: Record<string, string> = {
  quick: '⚡',
  healthy: '🥗',
  family: '👨‍👩‍👧‍👦',
  budget: '💰',
  viral: '🔥',
};

export function PinPreview({ pin, index }: PinPreviewProps) {
  const pinRef = useRef<HTMLDivElement>(null);

  const downloadPin = async () => {
    if (!pinRef.current) return;

    try {
      const dataUrl = await toPng(pinRef.current, {
        width: 1000,
        height: 1500,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        },
      });

      const link = document.createElement('a');
      link.download = `pinterest-pin-${pin.angle}-${index + 1}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Pin downloaded!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download pin');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="overflow-hidden shadow-lg border-0 hover:shadow-xl transition-shadow">
        <CardContent className="p-0">
          {/* Pin Preview */}
          <div 
            ref={pinRef}
            className="relative aspect-[2/3] overflow-hidden bg-muted"
          >
            <img
              src={pin.imageUrl}
              alt={pin.headline.text}
              className="w-full h-full object-cover"
            />
            <div className="pin-overlay">
              <div className="space-y-2">
                <p className="text-lg md:text-xl font-bold text-primary-foreground leading-tight drop-shadow-lg">
                  {pin.overlayText}
                </p>
              </div>
            </div>
          </div>

          {/* Pin Info */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">
                {angleEmojis[pin.angle]} {pin.angle}
              </Badge>
              <span className="text-xs text-muted-foreground">Pin #{index + 1}</span>
            </div>
            
            <p className="text-sm font-medium line-clamp-2">
              {pin.headline.text}
            </p>

            <Button onClick={downloadPin} className="w-full" variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Download Pin
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
