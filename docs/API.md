# API reference

Base URL: `http://localhost:5000/api`. Send JSON bodies. Authentication uses a `session` HttpOnly cookie; use `credentials: 'include'` from browser clients. All amounts are integer **paise**, currency INR. Date filters use Asia/Kolkata; ISO timestamps in storage use UTC.

## Authentication

| Method | Endpoint         | Body / result                                   |
| ------ | ---------------- | ----------------------------------------------- |
| POST   | `/auth/register` | `{name,email,password}` → `{user}`; 201         |
| POST   | `/auth/login`    | `{email,password}` → `{user}`                   |
| GET    | `/auth/me`       | Current `{user}`                                |
| POST   | `/auth/logout`   | Invalidate user's JWT versions and clear cookie |

Passwords require 10–72 characters and at most 72 UTF-8 bytes. Public registration rejects role assignment. User responses contain `id`, `name`, `email`, `role` only. Auth endpoints allow 30 requests per IP per 15 minutes; the general API limit is 300 per IP per minute.

## Public catalogue

| Method | Endpoint      | Parameters / result                                                          |
| ------ | ------------- | ---------------------------------------------------------------------------- |
| GET    | `/filters`    | Active catalogue `{genres,languages}`                                        |
| GET    | `/movies`     | `q`, `genre`, `language`, `location`, `theatre`, `date`, `page`, `limit`     |
| GET    | `/movies/:id` | Active movie details                                                         |
| GET    | `/theatres`   | Active theatre screens, up to 200                                            |
| GET    | `/shows`      | `movie`, `theatre`, `location`, `date`, `page`, `limit`; future active shows |
| GET    | `/shows/:id`  | `{show,seats}` with populated movie/theatre                                  |
| GET    | `/health`     | Service liveness and payment mode                                            |

`date` is YYYY-MM-DD. `movie` and `theatre` are database IDs. `q` is literal case-insensitive title substring search. Filters are combined, including theatre and location.

Public movie/show and customer booking lists return `{items,total,page,pages}`. Admin lists return `{items,total,page}`. Lists default to 12 records with a maximum `limit` of 50, unless a separate cap is specified.

## Customer bookings and notifications

All routes below require sign-in. Ownership is checked on every resource access.

| Method | Endpoint                  | Body / result                                             |
| ------ | ------------------------- | --------------------------------------------------------- |
| POST   | `/bookings`               | `{show:"<showId>",seats:["A1","A2"]}` → held booking; 201 |
| GET    | `/bookings`               | Own history; `period=upcoming` or `past`, `page`, `limit` |
| GET    | `/bookings/:id`           | Own `{booking,payment}`                                   |
| POST   | `/bookings/:id/pay-demo`  | `{outcome:"success"}` or `{outcome:"failure"}`            |
| POST   | `/bookings/:id/cancel`    | Cancel booking, release seats, record any demo refund     |
| DELETE | `/bookings/:id`           | Cancellation alias; preserves financial history           |
| GET    | `/notifications`          | Own notification array; `page`, `limit`                   |
| PATCH  | `/notifications/:id/read` | Mark own notification read                                |

Seat selection allows 1–8 unique labels. The server calculates prices and rejects extra client-supplied fields. Seat conflicts return 409 and roll back all requested seats. A hold lasts five minutes by default. Expired holds cannot be paid. Failed demo payment ends the booking and releases its seats. Repeated successful payment requests are idempotent.

Booking updates are lifecycle transitions, not arbitrary modification of seat labels or prices. To change seats, cancel and create a new booking. Confirmed bookings can be cancelled until the configured cutoff (default 60 minutes before showtime). Cancelling a held booking releases it immediately. Demo refunds never move real money.

## Administration

All routes below require the current database role to be `admin`.

| Method      | Endpoint              | Behaviour                                                        |
| ----------- | --------------------- | ---------------------------------------------------------------- |
| GET, POST   | `/admin/movies`       | List / create                                                    |
| PUT, DELETE | `/admin/movies/:id`   | Full validated update / archive                                  |
| GET, POST   | `/admin/theatres`     | List / create screen                                             |
| PUT, DELETE | `/admin/theatres/:id` | Full validated update / archive                                  |
| GET, POST   | `/admin/shows`        | List / schedule and generate seats                               |
| PUT, DELETE | `/admin/shows/:id`    | Full validated update / archive                                  |
| GET         | `/admin/bookings`     | Paginated log with populated user/show                           |
| GET         | `/admin/stats`        | Catalogue counts, future shows, confirmed bookings, demo revenue |

Movie create/update body:

```json
{
  "title": "The Last Orbit",
  "synopsis": "A space engineer receives a signal from a lost spacecraft.",
  "genres": ["Sci-Fi", "Adventure"],
  "language": "English",
  "durationMinutes": 138,
  "certificate": "U/A",
  "releaseDate": "2026-10-27T00:00:00.000Z",
  "poster": "",
  "color": "#734cba",
  "active": true
}
```

`poster` may be empty or an HTTPS image URL. Theatre create/update body:

```json
{
  "name": "iMovies Central",
  "location": "Bengaluru",
  "address": "Central Avenue",
  "screen": "Screen 1",
  "rows": 6,
  "columns": 10,
  "active": true
}
```

Rows and columns must each be 1–20. A theatre document represents one screen. Show create/update body (substitute actual database IDs):

```json
{
  "movie": "<movieId>",
  "theatre": "<theatreId>",
  "startsAt": "2027-01-20T13:30:00.000Z",
  "price": 25000
}
```

Show end time includes movie runtime and a 20-minute turnover buffer. Overlapping shows on a screen are rejected. Movie/theatre edits require no future active shows; show edits/archival require no held/confirmed bookings. Archival preserves historical references.

## Socket.IO

Connect to the API origin, or the same-origin Vite proxy in development.

- Emit `show:join` with a show ID to receive a fresh snapshot and join its room.
- Emit `show:leave` with that ID when leaving.
- Listen for `seats:updated`: `{show,seats:[{label,status,expiresAt}]}`.
- Status values are `available`, `held`, `booked`. No customer or booking IDs are broadcast.
- Rejoin after reconnect. The server sends a fresh snapshot; HTTP booking validation is authoritative.

## Error responses

Errors return `{message}`. Validation errors additionally contain `{errors:{formErrors,fieldErrors}}`.

| Status | Meaning                                                                                                  |
| ------ | -------------------------------------------------------------------------------------------------------- |
| 400    | Invalid body, ID, filters or date                                                                        |
| 401    | Missing, expired or invalidated session                                                                  |
| 403    | Wrong role or cross-origin write                                                                         |
| 404    | Missing resource or another user's booking                                                               |
| 409    | Duplicate record, seat conflict, expired hold, blocked state transition, overlap or protected admin edit |
| 429    | Rate limit exceeded                                                                                      |
| 503    | Demo payments disabled and no live payment provider configured                                           |

## curl example

```bash
curl -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"email":"user@imovies.local","password":"YOUR_SEED_USER_PASSWORD"}' \
  http://localhost:5000/api/auth/login

curl -b cookies.txt http://localhost:5000/api/bookings
```
