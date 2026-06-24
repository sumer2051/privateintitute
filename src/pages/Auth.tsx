import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Lock, Sparkles } from "lucide-react";
import logo from "@/assets/logo.png";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Welcome back!", description: "You have successfully logged in." });
        navigate("/accounts");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        toast({ title: "Account created!", description: "You can now log in with your credentials." });
        setIsLogin(true);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-secondary via-secondary to-[hsl(222_60%_8%)] p-4">
      {/* Animated background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/30 blur-[120px] animate-pulse" />
        <div className="absolute top-1/2 -right-32 h-[28rem] w-[28rem] rounded-full bg-accent/30 blur-[120px] animate-pulse [animation-delay:1.2s]" />
        <div className="absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-primary/20 blur-[100px] animate-pulse [animation-delay:2.4s]" />
      </div>

      {/* Grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
        }}
      />

      <Card className="relative w-full max-w-md border-white/10 bg-card/95 backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in-95 duration-500">
        {/* Glowing border */}
        <div className="pointer-events-none absolute -inset-px rounded-lg bg-gradient-to-r from-primary via-accent to-primary opacity-40 blur-sm" />
        <div className="relative bg-card rounded-lg">
          <CardHeader className="space-y-1 pt-8">
            <div className="flex justify-center mb-4">
              <div className="relative group">
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary via-accent to-primary blur-xl opacity-70 group-hover:opacity-100 transition-opacity animate-pulse" />
                <div className="absolute inset-0 rounded-full bg-gradient-conic from-primary via-accent to-primary opacity-50" />
                <img
                  src={logo}
                  alt="BoA private institute"
                  width={96}
                  height={96}
                  className="relative h-24 w-24 rounded-full object-contain ring-4 ring-primary/40 shadow-2xl animate-logo-glow hover:scale-105 transition-transform duration-500"
                />
                <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-accent animate-pulse" />
              </div>
            </div>
            <CardTitle className="text-center font-display text-3xl font-bold text-secondary tracking-tight">
              BoA <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">private</span> institute
            </CardTitle>
            <p className="text-center text-[10px] uppercase tracking-[0.3em] font-semibold bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] bg-clip-text text-transparent animate-shimmer">
              Wealth · Trust · Legacy
            </p>
            <CardDescription className="text-center pt-2">
              {isLogin ? "Sign in to access your private portfolio" : "Create your private banking account"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="transition-all focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="transition-all focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="transition-all focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-primary via-primary to-accent hover:opacity-90 shadow-lg hover:shadow-primary/40 transition-all duration-300 hover:scale-[1.02]"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                    Securing connection...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    {isLogin ? "Sign In Securely" : "Create Account"}
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-primary hover:underline transition-colors"
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground border-t pt-4">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              <span>256-bit encryption · FDIC-style protected</span>
            </div>
          </CardContent>
        </div>
      </Card>
    </div>
  );
};

export default Auth;
