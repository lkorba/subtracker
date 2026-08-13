import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  CATEGORIES as DEFAULT_CATEGORIES,
  CATEGORY_COLORS as DEFAULT_COLORS,
} from "@/lib/subscription-presets";

export type Category = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  budget: number | null;
};

export function useCategories() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,color,sort_order,budget")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Category[];
    },
  });

  // Seed defaults on first load for a new user.
  useEffect(() => {
    if (q.isLoading || q.data === undefined) return;
    if (q.data.length > 0) return;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const rows = DEFAULT_CATEGORIES.map((name, i) => ({
        user_id: userData.user.id,
        name,
        color: DEFAULT_COLORS[name] ?? "#94a3b8",
        sort_order: i,
      }));
      const { error } = await supabase.from("categories").insert(rows);
      if (!error) qc.invalidateQueries({ queryKey: ["categories"] });
    })();
  }, [q.data, q.isLoading, qc]);

  const colorMap = useMemo(() => {
    const m: Record<string, string> = {};
    (q.data ?? []).forEach((c) => {
      m[c.name] = c.color;
    });
    return m;
  }, [q.data]);

  return { categories: q.data ?? [], isLoading: q.isLoading, colorMap };
}

export function CategoryManager({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { categories } = useCategories();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#94a3b8");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#94a3b8");
  const [editBudget, setEditBudget] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["subscriptions"] });
  };

  const addCat = useMutation({
    mutationFn: async () => {
      const name = newName.trim();
      if (!name) throw new Error("Name required");
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const nextOrder = (categories[categories.length - 1]?.sort_order ?? -1) + 1;
      const { error } = await supabase.from("categories").insert({
        user_id: userData.user.id,
        name,
        color: newColor,
        sort_order: nextOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewName("");
      invalidate();
      toast.success("Category added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Rename + reassign subscriptions atomically in one SECURITY DEFINER RPC;
  // the budget is a separate single-row update.
  const renameCat = useMutation({
    mutationFn: async ({
      id,
      name,
      color,
      budget,
    }: {
      id: string;
      name: string;
      color: string;
      budget: string;
    }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Name required");
      const budgetNum = budget.trim() === "" ? null : Number(budget);
      if (budgetNum !== null && (!Number.isFinite(budgetNum) || budgetNum < 0)) {
        throw new Error("Budget must be a non-negative number");
      }
      const { error } = await supabase.rpc("rename_category", {
        p_id: id,
        p_name: trimmed,
        p_color: color,
      });
      if (error) throw error;
      const { error: bErr } = await supabase
        .from("categories")
        .update({ budget: budgetNum })
        .eq("id", id);
      if (bErr) throw bErr;
    },
    onSuccess: () => {
      setEditingId(null);
      invalidate();
      toast.success("Category updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delCat = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      if (name === "Other") throw new Error("Other is the fallback category and cannot be deleted");
      const { error } = await supabase.rpc("delete_category", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Category deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Swap two adjacent categories. The RPC rewrites every sort_order in one
  // transaction so two rows can never end up sharing a value.
  const reorder = useMutation({
    mutationFn: async ({ index, dir }: { index: number; dir: -1 | 1 }) => {
      const other = index + dir;
      if (other < 0 || other >= categories.length) return;
      const ids = categories.map((c) => c.id);
      [ids[index], ids[other]] = [ids[other], ids[index]];
      const { error } = await supabase.rpc("reorder_categories", { p_ids: ids });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (c: Category) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditColor(c.color);
    setEditBudget(c.budget != null ? String(c.budget) : "");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Manage categories</DialogTitle>
          <DialogDescription>
            Create, rename, recolor, and reorder your subscription categories.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {categories.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2 rounded-lg border bg-card px-2 py-2">
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  disabled={i === 0}
                  onClick={() => reorder.mutate({ index: i, dir: -1 })}
                  aria-label="Move up"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  disabled={i === categories.length - 1}
                  onClick={() => reorder.mutate({ index: i, dir: 1 })}
                  aria-label="Move down"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>

              {editingId === c.id ? (
                <>
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="h-8 w-8 shrink-0 cursor-pointer rounded border"
                  />
                  <div className="flex-1 space-y-1">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8"
                      autoFocus
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editBudget}
                      onChange={(e) => setEditBudget(e.target.value)}
                      placeholder="Monthly budget in USD (optional)"
                      className="h-8"
                    />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      renameCat.mutate({
                        id: c.id,
                        name: editName,
                        color: editColor,
                        budget: editBudget,
                      })
                    }
                    aria-label="Save"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                    aria-label="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border"
                    style={{ background: c.color }}
                  />
                  <span className="flex-1 truncate">
                    {c.name}
                    {c.budget != null && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ${Number(c.budget).toFixed(2)}/mo
                      </span>
                    )}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => startEdit(c)}
                    aria-label="Rename"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete "${c.name}"? Subscriptions in it will move to "Other".`))
                        delCat.mutate({ id: c.id, name: c.name });
                    }}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground">No categories yet.</p>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            addCat.mutate();
          }}
          className="mt-4 flex items-center gap-2 border-t pt-4"
        >
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="h-9 w-10 shrink-0 cursor-pointer rounded border"
          />
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category name"
            className="flex-1"
          />
          <Button type="submit" disabled={addCat.isPending}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </form>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
