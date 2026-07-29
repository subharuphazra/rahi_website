import React from "react";
import { Link } from "react-router-dom";
import { pick, useLang } from "@/contexts/LanguageContext";
import { useCategories, catLabel } from "@/contexts/CategoriesContext";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export function articleImage(a) {
  if (a?.image_path) return `${BACKEND_URL}/api/files/${a.image_path}`;
  if (a?.image_url) return a.image_url;
  return "https://images.pexels.com/photos/35743103/pexels-photo-35743103.jpeg";
}

export function formatDate(iso, lang = "en") {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(lang === "bn" ? "bn-IN" : "en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ArticleCard({ article, size = "md" }) {
  const { lang } = useLang();
  const { byslug } = useCategories();
  const title = pick(article, "title", lang);
  const excerpt = pick(article, "excerpt", lang);
  const catName = catLabel(byslug[article.category], lang) || article.category;
  const sizes = {
    sm: { img: "aspect-[4/3]", title: "text-lg" },
    md: { img: "aspect-[16/10]", title: "text-2xl" },
    lg: { img: "aspect-[16/10]", title: "text-4xl sm:text-5xl" },
  };
  const s = sizes[size] || sizes.md;

  return (
    <Link
      to={`/article/${article.slug}`}
      className="group block"
      data-testid={`article-card-${article.id}`}
    >
      <div className={`overflow-hidden ${s.img} bg-muted`}>
        <img
          src={articleImage(article)}
          alt={title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="mt-4 space-y-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-rahi-red">
          {catName}
        </span>
        <h3 className={`font-heading ${s.title} leading-tight tracking-tight text-foreground group-hover:text-rahi-red transition-colors`}>
          {title}
        </h3>
        {excerpt && size !== "sm" && (
          <p className="text-sm text-muted-foreground line-clamp-2">{excerpt}</p>
        )}
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {formatDate(article.created_at, lang)} · {article.author_name}
        </p>
      </div>
    </Link>
  );
}

export function ArticleRow({ article }) {
  const { lang } = useLang();
  const { byslug } = useCategories();
  const title = pick(article, "title", lang);
  const excerpt = pick(article, "excerpt", lang);
  const catName = catLabel(byslug[article.category], lang) || article.category;
  return (
    <Link
      to={`/article/${article.slug}`}
      className="group grid grid-cols-3 gap-4 border-t border-border py-6 md:grid-cols-4"
      data-testid={`article-row-${article.id}`}
    >
      <div className="col-span-1 overflow-hidden aspect-[4/3] bg-muted">
        <img
          src={articleImage(article)}
          alt={title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="col-span-2 md:col-span-3 space-y-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-rahi-red">
          {catName}
        </span>
        <h3 className="font-heading text-xl sm:text-2xl leading-tight text-foreground group-hover:text-rahi-red transition-colors">
          {title}
        </h3>
        <p className="hidden text-sm text-muted-foreground md:line-clamp-2">{excerpt}</p>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {formatDate(article.created_at, lang)} · {article.author_name}
        </p>
      </div>
    </Link>
  );
}
