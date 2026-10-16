// Etp2p browser client. The publishable key is intentionally public; database
// safety comes from the RLS policies in ../supabase/schema.sql.
const PROJECT_URL = "https://gguiuhwbyjjaomfblpot.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_XsXhQ_lPoEjo4KTTESpEDw_spJZPHlN";

if (!window.supabase?.createClient) {
  throw new Error("Supabase could not load. Check your connection and reload.");
}

export const supabase = window.supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
    persistSession: true,
  },
});

const AD_COLUMNS = "id,owner_id,side,asset,currency,price_per_unit,available_amount,min_fiat_amount,max_fiat_amount,payment_methods,is_active,archived_at,created_at,updated_at";
const ORDER_COLUMNS = "id,ad_id,created_by,buyer_id,seller_id,merchant_handle,ad_side,asset,currency,price_per_unit,crypto_amount,fiat_amount,payment_method,status,created_at,updated_at";

export async function listAds({ side, currency, payment, amount, amountUnit, offset = 0, limit = 50 }) {
  let query = supabase
    .from("p2p_ads")
    .select(AD_COLUMNS)
    .eq("is_active", true)
    .gt("available_amount", 0)
    .eq("currency", currency)
    .eq("side", side)
    .order("price_per_unit", { ascending: side === "sell" })
    .order("created_at", { ascending: false });

  if (payment && payment !== "all") query = query.contains("payment_methods", [payment]);
  if (amount > 0 && amountUnit === "crypto") query = query.gte("available_amount", amount);
  if (amount > 0 && amountUnit === "fiat") {
    query = query.lte("min_fiat_amount", amount).gte("max_fiat_amount", amount);
  }

  return query.range(offset, offset + limit - 1);
}

export async function listProfiles(userIds) {
  if (!userIds.length) return { data: [], error: null };
  return supabase.from("profiles").select("id,public_handle").in("id", userIds);
}

export async function listMyAds(userId) {
  return supabase
    .from("p2p_ads")
    .select(AD_COLUMNS)
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
}

export async function createAd(ad) {
  return supabase.from("p2p_ads").insert(ad).select(AD_COLUMNS).single();
}

export async function updateAd(id, changes) {
  return supabase.from("p2p_ads").update(changes).eq("id", id).select(AD_COLUMNS).single();
}

export async function listMyOrders() {
  return supabase
    .from("p2p_orders")
    .select(ORDER_COLUMNS)
    .order("created_at", { ascending: false });
}

export async function createOrder({ adId, cryptoAmount, paymentMethod, requestKey }) {
  return supabase.rpc("create_p2p_order", {
    p_ad_id: adId,
    p_crypto_amount: cryptoAmount,
    p_payment_method: paymentMethod,
    p_request_key: requestKey,
  });
}

export async function transitionOrder(orderId, action) {
  return supabase.rpc("update_p2p_order", {
    p_order_id: orderId,
    p_action: action,
  });
}
