-- Create articles table (main table for article generation)
CREATE TABLE public.articles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'classic',
  niche text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  item_count integer,
  status text NOT NULL DEFAULT 'pending',
  content_html text,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on articles
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- RLS policies for articles
CREATE POLICY "Users can view their own articles"
ON public.articles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own articles"
ON public.articles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own articles"
ON public.articles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own articles"
ON public.articles FOR DELETE
USING (auth.uid() = user_id);

-- Create prompts table for article generation prompts
CREATE TABLE public.prompts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'classic',
  niche text NOT NULL DEFAULT 'general',
  prompt_text text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on prompts
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

-- RLS policies for prompts (user can view their own + global defaults)
CREATE POLICY "Users can view their own prompts and global defaults"
ON public.prompts FOR SELECT
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their own prompts"
ON public.prompts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own prompts"
ON public.prompts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own prompts"
ON public.prompts FOR DELETE
USING (auth.uid() = user_id);

-- Create user_api_settings table for storing API keys
CREATE TABLE public.user_api_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  openai_api_key text,
  replicate_api_token text,
  replicate_model text DEFAULT 'google/nano-banana-pro',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on user_api_settings
ALTER TABLE public.user_api_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_api_settings
CREATE POLICY "Users can view their own settings"
ON public.user_api_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
ON public.user_api_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
ON public.user_api_settings FOR UPDATE
USING (auth.uid() = user_id);

-- Create article_image_prompts table
CREATE TABLE public.article_image_prompts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  prompt_text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on article_image_prompts
ALTER TABLE public.article_image_prompts ENABLE ROW LEVEL SECURITY;

-- RLS policy for article_image_prompts (through article ownership)
CREATE POLICY "Users can view prompts for their articles"
ON public.article_image_prompts FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.articles 
  WHERE articles.id = article_image_prompts.article_id 
  AND articles.user_id = auth.uid()
));

CREATE POLICY "Users can insert prompts for their articles"
ON public.article_image_prompts FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.articles 
  WHERE articles.id = article_image_prompts.article_id 
  AND articles.user_id = auth.uid()
));

CREATE POLICY "Users can delete prompts for their articles"
ON public.article_image_prompts FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.articles 
  WHERE articles.id = article_image_prompts.article_id 
  AND articles.user_id = auth.uid()
));

-- Create image_prompt_templates table
CREATE TABLE public.image_prompt_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_text text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on image_prompt_templates
ALTER TABLE public.image_prompt_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for image_prompt_templates
CREATE POLICY "Users can view their own templates and global defaults"
ON public.image_prompt_templates FOR SELECT
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert their own templates"
ON public.image_prompt_templates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
ON public.image_prompt_templates FOR UPDATE
USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_articles_updated_at
BEFORE UPDATE ON public.articles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prompts_updated_at
BEFORE UPDATE ON public.prompts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_api_settings_updated_at
BEFORE UPDATE ON public.user_api_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default global prompts
INSERT INTO public.prompts (user_id, type, niche, prompt_text, is_default) VALUES
(NULL, 'classic', 'general', 'Write a comprehensive, SEO-optimized article about "{title}". Include an engaging introduction, well-structured sections with H2 headings, and a conclusion. Make it informative, engaging, and at least 1500 words. Return ONLY valid HTML.', true),
(NULL, 'classic', 'food', 'Write a comprehensive, SEO-optimized food article about "{title}". Include recipe details, cooking tips, nutritional information, and beautiful descriptions. Use H2 headings for sections. Return ONLY valid HTML.', true),
(NULL, 'classic', 'decor', 'Write a comprehensive, SEO-optimized home decor article about "{title}". Include design tips, styling suggestions, and practical advice. Use H2 headings for sections. Return ONLY valid HTML.', true),
(NULL, 'classic', 'fashion', 'Write a comprehensive, SEO-optimized fashion article about "{title}". Include styling tips, trend analysis, and outfit suggestions. Use H2 headings for sections. Return ONLY valid HTML.', true),
(NULL, 'listicle', 'general', 'Write a listicle article titled "{title}" with exactly {itemCount} items. Each item should have an H2 heading. Include engaging descriptions for each item. Start with an H1 title. Return ONLY valid HTML.', true),
(NULL, 'listicle', 'food', 'Write a food listicle titled "{title}" with exactly {itemCount} recipes or food items. Each item should have an H2 heading with recipe name, ingredients list, and brief instructions. Return ONLY valid HTML.', true),
(NULL, 'listicle', 'decor', 'Write a home decor listicle titled "{title}" with exactly {itemCount} decor ideas. Each item should have an H2 heading with description and styling tips. Return ONLY valid HTML.', true),
(NULL, 'listicle', 'fashion', 'Write a fashion listicle titled "{title}" with exactly {itemCount} fashion items or outfits. Each item should have an H2 heading with styling suggestions. Return ONLY valid HTML.', true);

-- Insert default image prompt template
INSERT INTO public.image_prompt_templates (user_id, prompt_text, is_default) VALUES
(NULL, 'Based on this article about "{title}", create {count} unique, high-quality image prompts for AI image generation. Each prompt should describe a specific scene or concept from the article. Article excerpt: {content}', true);