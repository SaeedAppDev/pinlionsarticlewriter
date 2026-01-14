import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { AppLayout } from "@/components/AppLayout";

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
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-foreground">Add Articles to Queue</h1>
            <p className="text-muted-foreground">
              Enter article titles (one per line) and add them to the generation queue.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className="rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide uppercase bg-foreground text-background">
              MODE · {type === "classic" ? "CLASSIC" : "LISTICLE"}
            </Badge>
            <Badge variant="outline" className="rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide uppercase">
              NICHE · {niche.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Main Form Card */}
        <Card className="p-6 mb-6 bg-card border-border rounded-2xl shadow-card">
          <div className="space-y-6">
            {/* Type and Niche Row */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Type</label>
                <p className="text-xs text-muted-foreground">
                  Information Articles are deep, explanatory posts. Round-Ups / Listicles are numbered collections of ideas, tips, or products.
                </p>
                <Select value={type} onValueChange={(v) => setType(v as "classic" | "listicle")}>
                  <SelectTrigger className="bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-50">
                    <SelectItem value="classic">Information Article</SelectItem>
                    <SelectItem value="listicle">Round-Up / Listicle</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Niche</label>
                <Select value={niche} onValueChange={setNiche}>
                  <SelectTrigger className="bg-card mt-6">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-50">
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="food">Food</SelectItem>
                    <SelectItem value="decor">Decor</SelectItem>
                    <SelectItem value="fashion">Fashion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Titles Textarea */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Article Titles (one per line)
              </label>
              <Textarea
                value={titles}
                onChange={(e) => setTitles(e.target.value)}
                placeholder={
                  type === "classic"
                    ? "How to Master Web Development\nThe Ultimate Guide to React Hooks\nBuilding Modern Web Apps"
                    : "10 Ways to Style Your Living Room\n15 Easy Weeknight Pasta Recipes\n20 Fashion Trends for Spring"
                }
                className="min-h-[200px] font-mono text-sm bg-card"
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">{titleLines.length} title(s) entered</p>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || titleLines.length === 0}
                className="gradient-button text-white border-0"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add to Queue
              </Button>
            </div>
          </div>
        </Card>

        {/* How It Works Card */}
        <Card className="p-6 bg-muted/50 border-border">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold mb-3 text-foreground">How It Works</h4>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-foreground">1.</span>
                  <span>Enter article titles (one per line)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-foreground">2.</span>
                  <span>Click "Add to Queue"</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-foreground">3.</span>
                  <span>Go to "Queue" in the sidebar</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-foreground">4.</span>
                  <span>Click "Generate All Articles"</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-foreground">5.</span>
                  <span>Watch as each article is generated automatically</span>
                </li>
              </ol>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
