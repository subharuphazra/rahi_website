import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, LogIn, LogOut, User, ShieldCheck, Bookmark, Search, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { useCategories, catLabel } from "@/contexts/CategoriesContext";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Header() {
  const { user, logout } = useAuth();
  const { lang, toggle, t } = useLang();
  const { items: CATEGORIES } = useCategories();
  const nav = useNavigate();
  const [showSearch, setShowSearch] = useState(false);
  const [q, setQ] = useState("");
  const [openMobile, setOpenMobile] = useState(false);

  const doSearch = (e) => {
    e.preventDefault();
    if (q.trim() && CATEGORIES[0]) {
      nav(`/category/${CATEGORIES[0].slug}?q=${encodeURIComponent(q.trim())}`);
      setShowSearch(false);
      setQ("");
    }
  };

  return (
    <header
      className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl"
      data-testid="site-header"
    >
      {/* Top strip */}
      <div className="border-b border-border/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-muted-foreground sm:px-6">
          <span data-testid="header-date">
            {new Date().toLocaleDateString(lang === "bn" ? "bn-IN" : "en-IN", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </span>
          <div className="flex items-center gap-4">
            <button
              onClick={toggle}
              data-testid="lang-toggle-btn"
              className="font-body font-semibold hover:text-rahi-red transition-colors"
            >
              {lang === "en" ? "বাংলা" : "English"}
            </button>
          </div>
        </div>
      </div>

      {/* Masthead */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <div className="flex items-center gap-3">
          <Sheet open={openMobile} onOpenChange={setOpenMobile}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" data-testid="mobile-menu-btn">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle className="masthead-serif text-3xl">{t("brand")}</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1">
                {CATEGORIES.map((c) => (
                  <NavLink
                    key={c.slug}
                    to={`/category/${c.slug}`}
                    onClick={() => setOpenMobile(false)}
                    className={({ isActive }) =>
                      `border-b border-border py-3 text-sm uppercase tracking-[0.2em] ${
                        isActive ? "text-rahi-red" : "text-foreground"
                      }`
                    }
                    data-testid={`mobile-cat-${c.slug}`}
                  >
                    {catLabel(c, lang)}
                  </NavLink>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          <Link to="/" data-testid="brand-link" className="flex items-baseline gap-2">
            <span className="masthead-serif text-3xl sm:text-4xl">{t("brand")}</span>
            <span className="hidden text-[10px] uppercase tracking-[0.3em] text-muted-foreground sm:inline">
              est. 2026
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSearch((v) => !v)}
            data-testid="search-toggle-btn"
            aria-label="Search"
          >
            {showSearch ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </Button>

          {user && user.role ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-sm" data-testid="user-menu-btn">
                  <User className="mr-2 h-4 w-4" />
                  {user.name?.split(" ")[0] || t("admin")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => nav("/bookmarks")} data-testid="menu-bookmarks">
                  <Bookmark className="mr-2 h-4 w-4" /> {t("bookmark")}
                </DropdownMenuItem>
                {user.role === "admin" && (
                  <DropdownMenuItem onClick={() => nav("/admin")} data-testid="menu-admin">
                    <ShieldCheck className="mr-2 h-4 w-4" /> {t("dashboard")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} data-testid="menu-logout">
                  <LogOut className="mr-2 h-4 w-4" /> {t("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button
                variant="ghost"
                className="rounded-sm hidden sm:inline-flex"
                onClick={() => nav("/login")}
                data-testid="header-login-btn"
              >
                <LogIn className="mr-2 h-4 w-4" />
                {t("login")}
              </Button>
              <Button
                className="rounded-sm bg-rahi-ink text-white hover:bg-rahi-red"
                onClick={() => nav("/register")}
                data-testid="header-register-btn"
              >
                {t("register")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Category strip */}
      <nav className="hidden border-t border-border md:block" data-testid="category-nav">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-6">
          {CATEGORIES.map((c) => (
            <NavLink
              key={c.slug}
              to={`/category/${c.slug}`}
              data-testid={`cat-${c.slug}`}
              className={({ isActive }) =>
                `whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.22em] transition-colors ${
                  isActive
                    ? "text-rahi-red"
                    : "text-foreground hover:text-rahi-red"
                }`
              }
            >
              {catLabel(c, lang)}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Search bar */}
      {showSearch && (
        <div className="border-t border-border bg-background" data-testid="search-bar">
          <form onSubmit={doSearch} className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="border-0 shadow-none focus-visible:ring-0"
              data-testid="search-input"
            />
            <Button type="submit" size="sm" className="rounded-sm" data-testid="search-submit-btn">
              {t("home")}
            </Button>
          </form>
        </div>
      )}
    </header>
  );
}
