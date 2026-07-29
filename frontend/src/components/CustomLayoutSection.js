import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/contexts/AuthContext";
import { useLang, pick } from "@/contexts/LanguageContext";
import { articleImage, formatDate } from "@/components/ArticleCard";

/**
 * Renders articles arranged according to a saved layout config (blocks: {i, x, y, w, h, articleId}).
 * If no layout stored yet, calls fallbackRender(list).
 *
 * Blocks reference an articleId. Articles not referenced fall to the tail (below the grid).
 * Layout uses 12-column CSS grid. Each block declares { x, y, w, h }.
 */
export default function CustomLayoutSection({ layoutKey, articles, fallbackRender }) {
  const { data } = useQuery({
    queryKey: ["layout", layoutKey],
    queryFn: async () => (await api.get(`/layouts/${encodeURIComponent(layoutKey)}`)).data,
    staleTime: 60_000,
  });

  const blocks = data?.blocks || [];
  const arts = useMemo(() => articles || [], [articles]);

  const artMap = useMemo(() => Object.fromEntries(arts.map((a) => [a.id, a])), [arts]);
  const usedIds = new Set(blocks.map((b) => b.articleId).filter(Boolean));
  const unplaced = arts.filter((a) => !usedIds.has(a.id));

  if (blocks.length === 0) {
    return fallbackRender ? fallbackRender(arts) : null;
  }

  // Build grid rows count
  const maxY = blocks.reduce((m, b) => Math.max(m, (b.y || 0) + (b.h || 1)), 0);

  return (
    <div data-testid={`layout-${layoutKey}`}>
      <div
        className="grid gap-6"
        style={{
          gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
          gridAutoRows: "minmax(120px, auto)",
          gridTemplateRows: `repeat(${maxY}, minmax(120px, auto))`,
        }}
      >
        {blocks.map((b, idx) => {
          const a = b.articleId ? artMap[b.articleId] : null;
          const style = {
            gridColumn: `${(b.x || 0) + 1} / span ${b.w || 3}`,
            gridRow: `${(b.y || 0) + 1} / span ${b.h || 1}`,
          };
          return (
            <div
              key={b.i || idx}
              style={style}
              className="min-h-[120px]"
              data-testid={`layout-block-${b.i || idx}`}
            >
              {a ? <LayoutArticleCard article={a} h={b.h || 1} /> : (
                <div className="flex h-full items-center justify-center border border-dashed border-border p-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  (missing article)
                </div>
              )}
            </div>
          );
        })}
      </div>
      {unplaced.length > 0 && (
        <div className="mt-10 border-t border-border pt-8">
          <p className="mb-4 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">More stories</p>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {unplaced.map((a) => (
              <LayoutArticleCard key={a.id} article={a} h={2} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function LayoutArticleCard({ article, h = 2 }) {
  const { lang } = useLang();
  const title = pick(article, "title", lang);
  const excerpt = pick(article, "excerpt", lang);
  const showImage = h >= 2;
  const showExcerpt = h >= 3;
  return (
    <Link
      to={`/article/${article.slug}`}
      className="group flex h-full flex-col overflow-hidden"
      data-testid={`layout-article-${article.id}`}
    >
      {showImage && (
        <div className="mb-3 overflow-hidden bg-muted" style={{ aspectRatio: h >= 3 ? "16/10" : "16/9" }}>
          <img
            src={articleImage(article)}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      )}
      <h3 className={`font-heading leading-tight tracking-tight text-foreground group-hover:text-rahi-red transition-colors ${h >= 3 ? "text-2xl" : h >= 2 ? "text-lg" : "text-base"}`}>
        {title}
      </h3>
      {showExcerpt && excerpt && (
        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{excerpt}</p>
      )}
      <p className="mt-auto pt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {formatDate(article.created_at, lang)}
      </p>
    </Link>
  );
}
