import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/contexts/AuthContext";
import { useLang, pick } from "@/contexts/LanguageContext";
import { useCategories, catLabel } from "@/contexts/CategoriesContext";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Eye, MessageSquare, LayoutDashboard, Radio, Columns, FolderTree } from "lucide-react";
import { formatDate } from "@/components/ArticleCard";
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

export default function AdminDashboard() {
  const { t, lang } = useLang();
  const { byslug } = useCategories();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-articles"],
    queryFn: async () => (await api.get("/admin/articles")).data,
  });

  const del = useMutation({
    mutationFn: async (id) => (await api.delete(`/articles/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-articles"] });
      toast.success("Article deleted.");
    },
    onError: () => toast.error("Delete failed."),
  });

  const items = data?.items || [];
  const stats = {
    total: items.length,
    published: items.filter((x) => x.published).length,
    featured: items.filter((x) => x.featured).length,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6" data-testid="admin-dashboard">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rahi-red">{t("admin")}</p>
          <h1 className="masthead-serif text-5xl">{t("manageStories")}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => nav("/admin/layout")}
            variant="outline"
            className="rounded-sm"
            data-testid="admin-layout-btn"
          >
            <LayoutDashboard className="mr-2 h-4 w-4" /> Layout
          </Button>
          <Button
            onClick={() => nav("/admin/breaking")}
            variant="outline"
            className="rounded-sm"
            data-testid="admin-breaking-btn"
          >
            <Radio className="mr-2 h-4 w-4" /> Breaking
          </Button>
          <Button
            onClick={() => nav("/admin/sidebar")}
            variant="outline"
            className="rounded-sm"
            data-testid="admin-sidebar-btn"
          >
            <Columns className="mr-2 h-4 w-4" /> Side Panels
          </Button>
          <Button
            onClick={() => nav("/admin/categories")}
            variant="outline"
            className="rounded-sm"
            data-testid="admin-categories-btn"
          >
            <FolderTree className="mr-2 h-4 w-4" /> Categories
          </Button>
          <Button
            onClick={() => nav("/admin/comments")}
            variant="outline"
            className="rounded-sm"
            data-testid="admin-comments-btn"
          >
            <MessageSquare className="mr-2 h-4 w-4" /> Comments
          </Button>
          <Button
            onClick={() => nav("/admin/new")}
            className="rounded-sm bg-rahi-red text-white hover:bg-rahi-ink"
            data-testid="admin-new-btn"
          >
            <Plus className="mr-2 h-4 w-4" /> {t("createArticle")}
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3" data-testid="admin-stats">
        {[
          { label: "Total", value: stats.total },
          { label: "Published", value: stats.published },
          { label: "Featured", value: stats.featured },
        ].map((s) => (
          <div key={s.label} className="border border-border p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{s.label}</p>
            <p className="mt-2 font-heading text-4xl">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[45%]">{t("title")}</TableHead>
              <TableHead>{t("category")}</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {t("noStories")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((a) => (
                <TableRow key={a.id} data-testid={`admin-row-${a.id}`}>
                  <TableCell className="max-w-xl">
                    <Link to={`/article/${a.slug}`} className="link-sweep font-semibold">
                      {pick(a, "title", lang)}
                    </Link>
                  </TableCell>
                  <TableCell className="uppercase text-xs tracking-[0.2em]">
                    {catLabel(byslug[a.category], lang) || a.category}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Badge variant={a.published ? "default" : "secondary"}>
                        {a.published ? "Live" : "Draft"}
                      </Badge>
                      {a.featured && <Badge className="bg-rahi-red">Featured</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(a.created_at, lang)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => nav(`/article/${a.slug}`)}
                        data-testid={`admin-view-${a.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => nav(`/admin/edit/${a.id}`)}
                        data-testid={`admin-edit-${a.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`admin-delete-${a.id}`}>
                            <Trash2 className="h-4 w-4 text-rahi-red" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this story?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. All associated comments, likes and bookmarks will be removed.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-rahi-red text-white hover:bg-rahi-ink"
                              onClick={() => del.mutate(a.id)}
                              data-testid={`confirm-delete-${a.id}`}
                            >
                              {t("deleteArticle")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
