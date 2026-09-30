import { createClient } from '@supabase/supabase-js'

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// En las pruebas este módulo se reemplaza por un cliente falso (ver src/test/setup.js).
export const sb = createClient(SUPA_URL, SUPA_KEY)
