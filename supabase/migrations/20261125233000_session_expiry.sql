-- "Stay signed in for": the site calls this right after the password is entered.
-- It sets when the current login session ends. After that time Supabase refuses to
-- refresh the session, so the password screen comes back.
create or replace function public.kepler_set_session_expiry(p_minutes integer)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  ends timestamptz;
begin
  if auth.uid() is null or sid is null then
    raise exception 'not signed in';
  end if;
  -- Between 15 minutes and 30 days.
  ends := now() + make_interval(mins => greatest(15, least(coalesce(p_minutes, 60), 43200)));
  update auth.sessions set not_after = ends where id = sid and user_id = auth.uid();
  return ends;
end;
$$;

revoke all on function public.kepler_set_session_expiry(integer) from public, anon;
grant execute on function public.kepler_set_session_expiry(integer) to authenticated;
