-- =============================================================================
-- 002 — patch handle_new_user() to also read phone from auth metadata
--
-- The signup form passes { full_name, phone } via supabase.auth.signUp's
-- options.data, which lands in auth.users.raw_user_meta_data. This update
-- makes the trigger pull phone too so the user_profiles row is complete
-- the moment auth.users gets an insert.
-- =============================================================================

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

commit;
