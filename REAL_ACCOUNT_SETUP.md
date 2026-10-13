# Etp2p Supabase setup

The site source is now split into `index.html`, `app.js`, and `services/supabase.js`. Listings and orders are stored in Supabase Postgres. The site is **not ready for users until the SQL below is installed and all website files are deployed together**.

## 1. Install the database schema

1. Open the Etp2p project in Supabase.
2. Open **SQL Editor** and choose a new query.
3. Copy all of [`supabase/schema.sql`](supabase/schema.sql) into the query editor and run it.
4. Confirm the query finishes without an error. It creates the profile, listing, order, and audit tables; row-level security policies; and database functions that validate and reserve orders.

The script does not add fake merchant listings. New listings appear when authenticated Etp2p users create them. It does not import the old browser-only sample ads or demo orders; those entries were not shared account data.

## 2. Deploy the whole website to GitHub

Keep this layout at the repository's top level:

```text
index.html
app.js
services/
  supabase.js
supabase/
  schema.sql
```

Upload every listed file and preserve the `services` and `supabase` folders. Do not delete `index.html`; it is the website entry page. Commit the files to `main`. Render should then deploy the new static site automatically.

## 3. Set Supabase Auth URLs and MFA

- In **Authentication → URL Configuration**, set the Site URL to `https://etp2p-site.onrender.com/` and add that URL to the allowed redirect URLs.
- Keep email confirmation enabled and configure your own SMTP provider before opening sign-up publicly.
- In Supabase Auth password security settings, enforce at least 10 characters and enable leaked-password protection if available. The page also checks for a 10-character minimum, but Auth settings enforce rules for API requests too.
- In **Authentication → MFA**, enable TOTP enrollment and verification. Users can browse active ads without MFA; Etp2p requires an authenticator verified session to post or change ads, create or update orders, and read private orders.
- Use **Security → Advisors** and review the Database Security and Performance Advisors after the schema is installed.
- In Render, open the static site's **Settings → Headers** and add these rules on `/*`: `Strict-Transport-Security: max-age=31536000`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy: camera=(), microphone=(), geolocation=()`. Render documents custom static-site response headers [here](https://render.com/docs/static-site-headers). The page also sets a Content Security Policy in its HTML.
- Before public sign-up, enable Auth CAPTCHA protection and use a custom SMTP provider. Keep administrator MFA enabled on Supabase and GitHub.

## What is saved and who can see it

- Active ads are shared with every visitor. An ad contains a pseudonymous public merchant handle, currency, rate, USDT availability, limits, and selected Ethiopian payment-method labels.
- Order rows are readable only by the buyer and seller. Database functions check the participants, ad stock, order limits, payment method, status transition, and request ID.
- Users can pause or archive their ads. The application has no hard-delete permission for profiles, ads, orders, or audit history. The database records ad and order changes in an append-only audit table.
- Do not enter bank account numbers, passwords, wallet seed phrases, or other private payment details in ads. The app does not need or store them.
- The browser contains only the Supabase project URL and publishable key. Never add a service-role key, database password, or other secret to `index.html`, `app.js`, or `services/supabase.js`.

## Important limits

“Never delete” and “for ever” cannot be guaranteed by website code. Database owners can still delete a project or its data, and a hosting provider can have an outage. The app blocks normal users from hard-deleting marketplace records; use backups as well. Supabase's [backup guide](https://supabase.com/docs/guides/platform/backups) says Free projects should regularly export their data off-site; automated daily backups are available on Pro, Team, and Enterprise plans, with plan-based retention. Paid Point-in-Time Recovery provides finer restore points.

Supabase's current [billing documentation](https://supabase.com/docs/guides/platform/billing-on-supabase) lists 50,000 monthly active users and a 500 MB database on Free. That is an authentication allowance, **not** a promise that a free Nano database can serve 50,000 people at once. Capacity also depends on database compute, API traffic, egress, and query load. Before inviting 50,000 people, upgrade as needed, monitor Supabase, and run a staged load test; Supabase recommends load testing and sizing for expected traffic in its [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod).

This implements persistent listings and order records, **not** cryptocurrency custody, escrow, payment initiation, payment verification, or dispute handling. Statuses are reported by the users. Do not describe this version as an exchange that settles trades.
