// ============================================================================
// RENDERIZADO DEL CATÁLOGO PÚBLICO DE TALLERES (ANDES)
// ============================================================================

import { escapeHTML, formatCOP, formatDateES } from './utils.js';

const ESTADO_LABELS = {
  abierta: 'Inscripciones abiertas',
  agotada: 'Cupos agotados',
  cerrada: 'Inscripciones cerradas',
  cancelada: 'Actividad cancelada'
};

export function renderPublicSalidas(state, onSelectSalida) {
  const grid = document.getElementById('salidas-grid');
  const loading = document.getElementById('salidas-loading');
  const empty = document.getElementById('salidas-empty');

  if (!grid) return;
  if (loading) loading.classList.add('hidden');

  if (!state.salidas || state.salidas.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }

  if (empty) empty.classList.add('hidden');

  grid.innerHTML = state.salidas
    .map((salida) => {
      const cupoInfo = state.cuposMap.get(salida.id) || { reservados: 0, confirmados: 0 };
      const disponibles = Math.max(salida.cupo_maximo - cupoInfo.reservados, 0);
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

      const estadoEfectivo =
        isCerradoPorTiempo ? 'cerrada' : (salida.estado === 'abierta' && agotarCupos ? 'agotada' : salida.estado);
      const puedeReservar = estadoEfectivo === 'abierta' && !agotarCupos && !isCerradoPorTiempo;

      const precioTexto =
        salida.es_gratuita || Number(salida.precio_familia) === 0
          ? 'SIN COSTO ($0)'
          : `${formatCOP(salida.precio_familia)}`;

      return `
        <article class="salida-card">
          <div class="salida-card-body">
            <div class="salida-top-meta">
              <span class="badge-estado estado-${escapeHTML(estadoEfectivo)}">
                ${isCerradoPorTiempo ? 'Inscripciones cerradas' : (ESTADO_LABELS[estadoEfectivo] || estadoEfectivo)}
              </span>
              <span class="price-pill ${salida.es_gratuita ? 'free' : ''}">
                ${escapeHTML(precioTexto)}
              </span>
            </div>

            <h2 class="salida-title">${escapeHTML(salida.nombre)}</h2>
            <p class="salida-desc">${escapeHTML(salida.descripcion)}</p>

            ${timerHtml}

            <ul class="salida-details-list">
              <li><span>Fecha</span><strong>${escapeHTML(formatDateES(salida.fecha))}</strong></li>
              <li><span>Hora</span><strong>${escapeHTML(salida.hora)}</strong></li>
              <li><span>Salón / Ubicación</span><strong>${escapeHTML(salida.ubicacion)}</strong></li>
              <li><span>Punto de encuentro</span><strong>${escapeHTML(salida.punto_encuentro)}</strong></li>
              <li><span>Cupos disponibles</span><strong>${disponibles} de ${salida.cupo_maximo}</strong></li>
            </ul>

            ${
              salida.recomendaciones
                ? `<div class="salida-rec"><strong>Recomendaciones:</strong> ${escapeHTML(salida.recomendaciones)}</div>`
                : ''
            }
          </div>

          <div class="salida-card-footer">
            <button
              type="button"
              class="btn ${puedeReservar ? 'btn-primary' : 'btn-outline'} btn-block btn-reservar-salida"
              data-salida-id="${escapeHTML(salida.id)}"
              ${!puedeReservar ? 'disabled' : ''}
            >
              ${isCerradoPorTiempo ? 'Inscripciones cerradas' : (agotarCupos ? 'Cupos Agotados' : 'VER DETALLES Y RESERVAR')}
            </button>
          </div>
        </article>
      `;
    })
    .join('');

  grid.querySelectorAll('.btn-reservar-salida').forEach((btn) => {
    btn.addEventListener('click', () => {
      onSelectSalida(btn.dataset.salidaId);
    });
  });
}
