import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, List, Lightbulb } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";

export default function Mode() {
  const navigate = useNavigate();
  const currentMode = localStorage.getItem("articleMode") || "classic";

  const handleModeSelect = (mode: "classic" | "listicle") => {
    localStorage.setItem("articleMode", mode);
    navigate("/add");
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-foreground">Choose Your Content Type</h1>
          <p className="text-muted-foreground">Select the type of article you want to create</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Classic Article Card */}
          <Card
            className={`p-8 cursor-pointer transition-all hover:shadow-lg ${
              currentMode === "classic"
                ? "border-2 border-primary shadow-md"
                : "border-border hover:border-primary/50"
            }`}
            onClick={() => handleModeSelect("classic")}
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center">
                <FileText className="h-10 w-10 text-white" />
              </div>
              {currentMode === "classic" && (
                <span className="px-4 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full">
                  Active
                </span>
              )}
              <div>
                <h3 className="text-xl font-semibold mb-2 text-foreground">Classic Article Writer</h3>
                <p className="text-sm text-muted-foreground">
                  Create in-depth, comprehensive articles with detailed content and insights
                </p>
              </div>
              <Button
                className="w-full gradient-button text-white border-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleModeSelect("classic");
                }}
              >
                Select Classic
              </Button>
            </div>
          </Card>

          {/* Listicle Card */}
          <Card
            className={`p-8 cursor-pointer transition-all hover:shadow-lg ${
              currentMode === "listicle"
                ? "border-2 border-emerald-500 shadow-md"
                : "border-border hover:border-emerald-500/50"
            }`}
            onClick={() => handleModeSelect("listicle")}
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center">
                <List className="h-10 w-10 text-white" />
              </div>
              {currentMode === "listicle" && (
                <span className="px-4 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium rounded-full">
                  Active
                </span>
              )}
              <div>
                <h3 className="text-xl font-semibold mb-2 text-foreground">Listicle Writer</h3>
                <p className="text-sm text-muted-foreground">
                  Generate engaging list-based articles with numbered or bulleted items
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  handleModeSelect("listicle");
                }}
              >
                Select Listicle
              </Button>
            </div>
          </Card>
        </div>

        {/* Quick Tip Card */}
        <Card className="p-6 bg-card border-border">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold mb-1 text-foreground">Quick Tip</h4>
              <p className="text-sm text-muted-foreground">
                You can switch between modes anytime. Your selection will be remembered for your next session.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
