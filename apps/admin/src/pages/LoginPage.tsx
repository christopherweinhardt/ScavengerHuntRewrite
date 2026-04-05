import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { isConfigured, setAdminKey, setApiBaseUrl } from "@/lib/session";

const defaultBase =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  "http://localhost:3000";

export function LoginPage() {
  const navigate = useNavigate();
  const [baseUrl, setBase] = useState(defaultBase);
  const [key, setKey] = useState("");
  const [err, setErr] = useState("");

  if (isConfigured()) {
    return <Navigate to="/" replace />;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const k = key.trim();
    if (!k) {
      setErr("Enter your admin API key.");
      return;
    }
    const b = baseUrl.trim().replace(/\/$/, "");
    if (!b) {
      setErr("Enter API base URL.");
      return;
    }
    setApiBaseUrl(b);
    setAdminKey(k);
    navigate("/", { replace: true });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 420 }}>
        <h1 style={{ marginTop: 0, fontSize: 24 }}>Admin sign-in</h1>
        <p className="muted" style={{ marginBottom: 16 }}>
          The admin key is a secret — same value as <code>ADMIN_API_KEY</code> on the server.
          Do not expose this dashboard to the public internet without extra protection.
        </p>
        <div className="warn">
          Stored in session storage for this browser tab only. Closing the tab clears it.
        </div>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="base">API base URL</label>
            <input
              id="base"
              value={baseUrl}
              onChange={(e) => setBase(e.target.value)}
              autoComplete="off"
              placeholder="http://localhost:3000"
            />
          </div>
          <div className="field">
            <label htmlFor="key">Admin API key</label>
            <input
              id="key"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="off"
            />
          </div>
          {err ? <p className="error">{err}</p> : null}
          <button type="submit" className="btn" style={{ width: "100%", marginTop: 8 }}>
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
