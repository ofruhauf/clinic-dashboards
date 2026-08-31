# Agave Health — Growth Dashboard

A browser-based dashboard for Agave Health's growth, sessions, and revenue
metrics, with a dedicated view for the Horizon account. No backend or
database — you upload weekly claims reports (Excel or CSV) and the dashboard
updates entirely in your browser. The uploaded data stays on your machine
(saved to `localStorage`) so it's still there next time you open the page.
Revenue shown throughout the app is the actual billed amount per claim, not
an estimate.

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

1. Open the app and drop in your weekly claims report(s) (`.xlsx` or `.csv`).
   You can select or drop **multiple files at once**, and you can keep
   uploading new files over time (e.g. each week's report) — every upload
   *adds* to the existing dataset rather than replacing it. Claims are
   matched by `external_encounter_id`, so re-uploading a report that
   overlaps a previous one won't double-count those rows. If the same
   encounter shows up again with different data (e.g. a visit type or
   procedure code corrected in a later week's export), the newly uploaded
   version normally replaces the older one — with one exception: an
   encounter already recorded as a coaching claim (`procedure_code`
   `H0038`) never gets overwritten by a non-coaching version of itself,
   *no matter which file that came from or when it was uploaded*. Real
   exports show claims getting corrected to H0038 in a later report, never
   the other way around, so this protects a corrected claim from reverting
   if you happen to (re-)upload an older report afterward. These matches
   are counted as "claims updated by a later upload" in the header, whether
   or not the row's data actually changed.
2. The **account view** (defaults to Horizon when present, the primary tab)
   shows sessions, revenue, patients, and that account's share of total
   clinic sessions over time. Use the account dropdown to switch to any
   other payer in your data. (Show-up rate isn't in claims data, so it
   displays as "—".)
3. **Investor View** is a share-ready, single-account pitch page: a headline
   ("From 3 sessions in Jun 2026 to 33 in Aug 2026"), four hero stats (ARR
   run-rate, revenue growth MoM, revenue to date, time to traction), a large
   cumulative-revenue chart, a year-end ARR projection callout, supporting
   monthly-revenue / share-of-clinic-volume charts, and a pipeline/expansion
   section. Unlike the other tabs it always shows the account's *entire*
   history (not the date-range filter) — a pitch is the whole story, not a
   filtered slice. A **Download as PDF** button (header, visible on this tab)
   calls the browser's print dialog with a stylesheet that hides all app
   chrome, so "Save as PDF" produces a clean page ready to attach to an email
   or drop into a deck. Its growth stats compare complete months only — the
   current calendar month counts once at least 70% of it has elapsed,
   otherwise it's excluded so an early-month partial total can't understate
   (or overstate) the story.

   A handful of small config maps at the top of `src/pages/InvestorView.tsx`
   (keyed by account name, lowercase) drive facts the spreadsheet can't
   express on its own — edit these directly as the real story changes:
   - `ACCOUNT_LAUNCH_DATES` — story-start date, when it's later than the
     first row in the data (e.g. a pre-launch pilot session).
   - `ACCOUNT_EOY_ARR_TARGET` — a stated year-end ARR goal; the page computes
     and discloses the sustained month-over-month growth rate that goal
     implies from the latest known month, rather than presenting the target
     as if it were independently forecast.
   - `ACCOUNT_ORGANIC_NOTE` — a short freeform note (e.g. "100% organic, zero
     marketing spend") shown under the headline.
   - `PIPELINE_TARGETS` / `PIPELINE_COVERED_LIVES` — the expansion pipeline
     badges shown in the "playbook" section.
4. **Clinic overview** shows the same shape of metrics clinic-wide: sessions,
   revenue, unique/new patients, month-over-month growth, session mix by
   visit type, revenue by month, and account (payer) mix. Revenue is the
   real per-claim billed amount summed from the uploaded reports.
5. The **"Ask about your data"** box at the top answers one-off questions —
   e.g. "what is last 3 months MoM growth?", "revenue last 6 months",
   "Horizon revenue this year" — with a short text answer and, where a trend
   applies, a small chart. It's a lightweight local pattern matcher (metric +
   time range + optional account name), not a general-purpose LLM: it
   recognizes sessions, revenue, new/active/cumulative patients, show-up
   rate, and growth ("MoM", "month over month"), combined with a time phrase
   ("last N months", "this/last month", "year to date", "all time", a named
   month) and an optional account name (or "clinic" for clinic-wide). Leave
   out a metric, time range, or scope and it falls back to the current tab's
   filters. Nothing is sent anywhere — it runs entirely against the data
   already in your browser.
6. Use **Upload files** (header, top right) to add more claims reports at any
   time — new files accumulate into the existing dataset (see dedup note
   above), they don't replace it. **Clear** removes all stored data and
   returns to the upload screen.

### Sharing the dashboard with someone else

The app has no backend and no login — data lives only in the browser that
uploaded it, so opening the live URL on a different computer shows an empty
upload screen, not your data. To share what you're seeing with a co-founder
or colleague:

1. Click **Share with someone** (header, top right) — it downloads a
   `.json` snapshot file containing everything currently loaded.
2. Send them that file (email, Slack, AirDrop, whatever).
3. They open the same dashboard URL and drop the file into the upload
   panel, exactly like a claims report. It loads instantly into an
   identical dashboard — same numbers, same charts, no upload of the
   original claims files required.

The snapshot merges in by encounter ID just like any other file, so it's
safe to drop into a dashboard that already has other data loaded, and it
plays nicely with re-uploading it later. To keep someone in sync going
forward, either re-share an updated snapshot after each week's upload, or
just have both people upload the same weekly claims reports independently —
both approaches produce the same result. There's no shared/live view; each
side's data is a separate copy in their own browser until the next
snapshot or file is exchanged.

### Expected columns

The parser is built for weekly claims/billing exports and matches headers
case-insensitively (spaces/underscores/hyphens are ignored), so
`date_of_service` and `Date Of Service` both resolve the same way. Only a
subset of the ~115 columns a real claims export can contain are read —
everything else (diagnosis codes, date of birth, address, and other PHI) is
ignored, so no more than necessary ends up sitting in browser storage.

| Column | Required |
|---|---|
| `external_encounter_id` | no, but strongly recommended — without it, rows can't be deduped across uploads |
| `external_patient_id` | yes — stable patient identity |
| `date_of_service` (`DD/MM/YYYY`) | yes |
| `patient_first_name` / `patient_last_name` | yes (display name) |
| `charge_amount_cents` | no (defaults to $0 if missing) |
| `payer_name` | no (blank or `patient_self_pay` = Yes → "Self-pay") |
| `patient_self_pay` (Yes/No) | no |
| `appointment_name` | no (visit type — eval, therapy, coaching, etc.; defaults to "Unspecified") |
| `procedure_code` | no |
| `rendering_provider_first_name` / `_last_name` | no (defaults to "Unassigned") |
| `do_not_bill` (Yes/No) | no — rows flagged Yes are excluded entirely |

Dates are read as **DD/MM/YYYY**. Rows missing a patient ID, patient name, or
a valid service date are skipped and counted in the "skipped" note under the
header; rows flagged `do_not_bill` are also skipped (counted the same way).

Visit type (the label used for chart series and the "sessions by visit type"
breakdown) normally comes straight from `appointment_name`, but a
`procedure_code` of **H0038** always forces the visit type to "Coaching" —
real exports have shown `appointment_name` mislabeled (e.g. "ADHD
evaluation") on rows actually billed as coaching, and the procedure code is
the more reliable signal. Any `appointment_name` containing the word
"coaching" (regardless of case or prefix) is also normalized to the same
"Coaching" label, so text variants don't fragment into separate chart
series.

"New patients" is derived from each patient's earliest service date in the
full dataset (or, on the account view, their earliest service date under
that specific account/payer), keyed by `external_patient_id` — there's no
separate new/returning column required.

## Tech

Vite + React + TypeScript, [Recharts](https://recharts.org) for charts,
[SheetJS](https://sheetjs.com) for parsing the uploaded spreadsheet
client-side. No server, no analytics, no external network calls — the file
you upload never leaves your browser.
