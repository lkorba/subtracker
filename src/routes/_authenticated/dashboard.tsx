import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Plus, Trash2, Wallet, LogOut, ExternalLink, Pencil, Tags } from "lucide-react";
import { toast } from "sonner";
import {
  CATEGORY_COLORS as DEFAULT_CATEGORY_COLORS,
  PRESETS,
  CURRENCIES,
  CURRENCY_SYMBOLS,
  monthlyAmountInUsd,
  monthlyAmount,
  formatMoney,
  type Preset,
  type PlanOption,
} from "@/lib/subscription-presets";
import { CategoryManager, useCategories } from "@/components/category-manager";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

type Sub = {
  id: string;
  name: string;
  category: string;
  cost: number;
  currency: string;
  billing_cycle: string;
  next_billing_date: string | null;
  color: string | null;
  notes: string | null;
  url: string | null;
  plan: string | null;
};

function faviconFor(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?sz=64&domain=${u.hostname}`;
  } catch {
    return null;
  }
}

function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { categories, colorMap } = useCategories();
  const CATEGORY_COLORS: Record<string, string> = { ...DEFAULT_CATEGORY_COLORS, ...colorMap };
  const [open, setOpen] = useState(false);
  const [catManagerOpen, setCatManagerOpen] = useState(false);
  const [preset, setPreset] = useState<Preset | null>(null);
  const [editing, setEditing] = useState<Sub | null>(null);
  const [selectedPlanIdx, setSelectedPlanIdx] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [urlValue, setUrlValue] = useState("");

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subscriptions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Sub[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (input: Omit<Sub, "id"> & { user_id: string }) => {
      const { error } = await supabase.from("subscriptions").insert(input);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subscriptions"] }); setOpen(false); setPreset(null); toast.success("Subscription added"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Sub> }) => {
      const { error } = await supabase.from("subscriptions").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subscriptions"] }); setOpen(false); setEditing(null); toast.success("Subscription updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subscriptions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subscriptions"] }); toast.success("Removed"); },
  });

  const totals = useMemo(() => {
    const monthly = subs.reduce((s, x) => s + monthlyAmountInUsd(Number(x.cost), x.billing_cycle, x.currency), 0);
    const byCat: Record<string, number> = {};
    subs.forEach((x) => {
      const m = monthlyAmountInUsd(Number(x.cost), x.billing_cycle, x.currency);
      byCat[x.category] = (byCat[x.category] || 0) + m;
    });
    const chartData = Object.entries(byCat).map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));
    return { monthly, annual: monthly * 12, chartData };
  }, [subs]);

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const openWithPreset = (p: Preset) => {
    setEditing(null);
    setPreset(p);
    setSelectedPlanIdx(0);
    setCurrency("USD");
    setBillingCycle(p.plans[0]?.billing_cycle ?? "monthly");
    setUrlValue(p.url ?? "");
    setOpen(true);
  };
  const openBlank = () => {
    setEditing(null);
    setPreset(null);
    setSelectedPlanIdx(0);
    setCurrency("USD");
    setBillingCycle("monthly");
    setUrlValue("");
    setOpen(true);
  };
  const openEdit = (s: Sub) => {
    setPreset(null);
    setEditing(s);
    setCurrency(s.currency);
    setBillingCycle(s.billing_cycle);
    setUrlValue(s.url ?? "");
    const p = PRESETS.find((pp) => pp.name.toLowerCase() === s.name.toLowerCase());
    const idx = p ? Math.max(0, p.plans.findIndex((pl) => pl.name === s.plan)) : 0;
    setSelectedPlanIdx(idx);
    setOpen(true);
  };

  const currentPlan: PlanOption | null = preset?.plans[selectedPlanIdx] ?? null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const category = String(fd.get("category"));
    const base = {
      name: String(fd.get("name")),
      category,
      cost: Number(fd.get("cost")),
      currency: String(fd.get("currency")),
      billing_cycle: String(fd.get("billing_cycle")),
      next_billing_date: (fd.get("next_billing_date") as string) || null,
      notes: (fd.get("notes") as string) || null,
      url: (fd.get("url") as string) || preset?.url || null,
      plan: (fd.get("plan") as string) || null,
    };

    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        patch: { ...base, color: editing.color || CATEGORY_COLORS[category] || null },
      });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    addMutation.mutate({
      ...base,
      user_id: userData.user.id,
      color: preset?.color || CATEGORY_COLORS[category] || null,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground"><Wallet className="h-4 w-4" /></div>
            <span className="font-display text-2xl">Subtracker</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCatManagerOpen(true)}><Tags className="mr-1 h-4 w-4" /> Categories</Button>
            <Button onClick={openBlank}><Plus className="mr-1 h-4 w-4" /> Add subscription</Button>
            <Button variant="ghost" onClick={handleSignOut}><LogOut className="h-4 w-4" /></Button>
          </div>

        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <section className="grid gap-4 md:grid-cols-3">
          <StatCard label="Monthly spend (USD)" value={totals.monthly} accent />
          <StatCard label="Annual spend (USD)" value={totals.annual} />
          <StatCard label="Subscriptions" value={subs.length} raw />
        </section>

        <section className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3 shadow-[var(--shadow-soft)]">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Where the money goes</CardTitle>
              <CardDescription>Monthly spend by category (USD-equivalent)</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px]">
              {totals.chartData.length === 0 ? (
                <EmptyChart onAdd={openBlank} />
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={totals.chartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={2}
                      label={({ name, value }) => `${name}: $${Number(value).toFixed(2)}`}
                      labelLine={{ stroke: "hsl(var(--muted-foreground))" }}
                    >
                      {totals.chartData.map((e) => (<Cell key={e.name} fill={CATEGORY_COLORS[e.name] || "#94a3b8"} />))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `$${v.toFixed(2)}/mo`} />
                    <Legend formatter={(name: string) => {
                      const item = totals.chartData.find((d) => d.name === name);
                      return item ? `${name} — $${item.value.toFixed(2)}/mo` : name;
                    }} />
                  </PieChart>

                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 shadow-[var(--shadow-soft)]">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Quick add</CardTitle>
              <CardDescription>Popular services</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid max-h-[260px] grid-cols-2 gap-2 overflow-y-auto pr-1">
                {PRESETS.slice(0, 18).map((p) => {
                  const fav = faviconFor(p.url);
                  return (
                    <button key={p.name} onClick={() => openWithPreset(p)} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-left text-sm transition hover:bg-muted">
                      {fav ? (
                        <img src={fav} alt="" className="h-4 w-4 rounded-sm" loading="lazy" />
                      ) : (
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                      )}
                      <span className="truncate">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="font-display mb-4 text-3xl">Your subscriptions</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : subs.length === 0 ? (
            <Card className="p-10 text-center"><p className="text-muted-foreground">Nothing yet. Add your first subscription above.</p></Card>
          ) : (
            <div className="grid gap-3">
              {subs.map((s) => {
                const mo = monthlyAmount(Number(s.cost), s.billing_cycle);
                const fav = faviconFor(s.url);
                return (
                  <div key={s.id} className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)]">
                    <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg text-sm font-semibold text-white" style={{ background: s.color || CATEGORY_COLORS[s.category] }}>
                      {fav ? (
                        <img
                          src={fav}
                          alt=""
                          className="h-7 w-7 rounded"
                          loading="lazy"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        s.name.slice(0, 1)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{s.name}</span>
                        {s.plan && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{s.plan}</span>}
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{s.category}</span>
                        {s.url && (
                          <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            <ExternalLink className="h-3 w-3" /> visit
                          </a>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatMoney(Number(s.cost), s.currency)} {s.currency} / {s.billing_cycle}
                        {s.next_billing_date && ` · next ${s.next_billing_date}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-xl">{formatMoney(mo, s.currency)}</div>
                      <div className="text-xs text-muted-foreground">per month</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => delMutation.mutate(s.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setPreset(null); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {editing ? `Edit ${editing.name}` : preset ? `Add ${preset.name}` : "Add subscription"}
            </DialogTitle>
            <DialogDescription>
              {editing ? "Update this subscription." : "Track a new recurring charge."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3" key={editing?.id ?? preset?.name ?? "blank"}>
            <div className="space-y-1"><Label>Name</Label><Input name="name" defaultValue={editing?.name ?? preset?.name} required /></div>

            {(() => {
              const activePreset = preset ?? (editing ? PRESETS.find((p) => p.name.toLowerCase() === editing.name.toLowerCase()) ?? null : null);
              if (activePreset && activePreset.plans.length > 1) {
                return (
                  <div className="space-y-1">
                    <Label>Plan tier</Label>
                    <Select
                      value={String(selectedPlanIdx)}
                      onValueChange={(v) => {
                        const idx = Number(v);
                        setSelectedPlanIdx(idx);
                        const p = activePreset.plans[idx];
                        if (p?.billing_cycle) setBillingCycle(p.billing_cycle);
                        const costInput = document.querySelector<HTMLInputElement>('input[name="cost"]');
                        if (costInput && p) costInput.value = String(p.cost);
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Choose a tier" /></SelectTrigger>
                      <SelectContent>
                        {activePreset.plans.map((p, i) => (
                          <SelectItem key={p.name} value={String(i)}>
                            {p.name} — ${p.cost}/{p.billing_cycle ?? "monthly"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input type="hidden" name="plan" value={activePreset.plans[selectedPlanIdx]?.name ?? editing?.plan ?? ""} />
                  </div>
                );
              }
              return (
                <div className="space-y-1"><Label>Plan (optional)</Label><Input name="plan" placeholder="e.g. Family, Pro, Student" defaultValue={editing?.plan ?? ""} /></div>
              );
            })()}

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 col-span-1">
                <Label>Cost</Label>
                <Input
                  key={editing?.id ?? `${preset?.name}-${selectedPlanIdx}`}
                  name="cost"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={editing?.cost ?? currentPlan?.cost}
                  required
                />
              </div>
              <div className="space-y-1 col-span-1">
                <Label>Currency</Label>
                <Select name="currency" value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{c} {CURRENCY_SYMBOLS[c] ? `(${CURRENCY_SYMBOLS[c]})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-1">
                <Label>Billing</Label>
                <Select name="billing_cycle" value={billingCycle} onValueChange={setBillingCycle}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label>Category</Label>
                  <button type="button" onClick={() => setCatManagerOpen(true)} className="text-xs text-primary hover:underline">Manage</button>
                </div>
                <Select name="category" defaultValue={editing?.category ?? preset?.category ?? categories[0]?.name ?? "Other"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (<SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Next billing</Label><Input name="next_billing_date" type="date" defaultValue={editing?.next_billing_date ?? ""} /></div>
            </div>


            <div className="space-y-1">
              <Label>Website URL</Label>
              <div className="flex items-center gap-2">
                {faviconFor(urlValue) && (
                  <img src={faviconFor(urlValue)!} alt="" className="h-5 w-5 rounded-sm" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
                )}
                <Input name="url" type="url" placeholder="https://…" value={urlValue} onChange={(e) => setUrlValue(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1"><Label>Notes</Label><Textarea name="notes" rows={2} defaultValue={editing?.notes ?? ""} /></div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => { setOpen(false); setEditing(null); setPreset(null); }}>Cancel</Button>
              <Button type="submit" disabled={addMutation.isPending || updateMutation.isPending}>
                {editing ? "Save" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CategoryManager open={catManagerOpen} onOpenChange={setCatManagerOpen} />
    </div>
  );
}

function StatCard({ label, value, accent, raw }: { label: string; value: number; accent?: boolean; raw?: boolean }) {
  return (
    <Card className={`shadow-[var(--shadow-soft)] ${accent ? "bg-primary text-primary-foreground" : ""}`}>
      <CardContent className="p-6">
        <div className={`text-sm ${accent ? "opacity-80" : "text-muted-foreground"}`}>{label}</div>
        <div className="font-display mt-1 text-5xl">
          {raw ? value : `$${value.toFixed(2)}`}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="grid h-full place-items-center text-center">
      <div>
        <p className="text-sm text-muted-foreground">Add a subscription to see your breakdown.</p>
        <Button className="mt-3" onClick={onAdd}><Plus className="mr-1 h-4 w-4" /> Add one</Button>
      </div>
    </div>
  );
}
