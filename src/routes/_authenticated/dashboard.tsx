import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Plus,
  Trash2,
  Wallet,
  LogOut,
  ExternalLink,
  Pencil,
  Tags,
  Settings,
  Search,
  Sun,
  Moon,
  Download,
  X,
  KeyRound,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  format,
  isBefore,
  parseISO,
  startOfDay,
  startOfMonth,
} from "date-fns";
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
import { AccountSettings } from "@/components/account-settings";
import { ApiAccess } from "@/components/api-access";

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
  status: string;
  trial_ends: string | null;
  created_at: string;
};

type PriceEntry = {
  id: string;
  cost: number;
  currency: string;
  changed_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  paused: "Paused",
  cancelled: "Cancelled",
};

function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function faviconFor(url: string | null | undefined): string | null {
  const u = safeUrl(url);
  if (!u) return null;
  try {
    return `https://www.google.com/s2/favicons?sz=64&domain=${new URL(u).hostname}`;
  } catch {
    return null;
  }
}

// Display-only roll-forward: if the stored next billing date is in the past,
// project it forward by the billing cycle instead of showing a stale date.
// Nothing is persisted until the user edits the row.
function effectiveNextDate(s: Sub): { label: string; overdue: boolean; date: Date } | null {
  if (!s.next_billing_date) return null;
  let d = startOfDay(parseISO(s.next_billing_date));
  if (isNaN(d.getTime())) return null;
  const today = startOfDay(new Date());
  if (!isBefore(d, today)) return { label: format(d, "yyyy-MM-dd"), overdue: false, date: d };
  let guard = 0;
  while (isBefore(d, today) && guard < 100) {
    switch (s.billing_cycle) {
      case "weekly":
        d = addDays(d, 7);
        break;
      case "quarterly":
        d = addMonths(d, 3);
        break;
      case "yearly":
        d = addMonths(d, 12);
        break;
      default:
        d = addMonths(d, 1);
    }
    guard++;
  }
  return { label: `${format(d, "yyyy-MM-dd")} (est.)`, overdue: true, date: d };
}

type SortKey = "created" | "name" | "cost" | "next";

function downloadBlob(blob: Blob, filename: string, label: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  toast.success(`${label} downloaded`);
}

function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { categories, colorMap } = useCategories();
  const CATEGORY_COLORS: Record<string, string> = { ...DEFAULT_CATEGORY_COLORS, ...colorMap };
  const [open, setOpen] = useState(false);
  const [catManagerOpen, setCatManagerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiOpen, setApiOpen] = useState(false);
  const [preset, setPreset] = useState<Preset | null>(null);
  const [editing, setEditing] = useState<Sub | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Sub | null>(null);
  const [selectedPlanIdx, setSelectedPlanIdx] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [status, setStatus] = useState("active");
  const [trialEnds, setTrialEnds] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [costStr, setCostStr] = useState("");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("created");
  const [showTips, setShowTips] = useState(false);
  const urlFav = faviconFor(urlValue);

  useEffect(() => {
    setShowTips(!localStorage.getItem("subtracker-tips-dismissed"));
  }, []);

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Sub[];
    },
  });

  const { data: priceHistory = [] } = useQuery({
    queryKey: ["price-history", editing?.id],
    enabled: !!editing,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_history")
        .select("id,cost,currency,changed_at")
        .eq("subscription_id", editing!.id)
        .order("changed_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as PriceEntry[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (input: Omit<Sub, "id" | "created_at"> & { user_id: string }) => {
      const { error } = await supabase.from("subscriptions").insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      setOpen(false);
      setPreset(null);
      toast.success("Subscription added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      patch,
      prevCost,
    }: {
      id: string;
      patch: Partial<Sub>;
      prevCost: number;
    }) => {
      const { error } = await supabase.from("subscriptions").update(patch).eq("id", id);
      if (error) throw error;
      if (patch.cost !== undefined && Number(patch.cost) !== Number(prevCost)) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          await supabase.from("price_history").insert({
            user_id: userData.user.id,
            subscription_id: id,
            cost: Number(prevCost),
            currency: patch.currency ?? "USD",
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["price-history"] });
      setOpen(false);
      setEditing(null);
      toast.success("Subscription updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subscriptions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      setDeleteTarget(null);
      toast.success("Subscription removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeSubs = useMemo(
    () => subs.filter((s) => s.status !== "paused" && s.status !== "cancelled"),
    [subs],
  );

  const totals = useMemo(() => {
    const monthly = activeSubs.reduce(
      (s, x) => s + monthlyAmountInUsd(Number(x.cost), x.billing_cycle, x.currency),
      0,
    );
    const byCat: Record<string, number> = {};
    activeSubs.forEach((x) => {
      const m = monthlyAmountInUsd(Number(x.cost), x.billing_cycle, x.currency);
      byCat[x.category] = (byCat[x.category] || 0) + m;
    });
    const chartData = Object.entries(byCat).map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
    }));
    const overBudget = Object.entries(byCat)
      .map(([name, value]) => {
        const cat = categories.find((c) => c.name === name);
        if (!cat || cat.budget == null) return null;
        return value > Number(cat.budget) ? { name, value, budget: Number(cat.budget) } : null;
      })
      .filter((x): x is { name: string; value: number; budget: number } => x !== null);
    return { monthly, annual: monthly * 12, chartData, overBudget };
  }, [activeSubs, categories]);

  const byCurrency = useMemo(() => {
    const m: Record<string, { native: number; usd: number; count: number }> = {};
    activeSubs.forEach((x) => {
      const c = (m[x.currency] ??= { native: 0, usd: 0, count: 0 });
      c.native += monthlyAmount(Number(x.cost), x.billing_cycle);
      c.usd += monthlyAmountInUsd(Number(x.cost), x.billing_cycle, x.currency);
      c.count++;
    });
    return Object.entries(m)
      .map(([code, v]) => ({ code, ...v }))
      .sort((a, b) => b.usd - a.usd);
  }, [activeSubs]);

  const projection = useMemo(() => {
    const windowStart = startOfMonth(new Date());
    const buckets = Array.from({ length: 12 }, (_, i) => ({
      label: format(addMonths(windowStart, i), "MMM"),
      usd: 0,
    }));
    for (const s of activeSubs) {
      let d: Date | null = null;
      if (s.next_billing_date) {
        const parsed = startOfDay(parseISO(s.next_billing_date));
        if (!isNaN(parsed.getTime())) d = parsed;
      }
      if (!d) {
        // ponytail: no next_billing_date → assume the sub renews every month;
        // refine when real renewal dates get entered.
        buckets.forEach(
          (b) => (b.usd += monthlyAmountInUsd(Number(s.cost), s.billing_cycle, s.currency)),
        );
        continue;
      }
      let guard = 0;
      while (guard < 200) {
        const i = differenceInCalendarMonths(startOfMonth(d), windowStart);
        if (i >= 0 && i < 12)
          buckets[i].usd += monthlyAmountInUsd(Number(s.cost), s.billing_cycle, s.currency);
        switch (s.billing_cycle) {
          case "weekly":
            d = addDays(d, 7);
            break;
          case "quarterly":
            d = addMonths(d, 3);
            break;
          case "yearly":
            d = addMonths(d, 12);
            break;
          default:
            d = addMonths(d, 1);
        }
        guard++;
      }
    }
    return buckets.map((b) => ({ label: b.label, usd: Math.round(b.usd) }));
  }, [activeSubs]);

  const upcoming = useMemo(() => {
    const today = startOfDay(new Date());
    return subs
      .filter((s) => s.status !== "cancelled" && s.status !== "paused" && s.next_billing_date)
      .map((s) => ({ s, nd: effectiveNextDate(s) }))
      .filter((x): x is { s: Sub; nd: NonNullable<ReturnType<typeof effectiveNextDate>> } =>
        Boolean(x.nd),
      )
      .sort((a, b) => a.nd.date.getTime() - b.nd.date.getTime())
      .slice(0, 8);
  }, [subs]);

  const visibleSubs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = q
      ? subs.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.category.toLowerCase().includes(q) ||
            (s.plan ?? "").toLowerCase().includes(q),
        )
      : [...subs];
    switch (sortBy) {
      case "name":
        out.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "cost":
        out.sort(
          (a, b) =>
            monthlyAmountInUsd(Number(b.cost), b.billing_cycle, b.currency) -
            monthlyAmountInUsd(Number(a.cost), a.billing_cycle, a.currency),
        );
        break;
      case "next":
        out.sort((a, b) =>
          (a.next_billing_date ?? "9999").localeCompare(b.next_billing_date ?? "9999"),
        );
        break;
      default:
        break;
    }
    return out;
  }, [subs, query, sortBy]);

  const exportCsv = () => {
    const headers = [
      "name",
      "category",
      "plan",
      "cost",
      "currency",
      "billing_cycle",
      "next_billing_date",
      "status",
      "trial_ends",
      "url",
      "notes",
    ];
    const esc = (v: string | number | null) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      headers.join(","),
      ...subs.map((s) => headers.map((h) => esc(s[h as keyof Sub])).join(",")),
    ];
    downloadBlob(
      new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }),
      `subtracker-export-${new Date().toISOString().slice(0, 10)}.csv`,
      "CSV",
    );
  };

  const exportJson = () => {
    downloadBlob(
      new Blob([JSON.stringify(subs, null, 2)], { type: "application/json" }),
      `subtracker-export-${new Date().toISOString().slice(0, 10)}.json`,
      "JSON",
    );
  };

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
    setStatus("active");
    setTrialEnds("");
    setUrlValue(p.url ?? "");
    setCostStr(p.plans[0] ? String(p.plans[0].cost) : "");
    setOpen(true);
  };
  const openBlank = () => {
    setEditing(null);
    setPreset(null);
    setSelectedPlanIdx(0);
    setCurrency("USD");
    setBillingCycle("monthly");
    setStatus("active");
    setTrialEnds("");
    setUrlValue("");
    setCostStr("");
    setOpen(true);
  };
  const openEdit = (s: Sub) => {
    setPreset(null);
    setEditing(s);
    setCurrency(s.currency);
    setBillingCycle(s.billing_cycle);
    setStatus(s.status);
    setTrialEnds(s.trial_ends ?? "");
    setUrlValue(s.url ?? "");
    setCostStr(String(s.cost));
    const p = PRESETS.find((pp) => pp.name.toLowerCase() === s.name.toLowerCase());
    const idx = p
      ? Math.max(
          0,
          p.plans.findIndex((pl) => pl.name === s.plan),
        )
      : 0;
    setSelectedPlanIdx(idx);
    setOpen(true);
  };

  const currentPlan: PlanOption | null = preset?.plans[selectedPlanIdx] ?? null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const category = String(fd.get("category"));
    const cost = Number(costStr);
    if (!Number.isFinite(cost) || cost < 0) {
      toast.error("Enter a valid cost");
      return;
    }
    const base = {
      name: String(fd.get("name")),
      category,
      cost,
      currency: String(fd.get("currency")),
      billing_cycle: String(fd.get("billing_cycle")),
      next_billing_date: (fd.get("next_billing_date") as string) || null,
      notes: (fd.get("notes") as string) || null,
      url: (fd.get("url") as string) || preset?.url || null,
      plan: (fd.get("plan") as string) || null,
      status,
      trial_ends: status === "trialing" && trialEnds ? trialEnds : null,
    };

    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        patch: { ...base, color: editing.color || CATEGORY_COLORS[category] || null },
        prevCost: editing.cost,
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
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Wallet className="h-4 w-4" />
            </div>
            <span className="font-display text-2xl">Subtracker</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCatManagerOpen(true)}>
              <Tags className="mr-1 h-4 w-4" /> Categories
            </Button>
            <Button onClick={openBlank}>
              <Plus className="mr-1 h-4 w-4" /> Add subscription
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="icon" asChild aria-label="Documentation">
              <a href="/docs" target="_blank" rel="noreferrer">
                <BookOpen className="h-4 w-4" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setApiOpen(true)}
              aria-label="API access"
            >
              <KeyRound className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        {showTips && (
          <Card className="border-primary/30 bg-primary/5 shadow-[var(--shadow-soft)]">
            <CardContent className="flex items-start gap-3 p-4">
              <div className="flex-1 space-y-1 text-sm">
                <p className="font-medium">Quick tips</p>
                <p className="text-muted-foreground">
                  Set a <b>next billing date</b> and status per subscription so upcoming payments
                  and trials show up below. Use <b>Manage categories</b> to set a monthly budget per
                  category and get over-budget alerts.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  localStorage.setItem("subtracker-tips-dismissed", "1");
                  setShowTips(false);
                }}
                aria-label="Dismiss tips"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <StatCard label="Monthly spend (USD)" value={totals.monthly} accent />
          <StatCard label="Annual spend (USD)" value={totals.annual} />
          <StatCard label="Subscriptions" value={subs.length} raw />
        </section>

        {upcoming.length > 0 && (
          <Card className="shadow-[var(--shadow-soft)]">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Upcoming payments</CardTitle>
              <CardDescription>Next billing dates, soonest first</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {upcoming.map(({ s, nd }) => {
                  const days = differenceInCalendarDays(nd.date, startOfDay(new Date()));
                  const chip = nd.overdue
                    ? { text: "overdue", cls: "bg-red-500/15 text-red-600 dark:text-red-400" }
                    : days === 0
                      ? { text: "today", cls: "bg-primary/15 text-primary" }
                      : {
                          text: `in ${days}d`,
                          cls:
                            days <= 7
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-secondary text-secondary-foreground",
                        };
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 rounded-xl border bg-card p-3"
                    >
                      <div
                        className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg text-sm font-semibold text-white"
                        style={{ background: s.color || CATEGORY_COLORS[s.category] }}
                      >
                        {s.name.slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatMoney(Number(s.cost), s.currency)} · {nd.label}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${chip.cls}`}>
                        {chip.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <section className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3 shadow-[var(--shadow-soft)]">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Where the money goes</CardTitle>
              <CardDescription>
                Monthly spend by category (USD-equivalent, active + trials)
              </CardDescription>
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
                      label={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    >
                      {totals.chartData.map((e) => (
                        <Cell key={e.name} fill={CATEGORY_COLORS[e.name] || "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `$${v.toFixed(2)}/mo`} />
                    <Legend
                      formatter={(name: string) => {
                        const item = totals.chartData.find((d) => d.name === name);
                        return item ? `${name} - $${item.value.toFixed(2)}/mo` : name;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
            {totals.overBudget.length > 0 && (
              <CardContent className="border-t pt-3">
                <p className="mb-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                  Over budget
                </p>
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {totals.overBudget.map((o) => (
                    <li key={o.name}>
                      <b>{o.name}</b>: ${o.value.toFixed(2)} of ${o.budget.toFixed(2)}/mo
                    </li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>

          <Card className="lg:col-span-2 shadow-[var(--shadow-soft)]">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Quick add</CardTitle>
              <CardDescription>Popular services</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid max-h-[260px] grid-cols-2 gap-2 overflow-y-auto pr-1">
                {PRESETS.map((p) => {
                  const fav = faviconFor(p.url);
                  return (
                    <button
                      key={p.name}
                      onClick={() => openWithPreset(p)}
                      className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-left text-sm transition hover:bg-muted"
                    >
                      {fav ? (
                        <img src={fav} alt="" className="h-4 w-4 rounded-sm" loading="lazy" />
                      ) : (
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: p.color }}
                        />
                      )}
                      <span className="truncate">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-2 shadow-[var(--shadow-soft)]">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Spend by currency</CardTitle>
              <CardDescription>Monthly equivalent, active + trials</CardDescription>
            </CardHeader>
            <CardContent>
              {byCurrency.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active subscriptions.</p>
              ) : (
                <ul className="space-y-2">
                  {byCurrency.map((c) => (
                    <li
                      key={c.code}
                      className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{c.code}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.count} sub{c.count === 1 ? "" : "s"} · {formatMoney(c.native, c.code)}/mo
                        ≈ <b className="text-foreground">${c.usd.toFixed(2)}/mo</b>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3 shadow-[var(--shadow-soft)]">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Projected spend</CardTitle>
              <CardDescription>
                Next 12 months, USD-equivalent, based on billing cycles
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projection} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    fontSize={10}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={10}
                    tickFormatter={(v: number) => `$${v}`}
                    width={52}
                  />
                  <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}/mo`, "USD"]} />
                  <Bar dataKey="usd" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="font-display mr-auto text-3xl">Your subscriptions</h2>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="mr-1 h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportJson}>
              <Download className="mr-1 h-3.5 w-3.5" /> JSON
            </Button>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, category or plan"
                className="w-64 pl-8"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created">Newest first</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
                <SelectItem value="cost">Cost, highest</SelectItem>
                <SelectItem value="next">Next billing soonest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : subs.length === 0 ? (
            <Card className="p-10 text-center">
              <p className="text-muted-foreground">
                Nothing yet. Add your first subscription above.
              </p>
            </Card>
          ) : visibleSubs.length === 0 ? (
            <Card className="p-10 text-center">
              <p className="text-muted-foreground">No subscriptions match your search.</p>
            </Card>
          ) : (
            <>
              <div className="grid gap-3">
                {visibleSubs.map((s) => {
                  const mo = monthlyAmount(Number(s.cost), s.billing_cycle);
                  const fav = faviconFor(s.url);
                  const nd = effectiveNextDate(s);
                  const link = safeUrl(s.url);
                  const dimmed = s.status === "paused" || s.status === "cancelled";
                  const trialDays =
                    s.status === "trialing" && s.trial_ends
                      ? differenceInCalendarDays(parseISO(s.trial_ends), startOfDay(new Date()))
                      : null;
                  return (
                    <div
                      key={s.id}
                      className={`flex items-center gap-4 rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)] ${
                        dimmed ? "opacity-60" : ""
                      }`}
                    >
                      <div
                        className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg text-sm font-semibold text-white"
                        style={{ background: s.color || CATEGORY_COLORS[s.category] }}
                      >
                        {fav ? (
                          <img
                            src={fav}
                            alt=""
                            className="h-7 w-7 rounded"
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          s.name.slice(0, 1)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{s.name}</span>
                          {s.plan && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                              {s.plan}
                            </span>
                          )}
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                            {s.category}
                          </span>
                          {s.status !== "active" && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${
                                s.status === "trialing"
                                  ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                                  : s.status === "paused"
                                    ? "bg-secondary text-muted-foreground"
                                    : "bg-red-500/15 text-red-600 dark:text-red-400"
                              }`}
                            >
                              {STATUS_LABELS[s.status] ?? s.status}
                            </span>
                          )}
                          {trialDays !== null && (
                            <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs text-sky-600 dark:text-sky-400">
                              {trialDays < 0 ? "trial ended" : `${trialDays}d left`}
                            </span>
                          )}
                          {nd?.overdue && s.status === "active" && (
                            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
                              past due
                            </span>
                          )}
                          {link && (
                            <a
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" /> visit
                            </a>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatMoney(Number(s.cost), s.currency)} {s.currency} / {s.billing_cycle}
                          {nd && s.status !== "cancelled" && ` · next ${nd.label}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-xl">{formatMoney(mo, s.currency)}</div>
                        <div className="text-xs text-muted-foreground">per month</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(s)}
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(s)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              {query && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Showing {visibleSubs.length} of {subs.length} subscriptions
                </p>
              )}
            </>
          )}
        </section>
      </main>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setEditing(null);
            setPreset(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {editing
                ? `Edit ${editing.name}`
                : preset
                  ? `Add ${preset.name}`
                  : "Add subscription"}
            </DialogTitle>
            <DialogDescription>
              {editing ? "Update this subscription." : "Track a new recurring charge."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSubmit}
            className="space-y-3"
            key={editing?.id ?? preset?.name ?? "blank"}
          >
            <div className="space-y-1">
              <Label>Name</Label>
              <Input name="name" defaultValue={editing?.name ?? preset?.name} required />
            </div>

            {(() => {
              const activePreset =
                preset ??
                (editing
                  ? (PRESETS.find((p) => p.name.toLowerCase() === editing.name.toLowerCase()) ??
                    null)
                  : null);
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
                        if (p) {
                          setCostStr(String(p.cost));
                          if (p.billing_cycle) setBillingCycle(p.billing_cycle);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a tier" />
                      </SelectTrigger>
                      <SelectContent>
                        {activePreset.plans.map((p, i) => (
                          <SelectItem key={p.name} value={String(i)}>
                            {p.name} - ${p.cost}/{p.billing_cycle ?? "monthly"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input
                      type="hidden"
                      name="plan"
                      value={activePreset.plans[selectedPlanIdx]?.name ?? editing?.plan ?? ""}
                    />
                  </div>
                );
              }
              return (
                <div className="space-y-1">
                  <Label>Plan (optional)</Label>
                  <Input
                    name="plan"
                    placeholder="e.g. Family, Pro, Student"
                    defaultValue={editing?.plan ?? ""}
                  />
                </div>
              );
            })()}

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 col-span-1">
                <Label>Cost</Label>
                <Input
                  name="cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={costStr}
                  onChange={(e) => setCostStr(e.target.value)}
                  placeholder="0.00"
                  required
                />
                {editing && priceHistory.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Previous:{" "}
                    {priceHistory
                      .slice(0, 3)
                      .map(
                        (h) =>
                          `${formatMoney(Number(h.cost), h.currency)} (${format(parseISO(h.changed_at), "yyyy-MM-dd")})`,
                      )
                      .join(", ")}
                  </p>
                )}
              </div>
              <div className="space-y-1 col-span-1">
                <Label>Currency</Label>
                <Select name="currency" value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c} {CURRENCY_SYMBOLS[c] ? `(${CURRENCY_SYMBOLS[c]})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-1">
                <Label>Billing</Label>
                <Select name="billing_cycle" value={billingCycle} onValueChange={setBillingCycle}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {status === "trialing" ? (
                <div className="space-y-1">
                  <Label>Trial ends</Label>
                  <Input
                    type="date"
                    value={trialEnds}
                    onChange={(e) => setTrialEnds(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label>Next billing</Label>
                  <Input
                    name="next_billing_date"
                    type="date"
                    defaultValue={editing?.next_billing_date ?? ""}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label>Category</Label>
                  <button
                    type="button"
                    onClick={() => setCatManagerOpen(true)}
                    className="text-xs text-primary hover:underline"
                  >
                    Manage
                  </button>
                </div>
                <Select
                  name="category"
                  defaultValue={
                    editing?.category ?? preset?.category ?? categories[0]?.name ?? "Other"
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Website URL</Label>
                <div className="flex items-center gap-2">
                  {urlFav && (
                    <img
                      src={urlFav}
                      alt=""
                      className="h-5 w-5 rounded-sm"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                      }}
                    />
                  )}
                  <Input
                    name="url"
                    type="url"
                    placeholder="https://…"
                    value={urlValue}
                    onChange={(e) => setUrlValue(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea name="notes" rows={2} defaultValue={editing?.notes ?? ""} />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setEditing(null);
                  setPreset(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addMutation.isPending || updateMutation.isPending}>
                {editing ? "Save" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the subscription permanently. There is no undo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) delMutation.mutate(deleteTarget.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CategoryManager open={catManagerOpen} onOpenChange={setCatManagerOpen} />
      <ApiAccess open={apiOpen} onOpenChange={setApiOpen} />
      <AccountSettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSignOut={handleSignOut}
      />
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("subtracker-theme");
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = stored ? stored === "dark" : prefers;
    setDark(initial);
    document.documentElement.classList.toggle("dark", initial);
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("subtracker-theme", next ? "dark" : "light");
  };
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function StatCard({
  label,
  value,
  accent,
  raw,
}: {
  label: string;
  value: number;
  accent?: boolean;
  raw?: boolean;
}) {
  return (
    <Card
      className={`shadow-[var(--shadow-soft)] ${accent ? "bg-primary text-primary-foreground" : ""}`}
    >
      <CardContent className="p-6">
        <div className={`text-sm ${accent ? "opacity-80" : "text-muted-foreground"}`}>{label}</div>
        <div className="font-display mt-1 text-5xl">{raw ? value : `$${value.toFixed(2)}`}</div>
      </CardContent>
    </Card>
  );
}

function EmptyChart({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="grid h-full place-items-center text-center">
      <div>
        <p className="text-sm text-muted-foreground">Add a subscription to see your breakdown.</p>
        <Button className="mt-3" onClick={onAdd}>
          <Plus className="mr-1 h-4 w-4" /> Add one
        </Button>
      </div>
    </div>
  );
}
