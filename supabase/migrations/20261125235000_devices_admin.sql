-- Devices that use Kepler AI, with approximate location, and the /admin page that lists them.

create table if not exists public.devices (
  id text primary key,                 -- random ID from the kepler_device cookie
  label text,                          -- e.g. "iPhone · Safari"
  user_agent text,
  city text, region text, country text, timezone text,
  lat double precision, lon double precision,
  isp text,
  ip_hash text,                        -- salted hash, only used to notice when the network changes
  visits integer not null default 0,
  messages integer not null default 0,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
-- No policies: the site cannot read or write this table directly.
alter table public.devices enable row level security;

-- Called by the chat function (service role) on every sign-in and message.
-- Returns the previous ip_hash so the function knows whether to look up the location again.
create or replace function public.kepler_track_device(p_id text, p_label text, p_ua text, p_ip_hash text, p_message boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare prev text;
begin
  -- No location yet counts as a change, so a failed lookup is tried again next time.
  select case when city is null then null else ip_hash end into prev from public.devices where id = p_id;
  insert into public.devices as d (id, label, user_agent, ip_hash, visits, messages)
  values (p_id, p_label, p_ua, p_ip_hash, case when p_message then 0 else 1 end, case when p_message then 1 else 0 end)
  on conflict (id) do update set
    label = excluded.label, user_agent = excluded.user_agent, ip_hash = excluded.ip_hash, last_seen = now(),
    visits = d.visits + case when p_message then 0 else 1 end,
    messages = d.messages + case when p_message then 1 else 0 end;
  return prev;
end $$;

create or replace function public.kepler_device_location(p_id text, p_city text, p_region text, p_country text, p_timezone text, p_lat double precision, p_lon double precision, p_isp text)
returns void language sql security definer set search_path = '' as $$
  update public.devices set city = p_city, region = p_region, country = p_country, timezone = p_timezone,
    lat = p_lat, lon = p_lon, isp = p_isp where id = p_id;
$$;

revoke all on function public.kepler_track_device(text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.kepler_device_location(text, text, text, text, text, double precision, double precision, text) from public, anon, authenticated;
grant execute on function public.kepler_track_device(text, text, text, text, boolean) to service_role;
grant execute on function public.kepler_device_location(text, text, text, text, text, double precision, double precision, text) to service_role;

-- Admin password (separate from the site password). Set it with:
--   update public.kepler_admin set password_hash = extensions.crypt('YOUR ADMIN PASSWORD', extensions.gen_salt('bf'));
create table if not exists public.kepler_admin (
  id integer primary key default 1 check (id = 1),
  password_hash text not null
);
alter table public.kepler_admin enable row level security;
insert into public.kepler_admin (id, password_hash)
values (1, extensions.crypt(encode(extensions.gen_random_bytes(24), 'base64'), extensions.gen_salt('bf')))
on conflict (id) do nothing;

-- The /admin page calls this with the admin password and gets the device list back.
create or replace function public.kepler_admin_devices(p_password text)
returns setof public.devices language plpgsql security definer set search_path = '' as $$
begin
  if p_password is null or not exists (
    select 1 from public.kepler_admin where password_hash = extensions.crypt(p_password, password_hash)
  ) then
    perform pg_sleep(1);  -- slows down guessing
    raise exception 'wrong admin password' using errcode = '28P01';
  end if;
  return query select * from public.devices order by last_seen desc;
end $$;
revoke all on function public.kepler_admin_devices(text) from public;
grant execute on function public.kepler_admin_devices(text) to anon, authenticated;
