import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, Trash2, MessageSquare, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/components/ArticleCard";
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

export default function AdminComments() {
  const { t, lang } = useLang();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-comments", searchTerm],
    queryFn: async () =>
      (await api.get("/admin/comments", { params: { q: searchTerm || undefined, limit: 200 } })).data,
  });

  const del = useMutation({
    mutationFn: async (id) => (await api.delete(`/admin/comments/${id}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-comments"] });
      toast.success("Comment deleted.");
    },
    onError: () => toast.error("Delete failed."),
  });

  const items = data?.items || [];
  const total = data?.total || 0;

  const runSearch = (e) => {
    e.preventDefault();
    setSearchTerm(q.trim());
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6" data-testid="admin-comments-page">
      <button
        onClick={() => nav("/admin")}
        className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-rahi-red"
        data-testid="admin-comments-back"
      >
        <ArrowLeft className="h-4 w-4" /> {t("dashboard")}
      </button>

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rahi-red">{t("admin")}</p>
          <h1 className="masthead-serif text-5xl">Comment moderation</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="admin-comments-total">
            {total} comment{total === 1 ? "" : "s"}
          </p>
        </div>
        <form onSubmit={runSearch} className="flex w-full max-w-sm items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by user or comment…"
              className="rounded-sm pl-9"
              data-testid="admin-comments-search-input"
            />
          </div>
          <Button type="submit" className="rounded-sm" data-testid="admin-comments-search-btn">
            Search
          </Button>
          {searchTerm && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setQ(""); setSearchTerm(""); }}
              className="rounded-sm"
              data-testid="admin-comments-clear-btn"
            >
              Clear
            </Button>
          )}
        </form>
      </div>

      {isLoading ? (
        <p className="mt-10 text-muted-foreground" data-testid="admin-comments-loading">Loading…</p>
      ) : items.length === 0 ? (
        <div className="mt-16 border border-dashed border-border p-12 text-center" data-testid="admin-comments-empty">
          <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {searchTerm ? "No comments match your search." : "No comments have been posted yet."}
          </p>
        </div>
      ) : (
        <ul className="mt-10 space-y-4">
          {items.map((c) => (
            <li
              key={c.id}
              className="border border-border p-5 transition-colors hover:border-rahi-red/40"
              data-testid={`comment-row-${c.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="font-semibold" data-testid={`comment-user-${c.id}`}>{c.user_name}</p>
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.18em]">
                      {formatDate(c.created_at, lang)}
                    </Badge>
                    {c.article_slug ? (
                      <Link
                        to={`/article/${c.article_slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.2em] text-rahi-red hover:underline"
                        data-testid={`comment-article-link-${c.id}`}
                      >
                        {c.article_title || "(untitled)"} <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">on: {c.article_title}</span>
                    )}
                  </div>
                  <p
                    className="mt-3 whitespace-pre-wrap text-sm text-foreground/90"
                    data-testid={`comment-body-${c.id}`}
                  >
                    {c.body}
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-rahi-red hover:bg-rahi-red/10"
                      data-testid={`comment-delete-btn-${c.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. The comment by <strong>{c.user_name}</strong> will be permanently removed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid={`comment-cancel-${c.id}`}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-rahi-red text-white hover:bg-rahi-ink"
                        onClick={() => del.mutate(c.id)}
                        data-testid={`comment-confirm-delete-${c.id}`}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
