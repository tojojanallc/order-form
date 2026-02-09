'use server';

// This is a placeholder to fix the build error.
// The actual refund logic was causing crashes.
export async function refundOrder(orderId: string) {
  console.log("Refund function is currently disabled.");
  return { success: false, message: "Refunds disabled temporarily." };
}