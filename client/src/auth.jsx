import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api } from "./api";
const Context = createContext();
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setUser((await api("/auth/me")).user);
    } catch (e) {
      if (e.status !== 401) setError(e.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  return (
    <Context.Provider value={{ user, setUser, loading, error, refresh }}>
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
export function Protected({ children, admin = false }) {
  const { user, loading, error, refresh } = useAuth(),
    location = useLocation();
  if (loading) return <p className="empty">Loading your session…</p>;
  if (error)
    return (
      <div className="empty">
        <p>{error}</p>
        <button className="btn btn-primary" onClick={refresh}>
          Retry connection
        </button>
      </div>
    );
  if (!user)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (admin && user.role !== "admin")
    return <div className="empty">Administrator access required.</div>;
  return children;
}
