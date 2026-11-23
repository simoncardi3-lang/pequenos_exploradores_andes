/* Decoración navideña independiente de los módulos de la aplicación. */
(() => {
  'use strict';
  const CONFIG = { luces: true, nieve: true, saludo: true, copos: 26, ocultarEnAdmin: true };
  const ids = ['andes-luces-navidad', 'andes-nieve-navidad', 'andes-saludo-navidad'];

  function quitarDecoracion() {
    ids.forEach(id => document.getElementById(id)?.remove());
    document.body.classList.remove('navidad-activa');
  }
  function crearLuces() {
    const cont = document.createElement('div');
    cont.id = 'andes-luces-navidad';
    cont.setAttribute('aria-hidden', 'true');
    const cable = document.createElement('div');
    cable.className = 'andes-cable';
    cont.appendChild(cable);
    const colores = ['#ffe071','#f26874','#7bd4ad','#83bafa'];
    for (let i = 0; i < 28; i++) {
      const luz = document.createElement('span');
      luz.className = 'andes-bombilla';
      luz.style.left = `${(i + .5) * 100 / 28}%`;
      luz.style.setProperty('--luz', colores[i % colores.length]);
      luz.style.setProperty('--retraso', `${(i % 5) * -.35}s`);
      cont.appendChild(luz);
    }
    document.body.appendChild(cont);
  }
  function crearNieve() {
    const cont = document.createElement('div');
    cont.id = 'andes-nieve-navidad';
    cont.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < CONFIG.copos; i++) {
      const copo = document.createElement('span');
      copo.className = 'andes-copo';
      copo.textContent = i % 3 === 0 ? '❄' : '•';
      copo.style.setProperty('--x', `${(i * 37.17) % 100}%`);
      copo.style.setProperty('--tam', `${8 + (i % 5) * 3}px`);
      copo.style.setProperty('--dur', `${11 + (i % 8) * 2}s`);
      copo.style.setProperty('--delay', `${-(i * 2.3) % 24}s`);
      copo.style.setProperty('--deriva', `${(i % 2 ? 1 : -1) * (12 + i % 25)}px`);
      cont.appendChild(copo);
    }
    document.body.appendChild(cont);
  }
  function actualizar() {
    const admin = location.hash.replace(/^#/, '').startsWith('admin');
    document.body.classList.toggle('navidad-admin', admin);
    quitarDecoracion();
    if (admin && CONFIG.ocultarEnAdmin) return;
    document.body.classList.add('navidad-activa');
    if (CONFIG.luces) crearLuces();
    if (CONFIG.nieve) crearNieve();
    if (CONFIG.saludo) {
      const saludo = document.createElement('div');
      saludo.id = 'andes-saludo-navidad';
      saludo.textContent = '🎄 ¡La creatividad también celebra la Navidad! ✨';
      document.body.appendChild(saludo);
    }
  }
  document.addEventListener('DOMContentLoaded', actualizar);
  window.addEventListener('hashchange', actualizar);
})();
