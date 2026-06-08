-- One active viewing session per course "seat" (an order) at a time, so a
-- shared/copied course link can't be watched on a second device concurrently.
-- The player heartbeats; a second session is blocked unless it takes over.

create table if not exists course_view_sessions (
  subject text primary key,          -- seat key = orders.id (per purchase)
  course_id uuid not null,
  session_id text not null,          -- random per browser/tab
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table course_view_sessions enable row level security;
-- No policies: all access is via the API using the service-role admin client.

-- Atomically claim/refresh a seat. Returns the CURRENT owner's session id.
-- The caller becomes owner when it already owns the seat, the seat is stale
-- (last_seen older than p_stale_seconds), or p_force is true (explicit take-
-- over). Otherwise the existing fresh owner is kept and returned.
create or replace function claim_course_session(
  p_subject text,
  p_course_id uuid,
  p_session text,
  p_stale_seconds int,
  p_force boolean
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner text;
  v_last timestamptz;
begin
  select session_id, last_seen into v_owner, v_last
    from course_view_sessions
    where subject = p_subject
    for update;

  if v_owner is null then
    insert into course_view_sessions (subject, course_id, session_id)
      values (p_subject, p_course_id, p_session);
    return p_session;
  end if;

  if p_force
     or v_owner = p_session
     or v_last < now() - make_interval(secs => p_stale_seconds) then
    update course_view_sessions
      set session_id = p_session, last_seen = now(), course_id = p_course_id
      where subject = p_subject;
    return p_session;
  end if;

  -- A different session holds a fresh seat — caller is NOT the owner.
  return v_owner;
end;
$$;
