import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/contexts/AuthContext";
import { ArticleCard, ArticleRow, articleImage, formatDate } from "@/components/ArticleCard";
import { pick, useLang } from "@/contexts/LanguageContext";
import { useCategories, catLabel } from "@/contexts/CategoriesContext";
import { Link } from "react-router-dom";
import { SiteMeta } from "@/components/Seo";
import SidebarNews from "@/components/SidebarNews";
import CustomLayoutSection from "@/components/CustomLayoutSection";

export default function HomePage() {
  const { lang, t } = useLang();
  const { items: cats } = useCategories();
  const { data, isLoading } = useQuery({
    queryKey: ["home-articles"],
    queryFn: async () => (await api.get("/articles", { params: { limit: 40 } })).data,
  });
  const items = data?.items || [];

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-muted-foreground sm:px-6" data-testid="home-loading">
        Loading…
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-center text-muted-foreground sm:px-6" data-testid="home-empty">
        {t("noStories")}
      </div>
    );
  }

  const hero = items.find((a) => a.featured) || items[0];
  const secondary = items.filter((a) => a.id !== hero.id).slice(0, 2);
  const rest = items.filter((a) => a.id !== hero.id && !secondary.find((s) => s.id === a.id));

  // Group rest by category
  const byCat = {};
  cats.forEach((c) => (byCat[c.slug] = []));
  rest.forEach((a) => {
    if (byCat[a.category]) byCat[a.category].push(a);
  });

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24 sm:px-6" data-testid="home-page">
      <SiteMeta />
      <div className="grid gap-8 lg:grid-cols-[240px_1fr_240px]">
        <SidebarNews side="left" />

        <div className="min-w-0">
          {/* Hero bento */}
          <section className="grain-overlay border-b border-border py-8 sm:py-10">
            <div className="grid gap-8 lg:grid-cols-12">
              <Link
                to={`/article/${hero.slug}`}
                className="group lg:col-span-8"
                data-testid="hero-article"
              >
                <div className="aspect-[16/10] overflow-hidden bg-muted">
                  <img
                    src={articleImage(hero)}
                    alt={pick(hero, "title", lang)}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="mt-6 space-y-3">
                  <span className="inline-block bg-rahi-red px-2 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-white">
                    {t("featured")}
                  </span>
                  <h1 className="font-heading text-4xl sm:text-5xl leading-[0.95] tracking-tight text-foreground group-hover:text-rahi-red transition-colors">
                    {pick(hero, "title", lang)}
                  </h1>
                  <p className="max-w-2xl text-base sm:text-lg text-muted-foreground">
                    {pick(hero, "excerpt", lang)}
                  </p>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    {formatDate(hero.created_at, lang)} · {hero.author_name}
                  </p>
                </div>
              </Link>

              <div className="grid gap-8 lg:col-span-4">
                {secondary.map((a) => (
                  <ArticleCard key={a.id} article={a} size="sm" />
                ))}
              </div>
            </div>
          </section>

          {/* Latest strip — either admin-configured layout or default grid */}
          <section className="py-12">
            <div className="mb-8 flex items-end justify-between border-b border-border pb-4">
              <h2 className="masthead-serif text-4xl sm:text-5xl">{t("latest")}</h2>
              <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                {new Date().toLocaleDateString(lang === "bn" ? "bn-IN" : "en-IN")}
              </span>
            </div>
            <CustomLayoutSection
              layoutKey="home:latest"
              articles={rest.slice(0, 12)}
              fallbackRender={(list) => (
                <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
                  {list.slice(0, 6).map((a) => (
                    <ArticleCard key={a.id} article={a} size="md" />
                  ))}
                </div>
              )}
            />
          </section>

          {/* Category sections */}
          {cats.map((c) => {
            const list = (byCat[c.slug] || []).slice(0, 4);
            if (list.length === 0) return null;
            return (
              <section key={c.slug} className="border-t border-border py-12" data-testid={`section-${c.slug}`}>
                <div className="mb-6 flex items-baseline justify-between">
                  <h2 className="font-heading text-3xl sm:text-4xl">{catLabel(c, lang)}</h2>
                  <Link
                    to={`/category/${c.slug}`}
                    className="text-xs uppercase tracking-[0.24em] text-rahi-red hover:underline"
                  >
                    {t("readMore")} →
                  </Link>
                </div>
                <CustomLayoutSection
                  layoutKey={`home:section:${c.slug}`}
                  articles={list}
                  fallbackRender={(l) => (
                    <div className="grid gap-6 md:grid-cols-2">
                      {l.map((a) => (
                        <ArticleRow key={a.id} article={a} />
                      ))}
                    </div>
                  )}
                />
              </section>
            );
          })}
        </div>

        <SidebarNews side="right" />
      </div>
    </div>
  );
}
