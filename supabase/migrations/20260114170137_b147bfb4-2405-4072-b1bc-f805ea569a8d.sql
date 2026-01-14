-- Add generation_progress column to track real-time image generation progress
ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS generation_progress jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.articles.generation_progress IS 'Tracks real-time generation progress: {step: string, currentImage: number, totalImages: number, completedImages: number[], status: string}';