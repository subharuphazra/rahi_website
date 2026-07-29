import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { formatDistanceToNow } from "date-fns";
import { Clock } from "lucide-react";

function pickText(item, lang) {
  const primary = item[`text_${lang}`];
  if (primary && primary.trim()) return primary;
  const fb = lang === "en" ? "bn" : "en";
  return item[`text_${fb}`] || "";
}

function timeAgoLabel(iso) {
  if (!iso) return "";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

export default function SidebarNews({ side = "left", limit = 10 }) {
  const { lang, t } = useLang();
  // Tick to refresh timeAgo labels
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const { data } = useQuery({
    queryKey: ["sidebar", side, limit],
    queryFn: async () =>
      (await api.get("/sidebar-news", { params: { side, limit, include_auto: true } })).data,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const items = data?.items || [];
  if (!items.length) return <aside className="hidden lg:block" data-testid={`sidebar-${side}-empty`} />;

  const heading = side === "left" ? (lang === "bn" ? "সাম্প্রতিক" : "Latest News") : (lang === "bn" ? "আরও খবর" : "More Stories");

  return (
    <aside
      className="hidden lg:block sticky top-32 self-start"
      data-testid={`sidebar-${side}`}
    >
      <div className="border-t-2 border-rahi-red pt-3">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.24em] text-rahi-red">
          {heading}
        </p>
        <ul className="space-y-3">
          {items.map((it) => {
            const text = pickText(it, lang);
            const external = /^https?:\/\//i.test(it.link || "");
            const inner = (
              <div className="group cursor-pointer border-b border-border pb-3 last:border-b-0">
                <p className="text-sm font-semibold leading-snug text-foreground group-hover:text-rahi-red transition-colors">
                  {text}
                </p>
                <p className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {timeAgoLabel(it.created_at)}
                </p>
              </div>
            );
            if (!it.link) {
              return (
                <li key={it.id} data-testid={`sidebar-${side}-item-${it.id}`}>
                  {inner}
                </li>
              );
            }
            if (external) {
              return (
                <li key={it.id} data-testid={`sidebar-${side}-item-${it.id}`}>
                  <a href={it.link} target="_blank" rel="noopener noreferrer">{inner}</a>
                </li>
              );
            }
            return (
              <li key={it.id} data-testid={`sidebar-${side}-item-${it.id}`}>
                <Link to={it.link}>{inner}</Link>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
