-- Row Level Security tests. Run by supabase/tests/run.sh against a throwaway database.
\set ON_ERROR_STOP on
\set QUIET on

create function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', label; end if;
  raise notice 'ok    %', label;
end $$;

-- Two players sign up. The trigger gives each a profile.
insert into auth.users values ('11111111-1111-1111-1111-111111111111', 'a@example.com'), ('22222222-2222-2222-2222-222222222222', 'b@example.com');
select pg_temp.check((select count(*) from public.profiles) = 2, 'signup creates a profile for each user');

-- ---------------------------------------------------------------- player A
begin;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into public.records (collection, id, data) values ('tasks', 't1', '{"title":"A secret quest"}');
insert into public.records (collection, id, data) values ('events', 'task:t1:1', '{"xp":25}');
update public.profiles set display_name = 'Ada' where id = auth.uid();
select pg_temp.check((select count(*) from public.records) = 2, 'A sees own records');
select pg_temp.check((select count(*) from public.profiles) = 1, 'A sees only own profile');
select pg_temp.check(not public.has_premium(), 'A has no premium by default');
commit;

-- ---------------------------------------------------------------- player B
begin;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check((select count(*) from public.records) = 0, 'B cannot see A''s records');
select pg_temp.check((select count(*) from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 0, 'B cannot see A''s profile');
update public.records set data = '{"title":"hacked"}' where user_id = '11111111-1111-1111-1111-111111111111';
delete from public.records where user_id = '11111111-1111-1111-1111-111111111111';
update public.profiles set display_name = 'hacked' where id = '11111111-1111-1111-1111-111111111111';
commit;
select pg_temp.check((select data->>'title' from public.records where id = 't1') = 'A secret quest', 'B''s update/delete of A''s data had no effect');
select pg_temp.check((select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'Ada', 'B cannot rename A');

-- B cannot write a row into A's account.
do $$ begin
  perform pg_temp.as_user('22222222-2222-2222-2222-222222222222');
  begin
    insert into public.records (user_id, collection, id, data) values ('11111111-1111-1111-1111-111111111111', 'tasks', 'evil', '{}');
    raise exception 'FAIL: B inserted into A''s account';
  exception when insufficient_privilege then raise notice 'ok    B cannot insert into A''s account';
  end;
  reset role;
end $$;

-- B cannot move own row into A's account.
do $$ begin
  perform pg_temp.as_user('22222222-2222-2222-2222-222222222222');
  insert into public.records (collection, id, data) values ('tasks', 'b1', '{}');
  begin
    update public.records set user_id = '11111111-1111-1111-1111-111111111111' where id = 'b1';
    raise exception 'FAIL: B moved a row to A';
  exception when insufficient_privilege or raise_exception then raise notice 'ok    B cannot hand a row to A';
  end;
  reset role;
end $$;

-- Nobody can grant themselves the paid unlock.
do $$ begin
  perform pg_temp.as_user('22222222-2222-2222-2222-222222222222');
  begin
    insert into public.entitlements (user_id, product_id, token_sha256) values (auth.uid(), 'premium_unlock', repeat('a', 64));
    raise exception 'FAIL: self-granted premium';
  exception when insufficient_privilege then raise notice 'ok    users cannot grant themselves premium';
  end;
  reset role;
end $$;

-- Users cannot change protected profile columns (id, timestamps).
do $$ begin
  perform pg_temp.as_user('22222222-2222-2222-2222-222222222222');
  begin
    update public.profiles set created_at = now() - interval '9 years' where id = auth.uid();
    raise exception 'FAIL: changed created_at';
  exception when insufficient_privilege then raise notice 'ok    profile timestamps are read-only';
  end;
  reset role;
end $$;

-- Oversized or malformed records are refused.
do $$ begin
  perform pg_temp.as_user('22222222-2222-2222-2222-222222222222');
  begin
    insert into public.records (collection, id, data) values ('tasks', 'big', json_build_object('x', repeat('z', 20000))::jsonb);
    raise exception 'FAIL: oversized record accepted';
  exception when check_violation then raise notice 'ok    oversized records are refused';
  end;
  begin
    insert into public.records (collection, id, data) values ('passwords', 'x', '{}');
    raise exception 'FAIL: unknown collection accepted';
  exception when check_violation then raise notice 'ok    unknown collections are refused';
  end;
  begin
    insert into public.records (collection, id, data) values ('tasks', '../../etc', '{}');
    raise exception 'FAIL: bad id accepted';
  exception when check_violation then raise notice 'ok    malformed ids are refused';
  end;
  reset role;
end $$;

-- Anonymous visitors see and change nothing.
do $$ declare n int; begin
  execute 'set local role anon';
  begin
    select count(*) into n from public.records;
    raise exception 'FAIL: anon read records';
  exception when insufficient_privilege then raise notice 'ok    anonymous users cannot read records';
  end;
  begin
    select count(*) into n from public.profiles;
    raise exception 'FAIL: anon read profiles';
  exception when insufficient_privilege then raise notice 'ok    anonymous users cannot read profiles';
  end;
  reset role;
end $$;

-- The purchase function (service role) grants premium; the owner can then read it, others cannot.
begin;
set local role service_role;
insert into public.entitlements (user_id, product_id, token_sha256, order_id) values ('11111111-1111-1111-1111-111111111111', 'premium_unlock', repeat('b', 64), 'GPA.1234');
commit;
begin;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.check(public.has_premium(), 'premium granted by the server is visible to its owner');
commit;
begin;
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check(not public.has_premium() and (select count(*) from public.entitlements) = 0, 'other users cannot see or share it');
commit;

-- A refund recorded by the RevenueCat webhook (service role) turns Premium off.
begin;
set local role service_role;
update public.entitlements set status = 'refunded' where user_id = '11111111-1111-1111-1111-111111111111';
commit;
begin;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.check(not public.has_premium(), 'a refunded purchase no longer counts as premium');
commit;
begin;
set local role service_role;
update public.entitlements set status = 'active' where user_id = '11111111-1111-1111-1111-111111111111';
commit;

-- One purchase token cannot unlock a second account.
do $$ begin
  begin
    insert into public.entitlements (user_id, product_id, token_sha256) values ('22222222-2222-2222-2222-222222222222', 'premium_unlock', repeat('b', 64));
    raise exception 'FAIL: token reused';
  exception when unique_violation then raise notice 'ok    a purchase token cannot be reused on another account';
  end;
end $$;

-- Server-set timestamps: a client cannot backdate sync order.
begin;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into public.records (collection, id, data, updated_at) values ('tasks', 't2', '{}', '2000-01-01');
select pg_temp.check((select updated_at > now() - interval '1 minute' from public.records where id = 't2'), 'updated_at is set by the server');
commit;

-- Deleting an account removes everything that belonged to it.
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select pg_temp.check((select count(*) from public.records where user_id = '11111111-1111-1111-1111-111111111111') = 0
  and (select count(*) from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 0
  and (select count(*) from public.entitlements where user_id = '11111111-1111-1111-1111-111111111111') = 0, 'deleting an account erases its profile, records and entitlements');

\echo 'All RLS tests passed.'
