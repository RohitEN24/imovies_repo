export const API_ORIGIN = import.meta.env.VITE_API_URL || "";
export async function api(path, { method = "GET", body, ...options } = {}) {
  const response = await fetch(`${API_ORIGIN}/api${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...options,
  });
  const data = await response
    .json()
    .catch(() => ({ message: "The server returned an invalid response" }));
  if (!response.ok) {
    const err = new Error(
      data.errors
        ? `${data.message}: ${Object.entries(data.errors.fieldErrors || {})
            .map(([k, v]) => `${k}: ${v.join(", ")}`)
            .join("; ")}`
        : data.message || "Request failed",
    );
    err.status = response.status;
    throw err;
  }
  return data;
}
export const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount / 100);
export const dateTime = (value) =>
  new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
export const indiaDate = (value) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
