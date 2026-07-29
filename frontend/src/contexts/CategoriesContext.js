import React, { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/contexts/AuthContext";

const CategoriesContext = createContext(null);

const FALLBACK = [
  { slug: "business", name_en: "Business", name_bn: "ব্যবসা", order: 0 },
  { slug: "education", name_en: "Education", name_bn: "শিক্ষা", order: 1 },
  { slug: "sports", name_en: "Sports", name_bn: "খেলা", order: 2 },
  { slug: "entertainment", name_en: "Entertainment", name_bn: "বিনোদন", order: 3 },
  { slug: "science", name_en: "Science", name_bn: "বিজ্ঞান", order: 4 },
  { slug: "lifestyle", name_en: "Lifestyle", name_bn: "জীবনধারা", order: 5 },
  { slug: "elections", name_en: "Elections", name_bn: "নির্বাচন", order: 6 },
];

export const CategoriesProvider = ({ children }) => {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/categories")).data,
    staleTime: 60_000,
  });

  const value = useMemo(() => {
    const items = data?.items && data.items.length > 0 ? data.items : FALLBACK;
    const slugs = items.map((c) => c.slug);
    const byslug = Object.fromEntries(items.map((c) => [c.slug, c]));
    return { items, slugs, byslug, isLoading, refetch };
  }, [data, isLoading, refetch]);

  return (
    <CategoriesContext.Provider value={value}>
      {children}
    </CategoriesContext.Provider>
  );
};

export const useCategories = () => {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error("useCategories must be inside CategoriesProvider");
  return ctx;
};

export const catLabel = (cat, lang) => {
  if (!cat) return "";
  const primary = cat[`name_${lang}`];
  if (primary && primary.trim()) return primary;
  return cat.name_en || cat.slug;
};
