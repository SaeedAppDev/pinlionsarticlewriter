import { Headline } from '@/types/recipe';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Check, Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface HeadlinesListProps {
  headlines: Headline[];
}

const angleColors: Record<string, string> = {
  quick: 'bg-warning/10 text-warning border-warning/20',
  healthy: 'bg-success/10 text-success border-success/20',
  family: 'bg-info/10 text-info border-info/20',
  budget: 'bg-primary/10 text-primary border-primary/20',
  viral: 'bg-destructive/10 text-destructive border-destructive/20',
};

const angleEmojis: Record<string, string> = {
  quick: '⚡',
  healthy: '🥗',
  family: '👨‍👩‍👧‍👦',
  budget: '💰',
  viral: '🔥',
};

export function HeadlinesList({ headlines }: HeadlinesListProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyHeadline = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success('Headline copied!');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            AI-Generated Headlines
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {headlines.map((headline, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * index }}
                className="flex items-start justify-between p-4 bg-muted/50 rounded-xl hover:bg-muted transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium mb-2">{headline.text}</p>
                  <Badge variant="outline" className={angleColors[headline.angle]}>
                    {angleEmojis[headline.angle]} {headline.angle}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyHeadline(headline.text, index)}
                >
                  {copiedIndex === index ? (
                    <Check className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
