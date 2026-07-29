import React, { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth, formatApiError } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function LoginPage() {
  const nav = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const u = await login(email, password);
      toast.success(`Welcome back, ${u.name}`);
      const to = location.state?.from || (u.role === "admin" ? "/admin" : "/");
      nav(to, { replace: true });
    } catch (e) {
      setErr(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6" data-testid="login-page">
      <h1 className="masthead-serif text-5xl">{t("loginTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("noAccount")}{" "}
        <Link to="/register" className="link-sweep font-semibold" data-testid="link-to-register">
          {t("register")}
        </Link>
      </p>

      <form onSubmit={submit} className="mt-10 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            data-testid="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t("password")}</Label>
          <Input
            id="password"
            data-testid="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="rounded-sm"
          />
        </div>
        {err && <p className="text-sm text-rahi-red" data-testid="login-error">{err}</p>}
        <Button
          type="submit"
          disabled={busy}
          className="w-full rounded-sm bg-rahi-ink text-white hover:bg-rahi-red"
          data-testid="login-submit-btn"
        >
          {busy ? "…" : t("loginTitle")}
        </Button>
        <p className="text-center text-sm">
          <Link to="/forgot-password" className="link-sweep text-muted-foreground" data-testid="link-to-forgot">
            Forgot password?
          </Link>
        </p>
      </form>
    </div>
  );
}
