import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const ArticleView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<{ title: string; article_content: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchArticle = async () => {
      if (!id) return;

      try {
        // Use streaming fetch for faster initial response
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/recipes?id=eq.${id}&select=title,article_content`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              'Accept-Encoding': 'gzip, deflate',
            },
          }
        );

        // Stream the response for faster processing
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No reader available');
        }

        const chunks: Uint8Array[] = [];
        let done = false;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            chunks.push(value);
          }
        }

        // Combine chunks and decode
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }

        const text = new TextDecoder().decode(combined);
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

  // Process HTML to add lazy loading to images for faster rendering
  const processedContent = useMemo(() => {
    if (!article?.article_content) return '';
    
    // Add loading="lazy" and decoding="async" to all images for faster initial render
    return article.article_content
      .replace(/<img /g, '<img loading="lazy" decoding="async" ')
      .replace(/loading="lazy" loading="lazy"/g, 'loading="lazy"');
  }, [article?.article_content]);

  const handleCopyHTML = async () => {
    if (!article?.article_content) return;
    
    try {
      await navigator.clipboard.writeText(article.article_content);
      setCopied(true);
      toast.success('HTML copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy HTML');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-8 w-3/4 mb-4" />
          <Skeleton className="h-64 w-full mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-2/3 mb-4" />
          <Skeleton className="h-6 w-1/2 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
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
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="ghost" 
            onClick={() => window.close()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Close
          </Button>
          
          <Button 
            variant="outline"
            onClick={handleCopyHTML}
            className="gap-2"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy HTML'}
          </Button>
        </div>

        <article className="prose prose-lg max-w-none dark:prose-invert">
          <div 
            dangerouslySetInnerHTML={{ __html: processedContent }}
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
          background: hsl(var(--muted));
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
