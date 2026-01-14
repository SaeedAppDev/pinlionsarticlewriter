import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Info } from "lucide-react";

export default function Add() {
  const { toast } = useToast();
  const currentMode = localStorage.getItem("articleMode") || "classic";

  const [type, setType] = useState<"classic" | "listicle">(currentMode as "classic" | "listicle");
  const [niche, setNiche] = useState<string>("general");
  const [itemCount, setItemCount] = useState<string>("10");
  const [titles, setTitles] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titleLines = useMemo(() => {
    return titles
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }, [titles]);

  const handleSubmit = async () => {
    if (titleLines.length === 0) {
      toast({
        title: "No titles entered",
        description: "Please enter at least one article title.",
        variant: "destructive",
      });
      return;
    }

    if (type === "listicle" && (!itemCount || parseInt(itemCount) < 1)) {
      toast({
        title: "Invalid item count",
        description: "Please enter a valid item count for listicles.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const articles = titleLines.map((title) => ({
        user_id: user.id,
        type,
        niche,
        title,
        item_count: type === "listicle" ? parseInt(itemCount) : null,
        status: "pending",
      }));

      const { error } = await supabase.from("articles").insert(articles);

      if (error) throw error;

      toast({
        title: "Success!",
        description: `Added ${titleLines.length} article(s) to your queue.`,
      });

      setTitles("");
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to add articles to queue.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight mb-1 text-slate-900 dark:text-slate-50">
            {type === "classic" ? "Add Articles to Queue" : "Add Listicles to Queue"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Enter {type === "classic" ? "article" : "listicle"} titles (one per line) and add them to the
            generation queue.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge className="rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase bg-slate-900 text-slate-50 dark:bg-slate-100 dark:text-slate-900">
            MODE · {type === "classic" ? "CLASSIC" : "LISTICLE"}
          </Badge>
          <Badge className="rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase border border-slate-400 text-slate-700 dark:border-slate-500 dark:text-slate-100 bg-transparent">
            NICHE · {niche.toUpperCase()}
          </Badge>
        </div>
      </div>

      <Card className="p-6 mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium block text-slate-700 dark:text-slate-200">Type</label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Information Articles are deep, explanatory posts. Round‑Ups / Listicles are numbered
                collections of ideas, tips, or products.
              </p>
              <Select value={type} onValueChange={(v) => setType(v as "classic" | "listicle")}>
                <SelectTrigger className="mt-1 bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 z-50">
                  <SelectItem value="classic">Information Article</SelectItem>
                  <SelectItem value="listicle">Round-Up / Listicle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block text-slate-700 dark:text-slate-200">Niche</label>
              <Select value={niche} onValueChange={setNiche}>
                <SelectTrigger className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 z-50">
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="food">Food</SelectItem>
                  <SelectItem value="decor">Decor</SelectItem>
                  <SelectItem value="fashion">Fashion</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {type === "listicle" && (
              <div>
                <label className="text-sm font-medium mb-2 block text-slate-700 dark:text-slate-200">Item Count</label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={itemCount}
                  onChange={(e) => setItemCount(e.target.value)}
                  placeholder="e.g., 10"
                  className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block text-slate-700 dark:text-slate-200">
              {type === "classic" ? "Article Titles" : "Listicle Titles"} (one per line)
            </label>
            <Textarea
              value={titles}
              onChange={(e) => setTitles(e.target.value)}
              placeholder={
                type === "classic"
                  ? "How to Master Web Development\nThe Ultimate Guide to React Hooks\nBuilding Modern Web Apps"
                  : "10 Ways to Style Your Living Room\n15 Easy Weeknight Pasta Recipes\n20 Fashion Trends for Spring"
              }
              className="min-h-[200px] font-mono text-sm bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-between pt-2 text-slate-600 dark:text-slate-300">
            <p className="text-sm">{titleLines.length} title(s) entered</p>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || titleLines.length === 0}
              className="bg-[linear-gradient(90deg,#7C3AED_0%,#9333EA_50%,#EC4899_100%)] text-white rounded-xl hover:brightness-105 disabled:opacity-60"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add to Queue
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-slate-500 dark:text-slate-200 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-semibold mb-3">How It Works</h4>
            <ol className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="font-bold">1.</span>
                <span>Enter article titles (one per line)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">2.</span>
                <span>Click "Add to Queue"</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">3.</span>
                <span>Go to "Queue" in the sidebar</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">4.</span>
                <span>Click "Generate All Articles"</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">5.</span>
                <span>Watch as each article is generated automatically</span>
              </li>
            </ol>
          </div>
        </div>
      </Card>
    </div>
  );
}
