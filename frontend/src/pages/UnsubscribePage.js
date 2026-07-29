import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [status, setStatus] = useState("idle"); // idle | verified | done | invalid | busy
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    api
      .get(`/newsletter/verify?token=${encodeURIComponent(token)}`)
      .then((r) => {
        setEmail(r.data.email);
        setStatus("verified");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  const unsubscribe = async () => {
    setStatus("busy");
    try {
      await api.post("/newsletter/unsubscribe", { token });
      setStatus("done");
    } catch {
      setStatus("invalid");
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6" data-testid="unsubscribe-page">
      <h1 className="masthead-serif text-5xl">Unsubscribe</h1>
      {status === "invalid" && (
        <p className="mt-8 border border-border p-6 text-sm" data-testid="unsub-invalid">
          This link isn't valid — the address may already be removed.
        </p>
      )}
      {(status === "verified" || status === "busy") && (
        <div className="mt-8 border border-border p-6" data-testid="unsub-confirm">
          <p className="text-sm">
            Remove <strong>{email}</strong> from the Rahi Bangla daily briefing?
          </p>
          <div className="mt-6 flex gap-3">
            <Button
              onClick={unsubscribe}
              disabled={status === "busy"}
              className="rounded-sm bg-rahi-red text-white hover:bg-rahi-ink"
              data-testid="unsub-confirm-btn"
            >
              {status === "busy" ? "…" : "Yes, unsubscribe"}
            </Button>
            <Link to="/" className="self-center text-sm link-sweep">Keep me subscribed</Link>
          </div>
        </div>
      )}
      {status === "done" && (
        <p className="mt-8 border border-border p-6 text-sm" data-testid="unsub-done">
          You've been unsubscribed. Sorry to see you go.
        </p>
      )}
    </div>
  );
}
