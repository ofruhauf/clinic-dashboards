# Agave Health — Growth Dashboard

A browser-based dashboard for Agave Health's growth, sessions, and new-patient
metrics, with a dedicated view for the Horizon account. No backend or
database — you upload an appointments export (Excel or CSV) and the dashboard
updates entirely in your browser. The uploaded data stays on your machine
(saved to `localStorage`) so it's still there next time you open the page.

## Running it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build, output in dist/
npm run preview  # preview the production build
```

The production build in `dist/` is a fully static site — deploy it to
Vercel, Netlify, GitHub Pages, or any static file host.

## Live URL (GitHub Pages)

Every push to the default branch builds and redeploys automatically via
`.github/workflows/deploy-pages.yml`. One-time setup, in the repo's GitHub
settings:

1. **Settings → Pages → Build and deployment → Source**: choose
   **GitHub Actions**.
2. The repo needs to be public (or your account/org needs a plan that
   supports Pages on private repos).

After that, the dashboard is live at
`https://<owner>.github.io/clinic-dashboards/` and updates within a minute
or two of every push — check the **Actions** tab for build/deploy status.
Note the app is served from that `/clinic-dashboards/` subpath (set via
`base` in `vite.config.ts`), so `npm run dev` / `npm run preview` locally
also serve from `/clinic-dashboards/` rather than `/`.

## Using the dashboard

1. Open the app and drop in your appointments export (`.xlsx` or `.csv`).
2. The **account view** (defaults to Horizon when present, the primary tab)
   shows sessions, revenue, patients, show-up rate, and that account's share
   of total clinic sessions over time. Use the account dropdown to switch to
   any other payer in your data.
3. **Clinic overview** (secondary tab) shows the same shape of metrics
   clinic-wide: sessions, revenue, unique/new patients, show-up rate,
   month-over-month growth, session mix by visit type, revenue by month,
   account (payer) mix, and sessions by therapist. Revenue is estimated at a
   flat **$140 per session** — there's no revenue column in the raw data, so
   this is `sessions × $140`, not a billed amount.
4. The **"Ask about your data"** box at the top answers one-off questions —
   e.g. "what is last 3 months MoM growth?", "revenue last 6 months",
   "Horizon show-up rate" — with a short text answer and, where a trend
   applies, a small chart. It's a lightweight local pattern matcher (metric +
   time range + optional account name), not a general-purpose LLM: it
   recognizes sessions, revenue, new/active/cumulative patients, show-up
   rate, and growth ("MoM", "month over month"), combined with a time phrase
   ("last N months", "this/last month", "year to date", "all time", a named
   month) and an optional account name (or "clinic" for clinic-wide). Leave
   out a metric, time range, or scope and it falls back to the current tab's
   filters. Nothing is sent anywhere — it runs entirely against the data
   already in your browser.
5. Use **Replace data** to upload a new export at any time — it fully
   replaces the current dataset. **Clear** removes the stored data and
   returns to the upload screen.

### Expected columns

The parser matches headers case-insensitively and tolerates a few common
variants. At minimum it needs a patient name and an appointment date:

| Column | Aliases | Required |
|---|---|---|
| `user` | patient | yes |
| `scheduledFor` | scheduled, date | yes |
| `title` | visitType | no (defaults to "Unspecified") |
| `therapist` | provider | no (defaults to "Unassigned") |
| `insurance` | account, payer | no (blank = "Self-pay / Other") |
| `showUp` | | no (Yes/No) |
| `reported` | | no (Yes/No) |
| `paymentMethod` | | no |
| `status` | | no |
| `createdAt` | | no |

Rows missing a patient name or a valid appointment date are skipped and
counted in the "rows skipped" note under the header.

"New patients" is derived from each patient's earliest appointment date in
the full dataset (or, on the account view, their earliest appointment under
that specific account) — there's no separate new/returning column required.

## Tech

Vite + React + TypeScript, [Recharts](https://recharts.org) for charts,
[SheetJS](https://sheetjs.com) for parsing the uploaded spreadsheet
client-side. No server, no analytics, no external network calls — the file
you upload never leaves your browser.
