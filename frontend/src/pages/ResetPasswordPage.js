import React, { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api, formatApiError } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const nav = useNavigate();

  const [status, setStatus] = useState("checking"); // checking | valid | invalid | success
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    api
      .get(`/auth/reset-password/verify?token=${encodeURIComponent(token)}`)
      .then((res) => {
        setEmail(res.data.email);
        setStatus("valid");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setStatus("success");
      toast.success("Password updated.");
      setTimeout(() => nav("/login"), 1500);
    } catch (e) {
      setErr(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6" data-testid="reset-password-page">
      <h1 className="masthead-serif text-5xl">Reset password</h1>

      {status === "checking" && (
        <p className="mt-8 text-muted-foreground" data-testid="reset-checking">Verifying link…</p>
      )}

      {status === "invalid" && (
        <div className="mt-8 border border-border p-6" data-testid="reset-invalid">
          <p className="text-sm">
            This reset link is invalid or expired. Please request a new one.
          </p>
          <Link to="/forgot-password" className="mt-4 inline-block link-sweep text-sm font-semibold">
            Request new link →
          </Link>
        </div>
      )}

      {status === "success" && (
        <p className="mt-8 border border-border p-6 text-sm" data-testid="reset-success">
          Password updated. Redirecting to sign in…
        </p>
      )}

      {status === "valid" && (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            For account <strong>{email}</strong>
          </p>
          <form onSubmit={submit} className="mt-10 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="pw">New password</Label>
              <Input
                id="pw"
                data-testid="reset-password"
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpw">Confirm password</Label>
              <Input
                id="cpw"
                data-testid="reset-confirm"
                type="password"
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="rounded-sm"
              />
            </div>
            {err && <p className="text-sm text-rahi-red" data-testid="reset-error">{err}</p>}
            <Button
              type="submit"
              disabled={busy}
              className="w-full rounded-sm bg-rahi-ink text-white hover:bg-rahi-red"
              data-testid="reset-submit-btn"
            >
              {busy ? "…" : "Update password"}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
