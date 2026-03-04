/**
 * Convert Stripe timestamp to ISO string for Supabase
 */
export function toDateTime(timestamp: number): Date {
  return new Date(timestamp * 1000);
}
