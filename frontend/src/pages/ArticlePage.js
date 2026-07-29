import React, { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { api } from "@/contexts/AuthContext";
import { pick, useLang } from "@/contexts/LanguageContext";
import { useCategories, catLabel } from "@/contexts/CategoriesContext";
import { articleImage, formatDate } from "@/components/ArticleCard";
import { Heart, Bookmark, Share2, MessageSquare, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { SiteMeta, ArticleJsonLd } from "@/components/Seo";

export default function ArticlePage() {
  const { slug } = useParams();
  const nav = useNavigate();
  const { lang, t } = useLang();
  const { byslug } = useCategories();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["article", slug],
    queryFn: async () => (await api.get(`/articles/${slug}`)).data,
  });

  const { data: comments } = useQuery({
    queryKey: ["comments", data?.article?.id],
    queryFn: async () =>
      (await api.get(`/articles/${data.article.id}/comments`)).data,
    enabled: !!data?.article?.id,
  });

  const [commentBody, setCommentBody] = useState("");

  const a = data?.article;
  const title = a ? pick(a, "title", lang) : "";
  const excerpt = a ? pick(a, "excerpt", lang) : "";
  const body = a ? pick(a, "body", lang) : "";
  const isHtmlBody = /^\s*</.test(body || "");
  const sanitizedBody = useMemo(
    () => (isHtmlBody ? DOMPurify.sanitize(body, { USE_PROFILES: { html: true } }) : ""),
    [body, isHtmlBody]
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-muted-foreground" data-testid="article-loading">
        Loading…
      </div>
    );
  }
  if (!data?.article) {
    return <div className="mx-auto max-w-3xl px-4 py-24">Article not found.</div>;
  }

  const toggleLike = async () => {
    if (!user) {
      toast(t("loginRequired"));
      nav("/login");
      return;
    }
    try {
      const { data: res } = await api.post(`/articles/${a.id}/like`);
      qc.setQueryData(["article", slug], (old) => ({
        ...old,
        liked: res.liked,
        likes: res.likes,
      }));
    } catch (e) {
      toast.error("Please try again");
    }
  };

  const toggleBookmark = async () => {
    if (!user) {
      toast(t("loginRequired"));
      nav("/login");
      return;
    }
    try {
      const { data: res } = await api.post(`/articles/${a.id}/bookmark`);
      qc.setQueryData(["article", slug], (old) => ({
        ...old,
        bookmarked: res.bookmarked,
      }));
      toast.success(res.bookmarked ? t("bookmarked") : t("bookmark"));
    } catch (e) {
      toast.error("Please try again");
    }
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; }
      catch (err) {
        if (err?.name !== "AbortError") console.warn("share failed:", err);
      }
    }
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard.");
  };

  const postComment = async (e) => {
    e.preventDefault();
    if (!user) {
      toast(t("loginRequired"));
      return;
    }
    if (!commentBody.trim()) return;
    try {
      await api.post(`/articles/${a.id}/comments`, { body: commentBody.trim() });
      setCommentBody("");
      qc.invalidateQueries({ queryKey: ["comments", a.id] });
      toast.success("Comment added.");
    } catch (e) {
      toast.error("Please try again");
    }
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:py-14 sm:px-6" data-testid="article-page">
      <button
        onClick={() => nav(-1)}
        className="mb-8 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-rahi-red"
        data-testid="article-back-btn"
      >
        <ArrowLeft className="h-4 w-4" /> back
      </button>

      <div className="space-y-4">
        <span className="inline-block bg-rahi-ink px-2 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white">
          {catLabel(byslug[a.category], lang) || a.category}
        </span>
        <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl leading-[0.95] tracking-tight" data-testid="article-title">
          {title}
        </h1>
        {excerpt && <p className="text-lg text-muted-foreground">{excerpt}</p>}
      </div>

      <div className="my-8 flex flex-wrap items-center justify-between gap-4 border-y border-border py-4 text-xs uppercase tracking-[0.22em] text-muted-foreground">
        <div>
          {t("by")} <span className="text-foreground">{a.author_name}</span> · {formatDate(a.created_at, lang)}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 rounded-sm"
            onClick={toggleLike}
            data-testid="like-btn"
          >
            <Heart
              className={`h-4 w-4 ${data.liked ? "fill-rahi-red text-rahi-red" : ""}`}
            />
            <span>{data.likes}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 rounded-sm"
            onClick={toggleBookmark}
            data-testid="bookmark-btn"
          >
            <Bookmark
              className={`h-4 w-4 ${data.bookmarked ? "fill-foreground" : ""}`}
            />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 rounded-sm"
            onClick={share}
            data-testid="share-btn"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mb-10 aspect-[16/10] overflow-hidden bg-muted">
        <img src={articleImage(a)} alt={title} className="h-full w-full object-cover" />
      </div>

      <SiteMeta
        title={title}
        description={excerpt || undefined}
        image={articleImage(a)}
      />
      <ArticleJsonLd article={a} canonical={typeof window !== "undefined" ? window.location.href : ""} />

      {isHtmlBody ? (
        <div
          className="prose prose-lg max-w-none prose-headings:font-heading prose-p:leading-relaxed prose-img:my-6 prose-a:text-rahi-red"
          data-testid="article-body"
          dangerouslySetInnerHTML={{ __html: sanitizedBody }}
        />
      ) : (
        <div className="prose-article max-w-none" data-testid="article-body">
          {body.split(/\n{2,}/).map((para, i) => (
            <p key={`p-${i}-${para.slice(0, 12)}`}>{para}</p>
          ))}
        </div>
      )}

      <Separator className="my-12" />

      <section className="mt-8" data-testid="comments-section">
        <div className="mb-6 flex items-center gap-3">
          <MessageSquare className="h-5 w-5" />
          <h2 className="font-heading text-2xl">{t("comments")} ({comments?.items?.length || 0})</h2>
        </div>

        {user ? (
          <form onSubmit={postComment} className="space-y-3">
            <Textarea
              data-testid="comment-input"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder={t("writeComment")}
              rows={3}
              className="rounded-sm"
            />
            <Button
              type="submit"
              className="rounded-sm bg-rahi-ink text-white hover:bg-rahi-red"
              data-testid="comment-submit-btn"
            >
              {t("postComment")}
            </Button>
          </form>
        ) : (
          <p className="border border-dashed border-border p-4 text-sm text-muted-foreground" data-testid="comment-login-hint">
            <button className="link-sweep font-semibold" onClick={() => nav("/login")}>
              {t("login")}
            </button>{" "}
            {t("loginRequired")}
          </p>
        )}

        <ul className="mt-8 space-y-6">
          {(comments?.items || []).map((c) => (
            <li key={c.id} className="border-t border-border pt-4" data-testid={`comment-${c.id}`}>
              <div className="flex items-baseline justify-between">
                <p className="font-semibold">{c.user_name}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {formatDate(c.created_at, lang)}
                </p>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{c.body}</p>
            </li>
          ))}
          {(!comments?.items || comments.items.length === 0) && (
            <li className="text-sm text-muted-foreground">Be the first to comment.</li>
          )}
        </ul>
      </section>
    </article>
  );
}
