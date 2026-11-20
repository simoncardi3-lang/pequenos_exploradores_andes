// ============================================================================
// RENDERIZADO DEL CATÁLOGO PÚBLICO DE SALIDAS
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

  loading.classList.add('hidden');

  if (!state.salidas || state.salidas.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  grid.innerHTML = state.salidas
    .map((salida) => {
      const cupoInfo = state.cuposMap.get(salida.id) || { reservados: 0, confirmados: 0 };
      const disponibles = Math.max(salida.cupo_maximo - cupoInfo.reservados, 0);
      const estadoEfectivo =
        salida.estado === 'abierta' && disponibles === 0 ? 'agotada' : salida.estado;
      const puedeReservar = estadoEfectivo === 'abierta' && disponibles > 0;

      const precioTexto =
        salida.es_gratuita || Number(salida.precio_familia) === 0
          ? 'SIN COSTO ($0)'
          : `${formatCOP(salida.precio_familia)} / familia`;

      return `
        <article class="salida-card">
          <div class="salida-card-body">
            <div class="salida-top-meta">
              <span class="badge-estado estado-${escapeHTML(estadoEfectivo)}">
                ${escapeHTML(ESTADO_LABELS[estadoEfectivo] || estadoEfectivo)}
              </span>
              <span class="price-pill ${salida.es_gratuita ? 'free' : ''}">
                ${escapeHTML(precioTexto)}
              </span>
            </div>

            <h2 class="salida-title">${escapeHTML(salida.nombre)}</h2>
            <p class="salida-desc">${escapeHTML(salida.descripcion)}</p>

            <ul class="salida-details-list">
              <li><span>Fecha</span><strong>${escapeHTML(formatDateES(salida.fecha))}</strong></li>
              <li><span>Hora</span><strong>${escapeHTML(salida.hora)}</strong></li>
              <li><span>Ubicación</span><strong>${escapeHTML(salida.ubicacion)}</strong></li>
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
              ${puedeReservar ? 'VER DETALLES Y RESERVAR' : ESTADO_LABELS[estadoEfectivo]}
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