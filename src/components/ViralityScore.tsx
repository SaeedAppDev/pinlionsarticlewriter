import { ViralityScore as ViralityScoreType } from '@/types/recipe';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Eye, Type, Search, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

interface ViralityScoreProps {
  score: ViralityScoreType;
}

export function ViralityScore({ score }: ViralityScoreProps) {
  const metrics = [
    { key: 'visualClarity', label: 'Visual Clarity', icon: Eye, color: 'bg-info' },
    { key: 'textOverlayStrength', label: 'Text Overlay', icon: Type, color: 'bg-success' },
    { key: 'keywordRelevance', label: 'Keyword Relevance', icon: Search, color: 'bg-warning' },
    { key: 'scrollStopPotential', label: 'Scroll-Stop Power', icon: Zap, color: 'bg-primary' },
  ];

  const getScoreColor = (value: number) => {
    if (value >= 80) return 'text-success';
    if (value >= 60) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card className="shadow-lg border-0">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Virality Score
            </CardTitle>
            <div className={`text-4xl font-extrabold ${getScoreColor(score.overall)}`}>
              {score.overall}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {metrics.map((metric, index) => (
            <motion.div
              key={metric.key}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * index }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <metric.icon className="w-4 h-4 text-muted-foreground" />
                  <span>{metric.label}</span>
                </div>
                <span className="font-medium">
                  {score.breakdown[metric.key as keyof typeof score.breakdown]}%
                </span>
              </div>
              <Progress 
                value={score.breakdown[metric.key as keyof typeof score.breakdown]} 
                className="h-2"
              />
            </motion.div>
          ))}
          
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {score.overall >= 80 
                ? '🔥 Excellent! This pin has high viral potential.'
                : score.overall >= 60
                ? '👍 Good score! Consider improving text overlay for better results.'
                : '💡 Try adding more compelling headlines and keywords.'}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
