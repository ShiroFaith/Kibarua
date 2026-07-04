# Kibarua

**Kibarua** ("casual work" in Swahili) is a gig-work marketplace that connects
Kenya's informal workforce with employers. Workers build a profile, browse and
apply to jobs, message employers, get skill-matched recommendations, and manage
earnings; employers post jobs, review applicants, hire, pay, and leave reviews.

The platform is a **static HTML/CSS/JS frontend** talking to a **Node.js + Express
REST API** backed by **SQLite**.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Demo accounts](#demo-accounts)
- [API reference](#api-reference)
- [Data model](#data-model)
- [Frontend pages](#frontend-pages)
- [Conventions](#conventions)
- [Troubleshooting](#troubleshooting)
- [Known limitations & roadmap](#known-limitations--roadmap)

---

## Features

**For workers**
- Register / login with JWT sessions
- Rich profile (headline, bio, skills, languages, hourly rate, photo upload)
- Browse & search jobs with filters (category, budget, location, experience, remote)
- One-click apply with a cover letter and bid
- Skill-based job recommendations with match scores
- Messaging with employers
- Wallet, transactions, invoices and withdrawal requests
- Ratings & reviews received, with the ability to respond

**For employers**
- Business profile
- Post, list and delete jobs
- View applicants per job and hire
- Mark engagements complete
- Rate hired workers
- Wallet & payments
- Notifications for proposals, messages, reviews and payments

**Shared**
- Notifications centre (read / read-all / delete / clear)
- Role-aware dashboard with live stats
- Contact / support form

---

## Tech stack

| Layer     | Technology                                                        |
| --------- | ----------------------------------------------------------------- |
| Frontend  | Static HTML, CSS, vanilla JavaScript (ES modules), Font Awesome   |
| Backend   | Node.js ≥ 18, Express 4                                            |
| Database  | SQLite via `better-sqlite3` (synchronous, WAL mode)               |
| Auth      | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` password hashing     |
| Security  | `helmet`, `cors`, `express-rate-limit`                             |
| Uploads   | `multer` (avatars / documents on local disk)                      |
| Logging   | `morgan`                                                           |

---

## Repository layout

```
kibarua/
├── README.md                  ← you are here
├── frontend/                  ← static site (served by Apache / any static host)
│   ├── index.html  about.html  contact.html
│   ├── css/style.css
│   ├── js/            main.js, auth.js
│   ├── assets/js/     api-service.js, auth-module.js, auth-examples.js
│   ├── pages/auth/    login.html, register.html, forgot_password.html
│   └── dashboard/     dashboard.html, post-job.html, search.html,
│                      worker-profile.html, messages.html, notifications.html,
│                      payments.html, reviews.html, recommendations.html
└── backend/                   ← REST API (Node + Express + SQLite)
    ├── README.md              ← backend-specific quick start
    ├── package.json
    ├── .env.example
    └── src/
        ├── server.js          boot: ensure schema, listen, graceful shutdown
        ├── app.js             express wiring (helmet, cors, json, static, routes)
        ├── config/            env-driven config
        ├── db/                connection, schema.sql, migrate, seed, applySchema
        ├── middleware/        auth (JWT), upload (multer), errorHandler
        ├── routes/            one router per resource, aggregated in index.js
        ├── controllers/       request handlers per resource
        ├── models/            userModel (other resources query the db directly)
        ├── services/          provisioning (profile+wallet), notifications
        └── utils/             response envelope, ApiError, token, password, helpers
```

---

## Architecture

### Request lifecycle

```
Browser (frontend)
   │  fetch  http://localhost:5050/api/<resource>/<action>
   ▼
Express app.js
   │  helmet → cors → json/urlencoded → morgan → static(/uploads)
   ▼
routes/index.js  →  routes/<resource>Routes.js
   │  requireAuth / optionalAuth (JWT)  →  controller
   ▼
controllers/<resource>Controller.js
   │  validate → query SQLite (better-sqlite3) → build response
   ▼
utils/response.js  →  { success, message, data, ...extra }
```

### Response envelope

Every endpoint returns a consistent JSON shape. The frontend checks
`success` rather than HTTP status codes.

```jsonc
// success
{ "success": true, "message": "OK", "data": { /* ... */ }, "pagination": { /* lists */ } }
// error
{ "success": false, "message": "Human readable reason", "errors": { "field": "why" } }
```

- Detail objects live under `data` (e.g. `data.job`, `data.user`).
- Lists put rows under `data` (or `data.<name>`) and pagination at the top level:
  `pagination: { total, page, limit, total_pages }`.

### Authentication

- On login/registration the API returns a **JWT** (7-day default lifetime).
- The token payload contains `user_id`, `id`, `sub`, `email`, `role` (several
  frontend pages decode it client-side, so `user_id` must be present).
- Send it **either** way - both are accepted:
  - Header: `Authorization: Bearer <token>`
  - Query string: `?token=<token>` (used by pages that avoid CORS preflight)
- The frontend stores the token under `token`, `jwt_token` **and** `authToken`
  in `localStorage` so every page authenticates regardless of which key it reads.

### Route aliases

Every route is registered twice - plain and `.php`-suffixed
(`/auth/login` **and** `/auth/login.php`) - so the API matches the frontend
clients inherited from the platform's PHP prototype.

---

## Getting started

This walks through a **clean setup on a brand-new PC** (Windows, macOS or Linux).

### 0. Prerequisites

Install these first:

| Tool | Version | Check | Get it |
| --- | --- | --- | --- |
| **Git** | any | `git --version` | https://git-scm.com/downloads |
| **Node.js + npm** | Node **18+** (tested on 24) | `node -v` && `npm -v` | https://nodejs.org (LTS) |
| **A static file server** | any | - | Python 3 (built-in), VS Code "Live Server", Apache, or Nginx |

`better-sqlite3` (the database driver) ships prebuilt binaries for common
platforms, so no compiler is normally needed. If `npm install` tries to build it
from source, install your OS build tools:

- **Windows:** `npm install --global windows-build-tools` (or install "Desktop
  development with C++" via Visual Studio Build Tools)
- **macOS:** `xcode-select --install`
- **Debian/Ubuntu:** `sudo apt-get install -y build-essential python3`

### 1. Get the code

```bash
git clone https://github.com/ShiroFaith/Kibarua.git
cd Kibarua
```

### 2. Start the backend (API)

```bash
cd backend
npm install                   # install dependencies (node_modules is NOT in the repo)
cp .env.example .env          # create your local config (Windows: copy .env.example .env)
# open .env and set a strong JWT_SECRET (see note below)
npm start                     # → http://localhost:5050
```

Generate a strong secret and paste it into `.env` as `JWT_SECRET=...`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Database:** this repository **ships with a ready, pre-seeded SQLite database**
at `backend/data/kibarua.sqlite`, so the app has demo data immediately - you do
**not** have to seed anything. To start clean or if the file is missing, run:

```bash
npm run db:reset              # drop + recreate schema, then seed demo data
```

Verify the API is up:

```bash
curl http://localhost:5050/api/health      # → {"success":true,"message":"Kibarua API is running",...}
```

Backend scripts:

| Script             | Purpose                                          |
| ------------------ | ------------------------------------------------ |
| `npm start`        | Run the API (auto-creates the schema on boot)    |
| `npm run dev`      | Run with `--watch` auto-reload                   |
| `npm run migrate`  | Apply schema (`npm run migrate -- --fresh` drops the DB first) |
| `npm run seed`     | Wipe + reseed demo data                          |
| `npm run db:reset` | `migrate --fresh` then `seed`                    |

### 3. Serve the frontend

The frontend is plain static files - serve the **`frontend/`** folder with any
static server. Pick one:

```bash
# Option A - Python (already on most machines), from the repo root:
cd frontend && python3 -m http.server 5500
#   → open http://localhost:5500/index.html      (Windows: py -m http.server 5500)

# Option B - VS Code: install the "Live Server" extension, open the frontend/
#   folder, click "Go Live"   → http://127.0.0.1:5500/

# Option C - Apache/Nginx: point a virtual host / docroot at frontend/, e.g. with
#   the repo under the web root you'd browse http://localhost/kibarua/frontend/index.html
```

Then open the site, click **Sign Up** or **Login**, and use the demo accounts
below.

### 4. Point the frontend at the backend (only if host/port differ)

The frontend calls the API at **`http://localhost:5050`** by default. If your
backend runs on a different host or port, update every reference in one command:

```bash
# from the repo root - replace the old base with your backend's URL
grep -rl "http://localhost:5050" frontend | xargs sed -i 's#http://localhost:5050#http://YOUR_HOST:PORT#g'
#   (macOS sed: use  sed -i ''  instead of  sed -i)
```

Then make sure the origin you serve the frontend from (e.g. `http://localhost:5500`)
is included in **`CORS_ORIGINS`** in `backend/.env`, and restart the backend.

### Common setup pitfalls

- **`EADDRINUSE :5050`** - another process owns the port. Change `PORT` in
  `.env`, then re-point the frontend (step 4).
- **Login works but data doesn't load / CORS errors** - add your frontend origin
  to `CORS_ORIGINS` in `.env` and restart the backend.
- **Opening pages via `file://`** - won't work (fetch + relative paths need a
  server). Always serve `frontend/` over http (step 3).

---

## Configuration

Backend configuration is read from `backend/.env` (see `.env.example`):

| Variable           | Default                          | Description                                        |
| ------------------ | -------------------------------- | -------------------------------------------------- |
| `PORT`             | `5050`                           | Port the API listens on                            |
| `NODE_ENV`         | `development`                    | `development` \| `production`                       |
| `JWT_SECRET`       | dev placeholder                  | **Change in production** - signs access tokens      |
| `JWT_EXPIRES_IN`   | `7d`                             | Token lifetime (`15m`, `1h`, `7d`, …)              |
| `CORS_ORIGINS`     | localhost + Live Server ports    | Comma-separated allow-list (`*` allows any, dev)   |
| `DATABASE_FILE`    | `./data/kibarua.sqlite`          | SQLite file path (relative to `backend/`)          |
| `UPLOAD_DIR`       | `./uploads`                      | Where uploaded files are stored                    |
| `MAX_UPLOAD_BYTES` | `5242880` (5 MB)                 | Max upload size                                     |

> **Port note:** the project defaults to `5050` because `5000` is frequently
> taken by other dev tools. Keep the backend port and the frontend API base in sync.

---

## Demo accounts

Seeded by `npm run seed`. All share the password **`Password123`**.

| Email                | Role     | Notes                                            |
| -------------------- | -------- | ------------------------------------------------ |
| `employer@demo.test` | employer | Has jobs, applicants and reviews                 |
| `worker@demo.test`   | worker   | John Otieno - saved jobs, an active conversation |
| `faith@demo.test`    | worker   | Has reviews, a hiring and a payout               |
| `admin@demo.test`    | admin    | Administrator                                    |

---

## API reference

Base URL: `http://localhost:5050/api`. **Auth** column: 🔒 required, 🔓 optional,
- public. Every path also accepts a `.php` suffix.

### Auth - `/auth`
| Method | Path                 | Auth | Body / notes                                  |
| ------ | -------------------- | ---- | --------------------------------------------- |
| POST   | `/register`          | -    | `full_name, email, password, role[, phone]`   |
| POST   | `/login`             | -    | `email, password`                             |
| POST   | `/logout`            | -    | Stateless acknowledgement                     |
| GET    | `/me`, `/profile`    | 🔒   | Current user                                  |
| POST   | `/change-password`   | 🔒   | `current_password, new_password`              |
| POST   | `/verify-email`      | -    | `token`                                       |
| POST   | `/forgot-password`   | -    | `email` (dev returns the reset token)         |
| POST   | `/verify-reset-token`| -    | `token`                                       |
| POST   | `/reset-password`    | -    | `token, password`                             |

### Jobs - `/jobs`
| Method | Path        | Auth | Notes                                        |
| ------ | ----------- | ---- | -------------------------------------------- |
| POST   | `/create`   | 🔒   | Employers only                               |
| GET    | `/my-jobs`  | 🔒   | Employer's own jobs                          |
| GET    | `/` `/list` | 🔓   | Public list (`?category`, `?q`, pagination)  |
| GET    | `/get?id=`  | 🔓   | Job detail (also `GET /jobs/:id`)            |
| DELETE | `/delete?id=` | 🔒 | Owner/admin                                  |
| POST   | `/save?id=` | 🔒   | Bookmark a job                               |
| GET    | `/saved`    | 🔒   | Bookmarked jobs                              |

### Applications - `/applications`
| Method | Path         | Auth | Notes                                          |
| ------ | ------------ | ---- | ---------------------------------------------- |
| POST   | `/apply`     | 🔒   | Workers only (`job_id, cover_letter, bid_amount`) |
| GET    | `/mine`      | 🔒   | Worker's applications                          |
| GET    | `/job?job_id=` | 🔒 | Applicants for an employer's job              |
| GET    | `/hirings`   | 🔒   | Engagements (role-aware, `has_reviewed` flag)  |
| POST   | `/hire`      | 🔒   | `application_id` → creates a hiring            |
| POST   | `/complete`  | 🔒   | `hiring_id` → completes engagement **and settles payment** (credits worker wallet, records transaction + paid invoice) |
| POST   | `/status`    | 🔒   | Update an application's status                  |

### Worker profile - `/worker-profile`
| Method | Path       | Auth | Notes                                            |
| ------ | ---------- | ---- | ------------------------------------------------ |
| GET    | `/get`     | 🔒   | Own profile (flattened user + profile)           |
| POST   | `/update`  | 🔒   | **multipart/form-data**; `profile_photo` upload; skills/languages/certifications as JSON strings |
| GET    | `/view?id=`| 🔓   | Public worker profile                            |

### Employer profile - `/employer-profile`
| Method | Path       | Auth | Notes                             |
| ------ | ---------- | ---- | --------------------------------- |
| GET    | `/get`     | 🔒   | Own business profile              |
| POST   | `/update`  | 🔒   | `company_name, description, business_type, phone` |
| GET    | `/view?id=`| 🔓   | Public employer profile           |

### Messages - `/messages`
| Method | Path             | Auth | Notes                                             |
| ------ | ---------------- | ---- | ------------------------------------------------- |
| GET    | `/conversations` | 🔒   | Threads with `other_user_name`, `unread_count`    |
| GET    | `/thread?conversation_id=` | 🔒 | Messages (marks addressed messages read)   |
| POST   | `/send`          | 🔒   | `message` + `conversation_id` **or** `recipient_id` |

### Notifications - `/notifications`
| Method | Path         | Auth | Notes                                     |
| ------ | ------------ | ---- | ----------------------------------------- |
| GET    | `/` `/list`  | 🔒   | Paginated (`?page`, `?limit`)             |
| GET    | `/stats`     | 🔒   | Unread counts by type                     |
| POST   | `/read`      | 🔒   | `notification_id`                         |
| POST   | `/read-all`  | 🔒   | Mark all read                             |
| DELETE | `/delete`    | 🔒   | `notification_id` (also `POST`)           |
| DELETE | `/clear`     | 🔒   | Delete all (also `POST`)                  |

### Payments - `/payments`
| Method | Path                | Auth | Notes                                             |
| ------ | ------------------- | ---- | ------------------------------------------------- |
| GET    | `/wallet`           | 🔒   | Balance & totals                                  |
| GET    | `/methods`          | 🔒   | Saved payment methods                             |
| POST   | `/method/add`       | 🔒   | `method_type, provider, last_four, is_default`    |
| GET    | `/transactions`     | 🔒   | `?type=all\|sent\|received`, paginated            |
| GET    | `/invoices`         | 🔒   | `?type=all\|sent\|received`, paginated            |
| POST   | `/withdraw/request` | 🔒   | `amount, payment_method_id` (min 100, ≤ balance)  |

### Reviews - `/reviews`
| Method | Path       | Auth | Notes                                                   |
| ------ | ---------- | ---- | ------------------------------------------------------- |
| GET    | `/worker`  | 🔓   | Reviews about a user (`?user_id`, `?type=worker\|employer`) |
| GET    | `/stats`   | 🔓   | Averages + rating breakdown                             |
| POST   | `/submit`  | 🔒   | `reviewee_id, rating, review_type` + sub-ratings        |
| POST   | `/respond` | 🔒   | Reviewee replies (`review_id, response`)                |
| POST   | `/helpful` | 🔒   | `review_id, is_helpful` (one vote per user)             |
| POST   | `/dispute` | 🔒   | Flag a review (`review_id, reason, description`)         |

### Search - `/search`
| Method | Path           | Auth | Notes                                                  |
| ------ | -------------- | ---- | ------------------------------------------------------ |
| GET    | `/filters`     | 🔓   | Category / duration / location option lists            |
| GET    | `/suggestions` | 🔓   | Autocomplete (`?q`, `?limit`)                           |
| GET    | `/jobs`        | 🔓   | Job search (`q, category, budget_min/max, sort_by, …`) |
| GET    | `/workers`     | 🔓   | Worker search                                          |
| GET    | `/global`      | 🔓   | Combined jobs + workers                                |

### Recommendations - `/recommendations`
| Method | Path        | Auth | Notes                                        |
| ------ | ----------- | ---- | -------------------------------------------- |
| GET    | `/get`      | 🔒   | Skill-matched jobs with `match_score`        |
| GET    | `/stats`    | 🔒   | Totals, viewed %, average/best match         |
| POST   | `/generate` | 🔒   | (Re)build recommendations for the worker     |

### Dashboard - `/dashboard`
| Method | Path        | Auth | Notes                               |
| ------ | ----------- | ---- | ----------------------------------- |
| GET    | `/stats`    | 🔒   | Role-aware summary for the cards    |
| GET    | `/activity` | 🔒   | Recent notifications                 |

### Other
| Method | Path             | Auth | Notes                          |
| ------ | ---------------- | ---- | ------------------------------ |
| POST   | `/contact/submit`| -    | Public form (rate-limited)     |
| GET    | `/health`        | -    | Liveness probe                 |

---

## Data model

SQLite schema (`backend/src/db/schema.sql`). All timestamps are stored as
`datetime('now')` text; JSON arrays (skills, required_skills, attachments) are
stored as text and parsed by the API.

```
users ─┬─1:1─ worker_profiles           (role = worker)
       ├─1:1─ employer_profiles         (role = employer)
       ├─1:1─ wallets
       ├─1:n─ payment_methods
       └─1:n─ notifications

jobs ──┬─ belongs to → users (employer)
       ├─1:n─ applications ── worker → users
       ├─1:n─ hirings       ── worker/employer → users
       └─1:n─ saved_jobs / recommendations

hirings ─1:n─ reviews ─┬─1:n─ review_votes
                        └─1:n─ review_disputes

transactions / invoices / withdrawals ── payer/payee/issuer/recipient → users
conversations ─1:n─ messages
search_terms · saved_searches · contact_messages
```

| Table                | Purpose                                             |
| -------------------- | --------------------------------------------------- |
| `users`              | Accounts, roles, verification & reset tokens        |
| `worker_profiles`    | Worker details, skills, rating cache                |
| `employer_profiles`  | Business details, rating cache                      |
| `jobs`               | Job postings, budget, status, counters              |
| `applications`       | Proposals (unique per job+worker)                   |
| `hirings`            | Engagements linking employer+worker+job             |
| `conversations`      | 1:1 threads (canonical participant order)           |
| `messages`           | Chat messages, read flags, attachments              |
| `notifications`      | Typed in-app notifications                          |
| `reviews`            | Ratings + sub-ratings + responses                   |
| `review_votes`       | Helpful / unhelpful votes                           |
| `review_disputes`    | Flagged reviews                                     |
| `wallets`            | Balance and lifetime totals                         |
| `payment_methods`    | Cards / mobile money / bank                         |
| `transactions`       | Money movement ledger                               |
| `invoices`           | Issued invoices                                     |
| `withdrawals`        | Payout requests                                     |
| `saved_jobs`         | Worker bookmarks                                    |
| `recommendations`    | Skill-matched jobs with score & reason              |
| `saved_searches`     | Persisted search filters                            |
| `search_terms`       | Popularity data for autocomplete                    |
| `contact_messages`   | Public contact-form submissions                     |

---

## Frontend pages

| Page                              | Backend usage                                          |
| --------------------------------- | ------------------------------------------------------ |
| `index.html` / `about.html`       | Static marketing pages                                 |
| `contact.html`                    | Contact form                                           |
| `pages/auth/login.html`           | `POST /auth/login`, stores JWT, redirects to dashboard |
| `pages/auth/register.html`        | `POST /auth/register`                                  |
| `pages/auth/forgot_password.html` | `POST /auth/forgot-password` + reset                   |
| `dashboard/dashboard.html`        | JWT auth, `/dashboard/stats`, jobs, applications, profiles, reviews, change-password |
| `dashboard/post-job.html`         | `/jobs/create`, `/jobs/my-jobs`, `/jobs/delete`        |
| `dashboard/search.html`           | `/search/filters`, `/search/suggestions`, `/search/jobs\|workers\|global` |
| `dashboard/worker-profile.html`   | `/worker-profile/get`, `/worker-profile/update`        |
| `dashboard/messages.html`         | `/messages/conversations`, `/thread`, `/send`          |
| `dashboard/notifications.html`    | `/notifications/*`                                     |
| `dashboard/payments.html`         | `/payments/*`                                          |
| `dashboard/reviews.html`          | `/reviews/*`                                           |
| `dashboard/recommendations.html`  | `/recommendations/*`, `/jobs/save`                     |

---

## Conventions

- **Be liberal in what you accept**: controllers accept several field-name
  variants (`full_name`/`name`, `message`/`message_body`) and read the token from
  header, query or body.
- **Integers, not booleans, on the wire** for `is_read` / `is_default` - the
  frontend does strict `=== 1` / `=== 0` comparisons.
- **Amounts are raw numbers**; the frontend formats currency. Dates are
  `Date`-parseable strings.
- **Idempotent boot**: `schema.sql` uses `CREATE TABLE IF NOT EXISTS`, so the
  server applies it on every start; a fresh DB is created automatically.
- **New user provisioning**: registering creates the role profile + a wallet in
  one transaction.

---

## Troubleshooting

| Symptom                                   | Fix                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `EADDRINUSE :5050` on start               | Another process owns the port - change `PORT` in `.env` (and the frontend API base) |
| Frontend calls fail with CORS errors      | Add the serving origin to `CORS_ORIGINS` in `.env`, restart           |
| `401 Authentication required`             | Not logged in / token expired - log in again                          |
| Login succeeds but pages stay logged out  | Ensure you logged in via `pages/auth/login.html` (it stores the token under all keys) |
| `Cannot open database … directory` errors | Run `npm run db:reset` (creates `data/`) or start the server once      |
| Uploaded images don't display             | The API serves them from `/uploads`; confirm the backend is reachable |

---

## Known limitations & roadmap

- Email delivery is not wired up - verification and password-reset tokens are
  returned in the API response in development instead of emailed.
- Payments settle **internally** on job completion (wallet credit + transaction + paid invoice); there is no external payment-gateway / M-Pesa integration and withdrawals are recorded as pending requests only.
- Real-time messaging/notifications use polling, not WebSockets.
- `dashboard/dashboard.html` has been migrated to the API; the older standalone
  feature pages (search, reviews, payments, …) remain point solutions that hit
  the same backend.
- Suggested next steps: pagination on the browse/search dashboard views,
  server-sent events for live updates, and an admin moderation UI for disputes.
