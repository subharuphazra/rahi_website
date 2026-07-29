import React, { useState } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { useCategories, catLabel } from "@/contexts/CategoriesContext";
import { api } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Twitter, Instagram, Youtube, Mail } from "lucide-react";
import { Link } from "react-router-dom";

export default function Footer() {
  const { t, lang } = useLang();
  const { items: CATEGORIES } = useCategories();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    try {
      await api.post("/newsletter", { email });
      toast.success(t("subscribed"));
      setEmail("");
    } catch (e) {
      toast.error("Please enter a valid email.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <footer className="border-t border-border bg-rahi-ink text-white" data-testid="site-footer">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <h2 className="masthead-serif text-6xl sm:text-8xl leading-none">
              {t("brand")}
            </h2>
            <p className="mt-6 max-w-md text-sm text-white/70">{t("footerCopy")}</p>
            <form onSubmit={submit} className="mt-8 flex max-w-md items-center gap-2 border-b border-white/20 pb-1">
              <Mail className="h-4 w-4 text-white/60" />
              <Input
                data-testid="footer-newsletter-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder={t("subscribeCta")}
                className="border-0 bg-transparent text-white placeholder:text-white/50 focus-visible:ring-0"
                required
              />
              <Button
                type="submit"
                data-testid="footer-newsletter-btn"
                disabled={busy}
                className="rounded-sm bg-rahi-red text-white hover:bg-white hover:text-rahi-ink"
              >
                {t("subscribe")}
              </Button>
            </form>
            <p className="mt-2 text-xs text-white/50">{t("subscribeHint")}</p>
          </div>

          <div className="lg:col-span-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/60">
              {t("home")}
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <Link to={`/category/${c.slug}`} className="hover:text-rahi-red">
                    {catLabel(c, lang)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/60">Follow</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-center gap-2 hover:text-rahi-red">
                <Twitter className="h-4 w-4" /> @rahibangla
              </li>
              <li className="flex items-center gap-2 hover:text-rahi-red">
                <Instagram className="h-4 w-4" /> rahibangla
              </li>
              <li className="flex items-center gap-2 hover:text-rahi-red">
                <Youtube className="h-4 w-4" /> Rahi Bangla
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-2 border-t border-white/20 pt-8 text-xs text-white/50 sm:flex-row">
          <p>© {new Date().getFullYear()} {t("brand")}. {t("allRights")}</p>
          <p>{lang === "bn" ? "কলকাতা · নয়াদিল্লি" : "Kolkata · New Delhi"}</p>
        </div>
      </div>
    </footer>
  );
}
