import { createClient } from '@supabase/supabase-js'
import { IS_MOCK } from './config'

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// En modo mock (o en tests) no hay credenciales reales — `sb` no debería ni
// instanciarse, para no tronar en createClient() ni intentar conectar a nada.
export const sb = IS_MOCK ? null : createClient(SUPA_URL, SUPA_KEY)
