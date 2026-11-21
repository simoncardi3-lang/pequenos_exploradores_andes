// ============================================================================
// MÓDULO DE TALLERES (SALIDAS) PÚBLICOS Y RENDERIZADO
// ============================================================================

import { escapeHTML, formatCOP, formatDateES } from './utils.js';

export function initSalidasModule(state, onSelectSalida) {
  window.addEventListener('hashchange', () => {
    renderSalidasPublic(state, onSelectSalida);
  });
}

export function renderSalidasPublic(state, onSelectSalida) {
  const grid = document.getElementById('salidas-grid');
  const loading = document.getElementById('salidas-loading');
  const empty = document.getElementById('salidas-empty');

  if (!grid) return;

  if (loading) loading.classList.add('hidden');

  const abiertas = state.salidas.filter((s) => s.estado === 'abierta');

  if (abiertas.length === 0) {
    if (empty) empty.classList.remove('hidden');
    grid.innerHTML = '';
    return;
  }

  if (empty) empty.classList.add('hidden');

  grid.innerHTML = abiertas
    .map((salida) => {
      const cupoInfo = state.cuposMap.get(salida.id) || { reservados: 0, confirmados: 0 };
      const disponibles = Math.max(0, salida.cupo_maximo - cupoInfo.reservados);
      const agotarCupos = disponibles === 0;

      let timerHtml = '';
      let isCerradoPorTiempo = false;

      if (salida.fecha_cierre) {
        const ahora = new Date().getTime();
        const cierre = new Date(salida.fecha_cierre).getTime();
        const diferencia = cierre - ahora;

        if (diferencia > 0) {
          const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
          const horas = Math.floor((diferencia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutos = Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60));

          timerHtml = `
            <div style="background:var(--surface-alt); padding:6px 10px; border-radius:6px; margin-bottom:12px; font-size:0.85rem; color:var(--text-muted); border:1px solid var(--border);">
              ⏱️ Cierra en: <strong>${dias}d ${horas}h ${minutos}m</strong>
            </div>
          `;
        } else {
          isCerradoPorTiempo = true;
          timerHtml = `
            <div style="background:#fee2e2; padding:6px 10px; border-radius:6px; margin-bottom:12px; font-size:0.85rem; color:#991b1b; border:1px solid #f87171;">
              🔒 Inscripciones cerradas por tiempo límite
            </div>
          `;
        }
      }

      const noDisponible = agotarCupos || isCerradoPorTiempo;

      return `
        <div class="salida-card">
          <div class="salida-card-header">
            <span class="badge-estado estado-${escapeHTML(salida.estado)}">
              ${isCerradoPorTiempo ? 'Cerrado' : (agotarCupos ? 'Agotado' : 'Inscripciones abiertas')}
            </span>
            <span class="salida-precio">
              ${salida.es_gratuita ? 'Sin costo ($0)' : formatCOP(salida.precio_familia)}
            </span>
          </div>

          <div class="salida-card-body">
            <h3>${escapeHTML(salida.nombre)}</h3>
            <p class="salida-desc">${escapeHTML(salida.descripcion)}</p>

            ${timerHtml}

            <hr style="border:none; border-top:1px solid var(--border); margin:12px 0;" />

            <div style="display: grid; grid-template-columns: 110px 1fr; row-gap: 8px; font-size: 0.9rem; align-items: center;">
              <span style="color: var(--text-muted);">Fecha</span>
              <strong style="text-align: right;">${escapeHTML(formatDateES(salida.fecha))}</strong>

              <span style="color: var(--text-muted);">Hora</span>
              <strong style="text-align: right;">${escapeHTML(salida.hora)}</strong>

              <span style="color: var(--text-muted);">Ubicación</span>
              <strong style="text-align: right;">${escapeHTML(salida.ubicacion)}</strong>

              <span style="color: var(--text-muted);">Punto de encuentro</span>
              <strong style="text-align: right;">${escapeHTML(salida.punto_encuentro || 'CREA')}</strong>

              <span style="color: var(--text-muted);">Cupos disponibles</span>
              <strong style="text-align: right;">${disponibles} de ${salida.cupo_maximo}</strong>
            </div>

            ${
              salida.recomendaciones
                ? `<div class="salida-recom" style="margin-top:12px;"><strong>Requisito:</strong> ${escapeHTML(salida.recomendaciones)}</div>`
                : ''
            }
          </div>

          <div class="salida-card-footer">
            <button
              type="button"
              class="btn btn-primary btn-block btn-inscribir"
              data-id="${escapeHTML(salida.id)}"
              ${noDisponible ? 'disabled' : ''}
            >
              ${isCerradoPorTiempo ? 'Inscripciones cerradas' : (agotarCupos ? 'Cupos Agotados' : 'Ver detalles y reservar')}
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  grid.querySelectorAll('.btn-inscribir').forEach((btn) => {
    btn.addEventListener('click', () => {
      const salidaId = btn.dataset.id;
      if (typeof onSelectSalida === 'function') {
        onSelectSalida(salidaId);
      }
    });
  });
}