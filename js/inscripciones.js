// ============================================================================
// MÓDULO DE INSCRIPCIÓN FAMILIAR CON FORMULARIOS DINÁMICOS Y HABEAS DATA
// ============================================================================

import { supabase } from './supabase.js';
import { escapeHTML, formatCOP, formatDateES } from './utils.js';

let participantesDraft = [];

export function initInscripcionModule(state, onRegistrationSuccess) {
  const selectSalida = document.getElementById('select-salida-inscripcion');
  const form = document.getElementById('form-inscripcion');
  const btnAddPart = document.getElementById('btn-add-participante');

  if (selectSalida) {
    selectSalida.addEventListener('change', () => {
      state.selectedSalidaId = selectSalida.value;
      syncInscripcionView(state);
    });
  }

  if (btnAddPart) {
    btnAddPart.addEventListener('click', () => {
      const salida = state.salidas.find((s) => s.id === state.selectedSalidaId);
      const camposSalida = salida?.campos_personalizados || [];
      const extraObj = {};
      camposSalida.forEach(c => { extraObj[c.label] = ''; });

      participantesDraft.push({ nombre: '', edad: '', extra: extraObj });
      renderParticipantesRows(salida);
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleInscripcionSubmit(state, onRegistrationSuccess);
    });
  }
}

export function resetInscripcionFlow(state, preselectedSalidaId = null) {
  if (preselectedSalidaId) {
    state.selectedSalidaId = preselectedSalidaId;
  }
  
  const salida = state.salidas.find((s) => s.id === state.selectedSalidaId);
  const camposSalida = salida?.campos_personalizados || [];
  const extraObj = {};
  camposSalida.forEach(c => { extraObj[c.label] = ''; });

  participantesDraft = [{ nombre: '', edad: '', extra: extraObj }];

  const form = document.getElementById('form-inscripcion');
  if (form) form.reset();
  
  const errBox = document.getElementById('inscripcion-error');
  if (errBox) errBox.classList.add('hidden');
  
  const formWrap = document.getElementById('inscripcion-form-wrapper');
  if (formWrap) formWrap.classList.remove('hidden');
  
  const pagoWrap = document.getElementById('inscripcion-pago-wrapper');
  if (pagoWrap) pagoWrap.classList.add('hidden');

  syncInscripcionView(state);
}

export function syncInscripcionView(state) {
  const selectSalida = document.getElementById('select-salida-inscripcion');
  if (!selectSalida) return;

  const abiertas = state.salidas.filter((s) => {
    const c = state.cuposMap.get(s.id) || { reservados: 0 };
    return s.estado === 'abierta' && s.cupo_maximo - c.reservados > 0;
  });

  const btnSubmit = document.getElementById('btn-submit-inscripcion');

  if (abiertas.length === 0) {
    selectSalida.innerHTML = `<option value="">No hay salidas abiertas en este momento</option>`;
    const resumenBox = document.getElementById('inscripcion-salida-resumen');
    if (resumenBox) resumenBox.classList.add('hidden');
    if (btnSubmit) btnSubmit.disabled = true;
    return;
  }

  if (btnSubmit) btnSubmit.disabled = false;

  selectSalida.innerHTML = abiertas
    .map(
      (s) =>
        `<option value="${escapeHTML(s.id)}" ${s.id === state.selectedSalidaId ? 'selected' : ''}>
          ${escapeHTML(s.nombre)} — ${escapeHTML(formatDateES(s.fecha))}
        </option>`
    )
    .join('');

  if (!state.selectedSalidaId || !abiertas.some((s) => s.id === state.selectedSalidaId)) {
    state.selectedSalidaId = abiertas[0].id;
    selectSalida.value = state.selectedSalidaId;
  }

  const salida = state.salidas.find((s) => s.id === state.selectedSalidaId);
  if (!salida) return;

  const cupoInfo = state.cuposMap.get(salida.id) || { reservados: 0 };
  const disponibles = Math.max(salida.cupo_maximo - cupoInfo.reservados, 0);

  const resumenBox = document.getElementById('inscripcion-salida-resumen');
  if (resumenBox) {
    resumenBox.classList.remove('hidden');
    resumenBox.innerHTML = `
      <strong>${escapeHTML(salida.nombre)}</strong><br/>
      Fecha: ${escapeHTML(formatDateES(salida.fecha))} · Hora: ${escapeHTML(salida.hora)}<br/>
      Punto de encuentro: ${escapeHTML(salida.punto_encuentro)} · Cupos disponibles: <strong>${disponibles}</strong>
    `;
  }

  const bloqueAcudiente = document.getElementById('bloque-acudiente');
  const inpAcudiente = document.getElementById('inp-acudiente-nombre');
  const inpWhatsapp = document.getElementById('inp-whatsapp');
  const correoWrap = document.getElementById('campo-correo-wrap');
  const inpCorreo = document.getElementById('inp-correo');

  if (salida.requiere_acudiente === false) {
    if (bloqueAcudiente) bloqueAcudiente.classList.add('hidden');
    if (inpAcudiente) { inpAcudiente.required = false; inpAcudiente.value = ''; }
    if (inpWhatsapp) { inpWhatsapp.required = false; inpWhatsapp.value = ''; }
    if (correoWrap) correoWrap.classList.add('hidden');
    if (inpCorreo) { inpCorreo.required = false; inpCorreo.value = ''; }
  } else {
    if (bloqueAcudiente) bloqueAcudiente.classList.remove('hidden');
    if (inpAcudiente) inpAcudiente.required = true;
    if (inpWhatsapp) inpWhatsapp.required = true;

    if (salida.solicitar_correo) {
      if (correoWrap) correoWrap.classList.remove('hidden');
      if (inpCorreo) inpCorreo.required = true;
    } else {
      if (correoWrap) correoWrap.classList.add('hidden');
      if (inpCorreo) { inpCorreo.required = false; inpCorreo.value = ''; }
    }
  }

  // Inyectar o asegurar el bloque de Habeas Data dinámicamente si no está en el HTML estático
  ensureHabeasDataBox();

  const camposSalida = salida.campos_personalizados || [];
  participantesDraft.forEach(p => {
    if (!p.extra) p.extra = {};
    camposSalida.forEach(c => {
      if (p.extra[c.label] === undefined) p.extra[c.label] = '';
    });
  });

  renderParticipantesRows(salida);

  const esSinCosto = salida.es_gratuita || Number(salida.precio_familia) === 0;
  const valorDisplay = document.getElementById('total-valor-display');
  const totalNota = document.getElementById('total-nota');

  if (valorDisplay) {
    valorDisplay.textContent = esSinCosto ? '$0 COP (Sin costo)' : `${formatCOP(salida.precio_familia)} COP`;
  }
  if (totalNota) {
    totalNota.textContent = esSinCosto
      ? 'Actividad sin costo económico · Inscripción inmediata'
      : 'Tarifa única familiar (independiente de la cantidad de niños o jóvenes inscritos)';
  }
}

function ensureHabeasDataBox() {
  const form = document.getElementById('form-inscripcion');
  if (!form) return;
  if (document.getElementById('habeas-data-container')) return;

  const btnSubmit = document.getElementById('btn-submit-inscripcion');
  const div = document.createElement('div');
  div.id = 'habeas-data-container';
  div.className = 'consent-box';
  div.innerHTML = `
    <label class="checkbox-label">
      <input type="checkbox" id="chk-habeas-data" required />
      <span>Autorizo de manera previa, expresa e informada el tratamiento de mis datos personales y los de los menores a mi cargo para los fines logísticos, de seguridad y de comunicación de las salidas de la comunidad homeschool Pequeños Exploradores, en cumplimiento de la Ley 1581 de 2012 (Habeas Data). *</span>
    </label>
  `;

  if (btnSubmit) {
    form.insertBefore(div, btnSubmit);
  } else {
    form.appendChild(div);
  }
}

function renderParticipantesRows(salida) {
  const container = document.getElementById('lista-participantes-form');
  if (!container) return;

  const camposVisibles = (salida?.campos_personalizados || []).filter((c) => c.visible !== false);
  const incluirEdad = salida.incluir_edad !== false;

  container.innerHTML = participantesDraft
    .map((p, idx) => {
      const edadHtml = incluirEdad ? `
        <div>
          <label class="form-label">Edad (años) *</label>
          <input type="number" class="form-control part-edad" data-idx="${idx}" value="${escapeHTML(p.edad)}" min="0" max="18" placeholder="Ej. 8" required />
        </div>
      ` : '';

      const extraHtml = camposVisibles
        .map((campo) => {
          const val = escapeHTML(p.extra?.[campo.label] || '');
          return `
            <div class="form-group" style="margin-top:8px;">
              <label class="form-label">${escapeHTML(campo.label)} ${campo.required ? '*' : '(opcional)'}</label>
              <input
                type="text"
                class="form-control part-extra-inp"
                data-idx="${idx}"
                data-label="${escapeHTML(campo.label)}"
                value="${val}"
                ${campo.required ? 'required' : ''}
                placeholder="Ingresa ${escapeHTML(campo.label.toLowerCase())}"
              />
            </div>
          `;
        })
        .join('');

      return `
        <div class="dynamic-row-card" style="display:block;">
          <div class="form-grid-2" style="margin-bottom:8px;">
            <div>
              <label class="form-label">Nombre completo del participante #${idx + 1} *</label>
              <input type="text" class="form-control part-nombre" data-idx="${idx}" value="${escapeHTML(p.nombre)}" placeholder="Nombre y apellido" required />
            </div>
            ${edadHtml}
          </div>
          ${extraHtml}
          <div style="margin-top:10px; text-align:right;">
            ${
              participantesDraft.length > 1
                ? `<button type="button" class="btn btn-danger-ghost btn-sm btn-del-part" data-idx="${idx}">Quitar participante</button>`
                : ''
            }
          </div>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('.part-nombre').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      participantesDraft[Number(e.target.dataset.idx)].nombre = e.target.value;
    });
  });

  container.querySelectorAll('.part-edad').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      participantesDraft[Number(e.target.dataset.idx)].edad = e.target.value;
    });
  });

  container.querySelectorAll('.part-extra-inp').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      const pIdx = Number(e.target.dataset.idx);
      const label = e.target.dataset.label;
      participantesDraft[pIdx].extra[label] = e.target.value;
    });
  });

  container.querySelectorAll('.btn-del-part').forEach((btn) => {
    btn.addEventListener('click', () => {
      participantesDraft.splice(Number(btn.dataset.idx), 1);
      renderParticipantesRows(salida);
    });
  });
}

async function handleInscripcionSubmit(state, onRegistrationSuccess) {
  const errorBox = document.getElementById('inscripcion-error');
  const btnSubmit = document.getElementById('btn-submit-inscripcion');
  if (errorBox) errorBox.classList.add('hidden');

  // Validar Habeas Data
  const chkHabeas = document.getElementById('chk-habeas-data');
  if (chkHabeas && !chkHabeas.checked) {
    showFormError('Debes autorizar el tratamiento de datos personales (Habeas Data) para continuar.');
    return;
  }

  const salida = state.salidas.find((s) => s.id === state.selectedSalidaId);
  if (!salida) {
    showFormError('Selecciona una salida válida.');
    return;
  }

  const requiereAcudiente = salida.requiere_acudiente !== false;
  const acudienteNombre = requiereAcudiente ? document.getElementById('inp-acudiente-nombre')?.value.trim() : '';
  const whatsapp = requiereAcudiente ? document.getElementById('inp-whatsapp')?.value.trim() : '';
  const correo = requiereAcudiente && salida.solicitar_correo ? document.getElementById('inp-correo')?.value.trim() : '';

  if (requiereAcudiente && !acudienteNombre) {
    showFormError('Por favor ingresa el nombre completo del adulto responsable.');
    return;
  }

  if (requiereAcudiente && (!whatsapp || whatsapp.replace(/\D/g, '').length < 7)) {
    showFormError('Por favor ingresa un número de WhatsApp válido.');
    return;
  }

  if (requiereAcudiente && salida.solicitar_correo && !correo) {
    showFormError('Por favor ingresa el correo electrónico obligatorio.');
    return;
  }

  const incluirEdad = salida.incluir_edad !== false;
  const participantesValidos = participantesDraft.map((p) => ({
    nombre: p.nombre.trim(),
    edad: incluirEdad ? Number(p.edad) : 0,
    extra: p.extra || {}
  }));

  if (
    participantesValidos.length === 0 ||
    participantesValidos.some((p) => !p.nombre || (incluirEdad && (Number.isNaN(p.edad) || p.edad < 0)))
  ) {
    showFormError('Completa el nombre y la edad de todos los participantes.');
    return;
  }

  const camposSalida = salida.campos_personalizados || [];
  for (let i = 0; i < participantesValidos.length; i++) {
    const p = participantesValidos[i];
    for (const c of camposSalida) {
      if (c.visible !== false && c.required && !p.extra[c.label]?.trim()) {
        showFormError(`El campo "${c.label}" es obligatorio para el participante #${i + 1} (${p.nombre || 'Sin nombre'}).`);
        return;
      }
    }
  }

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'REGISTRANDO INSCRIPCIÓN...';
  }

  try {
    const esSinCosto = salida.es_gratuita || Number(salida.precio_familia) === 0;

    const { data, error } = await supabase.rpc('registrar_inscripcion_familiar', {
      p_salida_id: salida.id,
      p_acudiente_nombre: acudienteNombre || 'Sin acudiente',
      p_whatsapp: whatsapp || 'Sin teléfono',
      p_correo: correo || '',
      p_participantes: participantesValidos,
      p_acompanantes: [],
      p_campos_extra: {},
      p_autorizacion_datos: true
    });

    if (error) throw error;



    renderPaymentStep(state, salida, data);
    await onRegistrationSuccess();
  } catch (err) {
    showFormError(err.message || 'Ocurrió un error al registrar la inscripción.');
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'CONTINUAR CON LA INSCRIPCIÓN';
    }
  }
}

function renderPaymentStep(state, salida, registro) {
  const formWrap = document.getElementById('inscripcion-form-wrapper');
  const pagoWrap = document.getElementById('inscripcion-pago-wrapper');
  if (formWrap) formWrap.classList.add('hidden');
  if (pagoWrap) pagoWrap.classList.remove('hidden');

  const esSinCosto = salida.es_gratuita || Number(registro.total_pagar) === 0;
  
  const titleEl = document.querySelector('#inscripcion-pago-wrapper .panel-title');
  const subtitleEl = document.getElementById('res-subtitulo');
  
  if (esSinCosto) {
    if (titleEl) titleEl.textContent = '¡Inscripción Confirmada!';
    if (subtitleEl) subtitleEl.textContent = 'Guarda tu código único. Tu cupo ha quedado confirmado exitosamente.';
  } else {
    if (titleEl) titleEl.textContent = '¡Preinscripción Registrada!';
    if (subtitleEl) subtitleEl.textContent = 'Guarda tu código único. Tu cupo quedará confirmado cuando el administrador verifique el pago por Nequi o Bre-B.';
  }

  const incluirEdad = salida.incluir_edad !== false;
  const nombresParticipantes = (registro.participantes || [])
    .map((p) => {
      const extrasStr = Object.entries(p.extra || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      return incluirEdad ? `${p.nombre} (${p.edad} años${extrasStr ? ' - ' + extrasStr : ''})` : `${p.nombre}${extrasStr ? ' - ' + extrasStr : ''}`;
    })
    .join('; ');

  const resCodigo = document.getElementById('res-codigo');
  const resActividad = document.getElementById('res-actividad');
  if (resCodigo) resCodigo.textContent = registro.codigo;
  if (resActividad) resActividad.textContent = salida.nombre;

  const acudienteRowReceipt = document.getElementById('res-acudiente-row-receipt');
  if (salida.requiere_acudiente === false) {
    if (acudienteRowReceipt) acudienteRowReceipt.classList.add('hidden');
  } else {
    if (acudienteRowReceipt) acudienteRowReceipt.classList.remove('hidden');
    const resAcudiente = document.getElementById('res-acudiente');
    if (resAcudiente) {
      resAcudiente.textContent =
        registro.acudiente_nombre !== 'Sin acudiente' ? registro.acudiente_nombre : `WhatsApp: ${registro.whatsapp}`;
    }
  }

  const resParticipantes = document.getElementById('res-participantes');
  if (resParticipantes) resParticipantes.textContent = nombresParticipantes;

  const resTotal = document.getElementById('res-total');
  if (resTotal) {
    resTotal.textContent = esSinCosto ? '$0 COP (Sin costo)' : `${formatCOP(registro.total_pagar)} COP`;
  }

  const nequiBox = document.getElementById('nequi-payment-box');
  const brebBox = document.getElementById('breb-payment-box');
  const selector = document.getElementById('metodos-pago');
  const llave = String(state.config?.llave_breb || '').trim();
  const btnBreb = document.getElementById('elegir-breb');
  const btnNequi = document.getElementById('elegir-nequi');
  const llaveVisible = document.getElementById('breb-llave-visible');
  if (llaveVisible) llaveVisible.textContent = llave;
  if (btnBreb) btnBreb.classList.toggle('hidden', !llave);
  let medioElegido = 'Nequi';
  const actualizarMetodo = (medio) => {
    medioElegido = medio;
    if (nequiBox) nequiBox.classList.toggle('hidden', medio !== 'Nequi');
    if (brebBox) brebBox.classList.toggle('hidden', medio !== 'Bre-B');
    if (btnNequi) { btnNequi.classList.toggle('btn-primary', medio === 'Nequi'); btnNequi.classList.toggle('btn-outline', medio !== 'Nequi'); btnNequi.setAttribute('aria-pressed', String(medio === 'Nequi')); }
    if (btnBreb) { btnBreb.classList.toggle('btn-primary', medio === 'Bre-B'); btnBreb.classList.toggle('btn-outline', medio !== 'Bre-B'); btnBreb.setAttribute('aria-pressed', String(medio === 'Bre-B')); }
    const btnWa = document.getElementById('btn-whatsapp-confirmar');
    if (btnWa) {
      const phone = (state.config?.whatsapp_admin || '').replace(/\D/g, '');
      const message = [
        `Hola, envío comprobante de inscripción a ${state.config?.nombre_comunidad || 'Talleres CREA'}:`,
        `Código: ${registro.codigo}`,
        `Actividad: ${salida.nombre}`,
        `Total: ${formatCOP(registro.total_pagar)} COP`,
        `Medio utilizado: ${medio}. Adjunto comprobante para verificación.`
      ].join('\n');
      btnWa.href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    }
  };
  if (btnNequi) btnNequi.onclick = () => actualizarMetodo('Nequi');
  if (btnBreb) btnBreb.onclick = () => actualizarMetodo('Bre-B');
  const copiar = document.getElementById('btn-copiar-breb');
  if (copiar) copiar.onclick = async () => {
    try { await navigator.clipboard.writeText(llave); copiar.textContent = 'Llave copiada'; }
    catch { window.prompt('Copia la llave Bre-B:', llave); }
  };
  const waActionBox = document.querySelector('.wa-action-box');

  if (esSinCosto) {
    if (nequiBox) nequiBox.classList.add('hidden');
    if (brebBox) brebBox.classList.add('hidden');
    if (selector) selector.classList.add('hidden');
    if (waActionBox) waActionBox.classList.add('hidden');
  } else {
    if (selector) selector.classList.remove('hidden');
    actualizarMetodo('Nequi');
    if (waActionBox) waActionBox.classList.remove('hidden');

    const qrImg = document.getElementById('nequi-qr-img');
    const qrPlaceholder = document.getElementById('nequi-qr-placeholder');
    if (state.config?.qr_nequi_url) {
      if (qrImg) { qrImg.src = state.config.qr_nequi_url; qrImg.classList.remove('hidden'); }
      if (qrPlaceholder) qrPlaceholder.classList.add('hidden');
    } else {
      if (qrImg) qrImg.classList.add('hidden');
      if (qrPlaceholder) qrPlaceholder.classList.remove('hidden');
    }

    const adminPhone = (state.config?.whatsapp_admin || '').replace(/\D/g, '');
    const mensajeLines = [
      `Hola *${state.config?.nombre_comunidad || 'Pequeños Exploradores'}*, envío confirmación de inscripción:`,
      `• *Código:* ${registro.codigo}`,
      `• *Actividad:* ${salida.nombre}`,
      salida.requiere_acudiente !== false && registro.acudiente_nombre !== 'Sin acudiente' ? `• *Adulto responsable:* ${registro.acudiente_nombre}` : null,
      `• *Participantes (${registro.participantes.length}):* ${nombresParticipantes}`,
      `• *Valor total:* ${formatCOP(registro.total_pagar)} COP`,
      `Realicé el pago por Nequi y adjunto el comprobante para su verificación.`
    ]
      .filter(Boolean)
      .join('\n');

    const waUrl = adminPhone
      ? `https://wa.me/${adminPhone}?text=${encodeURIComponent(mensajeLines)}`
      : `https://wa.me/?text=${encodeURIComponent(mensajeLines)}`;

    const btnWa = document.getElementById('btn-whatsapp-confirmar');
    if (btnWa) {
      btnWa.href = waUrl;
      btnWa.textContent = 'CONFIRMAR PAGO POR WHATSAPP';

      btnWa.onclick = async () => {
        if (supabase) {
          await supabase.rpc('reportar_pago_seguro', { p_id: registro.id });
        }
      };
    }
    actualizarMetodo('Nequi');
  }
}

function showFormError(msg) {
  const errorBox = document.getElementById('inscripcion-error');
  if (!errorBox) return;
  errorBox.textContent = msg;
  errorBox.classList.remove('hidden');
  errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
