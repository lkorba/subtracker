import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function AccountSettings({
  open,
  onOpenChange,
  onSignOut,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSignOut: () => void;
}) {
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? "");
    })();
  }, [open]);

  const changeEmail = async () => {
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setBusy(false);
    if (error) return toast.error(error.message);
    setEmail(newEmail);
    setNewEmail("");
    toast.success("Confirmation sent to the new address. It takes effect once confirmed.");
  };

  const changePassword = async () => {
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    setPassword("");
    toast.success("Password updated");
  };

  const deleteAccount = async () => {
    setBusy(true);
    const { error } = await supabase.functions.invoke("delete-account");
    setBusy(false);
    if (error) {
      return toast.error(
        error.context?.message ??
          "Could not delete the account. This action is performed server-side; please contact support if it persists.",
      );
    }
    toast.success("Account deleted. Goodbye!");
    await supabase.auth.signOut();
    onSignOut();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Account settings</DialogTitle>
          <DialogDescription>Manage your sign-in email, password and account.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Signed in as</Label>
            <Input value={email} disabled />
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label>Change email</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="new@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              <Button
                variant="outline"
                disabled={busy || !newEmail}
                onClick={changeEmail}
                className="shrink-0"
              >
                Update
              </Button>
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label>Change password</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="New password (min 6 characters)"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                variant="outline"
                disabled={busy || password.length < 6}
                onClick={changePassword}
                className="shrink-0"
              >
                Update
              </Button>
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label className="text-destructive">Danger zone</Label>
            <p className="text-xs text-muted-foreground">
              Deleting your account removes all subscriptions and categories permanently.
            </p>
            {confirmDelete ? (
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={deleteAccount}
                  className="flex-1"
                >
                  Yes, delete everything
                </Button>
                <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                  Keep account
                </Button>
              </div>
            ) : (
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                Delete account
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
