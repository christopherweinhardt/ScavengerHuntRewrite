import { Link, Navigate, Outlet, useNavigate } from "react-router-dom";
import { clearAdminSession, isConfigured } from "@/lib/session";

export function AppLayout() {
  const navigate = useNavigate();

  if (!isConfigured()) {
    return <Navigate to="/login" replace />;
  }

  function signOut() {
    clearAdminSession();
    navigate("/login", { replace: true });
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 24px",
          borderBottom: "1px solid var(--border)",
          background: "var(--panel)",
        }}
      >
        <Link to="/" style={{ fontWeight: 700, fontSize: 18 }}>
          Scavenger Hunt Admin
        </Link>
        <button type="button" className="btn btn-secondary btn-small" onClick={signOut}>
          Sign out
        </button>
      </header>
      <main style={{ padding: 24, flex: 1, maxWidth: 960, width: "100%", margin: "0 auto" }}>
        <Outlet />
      </main>
    </div>
  );
}
