import { ReactNode, useEffect, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { supabase } from '@/integrations/supabase/client';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    fetchCompletedCount();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('recipes-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recipes',
        },
        () => {
          fetchCompletedCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCompletedCount = async () => {
    try {
      const { count, error } = await supabase
        .from('recipes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

      if (!error && count !== null) {
        setCompletedCount(count);
      }
    } catch (error) {
      console.error('Error fetching completed count:', error);
    }
  };

  return (
    <div className="flex min-h-screen w-full gradient-page">
      <AppSidebar completedCount={completedCount} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
