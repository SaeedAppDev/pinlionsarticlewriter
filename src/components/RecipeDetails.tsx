import { RecipeAnalysis } from '@/types/recipe';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, UtensilsCrossed, Tag } from 'lucide-react';
import { motion } from 'framer-motion';

interface RecipeDetailsProps {
  analysis: RecipeAnalysis;
}

export function RecipeDetails({ analysis }: RecipeDetailsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-primary" />
            Recipe Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Dish Name */}
          <div>
            <h3 className="text-2xl font-bold">{analysis.dishName}</h3>
          </div>

          {/* Cooking Time */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>{analysis.cookingTime}</span>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Tag className="w-4 h-4" />
              Recipe Tags
            </div>
            <div className="flex flex-wrap gap-2">
              {analysis.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Key Ingredients */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Key Ingredients</div>
            <div className="flex flex-wrap gap-2">
              {analysis.ingredients.slice(0, 8).map((ingredient) => (
                <Badge key={ingredient} variant="outline">
                  {ingredient}
                </Badge>
              ))}
              {analysis.ingredients.length > 8 && (
                <Badge variant="outline" className="bg-muted">
                  +{analysis.ingredients.length - 8} more
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
