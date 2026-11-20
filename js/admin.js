// ============================================================================
// PANEL ADMINISTRATIVO CON CONFIGURACIÓN DE CAMPOS Y LISTAS
// ============================================================================

import { supabase } from './supabase.js';
import {
  copyToClipboard,
  downloadCSV,
  escapeHTML,
  formatCOP,
  formatDateES
} from './utils.js';

let adminInscripciones = [];
let modalCustomFields = [];

const STATUS_NAMES = {
  pendiente_pago: 'Pendiente de pago',
  pago_por_verificar: 'Pago por verificar',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  reembolsada: 'Reembolsada'
};

const ADMIN_PASSWORD_SECRET = 'Zxc$%&951';

export function initAdminModule(state, refreshAllData, notifyBanner) {
  document.getElementById('form-admin-login').addEventListener('submit', (e) => {
    e.preventDefault();
    const pass = document.getElementById('admin-password').value;
    const errBox = document.getElementById('admin-login-error');

    errBox.classList.add('hidden');

    if (pass === ADMIN_PASSWORD_SECRET) {
      state.adminUser = { email: 'Coordinación' };
      localStorage.setItem('pe_admin_logged', 'true');
      toggleAdminAuthUI(true, 'Coordinación General');
      loadAdminData(state, refreshAllData, notifyBanner);
    } else {
      errBox.textContent = 'Contraseña incorrecta.';
      errBox.classList.remove('hidden');
    }
  });

  document.getElementById('btn-admin-logout').addEventListener('click', () => {
    state.adminUser = null;
    localStorage.removeItem('pe_admin_logged');
    toggleAdminAuthUI(false);
  });

  document.querySelectorAll('.admin-tab').forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.admin-tab-panel').forEach((p) => p.classList.add('hidden'));
      tabBtn.classList.add('active');
      document.getElementById(tabBtn.dataset.tab).classList.remove('hidden');
    });
  });

  document.getElementById('btn-nueva-salida').addEventListener('click', () => {
    openSalidaModal(null);
  });

  document.getElementById('btn-close-modal-salida').addEventListener('click', closeSalidaModal);
  document.getElementById('btn-cancel-modal-salida').addEventListener('click', closeSalidaModal);

  document.getElementById('sal-gratuita').addEventListener('change', (e) => {
    const precioInput = document.getElementById('sal-precio');
    if (e.target.checked) {
      precioInput.value = 0;
      precioInput.disabled = true;
    } else {
      precioInput.disabled = false;
      if (Number(precioInput.value) === 0) precioInput.value = 25000;
    }
  });

  // PRESETS PARTICIPANTES
  document.querySelectorAll('.chip-btn').forEach((chip) => {
    chip.addEventListener('click', () => {
      addCustomFieldToModal(chip.dataset.preset);
    });
  });

  document.getElementById('btn-agregar-campo-personalizado').addEventListener('click', () => {
    const inp = document.getElementById('inp-nuevo-campo-nombre');
    if (inp.value.trim()) {
      addCustomFieldToModal(inp.value.trim());
      inp.value = '';
    }
  });

  document.getElementById('form-modal-salida').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveSalidaFromModal(refreshAllData, notifyBanner);
  });

  document.getElementById('filter-inscripcion-search').addEventListener('input', () => {
    renderAdminInscripcionesTable(state, refreshAllData, notifyBanner);
  });
  document.getElementById('filter-inscripcion-salida').addEventListener('change', () => {
    renderAdminInscripcionesTable(state, refreshAllData, notifyBanner);
  });
  document.getElementById('filter-inscripcion-estado').addEventListener('change', () => {
    renderAdminInscripcionesTable(state, refreshAllData, notifyBanner);
  });

  document.getElementById('btn-export-csv').addEventListener('click', () => {
    exportInscripcionesCSV(state);
  });

  document.getElementById('form-admin-config').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveCommunityConfig(refreshAllData, notifyBanner);
  });

  document.getElementById('inp-qr-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadNequiQRFile(file, refreshAllData, notifyBanner);
    }
  });

  document.getElementById('btn-remove-qr').addEventListener('click', async () => {
    await supabase.from('configuracion').update({ qr_nequi_url: '' }).eq('id', 1);
    await refreshAllData();
    notifyBanner('Imagen de QR eliminada.', 'success');
  });

  document.getElementById('inp-logo-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadLogoFile(file, refreshAllData, notifyBanner);
    }
  });

  document.getElementById('btn-remove-logo').addEventListener('click', async () => {
    await supabase.from('configuracion').update({ logo_url: '' }).eq('id', 1);
    await refreshAllData();
    notifyBanner('Logotipo restaurado al emblema por defecto.', 'success');
  });
}

export function checkAdminSession(state, refreshAllData, notifyBanner) {
  const isLogged = localStorage.getItem('pe_admin_logged') === 'true';
  if (isLogged) {
    state.adminUser = { email: 'Coordinación' };
    toggleAdminAuthUI(true, 'Coordinación General');
    loadAdminData(state, refreshAllData, notifyBanner);
  } else {
    toggleAdminAuthUI(false);
  }
}

function toggleAdminAuthUI(isAuthenticated, email = '') {
  const loginBox = document.getElementById('admin-login-box');
  const dashBox = document.getElementById('admin-dashboard-box');
  const navBadge = document.getElementById('nav-admin-badge');

  if (isAuthenticated) {
    loginBox.classList.add('hidden');
    dashBox.classList.remove('hidden');
    navBadge.classList.remove('hidden');
    document.getElementById('admin-user-email').textContent = `Sesión activa: ${email}`;
  } else {
    loginBox.classList.remove('hidden');
    dashBox.classList.add('hidden');
    navBadge.classList.add('hidden');
  }
}

export async function loadAdminData(state, refreshAllData, notifyBanner) {
  if (!state.adminUser || !supabase) return;

  const { data, error } = await supabase
    .from('inscripciones')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    notifyBanner(`Error cargando inscripciones: ${error.message}`, 'error');
    return;
  }

  const ahora = new Date().getTime();
  const TREINTA_MIN_MS = 30 * 60 * 1000;

  adminInscripciones = (data || []).filter((insc) => {
    if (insc.estado === 'cancelada') {
      const tiempoCancelacion = new Date(insc.updated_at || insc.created_at).getTime();
      if (ahora - tiempoCancelacion > TREINTA_MIN_MS) {
        return false;
      }
    }
    return true;
  });

  renderAdminKPIs(state);
  renderAdminSalidasAndLists(state, refreshAllData, notifyBanner);
  populateSalidaFilter(state);
  renderAdminInscripcionesTable(state, refreshAllData, notifyBanner);
  populateConfigForm(state);
}

function renderAdminKPIs(state) {
  const abiertas = state.salidas.filter((s) => s.estado === 'abierta').length;
  const porVerificar = adminInscripciones.filter((i) => i.estado === 'pago_por_verificar').length;
  const pendientes = adminInscripciones.filter((i) => i.estado === 'pendiente_pago').length;
  const confirmadas = adminInscripciones.filter((i) => i.estado === 'confirmada');
  const recaudo = confirmadas.reduce((acc, item) => acc + Number(item.valor_verificado ?? item.total_pagar ?? 0), 0);

  document.getElementById('kpi-salidas').textContent = String(abiertas);
  document.getElementById('kpi-por-verificar').textContent = String(porVerificar);
  document.getElementById('kpi-pendientes').textContent = String(pendientes);
  document.getElementById('kpi-confirmadas').textContent = String(confirmadas.length);
  document.getElementById('kpi-recaudo').textContent = formatCOP(recaudo);
}

function renderAdminSalidasAndLists(state, refreshAllData, notifyBanner) {
  const container = document.getElementById('admin-salidas-list');
  if (state.salidas.length === 0) {
    container.innerHTML = `<div class="state-box"><p>No has creado ninguna salida todavía. Haz clic en "+ Crear Nueva Salida".</p></div>`;
    return;
  }

  container.innerHTML = state.salidas
    .map((salida) => {
      const inscDeSalida = adminInscripciones.filter(
        (i) => i.salida_id === salida.id && ['pendiente_pago', 'pago_por_verificar', 'confirmada'].includes(i.estado)
      );

      const cupoInfo = state.cuposMap.get(salida.id) || { reservados: 0, confirmados: 0 };

      const filasParticipantes = [];
      inscDeSalida.forEach((insc) => {
        (insc.participantes || []).forEach((p) => {
          const extrasStr = Object.entries(p.extra || {})
            .map(([k, v]) => `${k}: ${v}`)
            .join(' | ');

          filasParticipantes.push({
            vistaCorta: `${p.nombre} — ${p.edad} años`,
            lineaCompleta: `${p.nombre} — ${p.edad} años${extrasStr ? ' | ' + extrasStr : ''} | Código: ${insc.codigo} | Estado: ${STATUS_NAMES[insc.estado]}${
              insc.acudiente_nombre && insc.acudiente_nombre !== 'Sin acudiente' ? ` | Acudiente: ${insc.acudiente_nombre}` : ''
            }${insc.whatsapp && insc.whatsapp !== 'Sin teléfono' ? ` | WhatsApp: ${insc.whatsapp}` : ''}`
          });
        });

        if (salida.incluir_acudientes_lista) {
          if (insc.acudiente_nombre && insc.acudiente_nombre !== 'Sin acudiente') {
            filasParticipantes.push({
              vistaCorta: `${insc.acudiente_nombre} (Acudiente)`,
              lineaCompleta: `${insc.acudiente_nombre} (Acudiente) | Código: ${insc.codigo} | WhatsApp: ${insc.whatsapp}`
            });
          }
        }
      });

      const textoCopiar =
        filasParticipantes.length > 0
          ? filasParticipantes.map((item, idx) => `${idx + 1}. ${item.lineaCompleta}`).join('\n')
          : '';

      return `
        <div class="admin-salida-card">
          <div class="admin-salida-head">
            <div>
              <span class="badge-estado estado-${escapeHTML(salida.estado)}">${escapeHTML(salida.estado)}</span>
              <h3 style="margin:8px 0 4px;">${escapeHTML(salida.nombre)}</h3>
              <p class="form-hint">
                ${escapeHTML(formatDateES(salida.fecha))} · ${escapeHTML(salida.hora)} · ${escapeHTML(salida.ubicacion)}<br/>
                Valor: <strong>${salida.es_gratuita ? 'Sin costo ($0)' : formatCOP(salida.precio_familia) + ' / familia'}</strong> ·
                Cupos: <strong>${cupoInfo.confirmados} confirmados</strong> / ${cupoInfo.reservados} reservados (Máx. ${salida.cupo_maximo})
              </p>
            </div>
            <div class="admin-salida-actions">
              <button type="button" class="btn btn-outline btn-sm btn-edit-salida" data-id="${escapeHTML(salida.id)}">Editar</button>
              <button type="button" class="btn btn-danger-ghost btn-sm btn-del-salida" data-id="${escapeHTML(salida.id)}" data-nombre="${escapeHTML(salida.nombre)}">Eliminar</button>
            </div>
          </div>

          <div class="enumerated-box">
            <div class="enumerated-head">
              <strong>Lista enumerada de asistencia (${filasParticipantes.length})</strong>
              <button
                type="button"
                class="btn btn-outline btn-sm btn-copy-lista"
                data-copy="${escapeHTML(textoCopiar)}"
                ${filasParticipantes.length === 0 ? 'disabled' : ''}
              >
                Copiar lista completa (1 por línea)
              </button>
            </div>
            ${
              filasParticipantes.length > 0
                ? `<ol class="enumerated-list">${filasParticipantes
                    .map((f) => `<li>${escapeHTML(f.vistaCorta)}</li>`)
                    .join('')}</ol>`
                : `<p class="form-hint">Aún no hay participantes inscritos en esta salida.</p>`
            }
          </div>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('.btn-edit-salida').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sal = state.salidas.find((s) => s.id === btn.dataset.id);
      if (sal) openSalidaModal(sal);
    });
  });

  container.querySelectorAll('.btn-del-salida').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = window.confirm(
        `¿Seguro que deseas eliminar la salida "${btn.dataset.nombre}" y todas sus inscripciones asociadas?`
      );
      if (!ok) return;
      const { error } = await supabase.from('salidas').delete().eq('id', btn.dataset.id);
      if (error) {
        notifyBanner(`Error al eliminar: ${error.message}`, 'error');
      } else {
        notifyBanner('Salida eliminada correctamente.', 'success');
        await refreshAllData();
      }
    });
  });

  container.querySelectorAll('.btn-copy-lista').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await copyToClipboard(btn.dataset.copy);
      const original = btn.textContent;
      btn.textContent = '¡Lista copiada al portapapeles!';
      setTimeout(() => {
        btn.textContent = original;
      }, 2200);
    });
  });
}

function populateSalidaFilter(state) {
  const select = document.getElementById('filter-inscripcion-salida');
  const current = select.value;
  select.innerHTML =
    `<option value="">Todas las salidas</option>` +
    state.salidas
      .map((s) => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.nombre)}</option>`)
      .join('');
  select.value = current;
}

function renderAdminInscripcionesTable(state, refreshAllData, notifyBanner) {
  const tbody = document.getElementById('admin-inscripciones-tbody');
  const search = document.getElementById('filter-inscripcion-search').value.trim().toLowerCase();
  const salidaId = document.getElementById('filter-inscripcion-salida').value;
  const estado = document.getElementById('filter-inscripcion-estado').value;

  const filtered = adminInscripciones.filter((insc) => {
    if (salidaId && insc.salida_id !== salidaId) return false;
    if (estado && insc.estado !== estado) return false;
    if (search) {
      const blob = [
        insc.codigo,
        insc.acudiente_nombre,
        insc.whatsapp,
        ...(insc.participantes || []).map((p) => p.nombre)
      ]
        .join(' ')
        .toLowerCase();
      if (!blob.includes(search)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">No hay inscripciones que coincidan con los filtros.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map((insc) => {
      const salida = state.salidas.find((s) => s.id === insc.salida_id);
      const partHtml = (insc.participantes || [])
        .map((p) => {
          const extrasStr = Object.entries(p.extra || {})
            .map(([k, v]) => `<div><small>${escapeHTML(k)}: ${escapeHTML(v)}</small></div>`)
            .join('');
          return `<div>• <strong>${escapeHTML(p.nombre)}</strong> (${p.edad} años)${extrasStr}</div>`;
        })
        .join('');

      return `
        <tr>
          <td><strong>${escapeHTML(insc.codigo)}</strong></td>
          <td>${escapeHTML(salida?.nombre || 'Salida eliminada')}</td>
          <td>
            ${insc.acudiente_nombre && insc.acudiente_nombre !== 'Sin acudiente' ? `<strong>${escapeHTML(insc.acudiente_nombre)}</strong><br/>` : '<span style="color:var(--text-muted);">Sin acudiente</span>'}
            ${insc.whatsapp && insc.whatsapp !== 'Sin teléfono' ? `<span>WA: ${escapeHTML(insc.whatsapp)}</span>` : ''}
            ${insc.correo ? `<br/><small>${escapeHTML(insc.correo)}</small>` : ''}
          </td>
          <td>${partHtml}</td>
          <td><strong>${formatCOP(insc.total_pagar)}</strong></td>
          <td>
            <span class="status-chip st-${escapeHTML(insc.estado)}">${escapeHTML(STATUS_NAMES[insc.estado] || insc.estado)}</span>
          </td>
          <td>
            <div class="table-actions">
              ${
                insc.estado !== 'confirmada'
                  ? `<button type="button" class="btn btn-primary btn-sm btn-confirm-pago" data-id="${escapeHTML(insc.id)}" data-valor="${insc.total_pagar}">Aprobar y Confirmar</button>`
                  : ''
              }
              ${
                insc.estado !== 'cancelada'
                  ? `<button type="button" class="btn btn-danger-ghost btn-sm btn-cancel-insc" data-id="${escapeHTML(insc.id)}">Cancelar</button>`
                  : ''
              }
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  tbody.querySelectorAll('.btn-confirm-pago').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { error } = await supabase
        .from('inscripciones')
        .update({
          estado: 'confirmada',
          valor_verificado: Number(btn.dataset.valor || 0),
          fecha_verificacion: new Date().toISOString()
        })
        .eq('id', btn.dataset.id);

      if (error) {
        notifyBanner(`Error al confirmar: ${error.message}`, 'error');
      } else {
        notifyBanner('Inscripción confirmada y cupo actualizado.', 'success');
        await refreshAllData();
      }
    });
  });

  tbody.querySelectorAll('.btn-cancel-insc').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!window.confirm('¿Deseas cancelar esta inscripción y liberar su cupo?')) return;
      const { error } = await supabase
        .from('inscripciones')
        .update({ estado: 'cancelada', updated_at: new Date().toISOString() })
        .eq('id', btn.dataset.id);

      if (error) {
        notifyBanner(`Error al cancelar: ${error.message}`, 'error');
      } else {
        notifyBanner('Inscripción cancelada.', 'success');
        await refreshAllData();
      }
    });
  });
}

function openSalidaModal(salida = null) {
  const modal = document.getElementById('modal-salida');
  document.getElementById('modal-salida-title').textContent = salida ? 'Editar Salida' : 'Crear Nueva Salida';

  document.getElementById('sal-id').value = salida?.id || '';
  document.getElementById('sal-nombre').value = salida?.nombre || '';
  document.getElementById('sal-descripcion').value = salida?.descripcion || '';
  document.getElementById('sal-fecha').value = salida?.fecha || '';
  document.getElementById('sal-hora').value = salida?.hora || '';
  document.getElementById('sal-ubicacion').value = salida?.ubicacion || '';
  document.getElementById('sal-punto').value = salida?.punto_encuentro || '';

  const esSinCosto = Boolean(salida?.es_gratuita);
  document.getElementById('sal-gratuita').checked = esSinCosto;
  const precioInp = document.getElementById('sal-precio');
  precioInp.value = esSinCosto ? 0 : (salida?.precio_familia ?? 25000);
  precioInp.disabled = esSinCosto;

  document.getElementById('sal-cupo').value = salida?.cupo_maximo ?? 25;
  document.getElementById('sal-estado').value = salida?.estado || 'abierta';
  document.getElementById('sal-recomendaciones').value = salida?.recomendaciones || '';
  
  document.getElementById('sal-requiere-acudiente').checked = salida ? salida.requiere_acudiente !== false : true;
  document.getElementById('sal-solicitar-correo').checked = Boolean(salida?.solicitar_correo);
  document.getElementById('sal-incluir-acudientes-lista').checked = Boolean(salida?.incluir_acudientes_lista);

  modalCustomFields = Array.isArray(salida?.campos_personalizados)
    ? JSON.parse(JSON.stringify(salida.campos_personalizados))
    : [];
  renderModalCustomFields();

  modal.classList.remove('hidden');
}

function closeSalidaModal() {
  document.getElementById('modal-salida').classList.add('hidden');
}

function addCustomFieldToModal(label) {
  if (modalCustomFields.some((f) => f.label.toLowerCase() === label.toLowerCase())) return;
  modalCustomFields.push({ label, visible: true, required: true });
  renderModalCustomFields();
}

function renderModalCustomFields() {
  const container = document.getElementById('modal-campos-lista');
  if (modalCustomFields.length === 0) {
    container.innerHTML = `<p class="form-hint">No hay campos personalizados adicionales por participante.</p>`;
    return;
  }

  container.innerHTML = modalCustomFields
    .map(
      (f, idx) => `
      <div class="custom-field-item">
        <strong>${escapeHTML(f.label)}</strong>
        <div class="custom-field-controls">
          <label class="checkbox-label">
            <input type="checkbox" class="cf-vis" data-idx="${idx}" ${f.visible !== false ? 'checked' : ''} />
            <span>Mostrar</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" class="cf-req" data-idx="${idx}" ${f.required ? 'checked' : ''} />
            <span>Obligatorio</span>
          </label>
          <button type="button" class="btn btn-danger-ghost btn-sm cf-del" data-idx="${idx}">Quitar</button>
        </div>
      </div>
    `
    )
    .join('');

  container.querySelectorAll('.cf-vis').forEach((chk) => {
    chk.addEventListener('change', (e) => {
      modalCustomFields[Number(e.target.dataset.idx)].visible = e.target.checked;
    });
  });
  container.querySelectorAll('.cf-req').forEach((chk) => {
    chk.addEventListener('change', (e) => {
      modalCustomFields[Number(e.target.dataset.idx)].required = e.target.checked;
    });
  });
  container.querySelectorAll('.cf-del').forEach((btn) => {
    btn.addEventListener('click', () => {
      modalCustomFields.splice(Number(btn.dataset.idx), 1);
      renderModalCustomFields();
    });
  });
}

async function saveSalidaFromModal(refreshAllData, notifyBanner) {
  const id = document.getElementById('sal-id').value;
  const esSinCosto = document.getElementById('sal-gratuita').checked;

  const payload = {
    nombre: document.getElementById('sal-nombre').value.trim(),
    descripcion: document.getElementById('sal-descripcion').value.trim(),
    fecha: document.getElementById('sal-fecha').value,
    hora: document.getElementById('sal-hora').value.trim(),
    ubicacion: document.getElementById('sal-ubicacion').value.trim(),
    punto_encuentro: document.getElementById('sal-punto').value.trim(),
    es_gratuita: esSinCosto,
    precio_familia: esSinCosto ? 0 : Number(document.getElementById('sal-precio').value || 0),
    cupo_maximo: Number(document.getElementById('sal-cupo').value || 20),
    estado: document.getElementById('sal-estado').value,
    recomendaciones: document.getElementById('sal-recomendaciones').value.trim(),
    requiere_acudiente: document.getElementById('sal-requiere-acudiente').checked,
    solicitar_correo: document.getElementById('sal-solicitar-correo').checked,
    permitir_acompanantes: false,
    incluir_acudientes_lista: document.getElementById('sal-incluir-acudientes-lista').checked,
    campos_personalizados: modalCustomFields,
    campos_acompanantes: [],
    updated_at: new Date().toISOString()
  };

  const btn = document.getElementById('btn-save-salida');
  btn.disabled = true;

  try {
    const query = id
      ? supabase.from('salidas').update(payload).eq('id', id)
      : supabase.from('salidas').insert(payload);

    const { error } = await query;
    if (error) throw error;

    closeSalidaModal();
    notifyBanner(id ? 'Salida actualizada correctamente.' : 'Nueva salida publicada.', 'success');
    await refreshAllData();
  } catch (err) {
    notifyBanner(`Error al guardar salida: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
}

function populateConfigForm(state) {
  document.getElementById('cfg-nombre-comunidad').value = state.config?.nombre_comunidad || 'Pequeños Exploradores';
  document.getElementById('cfg-whatsapp').value = state.config?.whatsapp_admin || '';
  document.getElementById('cfg-correo').value = state.config?.correo_contacto || '';
  document.getElementById('cfg-politica').value = state.config?.politica_datos || '';

  const img = document.getElementById('admin-qr-preview-img');
  const empty = document.getElementById('admin-qr-empty');
  const btnRemove = document.getElementById('btn-remove-qr');

  if (state.config?.qr_nequi_url) {
    img.src = state.config.qr_nequi_url;
    img.classList.remove('hidden');
    empty.classList.add('hidden');
    btnRemove.classList.remove('hidden');
  } else {
    img.classList.add('hidden');
    empty.classList.remove('hidden');
    btnRemove.classList.add('hidden');
  }

  const logoImg = document.getElementById('admin-logo-preview-img');
  const logoEmpty = document.getElementById('admin-logo-empty');
  const btnRemoveLogo = document.getElementById('btn-remove-logo');

  if (state.config?.logo_url) {
    logoImg.src = state.config.logo_url;
    logoImg.classList.remove('hidden');
    logoEmpty.classList.add('hidden');
    btnRemoveLogo.classList.remove('hidden');
  } else {
    logoImg.classList.add('hidden');
    logoEmpty.classList.remove('hidden');
    btnRemoveLogo.classList.add('hidden');
  }
}

async function saveCommunityConfig(refreshAllData, notifyBanner) {
  const payload = {
    nombre_comunidad: document.getElementById('cfg-nombre-comunidad').value.trim() || 'Pequeños Exploradores',
    whatsapp_admin: document.getElementById('cfg-whatsapp').value.trim(),
    correo_contacto: document.getElementById('cfg-correo').value.trim(),
    politica_datos: document.getElementById('cfg-politica').value.trim(),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from('configuracion').update(payload).eq('id', 1);
  if (error) {
    notifyBanner(`Error guardando configuración: ${error.message}`, 'error');
  } else {
    notifyBanner('Configuración actualizada.', 'success');
    await refreshAllData();
  }
}

async function uploadNequiQRFile(file, refreshAllData, notifyBanner) {
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filePath = `qr-nequi-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('nequi-qr')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: pubData } = supabase.storage.from('nequi-qr').getPublicUrl(filePath);
    const { error: dbError } = await supabase
      .from('configuracion')
      .update({ qr_nequi_url: pubData.publicUrl, updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (dbError) throw dbError;

    notifyBanner('Código QR de Nequi actualizado y visible para las familias.', 'success');
    await refreshAllData();
  } catch (err) {
    console.error("Error subiendo QR:", err);
    notifyBanner(`Error al subir QR: ${err.message || err}`, 'error');
  }
}

async function uploadLogoFile(file, refreshAllData, notifyBanner) {
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filePath = `logo-comunidad-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('nequi-qr')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: pubData } = supabase.storage.from('nequi-qr').getPublicUrl(filePath);
    const { error: dbError } = await supabase
      .from('configuracion')
      .update({ logo_url: pubData.publicUrl, updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (dbError) throw dbError;

    notifyBanner('Logotipo de la página actualizado correctamente.', 'success');
    await refreshAllData();
  } catch (err) {
    console.error("Error subiendo logotipo:", err);
    notifyBanner(`Error al subir logotipo: ${err.message || err}`, 'error');
  }
}

function exportInscripcionesCSV(state) {
  const headers = [
    'Codigo',
    'Salida',
    'Estado',
    'Acudiente',
    'WhatsApp',
    'Correo',
    'Participantes',
    'Valor_Total_COP'
  ];

  const rows = adminInscripciones.map((i) => {
    const sal = state.salidas.find((s) => s.id === i.salida_id);
    const parts = (i.participantes || [])
      .map((p) => {
        const ext = Object.entries(p.extra || {})
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        return `${p.nombre} (${p.edad} años${ext ? ' - ' + ext : ''})`;
      })
      .join(' | ');

    return [
      i.codigo,
      sal?.nombre || '',
      STATUS_NAMES[i.estado] || i.estado,
      i.acudiente_nombre,
      i.whatsapp,
      i.correo,
      parts,
      i.total_pagar
    ];
  });

  downloadCSV(`pequenos-exploradores-inscripciones-${new Date().toISOString().slice(0, 10)}.csv`, [
    headers,
    ...rows
  ]);
}