import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('TU_SUPABASE')
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

export async function fetchPublicData() {
  if (!supabase) {
    return {
      config: {
        nombre_comunidad: 'Pequeños Exploradores',
        whatsapp_admin: '',
        correo_contacto: '',
        qr_nequi_url: '',
        logo_url: ''
      },
      salidas: [],
      cuposMap: new Map()
    };
  }

  const [cfgRes, salidasRes, inscRes] = await Promise.all([
    supabase.from('configuracion').select('*').eq('id', 1).maybeSingle(),
    supabase.from('salidas').select('*').order('fecha', { ascending: true }),
    supabase.from('inscripciones').select('salida_id, estado, participantes, acompanantes')
  ]);

  if (salidasRes.error) throw salidasRes.error;

  const config = cfgRes.data || {
    nombre_comunidad: 'Pequeños Exploradores',
    whatsapp_admin: '',
    correo_contacto: '',
    qr_nequi_url: '',
    logo_url: ''
  };

  const salidas = salidasRes.data || [];
  const cuposMap = new Map();

  salidas.forEach((s) => {
    cuposMap.set(s.id, { reservados: 0, confirmados: 0 });
  });

  if (inscRes.data) {
    inscRes.data.forEach((insc) => {
      const current = cuposMap.get(insc.salida_id);
      if (current && ['pendiente_pago', 'pago_por_verificar', 'confirmada'].includes(insc.estado)) {
        const numPartes = Array.isArray(insc.participantes) ? insc.participantes.length : 1;
        current.reservados += numPartes;
        if (insc.estado === 'confirmada') {
          current.confirmados += numPartes;
        }
      }
    });
  }

  return { config, salidas, cuposMap };
}

export function subscribeRealtime(onUpdate) {
  if (!supabase) return null;

  const channel = supabase
    .channel('public-db-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public' },
      () => {
        onUpdate();
      }
    )
    .subscribe();

  return channel;
}