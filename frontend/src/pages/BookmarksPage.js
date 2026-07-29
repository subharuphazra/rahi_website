import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/contexts/AuthContext";
import { ArticleCard } from "@/components/ArticleCard";
import { useLang } from "@/contexts/LanguageContext";

export default function BookmarksPage() {
  const { t } = useLang();
  const { data, isLoading } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: async () => (await api.get("/me/bookmarks")).data,
  });

  const items = data?.items || [];
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6" data-testid="bookmarks-page">
      <h1 className="masthead-serif text-5xl border-b border-border pb-6">
        {t("bookmarked")}
      </h1>
      {isLoading ? (
        <p className="mt-8 text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-muted-foreground">No saved stories yet.</p>
      ) : (
        <div className="mt-10 grid gap-10 md:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => (
            <ArticleCard key={a.id} article={a} size="md" />
          ))}
        </div>
      )}
    </div>
  );
}
