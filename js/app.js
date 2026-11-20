// ============================================================================
// CONTROLADOR PRINCIPAL, ENRUTADOR HASH Y SINCRONIZACIÓN REALTIME
// ============================================================================

import { isSupabaseConfigured } from './config.js';
import { fetchPublicData, subscribeRealtime } from './supabase.js';
import { renderBrandSVG } from './utils.js';
import { renderPublicSalidas } from './salidas.js';
import {
  initInscripcionModule,
  resetInscripcionFlow,
  syncInscripcionView
} from './inscripciones.js';
import {
  checkAdminSession,
  initAdminModule,
  loadAdminData
} from './admin.js';

const appState = {
  config: {
    nombre_comunidad: 'Pequeños Exploradores',
    whatsapp_admin: '',
    correo_contacto: '',
    qr_nequi_url: '',
    logo_url: ''
  },
  salidas: [],
  cuposMap: new Map(),
  selectedSalidaId: null,
  adminUser: null
};

const VALID_ROUTES = ['inicio', 'salidas', 'inscripcion', 'admin'];

async function bootstrap() {
  try {
    initInscripcionModule(appState, refreshAllData);
    initAdminModule(appState, refreshAllData, showGlobalBanner);

    window.addEventListener('hashchange', () => navigateToCurrentHash());

    if (!isSupabaseConfigured()) {
      showGlobalBanner(
        'Configuración pendiente: abre js/config.js y agrega tu SUPABASE_URL y SUPABASE_ANON_KEY.',
        'error',
        false
      );
      document.getElementById('salidas-loading').classList.add('hidden');
      document.getElementById('salidas-empty').classList.remove('hidden');
      renderBrandSlots();
      navigateToCurrentHash();
      return;
    }

    await refreshAllData();
    await checkAdminSession(appState, refreshAllData, showGlobalBanner);

    subscribeRealtime(async () => {
      await refreshAllData();
    });

    navigateToCurrentHash();
  } catch (err) {
    console.error("Error al iniciar la aplicación:", err);
    showGlobalBanner(`Error al iniciar: ${err.message}`, 'error');
  }
}

function renderBrandSlots() {
  try {
    const brandHtml = renderBrandSVG(appState.config?.logo_url);
    
    const headerSlot = document.getElementById('brand-logo-slot');
    const heroSlot = document.getElementById('hero-logo-slot');

    if (headerSlot) headerSlot.innerHTML = brandHtml;
    if (heroSlot) heroSlot.innerHTML = brandHtml;
  } catch (e) {
    console.error("Error renderizando logotipo:", e);
  }
}

async function refreshAllData() {
  try {
    const data = await fetchPublicData();
    appState.config = data.config || appState.config;
    appState.salidas = data.salidas || [];
    appState.cuposMap = data.cuposMap || new Map();

    renderBrandSlots();

    const nombre = appState.config.nombre_comunidad || 'Pequeños Exploradores';
    const headerNameEl = document.getElementById('header-community-name');
    const footerNameEl = document.getElementById('footer-community-name');
    
    if (headerNameEl) headerNameEl.textContent = nombre;
    if (footerNameEl) footerNameEl.textContent = nombre;

    const contactoParts = [];
    if (appState.config.whatsapp_admin) contactoParts.push(`WhatsApp: +${appState.config.whatsapp_admin}`);
    if (appState.config.correo_contacto) contactoParts.push(appState.config.correo_contacto);
    
    const footerContactEl = document.getElementById('footer-contact-info');
    if (footerContactEl) footerContactEl.textContent = contactoParts.join(' · ');

    renderPublicSalidas(appState, (salidaId) => {
      resetInscripcionFlow(appState, salidaId);
      window.location.hash = '#inscripcion';
    });

    syncInscripcionView(appState);
    if (appState.adminUser) {
      await loadAdminData(appState, refreshAllData, showGlobalBanner);
    }
  } catch (err) {
    console.error("Error sincronizando datos:", err);
    showGlobalBanner(`Error de conexión con Supabase: ${err.message}`, 'error');
  }
}

function navigateToCurrentHash() {
  const rawHash = window.location.hash.replace('#', '').split('?')[0];
  const route = VALID_ROUTES.includes(rawHash) ? rawHash : 'inicio';

  document.querySelectorAll('.view-section').forEach((sec) => sec.classList.add('hidden'));
  const targetView = document.getElementById(`view-${route}`);
  if (targetView) targetView.classList.remove('hidden');

  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.route === route);
  });

  if (route === 'inscripcion') {
    syncInscripcionView(appState);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

let bannerTimeout = null;
function showGlobalBanner(message, type = 'info', autoHide = true) {
  const banner = document.getElementById('global-banner');
  if (!banner) return;
  
  banner.textContent = message;
  banner.className = `global-banner banner-${type}`;
  banner.classList.remove('hidden');

  if (bannerTimeout) clearTimeout(bannerTimeout);
  if (autoHide) {
    bannerTimeout = setTimeout(() => {
      banner.classList.add('hidden');
    }, 4500);
  }
}

bootstrap();