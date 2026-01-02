import { useState } from 'react';
import { Link2, FileText, ChefHat, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FocusAngle } from '@/types/recipe';
import { motion } from 'framer-motion';

interface RecipeInputProps {
  onAnalyze: (text: string, url: string, focus: FocusAngle) => void;
  isLoading: boolean;
}

export function RecipeInput({ onAnalyze, isLoading }: RecipeInputProps) {
  const [recipeUrl, setRecipeUrl] = useState('');
  const [recipeText, setRecipeText] = useState('');
  const [focusAngle, setFocusAngle] = useState<FocusAngle>('balanced');
  const [activeTab, setActiveTab] = useState('url');

  const handleSubmit = () => {
    onAnalyze(recipeText, recipeUrl, focusAngle);
  };

  const focusOptions: { value: FocusAngle; label: string; emoji: string }[] = [
    { value: 'balanced', label: 'Balanced Mix', emoji: '⚖️' },
    { value: 'quick', label: 'Quick & Easy', emoji: '⚡' },
    { value: 'healthy', label: 'Healthy Living', emoji: '🥗' },
    { value: 'family', label: 'Family Friendly', emoji: '👨‍👩‍👧‍👦' },
    { value: 'budget', label: 'Budget Meals', emoji: '💰' },
    { value: 'viral', label: 'Viral Curiosity', emoji: '🔥' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card className="shadow-lg border-0">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 gradient-primary rounded-2xl flex items-center justify-center mb-4">
            <ChefHat className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Add Your Recipe</CardTitle>
          <CardDescription>
            Paste a recipe URL or enter the recipe details below
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="url" className="flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                Recipe URL
              </TabsTrigger>
              <TabsTrigger value="text" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Paste Text
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="url" className="mt-0">
              <Input
                placeholder="https://yourblog.com/amazing-recipe"
                value={recipeUrl}
                onChange={(e) => setRecipeUrl(e.target.value)}
                className="h-12"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Enter the URL of your recipe blog post
              </p>
            </TabsContent>
            
            <TabsContent value="text" className="mt-0">
              <Textarea
                placeholder="Paste your recipe here...

Include:
• Recipe name
• Ingredients list
• Cooking time
• Instructions"
                value={recipeText}
                onChange={(e) => setRecipeText(e.target.value)}
                className="min-h-[200px] resize-none"
              />
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <label className="text-sm font-medium">Pin Focus Angle</label>
            <Select value={focusAngle} onValueChange={(v) => setFocusAngle(v as FocusAngle)}>
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {focusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="flex items-center gap-2">
                      <span>{option.emoji}</span>
                      <span>{option.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose the primary angle for your Pinterest content
            </p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isLoading || (!recipeUrl.trim() && !recipeText.trim())}
            className="w-full h-14 text-lg font-semibold gradient-primary hover:opacity-90 transition-opacity"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Analyzing Recipe...
              </>
            ) : (
              <>
                <ChefHat className="w-5 h-5 mr-2" />
                Generate Pinterest Pins
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
