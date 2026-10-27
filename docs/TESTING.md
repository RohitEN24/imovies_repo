# Testing and verification

## Automated checks

Run from the repository root:

```bash
npm ci
npm test
npm run test:ui
npm run build
npm audit --omit=dev
```

The backend suite uses isolated disposable MongoDB replica sets. No application database is touched. The first run downloads MongoDB 7.0.24. The tests disable Unix sockets and diagnostic collection for compatibility with restricted development environments; the production application configuration is unaffected.

## Coverage

| Area              | Checks                                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication    | Register, login, incorrect password, HttpOnly/SameSite cookies, logout token invalidation, duplicate emails, admin escalation rejection                                   |
| Authorization     | Admin route protection, booking ownership, notification ownership, cross-origin write rejection                                                                           |
| Rate limiting     | Auth request limit enforced with an isolated limiter per test fixture                                                                                                     |
| Movie CRUD        | Create, read, full update, archive; multilingual catalogue insertion                                                                                                      |
| Theatre/show CRUD | Layout generation, update, archival, screen overlap rejection and active-booking guards                                                                                   |
| Search            | Combined title/genre/language/location/theatre filters, mismatched filters, invalid dates and IST show dates                                                              |
| Seat holds        | Simultaneous competing requests, partial-conflict rollback, duplicate/nonexistent/over-limit seats                                                                        |
| Payments          | Server-authoritative pricing, success, failure, duplicate submission, ownership and expired holds                                                                         |
| Cancellation      | Idempotency, seat release, simulated refund and cutoff rejection                                                                                                          |
| Expiry            | Cleanup preserves seats reclaimed by a newer booking                                                                                                                      |
| History           | Pagination, upcoming/past server-side filters and user scoping                                                                                                            |
| Live events       | Public payload privacy; actual Socket.IO join and hold/booked/available broadcasts                                                                                        |
| Runtime           | Real seed script, actual Express startup, HTTP login, real WebSocket connection, payment and cancellation                                                                 |
| Frontend          | Search/filter request, result navigation, error display, unauthenticated redirect, login submission, admin guard, payment success/failure navigation and expired checkout |
| Build             | Vite production compilation                                                                                                                                               |
| Dependencies      | Production dependency audit                                                                                                                                               |

## Verification recorded with this delivery

- Backend: **27 tests passed**, including the actual-server Socket.IO smoke test.
- Frontend: **9 tests passed** using React Testing Library and Vitest.
- Frontend production build: **passed**.
- Production dependency audit: **0 reported vulnerabilities** at verification time. Re-run regularly; advisories change.

A browser binary could not be downloaded in the execution environment, so pixel-level browser visual QA and device testing were not completed. Responsive breakpoints and accessible navigation are implemented, but the automated component tests do not establish browser layout correctness. Use the checklist below on your machine.

## Manual browser checklist

- [ ] At 375 px, 768 px and desktop widths, navigation, filters, cards, forms and tables are usable.
- [ ] Twenty-column layouts scroll inside the seat panel without stretching the page.
- [ ] Keyboard focus is visible and seat buttons announce availability and selected state.
- [ ] Open a show in two separate sessions. Hold seats in one and confirm that the other updates.
- [ ] Disconnect and reconnect the browser; joining a room returns a fresh seat snapshot.
- [ ] Wait for hold expiry; seats can be reclaimed and the old booking cannot pay.
- [ ] Confirm a demo payment, inspect the ticket, print it, then cancel before cutoff.
- [ ] Attempt admin access as a user and another user's ticket URL; access is denied.
- [ ] Test admin create/edit/archive interactions and validation messages with your actual catalogue.
- [ ] Verify your HTTPS/reverse-proxy cookie, CORS and WebSocket configuration before deployment.
