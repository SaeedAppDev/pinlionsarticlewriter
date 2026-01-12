import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, List, Check } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { cn } from '@/lib/utils';

type ContentMode = 'classic' | 'listicle';

interface ModeCardProps {
  mode: ContentMode;
  title: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}

const ModeCard = ({ mode, title, icon, isActive, onClick }: ModeCardProps) => (
  <button
    onClick={onClick}
    className={cn(
      "relative flex flex-col items-center justify-center p-8 rounded-2xl transition-all duration-300 min-h-[200px] w-full max-w-[280px]",
      isActive
        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-[1.02]"
        : "bg-card border border-border hover:border-primary/50 hover:shadow-md"
    )}
  >
    <div
      className={cn(
        "w-14 h-14 rounded-xl flex items-center justify-center mb-4",
        isActive
          ? "bg-primary-foreground/20"
          : "bg-primary/10"
      )}
    >
      <span className={cn(
        "w-7 h-7",
        isActive ? "text-primary-foreground" : "text-primary"
      )}>
        {icon}
      </span>
    </div>
    <h3 className={cn(
      "text-lg font-semibold",
      isActive ? "text-primary-foreground" : "text-foreground"
    )}>
      {title}
    </h3>
    {isActive && (
      <div className="flex items-center gap-1 mt-2 text-sm text-primary-foreground/80">
        <Check className="w-4 h-4" />
        <span>Active</span>
      </div>
    )}
  </button>
);

const Mode = () => {
  const navigate = useNavigate();
  const [activeMode, setActiveMode] = useState<ContentMode>('classic');

  useEffect(() => {
    const savedSettings = localStorage.getItem('article_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.articleStyle === 'listicle') {
          setActiveMode('listicle');
        } else {
          setActiveMode('classic');
        }
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
  }, []);

  const handleModeSelect = (mode: ContentMode) => {
    setActiveMode(mode);
    
    // Update settings in localStorage
    const savedSettings = localStorage.getItem('article_settings');
    let settings = {};
    if (savedSettings) {
      try {
        settings = JSON.parse(savedSettings);
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
    
    // Map mode to articleStyle
    const articleStyle = mode === 'listicle' ? 'listicle' : 'general';
    localStorage.setItem('article_settings', JSON.stringify({ ...settings, articleStyle }));
    
    // Navigate to add articles page
    setTimeout(() => {
      navigate('/add-articles');
    }, 300);
  };

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[calc(100vh-200px)]">
        <h1 className="text-3xl font-bold text-foreground mb-12">
          Choose Your Content Type
        </h1>
        
        <div className="flex flex-wrap gap-6 justify-center">
          <ModeCard
            mode="classic"
            title="Classic Article Writer"
            icon={<FileText className="w-full h-full" />}
            isActive={activeMode === 'classic'}
            onClick={() => handleModeSelect('classic')}
          />
          <ModeCard
            mode="listicle"
            title="Listicle Writer"
            icon={<List className="w-full h-full" />}
            isActive={activeMode === 'listicle'}
            onClick={() => handleModeSelect('listicle')}
          />
        </div>
      </div>
    </AppLayout>
  );
};

export default Mode;
