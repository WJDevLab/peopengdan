"use client";

import { createBrowserClient } from "@supabase/ssr";

/** 브라우저용 클라이언트. anon 키만 쓰며 RLS가 걸려 있다. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
