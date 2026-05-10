import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    "https://dxqiloadpbkxwdgeyhvf.supabase.co",
    "sb_publishable_vv9c362DVCDbI-I6IGtgEA_8fwmVe1R"
  )
}
