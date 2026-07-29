import React from "react";
import { useLang } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/contexts/AuthContext";
import { pick } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";

function pickText(item, lang) {
  const primary = item[`text_${lang}`];
  if (primary && primary.trim()) return primary;
  const fb = lang === "en" ? "bn" : "en";
  return item[`text_${fb}`] || "";
}

export default function Ticker() {
  const { lang, t } = useLang();
  const { data: breakingData } = useQuery({
    queryKey: ["breaking-active"],
    queryFn: async () => (await api.get("/breaking")).data,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  // Fallback: latest articles if no breaking configured
  const { data: latestData } = useQuery({
    queryKey: ["breaking-fallback"],
    queryFn: async () => (await api.get("/articles", { params: { limit: 8 } })).data,
    enabled: !breakingData || (breakingData?.items || []).length === 0,
  });

  const breaking = breakingData?.items || [];
  let display = [];
  if (breaking.length > 0) {
    display = breaking.map((b) => ({
      key: b.id,
      text: pickText(b, lang),
      link: b.link || null,
      external: /^https?:\/\//i.test(b.link || ""),
    }));
  } else if (latestData?.items) {
    display = latestData.items.map((a) => ({
      key: a.id,
      text: pick(a, "title", lang),
      link: `/article/${a.slug}`,
      external: false,
    }));
  }

  if (!display.length) return null;
  const doubled = [...display, ...display];

  return (
    <div
      className="relative overflow-hidden border-b border-border bg-rahi-ink text-white"
      data-testid="news-ticker"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 sm:px-6">
        <span className="shrink-0 bg-rahi-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.25em]">
          {t("breaking")}
        </span>
        <div className="flex-1 overflow-hidden">
          <div className="flex w-max animate-ticker gap-10 whitespace-nowrap text-sm">
            {doubled.map((item, i) => {
              const content = (
                <span className="hover:text-rahi-red transition-colors">
                  • {item.text}
                </span>
              );
              if (!item.link) {
                return (
                  <span key={`${item.key}-${i}`} data-testid={`ticker-item-${item.key}`}>
                    {content}
                  </span>
                );
              }
              if (item.external) {
                return (
                  <a
                    key={`${item.key}-${i}`}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`ticker-item-${item.key}`}
                  >
                    {content}
                  </a>
                );
              }
              return (
                <Link
                  key={`${item.key}-${i}`}
                  to={item.link}
                  data-testid={`ticker-item-${item.key}`}
                >
                  {content}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
