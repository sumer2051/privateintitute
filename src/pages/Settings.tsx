import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, Bell, CreditCard, Camera, Shield, Loader2, CheckCircle2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Settings = () => {
  const [userId, setUserId] = useState<string>("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [dob, setDob] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState<string>("sms");
  const [twoFAOpen, setTwoFAOpen] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState<"setup" | "verify">("setup");
  const [twoFACode, setTwoFACode] = useState("");
  const [twoFAInput, setTwoFAInput] = useState("");

  const [pwdOpen, setPwdOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [txAlerts, setTxAlerts] = useState(true);
  const [billReminders, setBillReminders] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [notifOpen, setNotifOpen] = useState<null | "tx" | "bill">(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchProfile();
    const stored = localStorage.getItem("boa_notif_prefs");
    if (stored) {
      try {
        const p = JSON.parse(stored);
        setTxAlerts(p.txAlerts ?? true);
        setBillReminders(p.billReminders ?? true);
        setLoginAlerts(p.loginAlerts ?? true);
        setMarketing(p.marketing ?? false);
      } catch {}
    }
  }, []);

  const persistPrefs = (next: Partial<{ txAlerts: boolean; billReminders: boolean; loginAlerts: boolean; marketing: boolean }>) => {
    const prefs = { txAlerts, billReminders, loginAlerts, marketing, ...next };
    localStorage.setItem("boa_notif_prefs", JSON.stringify(prefs));
  };

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    setEmail(user.email || "");

    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (data) {
      setFullName(data.full_name || "");
      setEmail(data.email || user.email || "");
      setPhone(data.phone || "");
      setAddress((data as any).address || "");
      setDob((data as any).date_of_birth || "");
      setTwoFactorEnabled(!!(data as any).two_factor_enabled);
      setTwoFactorMethod((data as any).two_factor_method || "sms");
      const url = (data as any).avatar_url as string | undefined;
      if (url) {
        const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(url, 60 * 60);
        setAvatarUrl(signed?.signedUrl || "");
      }
    }
  };

  const initials = (fullName || email || "U")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleAvatarClick = () => fileRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please pick an image under 5 MB.", variant: "destructive" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Only image files are allowed.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("id", userId);
      if (dbErr) throw dbErr;

      const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
      setAvatarUrl(signed?.signedUrl || "");
      toast({ title: "Profile photo updated", description: "Your new photo has been saved." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const updateProfile = async () => {
    setLoading(true);
    if (!userId) return;

    const payload: any = {
      full_name: fullName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      date_of_birth: dob || null,
    };

    const { error } = await supabase.from("profiles").update(payload).eq("id", userId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile Updated", description: "Your changes have been saved." });
    }
    setLoading(false);
  };

  const openTwoFA = () => {
    if (twoFactorEnabled) {
      // Disable flow
      if (confirm("Disable two-factor authentication? Your account will be less secure.")) {
        supabase
          .from("profiles")
          .update({ two_factor_enabled: false })
          .eq("id", userId)
          .then(({ error }) => {
            if (error) {
              toast({ title: "Error", description: error.message, variant: "destructive" });
            } else {
              setTwoFactorEnabled(false);
              toast({ title: "Two-Factor Disabled", description: "2FA has been turned off.", variant: "destructive" });
            }
          });
      }
      return;
    }
    setTwoFAStep("setup");
    setTwoFACode("");
    setTwoFAInput("");
    setTwoFAOpen(true);
  };

  const sendTwoFACode = () => {
    if (twoFactorMethod === "sms" && !phone) {
      toast({ title: "Add phone first", description: "Save a phone number in Profile Information before using SMS.", variant: "destructive" });
      return;
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setTwoFACode(code);
    setTwoFAStep("verify");
    const dest = twoFactorMethod === "sms" ? phone : email;
    toast({
      title: "Verification code sent",
      description: `Code sent to ${dest}. (Demo code: ${code})`,
    });
  };

  const verifyTwoFA = async () => {
    if (twoFAInput.trim() !== twoFACode) {
      toast({ title: "Invalid code", description: "The code you entered doesn't match.", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ two_factor_enabled: true, two_factor_method: twoFactorMethod })
      .eq("id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setTwoFactorEnabled(true);
    setTwoFAOpen(false);
    toast({ title: "Two-Factor Enabled", description: "You'll be asked for a code on next login." });
  };

  const changePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated", description: "Your password has been changed." });
      setPwdOpen(false);
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const viewStatements = () => {
    toast({ title: "Statements", description: "Your latest statement is being prepared for download." });
    setTimeout(() => {
      const blob = new Blob(
        [`BoA private institute\nAccount Statement\n\nAccount holder: ${fullName || email}\nGenerated: ${new Date().toLocaleString()}\n\nFor full statement history, contact support.`],
        { type: "text/plain" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `statement-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }, 600);
  };

  const closeAccount = () => {
    if (!confirm("Are you sure you want to request account closure? This action is subject to review by our team.")) return;
    toast({
      title: "Closure request submitted",
      description: "Our support team will contact you within 2 business days to complete closure.",
    });
  };

  return (
    <AuthLayout currentPage="settings">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div>
          <h2 className="text-3xl font-bold text-secondary mb-2">Settings</h2>
          <p className="text-muted-foreground">Manage your account settings and preferences</p>
        </div>

        <div className="grid gap-6">
          {/* Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>Your personal details on file</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-20 w-20 ring-2 ring-primary/40 shadow">
                    <AvatarImage src={avatarUrl} alt={fullName} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xl font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={handleAvatarClick}
                    disabled={uploading}
                    className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-lg ring-2 ring-background hover:scale-105 transition disabled:opacity-60"
                    aria-label="Change profile photo"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>
                <div>
                  <p className="font-semibold text-secondary">{fullName || "Unnamed"}</p>
                  <p className="text-sm text-muted-foreground">{email}</p>
                  <button onClick={handleAvatarClick} className="text-xs text-primary hover:underline mt-1">
                    Upload new photo
                  </button>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} disabled />
                  <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div>
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="address">Mailing Address</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main St, City, State ZIP"
                  />
                </div>
              </div>

              <Button onClick={updateProfile} disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Security
              </CardTitle>
              <CardDescription>Manage your security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">Password</h4>
                  <p className="text-sm text-muted-foreground">Change your password to keep your account secure</p>
                </div>
                <Button variant="secondary" onClick={() => setPwdOpen(true)}>Change Password</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Shield className={`h-5 w-5 mt-1 ${twoFactorEnabled ? "text-success" : "text-muted-foreground"}`} />
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      Two-Factor Authentication
                      {twoFactorEnabled && (
                        <span className="inline-flex items-center gap-1 text-xs text-success">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      )}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {twoFactorEnabled
                        ? `Codes sent via ${twoFactorMethod === "sms" ? "SMS" : "Email"} at login (skippable).`
                        : "Add an extra verification step at login."}
                    </p>
                  </div>
                </div>
                <Button variant={twoFactorEnabled ? "destructive" : "default"} onClick={openTwoFA}>
                  {twoFactorEnabled ? "Disable" : "Enable 2FA"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>Choose what you want to hear about</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Transaction Alerts</p>
                  <p className="text-sm text-muted-foreground">Push/email alerts for all transactions</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={txAlerts}
                    onCheckedChange={(v) => {
                      setTxAlerts(v);
                      persistPrefs({ txAlerts: v });
                      toast({ title: v ? "Transaction alerts on" : "Transaction alerts off" });
                    }}
                  />
                  <Button variant="outline" size="sm" onClick={() => setNotifOpen("tx")}>Configure</Button>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Bill Payment Reminders</p>
                  <p className="text-sm text-muted-foreground">Get reminded about upcoming bills</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={billReminders}
                    onCheckedChange={(v) => {
                      setBillReminders(v);
                      persistPrefs({ billReminders: v });
                      toast({ title: v ? "Bill reminders on" : "Bill reminders off" });
                    }}
                  />
                  <Button variant="outline" size="sm" onClick={() => setNotifOpen("bill")}>Configure</Button>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Login Alerts</p>
                  <p className="text-sm text-muted-foreground">Notify me when there's a login from a new device</p>
                </div>
                <Switch
                  checked={loginAlerts}
                  onCheckedChange={(v) => {
                    setLoginAlerts(v);
                    persistPrefs({ loginAlerts: v });
                  }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Marketing & Offers</p>
                  <p className="text-sm text-muted-foreground">Occasional product news</p>
                </div>
                <Switch
                  checked={marketing}
                  onCheckedChange={(v) => {
                    setMarketing(v);
                    persistPrefs({ marketing: v });
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Account management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Account Management
              </CardTitle>
              <CardDescription>Manage your banking accounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">Statements & Documents</h4>
                  <p className="text-sm text-muted-foreground">Download your account statements</p>
                </div>
                <Button variant="secondary" onClick={viewStatements}>View Statements</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">Close Account</h4>
                  <p className="text-sm text-muted-foreground">Submit a closure request to support</p>
                </div>
                <Button variant="destructive" onClick={closeAccount}>Close Account</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 2FA Setup Dialog */}
      <Dialog open={twoFAOpen} onOpenChange={setTwoFAOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set up Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              {twoFAStep === "setup"
                ? "Choose how you'd like to receive verification codes."
                : "Enter the 6-digit code we sent you."}
            </DialogDescription>
          </DialogHeader>

          {twoFAStep === "setup" ? (
            <div className="space-y-4">
              <div>
                <Label>Delivery Method</Label>
                <Select value={twoFactorMethod} onValueChange={setTwoFactorMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms">SMS to phone {phone ? `(${phone})` : "(no phone on file)"}</SelectItem>
                    <SelectItem value="email">Email to {email}</SelectItem>
                  </SelectContent>
                </Select>
                {twoFactorMethod === "sms" && !phone && (
                  <p className="text-xs text-destructive mt-1">Add a phone number in Profile Information first.</p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTwoFAOpen(false)}>Cancel</Button>
                <Button onClick={sendTwoFACode}>Send Code</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="tfa-code">Verification Code</Label>
                <Input
                  id="tfa-code"
                  value={twoFAInput}
                  onChange={(e) => setTwoFAInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  inputMode="numeric"
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTwoFAStep("setup")}>Back</Button>
                <Button onClick={verifyTwoFA}>Verify & Enable</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Change Password */}
      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Choose a new password with at least 6 characters.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-pwd">New Password</Label>
              <Input id="new-pwd" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="cnf-pwd">Confirm Password</Label>
              <Input id="cnf-pwd" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdOpen(false)}>Cancel</Button>
            <Button onClick={changePassword}>Update Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notification config */}
      <Dialog open={notifOpen !== null} onOpenChange={(v) => !v && setNotifOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {notifOpen === "tx" ? "Transaction Alerts" : "Bill Payment Reminders"}
            </DialogTitle>
            <DialogDescription>
              {notifOpen === "tx"
                ? "Alerts will be sent to your email and, if enabled, to your phone."
                : "Reminders will be sent 3 days before each scheduled bill."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>📧 Email: <span className="text-secondary font-medium">{email}</span></p>
            <p>📱 Phone: <span className="text-secondary font-medium">{phone || "Not set"}</span></p>
          </div>
          <DialogFooter>
            <Button onClick={() => { setNotifOpen(null); toast({ title: "Preferences saved" }); }}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthLayout>
  );
};

export default Settings;
