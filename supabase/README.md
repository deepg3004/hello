# Supabase migrations

SQL migrations for the InvoxAI database. Apply in numeric order.

## Migrations

| File                            | What it does                                                  |
| ------------------------------- | ------------------------------------------------------------- |
| `migrations/001_initial_schema.sql` | 18 tables, helper functions, indexes, RLS policies, triggers. |

## Applying — Option A: Supabase Studio (fastest, no CLI)

1. Open [supabase.com/dashboard](https://supabase.com/dashboard) → your project.
2. Sidebar → **SQL Editor** → **New query**.
3. Open `migrations/001_initial_schema.sql` from this repo, copy the entire file.
4. Paste into the SQL editor → **Run**.
5. Expect "Success. No rows returned."
6. Sidebar → **Table Editor** → confirm all 18 tables are present.
7. Sidebar → **Authentication → Policies** → confirm RLS is on for every table.

## Applying — Option B: Supabase CLI (for repeatable deploys)

```bash
# one-time
npm install -g supabase
supabase login
supabase link --project-ref YOUR-PROJECT-REF

# apply
supabase db push
```

## After applying

1. Sign up a test user via your `app.invoxai.io/signup` (or Supabase Studio's
   Authentication panel). The `on_auth_user_created` trigger should auto-create
   a matching row in `public.user_profiles`.
2. Promote yourself to admin so admin RLS policies open up:

   ```sql
   UPDATE public.user_profiles
   SET is_admin = TRUE
   WHERE email = 'you@yourmail.com';
   ```

## Conventions

- **Money** lives in `DECIMAL(10,2)` / `DECIMAL(12,2)` (rupees). The Next.js
  `lib/utils.ts` `formatINR()` and `platformCommissionPaise()` helpers were
  written for paise — adjust when wiring orders to use rupees consistently
  with this schema, or convert at the boundary.
- **`updated_at`** is maintained by `set_updated_at()` BEFORE-UPDATE triggers on
  `user_profiles` and `pages`. Add the same trigger to other tables if you
  need it later.
- **RLS** is on for every table. Server actions and API routes that need to
  bypass it use the **service role** Supabase client at `lib/supabase/admin.ts`.
- **Admin checks** use `public.is_admin(auth.uid())` — a SECURITY DEFINER
  function so policies on `user_profiles` itself don't recurse.

## What's NOT in this migration

- Seed data (no test rows are inserted)
- Storage buckets (create `avatars`, `kyc`, `page-assets` in Supabase Studio
  → Storage)
- Edge functions
- Postgres extensions beyond `pgcrypto`
