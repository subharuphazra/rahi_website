import React from "react";
import { Link } from "react-router-dom";
import { useLang } from "@/contexts/LanguageContext";

export default function NotFound() {
  const { t } = useLang();
  return (
    <div className="mx-auto max-w-3xl px-4 py-32 text-center sm:px-6" data-testid="not-found">
      <p className="text-xs uppercase tracking-[0.3em] text-rahi-red">404</p>
      <h1 className="mt-4 masthead-serif text-6xl">The page has moved on.</h1>
      <p className="mt-4 text-muted-foreground">Some stories don't stay in one place.</p>
      <Link to="/" className="mt-8 inline-block border-b-2 border-foreground pb-1 text-sm uppercase tracking-[0.22em]">
        {t("home")}
      </Link>
    </div>
  );
}
