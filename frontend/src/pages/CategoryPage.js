import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { useCategories, catLabel } from "@/contexts/CategoriesContext";
import { ArticleCard } from "@/components/ArticleCard";
import SidebarNews from "@/components/SidebarNews";
import CustomLayoutSection from "@/components/CustomLayoutSection";

export default function CategoryPage() {
  const { category } = useParams();
  const [search] = useSearchParams();
  const q = search.get("q") || "";
  const { t, lang } = useLang();
  const { byslug } = useCategories();

  const { data, isLoading } = useQuery({
    queryKey: ["cat", category, q],
    queryFn: async () =>
      (await api.get("/articles", { params: { category, q: q || undefined, limit: 60 } })).data,
  });

  const items = data?.items || [];
  const cat = byslug[category];
  const catName = cat ? catLabel(cat, lang) : category;
  const layoutKey = `category:${category}`;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6" data-testid="category-page">
      <div className="mb-10 border-b border-border pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rahi-red">
          {q ? `Search: "${q}"` : t("home")}
        </p>
        <h1 className="mt-2 masthead-serif text-5xl sm:text-6xl">{catName}</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr_240px]">
        <SidebarNews side="left" />
        <div>
          {isLoading ? (
            <p className="text-muted-foreground" data-testid="cat-loading">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground" data-testid="cat-empty">{t("noStories")}</p>
          ) : q ? (
            <div className="grid gap-10 md:grid-cols-2">
              {items.map((a) => (
                <ArticleCard key={a.id} article={a} size="md" />
              ))}
            </div>
          ) : (
            <CustomLayoutSection
              layoutKey={layoutKey}
              articles={items}
              fallbackRender={(list) => (
                <div className="grid gap-10 md:grid-cols-2">
                  {list.map((a) => (
                    <ArticleCard key={a.id} article={a} size="md" />
                  ))}
                </div>
              )}
            />
          )}
        </div>
        <SidebarNews side="right" />
      </div>
    </div>
  );
}
