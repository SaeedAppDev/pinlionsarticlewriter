import { useState } from 'react';
import { Header } from '@/components/Header';
import { HeroSection } from '@/components/HeroSection';
import { RecipeInput } from '@/components/RecipeInput';
import { RecipeDetails } from '@/components/RecipeDetails';
import { ViralityScore } from '@/components/ViralityScore';
import { SEOContent } from '@/components/SEOContent';
import { HeadlinesList } from '@/components/HeadlinesList';
import { PinGallery } from '@/components/PinGallery';
import { useRecipeAnalysis } from '@/hooks/useRecipeAnalysis';
import { usePinGeneration } from '@/hooks/usePinGeneration';
import { Button } from '@/components/ui/button';
import { RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Index = () => {
  const { isAnalyzing, analysis, analyzeRecipe, resetAnalysis } = useRecipeAnalysis();
  const { isGenerating, generatedPins, progress, generatePins, resetPins } = usePinGeneration();
  const [showResults, setShowResults] = useState(false);

  const handleAnalyze = async (text: string, url: string, focus: any) => {
    const result = await analyzeRecipe(text, url, focus);
    if (result) {
      setShowResults(true);
      // Start generating pins after analysis
      generatePins(result.imagePrompts, result.headlines, result.dishName);
    }
  };

  const handleReset = () => {
    resetAnalysis();
    resetPins();
    setShowResults(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <AnimatePresence mode="wait">
        {!showResults ? (
          <motion.div
            key="input"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <HeroSection />
            <section className="container mx-auto px-4 py-12">
              <div className="max-w-2xl mx-auto">
                <RecipeInput onAnalyze={handleAnalyze} isLoading={isAnalyzing} />
              </div>
            </section>
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <section className="container mx-auto px-4 py-8">
              {/* Back Button */}
              <div className="mb-8">
                <Button variant="outline" onClick={handleReset}>
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  Analyze New Recipe
                </Button>
              </div>

              {analysis && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column - Recipe Info */}
                  <div className="space-y-6">
                    <RecipeDetails analysis={analysis} />
                    <ViralityScore score={analysis.viralityScore} />
                  </div>

                  {/* Center Column - Generated Pins */}
                  <div className="lg:col-span-2 space-y-6">
                    <PinGallery
                      pins={generatedPins}
                      isGenerating={isGenerating}
                      progress={progress}
                      seo={analysis.seo}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <SEOContent seo={analysis.seo} />
                      <HeadlinesList headlines={analysis.headlines} />
                    </div>
                  </div>
                </div>
              )}
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="py-8 border-t mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>PinFactory AI — Transform your recipes into Pinterest gold</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
