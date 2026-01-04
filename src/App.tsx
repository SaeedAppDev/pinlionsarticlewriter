import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AddArticles from "./pages/AddArticles";
import Queue from "./pages/Queue";
import Completed from "./pages/Completed";
import ArticleView from "./pages/ArticleView";
import Settings from "./pages/Settings";
import Pinterest from "./pages/Pinterest";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/add-articles" replace />} />
          <Route path="/add-articles" element={<AddArticles />} />
          <Route path="/add-recipes" element={<Navigate to="/add-articles" replace />} />
          <Route path="/queue" element={<Queue />} />
          <Route path="/recipes" element={<Navigate to="/queue" replace />} />
          <Route path="/completed" element={<Completed />} />
          <Route path="/article/:id" element={<ArticleView />} />
          <Route path="/pinterest" element={<Pinterest />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
