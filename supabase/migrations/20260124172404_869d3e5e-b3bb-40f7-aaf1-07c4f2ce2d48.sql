-- Add generation_metadata column to track what was used for generation
ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS generation_metadata jsonb DEFAULT NULL;

-- COMMENT: This stores information about the generation process:
-- {
--   "content_model": "openai/gpt-5" or "lovable",
--   "content_provider": "OpenAI API" or "Lovable AI",
--   "image_model": "zimage" or "nano-banana", etc,
--   "image_provider": "Replicate" or "Lovable AI",
--   "images_generated": 5,
--   "estimated_cost": 0.25,
--   "generated_at": "2026-01-24T12:00:00Z"
-- }