'use server'

import Stripe from 'stripe'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

// --- 1. INTERNAL HELPER: Connect to Supabase ---
function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Ignored in server actions
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Ignored in server actions
          }
        },
      },
    }
  )
}

// --- 2. THE REFUND ACTION ---
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function refundOrder(orderId: string, paymentIntentId: string) {
  try {
    if (!paymentIntentId) {
      return { success: false, message: 'No payment ID found for this order.' }
    }

    console.log(`Attempting refund for Order ${orderId} (Payment: ${paymentIntentId})`)

    // A. Process Refund in Stripe
    await stripe.refunds.create({
      payment_intent: paymentIntentId,
    })

    // B. Update Order Status in Supabase
    const supabase = createClient()
    const { error } = await supabase
      .from('orders')
      .update({ status: 'refunded' })
      .eq('id', orderId)

    if (error) throw error

    // C. Refresh the Admin Page
    revalidatePath('/admin')
    
    return { success: true, message: 'Refund successful' }
  } catch (error: any) {
    console.error('Refund Error:', error)
    return { success: false, message: error.message || 'Refund failed' }
  }
}