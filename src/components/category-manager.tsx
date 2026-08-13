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
};

export function useCategories() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,color,sort_order")
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

  const renameCat = useMutation({
    mutationFn: async ({
      id,
      oldName,
      name,
      color,
    }: {
      id: string;
      oldName: string;
      name: string;
      color: string;
    }) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Name required");
      const { error } = await supabase
        .from("categories")
        .update({ name: trimmed, color })
        .eq("id", id);
      if (error) throw error;
      if (trimmed !== oldName) {
        const { error: e2 } = await supabase
          .from("subscriptions")
          .update({ category: trimmed })
          .eq("category", oldName);
        if (e2) throw e2;
      }
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
      // Reassign subscriptions in this category to "Other" so nothing is orphaned.
      const { error: e1 } = await supabase
        .from("subscriptions")
        .update({ category: "Other" })
        .eq("category", name);
      if (e1) throw e1;
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Category deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorder = useMutation({
    mutationFn: async ({ index, dir }: { index: number; dir: -1 | 1 }) => {
      const other = index + dir;
      if (other < 0 || other >= categories.length) return;
      const a = categories[index];
      const b = categories[other];
      const { error: e1 } = await supabase
        .from("categories")
        .update({ sort_order: b.sort_order })
        .eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("categories")
        .update({ sort_order: a.sort_order })
        .eq("id", b.id);
      if (e2) throw e2;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (c: Category) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditColor(c.color);
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
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1"
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      renameCat.mutate({
                        id: c.id,
                        oldName: c.name,
                        name: editName,
                        color: editColor,
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
                  <span className="flex-1 truncate">{c.name}</span>
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
