import { useLocation, useNavigate } from 'react-router-dom';
import { Send, Clock, CheckCircle, Settings, Sun, Moon, Layers, PlusCircle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
    (path === '/mode' && location.pathname === '/');

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
  const navigate = useNavigate();

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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Failed to log out');
    }
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
          icon={<Layers className="w-5 h-5" />}
          label="Mode"
          path="/mode"
        />
        <NavItem
          icon={<PlusCircle className="w-5 h-5" />}
          label="Add"
          path="/add"
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
          icon={<Settings className="w-5 h-5" />}
          label="Settings"
          path="/settings"
        />
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground text-center">Version 2.0.0</p>
        <p className="text-xs text-muted-foreground text-center">© 2026 Pin Lions</p>
      </div>
    </aside>
  );
};

export default AppSidebar;
