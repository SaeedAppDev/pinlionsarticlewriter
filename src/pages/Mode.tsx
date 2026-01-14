import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, List, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Mode() {
  const navigate = useNavigate();
  const currentMode = localStorage.getItem("articleMode") || "classic";

  const handleModeSelect = (mode: "classic" | "listicle") => {
    localStorage.setItem("articleMode", mode);
    navigate("/add");
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 text-slate-900 dark:text-slate-50">Choose Your Content Type</h1>
        <p className="text-sm text-slate-500 dark:text-slate-300">Select the type of article you want to create</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card
          className={`p-8 cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] ${
            currentMode === "classic"
              ? "border-primary border-2 shadow-md"
              : "border-border hover:border-primary/50"
          }`}
          onClick={() => handleModeSelect("classic")}
        >
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 rounded-full bg-gradient-to-br from-primary to-purple-600">
              <FileText className="h-8 w-8 text-white" />
            </div>
            {currentMode === "classic" && (
              <div className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
                Active
              </div>
            )}
            <div>
              <h3 className="text-xl font-semibold mb-2">Information Article</h3>
              <p className="text-sm text-muted-foreground">
                Deep, comprehensive articles that explain topics in detail. Perfect for guides,
                tutorials, and educational content.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              <span>AI-powered content generation</span>
            </div>
          </div>
        </Card>

        <Card
          className={`p-8 cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] ${
            currentMode === "listicle"
              ? "border-emerald-500 border-2 shadow-md bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30"
              : "border-border hover:border-emerald-500/50"
          }`}
          onClick={() => handleModeSelect("listicle")}
        >
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500">
              <List className="h-8 w-8 text-white" />
            </div>
            {currentMode === "listicle" && (
              <div className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-full">
                Active
              </div>
            )}
            <div>
              <h3 className="text-xl font-semibold mb-2">Round-Up / Listicle</h3>
              <p className="text-sm text-muted-foreground">
                Numbered collections of ideas, tips, or products. Great for "Top 10" lists,
                curated recommendations, and roundups.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              <span>Structured list generation</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
