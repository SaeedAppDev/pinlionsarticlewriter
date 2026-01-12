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

const ModeCard = ({ mode, title, icon, isActive, onClick }: ModeCardProps) => {
  // Classic card: white bg, purple icon. Listicle card: green gradient when active
  const isListicle = mode === 'listicle';
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center p-8 rounded-2xl transition-all duration-300 min-h-[220px] w-[320px]",
        "hover:scale-[1.03] hover:shadow-2xl",
        isListicle && isActive
          ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/40"
          : isActive && !isListicle
            ? "bg-card border-2 border-primary shadow-lg hover:shadow-primary/20"
            : "bg-card border border-border hover:border-primary/50 hover:shadow-lg"
      )}
    >
      <div
        className={cn(
          "w-16 h-16 rounded-xl flex items-center justify-center mb-5",
          isListicle && isActive
            ? "bg-white/20"
            : isListicle
              ? "bg-emerald-100"
              : "bg-gradient-to-br from-indigo-400 to-purple-500"
        )}
      >
        <span className={cn(
          "w-8 h-8",
          isListicle && isActive
            ? "text-white"
            : isListicle
              ? "text-emerald-600"
              : "text-white"
        )}>
          {icon}
        </span>
      </div>
      <h3 className={cn(
        "text-xl font-semibold",
        isListicle && isActive ? "text-white" : "text-foreground"
      )}>
        {title}
      </h3>
      {isActive && (
        <div className={cn(
          "flex items-center gap-1.5 mt-3 text-sm font-medium",
          isListicle ? "text-white/90" : "text-emerald-500"
        )}>
          <Check className="w-4 h-4" />
          <span>Active</span>
        </div>
      )}
    </button>
  );
};

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
        
        <div className="flex flex-row gap-8 justify-center items-start">
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
