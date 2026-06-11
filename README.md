# MHS Walk-in Team Dashboard

Custom analytics dashboard for the **MHS Walk-in Team** — pulls live data from the
existing Odoo CRM (PostgreSQL on RDS) plus the in-house `walkin.team.dashboard`
ERP method, and displays it as a familiar spreadsheet-style grid.

- **Frontend** — React 18 + Vite (built bundle served by Express)
- **Backend** — Node 20+ Express, talks to Odoo Postgres directly
- **Auth** — same Odoo credentials (verified against `res_users.password`)

---

## Quick start (5 minutes)

### 1. Prereqs
- Node.js 20 or newer (`node -v`)
- Network access to:
  - `odoo-prod-db.cz4siwieazgp.ap-south-1.rds.amazonaws.com:5432` (RDS Postgres) — your IP must be allow-listed in the RDS security group
  - `https://mhs.doneztech.com` (Odoo web)

### 2. Install
```bash
cd mhs-dashboard
npm install
```

### 3. Configure
Copy `.env.example` → `.env` and fill in. The file already in this folder has
working credentials; don't commit it.

### 4. Run
```bash
npm start            # production: serves built React from /public on :3000
# or
npm run dev          # dev: Vite hot-reload on :5173, API on :3000 (proxied)
```

### 5. Open
http://localhost:3000

Login:
- Demo: `demo@mhs.local` / `Demo@2026`
- Or any active Odoo user with the same email/password they use for `mhs.doneztech.com`

---

## Project layout

```
mhs-dashboard/
├── server/                  Express API + auth + Odoo proxy
│   ├── index.js             routes: /api/login, /api/report, /api/filters/options, /api/health
│   ├── auth.js              passlib-pbkdf2-sha512 verify against res_users.password
│   ├── db.js                pg pool (read-only RDS user)
│   ├── odoo.js              JSON-RPC client + cached fetcher for the ERP dashboard method
│   ├── queries.js           all SQL: STATUS_COLS, period/person/client/filter queries
│   └── locations.js         PIN-based Chennai / Outer Chennai / Other District classifier
├── client/                  React source
│   ├── src/
│   │   ├── App.jsx          top-level state & data fetching
│   │   ├── components/      TopBar, ControlBar, FilterBar, SavedViews,
│   │   │                     SummaryCards, DataTable, ColumnPanel, Login
│   │   ├── lib/             api.js, auth.js, columns.js, format.js
│   │   └── styles.css       all design tokens + light/dark theme
│   └── public/mhs-logo.png
├── public/                  Vite build output (committed for `npm start`)
├── scripts/                 one-off DB introspection / verification scripts
├── package.json
├── vite.config.js
├── .env                     SECRETS — never commit
└── .env.example             template for teammates
```

## How the data flows

```
Browser  ──►  GET /api/report?view=...   (cookie auth)
                       │
                       ▼
              ┌─────────────────────┐
              │  Express server     │
              │  (server/index.js)  │
              └────┬───────────┬────┘
                   │           │
       direct SQL  │           │  JSON-RPC (Odoo web)
                   ▼           ▼
        ┌──────────────┐   ┌─────────────────┐
        │ Postgres RDS │   │ mhs.doneztech.com│
        │ (Odoo DB)    │   │ walkin.team.dashboard.get_dashboard_data
        └──────────────┘   └─────────────────┘
```

Most columns come from **direct SQL** against the Odoo Postgres DB (faster, no
ERP dependency). A few headline KPIs and per-caller summaries come from the
**ERP web RPC** because the ERP's Python applies custom business logic we can't
replicate exactly in SQL.

See the comments in `server/index.js` (`view === 'period'` / `view === 'person'`
blocks) for the exact mix per column.

## Config (`.env`)

```bash
# Postgres (read-only)
PGHOST=odoo-prod-db.cz4siwieazgp.ap-south-1.rds.amazonaws.com
PGPORT=5432
PGUSER=mhs_read_only
PGPASSWORD=...
PGDATABASE=odoo
PGSSLMODE=require

# Session (any 48+ char random string — generate with `openssl rand -base64 48`)
SESSION_SECRET=...
SESSION_TTL_HOURS=12

# Optional demo bypass — remove in production
DEMO_LOGIN=demo@mhs.local
DEMO_PASSWORD=Demo@2026

# Odoo web RPC (used for the per-caller summary + a few headline KPIs)
ODOO_URL=https://mhs.doneztech.com
ODOO_DB=odoo
ODOO_SERVICE_LOGIN=...           # any Odoo user (read-only fine)
ODOO_SERVICE_PASSWORD=...
```

## Common questions

**Why do some columns show `0` or `—` ?**
- *Refund / Ads Spent / ROAS* — no data source identified in Odoo yet
- *Lead Source* — `crm_lead.source_id` is NULL on every lead (UTM tracking not wired upstream)

**Numbers don't match the ERP dashboard for one cell — what do I do?**
1. Open the lead in Odoo
2. Note which dashboard cell is wrong + the expected value
3. Open `server/queries.js` → search for that column's key (e.g. `apptD`, `loc_chennai`)
4. The SQL is right there as a `COUNT(*) FILTER (WHERE ...)` — adjust the predicate

**How do I add a new column?**
1. Add an entry to `client/src/lib/columns.js` (the `COLS` array)
2. Add the matching aggregation to `STATUS_COLS` in `server/queries.js`
3. Restart the server. No frontend rebuild needed unless you also changed JSX/CSS.

## Production checklist

- Remove `DEMO_LOGIN` / `DEMO_PASSWORD` from `.env`
- Rotate `SESSION_SECRET` and DB / Odoo passwords
- Run behind HTTPS reverse proxy (Caddy / nginx) so the auth cookie can be `Secure`
- Set `NODE_ENV=production`
- Use a process manager (PM2 / systemd) instead of `npm start` directly

## Author / contact

Built for MHS · contact your dev partner for changes.
