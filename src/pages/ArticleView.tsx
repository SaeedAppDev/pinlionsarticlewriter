import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ArticleView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<{ title: string; article_content: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchArticle = async () => {
      if (!id) return;

      try {
        // Use raw fetch to avoid JSON parsing issues with large content
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/recipes?id=eq.${id}&select=title,article_content`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
          }
        );

        const text = await response.text();
        const data = JSON.parse(text);

        if (data && data.length > 0) {
          setArticle(data[0]);
        } else {
          toast.error('Article not found');
        }
      } catch (error) {
        console.error('Error fetching article:', error);
        toast.error('Failed to load article');
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticle();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading article...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Article not found</p>
          <Button onClick={() => navigate('/recipes')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Recipes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          onClick={() => window.close()}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Close
        </Button>

        <article className="prose prose-lg max-w-none dark:prose-invert">
          <div 
            dangerouslySetInnerHTML={{ __html: article.article_content || '' }}
            className="article-content"
          />
        </article>
      </div>

      <style>{`
        .article-content {
          font-family: 'Merriweather', serif;
        }
        .article-content h1 {
          font-family: 'Merriweather', serif;
          font-size: 32px;
          font-weight: 700;
          line-height: 48px;
          margin-bottom: 1.5rem;
          color: hsl(var(--foreground));
        }
        .article-content h2 {
          font-family: 'Merriweather', serif;
          font-size: 28px;
          font-weight: 700;
          line-height: 42px;
          font-style: italic;
          margin-top: 2rem;
          margin-bottom: 1rem;
          color: hsl(var(--foreground));
        }
        .article-content h3 {
          font-family: 'Merriweather', serif;
          font-size: 24px;
          font-weight: 700;
          line-height: 36px;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: hsl(var(--foreground));
        }
        .article-content p {
          font-family: 'Merriweather', serif;
          font-size: 17px;
          line-height: 27px;
          margin-bottom: 1rem;
          color: hsl(var(--foreground));
        }
        .article-content ul, .article-content ol {
          margin-bottom: 1rem;
          padding-left: 1.5rem;
        }
        .article-content li {
          font-family: 'Merriweather', serif;
          font-size: 17px;
          font-weight: 700;
          line-height: 27px;
          margin-bottom: 0.5rem;
          color: hsl(var(--foreground));
        }
        .article-content img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 1.5rem 0;
        }
        .article-content strong {
          font-weight: 700;
          color: hsl(var(--foreground));
        }
      `}</style>
    </div>
  );
};

export default ArticleView;
