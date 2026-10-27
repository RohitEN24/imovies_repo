# iMovies — MERN cinema booking system

A runnable full-stack project with MongoDB, Express, React, Node.js, Bootstrap and Socket.IO. Includes user/admin authentication, movie discovery, show scheduling, timed seat holds, simulated payments, tickets, cancellation, notifications and an admin dashboard.

**Payment scope:** this is a complete local demonstration with **simulated payments and refunds**. It does not charge real money. No bank or card information is collected. A real gateway integration is required before commercial use; production explicitly refuses demo payments.

## Requirements

- Node.js 22.12+ (Node 24 recommended), npm 10+.
- Docker Desktop for the included MongoDB setup, **or** a MongoDB Atlas connection string.
- MongoDB must be a replica set because seat allocation, payment and cancellation use multi-document transactions. A standalone `mongod` will not work for bookings.

## Quick start

Run these commands from the extracted `imovies` folder:

```bash
npm ci
cp server/.env.example server/.env
cp client/.env.example client/.env
```

On Windows PowerShell, use `Copy-Item` instead of `cp` if needed.

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste it into `JWT_SECRET` in `server/.env`. Choose your own `SEED_ADMIN_PASSWORD` and `SEED_USER_PASSWORD` (at least 10 characters). The application intentionally rejects the placeholder JWT secret.

Start MongoDB and wait for its health check:

```bash
docker compose up -d --wait
```

Alternatively set `MONGODB_URI` to your Atlas URI in `server/.env`; URL-encode special characters in database credentials. For Atlas, configure a database user and your IP allowlist.

Seed an **empty database**, then start both applications:

```bash
npm run seed
npm run dev
```

Open **http://localhost:5173**. Express runs at **http://localhost:5000**.

Demo logins after seeding:

| Role  | Email                                         | Password                   |
| ----- | --------------------------------------------- | -------------------------- |
| Admin | `admin@imovies.local` (or `SEED_ADMIN_EMAIL`) | Your `SEED_ADMIN_PASSWORD` |
| User  | `user@imovies.local`                          | Your `SEED_USER_PASSWORD`  |

You can also register new user accounts through the UI. Registration never accepts an admin role. Seed creates fictional movies, two screens in Bengaluru and 32 shows over the next four days. It refuses to overwrite existing users or movies. Add later shows through the admin panel when the seed dates pass.

## Try the full flow

1. Browse movies. Search by title and combine genre, language, city, theatre and date filters.
2. Open a movie, pick a future show, sign in and choose up to eight seats.
3. Continue to payment: the server atomically holds those seats for five minutes.
4. Open the same show in another browser session to see held seats update live.
5. Simulate payment success or failure. Success creates a ticket; failure releases the seats.
6. Use **My tickets** for upcoming/past bookings, payment retry on a live hold, ticket details and cancellation.
7. Use **Updates** for in-app booking notifications.
8. Sign in as admin to create, read, edit and archive movies, theatres/screens and shows, and view paginated booking logs and summary metrics.

Prices in admin forms use rupees; **API and database amounts are integer paise**. All displayed showtimes and date filters use **Asia/Kolkata**. The admin datetime input uses the operator's local timezone and converts to UTC before submission.

## Commands

| Command           | Purpose                                              |
| ----------------- | ---------------------------------------------------- |
| `npm run dev`     | Run React/Vite and Express with reload               |
| `npm run seed`    | Create demo users and catalogue in an empty database |
| `npm test`        | Backend unit and database integration tests          |
| `npm run test:ui` | React component/navigation tests                     |
| `npm run build`   | Build frontend into `client/dist`                    |
| `npm start`       | Start the API only                                   |
| `npm run format`  | Format source and documentation                      |

The integration suite starts a temporary single-node MongoDB replica set automatically. Its first run downloads a MongoDB binary (about 82 MB); it does not use or delete your application database. Firewall/antivirus restrictions can block this download. See [docs/TESTING.md](docs/TESTING.md) for coverage and verification results.

## Project layout

```text
imovies/
  client/
    src/
      main.jsx             Routes, app shell and error boundary
      auth.jsx             Session context and route protection
      api.js               Credentialed API client and formatters
      components.jsx       Navigation, posters, requests and pagination
      pages.jsx            Discovery, login, seats, checkout and tickets
      admin.jsx            Admin dashboard and CRUD forms
      styles.css           Responsive styling and print layout
      pages.test.jsx       UI tests
  server/
    src/
      app.js               Express middleware, API routes and errors
      index.js             Database, Socket.IO, expiry worker and startup
      config.js            Validated environment configuration
      validation.js        Strict request schemas
      models/index.js      All eight MongoDB collections and indexes
      middleware/security.js
      routes/              Auth, catalogue, bookings and admin controllers
      services/booking.js  Transactional holds, payment, cancellation, expiry
      services/catalog.js  Show scheduling and inventory generation
      seed.js
    tests/                 Backend unit and integration tests
  docs/
    API.md
    ARCHITECTURE.md
    TESTING.md
  docker-compose.yml
  package-lock.json
```

## Security and integrity

- bcryptjs password hashing, short-lived JWTs in HttpOnly cookies, current database role checks, and token-version invalidation on logout (signs out other sessions too).
- SameSite cookies, origin validation for writes, strict input schemas, bounded request sizes, escaped search patterns, Helmet headers, API/auth rate limits and structured logs with cookie redaction.
- Transactions protect seat allocation and state transitions. Client prices are never accepted. A duplicate payment request does not create another payment.
- Booking ownership is verified on every ticket, checkout, cancellation and payment request.
- Admin deletion archives records to preserve booking/financial references. Booking DELETE means cancellation; financial history is never erased by a customer request.
- Catalogue edits with future shows and show edits with active bookings are blocked. Screen overlaps include a 20-minute turnaround buffer.

## Deployment and extension

This source is designed to run locally or on a Node host with MongoDB. It has not been deployed for you.

For a deployed setup, build React and serve `client/dist` from a static host or reverse proxy with SPA fallback. Proxy `/api` and `/socket.io` (including WebSocket upgrades) to Express; `npm start` serves the API only. Set `CLIENT_ORIGIN` to the exact browser origin and use HTTPS. If hosting API separately, set `VITE_API_URL` before building and keep both origins on the same site for SameSite cookies.

Production payment integration is intentionally an explicit extension: implement a gateway order service, verify signed server-to-server webhooks, reconcile provider event IDs idempotently, bind provider orders to server-calculated amounts and users, and implement real refund settlement. Do not simply allow the demo endpoint in production.

For multiple API processes, replace Socket.IO's in-memory adapter with a shared adapter, coordinate expiry workers, and move rate-limit counters into a shared store. Configure Express `trust proxy` only for your actual trusted proxy topology. Add email verification/password recovery if needed. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for invariants, query tradeoffs and scaling boundaries.

## Troubleshooting

- **Transactions require a replica set:** use the Docker configuration or Atlas. Wait until MongoDB is healthy before seeding.
- **Sign-in cookie missing:** use `localhost` consistently for both apps. Do not mix `127.0.0.1` with `localhost`. In production secure cookies require HTTPS.
- **No shows:** seed times are relative to when seeding ran; create fresh shows in admin.
- **409 when editing:** remove future shows before changing movie/theatre records; a show with active bookings cannot be edited or archived.
- **Payment says hold expired:** choose seats again. Expired holds become available immediately in server validation and are cleaned up in the background.
- **Port in use:** change `PORT`, the frontend proxy in `client/vite.config.js`, and `CLIENT_ORIGIN` if changing the frontend port.
