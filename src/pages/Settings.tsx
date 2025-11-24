import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/AuthLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, Bell, CreditCard } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const Settings = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (data) {
      setFullName(data.full_name || "");
      setEmail(data.email || user.email || "");
      setPhone(data.phone || "");
    }
  };

  const updateProfile = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("profiles").update({
      full_name: fullName,
      phone: phone,
    }).eq("id", user.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully",
      });
    }
    setLoading(false);
  };

  return (
    <AuthLayout currentPage="settings">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div>
          <h2 className="text-3xl font-bold text-secondary mb-2">Settings</h2>
          <p className="text-muted-foreground">Manage your account settings and preferences</p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
            </div>
            <Button onClick={updateProfile} disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>Manage your security settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Password</h4>
              <p className="text-sm text-muted-foreground mb-4">Change your password to keep your account secure</p>
              <Button variant="secondary">Change Password</Button>
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold mb-2">Two-Factor Authentication</h4>
              <p className="text-sm text-muted-foreground mb-4">Add an extra layer of security to your account</p>
              <Button variant="secondary">Enable 2FA</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>Manage your notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Transaction Alerts</p>
                <p className="text-sm text-muted-foreground">Receive alerts for all transactions</p>
              </div>
              <Button variant="outline">Configure</Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Bill Payment Reminders</p>
                <p className="text-sm text-muted-foreground">Get reminded about upcoming bills</p>
              </div>
              <Button variant="outline">Configure</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Account Management
            </CardTitle>
            <CardDescription>Manage your banking accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Statements & Documents</h4>
              <p className="text-sm text-muted-foreground mb-4">Access your account statements and tax documents</p>
              <Button variant="secondary">View Statements</Button>
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold mb-2">Close Account</h4>
              <p className="text-sm text-muted-foreground mb-4">Permanently close your banking account</p>
              <Button variant="destructive">Close Account</Button>
            </div>
          </CardContent>
          </Card>
        </div>
      </div>
    </AuthLayout>
  );
};

export default Settings;