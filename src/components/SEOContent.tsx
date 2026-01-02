import { SEOContent as SEOContentType } from '@/types/recipe';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Hash, FileText, Bookmark } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface SEOContentProps {
  seo: SEOContentType;
}

export function SEOContent({ seo }: SEOContentProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copied to clipboard!`);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyAll = async () => {
    const allContent = `Title: ${seo.title}\n\nDescription: ${seo.description}\n\nHashtags: ${seo.hashtags.map(h => `#${h}`).join(' ')}`;
    await navigator.clipboard.writeText(allContent);
    toast.success('All SEO content copied!');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Pinterest SEO Copy
            </CardTitle>
            <Button variant="outline" size="sm" onClick={copyAll}>
              <Copy className="w-4 h-4 mr-2" />
              Copy All
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <Bookmark className="w-4 h-4" />
                Pin Title
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(seo.title, 'Title')}
              >
                {copied === 'Title' ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{seo.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {seo.title.length}/60 characters
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Pin Description
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(seo.description, 'Description')}
              >
                {copied === 'Description' ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">{seo.description}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {seo.description.length} characters
              </p>
            </div>
          </div>

          {/* Hashtags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <Hash className="w-4 h-4" />
                Hashtags
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(seo.hashtags.map(h => `#${h}`).join(' '), 'Hashtags')}
              >
                {copied === 'Hashtags' ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {seo.hashtags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-sm">
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
