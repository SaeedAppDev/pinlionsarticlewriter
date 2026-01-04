import { useLocation, useNavigate } from 'react-router-dom';
import { Send, Clock, CheckCircle, Settings, Sun, Moon, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  path: string;
  badge?: number;
}

const NavItem = ({ icon, label, path, badge }: NavItemProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = location.pathname === path || 
    (path === '/' && location.pathname === '/recipes') ||
    (path === '/add-articles' && location.pathname === '/add-recipes');

  return (
    <button
      onClick={() => navigate(path)}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium border border-sidebar-border"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
      )}
    >
      <span className={cn(
        "flex-shrink-0",
        isActive ? "text-primary" : "text-muted-foreground"
      )}>
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary text-primary-foreground">
          {badge}
        </span>
      )}
    </button>
  );
};

export const AppSidebar = ({ completedCount = 0 }: { completedCount?: number }) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
      setIsDark(true);
    }
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
    setIsDark(!isDark);
  };

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Send className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-sidebar-foreground">Pin Lions</h1>
            <p className="text-xs text-muted-foreground">Article Writer</p>
          </div>
        </div>
      </div>

      {/* Theme Toggle */}
      <div className="px-4 pt-4">
        <Button
          variant="outline"
          className="w-full justify-center gap-2"
          onClick={toggleTheme}
        >
          {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          {isDark ? 'Dark' : 'Light'}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <NavItem
          icon={<Send className="w-5 h-5" />}
          label="Add Articles"
          path="/add-articles"
        />
        <NavItem
          icon={<Clock className="w-5 h-5" />}
          label="Queue"
          path="/queue"
        />
        <NavItem
          icon={<CheckCircle className="w-5 h-5" />}
          label="Completed"
          path="/completed"
          badge={completedCount}
        />
        <NavItem
          icon={<ImageIcon className="w-5 h-5" />}
          label="Pinterest Pins"
          path="/pinterest"
        />
        <NavItem
          icon={<Settings className="w-5 h-5" />}
          label="Settings"
          path="/settings"
        />
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground text-center">Version 1.0.0</p>
        <p className="text-xs text-muted-foreground text-center">© 2026 Pin Lions</p>
        <p className="text-xs text-muted-foreground text-center mt-1">Developed by Saeed Ahmed</p>
      </div>
    </aside>
  );
};

export default AppSidebar;
