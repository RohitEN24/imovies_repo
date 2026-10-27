import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles.css";
import { AuthProvider, Protected } from "./auth";
import { Nav } from "./components";
import {
  Discover,
  MovieDetails,
  AuthPage,
  SeatSelection,
  Checkout,
  Ticket,
  Bookings,
  Notifications,
} from "./pages";
import Admin from "./admin";
class Boundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="container section empty">
        <h1>Something went wrong.</h1>
        <button
          className="btn btn-primary"
          onClick={() => window.location.assign("/")}
        >
          Return to movies
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function App() {
  return (
    <Boundary>
      <BrowserRouter>
        <AuthProvider>
          <a className="skip-link" href="#main-content">
            Skip to content
          </a>
          <Nav />
          <div id="main-content">
            <Routes>
              <Route path="/" element={<Discover />} />
              <Route path="/movies/:id" element={<MovieDetails />} />
              <Route path="/login" element={<AuthPage />} />
              <Route
                path="/shows/:id/seats"
                element={
                  <Protected>
                    <SeatSelection />
                  </Protected>
                }
              />
              <Route
                path="/checkout/:id"
                element={
                  <Protected>
                    <Checkout />
                  </Protected>
                }
              />
              <Route
                path="/tickets/:id"
                element={
                  <Protected>
                    <Ticket />
                  </Protected>
                }
              />
              <Route
                path="/bookings"
                element={
                  <Protected>
                    <Bookings />
                  </Protected>
                }
              />
              <Route
                path="/notifications"
                element={
                  <Protected>
                    <Notifications />
                  </Protected>
                }
              />
              <Route
                path="/admin"
                element={
                  <Protected admin>
                    <Admin />
                  </Protected>
                }
              />
              <Route
                path="*"
                element={
                  <main className="container section empty">
                    <h1>That scene is missing.</h1>
                    <Link to="/">Back to movies →</Link>
                  </main>
                }
              />
            </Routes>
          </div>
          <footer className="site-footer container">
            <Link className="brand" to="/">
              i<span>Movies</span>
              <i>●</i>
            </Link>
            <span>A little escape. A lot of cinema.</span>
            <small>Demo project · Payments simulated · Showtimes in IST</small>
          </footer>
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: "#262837", color: "#fff" },
              duration: 4500,
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </Boundary>
  );
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
