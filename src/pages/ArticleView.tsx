import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const ArticleView = () => {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<{ title: string; article_content: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;

    // Use simple fetch - fastest approach
    const controller = new AbortController();
    
    fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/recipes?id=eq.${id}&select=title,article_content`,
      {
        signal: controller.signal,
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      }
    )
    .then(res => res.json())
    .then(data => {
      if (data?.[0]) {
        setArticle(data[0]);
      } else {
        toast.error('Article not found');
      }
    })
    .catch(err => {
      if (err.name !== 'AbortError') {
        console.error('Error:', err);
        toast.error('Failed to load article');
      }
    })
    .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [id]);

  // Process HTML - optimize images for lazy loading
  const processedContent = useMemo(() => {
    if (!article?.article_content) return '';
    
    // Replace base64 images with lazy loading and add placeholder
    return article.article_content
      .replace(/<img([^>]*)(src="data:image[^"]*")([^>]*)>/gi, 
        '<img$1$2$3 loading="lazy" decoding="async" style="background:#f3f4f6;min-height:200px">')
      .replace(/<img([^>]*)(src="http[^"]*")([^>]*)>/gi,
        '<img$1$2$3 loading="lazy" decoding="async">');
  }, [article?.article_content]);

  const handleCopyHTML = useCallback(async () => {
    if (!article?.article_content) return;
    
    try {
      await navigator.clipboard.writeText(article.article_content);
      setCopied(true);
      toast.success('HTML copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy HTML');
    }
  }, [article?.article_content]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
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
          <Button onClick={() => window.close()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Close
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
          font-family: 'Merriweather', Georgia, serif;
          color: #374151;
        }
        .article-content h1 {
          font-family: 'Merriweather', Georgia, serif;
          font-size: 28px;
          font-weight: 700;
          line-height: 1.3;
          margin-bottom: 0.5rem;
          color: #111827;
          letter-spacing: -0.01em;
        }
        .article-content h2 {
          font-family: 'Merriweather', Georgia, serif;
          font-size: 24px;
          font-weight: 700;
          line-height: 1.3;
          margin-top: 2.5rem;
          margin-bottom: 1rem;
          color: #111827;
        }
        .article-content h3 {
          font-family: 'Merriweather', Georgia, serif;
          font-size: 20px;
          font-weight: 700;
          line-height: 1.4;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
          color: #111827;
        }
        .article-content p {
          font-family: 'Merriweather', Georgia, serif;
          font-size: 16px;
          line-height: 1.75;
          margin-bottom: 1rem;
          color: #374151;
        }
        .article-content ul, .article-content ol {
          margin-bottom: 1.5rem;
          padding-left: 1.25rem;
          list-style-type: disc;
        }
        .article-content li {
          font-family: 'Merriweather', Georgia, serif;
          font-size: 16px;
          line-height: 1.75;
          margin-bottom: 0.75rem;
          color: #374151;
        }
        .article-content li strong {
          font-weight: 700;
          color: #111827;
        }
        .article-content img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 1.5rem 0;
        }
        .article-content strong {
          font-weight: 700;
          color: #111827;
        }
        .article-content a {
          color: #2563eb;
          text-decoration: underline;
        }
        .article-content a:hover {
          color: #1d4ed8;
        }
      `}</style>
    </div>
  );
};

export default ArticleView;
