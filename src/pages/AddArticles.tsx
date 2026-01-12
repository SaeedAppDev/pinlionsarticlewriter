import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, ListOrdered, List, FileText } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';

const LISTICLE_CATEGORIES: Record<string, string> = {
  'general': 'Default (General)',
  'food': 'Food & Recipes',
  'home': 'Home Decor',
  'fashion': 'Fashion & Outfits',
};

const AddArticles = () => {
  const [titles, setTitles] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [currentMode, setCurrentMode] = useState<'classic' | 'listicle'>('classic');
  const [listicleCategory, setListicleCategory] = useState('general');
  const navigate = useNavigate();

  useEffect(() => {
    const savedSettings = localStorage.getItem('article_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.articleStyle === 'listicle') {
          setCurrentMode('listicle');
        } else {
          setCurrentMode('classic');
        }
        if (parsed.listicleCategory) {
          setListicleCategory(parsed.listicleCategory);
        }
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
  }, []);

  const titleCount = titles
    .split('\n')
    .map(t => t.trim())
    .filter(t => t.length > 0).length;

  const handleAddToQueue = async () => {
    const titleList = titles
      .split('\n')
      .map(title => title.trim())
      .filter(title => title.length > 0);

    if (titleList.length === 0) {
      toast.error('Please enter at least one article title');
      return;
    }

    setIsAdding(true);

    try {
      const recipesToInsert = titleList.map(title => ({
        title: title,
        status: 'pending' as const,
      }));

      const { error } = await supabase
        .from('recipes')
        .insert(recipesToInsert);

      if (error) throw error;

      toast.success(`${titleList.length} ${currentMode === 'listicle' ? 'listicle' : 'article'}(s) added to queue`);
      setTitles('');
      navigate('/queue');
    } catch (error) {
      console.error('Error adding articles:', error);
      toast.error('Failed to add to queue');
    } finally {
      setIsAdding(false);
    }
  };

  const isListicle = currentMode === 'listicle';
  const modeLabel = isListicle ? 'Listicle' : 'Classic';
  const promptLabel = isListicle 
    ? `Listicle - ${LISTICLE_CATEGORIES[listicleCategory] || 'Default (General)'}`
    : 'Classic Article';

  return (
    <AppLayout>
      <div className="p-8 max-w-4xl">
        {/* Mode Indicators */}
        <div className="flex justify-end gap-3 mb-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <List className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Current Mode: {modeLabel}</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Current Prompt: {promptLabel}</span>
          </div>
        </div>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="page-title mb-2">
            Add {isListicle ? 'Listicles' : 'Articles'} to Queue
          </h1>
          <p className="text-muted-foreground">
            Enter {isListicle ? 'listicle' : 'article'} titles (one per line) and add them to the generation queue
          </p>
        </div>

        {/* Input Card */}
        <div className="card-modern p-6 mb-6">
          <div className="space-y-4">
            <Label htmlFor="titles" className="text-sm font-medium">
              {isListicle ? 'Listicle' : 'Article'} Titles (one per line)
            </Label>
            <Textarea
              id="titles"
              placeholder={isListicle 
                ? "10 Best Home Decor Ideas for Small Spaces\n15 Quick and Easy Dinner Recipes\n7 Essential Tools Every Gardener Needs"
                : "How to Make Perfect Chocolate Chip Cookies\n10 Easy Dinner Recipes for Busy Weeknights\nThe Ultimate Guide to Home Organization"
              }
              value={titles}
              onChange={(e) => setTitles(e.target.value)}
              className="min-h-[200px] resize-y font-mono text-sm bg-background"
            />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {titleCount} titles entered
              </p>
              <Button
                onClick={handleAddToQueue}
                disabled={isAdding || titleCount === 0}
                className="gradient-button border-0"
                size="lg"
              >
                <Plus className="w-4 h-4 mr-2" />
                {isAdding ? 'Adding...' : 'Add to Queue'}
              </Button>
            </div>
          </div>
        </div>

        {/* How It Works Card */}
        <div className="card-modern p-6">
          <div className="flex items-center gap-2 mb-4">
            <ListOrdered className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">How It Works</h2>
          </div>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="font-medium text-foreground">1.</span>
              Enter article titles (one per line)
            </li>
            <li className="flex gap-2">
              <span className="font-medium text-foreground">2.</span>
              Click "Add to Queue" to save them
            </li>
            <li className="flex gap-2">
              <span className="font-medium text-foreground">3.</span>
              Go to "Queue" in the sidebar
            </li>
            <li className="flex gap-2">
              <span className="font-medium text-foreground">4.</span>
              Click "Generate All Articles" to start bulk processing
            </li>
            <li className="flex gap-2">
              <span className="font-medium text-foreground">5.</span>
              Watch as each article is generated automatically!
            </li>
          </ol>
        </div>
      </div>
    </AppLayout>
  );
};

export default AddArticles;
