import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatApiError } from "@/contexts/AuthContext";
import { useCategories, catLabel } from "@/contexts/CategoriesContext";
import { useLang, pick } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, RotateCcw, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import GridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { articleImage } from "@/components/ArticleCard";

/**
 * Layouts supported (all use articles from a query):
 *   home:latest          — latest 12 articles
 *   home:section:<slug>  — up to 4 in a category
 *   category:<slug>      — up to 24 in a category page
 */
function optionsForKey({ cats }) {
  const opts = [
    { key: "home:latest", label: "Home — Latest section" },
  ];
  cats.forEach((c) => {
    opts.push({ key: `home:section:${c.slug}`, label: `Home — ${c.name_en} section` });
    opts.push({ key: `category:${c.slug}`, label: `Category page — ${c.name_en}` });
  });
  return opts;
}

async function fetchArticlesFor(key) {
  if (key === "home:latest") {
    const r = await api.get("/articles", { params: { limit: 40 } });
    return r.data.items.slice(0, 12);
  }
  if (key.startsWith("home:section:")) {
    const slug = key.split(":")[2];
    const r = await api.get("/articles", { params: { category: slug, limit: 4 } });
    return r.data.items;
  }
  if (key.startsWith("category:")) {
    const slug = key.split(":")[1];
    const r = await api.get("/articles", { params: { category: slug, limit: 24 } });
    return r.data.items;
  }
  return [];
}

const COLS = 12;

export default function AdminLayout() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { items: cats } = useCategories();
  const { lang } = useLang();
  const opts = useMemo(() => optionsForKey({ cats }), [cats]);
  const [layoutKey, setLayoutKey] = useState("home:latest");

  const { data: articles = [] } = useQuery({
    queryKey: ["layout-articles", layoutKey],
    queryFn: () => fetchArticlesFor(layoutKey),
  });

  const { data: layoutData, refetch } = useQuery({
    queryKey: ["layout", layoutKey],
    queryFn: async () => (await api.get(`/layouts/${encodeURIComponent(layoutKey)}`)).data,
  });

  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    if (layoutData) {
      setBlocks(layoutData.blocks || []);
    }
  }, [layoutData]);

  const save = useMutation({
    mutationFn: async () =>
      (await api.put(`/layouts/${encodeURIComponent(layoutKey)}`, {
        key: layoutKey,
        blocks,
      })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["layout", layoutKey] });
      toast.success("Layout saved.");
    },
    onError: (e) => toast.error(formatApiError(e.response?.data?.detail) || "Save failed"),
  });

  const reset = useMutation({
    mutationFn: async () => (await api.delete(`/layouts/${encodeURIComponent(layoutKey)}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["layout", layoutKey] });
      setBlocks([]);
      toast.success("Layout reset to default.");
      refetch();
    },
    onError: () => toast.error("Reset failed"),
  });

  const autoGenerate = () => {
    // Build a sensible default from the articles list
    if (!articles.length) return;
    const gen = [];
    let y = 0;
    // First article as 8x3 hero, next as 4x3
    if (articles.length >= 1) gen.push({ i: `b-${articles[0].id}`, articleId: articles[0].id, x: 0, y, w: 8, h: 3 });
    if (articles.length >= 2) gen.push({ i: `b-${articles[1].id}`, articleId: articles[1].id, x: 8, y, w: 4, h: 3 });
    y += 3;
    // Remaining as 4x2 tiles, 3 per row
    for (let i = 2; i < articles.length; i++) {
      const col = (i - 2) % 3;
      if (col === 0 && i !== 2) y += 2;
      gen.push({ i: `b-${articles[i].id}`, articleId: articles[i].id, x: col * 4, y, w: 4, h: 2 });
    }
    setBlocks(gen);
  };

  const addBlock = (articleId) => {
    if (blocks.find((b) => b.articleId === articleId)) {
      toast.error("Already in layout");
      return;
    }
    const maxY = blocks.reduce((m, b) => Math.max(m, b.y + b.h), 0);
    setBlocks([...blocks, { i: `b-${articleId}`, articleId, x: 0, y: maxY, w: 4, h: 2 }]);
  };

  const removeBlock = (i) => {
    setBlocks(blocks.filter((b) => b.i !== i));
  };

  const onLayoutChange = (newLayout) => {
    setBlocks((prev) =>
      prev.map((b) => {
        const nl = newLayout.find((l) => l.i === b.i);
        return nl ? { ...b, x: nl.x, y: nl.y, w: nl.w, h: nl.h } : b;
      })
    );
  };

  const usedIds = new Set(blocks.map((b) => b.articleId).filter(Boolean));
  const unused = articles.filter((a) => !usedIds.has(a.id));

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6" data-testid="admin-layout">
      <button
        onClick={() => nav("/admin")}
        className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-rahi-red"
      >
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </button>
      <div className="mb-6 border-b border-border pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rahi-red">Admin</p>
        <h1 className="masthead-serif text-5xl">Customize Layout</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Drag to reorder. Drag the bottom-right corner of any card to resize. Choose a section, arrange it, and hit Save.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="min-w-[260px]">
          <Label>Section</Label>
          <Select value={layoutKey} onValueChange={setLayoutKey}>
            <SelectTrigger className="mt-1 rounded-sm" data-testid="layout-section-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opts.map((o) => (
                <SelectItem key={o.key} value={o.key} data-testid={`layout-opt-${o.key}`}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline" className="rounded-sm"
          onClick={autoGenerate}
          data-testid="layout-auto-generate-btn"
        >
          Auto-arrange
        </Button>
        <Button
          variant="outline" className="rounded-sm"
          onClick={() => reset.mutate()}
          data-testid="layout-reset-btn"
        >
          <RotateCcw className="mr-1 h-4 w-4" /> Reset default
        </Button>
        <Button
          className="ml-auto rounded-sm bg-rahi-red text-white hover:bg-rahi-ink"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          data-testid="layout-save-btn"
        >
          <Save className="mr-1 h-4 w-4" /> Save layout
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        {/* Grid canvas */}
        <div className="border border-border bg-muted/20 p-3 min-h-[400px]" data-testid="layout-canvas">
          {blocks.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
              No blocks yet. Click Auto-arrange or add articles from the palette →
            </div>
          ) : (
            <GridLayout
              className="layout"
              layout={blocks.map((b) => ({ i: b.i, x: b.x, y: b.y, w: b.w, h: b.h, minW: 2, minH: 1, maxW: COLS }))}
              cols={COLS}
              rowHeight={80}
              width={900}
              margin={[10, 10]}
              onLayoutChange={onLayoutChange}
              draggableCancel=".no-drag"
            >
              {blocks.map((b) => {
                const a = articles.find((x) => x.id === b.articleId);
                return (
                  <div
                    key={b.i}
                    className="relative overflow-hidden border-2 border-rahi-red/40 bg-background cursor-move"
                    data-testid={`grid-block-${b.i}`}
                  >
                    {a ? (
                      <div className="flex h-full flex-col">
                        <div className="relative h-1/2 min-h-[60px] overflow-hidden bg-muted">
                          <img src={articleImage(a)} alt="" className="h-full w-full object-cover" />
                        </div>
                        <div className="flex-1 p-2">
                          <p className="line-clamp-2 text-xs font-semibold leading-tight">
                            {pick(a, "title", lang)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        (missing)
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeBlock(b.i); }}
                      className="no-drag absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-rahi-red shadow hover:bg-white"
                      title="Remove from layout"
                      data-testid={`grid-remove-${b.i}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </GridLayout>
          )}
        </div>

        {/* Palette */}
        <aside className="border border-border p-3" data-testid="layout-palette">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            Article palette ({unused.length})
          </p>
          {unused.length === 0 ? (
            <p className="text-xs text-muted-foreground">All articles placed.</p>
          ) : (
            <ul className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {unused.map((a) => (
                <li key={a.id} className="border border-border p-2">
                  <p className="line-clamp-2 text-xs font-semibold leading-tight">
                    {pick(a, "title", lang)}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    <span>{a.category}</span>
                    <button
                      onClick={() => addBlock(a.id)}
                      className="flex items-center gap-1 text-rahi-red hover:underline"
                      data-testid={`palette-add-${a.id}`}
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
