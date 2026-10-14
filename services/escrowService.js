import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://gguiuhwbyjjaomfblpot.supabase.co',
  'sb_publishable_XsXhQ_lPoEjo4KTTESpEDw_spJZPHlN'
)

// 1. Initiate a trade and lock the seller's funds
export async function createTrade(buyerId, sellerId, assetAmount, fiatAmount) {
  const { data, error } = await supabase.rpc('create_trade', {
    p_buyer_id: buyerId,
    p_seller_id: sellerId,
    p_asset_amount: assetAmount,
    p_fiat_amount: fiatAmount
  })

  if (error) {
    console.error('Error creating trade:', error.message)
    return { success: false, error: error.message }
  }

  return { success: true, tradeId: data }
}

// 2. Release trade funds when the seller confirms payment
export async function releaseTrade(tradeId, sellerId) {
  const { error } = await supabase.rpc('release_trade', {
    p_trade_id: tradeId,
    p_seller_id: sellerId
  })

  if (error) {
    console.error('Error releasing trade:', error.message)
    return { success: false, error: error.message }
  }

  return { success: true }
}
