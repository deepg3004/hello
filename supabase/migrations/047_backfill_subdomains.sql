-- =============================================================================
-- 047 — Backfill subdomains for existing users
-- Every seller should have a personal subdomain (name.invoxai.io) that hosts
-- their store. This one-time, idempotent pass assigns one to every user that
-- still has subdomain IS NULL, derived from their name/email and deduped against
-- taken subdomains + the reserved list. No Cloudflare calls — *.invoxai.io
-- resolves via the wildcard nginx vhost, so the subdomain is live immediately.
-- New users get one auto-assigned in app code (lib/subdomain.ts).
-- =============================================================================
begin;

do $$
declare
  r          record;
  base       text;
  candidate  text;
  n          int;
  hard_reserved text[] := array[
    'www','hello','api','admin','app','mail','static','cdn','blog','docs',
    'status','help','support','pay','checkout','billing','login','signup','auth'
  ];
begin
  for r in
    select id,
           coalesce(nullif(btrim(full_name), ''), split_part(email, '@', 1), 'seller') as seed
    from public.user_profiles
    where subdomain is null
  loop
    -- slugify: lowercase, non-alphanumerics -> '-', collapse, trim hyphens
    base := lower(r.seed);
    base := regexp_replace(base, '[^a-z0-9]+', '-', 'g');
    base := btrim(base, '-');
    -- must start with a letter (subdomain regex: ^[a-z][a-z0-9-]*[a-z0-9]$)
    if base !~ '^[a-z]' then
      base := 's' || base;
    end if;
    -- clamp to 28 chars (leave room for a numeric suffix), re-trim hyphens
    base := btrim(left(base, 28), '-');
    if length(base) < 3 then
      base := 'seller';
    end if;

    candidate := base;
    n := 1;
    while exists (select 1 from public.user_profiles where subdomain = candidate)
       or exists (select 1 from public.reserved_subdomains where name = candidate)
       or candidate = any (hard_reserved)
    loop
      n := n + 1;
      candidate := btrim(left(base, 26), '-') || n::text;
    end loop;

    update public.user_profiles
      set subdomain = candidate,
          subdomain_claimed_at = now()
      where id = r.id;
  end loop;
end $$;

commit;
