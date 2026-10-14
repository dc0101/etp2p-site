-- Etp2p marketplace schema, access policies, and server-validated order RPCs.
-- Run once in Supabase Dashboard > SQL Editor while connected to the Etp2p project.

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  public_handle text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.p2p_ads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  side text not null check (side in ('buy', 'sell')),
  asset text not null default 'USDT' check (asset = 'USDT'),
  currency text not null check (currency in ('ETB', 'USD')),
  price_per_unit numeric(20, 8) not null check (price_per_unit > 0),
  available_amount numeric(20, 8) not null check (available_amount >= 0),
  min_fiat_amount numeric(20, 2) not null,
  max_fiat_amount numeric(20, 2) not null,
  payment_methods text[] not null,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint p2p_ads_trade_limits_valid check (
    min_fiat_amount >= case when currency = 'ETB' then 500 else 3 end
    and max_fiat_amount >= min_fiat_amount
  ),
  constraint p2p_ads_payment_methods_valid check (
    cardinality(payment_methods) between 1 and 6
    and payment_methods <@ array[
      'Commercial Bank of Ethiopia', 'Tele Birr', 'CBE Birr',
      'Bank of Abyssinia', 'Awash Bank', 'Dashen Bank'
    ]::text[]
  ),
  constraint p2p_ads_archives_are_inactive check (archived_at is null or is_active = false)
);

create table if not exists public.p2p_orders (
  id uuid primary key default gen_random_uuid(),
  ad_id uuid not null references public.p2p_ads(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  merchant_handle text not null,
  ad_side text not null check (ad_side in ('buy', 'sell')),
  asset text not null default 'USDT' check (asset = 'USDT'),
  currency text not null check (currency in ('ETB', 'USD')),
  price_per_unit numeric(20, 8) not null check (price_per_unit > 0),
  crypto_amount numeric(20, 8) not null check (crypto_amount > 0),
  fiat_amount numeric(20, 2) not null check (fiat_amount > 0),
  payment_method text not null check (payment_method in (
    'Commercial Bank of Ethiopia', 'Tele Birr', 'CBE Birr',
    'Bank of Abyssinia', 'Awash Bank', 'Dashen Bank'
  )),
  request_key uuid not null,
  status text not null default 'pending' check (status in ('pending', 'payment_marked', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint p2p_orders_participants_differ check (buyer_id <> seller_id),
  constraint p2p_orders_request_once unique (created_by, request_key)
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  table_name text not null,
  record_id uuid not null,
  operation text not null check (operation in ('INSERT', 'UPDATE')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists p2p_ads_market_lookup
  on public.p2p_ads (currency, side, created_at desc)
  where is_active = true and archived_at is null and available_amount > 0;
create index if not exists p2p_ads_owner_history
  on public.p2p_ads (owner_id, created_at desc);
create index if not exists p2p_orders_buyer_history
  on public.p2p_orders (buyer_id, created_at desc);
create index if not exists p2p_orders_seller_history
  on public.p2p_orders (seller_id, created_at desc);
create index if not exists audit_log_record_history
  on public.audit_log (table_name, record_id, created_at desc);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, public_handle)
  values (new.id, 'Trader-' || upper(substr(replace(new.id::text, '-', ''), 1, 12)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists etp2p_create_profile on auth.users;
create trigger etp2p_create_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

-- Create safe public handles for accounts that already exist.
insert into public.profiles (id, public_handle)
select u.id, 'Trader-' || upper(substr(replace(u.id::text, '-', ''), 1, 12))
from auth.users as u
on conflict (id) do nothing;

create or replace function public.block_hard_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Etp2p records are retained; archive or cancel the record instead.'
    using errcode = '42501';
end;
$$;

create or replace function public.log_etp2p_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_id uuid;
begin
  if tg_op = 'INSERT' then
    v_after := to_jsonb(new);
    v_id := (v_after ->> 'id')::uuid;
  else
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    v_id := (v_after ->> 'id')::uuid;
  end if;

  insert into public.audit_log (actor_id, table_name, record_id, operation, before_data, after_data)
  values (auth.uid(), tg_table_name, v_id, tg_op, v_before, v_after);
  return new;
end;
$$;

create or replace function public.guard_p2p_ad_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null or new.owner_id is distinct from auth.uid() then
      raise exception 'An ad must belong to the signed-in user.' using errcode = '42501';
    end if;
    new.id := gen_random_uuid();
    new.asset := 'USDT';
    new.is_active := true;
    new.archived_at := null;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  if current_user not in ('postgres', 'service_role') and old.owner_id is distinct from auth.uid() then
    raise exception 'Only the ad owner can change the ad.' using errcode = '42501';
  end if;
  if new.id is distinct from old.id
     or new.owner_id is distinct from old.owner_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Ad identity and creation time cannot be changed.' using errcode = '42501';
  end if;
  if old.archived_at is not null then
    if current_user not in ('postgres', 'service_role') then
      raise exception 'Archived ads cannot be changed.' using errcode = '42501';
    end if;
    if (to_jsonb(new) - 'available_amount' - 'updated_at') is distinct from
       (to_jsonb(old) - 'available_amount' - 'updated_at') then
      raise exception 'Only a reserved amount may be returned to an archived ad.' using errcode = '42501';
    end if;
    new.updated_at := now();
    return new;
  end if;
  if new.archived_at is not null then new.is_active := false; end if;
  new.asset := 'USDT';
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.touch_order_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists p2p_ads_guard_write on public.p2p_ads;
create trigger p2p_ads_guard_write
  before insert or update on public.p2p_ads
  for each row execute function public.guard_p2p_ad_write();
drop trigger if exists p2p_ads_no_hard_delete on public.p2p_ads;
create trigger p2p_ads_no_hard_delete
  before delete on public.p2p_ads
  for each row execute function public.block_hard_delete();
drop trigger if exists p2p_ads_audit on public.p2p_ads;
create trigger p2p_ads_audit
  after insert or update on public.p2p_ads
  for each row execute function public.log_etp2p_change();

drop trigger if exists p2p_orders_touch_updated_at on public.p2p_orders;
create trigger p2p_orders_touch_updated_at
  before update on public.p2p_orders
  for each row execute function public.touch_order_updated_at();
drop trigger if exists p2p_orders_no_hard_delete on public.p2p_orders;
create trigger p2p_orders_no_hard_delete
  before delete on public.p2p_orders
  for each row execute function public.block_hard_delete();
drop trigger if exists p2p_orders_audit on public.p2p_orders;
create trigger p2p_orders_audit
  after insert or update on public.p2p_orders
  for each row execute function public.log_etp2p_change();

drop trigger if exists profiles_no_hard_delete on public.profiles;
create trigger profiles_no_hard_delete
  before delete on public.profiles
  for each row execute function public.block_hard_delete();
drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit
  after insert or update on public.profiles
  for each row execute function public.log_etp2p_change();

drop trigger if exists audit_log_no_update on public.audit_log;
create trigger audit_log_no_update
  before update or delete on public.audit_log
  for each row execute function public.block_hard_delete();

alter table public.profiles enable row level security;
alter table public.p2p_ads enable row level security;
alter table public.p2p_orders enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists profiles_safe_public_read on public.profiles;
create policy profiles_safe_public_read
  on public.profiles for select to anon, authenticated
  using (true);

drop policy if exists ads_active_public_or_owner_read on public.p2p_ads;
create policy ads_active_public_or_owner_read
  on public.p2p_ads for select to anon, authenticated
  using ((is_active and archived_at is null and available_amount > 0) or owner_id = (select auth.uid()));

drop policy if exists ads_mfa_owner_insert on public.p2p_ads;
create policy ads_mfa_owner_insert
  on public.p2p_ads for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

drop policy if exists ads_mfa_owner_update on public.p2p_ads;
create policy ads_mfa_owner_update
  on public.p2p_ads for update to authenticated
  using (
    owner_id = (select auth.uid())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    owner_id = (select auth.uid())
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

drop policy if exists orders_mfa_participant_read on public.p2p_orders;
drop policy if exists orders_participant_read on public.p2p_orders;
create policy orders_participant_read
  on public.p2p_orders for select to authenticated
  using (
    buyer_id = (select auth.uid()) or seller_id = (select auth.uid())
  );
-- No DELETE, direct order INSERT, or direct order UPDATE policy is created.
revoke all on public.profiles, public.p2p_ads, public.p2p_orders, public.audit_log from public, anon, authenticated;
grant select on public.profiles, public.p2p_ads to anon, authenticated;
grant insert on public.p2p_ads to authenticated;
grant update (side, currency, price_per_unit, available_amount, min_fiat_amount, max_fiat_amount, payment_methods, is_active, archived_at)
  on public.p2p_ads to authenticated;
grant select on public.p2p_orders to authenticated;

create or replace function public.create_p2p_order(
  p_ad_id uuid,
  p_crypto_amount numeric,
  p_payment_method text,
  p_request_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_ad public.p2p_ads%rowtype;
  v_order_id uuid;
  v_crypto numeric(20, 8);
  v_fiat numeric(20, 2);
  v_buyer uuid;
  v_seller uuid;
  v_handle text;
begin
  if v_user is null then raise exception 'Sign in is required.' using errcode = '42501'; end if;
  if p_request_key is null or p_ad_id is null then raise exception 'Order request is incomplete.'; end if;
  if p_crypto_amount is null or p_crypto_amount <= 0 then
    raise exception 'Enter a positive USDT amount.';
  end if;
  v_crypto := round(p_crypto_amount, 8);

  select * into v_ad from public.p2p_ads where id = p_ad_id for update;
  if not found then raise exception 'This ad is no longer active.'; end if;
  if not v_ad.is_active or v_ad.archived_at is not null then
    raise exception 'This ad is no longer active.';
  end if;
  if v_ad.owner_id = v_user then raise exception 'You cannot create an order against your own ad.'; end if;

  -- Serialize orders against one ad, then make retries with the same key idempotent.
  select id into v_order_id from public.p2p_orders
    where created_by = v_user and request_key = p_request_key;
  if v_order_id is not null then return v_order_id; end if;

  if v_crypto > v_ad.available_amount then raise exception 'Not enough USDT remains on this ad.'; end if;
  if not (p_payment_method = any(v_ad.payment_methods)) then
    raise exception 'Choose a payment method offered on this ad.';
  end if;
  v_fiat := round(v_crypto * v_ad.price_per_unit, 2);
  if v_fiat < v_ad.min_fiat_amount or v_fiat > v_ad.max_fiat_amount then
    raise exception 'Order amount is outside the ad limits.';
  end if;
  if v_ad.side = 'sell' then
    v_buyer := v_user;
    v_seller := v_ad.owner_id;
  else
    v_buyer := v_ad.owner_id;
    v_seller := v_user;
  end if;
  select public_handle into v_handle from public.profiles where id = v_ad.owner_id;

  update public.p2p_ads
    set available_amount = available_amount - v_crypto
    where id = v_ad.id;

  begin
    insert into public.p2p_orders (
      ad_id, created_by, buyer_id, seller_id, merchant_handle, ad_side,
      asset, currency, price_per_unit, crypto_amount, fiat_amount,
      payment_method, request_key, status
    ) values (
      v_ad.id, v_user, v_buyer, v_seller, coalesce(v_handle, 'Etp2p merchant'), v_ad.side,
      v_ad.asset, v_ad.currency, v_ad.price_per_unit, v_crypto, v_fiat,
      p_payment_method, p_request_key, 'pending'
    ) returning id into v_order_id;
  exception when unique_violation then
    update public.p2p_ads set available_amount = available_amount + v_crypto where id = v_ad.id;
    select id into v_order_id from public.p2p_orders
      where created_by = v_user and request_key = p_request_key;
    if v_order_id is null then raise; end if;
  end;
  return v_order_id;
end;
$$;

create or replace function public.update_p2p_order(p_order_id uuid, p_action text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_order public.p2p_orders%rowtype;
  v_next_status text;
begin
  if v_user is null then raise exception 'Sign in is required.' using errcode = '42501'; end if;
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'Authenticator verification is required.' using errcode = '42501';
  end if;
  select * into v_order from public.p2p_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;

  if p_action = 'mark_paid' and v_user = v_order.buyer_id and v_order.status = 'pending' then
    v_next_status := 'payment_marked';
  elsif p_action = 'complete' and v_user = v_order.seller_id and v_order.status = 'payment_marked' then
    v_next_status := 'completed';
  elsif p_action = 'cancel' and v_user in (v_order.buyer_id, v_order.seller_id) and v_order.status = 'pending' then
    v_next_status := 'cancelled';
  else
    raise exception 'That action is not allowed for this order in its current state.' using errcode = '42501';
  end if;

  update public.p2p_orders set status = v_next_status where id = v_order.id;
  if v_next_status = 'cancelled' then
    update public.p2p_ads
      set available_amount = available_amount + v_order.crypto_amount
      where id = v_order.ad_id;
  end if;
  return v_next_status;
end;
$$;

revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;
revoke all on function public.block_hard_delete() from public, anon, authenticated;
revoke all on function public.log_etp2p_change() from public, anon, authenticated;
revoke all on function public.guard_p2p_ad_write() from public, anon, authenticated;
revoke all on function public.touch_order_updated_at() from public, anon, authenticated;
revoke all on function public.create_p2p_order(uuid, numeric, text, uuid) from public, anon, authenticated;
revoke all on function public.update_p2p_order(uuid, text) from public, anon, authenticated;
grant execute on function public.create_p2p_order(uuid, numeric, text, uuid) to authenticated;
grant execute on function public.update_p2p_order(uuid, text) to authenticated;

commit;
