import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatApiError } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AdminBreaking() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-breaking"],
    queryFn: async () => (await api.get("/breaking", { params: { all_items: true } })).data,
  });
  const items = data?.items || [];

  const [creating, setCreating] = useState({ text_en: "", text_bn: "", link: "", active: true });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-breaking"] });
    qc.invalidateQueries({ queryKey: ["breaking-active"] });
    qc.invalidateQueries({ queryKey: ["breaking-fallback"] });
  };

  const create = useMutation({
    mutationFn: async (payload) => (await api.post("/breaking", payload)).data,
    onSuccess: () => {
      invalidate();
      setCreating({ text_en: "", text_bn: "", link: "", active: true });
      toast.success("Breaking added.");
    },
    onError: (e) => toast.error(formatApiError(e.response?.data?.detail)),
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }) => (await api.put(`/breaking/${id}`, payload)).data,
    onSuccess: () => { invalidate(); setEditingId(null); toast.success("Updated."); },
    onError: (e) => toast.error(formatApiError(e.response?.data?.detail)),
  });

  const del = useMutation({
    mutationFn: async (id) => (await api.delete(`/breaking/${id}`)).data,
    onSuccess: () => { invalidate(); toast.success("Deleted."); },
    onError: (e) => toast.error(formatApiError(e.response?.data?.detail)),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6" data-testid="admin-breaking">
      <button
        onClick={() => nav("/admin")}
        className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-rahi-red"
      >
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </button>
      <div className="mb-8 border-b border-border pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rahi-red">Admin</p>
        <h1 className="masthead-serif text-5xl">Breaking News</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          These headlines scroll across the top ticker. Toggle the switch to activate/pause an item.
        </p>
      </div>

      <div className="mb-8 border border-border p-5">
        <p className="mb-4 text-xs uppercase tracking-[0.24em] text-muted-foreground">Add breaking headline</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Text (EN) *</Label>
            <Input
              className="rounded-sm"
              value={creating.text_en}
              onChange={(e) => setCreating({ ...creating, text_en: e.target.value })}
              data-testid="new-breaking-en"
            />
          </div>
          <div>
            <Label>Text (BN)</Label>
            <Input
              className="rounded-sm"
              value={creating.text_bn}
              onChange={(e) => setCreating({ ...creating, text_bn: e.target.value })}
              data-testid="new-breaking-bn"
            />
          </div>
          <div className="md:col-span-2">
            <Label>Link (optional)</Label>
            <Input
              className="rounded-sm"
              placeholder="/article/some-slug or https://…"
              value={creating.link}
              onChange={(e) => setCreating({ ...creating, link: e.target.value })}
              data-testid="new-breaking-link"
            />
          </div>
          <div className="flex items-center justify-between md:col-span-2">
            <div className="flex items-center gap-3">
              <Label>Active</Label>
              <Switch
                checked={creating.active}
                onCheckedChange={(v) => setCreating({ ...creating, active: v })}
                data-testid="new-breaking-active"
              />
            </div>
            <Button
              onClick={() => create.mutate({ ...creating, order: items.length })}
              disabled={!creating.text_en || create.isPending}
              className="rounded-sm bg-rahi-red text-white hover:bg-rahi-ink"
              data-testid="new-breaking-save"
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
              <TableHead>Text (EN)</TableHead>
              <TableHead>Text (BN)</TableHead>
              <TableHead>Link</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="py-8 text-center">Loading…</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-8 text-center">No breaking items yet</TableCell></TableRow>
            ) : (
              items.map((it) => (
                <TableRow key={it.id} data-testid={`breaking-row-${it.id}`}>
                  {["text_en", "text_bn", "link"].map((k) => (
                    <TableCell key={k}>
                      {editingId === it.id ? (
                        <Input
                          value={editForm[k] ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, [k]: e.target.value })}
                          className="rounded-sm"
                          data-testid={`edit-breaking-${k}-${it.id}`}
                        />
                      ) : (
                        <span className={k === "link" ? "font-mono text-xs" : ""}>{it[k]}</span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell>
                    {editingId === it.id ? (
                      <Input
                        type="number"
                        className="w-20 rounded-sm"
                        value={editForm.order ?? 0}
                        onChange={(e) => setEditForm({ ...editForm, order: Number(e.target.value) })}
                      />
                    ) : it.order}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={it.active}
                      onCheckedChange={(v) => update.mutate({ id: it.id, payload: { active: v } })}
                      data-testid={`toggle-breaking-${it.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {editingId === it.id ? (
                        <>
                          <Button
                            size="icon" variant="ghost"
                            onClick={() => update.mutate({ id: it.id, payload: editForm })}
                            data-testid={`save-breaking-${it.id}`}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="icon" variant="ghost"
                            onClick={() => { setEditingId(it.id); setEditForm({ text_en: it.text_en, text_bn: it.text_bn, link: it.link, order: it.order }); }}
                            data-testid={`edit-breaking-${it.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" data-testid={`del-breaking-${it.id}`}>
                                <Trash2 className="h-4 w-4 text-rahi-red" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete breaking item?</AlertDialogTitle>
                                <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-rahi-red text-white hover:bg-rahi-ink"
                                  onClick={() => del.mutate(it.id)}
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
