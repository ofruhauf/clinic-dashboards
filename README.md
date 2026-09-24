# Agave Health — Growth Dashboard

A browser-based dashboard for Agave Health's Horizon growth, sessions, and
revenue metrics. No backend or database — you upload the Horizon D2C
tracking workbook and the dashboard updates entirely in your browser. The
uploaded data stays on your machine (saved to `localStorage`) so it's still
there next time you open the page.

This dashboard has one source of truth: the practice's own Horizon tracking
workbook (specifically its **"Users Tracking"** tab). It replaced an earlier
version of this app built around claims exports, a registered-users export,
and a sessions CRM export from separate systems — that whole pipeline has
been retired in favor of this single, more complete workbook.

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

1. Open the app and drop in the Horizon tracking workbook (`.xlsx`). Only
   its **"Users Tracking"** tab is read — the workbook's other tabs (Weekly
   Summary, High Level Daily, OB Flow, Queries, TEMP, etc.) are ignored.
   Each upload **replaces** whatever was loaded before — this workbook is a
   fresh full export every time you pull it, not something to merge
   row-by-row with a previous upload.
2. The **Horizon** tab (the primary/default tab) shows hero stats in this
   order: registered patients, patients treated, sessions, revenue, new
   patients. Click **Customize stats** (top right of the stat row) to show
   or hide any of these cards.

   **"Horizon sessions by month"** (stacked Evaluation / Coaching / Therapy)
   sits side by side with **"Registered patient growth"** (cumulative
   registrations, from each user's Creation Date). Further down, **"Revenue
   by month"**, **"New patients per month"**, and **"Engaged (in-care)
   patient growth"** (cumulative patients who've had a coaching or therapy
   session) round out the page.

   **"Revenue by month" and "New patients per month" both show a projected
   run-rate for the real, currently in-progress calendar month** — a dashed
   gray segment stacked on top of that month's actual bar, sized so the
   full bar height is what the month is on pace to reach by its end (simple
   run-rate math: actual-to-date ÷ fraction of the month elapsed so far). It
   only appears on the month matching today's real date, and only while
   that month isn't yet complete; every other month shows just its actual
   total. This is a pace projection, not a forecast — it doesn't account for
   seasonality, a slow start, or a busy end of month.
3. **Investor View** is a share-ready pitch page: a headline ("From 6
   sessions in Jul 2026 to 85 in Sep 2026"), hero stats (ARR run-rate,
   revenue growth MoM, revenue to date, patient LTV to date, registered
   patients), the cumulative-revenue chart side by side with the
   registered-patient-growth chart, a year-end ARR projection callout,
   supporting monthly-revenue and engaged-patient-growth charts, and a
   pipeline/expansion section. Unlike the Horizon tab it always shows the
   *entire* history (not the date-range filter) — a pitch is the whole
   story, not a filtered slice. A **Download as PDF** button (header,
   visible on this tab) calls the browser's print dialog with a stylesheet
   that hides all app chrome, so "Save as PDF" produces a clean page ready
   to attach to an email or drop into a deck. Its growth stats compare
   complete months only — the current calendar month counts once at least
   70% of it has elapsed, otherwise it's excluded so an early-month partial
   total can't understate (or overstate) the story.

   **Customize stats**, next to Download as PDF, opens a checklist of every
   hero stat the page currently knows how to compute — check one to show
   it, uncheck to hide it (the "Customize stats" control itself, and
   whatever you hide, never appear in the printed/PDF version). Choices are
   saved per browser (`localStorage`) and remembered the next time you open
   the page. There's no way to add a *new kind* of stat this way — only
   show/hide the ones already built into the app (see
   `src/pages/HorizonView.tsx` and `src/pages/InvestorView.tsx` for the full
   catalog, or ask for a new one to be added to it).

   A few constants at the top of `src/pages/InvestorView.tsx` drive facts
   the spreadsheet can't express on its own — edit these directly as the
   real story changes:
   - `EOY_ARR_TARGET` — a stated year-end ARR goal; the page computes and
     discloses the sustained month-over-month growth rate that goal implies
     from the latest known month, rather than presenting the target as if
     it were independently forecast.
   - `ORGANIC_NOTE` — a short freeform note (e.g. "100% organic, zero
     marketing spend") shown under the headline.

   **Patient LTV** is deliberately *not* a projected lifetime figure — it's
   total revenue to date ÷ patients treated, labeled "to date" everywhere it
   appears. A true projected LTV (revenue rate × expected average patient
   retention) needs an observed or assumed retention period, which isn't
   something the data can support yet while most patients are still in
   active treatment.
4. Use **Upload files** (header, top right) to load a fresher export of the
   workbook at any time — it replaces the dataset currently shown, it
   doesn't merge with it. **Clear** removes all stored data and returns to
   the upload screen.

### Sharing the dashboard with someone else

The app has no backend and no login — data lives only in the browser that
uploaded it, so opening the live URL on a different computer shows an empty
upload screen, not your data. To share what you're seeing with a co-founder
or colleague:

1. Click **Share with someone** (header, top right) — it downloads a
   `.json` snapshot file containing everything currently loaded.
2. Send them that file (email, Slack, AirDrop, whatever).
3. They open the same dashboard URL and drop the file into the upload
   panel, exactly like the workbook itself. It loads instantly into an
   identical dashboard — same numbers, same charts, no upload of the
   original workbook required.

There's no shared/live view; each side's data is a separate copy in their
own browser until the next snapshot or workbook upload is exchanged.

### The "Users Tracking" tab

The tab has an unusual shape: two header rows (row 1 marks the start column
of each month block with a real date; row 2 names the five columns within
each block — App Opened, Time in App (Hours), Coaching Sessions, Therapy
Sessions, Value), a third "summary" row carrying aggregate/average formulas
rather than a real user (skipped), and then one real row per registered
user. The set of month blocks grows by one every time the workbook is
re-exported for a new month — the parser detects block positions from the
header rows every time rather than hardcoding them.

| Column | Required |
|---|---|
| Creation Date (col A) | yes — a real date; rows without one are skipped |
| UserID (col B) | yes — opaque hashed ID, no display name anywhere on this tab |
| Service Selected (col C) | no — `evaluation`, `coaching`, or `therapy` |
| App Opened (per month block) | no — Yes/No |
| Time in App (Hours) (per month block) | no |
| Coaching Sessions (per month block) | no |
| Therapy Sessions (per month block) | no |
| Value (per month block) | no — dollars recognized that month |

Nothing else on this tab is read, and `UserID` has no display name attached
anywhere in it — the best PHI posture of any source this dashboard has used.

**Methodology notes:**

- **Evaluation sessions** aren't tracked as a monthly count in the
  workbook — each user whose `Service Selected` is "evaluation" counts as
  exactly one evaluation session, dated to their Creation Date (their
  intake).
- **"Patients treated" / "engaged in care"** means a user has Coaching
  Sessions > 0 or Therapy Sessions > 0 in at least one tracked month.
- **Revenue** is the `Value` column summed across users and months — the
  dollar value recognized in the workbook, not independently-verified
  insurance claims data.
- There's no forward-looking/scheduled data in this workbook, so there's no
  "booked pipeline" or "upcoming sessions" figure anywhere in this version
  of the dashboard.

## Tech

Vite + React + TypeScript, [Recharts](https://recharts.org) for charts,
[SheetJS](https://sheetjs.com) for parsing the uploaded spreadsheet
client-side. No server, no analytics, no external network calls — the file
you upload never leaves your browser.
