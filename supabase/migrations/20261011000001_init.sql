-- QuestAday cloud backend: profiles, synced game records, paid entitlements.
--
-- Design
--  * The app is offline-first. The phone's local ledger is the source of truth
--    for gameplay; the cloud keeps a per-user copy for backup and multi-device
--    sync. Nobody can see anyone else's data: every table has Row Level
--    Security keyed on auth.uid(), and nothing is readable by anonymous users.
--  * Game data is trusted per user (cheating only affects your own account;
--    there are no leaderboards or shared economies). The ONE thing that must
--    not be self-granted is the paid unlock, so entitlements are readable by
--    their owner but writable only by the service role (the verify-purchase
--    function, after Google Play confirms the purchase).
--  * Collect as little as possible: no names, ages or locations are required.
--    A display name is optional and free text is length-limited.

-- ----------------------------------------------------------------- lockdown
revoke all on schema public from public;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

-- ----------------------------------------------------------------- profiles
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default '' check (char_length(display_name) <= 40),
  -- One of the app's built-in avatars (no uploaded photos: nothing personal to store).
  avatar        text not null default 'fox' check (avatar ~ '^[a-z0-9-]{1,32}$'),
  theme         text not null default 'parchment' check (theme ~ '^[a-z0-9-]{1,32}$'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create policy "profiles: read own"   on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- No insert policy: rows are created by the signup trigger. No delete policy: deleting the account cascades.

grant select, update (display_name, avatar, theme) on public.profiles to authenticated;

-- ------------------------------------------------------------ game records
-- One row per local record (task, chore, ledger event, reward, unlock, building,
-- resident, settings/meta). `data` is the record exactly as the app stores it.
create table public.records (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection  text not null check (collection in ('tasks', 'chores', 'events', 'rewards', 'achievements', 'meta', 'city', 'residents')),
  id          text not null check (id ~ '^[A-Za-z0-9_:.-]{1,100}$'),
  data        jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 16384),
  deleted     boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (user_id, collection, id)
);

create index records_sync_idx on public.records (user_id, updated_at);

alter table public.records enable row level security;
alter table public.records force row level security;

create policy "records: read own"   on public.records for select to authenticated using (user_id = (select auth.uid()));
create policy "records: insert own" on public.records for insert to authenticated with check (user_id = (select auth.uid()));
create policy "records: update own" on public.records for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "records: delete own" on public.records for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.records to authenticated;

-- Per-user storage cap, so one account cannot fill the database.
create function public.records_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.records where user_id = new.user_id) >= 60000 then
    raise exception 'storage limit reached' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.records_quota() from public;
create trigger records_quota before insert on public.records for each row execute function public.records_quota();

-- The server sets the timestamp (clients cannot backdate or future-date sync order),
-- and a record's owner and identity cannot be changed by an update.
create function public.records_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.collection <> old.collection or new.id <> old.id) then
    raise exception 'record identity is immutable' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger records_touch before insert or update on public.records for each row execute function public.records_touch();

-- ------------------------------------------------------------ entitlements
create table public.entitlements (
  user_id      uuid not null references auth.users (id) on delete cascade,
  product_id   text not null check (product_id in ('premium_unlock')),
  -- SHA-256 of the Google Play purchase token. Unique, so one purchase cannot unlock many accounts.
  token_sha256 text not null unique check (token_sha256 ~ '^[0-9a-f]{64}$'),
  order_id     text check (char_length(order_id) <= 100),
  status       text not null default 'active' check (status in ('active', 'refunded', 'revoked')),
  granted_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, product_id)
);

alter table public.entitlements enable row level security;
alter table public.entitlements force row level security;

create policy "entitlements: read own" on public.entitlements for select to authenticated using (user_id = (select auth.uid()));
-- Deliberately NO insert/update/delete policy for users: only the service role writes here.
grant select on public.entitlements to authenticated;
grant all on public.entitlements to service_role;
grant all on public.records, public.profiles to service_role;

-- Convenience for the app: does the signed-in user own the paid unlock?
create function public.has_premium() returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.entitlements
    where user_id = (select auth.uid()) and product_id = 'premium_unlock' and status = 'active'
  );
$$;
revoke all on function public.has_premium() from public;
grant execute on function public.has_premium() to authenticated;

-- ----------------------------------------------------------- new accounts
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
revoke all on function public.handle_new_user() from public;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
