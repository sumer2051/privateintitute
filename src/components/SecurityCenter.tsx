import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, CreditCard, Bell, Fingerprint, CheckCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SecurityCenterProps {
  onNotify: (title: string, message: string, type: "success" | "warning") => void;
}

export const SecurityCenter = ({ onNotify }: SecurityCenterProps) => {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  const handleToggleTwoFactor = async () => {
    if (twoFactorEnabled) {
      if (!confirm("Are you sure you want to disable two-factor authentication?")) return;
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
    setTwoFactorEnabled(!twoFactorEnabled);
    onNotify(
      twoFactorEnabled ? "Two-Factor Disabled" : "Two-Factor Enabled",
      twoFactorEnabled ? "Your account security has been reduced" : "Your account security has been enhanced",
      twoFactorEnabled ? "warning" : "success"
    );
  };

  const handleEnableBiometric = async () => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    setBiometricEnabled(true);
    onNotify("Biometric Enabled", "Biometric authentication is now active", "success");
  };

  const securityEvents = [
    { id: 1, name: "Password Changed", description: "Your password was updated successfully", time: "Today, 11:30 AM", status: "verified" },
    { id: 2, name: "Two-Factor Authentication", description: "2FA was enabled on your account", time: "Yesterday, 03:45 PM", status: "verified" },
    { id: 3, name: "Login from New Device", description: "Chrome on Windows 11", time: "2 days ago", status: "verified" },
    { id: 4, name: "Security Alert Settings", description: "Email notifications enabled", time: "1 week ago", status: "verified" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-3xl font-bold text-secondary">Security Center</h2>
        <p className="text-muted-foreground">Manage your account security settings and monitor security events</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="transition-all hover:-translate-y-1 hover:shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${twoFactorEnabled ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-secondary">Two-Factor Authentication</h3>
                <p className="text-sm text-muted-foreground">Extra layer of security</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant={twoFactorEnabled ? "default" : "secondary"} className={twoFactorEnabled ? "bg-success" : ""}>
              {twoFactorEnabled ? "Active" : "Inactive"}
            </Badge>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => onNotify("Manage 2FA", "Managing two-factor authentication", "success")}>
                Manage
              </Button>
              <Button size="sm" onClick={handleToggleTwoFactor}>
                {twoFactorEnabled ? "Disable" : "Enable"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="transition-all hover:-translate-y-1 hover:shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-secondary">Card Controls</h3>
                <p className="text-sm text-muted-foreground">Manage your cards</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge className="bg-success">Active</Badge>
            <Button variant="secondary" size="sm" onClick={() => onNotify("Card Controls", "Opening card controls settings", "success")}>
              Manage
            </Button>
          </CardContent>
        </Card>

        <Card className="transition-all hover:-translate-y-1 hover:shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
                <Bell className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-secondary">Security Alerts</h3>
                <p className="text-sm text-muted-foreground">Real-time notifications</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge className="bg-success">Active</Badge>
            <Button variant="secondary" size="sm" onClick={() => onNotify("Security Alerts", "Managing security alert preferences", "success")}>
              Manage
            </Button>
          </CardContent>
        </Card>

        <Card className="transition-all hover:-translate-y-1 hover:shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${biometricEnabled ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                <Fingerprint className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-secondary">Biometric Login</h3>
                <p className="text-sm text-muted-foreground">Fingerprint & Face ID</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant={biometricEnabled ? "default" : "secondary"} className={biometricEnabled ? "bg-success" : ""}>
              {biometricEnabled ? "Active" : "Inactive"}
            </Badge>
            {!biometricEnabled && (
              <Button size="sm" onClick={handleEnableBiometric}>
                Enable
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="text-xl font-bold text-secondary">Recent Security Events</h3>
            <Button variant="link" className="text-primary">
              View All →
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {securityEvents.map((event) => (
              <div key={event.id} className="flex items-center justify-between rounded-lg bg-muted p-4 transition-colors hover:bg-muted/70">
                <div className="flex-1">
                  <h4 className="font-semibold text-secondary">{event.name}</h4>
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                  <p className="text-xs text-muted-foreground">{event.time}</p>
                </div>
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-semibold">Verified</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
