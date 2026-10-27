import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "./api";
import { useAuth } from "./auth";
export function useRequest(path, key = 0) {
  const [state, set] = useState({ data: null, loading: true, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    set({ data: null, loading: true, error: "" });
    api(path, { signal: controller.signal })
      .then((data) => set({ data, loading: false, error: "" }))
      .catch((e) => {
        if (e.name !== "AbortError")
          set({ data: null, loading: false, error: e.message });
      });
    return () => controller.abort();
  }, [path, key]);
  return state;
}
export function Status({ loading, error }) {
  if (loading)
    return (
      <div role="status" className="empty">
        Getting everything ready…
      </div>
    );
  if (error)
    return (
      <div role="alert" className="alert alert-danger">
        {error}
      </div>
    );
  return null;
}
export function Pager({ page, total, limit = 12, onChange }) {
  const pages = Math.ceil(total / limit);
  return (
    pages > 1 && (
      <div className="pager">
        <button
          className="btn btn-outline-light"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          ← Previous
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button
          className="btn btn-outline-light"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next →
        </button>
      </div>
    )
  );
}
export function Poster({ movie, large = false }) {
  return (
    <div
      className={`poster ${large ? "poster-large" : ""}`}
      style={{ "--poster-color": movie.color || "#583b82" }}
    >
      {movie.poster ? (
        <img
          src={movie.poster}
          alt={`${movie.title} poster`}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <span className="poster-orbit" />
      <span className="poster-top">iMOVIES ORIGINAL COLLECTION</span>
      <div className="poster-title">
        {movie.title}
        <small>
          {movie.genres?.[0]} · {movie.language}
        </small>
      </div>
      <span className="poster-bottom">EVERY STORY DESERVES A BIG SCREEN</span>
    </div>
  );
}
export function Nav() {
  const { user, setUser } = useAuth(),
    navigate = useNavigate();
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      navigate("/");
      toast.success("Signed out");
    } catch (e) {
      toast.error(e.message);
    }
  }
  return (
    <header className="site-nav">
      <div className="container nav-inner">
        <Link className="brand" to="/">
          i<span>Movies</span>
          <i>●</i>
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/">Discover</Link>
          {user && <Link to="/bookings">My tickets</Link>}
          {user && <Link to="/notifications">Updates</Link>}
          {user?.role === "admin" && <Link to="/admin">Admin</Link>}
        </nav>
        <div className="nav-account">
          {user ? (
            <>
              <span className="username">Hi, {user.name.split(" ")[0]}</span>
              <button onClick={logout} className="btn btn-sm btn-outline-light">
                Sign out
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm">
              Sign in ↗
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
