import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RecipeAnalysis, FocusAngle } from '@/types/recipe';
import { toast } from 'sonner';

export function useRecipeAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<RecipeAnalysis | null>(null);

  const analyzeRecipe = async (
    recipeText: string,
    recipeUrl: string,
    focusAngle: FocusAngle
  ) => {
    if (!recipeText.trim() && !recipeUrl.trim()) {
      toast.error('Please enter a recipe URL or paste recipe text');
      return null;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-recipe', {
        body: { recipeText, recipeUrl, focusAngle },
      });

      if (error) throw error;
      
      if (data.error) {
        throw new Error(data.error);
      }

      setAnalysis(data);
      toast.success('Recipe analyzed successfully!');
      return data;
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to analyze recipe');
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetAnalysis = () => {
    setAnalysis(null);
  };

  return {
    isAnalyzing,
    analysis,
    analyzeRecipe,
    resetAnalysis,
  };
}
