import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (result.error) { toast.error(result.error.message); setLoading(false); return; }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  };

  const handleEmail = async (e: React.FormEvent<HTMLFormElement>, mode: "in" | "up") => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));
    setLoading(true);
    const { error } = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/dashboard" } });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (mode === "up") toast.success("Check your email to confirm — or sign in if already confirmed.");
    else navigate({ to: "/dashboard" });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground"><Wallet className="h-4 w-4" /></div>
          <span className="font-display text-3xl">Subtracker</span>
        </Link>
        <Card className="shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Welcome</CardTitle>
            <CardDescription>Sign in or create an account to track your subscriptions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleGoogle} disabled={loading} variant="outline" className="w-full">
              <GoogleIcon /> Continue with Google
            </Button>
            <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
            </div>
            <Tabs defaultValue="in">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="in">Sign in</TabsTrigger>
                <TabsTrigger value="up">Create account</TabsTrigger>
              </TabsList>
              {(["in","up"] as const).map((mode) => (
                <TabsContent key={mode} value={mode}>
                  <form onSubmit={(e) => handleEmail(e, mode)} className="space-y-3">
                    <div className="space-y-1"><Label>Email</Label><Input name="email" type="email" required /></div>
                    <div className="space-y-1"><Label>Password</Label><Input name="password" type="password" minLength={6} required /></div>
                    <Button type="submit" disabled={loading} className="w-full">{mode === "in" ? "Sign in" : "Create account"}</Button>
                  </form>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.56-2.77c-.99.66-2.25 1.05-3.72 1.05-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.07H2.18a11 11 0 0 0 0 9.87l3.66-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.96 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/></svg>
  );
}
