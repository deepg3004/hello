# Supabase Setup Guide

Step-by-step guide to move LinkPlease from local SQLite to Supabase Postgres.

After this guide, your VPS at `hello.invoxai.io` will keep running the Node app and Nginx, but the database lives in Supabase.

---

## 1. Create the Supabase project

1. Go to https://supabase.com and sign in.
2. Click **New project**.
3. Fill the form:
   - **Name**: `linkplease`
   - **Database password**: click **Generate a password**, then **copy and save it** somewhere safe (you cannot see it again).
   - **Region**: choose closest to your Hostinger VPS.
     - India VPS → **South Asia (Mumbai)**
     - Europe VPS → **Central EU (Frankfurt)**
     - US VPS → **East US (Ohio)** or **West US (Oregon)**
   - **Pricing plan**: **Free** is fine to start.
4. Click **Create new project**. Wait ~2 minutes while it provisions.

---

## 2. Apply the database schema

1. In the Supabase dashboard sidebar, click **SQL Editor**.
2. Click **+ New query**.
3. Open `server/schema.sql` from this repo. Copy the full contents.
4. Paste into the SQL editor.
5. Click **Run** (bottom right). You should see `Success. No rows returned`.
6. Verify: in the sidebar click **Table Editor**. You should see 6 tables:
   - `instagram_connections`
   - `automations`
   - `contacts`
   - `messages`
   - `products`
   - `orders`

---

## 3. Get the connection string

1. In the sidebar click **Project Settings** (gear icon) → **Database**.
2. Scroll to **Connection string**.
3. Click the **Transaction pooler** tab (this is the right one for a long-running Node app — port 6543).
4. Copy the connection string. It looks like:
   ```
   postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
   ```
5. Replace `[YOUR-PASSWORD]` with the database password you saved in step 1.

> Do not commit this string to GitHub. It goes in `.env` only.

---

## 4. Add DATABASE_URL on the VPS

SSH into the VPS:

```bash
ssh root@YOUR_VPS_IP
cd /var/www/linkplease
nano .env
```

Add or update the line:

```env
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_DB_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
```

If a `DATABASE_PATH=` line still exists from the old SQLite setup, delete it.

Save and exit (`CTRL+O`, `Enter`, `CTRL+X`).

---

## 5. Pull the new code and install dependencies

On the VPS:

```bash
cd /var/www/linkplease
git pull origin main
npm install
npm run build
```

This installs the new `pg` driver and removes `better-sqlite3` from runtime usage.

---

## 6. (Optional) Migrate old data from SQLite to Supabase

Skip this step if you have no data in the old SQLite file (fresh install).

```bash
cd /var/www/linkplease
npm install better-sqlite3   # only needed once for migration
node server/migrate-from-sqlite.js /var/www/linkplease/server/data/linkplease.sqlite
```

Expected output:

```
Migrating from /var/www/linkplease/server/data/linkplease.sqlite ...
- instagram_connections: 1 rows copied
- automations: 3 rows copied
- contacts: 12 rows copied
- messages: 47 rows copied
- products: 2 rows copied
- orders: 0 rows
Migration complete.
```

After it succeeds you can remove the old SQLite file:

```bash
mv server/data/linkplease.sqlite server/data/linkplease.sqlite.bak
```

(Keep the `.bak` for a few days, then delete.)

---

## 7. Restart the app

```bash
pm2 restart hello-invoxai
pm2 logs hello-invoxai --lines 30
```

Look for:

```
LinkPlease backend running on http://127.0.0.1:8080
```

No `ECONNREFUSED` or `password authentication failed` errors.

---

## 8. Verify the health check

From the VPS:

```bash
curl http://127.0.0.1:8080/api/health
```

Expected response:

```json
{
  "ok": true,
  "service": "linkplease-live-backend",
  "database": "supabase-postgres",
  "meta": { ... }
}
```

From your laptop:

```bash
curl https://hello.invoxai.io/api/health
```

If `database` reads `supabase-postgres`, the live site is talking to Supabase.

---

## 9. Verify with a write test

In Supabase **Table Editor** open the `automations` table. Then on the dashboard at `https://hello.invoxai.io`:

1. Go to **Automations**.
2. Click **Create**.
3. Pick a trigger and click **Save Changes**.
4. Refresh the Supabase Table Editor — the new row should appear there.

If it does, the migration is done.

---

## 10. (Recommended) Lock down the database

This is the security step that makes Supabase worth it.

### 10a. Restrict access to your VPS IP

1. Supabase sidebar → **Project Settings** → **Database** → **Network Restrictions**.
2. Click **Add restriction**.
3. Enter your Hostinger VPS IP (`/32`).
4. Save.

Now only your VPS can connect — even if `DATABASE_URL` leaks, nobody else can use it.

### 10b. Turn on Row Level Security (later, when you add multi-user)

When the app becomes multi-tenant (each user has their own automations/contacts), enable RLS on every table:

1. Supabase sidebar → **Authentication** → **Policies**.
2. For each table, click **Enable RLS**.
3. Add policies so users can only read/write their own rows (e.g. `auth.uid() = user_id`).

You will need to add a `user_id` column to each table before turning this on. Not required for the single-tenant launch.

### 10c. Backups

Free plan: daily backups, 7-day retention.
Pro plan ($25/mo): point-in-time recovery, 30-day retention.

If this is for paying customers, upgrade to Pro **before** real money flows.

---

## 11. (Later) Move product files to Supabase Storage

You sell digital products. Right now `resource_link` is just a URL the seller pastes in. For real file uploads:

1. Supabase sidebar → **Storage** → **New bucket**.
2. Name: `products`. Set to **Private**.
3. Add an upload form in the dashboard's product builder that uses `@supabase/supabase-js` and writes to this bucket.
4. After purchase, generate a signed URL with `createSignedUrl(path, 60 * 60)` and email it to the customer.

Not required for launch. Worth doing when you have time.

---

## Troubleshooting

**`password authentication failed for user "postgres"`**
Wrong password in `DATABASE_URL`. Reset it in **Project Settings → Database → Reset database password** and update `.env`.

**`could not translate host name`**
Wrong region in the URL. Copy the connection string again from the Supabase dashboard.

**`Connection terminated unexpectedly`** under load
Use the **Transaction pooler** URL (port 6543), not the direct connection (port 5432).

**Health check shows `"database": "unreachable"`**
Run `pm2 logs hello-invoxai` to see the actual error. Most often: VPS IP not yet added under Network Restrictions, or `DATABASE_URL` typo.

**Migration script errors with `relation "automations" does not exist`**
You forgot step 2 — apply `server/schema.sql` in Supabase SQL Editor before migrating.

---

## Re-running schema.sql for new columns

`server/schema.sql` is **idempotent** — every `CREATE TABLE`, `CREATE INDEX`, and `ALTER TABLE ADD COLUMN` uses `IF NOT EXISTS`. Whenever a new release adds columns (e.g. the SuperProfile-style payment-page release added 13 columns to `products` and 7 to `orders`), simply re-run the file from the VPS:

```bash
PGPASSWORD=<your-password> psql \
  "host=db.<your-ref>.supabase.co port=5432 dbname=postgres user=postgres sslmode=require" \
  -f /var/www/linkplease/server/schema.sql
```

You'll see `CREATE TABLE` / `CREATE INDEX` lines for new objects and silent no-ops for existing ones. No data is touched.
