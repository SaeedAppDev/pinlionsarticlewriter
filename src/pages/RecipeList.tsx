import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Play, PlayCircle, Trash2, RefreshCw, Eye } from 'lucide-react';

interface Recipe {
  id: string;
  title: string;
  status: string;
  article_content: string | null;
  error_message: string | null;
  created_at: string;
}

const RecipeList = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRecipes();

    // Subscribe to realtime updates
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
        .select('*')
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

  const processNextRecipe = async () => {
    const pendingRecipe = recipes.find(r => r.status === 'pending');
    if (!pendingRecipe) {
      toast.info('No pending recipes to process');
      return;
    }

    setProcessingId(pendingRecipe.id);
    try {
      const { error } = await supabase.functions.invoke('generate-article', {
        body: { recipeId: pendingRecipe.id, title: pendingRecipe.title },
      });

      if (error) throw error;
      toast.success('Article generation started');
    } catch (error) {
      console.error('Error processing recipe:', error);
      toast.error('Failed to start article generation');
    } finally {
      setProcessingId(null);
    }
  };

  const processAllRecipes = async () => {
    const pendingRecipes = recipes.filter(r => r.status === 'pending');
    if (pendingRecipes.length === 0) {
      toast.info('No pending recipes to process');
      return;
    }

    toast.info(`Starting generation for ${pendingRecipes.length} recipes...`);

    for (const recipe of pendingRecipes) {
      setProcessingId(recipe.id);
      try {
        await supabase.functions.invoke('generate-article', {
          body: { recipeId: recipe.id, title: recipe.title },
        });
        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error('Error processing recipe:', error);
      }
    }
    setProcessingId(null);
    toast.success('All articles processed');
  };

  const deleteRecipe = async (id: string) => {
    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Recipe deleted');
    } catch (error) {
      console.error('Error deleting recipe:', error);
      toast.error('Failed to delete recipe');
    }
  };

  const clearAllRecipes = async () => {
    if (!confirm('Are you sure you want to delete all recipes?')) return;

    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;
      toast.success('All recipes cleared');
    } catch (error) {
      console.error('Error clearing recipes:', error);
      toast.error('Failed to clear recipes');
    }
  };

  const resetProcessingItems = async () => {
    try {
      const { error } = await supabase
        .from('recipes')
        .update({ status: 'pending', error_message: null })
        .eq('status', 'processing');

      if (error) throw error;
      toast.success('Processing items reset to pending');
    } catch (error) {
      console.error('Error resetting items:', error);
      toast.error('Failed to reset items');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">COMPLETED</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">PROCESSING</Badge>;
      case 'error':
        return <Badge variant="destructive">ERROR</Badge>;
      default:
        return <Badge variant="secondary">PENDING</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-3 px-4">
        <div className="container mx-auto">
          <h1 className="text-xl font-semibold">Recipe Writer</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
            <CardTitle className="text-2xl">Recipe List</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate('/add-recipes')}>
                <Plus className="w-4 h-4 mr-2" />
                Add Recipes
              </Button>
              <Button onClick={processNextRecipe} disabled={!!processingId}>
                <Play className="w-4 h-4 mr-2" />
                Create Next Article
              </Button>
              <Button variant="outline" onClick={processAllRecipes} disabled={!!processingId}>
                <PlayCircle className="w-4 h-4 mr-2" />
                Create All Articles
              </Button>
              <Button variant="outline" onClick={clearAllRecipes}>
                Clear List
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : recipes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No recipes in queue. Click "Add Recipes" to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Draft Post</TableHead>
                      <TableHead>Error Message</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipes.map((recipe) => (
                      <TableRow key={recipe.id}>
                        <TableCell className="font-medium">{recipe.title}</TableCell>
                        <TableCell>{getStatusBadge(recipe.status)}</TableCell>
                        <TableCell>
                          {recipe.status === 'completed' && recipe.article_content ? (
                            <Button
                              variant="link"
                              className="p-0 h-auto text-primary"
                              onClick={() => setSelectedRecipe(recipe)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View Draft
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {recipe.error_message ? (
                            <span className="text-destructive text-sm">{recipe.error_message}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteRecipe(recipe.id)}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Reset Processing Items */}
            <div className="mt-6 pt-6 border-t">
              <Button variant="outline" onClick={resetProcessingItems}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset Processing Items
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                Reset items stuck in processing status for more than 10 minutes.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* View Draft Dialog */}
      <Dialog open={!!selectedRecipe} onOpenChange={() => setSelectedRecipe(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">{selectedRecipe?.title}</DialogTitle>
          </DialogHeader>
          <div 
            className="prose prose-lg max-w-none dark:prose-invert
              prose-headings:font-bold prose-headings:text-foreground
              prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h2:border-b prose-h2:pb-2
              prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
              prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:mb-4
              prose-ul:my-4 prose-li:text-muted-foreground
              prose-strong:text-foreground prose-strong:font-semibold
              prose-img:rounded-lg prose-img:shadow-md prose-img:my-6 prose-img:w-full prose-img:max-h-96 prose-img:object-cover
              [&_.caption]:text-center [&_.caption]:text-sm [&_.caption]:text-muted-foreground [&_.caption]:italic [&_.caption]:-mt-4 [&_.caption]:mb-6
              [&_figure]:my-6 [&_figure]:text-center
              [&_figure_img]:mx-auto [&_figure_img]:rounded-lg [&_figure_img]:shadow-lg"
            dangerouslySetInnerHTML={{ __html: selectedRecipe?.article_content || '' }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecipeList;
