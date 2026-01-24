import { useState, useEffect } from 'react';
import { X, CheckCircle2, Sparkles, Image as ImageIcon, Cpu, DollarSign, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface GenerationMetadata {
  content_model: string;
  content_provider: string;
  image_model: string;
  image_provider: string;
  images_generated: number;
  total_images_attempted: number;
  aspect_ratio: string;
  estimated_cost: number;
  generated_at: string;
  // Fashion validation fields
  content_accuracy_score?: number;
  content_corrections?: string[];
  content_validated?: boolean;
}

interface GenerationNotificationProps {
  articleId: string;
  articleTitle: string;
  metadata: GenerationMetadata;
  onDismiss: () => void;
}

export function GenerationNotification({ 
  articleId, 
  articleTitle, 
  metadata,
  onDismiss 
}: GenerationNotificationProps) {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [showCorrections, setShowCorrections] = useState(false);

  useEffect(() => {
    // Animate in
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  const handleView = () => {
    navigate(`/articles/${articleId}`);
    onDismiss();
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onDismiss, 300);
  };

  const getImageModelLabel = (model: string) => {
    const labels: { [key: string]: string } = {
      'zimage': 'Z-Image Turbo',
      'flux-schnell': 'Flux Schnell',
      'seedream': 'Seedream 4.5',
      'nano-banana': 'Nano Banana (Gemini)',
      'gpt-image': 'GPT Image',
    };
    return labels[model] || model;
  };

  const getAccuracyColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 70) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getAccuracyBg = (score: number) => {
    if (score >= 90) return 'bg-emerald-100 dark:bg-emerald-900/50';
    if (score >= 70) return 'bg-amber-100 dark:bg-amber-900/50';
    return 'bg-red-100 dark:bg-red-900/50';
  };

  const hasCorrections = metadata.content_corrections && metadata.content_corrections.length > 0;

  return (
    <div 
      className={`fixed top-4 right-4 z-50 max-w-md w-full transform transition-all duration-300 ease-out ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/50 dark:to-green-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-100 text-sm">Article Generated!</h3>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">{new Date(metadata.generated_at).toLocaleTimeString()}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900"
            onClick={handleDismiss}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Title */}
        <div className="px-4 pb-2">
          <p className="text-sm font-medium text-foreground truncate" title={articleTitle}>
            {articleTitle}
          </p>
        </div>

        {/* Metadata Grid */}
        <div className="px-4 pb-3 grid grid-cols-2 gap-2">
          {/* Content Model */}
          <div className="flex items-center gap-2 text-xs bg-white/50 dark:bg-white/5 rounded-lg px-2 py-1.5">
            <Cpu className="w-3.5 h-3.5 text-primary" />
            <div>
              <p className="text-muted-foreground">Content</p>
              <p className="font-medium text-foreground">{metadata.content_provider}</p>
            </div>
          </div>

          {/* Image Model */}
          <div className="flex items-center gap-2 text-xs bg-white/50 dark:bg-white/5 rounded-lg px-2 py-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-violet-500" />
            <div>
              <p className="text-muted-foreground">Images</p>
              <p className="font-medium text-foreground">{getImageModelLabel(metadata.image_model)}</p>
            </div>
          </div>

          {/* Images Generated */}
          <div className="flex items-center gap-2 text-xs bg-white/50 dark:bg-white/5 rounded-lg px-2 py-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <div>
              <p className="text-muted-foreground">Generated</p>
              <p className="font-medium text-foreground">{metadata.images_generated}/{metadata.total_images_attempted} images</p>
            </div>
          </div>

          {/* Cost */}
          <div className="flex items-center gap-2 text-xs bg-white/50 dark:bg-white/5 rounded-lg px-2 py-1.5">
            <DollarSign className="w-3.5 h-3.5 text-green-500" />
            <div>
              <p className="text-muted-foreground">Est. Cost</p>
              <p className="font-medium text-foreground">${metadata.estimated_cost.toFixed(3)}</p>
            </div>
          </div>
        </div>

        {/* Content Accuracy Score (Fashion articles only) */}
        {metadata.content_validated && metadata.content_accuracy_score !== undefined && (
          <div className="px-4 pb-3">
            <div className={`flex items-center justify-between text-xs rounded-lg px-3 py-2 ${getAccuracyBg(metadata.content_accuracy_score)}`}>
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-4 h-4 ${getAccuracyColor(metadata.content_accuracy_score)}`} />
                <span className="text-foreground font-medium">Content Accuracy</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-bold ${getAccuracyColor(metadata.content_accuracy_score)}`}>
                  {metadata.content_accuracy_score}%
                </span>
                {hasCorrections && (
                  <button 
                    onClick={() => setShowCorrections(!showCorrections)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            
            {/* Corrections List (expandable) */}
            {showCorrections && hasCorrections && (
              <div className="mt-2 text-xs bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 border border-amber-200 dark:border-amber-800">
                <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                  {metadata.content_corrections!.length} correction(s) made:
                </p>
                <ul className="space-y-0.5 text-amber-700 dark:text-amber-300">
                  {metadata.content_corrections!.slice(0, 5).map((correction, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="mt-0.5">•</span>
                      <span>{correction}</span>
                    </li>
                  ))}
                  {metadata.content_corrections!.length > 5 && (
                    <li className="text-muted-foreground">
                      +{metadata.content_corrections!.length - 5} more...
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="px-4 pb-4 flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 h-8 text-xs"
            onClick={handleDismiss}
          >
            Dismiss
          </Button>
          <Button 
            size="sm" 
            className="flex-1 h-8 text-xs gradient-button text-white"
            onClick={handleView}
          >
            View Article
          </Button>
        </div>
      </div>
    </div>
  );
}
