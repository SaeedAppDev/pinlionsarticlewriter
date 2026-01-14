import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/mode");
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        toast({
          title: "Welcome!",
          description: "Successfully signed in.",
        });
        navigate("/mode");
      }
      if (event === "SIGNED_OUT") {
        navigate("/login");
      }
      if (event === "PASSWORD_RECOVERY") {
        toast({
          title: "Check your email",
          description: "Password reset link has been sent.",
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const redirectUrl = `${window.location.origin}/`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold bg-[linear-gradient(90deg,#7C3AED_0%,#9333EA_50%,#EC4899_100%)] bg-clip-text text-transparent mb-2">
            Pin Lions
          </h1>
          <p className="text-slate-400">Article Writer</p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-8 shadow-2xl">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#7C3AED',
                    brandAccent: '#9333EA',
                    inputBackground: 'rgba(30, 41, 59, 0.5)',
                    inputBorder: 'rgba(100, 116, 139, 0.3)',
                    inputText: '#f1f5f9',
                    inputPlaceholder: '#64748b',
                  },
                  borderWidths: {
                    buttonBorderWidth: '0px',
                    inputBorderWidth: '1px',
                  },
                  radii: {
                    borderRadiusButton: '0.75rem',
                    buttonBorderRadius: '0.75rem',
                    inputBorderRadius: '0.75rem',
                  },
                },
              },
              className: {
                container: 'auth-container',
                button: 'auth-button',
                input: 'auth-input',
                label: 'auth-label text-slate-300',
                anchor: 'text-purple-400 hover:text-purple-300',
              },
            }}
            providers={[]}
            redirectTo={redirectUrl}
          />
        </div>

        <p className="text-center text-slate-500 text-sm mt-8">
          © 2026 Pin Lions. All rights reserved.
        </p>
      </div>
    </div>
  );
}
