import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Plus } from 'lucide-react';

const AddRecipes = () => {
  const [recipeTitles, setRecipeTitles] = useState('');
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

      toast.success(`${titles.length} recipe(s) added to queue`);
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
      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">Add Recipes</CardTitle>
            <p className="text-muted-foreground">
              Enter one recipe title per line:
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Easy Chicken Curry&#10;Homemade Pizza Recipe&#10;Quick Pasta Carbonara&#10;..."
              value={recipeTitles}
              onChange={(e) => setRecipeTitles(e.target.value)}
              className="min-h-[250px] resize-y"
            />
            <Button 
              onClick={handleAddToQueue} 
              disabled={isAdding}
              className="w-full sm:w-auto"
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
