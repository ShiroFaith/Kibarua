# Kibarua Backend

REST API for the Kibarua gig-work marketplace connecting Kenya's informal
workforce with employers. Node.js + Express + SQLite (better-sqlite3), JWT auth.

## Quick start

```bash
cd backend
npm install
cp .env.example .env          # edit JWT_SECRET for anything non-local
npm run db:reset              # create schema + seed demo data
npm start                     # → http://localhost:5050
```

Health check: `GET http://localhost:5050/api/health`

`npm run dev` starts the server with `--watch` for auto-reload.

### Scripts

| Script            | Purpose                                            |
| ----------------- | -------------------------------------------------- |
| `npm start`       | Run the API (auto-creates the schema on boot)      |
| `npm run dev`     | Run with file-watch reload                         |
| `npm run migrate` | Apply the schema (`--fresh` drops the DB first)    |
| `npm run seed`    | Wipe + reseed demo data                            |
| `npm run db:reset`| `migrate --fresh` then `seed`                      |

### Demo accounts (password `Password123`)

- `employer@demo.test` - employer (has jobs, applicants, reviews)
- `worker@demo.test` - worker
- `faith@demo.test` - worker with reviews, a hiring and a payout
- `admin@demo.test` - admin

## Architecture

```
src/
  server.js            boot: ensure schema, listen, graceful shutdown
  app.js               express wiring: helmet, cors, json, static /uploads, routes
  config/              env-driven config
  db/                  connection, schema.sql, migrate, seed, applySchema
  middleware/          auth (JWT), upload (multer), errorHandler
  routes/              one router per resource, aggregated in routes/index.js
  controllers/         request handlers per resource
  models/              userModel (other resources query the db directly)
  services/            provisioning (profiles+wallet), notifications
  utils/               response envelope, ApiError, token, password, helpers
```

### Conventions

- **Response envelope**: `{ success, message, data, ...extra }`. Lists put
  pagination in a top-level `pagination: { total, page, limit, total_pages }`.
- **Auth**: send the JWT as `Authorization: Bearer <token>` **or** `?token=`
  (many pages use the query param to avoid a CORS preflight). The token payload
  includes `user_id` (some pages decode it client-side).
- **Route aliases**: every route is also registered with a `.php` suffix
  (e.g. `/auth/login` and `/auth/login.php`) to match the frontend clients.

## API surface (all under `/api`)

| Resource        | Endpoints                                                                 |
| --------------- | ------------------------------------------------------------------------- |
| auth            | register, login, logout, me, verify-email, forgot-password, reset-password |
| jobs            | create, my-jobs, list, get, delete, save, saved                          |
| applications    | apply, mine, job, hire, status                                           |
| worker-profile  | get, update (multipart w/ photo), view                                   |
| messages        | conversations, thread, send                                             |
| notifications   | list, stats, read, read-all, delete, clear                              |
| payments        | wallet, methods, method/add, transactions, invoices, withdraw/request   |
| reviews         | worker, stats, submit, respond, helpful, dispute                        |
| search          | filters, suggestions, jobs, workers, global                            |
| recommendations | get, stats, generate                                                    |
| dashboard       | stats, activity                                                        |
| contact         | submit                                                                 |

## Frontend integration

The frontend (`../frontend`) is configured to call `http://localhost:5050`.
If you change the port, update the API base constants at the top of the
`<script>` in each dashboard page and in `assets/js/api-service.js`.
`CORS_ORIGINS` in `.env` must include the origin the frontend is served from
(defaults cover `http://localhost` and common Live Server ports).
