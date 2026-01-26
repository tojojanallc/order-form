'use server'

import Stripe from 'stripe'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function refundOrder(orderId: string, paymentIntentId: string) {
  try {
    if (!paymentIntentId) {
      return { success: false, message: 'No payment ID found for this order.' }
    }

    // 1. Process Refund in Stripe
    await stripe.refunds.create({
      payment_intent: paymentIntentId,
    })

    // 2. Update Order Status in Supabase
    const supabase = createClient()
    const { error } = await supabase
      .from('orders')
      .update({ status: 'refunded' })
      .eq('id', orderId)

    if (error) throw error

    // 3. Refresh the Admin Page data automatically
    revalidatePath('/admin')
    
    return { success: true, message: 'Refund successful' }
  } catch (error: any) {
    console.error('Refund Error:', error)
    return { success: false, message: error.message || 'Refund failed' }
  }
}