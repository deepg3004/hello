// Client-safe payout constants. Anything that needs to be imported from a
// "use client" component must live here — pulling lib/payouts.ts into the
// client bundle drags in Razorpay/node:crypto.

export const MIN_PAYOUT_AMOUNT = 500; // INR
export const CHARGEBACK_HOLD_DAYS = 3;
export const DISPATCH_DELAY_MINUTES = 5;
