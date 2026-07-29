import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
      toast.success("Check your inbox.");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6" data-testid="forgot-password-page">
      <h1 className="masthead-serif text-5xl">Forgot password?</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter your email and we'll send you a link to reset it.
      </p>

      {sent ? (
        <div className="mt-10 border border-border p-6" data-testid="forgot-password-sent">
          <p className="text-sm">
            If an account exists for <strong>{email}</strong>, a reset link is on its way. The link
            will expire in 60 minutes.
          </p>
          <Link to="/login" className="mt-4 inline-block link-sweep text-sm font-semibold">
            Back to sign in →
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-10 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              data-testid="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-sm"
            />
          </div>
          <Button
            type="submit"
            disabled={busy}
            className="w-full rounded-sm bg-rahi-ink text-white hover:bg-rahi-red"
            data-testid="forgot-submit-btn"
          >
            {busy ? "…" : "Send reset link"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link to="/login" className="link-sweep">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
