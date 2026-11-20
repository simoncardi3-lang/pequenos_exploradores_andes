// ============================================================================
// CONFIGURACIÓN DE SUPABASE
// ============================================================================

// Reemplaza con tus credenciales reales de tu proyecto en Supabase
export const SUPABASE_URL = 'https://nzvehkocsfftarzhyoum.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_bMTLtgg84sPyP-CX0A7nlg_wNA0ytyL';

export function isSupabaseConfigured() {
  return (
    Boolean(SUPABASE_URL) &&
    Boolean(SUPABASE_ANON_KEY) &&
    !SUPABASE_URL.includes('tu-proyecto') &&
    !SUPABASE_ANON_KEY.includes('tu-clave')
  );
}