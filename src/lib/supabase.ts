import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'ugc-lab-auth',
  },
})

/**
 * Returns the current authenticated user ID, or throws if not logged in.
 * Used by every insert to explicitly stamp ownership — never rely on DB defaults.
 */
export async function requireUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.')
  return user.id
}
