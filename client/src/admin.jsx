import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { api, money, dateTime } from "./api";
import { useRequest, Status, Pager } from "./components";
const defaults = {
  movies: {
    title: "",
    synopsis: "",
    genres: "Drama",
    language: "English",
    durationMinutes: 120,
    certificate: "U/A",
    releaseDate: new Date().toISOString().slice(0, 10),
    poster: "",
    color: "#583b82",
    active: true,
  },
  theatres: {
    name: "",
    location: "",
    address: "",
    screen: "Screen 1",
    rows: 6,
    columns: 10,
    active: true,
  },
  shows: { movie: "", theatre: "", startsAt: "", price: 250 },
};
function Field({
  label,
  name,
  form,
  set,
  type = "text",
  required = true,
  min,
  max,
  options,
}) {
  return (
    <label className={`form-label ${type === "textarea" ? "wide" : ""}`}>
      {label}
      {options ? (
        <select
          required={required}
          className="form-select"
          value={form[name]}
          onChange={(e) => set({ ...form, [name]: e.target.value })}
        >
          <option value="">Choose…</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          className="form-control"
          required={required}
          minLength={10}
          maxLength={5000}
          rows={4}
          value={form[name]}
          onChange={(e) => set({ ...form, [name]: e.target.value })}
        />
      ) : (
        <input
          className="form-control"
          required={required}
          type={type}
          min={min}
          max={max}
          value={form[name]}
          onChange={(e) =>
            set({
              ...form,
              [name]:
                type === "number" ? Number(e.target.value) : e.target.value,
            })
          }
        />
      )}
    </label>
  );
}
function useOptions(path, version) {
  const [data, setData] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        let items = [],
          page = 1;
        while (true) {
          const result = await api(`${path}?limit=50&page=${page}`, {
            signal: controller.signal,
          });
          items.push(...result.items);
          if (items.length >= result.total || !result.items.length) break;
          page++;
        }
        setData({ items });
      } catch (e) {
        if (e.name !== "AbortError") toast.error(e.message);
      }
    })();
    return () => controller.abort();
  }, [path, version]);
  return { data };
}
export default function Admin() {
  const [tab, setTab] = useState("movies"),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0),
    [editing, setEditing] = useState(null),
    [form, setForm] = useState(null),
    [busy, setBusy] = useState(false);
  const { data: stats } = useRequest("/admin/stats", version);
  const { data, loading, error } = useRequest(
    `/admin/${tab}?page=${page}`,
    version,
  );
  const { data: movies } = useOptions("/admin/movies", version);
  const { data: theatres } = useOptions("/admin/theatres", version);
  function changeTab(t) {
    setTab(t);
    setPage(1);
    setForm(null);
    setEditing(null);
  }
  function edit(item) {
    setEditing(item._id);
    if (tab === "movies")
      setForm({
        title: item.title,
        synopsis: item.synopsis,
        genres: item.genres.join(", "),
        language: item.language,
        durationMinutes: item.durationMinutes,
        certificate: item.certificate,
        releaseDate: item.releaseDate.slice(0, 10),
        poster: item.poster || "",
        color: item.color,
        active: item.active,
      });
    if (tab === "theatres")
      setForm({
        name: item.name,
        location: item.location,
        address: item.address,
        screen: item.screen,
        rows: item.rows,
        columns: item.columns,
        active: item.active,
      });
    if (tab === "shows") {
      const dt = new Date(item.startsAt);
      const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setForm({
        movie: item.movie._id,
        theatre: item.theatre._id,
        startsAt: local,
        price: item.price / 100,
      });
    }
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      let body = { ...form };
      if (tab === "movies") {
        body.genres = form.genres
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        body.releaseDate = new Date(form.releaseDate).toISOString();
      }
      if (tab === "shows") {
        body.startsAt = new Date(form.startsAt).toISOString();
        body.price = Math.round(form.price * 100);
      }
      await api(`/admin/${tab}${editing ? `/${editing}` : ""}`, {
        method: editing ? "PUT" : "POST",
        body,
      });
      setForm(null);
      setEditing(null);
      setVersion((v) => v + 1);
      toast.success("Saved successfully");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(item) {
    if (
      !window.confirm(
        `Archive ${item.title || item.name || "this show"}? Historical bookings are preserved.`,
      )
    )
      return;
    setBusy(true);
    try {
      await api(`/admin/${tab}/${item._id}`, { method: "DELETE" });
      setVersion((v) => v + 1);
      toast.success("Archived");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  const f = (name, label, type = "text", extra = {}) => (
    <Field
      key={name}
      name={name}
      label={label}
      type={type}
      form={form}
      set={setForm}
      {...extra}
    />
  );
  return (
    <main className="container section">
      <span className="eyebrow">BEHIND THE SCENES</span>
      <div className="section-heading">
        <h1>
          Cinema control<span className="accent">.</span>
        </h1>
        <span className="muted">Administrator workspace</span>
      </div>
      <div className="stats-grid">
        {stats &&
          [
            ["Movies", stats.movies],
            ["Theatres", stats.theatres],
            ["Upcoming shows", stats.shows],
            ["Confirmed bookings", stats.bookings],
            ["Demo revenue", money(stats.revenue)],
          ].map(([label, value]) => (
            <div className="panel stat" key={label}>
              <small>{label}</small>
              <strong>{value}</strong>
            </div>
          ))}
      </div>
      <div className="section-heading">
        <div className="tabs">
          {["movies", "theatres", "shows", "bookings"].map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => changeTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        {tab !== "bookings" && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setForm({ ...defaults[tab] });
            }}
          >
            + Add {tab.slice(0, -1)}
          </button>
        )}
      </div>
      {form && (
        <form className="panel admin-form" onSubmit={save}>
          <div className="wide">
            <h2>
              {editing ? "Edit" : "Create"} {tab.slice(0, -1)}
            </h2>
            <p className="muted small">
              Catalogue edits are blocked while future shows reference a record.
              Show edits are blocked while active bookings exist.
            </p>
          </div>
          {tab === "movies" && (
            <>
              {f("title", "Movie title")}
              {f("language", "Language")}
              {f("synopsis", "Synopsis", "textarea")}
              {f("genres", "Genres (comma separated)")}
              {f("durationMinutes", "Duration (minutes)", "number", {
                min: 1,
                max: 600,
              })}
              {f("certificate", "Certificate")}
              {f("releaseDate", "Release date", "date")}
              {f("poster", "Poster URL (optional, HTTPS)", "url", {
                required: false,
              })}
              {f("color", "Poster accent", "color")}
            </>
          )}
          {tab === "theatres" && (
            <>
              {f("name", "Theatre name")}
              {f("location", "City / location")}
              {f("address", "Address")}
              {f("screen", "Screen name")}
              {f("rows", "Rows (A–T)", "number", { min: 1, max: 20 })}
              {f("columns", "Seats per row", "number", { min: 1, max: 20 })}
            </>
          )}
          {tab === "shows" && (
            <>
              {f("movie", "Movie", "text", {
                options:
                  movies?.items
                    .filter((m) => m.active)
                    .map((m) => ({ value: m._id, label: m.title })) || [],
              })}
              {f("theatre", "Theatre / screen", "text", {
                options:
                  theatres?.items
                    .filter((t) => t.active)
                    .map((t) => ({
                      value: t._id,
                      label: `${t.name} · ${t.screen}`,
                    })) || [],
              })}
              {f(
                "startsAt",
                "Showtime (your local timezone)",
                "datetime-local",
              )}
              {f("price", "Ticket price (₹)", "number", { min: 1, max: 10000 })}
            </>
          )}
          {tab !== "shows" && (
            <label className="form-check wide">
              <input
                className="form-check-input"
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />{" "}
              Active in catalogue
            </label>
          )}
          <div className="wide d-flex gap-3">
            <button disabled={busy} className="btn btn-primary">
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              className="btn btn-outline-light"
              onClick={() => setForm(null)}
            >
              Close
            </button>
          </div>
        </form>
      )}
      <Status loading={loading} error={error} />
      {data && (
        <>
          <div className="table-responsive panel admin-table">
            <table className="table table-dark align-middle">
              <thead>
                <tr>
                  <th>{tab === "bookings" ? "Booking" : "Name / movie"}</th>
                  <th>Details</th>
                  <th>Status</th>
                  <th className="text-end">
                    {tab === "bookings" ? "Amount" : "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item._id}>
                    <td>
                      <strong>
                        {item.title ||
                          item.name ||
                          item.show?.movie?.title ||
                          item.movie?.title}
                      </strong>
                      {tab === "bookings" && (
                        <small className="d-block muted">
                          {item.reference}
                          <br />
                          {item.user?.email}
                        </small>
                      )}
                    </td>
                    <td>
                      {tab === "movies" ? (
                        `${item.language} · ${item.durationMinutes} min`
                      ) : tab === "theatres" ? (
                        `${item.location} · ${item.screen} · ${item.rows} × ${item.columns}`
                      ) : tab === "shows" ? (
                        <>
                          {item.theatre?.name}
                          <br />
                          {dateTime(item.startsAt)} · {money(item.price)}
                        </>
                      ) : (
                        <>
                          {dateTime(item.show?.startsAt)}
                          <br />
                          Seats {item.seats.join(", ")}
                        </>
                      )}
                    </td>
                    <td>
                      <span className="status-badge">
                        {item.status || (item.active ? "Active" : "Archived")}
                      </span>
                    </td>
                    <td className="text-end">
                      {tab === "bookings" ? (
                        money(item.amount)
                      ) : (
                        <div className="d-flex gap-2 justify-content-end">
                          <button
                            disabled={busy}
                            className="btn btn-sm btn-outline-light"
                            onClick={() => edit(item)}
                          >
                            Edit
                          </button>
                          <button
                            disabled={busy || !item.active}
                            className="btn btn-sm btn-link"
                            onClick={() => remove(item)}
                          >
                            Archive
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.items.length === 0 && (
              <p className="empty">
                Nothing here yet. Add your first {tab.slice(0, -1)}.
              </p>
            )}
          </div>
          <Pager page={page} total={data.total} onChange={setPage} />
        </>
      )}
    </main>
  );
}
