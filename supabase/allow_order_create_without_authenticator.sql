begin;

drop policy if exists orders_mfa_participant_read on public.p2p_orders;
drop policy if exists orders_participant_read on public.p2p_orders;
create policy orders_participant_read
  on public.p2p_orders for select to authenticated
  using (
    buyer_id = (select auth.uid()) or seller_id = (select auth.uid())
  );
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

commit;
