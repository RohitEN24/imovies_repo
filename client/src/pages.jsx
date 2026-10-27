import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { api, API_ORIGIN, money, dateTime, indiaDate } from "./api";
import { useAuth } from "./auth";
import { useRequest, Status, Poster, Pager } from "./components";
export function Discover() {
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const { data, loading, error } = useRequest(`/movies?${query}`);
  const { data: theatres } = useRequest("/theatres");
  const { data: filterOptions } = useRequest("/filters");
  const [search, setSearch] = useState(params.get("q") || "");
  function filter(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next);
  }
  return (
    <>
      <section className="hero">
        <div className="hero-art">
          <div className="planet" />
          <div className="ring ring-one" />
          <div className="ring ring-two" />
          <span className="star star-one">✦</span>
          <span className="star star-two">✧</span>
        </div>
        <div className="container hero-content">
          <span className="eyebrow">LIGHTS DOWN. WORLD OFF.</span>
          <h1>
            A seat for
            <br />
            every <em>story.</em>
          </h1>
          <p>
            Big feelings. Bigger screens.
            <br />
            Find your next unforgettable movie moment.
          </p>
          <a href="#now-showing" className="btn btn-primary">
            Explore movies <span>↗</span>
          </a>
          <div className="hero-note">
            <span>◉</span> Your city. Your cinema. Your escape.
          </div>
        </div>
        <div className="hero-caption">
          THE MAGIC BEGINS HERE <span>01 / 04</span>
        </div>
      </section>
      <section className="container section" id="now-showing">
        <div className="section-heading">
          <div>
            <span className="eyebrow">YOUR NEXT PLAN, SORTED</span>
            <h2>
              Now showing<span className="accent">.</span>
            </h2>
          </div>
          <span className="muted">Make a little room for the movies.</span>
        </div>
        <form
          className="filter-bar"
          onSubmit={(e) => {
            e.preventDefault();
            filter("q", search);
          }}
        >
          <label className="search-field">
            <span className="visually-hidden">Search movies</span>
            <input
              className="form-control"
              placeholder="Search for a movie…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button className="btn btn-primary" type="submit">
            Search
          </button>
          <label>
            <span className="visually-hidden">Genre</span>
            <select
              className="form-select"
              value={params.get("genre") || ""}
              onChange={(e) => filter("genre", e.target.value)}
            >
              <option value="">All genres</option>
              {(filterOptions?.genres || []).map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="visually-hidden">Language</span>
            <select
              className="form-select"
              value={params.get("language") || ""}
              onChange={(e) => filter("language", e.target.value)}
            >
              <option value="">All languages</option>
              {(filterOptions?.languages || []).map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="visually-hidden">Location</span>
            <input
              className="form-control"
              placeholder="City / location"
              value={params.get("location") || ""}
              onChange={(e) => filter("location", e.target.value)}
            />
          </label>
          <label>
            <span className="visually-hidden">Theatre</span>
            <select
              className="form-select"
              value={params.get("theatre") || ""}
              onChange={(e) => filter("theatre", e.target.value)}
            >
              <option value="">All theatres</option>
              {theatres?.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} · {t.location}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="visually-hidden">Show date (India)</span>
            <input
              aria-label="Show date (India)"
              type="date"
              className="form-control"
              value={params.get("date") || ""}
              onChange={(e) => filter("date", e.target.value)}
            />
          </label>
          {query && (
            <button
              type="button"
              className="btn btn-link"
              onClick={() => {
                setSearch("");
                setParams({});
              }}
            >
              Clear
            </button>
          )}
        </form>
        <Status loading={loading} error={error} />
        {data && (
          <>
            <div className="movie-grid">
              {data.items.map((movie) => (
                <Link
                  className="movie-card"
                  key={movie._id}
                  to={`/movies/${movie._id}?${query}`}
                >
                  <Poster movie={movie} />
                  <div className="movie-meta">
                    <span>{movie.certificate}</span>
                    <span>{movie.durationMinutes} min</span>
                  </div>
                  <h3>{movie.title}</h3>
                  <p>
                    {movie.genres.join(" / ")} <span>·</span> {movie.language}
                  </p>
                  <div className="card-book">
                    View showtimes <span>↗</span>
                  </div>
                </Link>
              ))}
            </div>
            {data.items.length === 0 && (
              <div className="empty">
                No movies match these filters. Try a different date or language.
              </div>
            )}
            <Pager
              page={Number(params.get("page")) || 1}
              total={data.total}
              onChange={(p) => {
                const next = new URLSearchParams(params);
                next.set("page", p);
                setParams(next);
              }}
            />
          </>
        )}
        <div className="cinema-strip">
          <span className="strip-icon">✳</span>
          <div>
            <h3>Less scrolling. More cinema.</h3>
            <p>
              Pick a movie, choose your favourite seat, and make a night of it.
            </p>
          </div>
          <span className="strip-arrow">↗</span>
        </div>
      </section>
    </>
  );
}
export function MovieDetails() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [page, setPage] = useState(1);
  const { data: movie, loading, error } = useRequest(`/movies/${id}`);
  const filters = new URLSearchParams({ movie: id, page, limit: 12 });
  for (const key of ["theatre", "location", "date"])
    if (params.get(key)) filters.set(key, params.get(key));
  const {
    data: shows,
    loading: showLoading,
    error: showError,
  } = useRequest(`/shows?${filters}`);
  return (
    <main className="container section">
      <Link to="/" className="back-link">
        ← All movies
      </Link>
      <Status loading={loading} error={error} />
      {movie && (
        <>
          <div className="detail-header">
            <Poster movie={movie} large />
            <div>
              <span className="eyebrow">NOW ON THE BIG SCREEN</span>
              <h1>{movie.title}</h1>
              <p className="muted">
                {movie.certificate} · {movie.durationMinutes} min ·{" "}
                {movie.language}
              </p>
              <div className="tags">
                {movie.genres.map((g) => (
                  <span key={g}>{g}</span>
                ))}
              </div>
              <p className="synopsis">{movie.synopsis}</p>
              <p className="muted">
                Released{" "}
                {new Date(movie.releaseDate).toLocaleDateString("en-IN")}
              </p>
            </div>
          </div>
          <div className="section-heading">
            <h2>
              Find your show<span className="accent">.</span>
            </h2>
            <span className="muted">All showtimes in India Standard Time</span>
          </div>
          <Status loading={showLoading} error={showError} />
          <div className="show-list">
            {shows?.items.map((s) => (
              <article className="show-card" key={s._id}>
                <div>
                  <h3>{s.theatre.name}</h3>
                  <p>
                    {s.theatre.location} · {s.theatre.screen}
                  </p>
                  <small>{s.theatre.address}</small>
                </div>
                <div>
                  <strong>{dateTime(s.startsAt)}</strong>
                  <p className="muted">From {money(s.price)} / seat</p>
                </div>
                <Link
                  to={`/shows/${s._id}/seats`}
                  className="btn btn-outline-light"
                >
                  Choose seats ↗
                </Link>
              </article>
            ))}
          </div>
          {shows && !shows.items.length && (
            <div className="empty">
              No upcoming shows match your filters.{" "}
              <Link to={`/movies/${id}`}>See all showtimes</Link>
            </div>
          )}
          {shows && (
            <Pager page={page} total={shows.total} onChange={setPage} />
          )}
        </>
      )}
    </main>
  );
}
export function AuthPage() {
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false);
  const { setUser, user } = useAuth(),
    navigate = useNavigate(),
    location = useLocation();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await api(`/auth/${register ? "register" : "login"}`, {
        method: "POST",
        body: register ? form : { email: form.email, password: form.password },
      });
      setUser(result.user);
      navigate(location.state?.from || "/");
      toast.success(register ? "Welcome to iMovies!" : "Welcome back!");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (user)
    return (
      <main className="container section empty">
        You’re signed in. <Link to="/">Explore movies →</Link>
      </main>
    );
  return (
    <main className="auth-wrap">
      <div className="auth-story">
        <span className="eyebrow">YOUR NEXT GREAT STORY</span>
        <h1>
          Starts with
          <br />a <em>ticket.</em>
        </h1>
        <p>A world of cinema, just a few clicks away.</p>
        <span className="auth-star">✳</span>
      </div>
      <form className="panel auth-form" onSubmit={submit}>
        <h2>{register ? "Join the movie club." : "Welcome back."}</h2>
        <p className="muted">
          {register
            ? "Make movie nights a regular thing."
            : "Your favourite seat is waiting."}
        </p>
        {register && (
          <label className="form-label">
            Full name
            <input
              required
              autoComplete="name"
              maxLength={80}
              className="form-control"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
        )}
        <label className="form-label">
          Email address
          <input
            required
            type="email"
            autoComplete="email"
            maxLength={200}
            className="form-control"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label className="form-label">
          Password
          <input
            required
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            minLength={10}
            maxLength={72}
            className="form-control"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <small className="muted">At least 10 characters</small>
        </label>
        <button className="btn btn-primary w-100" disabled={busy}>
          {busy ? "Please wait…" : register ? "Create account ↗" : "Sign in ↗"}
        </button>
        <button
          type="button"
          className="btn btn-link w-100 mt-3"
          onClick={() => setRegister(!register)}
        >
          {register
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </button>
      </form>
    </main>
  );
}
export function SeatSelection() {
  const { id } = useParams(),
    navigate = useNavigate();
  const { data, loading, error } = useRequest(`/shows/${id}`);
  const [seats, setSeats] = useState([]),
    [selected, setSelected] = useState([]),
    [busy, setBusy] = useState(false),
    [connected, setConnected] = useState(false),
    [tick, setTick] = useState(Date.now());
  useEffect(() => {
    if (data) setSeats(data.seats);
  }, [data]);
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000);
    const socket = io(API_ORIGIN || window.location.origin, {
      withCredentials: true,
    });
    socket.on("connect", () => {
      setConnected(true);
      socket.emit("show:join", id);
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("seats:updated", (payload) => {
      if (payload.show === id) setSeats(payload.seats);
    });
    return () => {
      clearInterval(timer);
      socket.emit("show:leave", id);
      socket.disconnect();
    };
  }, [id]);
  const available = (s) =>
    s.status === "available" ||
    (s.status === "held" && new Date(s.expiresAt).getTime() <= tick);
  useEffect(() => {
    setSelected((old) =>
      old.filter((label) => {
        const s = seats.find((s) => s.label === label);
        return (
          s &&
          (s.status === "available" ||
            (s.status === "held" && new Date(s.expiresAt).getTime() <= tick))
        );
      }),
    );
  }, [seats, tick]);
  async function reserve() {
    setBusy(true);
    try {
      const b = await api("/bookings", {
        method: "POST",
        body: { show: id, seats: selected },
      });
      navigate(`/checkout/${b._id}`);
    } catch (e) {
      toast.error(e.message);
      try {
        const fresh = await api(`/shows/${id}`);
        setSeats(fresh.seats);
      } catch {}
    } finally {
      setBusy(false);
    }
  }
  const rows = [...new Set(seats.map((s) => s.label[0]))].sort();
  const show = data?.show;
  return (
    <main className="container section">
      <Link className="back-link" to={show ? `/movies/${show.movie._id}` : "/"}>
        ← Showtimes
      </Link>
      <Status loading={loading} error={error} />
      {show && (
        <>
          <div className="section-heading">
            <div>
              <span className="eyebrow">MAKE YOURSELF COMFORTABLE</span>
              <h1>{show.movie.title}</h1>
              <p className="muted">
                {show.theatre.name} · {show.theatre.screen} ·{" "}
                {dateTime(show.startsAt)}
              </p>
            </div>
            <span className={`live-tag ${connected ? "" : "offline"}`}>
              ● {connected ? "Live seat availability" : "Reconnecting…"}
            </span>
          </div>
          <div className="booking-layout">
            <div className="panel seat-panel">
              <div className="screen">ALL EYES THIS WAY</div>
              <div className="seat-scroll">
                <div className="seat-map">
                  {rows.map((row) => (
                    <div className="seat-row" key={row}>
                      <span className="row-label">{row}</span>
                      {seats
                        .filter((s) => s.label.startsWith(row))
                        .sort(
                          (a, b) =>
                            Number(a.label.slice(1)) - Number(b.label.slice(1)),
                        )
                        .map((s) => (
                          <button
                            key={s.label}
                            aria-label={`Seat ${s.label}, ${selected.includes(s.label) ? "selected" : available(s) ? "available" : s.status}`}
                            aria-pressed={selected.includes(s.label)}
                            disabled={
                              !available(s) ||
                              busy ||
                              (!selected.includes(s.label) &&
                                selected.length >= 8)
                            }
                            className={`seat ${selected.includes(s.label) ? "selected" : available(s) ? "" : s.status}`}
                            onClick={() =>
                              setSelected((old) =>
                                old.includes(s.label)
                                  ? old.filter((x) => x !== s.label)
                                  : [...old, s.label],
                              )
                            }
                          >
                            {s.label.slice(1)}
                          </button>
                        ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="seat-legend">
                <span>
                  <i />
                  Available
                </span>
                <span>
                  <i className="selected" />
                  Selected
                </span>
                <span>
                  <i className="held" />
                  Held
                </span>
                <span>
                  <i className="booked" />
                  Booked
                </span>
              </div>
            </div>
            <aside className="panel booking-summary">
              <span className="eyebrow">YOUR MOVIE MOMENT</span>
              <h2>Ticket summary</h2>
              <p>{show.movie.title}</p>
              <p className="muted">
                {show.theatre.location} · {show.theatre.screen}
              </p>
              <hr />
              <div className="summary-line">
                <span>Seats</span>
                <strong>{selected.join(", ") || "Choose your seats"}</strong>
              </div>
              <div className="summary-line">
                <span>Price per ticket</span>
                <strong>{money(show.price)}</strong>
              </div>
              <div className="summary-line total">
                <span>Total</span>
                <strong>{money(show.price * selected.length)}</strong>
              </div>
              <button
                className="btn btn-primary w-100"
                disabled={
                  !selected.length ||
                  busy ||
                  new Date(show.startsAt) <= new Date()
                }
                onClick={reserve}
              >
                {busy ? "Holding seats…" : "Continue to payment ↗"}
              </button>
              <small className="muted d-block mt-3">
                Select up to 8 seats. Seats are held after you continue. Server
                validation determines availability.
              </small>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
export function Checkout() {
  const { id } = useParams(),
    navigate = useNavigate();
  const { data, loading, error } = useRequest(`/bookings/${id}`);
  const [busy, setBusy] = useState(false),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const b = data?.booking,
    remaining = b
      ? Math.max(0, Math.ceil((new Date(b.expiresAt) - now) / 1000))
      : 0;
  async function pay(outcome) {
    setBusy(true);
    try {
      const result = await api(`/bookings/${id}/pay-demo`, {
        method: "POST",
        body: { outcome },
      });
      if (result.status === "confirmed") {
        toast.success("Your tickets are confirmed!");
        navigate(`/tickets/${id}`);
      } else {
        toast.error("Demo payment failed. Your seats have been released.");
        navigate("/bookings");
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function release() {
    setBusy(true);
    try {
      await api(`/bookings/${id}/cancel`, { method: "POST" });
      navigate("/bookings");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="container section narrow">
      <Status loading={loading} error={error} />
      {b && (
        <div className="panel checkout">
          <span className="eyebrow">ONE STEP FROM THE BIG SCREEN</span>
          <h1>Complete your booking.</h1>
          <h3>{b.show.movie.title}</h3>
          <p className="muted">
            {b.show.theatre.name} · {dateTime(b.show.startsAt)}
          </p>
          <p>
            Seats <strong>{b.seats.join(", ")}</strong>
          </p>
          <div className="summary-line total">
            <span>Total</span>
            <strong>{money(b.amount)}</strong>
          </div>
          {b.status === "held" && remaining > 0 ? (
            <>
              <p className="countdown" role="timer">
                Seats held for {Math.floor(remaining / 60)}:
                {String(remaining % 60).padStart(2, "0")}
              </p>
              <div className="demo-notice">
                <strong>DEMO PAYMENT</strong>
                <p>
                  This project simulates payments. No money is charged. Do not
                  enter card or bank details.
                </p>
              </div>
              <button
                className="btn btn-primary w-100"
                disabled={busy}
                onClick={() => pay("success")}
              >
                {busy
                  ? "Processing…"
                  : `Simulate successful payment · ${money(b.amount)}`}
              </button>
              <button
                className="btn btn-outline-light w-100 mt-3"
                disabled={busy}
                onClick={() => pay("failure")}
              >
                Simulate payment failure
              </button>
              <button
                className="btn btn-link w-100 mt-2"
                disabled={busy}
                onClick={release}
              >
                Cancel & release seats
              </button>
            </>
          ) : (
            <div className="empty">
              {b.status === "confirmed" ? (
                <Link to={`/tickets/${id}`}>View confirmed tickets →</Link>
              ) : (
                <>
                  This booking is {b.status === "held" ? "expired" : b.status}.{" "}
                  <Link to={`/shows/${b.show._id}/seats`}>
                    Choose seats again →
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
export function Ticket() {
  const { id } = useParams();
  const { data, loading, error } = useRequest(`/bookings/${id}`);
  const b = data?.booking;
  return (
    <main className="container section narrow">
      <Status loading={loading} error={error} />
      {b && (
        <div className="panel ticket">
          <span className="ticket-icon">
            {b.status === "confirmed" ? "✓" : "◉"}
          </span>
          <span className="eyebrow">
            {b.status === "confirmed"
              ? "YOU’RE GOING TO THE MOVIES"
              : "BOOKING DETAILS"}
          </span>
          <h1>{b.show.movie.title}</h1>
          <p className={`status-badge ${b.status}`}>{b.status}</p>
          <p>
            {b.show.theatre.name} · {b.show.theatre.screen}
          </p>
          <p className="muted">{dateTime(b.show.startsAt)}</p>
          <div className="ticket-tear" />
          <div className="ticket-data">
            <div>
              <small>SEATS</small>
              <strong>{b.seats.join(", ")}</strong>
            </div>
            <div>
              <small>TOTAL</small>
              <strong>{money(b.amount)}</strong>
            </div>
          </div>
          <p className="reference">{b.reference}</p>
          <p className="muted">
            Payment: {data.payment?.status || "Not paid"} · Demo only
          </p>
          <Link to="/bookings" className="btn btn-primary">
            My tickets ↗
          </Link>
          <button
            className="btn btn-outline-light ms-2"
            onClick={() => window.print()}
          >
            Print
          </button>
        </div>
      )}
    </main>
  );
}
export function Bookings() {
  const [page, setPage] = useState(1),
    [version, setVersion] = useState(0),
    [tab, setTab] = useState("upcoming"),
    [busy, setBusy] = useState("");
  const { data, loading, error } = useRequest(
    `/bookings?page=${page}${tab === "all" ? "" : `&period=${tab}`}`,
    version,
  );
  async function cancel(b) {
    if (
      !window.confirm(
        `Cancel booking ${b.reference}? Any demo payment will be marked refunded.`,
      )
    )
      return;
    setBusy(b._id);
    try {
      await api(`/bookings/${b._id}/cancel`, { method: "POST" });
      toast.success("Booking cancelled");
      setVersion((v) => v + 1);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy("");
    }
  }
  const effective = (b) =>
    b.status === "held" && new Date(b.expiresAt) <= new Date()
      ? "expired"
      : b.status;
  const upcoming = (b) =>
    ["confirmed", "held"].includes(effective(b)) &&
    new Date(b.show?.startsAt) > new Date();
  const items =
    data?.items.filter(
      (b) => tab === "all" || (tab === "upcoming" ? upcoming(b) : !upcoming(b)),
    ) || [];
  return (
    <main className="container section">
      <span className="eyebrow">YOUR PERSONAL BOX OFFICE</span>
      <h1>
        My tickets<span className="accent">.</span>
      </h1>
      <div className="tabs">
        {["upcoming", "past", "all"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
          >
            {t === "past" ? "Past & cancelled" : t}
          </button>
        ))}
      </div>
      <Status loading={loading} error={error} />
      <div className="show-list">
        {items.map((b) => (
          <article className="show-card" key={b._id}>
            <div>
              <span className={`status-badge ${effective(b)}`}>
                {effective(b)}
              </span>
              <h3>{b.show?.movie?.title || "Movie unavailable"}</h3>
              <p className="muted">
                {b.show?.theatre?.name} · {dateTime(b.show.startsAt)}
              </p>
              <small>
                Seats {b.seats.join(", ")} · {b.reference}
              </small>
            </div>
            <strong>{money(b.amount)}</strong>
            <div className="ticket-actions">
              <Link className="btn btn-outline-light" to={`/tickets/${b._id}`}>
                Details
              </Link>
              {effective(b) === "held" && (
                <Link className="btn btn-primary" to={`/checkout/${b._id}`}>
                  Pay
                </Link>
              )}
              {["confirmed", "held"].includes(effective(b)) &&
                new Date(b.show.startsAt) > new Date() && (
                  <button
                    className="btn btn-link"
                    disabled={!!busy}
                    onClick={() => cancel(b)}
                  >
                    {busy === b._id ? "Cancelling…" : "Cancel booking"}
                  </button>
                )}
            </div>
          </article>
        ))}
      </div>
      {data && !items.length && (
        <div className="empty">
          No {tab === "all" ? "" : tab} bookings on this page.{" "}
          <Link to="/">Find your next movie →</Link>
        </div>
      )}
      {data && <Pager page={page} total={data.total} onChange={setPage} />}
    </main>
  );
}
export function Notifications() {
  const [page, setPage] = useState(1),
    [version, setVersion] = useState(0);
  const { data, loading, error } = useRequest(
    `/notifications?page=${page}`,
    version,
  );
  async function mark(id) {
    try {
      await api(`/notifications/${id}/read`, { method: "PATCH" });
      setVersion((v) => v + 1);
    } catch (e) {
      toast.error(e.message);
    }
  }
  return (
    <main className="container section narrow">
      <span className="eyebrow">STAY IN THE LOOP</span>
      <h1>
        Your updates<span className="accent">.</span>
      </h1>
      <Status loading={loading} error={error} />
      {data?.map((n) => (
        <article className="panel notification" key={n._id}>
          <p>{n.message}</p>
          <small className="muted">{dateTime(n.createdAt)}</small>
          <div className="mt-3">
            {n.booking && (
              <Link
                to={`/tickets/${n.booking}`}
                className="btn btn-sm btn-outline-light"
              >
                Booking details
              </Link>
            )}
            {!n.read && (
              <button
                className="btn btn-sm btn-link"
                onClick={() => mark(n._id)}
              >
                Mark as read
              </button>
            )}
          </div>
        </article>
      ))}
      {data?.length === 0 && <p className="empty">You’re all caught up.</p>}
      <div className="pager">
        <button
          className="btn btn-outline-light"
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button
          className="btn btn-outline-light"
          disabled={!data || data.length < 12}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </main>
  );
}
