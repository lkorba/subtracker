import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, Plus, Trash2, Webhook } from "lucide-react";
import { toast } from "sonner";

type ApiKey = {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

type ApiWebhook = {
  id: string;
  url: string;
  active: boolean;
};

const API_BASE = "https://tuvqxwyqrgsowirmmyhp.supabase.co/functions/v1/public-api";

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `st_${b64}`;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function ApiAccess({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [whUrl, setWhUrl] = useState("");

  const { data: keys = [] } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async (): Promise<ApiKey[]> => {
      const { data, error } = await supabase
        .from("api_keys")
        .select("id,name,created_at,last_used_at,revoked_at")
        .order("created_at");
      if (error) throw error;
      return data as ApiKey[];
    },
  });

  const { data: webhook } = useQuery({
    queryKey: ["api-webhook"],
    queryFn: async (): Promise<ApiWebhook | null> => {
      const { data, error } = await supabase
        .from("api_webhooks")
        .select("id,url,active")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ApiWebhook | null;
    },
  });

  useEffect(() => {
    if (webhook?.url) setWhUrl(webhook.url);
  }, [webhook?.url]);

  const createKey = useMutation({
    mutationFn: async () => {
      const token = newToken();
      const token_hash = await sha256Hex(token);
      const { error } = await supabase
        .from("api_keys")
        .insert({ name: keyName.trim() || "Default", token_hash });
      if (error) throw error;
      return token;
    },
    onSuccess: (token) => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setNewKey(token);
      setKeyName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeKey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("api_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("Key revoked");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveWebhook = useMutation({
    mutationFn: async (url: string) => {
      if (!url.trim()) throw new Error("Webhook URL is required");
      if (webhook?.id) {
        const { error } = await supabase
          .from("api_webhooks")
          .update({ url: url.trim() })
          .eq("id", webhook.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("api_webhooks").insert({ url: url.trim() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-webhook"] });
      toast.success("Webhook saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">API access</DialogTitle>
          <DialogDescription>
            Programmatic access for Zapier, Make, scripts. Base URL:{" "}
            <code className="rounded bg-muted px-1 text-xs">{API_BASE}</code>. Full reference:{" "}
            <a href="/docs" target="_blank" rel="noreferrer" className="underline">
              docs
            </a>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>API keys</Label>
            {keys.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No keys yet. Create one to call the API.
              </p>
            )}
            <ul className="space-y-1.5">
              {keys.map((k) => (
                <li
                  key={k.id}
                  className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
                >
                  <span className="flex-1 truncate">
                    {k.name}
                    {k.revoked_at && <span className="ml-2 text-xs text-red-500">revoked</span>}
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {k.last_used_at
                      ? `used ${new Date(k.last_used_at).toLocaleDateString()}`
                      : "never used"}
                  </span>
                  {!k.revoked_at && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Revoke key"
                      onClick={() => revokeKey.mutate(k.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {newKey && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <p className="mb-1 font-medium">Copy your key now — it will not be shown again:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded bg-muted px-2 py-1 text-xs">
                    {newKey}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(newKey);
                      toast.success("Copied");
                    }}
                  >
                    <Copy className="mr-1 h-3 w-3" /> Copy
                  </Button>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Key name (optional)"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
              />
              <Button onClick={() => createKey.mutate()} disabled={createKey.isPending}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Create key
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Webhook className="h-3.5 w-3.5" /> Webhook
            </Label>
            <p className="text-xs text-muted-foreground">
              Receive subscription.created / updated / deleted events as JSON POSTs.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="https://hooks.zapier.com/…"
                value={whUrl}
                onChange={(e) => setWhUrl(e.target.value)}
              />
              <Button onClick={() => saveWebhook.mutate(whUrl)} disabled={saveWebhook.isPending}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
