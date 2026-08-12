# Apartment Renovation Expense Dashboard

Read-only, dependency-free dashboard for tracking apartment renovation expenses.
The single source of truth is [`renovation.json`](renovation.json). The dashboard
**never modifies** the JSON — it is strictly a visualization layer.

**Live dashboard:** https://berranremzi.github.io/home/

## Project structure

```
home/
├── renovation.json   # source of truth (do not edit from the dashboard)
├── index.html        # markup
├── app.js            # logic (fetch, validate, calculate, render)
├── style.css         # styles
├── skill.md          # data model / schema notes
├── receipts/         # optional receipt files referenced by expenses
├── photos/           # optional photos
└── backups/          # optional backups
```

## Features

- Header with budget, spent, remaining, utilization and a progress bar
  (turns red when overspent).
- Summary cards: total spent, remaining, count, average, largest expense.
- Breakdown by category and by room (amount + share of total).
- Recent expenses table with client-side sorting (date / amount / category / room).
- Filters: date range, category, room, vendor, paid/unpaid — all statistics
  update dynamically.
- Click an expense to see full details in a modal (id, date, amount, currency,
  category, room(s), description, vendor, payment method, paid status, receipt
  link, notes).
- Lightweight charts built with plain HTML/CSS/SVG — spending by category, by
  room, and cumulative spending over time. No chart libraries.
- Budget analysis: budget vs spent vs remaining vs used %, plus each category
  compared with the total project budget.
- Data validation with clear error messages; missing optional fields
  (`room`, `vendor`, `receipt`, `notes`, `payment_method`) never crash the app.
- Empty-state messaging (no broken charts or NaN).
- Fully responsive (desktop / tablet / mobile). Mobile prioritizes total spent,
  remaining budget, budget progress and recent expenses.
- Currency is read from `project.currency` — not hardcoded.

## Run locally

Browsers block `fetch()` for local files opened via `file://`, so use a simple
static server from the project folder:

```bash
python -m http.server 8000
```

Then open:

```
http://localhost:8000/index.html
```

Any static file server works (e.g. `npx serve`, VS Code Live Server, etc.).
There is **no backend** and **no build step**.

## Deploy to GitHub Pages

1. Push the repository to GitHub (repo name: `home`).
2. In **Settings → Pages → Build and deployment**, choose **Deploy from a
   branch**, then select `main` and **root** (`/(root)`).
3. The dashboard uses only relative paths, so it works as-is — no architectural
   changes needed.