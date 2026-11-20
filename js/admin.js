// ============================================================================
// PANEL ADMINISTRATIVO — TALLERES CREA (UNIANDES)
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
  const formLogin = document.getElementById('form-admin-login');
  if (formLogin) {
    formLogin.addEventListener('submit', (e) => {
      e.preventDefault();
      const pass = document.getElementById('admin-password')?.value || '';
      const errBox = document.getElementById('admin-login-error');

      if (errBox) errBox.classList.add('hidden');

      if (pass === ADMIN_PASSWORD_SECRET) {
        state.adminUser = { email: 'Coordinación' };
        localStorage.setItem('pe_admin_logged', 'true');
        toggleAdminAuthUI(true, 'Coordinación General');
        loadAdminData(state, refreshAllData, notifyBanner);
      } else {
        if (errBox) {
          errBox.textContent = 'Contraseña incorrecta.';
          errBox.classList.remove('hidden');
        }
      }
    });
  }

  const btnLogout = document.getElementById('btn-admin-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      state.adminUser = null;
      localStorage.removeItem('pe_admin_logged');
      toggleAdminAuthUI(false);
    });
  }

  document.querySelectorAll('.admin-tab').forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.admin-tab-panel').forEach((p) => p.classList.add('hidden'));
      tabBtn.classList.add('active');
      const targetPanel = document.getElementById(tabBtn.dataset.tab);
      if (targetPanel) targetPanel.classList.remove('hidden');
    });
  });

  const btnNuevaSalida = document.getElementById('btn-nueva-salida');
  if (btnNuevaSalida) {
    btnNuevaSalida.addEventListener('click', () => {
      openSalidaModal(null);
    });
  }

  const btnCloseModal = document.getElementById('btn-close-modal-salida');
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeSalidaModal);

  const btnCancelModal = document.getElementById('btn-cancel-modal-salida');
  if (btnCancelModal) btnCancelModal.addEventListener('click', closeSalidaModal);

  const salGratuita = document.getElementById('sal-gratuita');
  if (salGratuita) {
    salGratuita.addEventListener('change', (e) => {
      const precioInput = document.getElementById('sal-precio');
      if (!precioInput) return;
      if (e.target.checked) {
        precioInput.value = 0;
        precioInput.disabled = true;
      } else {
        precioInput.disabled = false;
        if (Number(precioInput.value) === 0) precioInput.value = 25000;
      }
    });
  }

  document.querySelectorAll('.chip-btn').forEach((chip) => {
    chip.addEventListener('click', () => {
      if (chip.dataset.preset) addCustomFieldToModal(chip.dataset.preset);
    });
  });

  const btnAddCampo = document.getElementById('btn-agregar-campo-personalizado');
  if (btnAddCampo) {
    btnAddCampo.addEventListener('click', () => {
      const inp = document.getElementById('inp-nuevo-campo-nombre');
      if (inp && inp.value.trim()) {
        addCustomFieldToModal(inp.value.trim());
        inp.value = '';
      }
    });
  }

  const formModalSalida = document.getElementById('form-modal-salida');
  if (formModalSalida) {
    formModalSalida.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveSalidaFromModal(refreshAllData, notifyBanner);
    });
  }

  const filterSearch = document.getElementById('filter-inscripcion-search');
  if (filterSearch) {
    filterSearch.addEventListener('input', () => {
      renderAdminInscripcionesTable(state, refreshAllData, notifyBanner);
    });
  }

  const filterSalida = document.getElementById('filter-inscripcion-salida');
  if (filterSalida) {
    filterSalida.addEventListener('change', () => {
      renderAdminInscripcionesTable(state, refreshAllData, notifyBanner);
    });
  }

  const filterEstado = document.getElementById('filter-inscripcion-estado');
  if (filterEstado) {
    filterEstado.addEventListener('change', () => {
      renderAdminInscripcionesTable(state, refreshAllData, notifyBanner);
    });
  }

  const btnExport = document.getElementById('btn-export-csv');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      exportInscripcionesCSV(state);
    });
  }

  const formConfig = document.getElementById('form-admin-config');
  if (formConfig) {
    formConfig.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveCommunityConfig(refreshAllData, notifyBanner);
    });
  }

  const inpQr = document.getElementById('inp-qr-file');
  if (inpQr) {
    inpQr.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) await uploadNequiQRFile(file, refreshAllData, notifyBanner);
    });
  }

  const btnRemQr = document.getElementById('btn-remove-qr');
  if (btnRemQr) {
    btnRemQr.addEventListener('click', async () => {
      await supabase.from('configuracion').update({ qr_nequi_url: '' }).eq('id', 1);
      await refreshAllData();
      notifyBanner('Imagen de QR eliminada.', 'success');
    });
  }
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
  const emailUserEl = document.getElementById('admin-user-email');

  if (isAuthenticated) {
    if (loginBox) loginBox.classList.add('hidden');
    if (dashBox) dashBox.classList.remove('hidden');
    if (navBadge) navBadge.classList.remove('hidden');
    if (emailUserEl) emailUserEl.textContent = `Sesión activa: ${email}`;
  } else {
    if (loginBox) loginBox.classList.remove('hidden');
    if (dashBox) dashBox.classList.add('hidden');
    if (navBadge) navBadge.classList.add('hidden');
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
      const tiempoCancelacion = new Date(insc.created_at).getTime();
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

  const elSalidas = document.getElementById('kpi-salidas');
  const elPorVerificar = document.getElementById('kpi-por-verificar');
  const elPendientes = document.getElementById('kpi-pendientes');
  const elConfirmadas = document.getElementById('kpi-confirmadas');
  const elRecaudo = document.getElementById('kpi-recaudo');

  if (elSalidas) elSalidas.textContent = String(abiertas);
  if (elPorVerificar) elPorVerificar.textContent = String(porVerificar);
  if (elPendientes) elPendientes.textContent = String(pendientes);
  if (elConfirmadas) elConfirmadas.textContent = String(confirmadas.length);
  if (elRecaudo) elRecaudo.textContent = formatCOP(recaudo);
}

function renderAdminSalidasAndLists(state, refreshAllData, notifyBanner) {
  const container = document.getElementById('admin-salidas-list');
  if (!container) return;

  if (state.salidas.length === 0) {
    container.innerHTML = `<div class="state-box"><p>No has creado ningún taller todavía.</p></div>`;
    return;
  }

  container.innerHTML = state.salidas
    .map((salida) => {
      const inscDeSalida = adminInscripciones.filter(
        (i) => i.salida_id === salida.id && ['pendiente_pago', 'pago_por_verificar', 'confirmada'].includes(i.estado)
      );

      const cupoInfo = state.cuposMap.get(salida.id) || { reservados: 0, confirmados: 0 };
      const incluirEdad = salida.incluir_edad !== false;

      const filasParticipantes = [];
      inscDeSalida.forEach((insc) => {
        (insc.participantes || []).forEach((p) => {
          const pedazos = [p.nombre];

          if (incluirEdad && p.edad !== undefined && p.edad !== null && p.edad !== '') {
            pedazos.push(`${p.edad} años`);
          }

          const camposPersonalizados = salida.campos_personalizados || [];
          camposPersonalizados.forEach((c) => {
            if (c.incluir_al_copiar !== false && p.extra?.[c.label]) {
              pedazos.push(p.extra[c.label]);
            }
          });

          const lineaFormateada = pedazos.join(', ');

          filasParticipantes.push({
            vistaCorta: lineaFormateada,
            lineaCompleta: lineaFormateada
          });
        });

        if (salida.incluir_acudientes_lista) {
          if (insc.acudiente_nombre && insc.acudiente_nombre !== 'Sin acudiente') {
            const acudienteTexto = `${insc.acudiente_nombre} (Responsable)`;
            filasParticipantes.push({
              vistaCorta: acudienteTexto,
              lineaCompleta: acudienteTexto
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
                Valor: <strong>${salida.es_gratuita ? 'Sin costo ($0)' : formatCOP(salida.precio_familia)}</strong> ·
                Cupos: <strong>${cupoInfo.confirmados} confirmados</strong> / ${cupoInfo.reservados} reservados (Máx. ${salida.cupo_maximo})<br/>
                Cierre programado: <strong>${salida.fecha_cierre ? new Date(salida.fecha_cierre).toLocaleString() : 'Sin límite'}</strong>
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
                Copiar lista completa
              </button>
            </div>
            ${
              filasParticipantes.length > 0
                ? `<ol class="enumerated-list">${filasParticipantes
                    .map((f) => `<li>${escapeHTML(f.vistaCorta)}</li>`)
                    .join('')}</ol>`
                : `<p class="form-hint">Aún no hay inscritos en este taller.</p>`
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
      const ok = window.confirm(`¿Seguro que deseas eliminar el taller "${btn.dataset.nombre}"?`);
      if (!ok) return;
      const { error } = await supabase.from('salidas').delete().eq('id', btn.dataset.id);
      if (error) {
        notifyBanner(`Error al eliminar: ${error.message}`, 'error');
      } else {
        notifyBanner('Taller eliminado correctamente.', 'success');
        await refreshAllData();
      }
    });
  });

  container.querySelectorAll('.btn-copy-lista').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await copyToClipboard(btn.dataset.copy);
      const original = btn.textContent;
      btn.textContent = '¡Lista copiada!';
      setTimeout(() => {
        btn.textContent = original;
      }, 2200);
    });
  });
}

function populateSalidaFilter(state) {
  const select = document.getElementById('filter-inscripcion-salida');
  if (!select) return;
  const current = select.value;
  select.innerHTML =
    `<option value="">Todos los talleres</option>` +
    state.salidas
      .map((s) => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.nombre)}</option>`)
      .join('');
  select.value = current;
}

function renderAdminInscripcionesTable(state, refreshAllData, notifyBanner) {
  const tbody = document.getElementById('admin-inscripciones-tbody');
  if (!tbody) return;

  const search = document.getElementById('filter-inscripcion-search')?.value.trim().toLowerCase() || '';
  const salidaId = document.getElementById('filter-inscripcion-salida')?.value || '';
  const estado = document.getElementById('filter-inscripcion-estado')?.value || '';

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
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">No hay inscripciones que coincidan.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered
    .map((insc) => {
      const salida = state.salidas.find((s) => s.id === insc.salida_id);
      
      const partHtml = (insc.participantes || [])
        .map((p, pIdx) => {
          const extrasStr = Object.entries(p.extra || {})
            .map(([k, v]) => `<div><small>${escapeHTML(k)}: ${escapeHTML(v)}</small></div>`)
            .join('');
          return `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:4px; border-bottom:1px dashed var(--border); padding-bottom:4px;">
              <div>
                • <strong>${escapeHTML(p.nombre)}</strong> (${p.edad} años)${extrasStr}
              </div>
              <button type="button" class="btn btn-danger-ghost btn-sm btn-del-single-part" data-insc-id="${escapeHTML(insc.id)}" data-part-idx="${pIdx}" title="Quitar">
                &times; Quitar
              </button>
            </div>
          `;
        })
        .join('');

      return `
        <tr>
          <td><strong>${escapeHTML(insc.codigo)}</strong></td>
          <td>${escapeHTML(salida?.nombre || 'Taller eliminado')}</td>
          <td>
            ${insc.acudiente_nombre && insc.acudiente_nombre !== 'Sin acudiente' ? `<strong>${escapeHTML(insc.acudiente_nombre)}</strong><br/>` : ''}
            ${insc.whatsapp ? `<span>WA: ${escapeHTML(insc.whatsapp)}</span>` : ''}
            ${insc.correo ? `<br/><small>${escapeHTML(insc.correo)}</small>` : ''}
          </td>
          <td>${partHtml || '<span style="color:var(--text-muted);">Sin participantes</span>'}</td>
          <td><strong>${formatCOP(insc.total_pagar)}</strong></td>
          <td>
            <span class="status-chip st-${escapeHTML(insc.estado)}">${escapeHTML(STATUS_NAMES[insc.estado] || insc.estado)}</span>
          </td>
          <td>
            <div class="table-actions">
              ${
                insc.estado !== 'confirmada'
                  ? `<button type="button" class="btn btn-primary btn-sm btn-confirm-pago" data-id="${escapeHTML(insc.id)}" data-valor="${insc.total_pagar}">Aprobar</button>`
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
        notifyBanner('Inscripción confirmada.', 'success');
        await refreshAllData();
      }
    });
  });

  tbody.querySelectorAll('.btn-cancel-insc').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!window.confirm('¿Deseas cancelar toda esta inscripción y liberar sus cupos?')) return;
      
      const { error } = await supabase
        .from('inscripciones')
        .update({ estado: 'cancelada' })
        .eq('id', btn.dataset.id);

      if (error) {
        notifyBanner(`Error al cancelar: ${error.message}`, 'error');
      } else {
        notifyBanner('Inscripción cancelada.', 'success');
        await refreshAllData();
      }
    });
  });

  tbody.querySelectorAll('.btn-del-single-part').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const inscId = btn.dataset.inscId;
      const partIdx = Number(btn.dataset.partIdx);

      const inscripcionActual = adminInscripciones.find(i => i.id === inscId);
      if (!inscripcionActual) return;

      const participantesActuales = [...(inscripcionActual.participantes || [])];
      
      if (participantesActuales.length <= 1) {
        if (!window.confirm('Este registro tiene un solo participante. ¿Deseas cancelar la inscripción completa?')) return;
        
        const { error } = await supabase
          .from('inscripciones')
          .update({ estado: 'cancelada' })
          .eq('id', inscId);

        if (error) {
          notifyBanner(`Error: ${error.message}`, 'error');
        } else {
          notifyBanner('Inscripción cancelada.', 'success');
          await refreshAllData();
        }
        return;
      }

      participantesActuales.splice(partIdx, 1);

      const { error } = await supabase
        .from('inscripciones')
        .update({ participantes: participantesActuales })
        .eq('id', inscId);

      if (error) {
        notifyBanner(`Error: ${error.message}`, 'error');
      } else {
        notifyBanner('Participante removido.', 'success');
        await refreshAllData();
      }
    });
  });
}

function openSalidaModal(salida = null) {
  const modal = document.getElementById('modal-salida');
  if (!modal) return;

  const titleEl = document.getElementById('modal-salida-title');
  if (titleEl) titleEl.textContent = salida ? 'Editar Taller' : 'Nuevo Taller';

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  setVal('sal-id', salida?.id || '');
  setVal('sal-nombre', salida?.nombre || '');
  setVal('sal-descripcion', salida?.descripcion || '');
  setVal('sal-fecha', salida?.fecha || '');
  setVal('sal-hora', salida?.hora || '');
  setVal('sal-ubicacion', salida?.ubicacion || '');
  setVal('sal-punto', salida?.punto_encuentro || '');

  const esSinCosto = Boolean(salida?.es_gratuita);
  const chkGratuita = document.getElementById('sal-gratuita');
  if (chkGratuita) chkGratuita.checked = esSinCosto;

  const precioInp = document.getElementById('sal-precio');
  if (precioInp) {
    precioInp.value = esSinCosto ? 0 : (salida?.precio_familia ?? 25000);
    precioInp.disabled = esSinCosto;
  }

  setVal('sal-cupo', salida?.cupo_maximo ?? 25);
  setVal('sal-estado', salida?.estado || 'abierta');
  setVal('sal-recomendaciones', salida?.recomendaciones || '');
  
  if (salida?.fecha_cierre) {
    const fechaIso = new Date(salida.fecha_cierre).toISOString().slice(0, 16);
    setVal('sal-fecha-cierre', fechaIso);
  } else {
    setVal('sal-fecha-cierre', '');
  }

  const chkAcudiente = document.getElementById('sal-requiere-acudiente');
  if (chkAcudiente) chkAcudiente.checked = salida ? salida.requiere_acudiente !== false : true;

  const chkCorreo = document.getElementById('sal-solicitar-correo');
  if (chkCorreo) chkCorreo.checked = Boolean(salida?.solicitar_correo);

  const chkAcudLista = document.getElementById('sal-incluir-acudientes-lista');
  if (chkAcudLista) chkAcudLista.checked = Boolean(salida?.incluir_acudientes_lista);

  modalCustomFields = Array.isArray(salida?.campos_personalizados)
    ? JSON.parse(JSON.stringify(salida.campos_personalizados))
    : [];
  renderModalCustomFields();

  modal.classList.remove('hidden');
}

function closeSalidaModal() {
  const modal = document.getElementById('modal-salida');
  if (modal) modal.classList.add('hidden');
}

function addCustomFieldToModal(label) {
  if (modalCustomFields.some((f) => f.label.toLowerCase() === label.toLowerCase())) return;
  modalCustomFields.push({ label, visible: true, required: true, incluir_al_copiar: true });
  renderModalCustomFields();
}

function renderModalCustomFields() {
  const container = document.getElementById('modal-campos-lista');
  if (!container) return;

  if (modalCustomFields.length === 0) {
    container.innerHTML = `<p class="form-hint">No hay campos personalizados.</p>`;
    return;
  }

  container.innerHTML = modalCustomFields
    .map(
      (f, idx) => `
      <div class="custom-field-item" style="flex-wrap:wrap; gap:8px;">
        <strong>${escapeHTML(f.label)}</strong>
        <div class="custom-field-controls" style="flex-wrap:wrap; gap:12px;">
          <label class="checkbox-label"><input type="checkbox" class="cf-vis" data-idx="${idx}" ${f.visible !== false ? 'checked' : ''} /> Mostrar</label>
          <label class="checkbox-label"><input type="checkbox" class="cf-req" data-idx="${idx}" ${f.required ? 'checked' : ''} /> Obligatorio</label>
          <label class="checkbox-label"><input type="checkbox" class="cf-copy" data-idx="${idx}" ${f.incluir_al_copiar !== false ? 'checked' : ''} /> Copiar</label>
          <button type="button" class="btn btn-danger-ghost btn-sm cf-del" data-idx="${idx}">Quitar</button>
        </div>
      </div>
    `
    )
    .join('');

  container.querySelectorAll('.cf-vis').forEach((chk) => {
    chk.addEventListener('change', (e) => { modalCustomFields[Number(e.target.dataset.idx)].visible = e.target.checked; });
  });
  container.querySelectorAll('.cf-req').forEach((chk) => {
    chk.addEventListener('change', (e) => { modalCustomFields[Number(e.target.dataset.idx)].required = e.target.checked; });
  });
  container.querySelectorAll('.cf-copy').forEach((chk) => {
    chk.addEventListener('change', (e) => { modalCustomFields[Number(e.target.dataset.idx)].incluir_al_copiar = e.target.checked; });
  });
  container.querySelectorAll('.cf-del').forEach((btn) => {
    btn.addEventListener('click', () => {
      modalCustomFields.splice(Number(btn.dataset.idx), 1);
      renderModalCustomFields();
    });
  });
}

async function saveSalidaFromModal(refreshAllData, notifyBanner) {
  const id = document.getElementById('sal-id')?.value || '';
  const esSinCosto = document.getElementById('sal-gratuita')?.checked || false;
  const fechaCierreVal = document.getElementById('sal-fecha-cierre')?.value;

  const payload = {
    nombre: document.getElementById('sal-nombre')?.value.trim() || '',
    descripcion: document.getElementById('sal-descripcion')?.value.trim() || '',
    fecha: document.getElementById('sal-fecha')?.value || '',
    hora: document.getElementById('sal-hora')?.value.trim() || '',
    ubicacion: document.getElementById('sal-ubicacion')?.value.trim() || '',
    punto_encuentro: document.getElementById('sal-punto')?.value.trim() || '',
    es_gratuita: esSinCosto,
    precio_familia: esSinCosto ? 0 : Number(document.getElementById('sal-precio')?.value || 25000),
    cupo_maximo: Number(document.getElementById('sal-cupo')?.value || 25),
    estado: document.getElementById('sal-estado')?.value || 'abierta',
    recomendaciones: document.getElementById('sal-recomendaciones')?.value.trim() || '',
    fecha_cierre: fechaCierreVal ? new Date(fechaCierreVal).toISOString() : null,
    requiere_acudiente: document.getElementById('sal-requiere-acudiente')?.checked ?? true,
    solicitar_correo: document.getElementById('sal-solicitar-correo')?.checked ?? false,
    incluir_acudientes_lista: document.getElementById('sal-incluir-acudientes-lista')?.checked ?? false,
    campos_personalizados: modalCustomFields,
    campos_acompanantes: []
  };

  const btn = document.getElementById('btn-save-salida');
  if (btn) btn.disabled = true;

  try {
    const query = id
      ? supabase.from('salidas').update(payload).eq('id', id)
      : supabase.from('salidas').insert(payload);

    const { error } = await query;
    if (error) throw error;

    closeSalidaModal();
    notifyBanner(id ? 'Taller actualizado.' : 'Taller creado.', 'success');
    await refreshAllData();
  } catch (err) {
    notifyBanner(`Error al guardar: ${err.message}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function populateConfigForm(state) {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  setVal('cfg-nombre-comunidad', state.config?.nombre_comunidad || 'Talleres CREA');
  setVal('cfg-whatsapp', state.config?.whatsapp_admin || '');
  setVal('cfg-correo', state.config?.correo_contacto || '');
  setVal('cfg-politica', state.config?.politica_datos || '');

  const img = document.getElementById('admin-qr-preview-img');
  const empty = document.getElementById('admin-qr-empty');
  const btnRemove = document.getElementById('btn-remove-qr');

  if (state.config?.qr_nequi_url) {
    if (img) { img.src = state.config.qr_nequi_url; img.classList.remove('hidden'); }
    if (empty) empty.classList.add('hidden');
    if (btnRemove) btnRemove.classList.remove('hidden');
  } else {
    if (img) img.classList.add('hidden');
    if (empty) empty.classList.remove('hidden');
    if (btnRemove) btnRemove.classList.add('hidden');
  }
}

async function saveCommunityConfig(refreshAllData, notifyBanner) {
  const payload = {
    nombre_comunidad: document.getElementById('cfg-nombre-comunidad')?.value.trim() || 'Talleres CREA',
    whatsapp_admin: document.getElementById('cfg-whatsapp')?.value.trim() || '',
    correo_contacto: document.getElementById('cfg-correo')?.value.trim() || '',
    politica_datos: document.getElementById('cfg-politica')?.value.trim() || ''
  };

  const { error } = await supabase.from('configuracion').update(payload).eq('id', 1);
  if (error) {
    notifyBanner(`Error: ${error.message}`, 'error');
  } else {
    notifyBanner('Configuración guardada.', 'success');
    await refreshAllData();
  }
}

async function uploadNequiQRFile(file, refreshAllData, notifyBanner) {
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filePath = `qr-pago-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('nequi-qr')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: pubData } = supabase.storage.from('nequi-qr').getPublicUrl(filePath);
    const { error: dbError } = await supabase
      .from('configuracion')
      .update({ qr_nequi_url: pubData.publicUrl })
      .eq('id', 1);

    if (dbError) throw dbError;

    notifyBanner('Código QR actualizado.', 'success');
    await refreshAllData();
  } catch (err) {
    notifyBanner(`Error al subir QR: ${err.message || err}`, 'error');
  }
}

function exportInscripcionesCSV(state) {
  const headers = ['Codigo', 'Taller', 'Estado', 'Responsable', 'WhatsApp', 'Correo', 'Participantes', 'Valor'];
  const rows = adminInscripciones.map((i) => {
    const sal = state.salidas.find((s) => s.id === i.salida_id);
    const parts = (i.participantes || []).map((p) => `${p.nombre} (${p.edad} años)`).join(' | ');
    return [i.codigo, sal?.nombre || '', STATUS_NAMES[i.estado] || i.estado, i.acudiente_nombre, i.whatsapp, i.correo, parts, i.total_pagar];
  });
  downloadCSV(`talleres-crea-inscripciones-${new Date().toISOString().slice(0, 10)}.csv`, [headers, ...rows]);
}
