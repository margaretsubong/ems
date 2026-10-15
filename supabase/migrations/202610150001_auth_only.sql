begin;

create table public.employee_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_id text not null unique,
  email text not null unique,
  username text,
  role text not null check (role in ('employee', 'department_manager')),
  account_status text not null default 'pending' check (account_status in ('pending', 'active', 'disabled')),
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint authorized_identity check (
    (employee_id = 'MGR-001' and email = 'margaretsubong92@gmail.com' and role = 'department_manager') or
    (employee_id = 'EMP-4092' and email = 'danicaacosta544@gmail.com' and role = 'employee')
  ),
  constraint activation_complete check (account_status <> 'active' or (activated_at is not null and username is not null))
);
alter table public.employee_profiles enable row level security;
revoke all on public.employee_profiles from anon, authenticated;
grant select on public.employee_profiles to authenticated;
grant all on public.employee_profiles to service_role;
create policy own_auth_profile on public.employee_profiles for select to authenticated using ((select auth.uid()) = id);

create function public.restrict_ems_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if lower(new.email) not in ('margaretsubong92@gmail.com', 'danicaacosta544@gmail.com') or new.email is null then
    raise exception 'This application does not allow public registration';
  end if;
  if tg_op = 'UPDATE' and lower(new.email) <> lower(old.email) then
    raise exception 'Application email changes require an explicit migration';
  end if;
  return new;
end;
$$;
revoke all on function public.restrict_ems_auth_user() from public, anon, authenticated;
create trigger restrict_ems_auth_user before insert or update of email on auth.users
for each row execute function public.restrict_ems_auth_user();

create function public.create_ems_auth_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.employee_profiles (id, employee_id, email, role)
  values (new.id, case lower(new.email) when 'margaretsubong92@gmail.com' then 'MGR-001' else 'EMP-4092' end,
    lower(new.email), case lower(new.email) when 'margaretsubong92@gmail.com' then 'department_manager' else 'employee' end);
  return new;
end;
$$;
revoke all on function public.create_ems_auth_profile() from public, anon, authenticated;
create trigger create_ems_auth_profile after insert on auth.users
for each row execute function public.create_ems_auth_profile();

insert into public.employee_profiles (id, employee_id, email, role)
select id, case lower(email) when 'margaretsubong92@gmail.com' then 'MGR-001' else 'EMP-4092' end,
  lower(email), case lower(email) when 'margaretsubong92@gmail.com' then 'department_manager' else 'employee' end
from auth.users where lower(email) in ('margaretsubong92@gmail.com', 'danicaacosta544@gmail.com');

create function public.touch_ems_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.touch_ems_profile() from public, anon, authenticated;
create trigger touch_ems_profile before update on public.employee_profiles
for each row execute function public.touch_ems_profile();

create table public.auth_rate_limits (
  key_hash text primary key,
  attempts integer not null default 1,
  window_started_at timestamptz not null default now()
);
alter table public.auth_rate_limits enable row level security;
revoke all on public.auth_rate_limits from anon, authenticated;
grant all on public.auth_rate_limits to service_role;

create function public.take_auth_rate_limit(key_value text, max_attempts integer, window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare result integer;
begin
  delete from public.auth_rate_limits where window_started_at < now() - interval '1 day';
  insert into public.auth_rate_limits (key_hash) values (key_value)
  on conflict (key_hash) do update set
    attempts = case when public.auth_rate_limits.window_started_at <= now() - make_interval(secs => window_seconds)
      then 1 else public.auth_rate_limits.attempts + 1 end,
    window_started_at = case when public.auth_rate_limits.window_started_at <= now() - make_interval(secs => window_seconds)
      then now() else public.auth_rate_limits.window_started_at end
  returning attempts into result;
  return result <= max_attempts;
end;
$$;
revoke all on function public.take_auth_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.take_auth_rate_limit(text, integer, integer) to service_role;

create table public.auth_flows (
  nonce_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  purpose text not null check (purpose in ('activation', 'recovery')),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);
alter table public.auth_flows enable row level security;
revoke all on public.auth_flows from anon, authenticated;
grant all on public.auth_flows to service_role;

create function public.consume_auth_flow(nonce_value text, user_value uuid, session_value uuid, purpose_value text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare consumed text;
begin
  delete from public.auth_flows where expires_at <= now();
  delete from public.auth_flows where nonce_hash = nonce_value and user_id = user_value
    and session_id = session_value and purpose = purpose_value and expires_at > now()
  returning nonce_hash into consumed;
  return consumed is not null;
end;
$$;
revoke all on function public.consume_auth_flow(text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.consume_auth_flow(text, uuid, uuid, text) to service_role;

commit;
