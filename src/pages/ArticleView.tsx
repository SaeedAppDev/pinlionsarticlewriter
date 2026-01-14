import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Copy, Check, Wand2, Loader2, Upload, ExternalLink, Trash2, FileText, Image as ImageIcon, Calendar, Globe, CheckCircle, Sparkles, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { format } from "date-fns";

interface WordPressSite {
  id: string;
  name: string;
  url: string;
  username: string;
  apiKey: string;
}

interface PinterestPin {
  imageUrl?: string;
  title?: string;
  description?: string;
  isGenerating?: boolean;
}

const ArticleView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<{ title: string; content_html: string; updated_at: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [wordpressSites, setWordpressSites] = useState<WordPressSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [wpSuccess, setWpSuccess] = useState<{ editUrl: string } | null>(null);
  
  // Pinterest states
  const [showPinterest, setShowPinterest] = useState(false);
  const [pinterestPin, setPinterestPin] = useState<PinterestPin>({});
  const [isGeneratingPinImage, setIsGeneratingPinImage] = useState(false);
  const [isGeneratingPinTitle, setIsGeneratingPinTitle] = useState(false);
  const [isRegeneratingImages, setIsRegeneratingImages] = useState(false);

  const hasMissingImages = (content: string | null) => {
    if (!content) return false;
    return /\{\{IMAGE_\d+\}\}/.test(content);
  };

  const handleRegenerateImages = async () => {
    if (!id) return;
    setIsRegeneratingImages(true);
    toast.info('Regenerating missing images...');
    
    try {
      const settings = localStorage.getItem('article_settings');
      const parsed = settings ? JSON.parse(settings) : {};
      
      const { data: { user } } = await supabase.auth.getUser();
      let customReplicateKey;
      if (user) {
        const { data: apiSettings } = await supabase
          .from('user_api_settings')
          .select('replicate_api_token, replicate_model')
          .eq('user_id', user.id)
          .single();
        customReplicateKey = apiSettings?.replicate_api_token;
      }

      const { data, error } = await supabase.functions.invoke('regenerate-images', {
        body: {
          articleId: id,
          aspectRatio: parsed.imageAspectRatio || '4:3',
          imageModel: parsed.imageModel || 'z-image-turbo',
          customReplicateKey,
        },
      });

      if (error) throw error;
      if (data?.success) {
        toast.success(`Regenerated ${data.regeneratedCount} images!`);
        fetchArticle();
      } else {
        throw new Error(data?.error || 'Failed to regenerate images');
      }
    } catch (err) {
      console.error('Error regenerating images:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to regenerate images');
    } finally {
      setIsRegeneratingImages(false);
    }
  };

  const fetchArticle = useCallback(async () => {
    if (!id) return;

    try {
      // Try articles table first (new system), then fall back to recipes
      const { data: articlesData, error: articlesError } = await supabase
        .from('articles')
        .select('title, content_html, updated_at')
        .eq('id', id)
        .single();
      
      if (articlesData && !articlesError) {
        setArticle(articlesData);
      } else {
        // Fallback to recipes table
        const { data: recipesData, error: recipesError } = await supabase
          .from('recipes')
          .select('title, article_content, updated_at')
          .eq('id', id)
          .single();
        
        if (recipesData && !recipesError) {
          setArticle({
            title: recipesData.title,
            content_html: recipesData.article_content || '',
            updated_at: recipesData.updated_at
          });
        } else {
          toast.error('Article not found');
        }
      }
    } catch (err) {
      console.error('Error:', err);
      toast.error('Failed to load article');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchArticle();
    // Load WordPress sites from settings
    const savedSettings = localStorage.getItem('article_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.wordpressSites && parsed.wordpressSites.length > 0) {
          setWordpressSites(parsed.wordpressSites);
          setSelectedSiteId(parsed.wordpressSites[0].id);
        }
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
  }, [fetchArticle]);

  // Process HTML - optimize images for lazy loading
  const processedContent = useMemo(() => {
    if (!article?.content_html) return '';
    
    // Replace base64 images with lazy loading and add placeholder
    return article.content_html
      .replace(/<img([^>]*)(src="data:image[^"]*")([^>]*)>/gi, 
        '<img$1$2$3 loading="lazy" decoding="async" style="background:#f3f4f6;min-height:200px">')
      .replace(/<img([^>]*)(src="http[^"]*")([^>]*)>/gi,
        '<img$1$2$3 loading="lazy" decoding="async">');
  }, [article?.content_html]);

  const getWordCount = (content: string | null) => {
    if (!content) return 0;
    const textOnly = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return textOnly.split(' ').filter(word => word.length > 0).length;
  };

  const getImageCount = (content: string | null) => {
    if (!content) return 0;
    const imgMatches = content.match(/<img[^>]*>/g);
    return imgMatches ? imgMatches.length : 0;
  };

  const handleCopyWPBlocks = useCallback(async () => {
    if (!article?.content_html) return;
    
    try {
      await navigator.clipboard.writeText(article.content_html);
      setCopied(true);
      toast.success('Copied as WP Blocks!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, [article?.content_html]);

  const handleSendToWordPress = useCallback(async () => {
    if (!article?.content_html || !article?.title) return;
    
    const selectedSite = wordpressSites.find(s => s.id === selectedSiteId);
    if (!selectedSite) {
      toast.error('Please select a WordPress site first');
      return;
    }

    setIsSending(true);
    setWpSuccess(null);

    try {
      const { data, error } = await supabase.functions.invoke('send-to-wordpress', {
        body: {
          siteUrl: selectedSite.url,
          username: selectedSite.username,
          apiKey: selectedSite.apiKey,
          title: article.title,
          content: article.content_html,
          status: 'draft',
        },
      });

      if (error) throw error;

      if (data?.success) {
        setWpSuccess({ editUrl: data.editUrl });
        toast.success('Article sent to WordPress!');
      } else {
        throw new Error(data?.error || 'Failed to send article');
      }
    } catch (err) {
      console.error('Error sending to WordPress:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to send article');
    } finally {
      setIsSending(false);
    }
  }, [article, selectedSiteId, wordpressSites]);

  const handleExportHTML = useCallback(() => {
    if (!article?.content_html || !article?.title) return;
    
    const blob = new Blob([article.content_html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${article.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('HTML exported!');
  }, [article]);

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!id) return;
    
    try {
      // Try articles table first, then fallback to recipes
      let error;
      const { error: articlesError } = await supabase
        .from('articles')
        .delete()
        .eq('id', id);
      
      if (articlesError) {
        const { error: recipesError } = await supabase
          .from('recipes')
          .delete()
          .eq('id', id);
        error = recipesError;
      }

      if (error) throw error;
      toast.success('Article deleted');
      navigate('/completed');
    } catch (error) {
      console.error('Error deleting article:', error);
      toast.error('Failed to delete article');
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  const handleFixArticle = useCallback(async () => {
    if (!article?.content_html || !id) return;

    setIsFixing(true);
    toast.info('Rewriting article with optimized SEO prompt...');

    try {
      const { data, error } = await supabase.functions.invoke('fix-article', {
        body: {
          articleContent: article.content_html,
          focusKeyword: article.title,
        },
      });

      if (error) throw error;

      if (data?.success && data?.rewrittenContent) {
        // Update the article in the database (try articles first, then recipes)
        let updateError;
        const { error: articlesUpdateError } = await supabase
          .from('articles')
          .update({ content_html: data.rewrittenContent })
          .eq('id', id);
        
        if (articlesUpdateError) {
          const { error: recipesUpdateError } = await supabase
            .from('recipes')
            .update({ article_content: data.rewrittenContent })
            .eq('id', id);
          updateError = recipesUpdateError;
        }

        if (updateError) throw updateError;

        // Refresh the article
        setArticle(prev => prev ? { ...prev, content_html: data.rewrittenContent } : null);
        toast.success('Article rewritten successfully!');
      } else {
        throw new Error(data?.error || 'Failed to rewrite article');
      }
    } catch (err) {
      console.error('Error fixing article:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to rewrite article');
    } finally {
      setIsFixing(false);
    }
  }, [article, id]);

  // Pinterest pin generation handlers
  const getSettings = () => {
    try {
      const saved = localStorage.getItem('article_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse settings:', e);
    }
    return {};
  };

  const handleGeneratePinImage = async () => {
    if (!article?.title) return;
    
    setIsGeneratingPinImage(true);
    setPinterestPin(prev => ({ ...prev, isGenerating: true }));

    try {
      const settings = getSettings();
      
      // First generate a prompt based on the article
      const { data: promptData, error: promptError } = await supabase.functions.invoke('generate-pinterest-prompts', {
        body: {
          urls: [`article://${article.title}`],
          pinStyle: 'basic-bottom',
          customStyleGuidelines: settings.pinterestStyleGuidelines || '',
          articleContent: article.content_html,
        },
      });

      if (promptError) throw promptError;

      const imagePrompt = promptData?.prompts?.[0]?.imagePrompt || `Professional food photography of ${article.title}, Pinterest style, 9:16 aspect ratio, soft natural lighting, appetizing presentation`;

      // Generate the image
      const { data, error } = await supabase.functions.invoke('generate-pinterest-image', {
        body: {
          prompt: imagePrompt,
          aspectRatio: '9:16',
          imageModel: 'lovable',
        },
      });

      if (error) throw error;

      if (data?.success && data?.imageUrl) {
        setPinterestPin(prev => ({ ...prev, imageUrl: data.imageUrl, isGenerating: false }));
        toast.success('Pinterest image generated!');
      } else {
        throw new Error(data?.error || 'Failed to generate image');
      }
    } catch (error) {
      console.error('Error generating pin image:', error);
      toast.error('Failed to generate Pinterest image');
      setPinterestPin(prev => ({ ...prev, isGenerating: false }));
    } finally {
      setIsGeneratingPinImage(false);
    }
  };

  const handleGeneratePinTitle = async () => {
    if (!article?.title) return;
    
    setIsGeneratingPinTitle(true);
    const settings = getSettings();

    try {
      const { data, error } = await supabase.functions.invoke('generate-pinterest-title', {
        body: {
          urls: [`article://${article.title}`],
          interests: [''],
          customPrompt: settings.pinterestTitlePrompt || '',
          articleTitle: article.title,
          articleContent: article.content_html,
        },
      });

      if (error) throw error;

      if (data?.success && data?.titles?.[0]) {
        setPinterestPin(prev => ({
          ...prev,
          title: data.titles[0].title,
          description: data.titles[0].description,
        }));
        toast.success('Title and description generated!');
      }
    } catch (error) {
      console.error('Error generating pin title:', error);
      toast.error('Failed to generate title');
    } finally {
      setIsGeneratingPinTitle(false);
    }
  };

  const extractFocusKeyword = (title: string): string => {
    if (!title) return 'pin';
    const cleaned = title.replace(/^[\u{1F300}-\u{1F9FF}\s]+/u, '').trim();
    const words = cleaned.split(/[\s–-]+/).filter(w => w.length > 2).slice(0, 3);
    return words.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'pin';
  };

  const handleDownloadPinImage = async () => {
    if (!pinterestPin.imageUrl) {
      toast.error('No image to download');
      return;
    }

    try {
      const response = await fetch(pinterestPin.imageUrl);
      const blob = await response.blob();
      
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
      const focusKeyword = extractFocusKeyword(pinterestPin.title || article?.title || 'pin');
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
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading article...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Article not found</p>
          <Button onClick={() => navigate('/completed')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Articles
          </Button>
        </div>
      </div>
    );
  }

  const wordCount = getWordCount(article.content_html);
  const imageCount = getImageCount(article.content_html);

  return (
    <>
      <div className="p-8 max-w-5xl mx-auto">
        {/* Header with Back and Actions */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/completed')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Articles
            </Button>
            
            {wordpressSites.length > 0 && (
              <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                <SelectTrigger className="w-[180px] bg-background">
                  <Globe className="w-4 h-4 mr-2 text-emerald-600" />
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  {wordpressSites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={handleCopyWPBlocks}
              className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              Copy as WP Blocks
            </Button>
            <Button 
              onClick={handleSendToWordPress}
              disabled={isSending || wordpressSites.length === 0}
              className="gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white border-0"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Send to WordPress
                </>
              )}
            </Button>
            <Button 
              onClick={() => setShowPinterest(!showPinterest)}
              className={`gap-2 ${showPinterest 
                ? 'bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600' 
                : 'bg-gradient-to-r from-pink-400 to-red-400 hover:from-pink-500 hover:to-red-500'
              } text-white border-0`}
            >
              <Sparkles className="w-4 h-4" />
              {showPinterest ? 'Hide Pinterest' : 'Pinterest Image'}
            </Button>
            <Button 
              onClick={handleExportHTML}
              className="gap-2 bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 text-white border-0"
            >
              <Download className="w-4 h-4" />
              Export HTML
            </Button>
            {hasMissingImages(article.content_html) && (
              <Button 
                onClick={handleRegenerateImages}
                disabled={isRegeneratingImages}
                className="gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
              >
                {isRegeneratingImages ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Regenerate Images
                  </>
                )}
              </Button>
            )}
            <Button 
              variant="outline"
              onClick={handleDeleteClick}
              className="gap-2 text-destructive border-destructive/50 hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          </div>
        </div>

        {/* Pinterest Image Generator Panel */}
        {showPinterest && (
          <div className="mb-6 p-6 bg-gradient-to-r from-pink-50 to-red-50 dark:from-pink-950/30 dark:to-red-950/30 border border-pink-200 dark:border-pink-800 rounded-xl">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-pink-600" />
              <h3 className="font-semibold text-lg text-foreground">Pinterest Image Generator</h3>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Image Preview */}
              <div className="aspect-[9/16] bg-muted rounded-lg overflow-hidden relative max-h-[400px]">
                {isGeneratingPinImage || pinterestPin.isGenerating ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-pink-500" />
                      <p className="text-sm text-muted-foreground">Generating image...</p>
                    </div>
                  </div>
                ) : pinterestPin.imageUrl ? (
                  <img
                    src={pinterestPin.imageUrl}
                    alt="Pinterest Pin"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">Click "Generate Image" to create a pin</p>
                  </div>
                )}
              </div>

              {/* Controls & Title/Description */}
              <div className="space-y-4">
                {/* Generate Buttons */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={handleGeneratePinImage}
                    disabled={isGeneratingPinImage}
                    className="gap-2 bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white border-0"
                  >
                    {isGeneratingPinImage ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ImageIcon className="w-4 h-4" />
                    )}
                    Generate Image
                  </Button>
                  <Button
                    onClick={handleGeneratePinTitle}
                    disabled={isGeneratingPinTitle}
                    variant="outline"
                    className="gap-2"
                  >
                    {isGeneratingPinTitle ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                    Generate Title & Description
                  </Button>
                </div>

                {/* Title */}
                {pinterestPin.title && (
                  <div className="bg-background/80 rounded-lg p-4 border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pin Title</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs gap-1"
                        onClick={() => {
                          navigator.clipboard.writeText(pinterestPin.title || '');
                          toast.success('Title copied!');
                        }}
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </Button>
                    </div>
                    <p className="font-medium text-foreground">{pinterestPin.title}</p>
                  </div>
                )}

                {/* Description */}
                {pinterestPin.description && (
                  <div className="bg-background/80 rounded-lg p-4 border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pin Description</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs gap-1"
                        onClick={() => {
                          const plainText = (pinterestPin.description || '').replace(/\*\*([^*]+)\*\*/g, '$1');
                          navigator.clipboard.writeText(plainText);
                          toast.success('Description copied!');
                        }}
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </Button>
                    </div>
                    <p 
                      className="text-sm text-muted-foreground"
                      dangerouslySetInnerHTML={{
                        __html: (pinterestPin.description || '').replace(
                          /\*\*([^*]+)\*\*/g, 
                          '<span class="text-pink-600 dark:text-pink-400 font-medium">$1</span>'
                        )
                      }}
                    />
                  </div>
                )}

                {/* Download Button */}
                {pinterestPin.imageUrl && (
                  <Button
                    onClick={handleDownloadPinImage}
                    className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white border-0"
                  >
                    <Download className="w-4 h-4" />
                    Download as WebP
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* WordPress Success Banner */}
        {wpSuccess && (
          <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium mb-1">
              <CheckCircle className="w-5 h-5" />
              Article Sent to WordPress! ✅
            </div>
            <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-2">
              Article created successfully as draft!
            </p>
            <a 
              href={wpSuccess.editUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
            >
              Open in WordPress →
            </a>
          </div>
        )}

        {/* Article Title and Meta */}
        <div className="border-b border-border pb-6 mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-3">{article.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{format(new Date(article.updated_at), 'MMMM d, yyyy \'at\' hh:mm a')}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              <span>{wordCount} words</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <ImageIcon className="w-4 h-4" />
              <span>{imageCount} images</span>
            </div>
          </div>
        </div>

        <div className="card-modern p-8">
          <article className="prose prose-lg max-w-none dark:prose-invert">
            <div 
              dangerouslySetInnerHTML={{ __html: processedContent }}
              className="article-content"
            />
          </article>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to delete this article?</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-zinc-700 text-white border-0 hover:bg-zinc-600">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmDelete}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                OK
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <style>{`
        .article-content {
          font-family: 'Georgia', 'Merriweather', serif;
          color: #1f2937;
          line-height: 1.8;
        }
        .article-content h1 {
          font-family: 'Georgia', serif;
          font-size: 32px;
          font-weight: 700;
          line-height: 1.3;
          margin-bottom: 1.5rem;
          color: #111827;
          text-align: center;
        }
        .article-content h2 {
          font-family: 'Georgia', serif;
          font-size: 26px;
          font-weight: 700;
          line-height: 1.35;
          margin-top: 2.5rem;
          margin-bottom: 1.25rem;
          color: #111827;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 0.5rem;
        }
        .article-content h3 {
          font-family: 'Georgia', serif;
          font-size: 20px;
          font-weight: 700;
          line-height: 1.4;
          margin-top: 1.75rem;
          margin-bottom: 0.75rem;
          color: #1f2937;
        }
        .article-content p {
          font-family: 'Georgia', serif;
          font-size: 17px;
          line-height: 1.85;
          margin-bottom: 1.25rem;
          color: #374151;
        }
        .article-content p.intro {
          font-size: 18px;
          line-height: 1.9;
          color: #1f2937;
        }
        .article-content .recipe-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 1.5rem;
          justify-content: center;
          padding: 1.25rem;
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border-radius: 12px;
          margin: 1.5rem 0 2rem;
          border: 1px solid #fcd34d;
        }
        .article-content .recipe-meta span {
          font-family: 'Georgia', serif;
          font-size: 15px;
          color: #92400e;
        }
        .article-content .recipe-meta strong {
          color: #78350f;
        }
        .article-content ul, .article-content ol {
          margin-bottom: 1.5rem;
          padding-left: 0;
          list-style: none;
        }
        .article-content ul li {
          font-family: 'Georgia', serif;
          font-size: 16px;
          line-height: 1.8;
          margin-bottom: 0.6rem;
          color: #374151;
          padding-left: 1.5rem;
          position: relative;
        }
        .article-content ul li::before {
          content: "•";
          position: absolute;
          left: 0;
          color: #f59e0b;
          font-weight: bold;
          font-size: 18px;
        }
        .article-content ol.instructions {
          counter-reset: step-counter;
        }
        .article-content ol.instructions li {
          font-family: 'Georgia', serif;
          font-size: 16px;
          line-height: 1.85;
          margin-bottom: 1.25rem;
          color: #374151;
          padding-left: 3rem;
          position: relative;
          counter-increment: step-counter;
        }
        .article-content ol.instructions li::before {
          content: counter(step-counter, decimal-leading-zero);
          position: absolute;
          left: 0;
          top: 0;
          width: 2rem;
          height: 2rem;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          font-weight: 700;
          font-size: 13px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: system-ui, sans-serif;
        }
        .article-content ol:not(.instructions) {
          counter-reset: list-counter;
        }
        .article-content ol:not(.instructions) li {
          font-family: 'Georgia', serif;
          font-size: 16px;
          line-height: 1.8;
          margin-bottom: 0.75rem;
          color: #374151;
          padding-left: 2rem;
          position: relative;
          counter-increment: list-counter;
        }
        .article-content ol:not(.instructions) li::before {
          content: counter(list-counter) ".";
          position: absolute;
          left: 0;
          color: #f59e0b;
          font-weight: bold;
        }
        .article-content li strong {
          font-weight: 700;
          color: #111827;
        }
        .article-content figure,
        .article-content .article-image {
          margin: 2rem 0;
          text-align: center;
        }
        .article-content img {
          max-width: 100%;
          height: auto;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }
        .article-content strong {
          font-weight: 700;
          color: #111827;
        }
        .article-content a {
          color: #d97706;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .article-content a:hover {
          color: #b45309;
        }
        @media (max-width: 640px) {
          .article-content h1 { font-size: 26px; }
          .article-content h2 { font-size: 22px; }
          .article-content h3 { font-size: 18px; }
          .article-content p { font-size: 16px; }
          .article-content .recipe-meta {
            flex-direction: column;
            gap: 0.75rem;
            text-align: center;
          }
          .article-content ol.instructions li {
            padding-left: 2.5rem;
          }
        }
        .dark .article-content {
          color: #e5e7eb;
        }
        .dark .article-content h1,
        .dark .article-content h2,
        .dark .article-content h3,
        .dark .article-content strong,
        .dark .article-content li strong {
          color: #f9fafb;
        }
        .dark .article-content p,
        .dark .article-content li {
          color: #d1d5db;
        }
        .dark .article-content h2 {
          border-bottom-color: #374151;
        }
        .dark .article-content .recipe-meta {
          background: linear-gradient(135deg, #78350f 0%, #92400e 100%);
          border-color: #b45309;
        }
        .dark .article-content .recipe-meta span,
        .dark .article-content .recipe-meta strong {
          color: #fef3c7;
        }
      `}</style>
    </>
  );
};

export default ArticleView;
