import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatApiError } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AdminCategories() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => (await api.get("/categories")).data,
  });
  const items = data?.items || [];

  const [creating, setCreating] = useState({ slug: "", name_en: "", name_bn: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name_en: "", name_bn: "", order: 0 });

  const create = useMutation({
    mutationFn: async (payload) => (await api.post("/categories", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      setCreating({ slug: "", name_en: "", name_bn: "" });
      toast.success("Category created.");
    },
    onError: (e) => toast.error(formatApiError(e.response?.data?.detail) || "Create failed"),
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }) => (await api.put(`/categories/${id}`, payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      setEditingId(null);
      toast.success("Category updated.");
    },
    onError: (e) => toast.error(formatApiError(e.response?.data?.detail) || "Update failed"),
  });

  const del = useMutation({
    mutationFn: async (id) => (await api.delete(`/categories/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category deleted.");
    },
    onError: (e) => toast.error(formatApiError(e.response?.data?.detail) || "Delete failed"),
  });

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditForm({ name_en: c.name_en || "", name_bn: c.name_bn || "", order: c.order || 0 });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6" data-testid="admin-categories">
      <button
        onClick={() => nav("/admin")}
        className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-rahi-red"
      >
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </button>
      <div className="mb-8 border-b border-border pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rahi-red">Admin</p>
        <h1 className="masthead-serif text-5xl">Categories</h1>
      </div>

      {/* Create form */}
      <div className="mb-8 border border-border p-5">
        <p className="mb-4 text-xs uppercase tracking-[0.24em] text-muted-foreground">Add new category</p>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label>Slug (URL)</Label>
            <Input
              className="rounded-sm"
              value={creating.slug}
              onChange={(e) => setCreating({ ...creating, slug: e.target.value })}
              placeholder="e.g. technology"
              data-testid="new-cat-slug"
            />
          </div>
          <div>
            <Label>Name (EN)</Label>
            <Input
              className="rounded-sm"
              value={creating.name_en}
              onChange={(e) => setCreating({ ...creating, name_en: e.target.value })}
              placeholder="Technology"
              data-testid="new-cat-name-en"
            />
          </div>
          <div>
            <Label>Name (BN)</Label>
            <Input
              className="rounded-sm"
              value={creating.name_bn}
              onChange={(e) => setCreating({ ...creating, name_bn: e.target.value })}
              placeholder="প্রযুক্তি"
              data-testid="new-cat-name-bn"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => create.mutate({ ...creating, order: items.length })}
              disabled={!creating.slug || !creating.name_en || create.isPending}
              className="w-full rounded-sm bg-rahi-red text-white hover:bg-rahi-ink"
              data-testid="new-cat-save"
            >
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
        </div>
      </div>

      <div className="border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Slug</TableHead>
              <TableHead>Name (EN)</TableHead>
              <TableHead>Name (BN)</TableHead>
              <TableHead>Order</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="py-8 text-center">Loading…</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-8 text-center">No categories</TableCell></TableRow>
            ) : (
              items.map((c) => (
                <TableRow key={c.id} data-testid={`cat-row-${c.slug}`}>
                  <TableCell className="font-mono text-xs">{c.slug}</TableCell>
                  <TableCell>
                    {editingId === c.id ? (
                      <Input
                        value={editForm.name_en}
                        onChange={(e) => setEditForm({ ...editForm, name_en: e.target.value })}
                        className="rounded-sm"
                        data-testid={`edit-cat-name-en-${c.slug}`}
                      />
                    ) : c.name_en}
                  </TableCell>
                  <TableCell>
                    {editingId === c.id ? (
                      <Input
                        value={editForm.name_bn}
                        onChange={(e) => setEditForm({ ...editForm, name_bn: e.target.value })}
                        className="rounded-sm"
                        data-testid={`edit-cat-name-bn-${c.slug}`}
                      />
                    ) : c.name_bn}
                  </TableCell>
                  <TableCell>
                    {editingId === c.id ? (
                      <Input
                        type="number"
                        value={editForm.order}
                        onChange={(e) => setEditForm({ ...editForm, order: Number(e.target.value) })}
                        className="w-20 rounded-sm"
                        data-testid={`edit-cat-order-${c.slug}`}
                      />
                    ) : c.order}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {editingId === c.id ? (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => update.mutate({ id: c.id, payload: editForm })}
                            data-testid={`save-cat-${c.slug}`}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                            data-testid={`cancel-cat-${c.slug}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => startEdit(c)}
                            data-testid={`edit-cat-${c.slug}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" data-testid={`del-cat-${c.slug}`}>
                                <Trash2 className="h-4 w-4 text-rahi-red" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this category?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  You can't delete a category if articles still use it.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-rahi-red text-white hover:bg-rahi-ink"
                                  onClick={() => del.mutate(c.id)}
                                  data-testid={`confirm-del-cat-${c.slug}`}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
