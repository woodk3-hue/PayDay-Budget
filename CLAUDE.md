# PayDay Budget (repo: PayDay-Budget)

Personal budget PWA for Kim (Brisbane, AU). Syncs across phone (Samsung S24 Ultra), laptop and PC.
Separate from FinCommand (Kim's older offline-only finance PWA).

## Structure
- `docs/` — the PWA, hosted on GitHub Pages from the `/docs` folder (only this folder is published)
  - `index.html` — single file: HTML + CSS + vanilla JS (ES modules). No build step, no frameworks.
  - `sw.js` — service worker: offline app shell + Web Push handlers. **Bump `VERSION` on every app change.**
  - `firestore.rules` — paste into Firebase console; data lives at `users/{uid}/{collection}/{doc}`.
- `notifier/` — Node + Docker service on Kim's Dell OptiPlex (Ubuntu Server). Daily 08:00 Australia/Brisbane:
  rolls subscription due dates forward, sends Web Push (VAPID) reminders, removes expired devices.
- `money-plan/` — Kim's budget spreadsheets. **Local only — gitignored, never commit (personal finances, public repo).**
- `SETUP.md` — plain-language Firebase / GitHub Pages / OptiPlex setup.

## Data (Firestore, per user)
`income`, `expenses` (frequency: once/weekly/fortnightly/monthly/quarterly/yearly), `goals`, `transfers`
(type add/spend, goalId), `subscriptions` (name, amount, type subscription/bill/purchase, frequency,
dueDate YYYY-MM-DD, remindDays, lastNotified), `pushDevices` (Web Push subscription JSON).
Fortnights run Mon–Sun, anchored to Mon 2026-10-19 (`PERIOD_ANCHOR`); payday is the Wednesday after a fortnight ends (`PAY_ANCHOR` = Wed 2026-11-04, every 14 days). QR pay counts for the fortnight it was earned in (`incomePeriodDate`).

## Rules — do not break
- Never use `window.confirm()`/`alert()` — use `showInlineConfirm()` / `toast()` (z-index 700 on document.body).
- Don't await Firestore writes (they hang offline); fire-and-forget with `.catch(toast)`.
- Don't nest template literals inside string concatenation — use small named helper functions.
- Escape all user text with `esc()` before inserting into HTML.
- `addCycle()` / `nextDue()` logic must stay identical between `docs/index.html` and `notifier/notifier.js`.
- Design follows Apple HIG (iOS system colours, SF type scale, inset grouped cards, glass tab bar).
  Keep tap targets ≥ 44px and support dark mode, Reduce Motion and Reduce Transparency.
- Never commit `notifier/.env` or `notifier/service-account.json`.

## Working with Kim
- Get approval on the architecture/approach before implementing anything new.
- Ask clarifying questions one at a time.
- Make surgical, targeted changes — never full rewrites.
- Kim isn't comfortable with the terminal: give plain-language, copy-paste steps for anything to run.
- Keep replies brief and actionable.
