export function getSupabaseErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (/network request failed/i.test(message) || /fetch/i.test(message)) {
    return 'Cannot reach Supabase. Check your EXPO_PUBLIC_SUPABASE_URL, internet connection, or DNS.';
  }

  return message;
}
