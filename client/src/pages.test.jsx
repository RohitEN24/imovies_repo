import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, Protected } from "./auth";
import { Discover, AuthPage, Checkout } from "./pages";
import { money } from "./api";
const response = (data) => ({ ok: true, status: 200, json: async () => data });
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("formats money in paise", () => expect(money(25000)).toBe("₹250"));
it("movie search sends filters and renders API results", async () => {
  fetch.mockImplementation(async (url) =>
    response(
      url.includes("theatres")
        ? []
        : {
            items: [
              {
                _id: "m1",
                title: "Test Orbit",
                genres: ["Sci-Fi"],
                language: "English",
                durationMinutes: 120,
                certificate: "U/A",
                color: "#563367",
              },
            ],
            total: 1,
          },
    ),
  );
  render(
    <MemoryRouter>
      <Discover />
    </MemoryRouter>,
  );
  expect(
    await screen.findByRole("heading", { name: "Test Orbit" }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText("Search for a movie…"), {
    target: { value: "Orbit" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  await waitFor(() =>
    expect(fetch.mock.calls.some(([url]) => url.includes("q=Orbit"))).toBe(
      true,
    ),
  );
  expect(screen.getByRole("link", { name: /Test Orbit/ })).toHaveAttribute(
    "href",
    expect.stringContaining("/movies/m1"),
  );
});
it("movie listing displays server errors", async () => {
  fetch.mockRejectedValue(new Error("Connection unavailable"));
  render(
    <MemoryRouter>
      <Discover />
    </MemoryRouter>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Connection unavailable",
  );
});
it("protected page redirects unauthenticated users", async () => {
  fetch.mockResolvedValue({
    ok: false,
    status: 401,
    json: async () => ({ message: "Sign in" }),
  });
  render(
    <MemoryRouter initialEntries={["/protected"]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/protected"
            element={
              <Protected>
                <p>Private</p>
              </Protected>
            }
          />
          <Route path="/login" element={<p>Sign in screen</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByText("Sign in screen")).toBeInTheDocument();
  expect(screen.queryByText("Private")).not.toBeInTheDocument();
});
it("login submits credentials and navigates home", async () => {
  fetch.mockImplementation(async (url) =>
    url.endsWith("/me")
      ? { ok: false, status: 401, json: async () => ({ message: "Sign in" }) }
      : response({ user: { name: "Tester", role: "user", id: "1" } }),
  );
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/" element={<p>Movie home</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "test@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/Password/), {
    target: { value: "Password123!" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in ↗" }));
  expect(await screen.findByText("Movie home")).toBeInTheDocument();
  expect(
    JSON.parse(
      fetch.mock.calls.find(([url]) => url.endsWith("/login"))[1].body,
    ),
  ).toEqual({ email: "test@example.com", password: "Password123!" });
});
it("checkout clearly labels demo payment and routes confirmation", async () => {
  const booking = {
    _id: "b1",
    status: "held",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    amount: 25000,
    seats: ["A1"],
    show: {
      movie: { title: "Orbit" },
      theatre: { name: "Central" },
      startsAt: new Date(Date.now() + 86400000).toISOString(),
    },
  };
  fetch.mockImplementation(async (url) =>
    response(url.endsWith("pay-demo") ? { status: "confirmed" } : { booking }),
  );
  render(
    <MemoryRouter initialEntries={["/checkout/b1"]}>
      <Routes>
        <Route path="/checkout/:id" element={<Checkout />} />
        <Route path="/tickets/:id" element={<p>Confirmed ticket</p>} />
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByText("DEMO PAYMENT")).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: /Simulate successful payment/ }),
  );
  expect(await screen.findByText("Confirmed ticket")).toBeInTheDocument();
});
it("expired checkout does not offer payment", async () => {
  fetch.mockResolvedValue(
    response({
      booking: {
        status: "held",
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        seats: ["A1"],
        amount: 25000,
        show: {
          _id: "s1",
          movie: { title: "Orbit" },
          theatre: { name: "Central" },
          startsAt: new Date().toISOString(),
        },
      },
    }),
  );
  render(
    <MemoryRouter initialEntries={["/checkout/b1"]}>
      <Routes>
        <Route path="/checkout/:id" element={<Checkout />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(
    await screen.findByText(/This booking is expired/),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Simulate successful/ }),
  ).not.toBeInTheDocument();
});
it("payment failure routes to booking history", async () => {
  fetch.mockImplementation(async (url) =>
    response(
      url.endsWith("pay-demo")
        ? { status: "failed" }
        : {
            booking: {
              status: "held",
              expiresAt: new Date(Date.now() + 60000).toISOString(),
              seats: ["A1"],
              amount: 25000,
              show: {
                movie: { title: "Orbit" },
                theatre: { name: "Central" },
                startsAt: new Date().toISOString(),
              },
            },
          },
    ),
  );
  render(
    <MemoryRouter initialEntries={["/checkout/b1"]}>
      <Routes>
        <Route path="/checkout/:id" element={<Checkout />} />
        <Route path="/bookings" element={<p>Booking history</p>} />
      </Routes>
    </MemoryRouter>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Simulate payment failure" }),
  );
  expect(await screen.findByText("Booking history")).toBeInTheDocument();
});
it("user accounts cannot enter admin routes", async () => {
  fetch.mockResolvedValue(
    response({ user: { id: "1", name: "User", role: "user" } }),
  );
  render(
    <MemoryRouter>
      <AuthProvider>
        <Protected admin>
          <p>Admin controls</p>
        </Protected>
      </AuthProvider>
    </MemoryRouter>,
  );
  expect(
    await screen.findByText("Administrator access required."),
  ).toBeInTheDocument();
  expect(screen.queryByText("Admin controls")).not.toBeInTheDocument();
});
