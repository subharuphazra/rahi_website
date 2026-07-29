import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, ArrowLeft, Loader2 } from "lucide-react";
import RichEditor from "@/components/RichEditor";
import { useCategories, catLabel } from "@/contexts/CategoriesContext";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const empty = {
  title_en: "",
  title_bn: "",
  excerpt_en: "",
  excerpt_bn: "",
  body_en: "",
  body_bn: "",
  category: "business",
  image_path: "",
  image_url: "",
  published: true,
  featured: false,
};

export default function AdminEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const { t, lang } = useLang();
  const { items: CATEGORIES } = useCategories();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const { data: existing } = useQuery({
    queryKey: ["admin-article-edit", id],
    queryFn: async () => {
      const list = (await api.get("/admin/articles")).data.items;
      return list.find((a) => a.id === id);
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        title_en: existing.title_en || "",
        title_bn: existing.title_bn || "",
        excerpt_en: existing.excerpt_en || "",
        excerpt_bn: existing.excerpt_bn || "",
        body_en: existing.body_en || "",
        body_bn: existing.body_bn || "",
        category: existing.category || "business",
        image_path: existing.image_path || "",
        image_url: existing.image_url || "",
        published: existing.published ?? true,
        featured: existing.featured ?? false,
      });
    }
  }, [existing]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/uploads", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      update("image_path", data.path);
      update("image_url", "");
      toast.success("Image uploaded.");
    } catch (e) {
      toast.error("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.title_en.trim()) {
      toast.error("English title required.");
      return;
    }
    setSaving(true);
    try {
      if (id) {
        await api.put(`/articles/${id}`, form);
        toast.success("Story updated.");
      } else {
        await api.post("/articles", form);
        toast.success("Story published.");
      }
      nav("/admin");
    } catch (e) {
      toast.error("Save failed. Please check inputs.");
    } finally {
      setSaving(false);
    }
  };

  const previewImg = form.image_path
    ? `${BACKEND_URL}/api/files/${form.image_path}`
    : form.image_url || "";

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6" data-testid="admin-editor">
      <button
        onClick={() => nav("/admin")}
        className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-rahi-red"
      >
        <ArrowLeft className="h-4 w-4" /> {t("dashboard")}
      </button>
      <div className="mb-8 border-b border-border pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rahi-red">{t("admin")}</p>
        <h1 className="masthead-serif text-5xl">
          {id ? t("editArticle") : t("createArticle")}
        </h1>
      </div>

      <form onSubmit={save} className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="en" className="w-full">
            <TabsList data-testid="editor-lang-tabs">
              <TabsTrigger value="en" data-testid="tab-en">English</TabsTrigger>
              <TabsTrigger value="bn" data-testid="tab-bn">বাংলা</TabsTrigger>
            </TabsList>
            {["en", "bn"].map((L) => (
              <TabsContent key={L} value={L} className="space-y-4 pt-4">
                <div>
                  <Label>{t("title")} ({L.toUpperCase()})</Label>
                  <Input
                    className="rounded-sm mt-1"
                    value={form[`title_${L}`]}
                    onChange={(e) => update(`title_${L}`, e.target.value)}
                    data-testid={`title-${L}`}
                    required={L === "en"}
                  />
                </div>
                <div>
                  <Label>{t("excerpt")} ({L.toUpperCase()})</Label>
                  <Textarea
                    rows={3}
                    className="rounded-sm mt-1"
                    value={form[`excerpt_${L}`]}
                    onChange={(e) => update(`excerpt_${L}`, e.target.value)}
                    data-testid={`excerpt-${L}`}
                  />
                </div>
                <div>
                  <Label>{t("body")} ({L.toUpperCase()})</Label>
                  <div className="mt-1" data-testid={`body-${L}-wrap`}>
                    <RichEditor
                      value={form[`body_${L}`]}
                      onChange={(html) => update(`body_${L}`, html)}
                      placeholder={L === "en" ? "Write the story…" : "গল্প লিখুন…"}
                    />
                  </div>
                  <textarea
                    className="sr-only"
                    value={form[`body_${L}`]}
                    onChange={() => {}}
                    data-testid={`body-${L}`}
                    readOnly
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <aside className="space-y-6">
          <div className="border border-border p-4">
            <Label className="text-xs uppercase tracking-[0.24em]">{t("category")}</Label>
            <Select
              value={form.category}
              onValueChange={(v) => update("category", v)}
            >
              <SelectTrigger className="mt-2 rounded-sm" data-testid="category-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.slug} value={c.slug} data-testid={`category-option-${c.slug}`}>
                    {catLabel(c, lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border border-border p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Cover image</p>
            {previewImg ? (
              <div className="mt-3 aspect-[16/10] overflow-hidden bg-muted">
                <img src={previewImg} alt="preview" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="mt-3 flex aspect-[16/10] items-center justify-center border border-dashed border-border text-muted-foreground text-sm">
                No image yet
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => upload(e.target.files?.[0])}
              data-testid="upload-input"
            />
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full rounded-sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              data-testid="upload-btn"
            >
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {t("uploadImage")}
            </Button>
            <div className="mt-3 space-y-1">
              <Label className="text-xs">Or paste image URL</Label>
              <Input
                className="rounded-sm"
                placeholder="https://…"
                value={form.image_url}
                onChange={(e) => {
                  update("image_url", e.target.value);
                  update("image_path", "");
                }}
                data-testid="image-url-input"
              />
            </div>
          </div>

          <div className="border border-border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label>{t("published")}</Label>
              <Switch
                checked={form.published}
                onCheckedChange={(v) => update("published", v)}
                data-testid="published-switch"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Featured</Label>
              <Switch
                checked={form.featured}
                onCheckedChange={(v) => update("featured", v)}
                data-testid="featured-switch"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => nav("/admin")}
              className="flex-1 rounded-sm"
              data-testid="cancel-btn"
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-sm bg-rahi-red text-white hover:bg-rahi-ink"
              data-testid="save-btn"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("save")}
            </Button>
          </div>
        </aside>
      </form>
    </div>
  );
}
