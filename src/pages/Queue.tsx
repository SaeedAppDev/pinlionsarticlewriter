import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Play, RefreshCw, Trash2, CheckCircle, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { format } from 'date-fns';

interface Recipe {
  id: string;
  title: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

const Queue = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRecipes();

    const channel = supabase
      .channel('recipes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recipes',
        },
        () => {
          fetchRecipes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRecipes = async () => {
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('id, title, status, error_message, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecipes(data || []);
    } catch (error) {
      console.error('Error fetching recipes:', error);
      toast.error('Failed to load recipes');
    } finally {
      setIsLoading(false);
    }
  };

  const getSettings = () => {
    try {
      const savedSettings = localStorage.getItem('article_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        // Map settings to what the edge function expects
        const result: Record<string, any> = {
          aspectRatio: parsed.aspectRatio || '4:3',
          aiProvider: parsed.aiProvider || 'lovable',
        };
        
        // Pass the appropriate API key based on provider
        if (parsed.aiProvider === 'groq' && parsed.groqApiKey) {
          result.customApiKey = parsed.groqApiKey;
        } else if (parsed.aiProvider === 'openai' && parsed.openaiApiKey) {
          result.customApiKey = parsed.openaiApiKey;
        }
        
        // Pass Replicate key if available
        if (parsed.replicateApiKey) {
          result.customReplicateKey = parsed.replicateApiKey;
        }
        
        return result;
      }
    } catch (e) {
      console.error('Failed to parse settings:', e);
    }
    return {};
  };

  const processAllRecipes = async () => {
    const pendingRecipes = recipes.filter(r => r.status === 'pending');
    if (pendingRecipes.length === 0) {
      toast.info('No pending articles to process');
      return;
    }

    setIsProcessingAll(true);
    toast.info(`Starting generation for ${pendingRecipes.length} articles...`);

    const settings = getSettings();

    for (const recipe of pendingRecipes) {
      setProcessingId(recipe.id);
      
      try {
        const { error } = await supabase.functions.invoke('generate-article', {
          body: { 
            recipeId: recipe.id, 
            title: recipe.title,
            ...settings
          },
        });
        
        if (error) {
          console.error('Error generating article:', error);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error('Error processing recipe:', error);
      }
    }
    
    setProcessingId(null);
    setIsProcessingAll(false);
    await fetchRecipes();
    toast.success('All articles processed!');
  };

  const deleteRecipe = async (id: string) => {
    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Article deleted');
    } catch (error) {
      console.error('Error deleting recipe:', error);
      toast.error('Failed to delete article');
    }
  };

  const clearCompleted = async () => {
    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('status', 'completed');

      if (error) throw error;
      toast.success('Completed articles cleared');
    } catch (error) {
      console.error('Error clearing completed:', error);
      toast.error('Failed to clear completed');
    }
  };

  const pendingCount = recipes.filter(r => r.status === 'pending').length;
  const completedCount = recipes.filter(r => r.status === 'completed').length;
  const errorCount = recipes.filter(r => r.status === 'error').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-emerald-100 text-emerald-600 border-0 gap-1.5 px-3 py-1 font-medium dark:bg-emerald-900/40 dark:text-emerald-400">
            <CheckCircle className="w-3.5 h-3.5" />
            Completed
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="status-processing border-0 gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Processing
          </Badge>
        );
      case 'error':
        return <Badge className="status-error border-0">Error</Badge>;
      default:
        return <Badge className="status-pending border-0">Pending</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="p-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="page-title mb-2">Article Queue</h1>
          <p className="text-muted-foreground">
            {pendingCount} pending • {completedCount} completed • {errorCount} errors
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Button
            onClick={processAllRecipes}
            disabled={isProcessingAll || pendingCount === 0}
            className="gradient-button border-0"
          >
            {isProcessingAll ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Generate All Articles ({pendingCount})
          </Button>
          <Button variant="outline" onClick={fetchRecipes}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={clearCompleted}
            disabled={completedCount === 0}
            className="text-rose-500 border-rose-200 bg-rose-50/50 hover:bg-rose-100/50 dark:text-rose-400 dark:border-rose-800 dark:bg-rose-950/30 dark:hover:bg-rose-900/40"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Completed
          </Button>
        </div>

        {/* Table */}
        <div className="card-modern overflow-hidden">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : recipes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No articles in queue. Go to "Add Articles" to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Title</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Created</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipes.map((recipe) => (
                  <TableRow 
                    key={recipe.id}
                    className={processingId === recipe.id ? 'bg-primary/5' : ''}
                  >
                    <TableCell className="font-medium max-w-md truncate">
                      {recipe.title}
                    </TableCell>
                    <TableCell>{getStatusBadge(recipe.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(recipe.created_at), 'MM/dd/yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteRecipe(recipe.id)}
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
    </AppLayout>
  );
};

export default Queue;
