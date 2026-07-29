import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatApiError } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";

function useSide(side) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-sidebar", side],
    queryFn: async () => (await api.get("/admin/sidebar-news", { params: { side } })).data,
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-sidebar", side] });
    qc.invalidateQueries({ queryKey: ["sidebar", side] });
  };
  return { items: data?.items || [], isLoading, invalidate };
}

function SidePanel({ side }) {
  const { items, isLoading, invalidate } = useSide(side);
  const [creating, setCreating] = useState({ text_en: "", text_bn: "", link: "", active: true });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const create = useMutation({
    mutationFn: async () =>
      (await api.post("/sidebar-news", { ...creating, side, order: items.length })).data,
    onSuccess: () => {
      invalidate();
      setCreating({ text_en: "", text_bn: "", link: "", active: true });
      toast.success("Item added.");
    },
    onError: (e) => toast.error(formatApiError(e.response?.data?.detail)),
  });

  const update = useMutation({
    mutationFn: async ({ id, payload }) => (await api.put(`/sidebar-news/${id}`, payload)).data,
    onSuccess: () => { invalidate(); setEditingId(null); toast.success("Updated."); },
    onError: (e) => toast.error(formatApiError(e.response?.data?.detail)),
  });

  const del = useMutation({
    mutationFn: async (id) => (await api.delete(`/sidebar-news/${id}`)).data,
    onSuccess: () => { invalidate(); toast.success("Deleted."); },
    onError: (e) => toast.error(formatApiError(e.response?.data?.detail)),
  });

  return (
    <div className="space-y-6">
      <div className="border border-border p-5">
        <p className="mb-4 text-xs uppercase tracking-[0.24em] text-muted-foreground">
          Curate a headline for the {side} sidebar
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Text (EN) *</Label>
            <Input
              className="rounded-sm"
              value={creating.text_en}
              onChange={(e) => setCreating({ ...creating, text_en: e.target.value })}
              data-testid={`new-side-${side}-en`}
            />
          </div>
          <div>
            <Label>Text (BN)</Label>
            <Input
              className="rounded-sm"
              value={creating.text_bn}
              onChange={(e) => setCreating({ ...creating, text_bn: e.target.value })}
              data-testid={`new-side-${side}-bn`}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Link (optional)</Label>
            <Input
              className="rounded-sm"
              placeholder="/article/slug or https://…"
              value={creating.link}
              onChange={(e) => setCreating({ ...creating, link: e.target.value })}
              data-testid={`new-side-${side}-link`}
            />
          </div>
          <div className="flex items-center justify-between md:col-span-2">
            <div className="flex items-center gap-3">
              <Label>Active</Label>
              <Switch
                checked={creating.active}
                onCheckedChange={(v) => setCreating({ ...creating, active: v })}
              />
            </div>
            <Button
              onClick={() => create.mutate()}
              disabled={!creating.text_en || create.isPending}
              className="rounded-sm bg-rahi-red text-white hover:bg-rahi-ink"
              data-testid={`new-side-${side}-save`}
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
              <TableRow><TableCell colSpan={6} className="py-8 text-center">No curated items — the {side} sidebar will auto-fill with latest articles.</TableCell></TableRow>
            ) : (
              items.map((it) => (
                <TableRow key={it.id}>
                  {["text_en", "text_bn", "link"].map((k) => (
                    <TableCell key={k}>
                      {editingId === it.id ? (
                        <Input
                          value={editForm[k] ?? ""}
                          onChange={(e) => setEditForm({ ...editForm, [k]: e.target.value })}
                          className="rounded-sm"
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
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {editingId === it.id ? (
                        <>
                          <Button
                            size="icon" variant="ghost"
                            onClick={() => update.mutate({ id: it.id, payload: editForm })}
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
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon" variant="ghost"
                            onClick={() => { if (window.confirm("Delete this sidebar item?")) del.mutate(it.id); }}
                          >
                            <Trash2 className="h-4 w-4 text-rahi-red" />
                          </Button>
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

export default function AdminSidebar() {
  const nav = useNavigate();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6" data-testid="admin-sidebar">
      <button
        onClick={() => nav("/admin")}
        className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-rahi-red"
      >
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </button>
      <div className="mb-8 border-b border-border pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rahi-red">Admin</p>
        <h1 className="masthead-serif text-5xl">Side Panels</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Curate headlines for the left and right sidebars. Empty sides auto-fill from your latest published articles (with timestamps).
        </p>
      </div>

      <Tabs defaultValue="left">
        <TabsList data-testid="sidebar-side-tabs">
          <TabsTrigger value="left" data-testid="tab-side-left">Left sidebar</TabsTrigger>
          <TabsTrigger value="right" data-testid="tab-side-right">Right sidebar</TabsTrigger>
        </TabsList>
        <TabsContent value="left" className="pt-6">
          <SidePanel side="left" />
        </TabsContent>
        <TabsContent value="right" className="pt-6">
          <SidePanel side="right" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
