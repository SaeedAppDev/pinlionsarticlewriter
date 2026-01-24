-- Add new columns for image source, AI content model, and Freepik API key
ALTER TABLE public.user_api_settings
ADD COLUMN IF NOT EXISTS freepik_api_key text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS image_source text DEFAULT 'ai-generated',
ADD COLUMN IF NOT EXISTS ai_content_model text DEFAULT 'deepseek-v3';