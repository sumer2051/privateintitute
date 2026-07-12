import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Lock, Sparkles, Eye, EyeOff, Mail, User, CheckCircle2, AlertCircle, MailCheck, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import logo from "@/assets/logo.png";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawNext = searchParams.get("next");
  const nextPath = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;
  const inviteToken = searchParams.get("invite");
  const invitedEmail = searchParams.get("email");
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(!inviteToken);
  const [email, setEmail] = useState(invitedEmail || "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [inviteChecking, setInviteChecking] = useState(!!inviteToken);
  const [inviteValid, setInviteValid] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordValid = password.length >= 6;


  // 2FA prompt state (post-login, optional)
  const [tfaOpen, setTfaOpen] = useState(false);
  const [tfaCode, setTfaCode] = useState("");
  const [tfaInput, setTfaInput] = useState("");
  const [tfaDest, setTfaDest] = useState("");

  // Validate invitation token on load
  useEffect(() => {
    if (!inviteToken) return;
    (async () => {
      const { data, error } = await supabase.functions.invoke("validate-invitation", {
        body: { token: inviteToken },
      });

      if (error || !(data as any)?.valid) {
        setInviteError((data as any)?.message || "This invitation link is invalid.");
      } else if ((data as any).status !== "pending") {
        setInviteError(`This invitation has already been ${(data as any).status}.`);
      } else if (new Date((data as any).expires_at) < new Date()) {
        setInviteError("This invitation has expired. Ask your admin for a new one.");
      } else {
        setInviteValid(true);
        setEmail((data as any).email);
      }
      setInviteChecking(false);
    })();
  }, [inviteToken]);

  const proceedAfterLogin = () => {
    toast({ title: "Welcome back!", description: "You have successfully logged in." });
    if (nextPath) {
      window.location.href = nextPath;
    } else {
      navigate("/accounts");
    }
  };


  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        setUnverifiedEmail(null);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const msg = (error.message || "").toLowerCase();
          if (msg.includes("email not confirmed") || msg.includes("not confirmed") || msg.includes("email_not_confirmed")) {
            setUnverifiedEmail(email);
            throw new Error("Your email hasn't been verified yet. Please check your inbox for the activation link.");
          }
          throw error;
        }

        // Check 2FA preference
        const userId = data.user?.id;
        if (userId) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("two_factor_enabled, two_factor_method, phone")
            .eq("id", userId)
            .maybeSingle();
          if (prof && (prof as any).two_factor_enabled) {
            const method = (prof as any).two_factor_method || "sms";
            const dest = method === "sms" ? ((prof as any).phone || email) : email;
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            setTfaCode(code);
            setTfaDest(dest);
            setTfaInput("");
            setTfaOpen(true);
            toast({
              title: "Verification code sent",
              description: `Code sent to ${dest}. (Demo code: ${code})`,
            });
            setLoading(false);
            return;
          }
        }

        proceedAfterLogin();
      } else {
        if (!inviteToken || !inviteValid) {
          throw new Error("Signup is invite-only. Please use the link from your invitation email.");
        }
        if (invitedEmail && email.trim().toLowerCase() !== invitedEmail.toLowerCase()) {
          throw new Error("This invitation was issued to a different email address.");
        }
        const signupRedirect = nextPath
          ? `${window.location.origin}${nextPath}`
          : `${window.location.origin}/`;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, invite_token: inviteToken },
            emailRedirectTo: signupRedirect,
          },
        });
        if (error) throw error;

        // If email confirmation is required, session will be null
        if (!data.session) {
          setPendingVerificationEmail(email);
          toast({
            title: "Check your inbox",
            description: "We sent you a secure activation link to verify your email.",
          });
        } else {
          toast({ title: "Account created!", description: "You can now log in with your credentials." });
          setIsLogin(true);
        }
      }


    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const verifyTfa = () => {
    if (tfaInput.trim() !== tfaCode) {
      toast({ title: "Invalid code", description: "Please try again.", variant: "destructive" });
      return;
    }
    setTfaOpen(false);
    proceedAfterLogin();
  };

  const skipTfa = () => {
    setTfaOpen(false);
    toast({ title: "Skipped 2FA", description: "You can enable it again in Settings." });
    proceedAfterLogin();
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
              {isLogin ? "Sign in to access your private portfolio" : "Complete your invited account setup"}
            </CardDescription>
            <p className="mx-auto max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
              Independent private banking portal. Access is by invitation only.
            </p>
          </CardHeader>

          <CardContent>
            {inviteToken && inviteChecking && (
              <div className="mb-4 rounded-md border border-primary/30 bg-primary/5 p-3 text-center text-sm text-muted-foreground">
                Verifying invitation...
              </div>
            )}
            {inviteToken && !inviteChecking && inviteError && (
              <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-center text-sm text-destructive">
                {inviteError}
              </div>
            )}
            {inviteToken && inviteValid && !isLogin && (
              <div className="mb-4 rounded-md border border-success/40 bg-success/10 p-3 text-center text-xs text-success">
                ✓ Invitation verified for {email}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-5">
              {!isLogin && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <Label htmlFor="fullName" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Full Name</Label>
                  <div className="relative group">
                    <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="fullName"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="pl-10 h-11 transition-all focus:ring-2 focus:ring-primary/40 focus:border-primary/60 hover:border-primary/30"
                    />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email Address</Label>
                <div className="relative group">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setEmailTouched(true)}
                    required
                    aria-invalid={emailTouched && !emailValid}
                    className={`pl-10 pr-10 h-11 transition-all focus:ring-2 focus:ring-primary/40 focus:border-primary/60 hover:border-primary/30 ${emailTouched && !emailValid ? "border-destructive/60 focus:ring-destructive/30" : ""}`}
                  />
                  {emailTouched && email && (
                    emailValid
                      ? <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-success animate-in fade-in zoom-in-50" />
                      : <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive animate-in fade-in zoom-in-50" />
                  )}
                </div>
                {emailTouched && email && !emailValid && (
                  <p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1">Please enter a valid email address.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Password</Label>
                  {!isLogin && <span className="text-[10px] text-muted-foreground">Min. 6 characters</span>}
                </div>
                <div className="relative group">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setPasswordTouched(true)}
                    required
                    minLength={6}
                    aria-invalid={passwordTouched && !passwordValid}
                    className={`pl-10 pr-10 h-11 transition-all focus:ring-2 focus:ring-primary/40 focus:border-primary/60 hover:border-primary/30 ${passwordTouched && !passwordValid ? "border-destructive/60 focus:ring-destructive/30" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors focus:outline-none focus:text-primary"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordTouched && !passwordValid && (
                  <p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1">Password must be at least 6 characters.</p>
                )}
              </div>
              <Button
                type="submit"
                className="group relative w-full h-11 overflow-hidden bg-gradient-to-r from-primary via-primary to-accent hover:shadow-lg hover:shadow-primary/40 transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:hover:scale-100"
                disabled={loading}
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-full transition-transform duration-700" />
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

            <div className="mt-5 text-center">
              {isLogin ? (
                <p className="text-xs text-muted-foreground">
                  New here? Access is <span className="font-semibold text-primary">invite-only</span>. Use the link from your invitation email.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className="text-sm text-primary hover:underline transition-colors"
                >
                  Already have an account? Sign in
                </button>
              )}
            </div>


            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground border-t pt-4">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              <span>Secure encrypted access · Private portal demo</span>
            </div>
          </CardContent>
        </div>
      </Card>

      <Dialog open={tfaOpen} onOpenChange={setTfaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Two-Factor Verification</DialogTitle>
            <DialogDescription>
              A 6-digit code was sent to <span className="font-semibold text-secondary">{tfaDest}</span>. Verification is optional — you may skip this time.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="tfa">Verification Code</Label>
            <Input
              id="tfa"
              value={tfaInput}
              onChange={(e) => setTfaInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              className="text-center text-2xl tracking-[0.5em] font-mono"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={skipTfa}>Skip this time</Button>
            <Button onClick={verifyTfa}>Verify & Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;
