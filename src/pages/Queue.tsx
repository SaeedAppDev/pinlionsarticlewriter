import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Play, RefreshCw, Trash2, CheckCircle, Loader2, Clock, AlertCircle, RotateCcw, Zap } from 'lucide-react';

import { format } from 'date-fns';

interface GenerationProgress {
  step: string;
  totalImages?: number;
  completedImages?: number;
  currentImage?: number;
  completedImageIds?: number[];
  status?: string;
}

interface Article {
  id: string;
  title: string;
  status: string;
  type: string;
  niche: string;
  error_message: string | null;
  created_at: string;
  generation_progress?: GenerationProgress | null;
}

const GENERATION_TIME_SECONDS = 30;

const Queue = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isRetryingFailed, setIsRetryingFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [currentProvider, setCurrentProvider] = useState<string>('loading');
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();

  const startProgress = () => {
    setProgress(0);
    setTimeRemaining(GENERATION_TIME_SECONDS);
    
    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const newProgress = Math.min((elapsed / GENERATION_TIME_SECONDS) * 100, 95);
      const remaining = Math.max(GENERATION_TIME_SECONDS - elapsed, 0);
      
      setProgress(newProgress);
      setTimeRemaining(Math.ceil(remaining));
    }, 100);
  };

  const stopProgress = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setProgress(100);
    setTimeout(() => {
      setProgress(0);
      setTimeRemaining(0);
    }, 500);
  };

  useEffect(() => {
    fetchArticles();
    fetchCurrentProvider();

    const channel = supabase
      .channel('articles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'articles',
        },
        () => {
          fetchArticles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCurrentProvider = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCurrentProvider('lovable');
        return;
      }

      const { data: apiSettings } = await supabase
        .from('user_api_settings')
        .select('openai_api_key')
        .eq('user_id', user.id)
        .single();

      setCurrentProvider(apiSettings?.openai_api_key ? 'openai' : 'lovable');
    } catch (e) {
      setCurrentProvider('lovable');
    }
  };

  const fetchArticles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('articles')
        .select('id, title, status, type, niche, error_message, created_at, generation_progress')
        .eq('user_id', user.id)
        .in('status', ['pending', 'processing', 'error'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Map data to properly type generation_progress
      const mappedData: Article[] = (data || []).map(item => ({
        ...item,
        generation_progress: item.generation_progress as unknown as GenerationProgress | null
      }));
      setArticles(mappedData);
    } catch (error) {
      console.error('Error fetching articles:', error);
      toast.error('Failed to load articles');
    } finally {
      setIsLoading(false);
    }
  };

  interface GenerationSettings {
    aspectRatio?: string;
    aiProvider?: string;
    articleStyle?: string;
    imageModel?: string;
    customApiKey?: string;
    customReplicateKey?: string;
  }

  const getSettings = async (): Promise<GenerationSettings> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return {};

      // Fetch API settings from database
      const { data: apiSettings } = await supabase
        .from('user_api_settings')
        .select('openai_api_key, replicate_api_token, replicate_model')
        .eq('user_id', user.id)
        .single();

      const savedSettings = localStorage.getItem('article_settings');
      let localSettings: GenerationSettings = {};
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        localSettings = {
          aspectRatio: parsed.imageAspectRatio || '4:3',
          articleStyle: parsed.articleStyle || 'recipe',
        };
      }

      // Determine AI provider based on whether OpenAI key is set
      const aiProvider = apiSettings?.openai_api_key ? 'openai' : 'lovable';

      return {
        ...localSettings,
        aiProvider,
        customApiKey: apiSettings?.openai_api_key || undefined,
        customReplicateKey: apiSettings?.replicate_api_token || undefined,
        imageModel: apiSettings?.replicate_model || 'z-image-turbo',
      };
    } catch (e) {
      console.error('Failed to get settings:', e);
    }
    return {};
  };

  const processAllArticles = async () => {
    const pendingArticles = articles.filter(a => a.status === 'pending');
    if (pendingArticles.length === 0) {
      toast.info('No pending articles to process');
      return;
    }

    setIsProcessingAll(true);
    toast.info(`Starting generation for ${pendingArticles.length} articles...`);

    const settings = await getSettings();
    console.log('Using settings:', { ...settings, customApiKey: settings.customApiKey ? '***' : undefined, customReplicateKey: settings.customReplicateKey ? '***' : undefined });

    for (const article of pendingArticles) {
      setProcessingId(article.id);
      startProgress();
      
      try {
        const { error } = await supabase.functions.invoke('generate-article', {
          body: { 
            articleId: article.id, 
            title: article.title,
            type: article.type,
            niche: article.niche,
            ...settings
          },
        });
        
        if (error) {
          console.error('Error generating article:', error);
        }
        
        stopProgress();
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Error processing article:', error);
        stopProgress();
      }
    }
    
    setProcessingId(null);
    setIsProcessingAll(false);
    await fetchArticles();
    toast.success('All articles processed!');
  };

  const retryFailedArticles = async () => {
    const failedArticles = articles.filter(a => a.status === 'error');
    if (failedArticles.length === 0) {
      toast.info('No failed articles to retry');
      return;
    }

    // First, reset their status to pending
    for (const article of failedArticles) {
      await supabase
        .from('articles')
        .update({ status: 'pending', error_message: null })
        .eq('id', article.id);
    }

    setIsRetryingFailed(true);
    toast.info(`Retrying ${failedArticles.length} failed articles...`);

    const settings = await getSettings();

    for (const article of failedArticles) {
      setProcessingId(article.id);
      startProgress();
      
      try {
        const { error } = await supabase.functions.invoke('generate-article', {
          body: { 
            articleId: article.id, 
            title: article.title,
            type: article.type,
            niche: article.niche,
            ...settings
          },
        });
        
        if (error) {
          console.error('Error retrying article:', error);
        }
        
        stopProgress();
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Error retrying article:', error);
        stopProgress();
      }
    }
    
    setProcessingId(null);
    setIsRetryingFailed(false);
    await fetchArticles();
    toast.success('Retry completed!');
  };

  const deleteArticle = async (id: string) => {
    try {
      const { error } = await supabase
        .from('articles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Article deleted');
    } catch (error) {
      console.error('Error deleting article:', error);
      toast.error('Failed to delete article');
    }
  };

  const pendingCount = articles.filter(a => a.status === 'pending').length;
  const completedCount = 0; // Will be fetched separately if needed
  const errorCount = articles.filter(a => a.status === 'error').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0 gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            Completed
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border-0 gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Processing
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-0 gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-0">
            Pending
          </Badge>
        );
    }
  };

  return (
    <div className="p-8">
        {/* Page Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-foreground">Article Queue</h1>
            <p className="text-muted-foreground">
              {pendingCount} pending • {completedCount} completed • {errorCount} errors
            </p>
          </div>
          <Badge 
            variant="outline" 
            className={`flex items-center gap-1.5 px-3 py-1.5 ${
              currentProvider === 'openai' 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' 
                : 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            {currentProvider === 'loading' ? 'Loading...' : currentProvider === 'openai' ? 'OpenAI API' : 'Lovable AI'}
          </Badge>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Button
            onClick={processAllArticles}
            disabled={isProcessingAll || isRetryingFailed || pendingCount === 0}
            className="gradient-button text-white border-0"
          >
            {isProcessingAll ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Generate All Articles ({pendingCount})
          </Button>
          {errorCount > 0 && (
            <Button
              onClick={retryFailedArticles}
              disabled={isProcessingAll || isRetryingFailed}
              variant="outline"
              className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              {isRetryingFailed ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              Retry Failed ({errorCount})
            </Button>
          )}
          <Button variant="outline" onClick={fetchArticles}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Progress Bar */}
        {processingId && progress > 0 && (
          <div className="mb-6 card-modern p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm font-medium">Generating article...</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{timeRemaining}s remaining</span>
              </div>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {Math.round(progress)}% complete
            </p>
          </div>
        )}

        {/* Real-time Image Generation Progress */}
        {articles.filter(a => a.status === 'processing' && a.generation_progress).map(article => (
          <div key={`progress-${article.id}`} className="mb-4 card-modern p-4 border-l-4 border-primary">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm font-medium truncate max-w-md">{article.title}</span>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary">
                {article.generation_progress?.step === 'generating_title' && 'Generating Title...'}
                {article.generation_progress?.step === 'generating_content' && 'Writing Content...'}
                {article.generation_progress?.step === 'generating_images' && 
                  `Images: ${article.generation_progress?.completedImages || 0}/${article.generation_progress?.totalImages || 0}`}
                {article.generation_progress?.step === 'starting' && 'Starting...'}
              </Badge>
            </div>
            {article.generation_progress?.step === 'generating_images' && article.generation_progress?.totalImages && (
              <Progress 
                value={(article.generation_progress.completedImages || 0) / article.generation_progress.totalImages * 100} 
                className="h-2" 
              />
            )}
          </div>
        ))}

        {/* Content */}
        <div className="card-modern overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Loading...</p>
            </div>
          ) : articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No articles in queue</h3>
              <p className="text-center max-w-sm">
                Add some article titles from the Add screen to start generating.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Title</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Created</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {articles.map((article) => (
                  <TableRow 
                    key={article.id}
                    className={processingId === article.id ? 'bg-primary/5' : ''}
                  >
                    <TableCell className="font-medium max-w-md">
                      <div className="truncate">{article.title}</div>
                      {processingId === article.id && progress > 0 && (
                        <Progress value={progress} className="h-1 mt-2" />
                      )}
                      {article.error_message && (
                        <p className="text-xs text-red-500 mt-1 truncate">{article.error_message}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {article.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(article.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(article.created_at), 'MM/dd/yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteArticle(article.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
    </div>
  );
};

export default Queue;
