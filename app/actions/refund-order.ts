'use server'

import Stripe from 'stripe'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

// Helper to get Supabase Client
function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) { try { cookieStore.set({ name, value, ...options }) } catch (error) {} },
        remove(name: string, options: CookieOptions) { try { cookieStore.set({ name, value: '', ...options }) } catch (error) {} },
      },
    }
  )
}

export async function refundOrder(orderId: string, paymentIntentId: string) {
  // 1. SAFETY CHECK: Initialize Stripe INSIDE the function
  if (!process.env.STRIPE_SECRET_KEY) {
    return { success: false, message: 'Server Error: Missing Stripe Key' }
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  try {
    if (!paymentIntentId) {
      return { success: false, message: 'No payment ID found for this order.' }
    }

    console.log(`Processing refund for ${orderId}...`)

    // 2. Process Refund
    await stripe.refunds.create({
      payment_intent: paymentIntentId,
    })

    // 3. Update Database
    const supabase = createClient()
    const { error } = await supabase
      .from('orders')
      .update({ status: 'refunded' })
      .eq('id', orderId)

    if (error) throw error

    // 4. Refresh Page
    revalidatePath('/admin')
    
    return { success: true, message: 'Refund successful' }
  } catch (error: any) {
    console.error('Refund Error:', error)
    return { success: false, message: error.message || 'Refund failed' }
  }
}