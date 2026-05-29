# InvoxAI

SaaS platform for creators and sellers to take payments, build landing
pages, and sell access to Telegram VIP groups. Hosted at
`app.invoxai.io` (user dashboard) and `admin.invoxai.io` (platform
admin), with the marketing site at `invoxai.io`.

InvoxAI collects through its own payment gateway integration and
auto-deducts a platform commission before settling the net to the
seller.

## Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui (New York, zinc)
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **Payments:** Razorpay
- **Email / SMS:** Resend, MSG91
- **Queues:** Bull on Redis (ioredis)
- **Hosting:** Hostinger KVM VPS

## Quick start

```bash
git clone https://github.com/deepg3004/hello.git
cd hello
cp .env.example .env.local        # fill in real values
npm install
npm run dev                       # http://localhost:3000
```

## Layout

```
app/
  (auth)/        login, signup, forgot-password
  (dashboard)/   seller dashboard (app.invoxai.io)
  (admin)/       platform admin (admin.invoxai.io)
  (public)/      published seller pages (/p/[slug])
components/
  ui/            shadcn primitives
  dashboard/     dashboard composites
  admin/         admin composites
  pages/         page-builder blocks
  shared/        cross-cutting components
lib/
  supabase/      client / server / admin Supabase factories
  utils.ts       cn, formatINR, commission math
hooks/
types/           single source of truth for DB-shaped models
actions/         server actions
middleware.ts    session refresh + auth-aware redirects
```

## Environment

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`
- `MSG91_AUTH_KEY`, `MSG91_SENDER_ID`
- `REDIS_URL`
- `PLATFORM_COMMISSION_PERCENT` (default 5)

## Archive

The previous LinkPlease v1 codebase that ran at `hello.invoxai.io` was
archived on 2026-05-29. To restore it:

```bash
git checkout linkplease-final-archive   # full archive branch
# or
git checkout v1-linkplease-final         # tagged final commit
```
