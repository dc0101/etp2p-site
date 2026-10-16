import { supabase } from "./supabase.js";

/**
 * Creates a new escrow trade record in the database.
 * @param {string} buyerId 
 * @param {string} sellerId 
 * @param {number} cryptoAmount 
 * @param {number} fiatAmount 
 * @returns {Promise<{success: boolean, tradeId?: string, error?: string}>}
 */
export async function createTrade(buyerId, sellerId, cryptoAmount, fiatAmount) {
  try {
    const { data, error } = await supabase
      .from("trades")
      .insert([
        {
          buyer_id: buyerId,
          seller_id: sellerId,
          crypto_amount: cryptoAmount,
          fiat_amount: fiatAmount,
          status: "active",
          created_at: new Date().toISOString(),
        },
      ])
      .select("id")
      .single();

    if (error) throw error;

    return { success: true, tradeId: data.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Releases an escrow trade, transferring funds from the seller to the buyer.
 * @param {string} tradeId 
 * @param {string} sellerId 
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function releaseTrade(tradeId, sellerId) {
  try {
    // Verify trade exists and is currently active/locked
    const { data: trade, error: fetchError } = await supabase
      .from("trades")
      .select("*")
      .eq("id", tradeId)
      .single();

    if (fetchError || !trade) {
      throw new Error("Trade not found.");
    }

    if (trade.seller_id !== sellerId) {
      throw new Error("Unauthorized: Only the designated seller can release this trade.");
    }

    if (trade.status !== "active") {
      throw new Error(`Trade cannot be released because its status is '${trade.status}'.`);
    }

    // Update trade status to released / completed
    const { error: updateError } = await supabase
      .from("trades")
      .update({
        status: "released",
        updated_at: new Date().toISOString(),
      })
      .eq("id", tradeId);

    if (updateError) throw updateError;

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
