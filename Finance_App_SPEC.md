# Finance Tracker — Build Specification (SaaS product)

> **Working product name:** _TBD_ (pick a name before launch — e.g. "Rasd", "Mizan", "Ledgerly").
> Use a placeholder `APP_NAME` constant everywhere so the name can be changed in one place.
>
> **Purpose of this file:** This is a complete build brief to hand to Claude Code (or any
> developer). Put this file in the project folder, start Claude Code, and say:
> *"Read Finance_App_SPEC.md and follow the build order in section 11. Start with stage 1."*
>
> Build in the order the sections are numbered. Do not build everything at once — get auth +
> personal workspace working and deployed first, then add company workspaces and permissions.

---

## 1. What this app is

A bilingual (Arabic/English) finance tracker offered as a **multi-tenant SaaS product** — any
person can sign up and use it for both their personal money and one or more businesses they run,
each kept completely separate. It replaces a spreadsheet. It must:

- Let each user track **expenses, income, and net profit/loss** across separate workspaces.
- Give every user **one automatic Personal workspace** plus the ability to create **multiple
  Company workspaces** (e.g. one per business they run), each with its own data, members, and settings.
- Support **multiple currencies** (start with USD, AED, EGP — make the list extendable) with
  automatic conversion to each workspace's **base currency**.
- Let the **owner of a company workspace control what each member can see and do** (per-member permissions).
- Keep every tenant's data strictly isolated from every other tenant's.
- Work well **on mobile** (primary) and on desktop.

**This is a generic product, not tied to any single business.** Do not hardcode any company name,
logo, or brand into the app itself. A business like "VIDVIE" would simply be one Company workspace
a user creates inside the product — an example, never baked in.

Non-goals for v1: payments/subscriptions (planned later — see §17), invoices/receipt uploads,
budgets/alerts, inventory. Design the schema so these can be added later, but do not build them now.

---

## 2. Tech stack

- **Frontend:** Next.js (App Router) + React + TypeScript, Tailwind CSS.
- **Backend + DB + Auth:** Supabase (Postgres, Supabase Auth with email/password, Row Level Security).
- **Hosting:** Vercel (frontend) + Supabase cloud (backend). Both have free tiers.
- **State/data:** Supabase client SDK; React Query (TanStack Query) for fetching/caching.
- **i18n:** Arabic + English, with full RTL support when Arabic is active.

Rationale: Supabase gives real multi-user auth, per-row permissions, and a hosted Postgres out of
the box, which is exactly what "team members log in from their own devices" requires. Do not build
a custom auth server.

---

## 3. Core concepts & roles

- **User** — anyone with a login. Every user is the owner of their own personal workspace and may
  be an owner and/or a member of any number of company workspaces.
- **Workspace** — a container for transactions, fully isolated from other workspaces. Two kinds:
  - `personal` — exactly **one per user**, created automatically on signup, visible only to them,
    cannot be deleted or shared.
  - `company` — a user can create **many**; each has multiple members and its own base currency.
- **Membership** — links a user to a company workspace with a **role** and **permissions**.
- **Roles in a company workspace:**
  - `owner` — full control: manage members, permissions, all transactions, settings. The creator
    of a company workspace is its owner; ownership can be transferred later (nice-to-have).
  - `member` — access is defined by the permissions the owner grants them (see §6).

No global "super admin" over other users' data — this is multi-tenant; each owner controls only
their own workspaces.

---

## 4. Joining a company workspace (both methods required)

Support **both** of these:

1. **Owner invites** — owner enters a member's email; app creates an invitation. When that person
   signs up / logs in with that email, they gain access to the workspace with the role/permissions
   the owner set.
2. **Self-request to join** — a user can request to join a company workspace via an **invite code**
   or **invite link** the owner generates. The request lands in the owner's "Pending requests"
   list; the owner approves or rejects. On approval, the owner sets their permissions.

No member gets any access until the owner has approved and set permissions.

---

## 5. Currencies & conversion

- **Each workspace has its own base currency**, chosen when it's created (default USD). All of
  that workspace's summaries/dashboards are shown in its base currency. (A user's personal
  workspace and each company workspace can have different base currencies.)
- Currency list in v1: **USD, AED, EGP** — store it as data so more can be added without a code change.
- Each transaction is entered in its **original currency** with its original amount.
- Store both: the original amount + currency, **and** the amount converted to the workspace's
  base currency at time of entry.
- Exchange rates live per workspace in a **Settings** area, editable by the owner. Store each
  currency's rate relative to the workspace base currency (the base currency's own rate = 1).
  Reasonable editable defaults for a USD-base workspace: `AED ≈ 0.2723`, `EGP ≈ 0.0203`.
- When a transaction is created/edited, compute `amount_base = amount * rate_at_entry` and **store
  the rate used on the row**, so historical rows don't shift when rates are updated later.
- Provide a "refresh rates" manual input (owner types current rates). Do **not** wire a paid FX API in v1.

---

## 6. Permissions (owner controls what each member sees/does)

Per member of a company workspace, the owner can toggle:

- **View scope:**
  - `all` — sees all transactions in the company workspace.
  - `own_only` — sees only transactions they created.
- **Can add transactions** (yes/no)
- **Can edit/delete own transactions** (yes/no)
- **Can edit/delete others' transactions** (yes/no — normally off)
- **Can view dashboard/summary** (yes/no)
- **Can edit exchange rates / settings** (yes/no — normally owner only)

The owner always has full access. Enforce all of this with **Supabase Row Level Security policies**,
not just in the UI — the UI hides things, but the database must reject unauthorized reads/writes.

---

## 7. Data model (Postgres / Supabase)

Design tables roughly as follows (adjust names to conventions, keep the relationships):

**`profiles`** (mirrors auth.users)
- `id` (uuid, = auth user id, PK)
- `full_name` (text)
- `email` (text)
- `created_at`

**`workspaces`**
- `id` (uuid, PK)
- `name` (text)  — e.g. "Personal", "My Store", "Acme Trading"
- `type` (text: `personal` | `company`)
- `owner_id` (uuid → profiles.id)
- `base_currency` (text, default `USD`)
- `created_at`

**`workspace_members`**
- `id` (uuid, PK)
- `workspace_id` (uuid → workspaces.id)
- `user_id` (uuid → profiles.id)
- `role` (text: `owner` | `member`)
- `view_scope` (text: `all` | `own_only`)
- `can_add` (bool)
- `can_edit_own` (bool)
- `can_edit_others` (bool)
- `can_view_dashboard` (bool)
- `can_edit_settings` (bool)
- `status` (text: `active` | `pending` | `rejected`)
- `created_at`

**`invites`**
- `id` (uuid, PK)
- `workspace_id` (uuid → workspaces.id)
- `email` (text, nullable — for direct invites)
- `code` (text, unique — for link/code join)
- `created_by` (uuid → profiles.id)
- `expires_at`
- `used` (bool)

**`exchange_rates`**
- `id` (uuid, PK)
- `workspace_id` (uuid → workspaces.id)
- `currency` (text: `USD` | `AED` | `EGP`)
- `rate_to_base` (numeric)
- `updated_at`

**`transactions`**
- `id` (uuid, PK)
- `workspace_id` (uuid → workspaces.id)
- `created_by` (uuid → profiles.id)
- `date` (date)
- `type` (text: `income` | `expense`)
- `category` (text)
- `description` (text)
- `currency` (text: `USD` | `AED` | `EGP`)
- `amount` (numeric)            — original amount, always positive
- `rate_to_base` (numeric)      — rate to workspace base currency, captured at entry time
- `amount_base` (numeric)       — computed: amount * rate_to_base (still positive)
- `created_at`

> **Sign convention:** store `amount`/`amount_base` as positive numbers and rely on `type` for
> direction. In summaries, income counts positive and expense counts negative. Do not store
> negative amounts.

**Categories (seed list, extendable):**
`Ads`, `Inventory`, `Shipping`, `Fees`, `Software`, `Personal`, `Sales`, `Other`
(store an English key; display bilingual labels in the UI.)

---

## 8. Row Level Security (must implement)

- A user can read a `personal` workspace's rows only if they are its `owner_id`.
- A user can read `company` transactions only if they have an `active` membership in that workspace,
  and:
  - if `view_scope = all` → all rows in the workspace,
  - if `view_scope = own_only` → only rows where `created_by = auth.uid()`.
- Insert allowed only if `can_add = true` (or role = owner).
- Update/delete on own rows only if `can_edit_own = true`; on others' rows only if
  `can_edit_others = true`; owner always allowed.
- Only owner or members with `can_edit_settings = true` may write `exchange_rates` or change
  `workspace_members`.

---

## 9. Screens

Mobile-first. Bottom tab bar on mobile; sidebar on desktop.

1. **Auth** — sign up / log in (email + password), password reset. On first login, auto-create the
   user's `personal` workspace + default exchange rates.
2. **Workspace switcher** — top of app; switch between the Personal workspace and any Company
   workspaces the user belongs to. "Create company workspace" button.
3. **Dashboard** (per workspace) — cards for Total Income, Total Expenses, Net Profit/Loss (all in
   the workspace base currency), plus a breakdown of expenses by category and a simple monthly trend chart. Respects the
   member's `view_scope`.
4. **Transactions list** — filterable by month, type, category; each row shows date, category,
   description, original amount+currency, and USD amount. Add button (if `can_add`).
5. **Add/Edit transaction** — form: date, type (income/expense), category, description, currency,
   amount. Show live USD conversion as they type.
6. **Members & permissions** (company workspace owner only) — list members with their roles/permissions; invite by email;
   generate invite code/link; approve/reject pending requests; edit each member's permissions
   (the toggles in §6); remove members.
7. **Settings** — exchange rates (editable per §5), workspace base currency (set at creation; changeable by owner with a warning that it re-labels but does not re-convert past rows), language
   toggle (AR/EN), profile.

---

## 10. Design / brand

This is the product's own brand (not any customer's). A clean, neutral fintech look:

- **Accent:** warm orange (~`#E8791E`), used for primary buttons, highlights, positive CTAs.
- **Neutrals:** charcoal text (~`#1A1A1A`) on light cream/off-white (~`#F7F3EC`) surfaces; a dark
  mode variant is a nice-to-have, not required for v1.
- **Type:** clean sans-serif; for Arabic use a modern Arabic sans (e.g. IBM Plex Sans Arabic / Cairo).
- **Feel:** premium, minimal, lots of whitespace, rounded cards with soft shadows — closer to a
  polished fintech app than a spreadsheet.
- **Bilingual:** every label in English with Arabic available; full RTL layout when Arabic is active.
- Money: format as `$#,##0.00`; show negatives (net loss) in a clear red, positives in green.

---

## 11. Build order (do this in stages, deploy after stage 2)

1. **Setup** — Next.js app, Tailwind, Supabase project, env vars, deploy an empty app to Vercel.
2. **Auth + personal workspace** — sign up/login, auto-create personal workspace + default rates,
   add/list/edit transactions, dashboard, settings (rates + language). **Deploy and use this.**
3. **Company workspace core** — create company workspace, transactions scoped to workspace, workspace
   switcher, RLS for owner.
4. **Members & permissions** — invite by email, invite code/link, pending requests + approval,
   per-member permission toggles, RLS enforcing §6/§8.
5. **Polish** — charts, filters, RTL pass, mobile pass, empty states, error handling.

---

## 12. Acceptance checks

- A second person can sign up on their own device, request to join a company workspace, and only
  gains access after the owner approves and sets permissions.
- A member with `view_scope = own_only` cannot read another member's transactions — verified by
  trying directly against the API, not just the UI.
- An AED 250 expense and an EGP 500 sale both convert correctly to USD and roll into the dashboard.
- Editing an exchange rate does not retroactively change the USD value of past transactions.
- The whole app is usable one-handed on a phone in both Arabic (RTL) and English (LTR).

---

## 13. Notes for the person building this

- Get Supabase Auth + RLS working early; it is the hardest part and everything depends on it.
- Test RLS by logging in as a real second user, not just by hiding UI elements.
- Keep secrets in environment variables (Supabase keys), never in the committed code.
- Start free-tier on both Supabase and Vercel; they are enough until the data grows.

---

## 14. Design system (build this before the screens)

Define these as Tailwind theme tokens / CSS variables once, then use everywhere. Do not hardcode
hex values in components.

**Colors**
- `--accent` `#E8791E` (orange) — primary buttons, active states, positive CTAs, highlight numbers
- `--accent-hover` `#D96A12`
- `--bg` `#F7F3EC` (cream) — app background
- `--surface` `#FFFFFF` — cards, sheets, inputs
- `--text` `#1A1A1A` (charcoal) — primary text
- `--text-muted` `#777777` — secondary text, captions
- `--positive` `#1E7A3D` (green) — income, net profit
- `--negative` `#C0392B` (red) — expense, net loss
- `--border` `#EDE7DD` — hairline dividers, input borders
- Optional dark mode later: `--bg #141414`, `--surface #1E1E1E`, `--text #F5F5F5`.

**Typography**
- Latin: Inter or Manrope. Arabic: IBM Plex Sans Arabic or Cairo, weight-matched.
- Scale: page title 24/700 · section header 16/600 · body 14/400 · caption 12/400 ·
  big number (dashboard cards) 30–34/700.
- Line-height generous (1.4–1.6). Never cram.

**Shape & spacing**
- Card radius 20px · button/input radius 12px · pill/badge radius 999px.
- Base spacing unit 4px; use 8/12/16/24/32 rhythm. Screen padding 20px on mobile.
- Shadows soft and low: `0 2px 8px rgba(0,0,0,0.04)`, `0 8px 24px rgba(0,0,0,0.06)` for sheets.

**Components (reuse everywhere)**
- `Button` (primary orange / secondary outline / ghost / destructive red-outline)
- `Card` (white surface, radius 20, soft shadow, 20px inner padding)
- `StatCard` (label top, big number, small delta/caption)
- `Input`, `Select`, `DatePicker`, `Toggle`, `SegmentedControl` (for income/expense)
- `Sheet` (bottom sheet on mobile, centered modal on desktop) — used for add/edit forms
- `Badge` (category pills — subtle tinted background, not loud)
- `CurrencyText` (formats amount, colors by sign, shows currency)
- `EmptyState` (icon + one line + a primary action)
- `TabBar` (mobile bottom nav), `Sidebar` (desktop)

**Motion**
- 150–200ms ease-out on press/hover; bottom sheets slide up; number counters may tween on the
  dashboard. Nothing bouncy or slow. Respect `prefers-reduced-motion`.

**RTL**
- When Arabic is active, set `dir="rtl"` at the root; mirror layout, nav, and icon direction.
- Keep Latin tokens (USD, AED, QI2, numbers) left-to-right inside RTL text so they don't reverse.

---

## 15. Screen-by-screen layout

Describe each screen top to bottom. Mobile is the primary target; desktop widens the same layout.

### 15.1 Auth (login / sign up)
- Centered card on cream background. `APP_NAME` wordmark at top, small tagline under it.
- Segmented toggle: **Log in / Sign up**.
- Fields: email, password (sign-up adds full name + confirm). Orange primary button full-width.
- "Forgot password?" ghost link. Language toggle (AR/EN) in the top corner.
- On error, inline red helper text under the field — never a raw alert.

### 15.2 App shell
- **Mobile:** bottom `TabBar` with 4 items — Dashboard, Transactions, Add (center, orange
  circular +), Members (company-workspace owner) / Settings. Workspace switcher is a pill at the very top
  showing current workspace name + chevron; tapping opens a sheet to switch.
- **Desktop:** left `Sidebar` with the same items + workspace switcher at top; content area right.

### 15.3 Workspace switcher (sheet)
- List of workspaces the user belongs to: each row = workspace name, type badge (Personal/Company),
  role badge (Owner/Member). Check mark on the active one.
- Bottom: "＋ Create company workspace" (opens a small form: name + base currency picker).

### 15.4 Dashboard
- Header: workspace name + a month selector (This month ▾).
- **Three StatCards** stacked on mobile, in a row on desktop:
  - Total Income (green number), Total Expenses (red number), Net Profit/Loss (orange, large,
    turns green if positive / red if negative).
- **Expenses by category**: horizontal bars or a simple donut, each category tinted, value in the workspace base currency.
- **Monthly trend**: a small line/area chart, income vs expense over the last 6 months.
- If `view_scope = own_only`, add a subtle caption: "Showing your entries only."
- Empty state when no data: illustration + "Add your first transaction" primary button.

### 15.5 Transactions list
- Sticky filter row: month, type (All/Income/Expense), category. A search field is optional.
- Grouped by date (date subheader, then rows).
- **Row:** left = category pill + description (2 lines max, truncate); right = amount. Show the
  original amount + currency on top and the USD value muted beneath (e.g. `AED 250` / `≈ $68.08`).
  Income green, expense red.
- Tap a row → opens Edit sheet (if permitted). Swipe or long-press for quick delete (if permitted).
- Floating orange **＋** (mobile) opens the Add sheet.

### 15.6 Add / Edit transaction (bottom sheet)
- Grabber handle at top; title "New transaction" / "Edit".
- `SegmentedControl`: Income | Expense (drives the accent of the amount field).
- Fields in order: **Amount** (big, with a currency selector USD/AED/EGP right beside it),
  then a **live "≈ $X.XX" USD preview** under it; **Date** (defaults today); **Category** (pill
  picker); **Description** (text). 
- Sticky footer: secondary "Cancel" + primary orange "Save".
- Validation inline; disable Save until amount + type + category are set.

### 15.7 Members & permissions (company workspace owner only)
- **Members** section: each member row = avatar/initials, name, email, role badge, and a summary
  of their permissions ("Sees all · can add"). Tap → member detail with the permission toggles
  from §6 (view scope segmented All/Own-only; switches for add, edit own, edit others, view
  dashboard, edit settings). "Remove member" destructive at the bottom.
- **Invite** section: field to invite by email (primary button "Send invite"); below it a
  generated **invite code + copyable link** with a "Regenerate" ghost button.
- **Pending requests** section: rows with name/email + Approve (orange) / Reject (ghost). Approving
  opens the same permission sheet so the owner sets access on approval.

### 15.8 Settings
- **Exchange rates** card: one row per currency (the workspace's base currency fixed at 1.0000 and locked; the others editable numeric
  inputs, 4 decimals). "Last updated" caption. Save button. Only visible/editable if permitted.
- **Language**: AR/EN segmented toggle (switches app direction live).
- **Profile**: name, email (read-only), change password, log out (destructive).

---

## 16. Design acceptance

- Nothing looks like a default Tailwind/Bootstrap page: consistent radius, soft shadows, the cream
  + charcoal + orange system applied everywhere, real empty states.
- One-handed usable on a phone; primary actions reachable by thumb (bottom sheets, bottom tab bar).
- Arabic mode fully mirrors and reads naturally; no reversed Latin tokens or numbers.
- Money is instantly scannable: sign-colored, currency-labeled, USD preview always one tap away.
- The Add flow takes under ~5 seconds for a returning user (amount → currency → category → save).

---

## 17. Planned for later — do NOT build in v1 (design so it fits)

The product launches **free** to validate demand. Do not build any of this yet, but keep the
schema and architecture friendly to it:

- **Subscriptions & billing.** Later, gate advanced usage (e.g. more than N company workspaces, or
  more than N members) behind a paid plan. When that time comes, use a hosted billing provider
  (Stripe or Paddle) — do not build card handling yourself. To stay ready now: keep a `plan`
  concept in mind (a nullable `plan` column on a future `accounts`/`billing` table), and don't
  assume unlimited resources are free forever in the UI copy.
- **Plan limits.** Free vs paid caps on workspaces/members/transactions. Keep counts queryable.
- **Onboarding / marketing site.** A simple landing page + sign-up funnel, separate from the app.
- **Roles beyond owner/member** (e.g. accountant-only, read-only auditor).
- **Invoices / receipt image uploads**, **budgets & alerts**, **CSV/Excel import & export**,
  **recurring transactions**.
- **Audit log** of who changed what (valuable once real money and teams are involved).

### v1 launch scope (keep it small on purpose)
Ship only: email/password auth · one personal workspace per user · create multiple company
workspaces · add/list/edit transactions · multi-currency with per-workspace base currency ·
dashboard · members & per-member permissions with enforced RLS · AR/EN + RTL · mobile-first.
Free for everyone. Get real users on this before building §17.

### Legal & trust (needed before you charge anyone, ideally at launch)
Because this stores people's financial data: add a **Privacy Policy** and **Terms of Service**,
be clear about where data is stored, and follow applicable data-protection rules (in the UAE,
the federal PDPL). Never log secrets. This is a note for the founder, not a build task for v1.
