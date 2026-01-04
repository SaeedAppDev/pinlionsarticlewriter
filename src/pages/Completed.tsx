import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Eye, Trash2, Grid, List, Filter, Calendar, FileText, Image as ImageIcon } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { format } from 'date-fns';

interface Recipe {
  id: string;
  title: string;
  status: string;
  article_content: string | null;
  created_at: string;
  updated_at: string;
}

const Completed = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchRecipes();

    const channel = supabase
      .channel('completed-recipes')
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
        .select('id, title, status, article_content, created_at, updated_at')
        .eq('status', 'completed')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setRecipes(data || []);
    } catch (error) {
      console.error('Error fetching recipes:', error);
      toast.error('Failed to load articles');
    } finally {
      setIsLoading(false);
    }
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

  const getFirstImage = (content: string | null) => {
    if (!content) return null;
    const imgMatch = content.match(/<img[^>]*src=["']([^"']*)["'][^>]*>/);
    return imgMatch ? imgMatch[1] : null;
  };

  const filteredRecipes = recipes.filter(recipe => 
    recipe.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const localCount = filteredRecipes.length;
  const wpCount = 0; // WordPress integration placeholder

  return (
    <AppLayout>
      <div className="p-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="page-title mb-2">Completed Articles</h1>
          <p className="text-muted-foreground">
            {localCount} total • {localCount} local only • {wpCount} in WordPress
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-card"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px] bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Articles</SelectItem>
                <SelectItem value="local">Local Only</SelectItem>
                <SelectItem value="wordpress">WordPress</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex border rounded-lg overflow-hidden bg-card">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
              className="rounded-none"
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
              className="rounded-none"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : filteredRecipes.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No completed articles yet. Generate some articles from the Queue.
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecipes.map((recipe) => {
              const firstImage = getFirstImage(recipe.article_content);
              const wordCount = getWordCount(recipe.article_content);
              const imageCount = getImageCount(recipe.article_content);

              return (
                <div key={recipe.id} className="card-modern overflow-hidden group">
                  {/* Image */}
                  <div className="relative aspect-video bg-muted overflow-hidden">
                    {firstImage ? (
                      <img
                        src={firstImage}
                        alt={recipe.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="w-12 h-12 text-muted-foreground/30" />
                      </div>
                    )}
                    {/* Checkbox overlay */}
                    <div className="absolute top-3 left-3">
                      <input type="checkbox" className="w-4 h-4 rounded border-2" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-semibold text-foreground line-clamp-2 mb-2">
                      {recipe.title}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <Calendar className="w-4 h-4" />
                      <span>{format(new Date(recipe.updated_at), 'MMM d, yyyy, hh:mm a')}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        <span>{wordCount} words</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ImageIcon className="w-4 h-4" />
                        <span>{imageCount}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => navigate(`/article/${recipe.id}`)}
                        className="flex-1 gradient-button border-0"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => deleteRecipe(recipe.id)}
                        className="text-destructive border-destructive/50 hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="card-modern overflow-hidden">
            <div className="divide-y divide-border">
              {filteredRecipes.map((recipe) => {
                const firstImage = getFirstImage(recipe.article_content);
                const wordCount = getWordCount(recipe.article_content);
                const imageCount = getImageCount(recipe.article_content);

                return (
                  <div key={recipe.id} className="flex items-center gap-4 p-4 hover:bg-muted/50">
                    <input type="checkbox" className="w-4 h-4 rounded border-2" />
                    
                    {/* Thumbnail */}
                    <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                      {firstImage ? (
                        <img
                          src={firstImage}
                          alt={recipe.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText className="w-6 h-6 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">
                        {recipe.title}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{format(new Date(recipe.updated_at), 'MMM d, yyyy, hh:mm a')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          <span>{wordCount} words</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          <span>{imageCount}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => navigate(`/article/${recipe.id}`)}
                        className="gradient-button border-0"
                      >
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteRecipe(recipe.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Completed;
