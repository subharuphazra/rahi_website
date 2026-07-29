import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth, formatApiError } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function RegisterPage() {
  const nav = useNavigate();
  const { register } = useAuth();
  const { t } = useLang();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const u = await register(email, password, name);
      toast.success(`Welcome, ${u.name}`);
      nav("/", { replace: true });
    } catch (e) {
      setErr(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6" data-testid="register-page">
      <h1 className="masthead-serif text-5xl">{t("registerTitle")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link to="/login" className="link-sweep font-semibold" data-testid="link-to-login">
          {t("login")}
        </Link>
      </p>

      <form onSubmit={submit} className="mt-10 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">{t("name")}</Label>
          <Input
            id="name"
            data-testid="register-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="rounded-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            data-testid="register-email"
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
            data-testid="register-password"
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="rounded-sm"
          />
        </div>
        {err && <p className="text-sm text-rahi-red" data-testid="register-error">{err}</p>}
        <Button
          type="submit"
          disabled={busy}
          className="w-full rounded-sm bg-rahi-ink text-white hover:bg-rahi-red"
          data-testid="register-submit-btn"
        >
          {busy ? "…" : t("registerTitle")}
        </Button>
      </form>
    </div>
  );
}
