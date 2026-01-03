import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Link2, FileText } from 'lucide-react';

const AddRecipes = () => {
  const [recipeTitles, setRecipeTitles] = useState('');
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const navigate = useNavigate();

  const handleAddToQueue = async () => {
    const titles = recipeTitles
      .split('\n')
      .map(title => title.trim())
      .filter(title => title.length > 0);

    if (titles.length === 0) {
      toast.error('Please enter at least one recipe title');
      return;
    }

    setIsAdding(true);

    try {
      const recipesToInsert = titles.map(title => ({
        title,
        status: 'pending' as const,
      }));

      const { error } = await supabase
        .from('recipes')
        .insert(recipesToInsert);

      if (error) throw error;

      // Store sitemap URL in localStorage for use during generation
      if (sitemapUrl.trim()) {
        localStorage.setItem('recipe_sitemap_url', sitemapUrl.trim());
        toast.success(`${titles.length} recipe(s) added with sitemap linking enabled`);
      } else {
        localStorage.removeItem('recipe_sitemap_url');
        toast.success(`${titles.length} recipe(s) added to queue`);
      }
      
      setRecipeTitles('');
      navigate('/recipes');
    } catch (error) {
      console.error('Error adding recipes:', error);
      toast.error('Failed to add recipes to queue');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-3 px-4">
        <div className="container mx-auto flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/recipes')}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to List
          </Button>
          <h1 className="text-xl font-semibold">Recipe Writer</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-6">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <FileText className="w-6 h-6" />
              Add Recipes
            </CardTitle>
            <CardDescription>
              Enter one recipe title per line. Articles will be generated automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="recipes">Recipe Titles</Label>
              <Textarea
                id="recipes"
                placeholder="Easy Chicken Curry&#10;Homemade Pizza Recipe&#10;Quick Pasta Carbonara&#10;..."
                value={recipeTitles}
                onChange={(e) => setRecipeTitles(e.target.value)}
                className="min-h-[200px] resize-y"
              />
            </div>

            {/* Sitemap URL Input */}
            <div className="space-y-2">
              <Label htmlFor="sitemap" className="flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                Sitemap URL (Optional)
              </Label>
              <Input
                id="sitemap"
                type="url"
                placeholder="https://yourwebsite.com/sitemap.xml"
                value={sitemapUrl}
                onChange={(e) => setSitemapUrl(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Enter a sitemap URL to automatically add relevant internal links to your articles. 
                This improves SEO by creating contextual links to your existing content.
              </p>
            </div>

            <Button 
              onClick={handleAddToQueue} 
              disabled={isAdding}
              className="w-full sm:w-auto"
              size="lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              {isAdding ? 'Adding...' : 'Add to Queue'}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AddRecipes;
