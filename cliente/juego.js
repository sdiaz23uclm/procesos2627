// Alianzas: capa de presentación del juego. Solo dibuja el estado que envía el servidor y le pide acciones
// mediante RestClient; todas las reglas se comprueban en el servidor (D-20).

const Juego = (() => {
  const INTERVALO_CONSULTA_MS = 500;

  // Banderas dibujadas con franjas: [color, peso] en orden; h = franjas horizontales, v = verticales
  const BANDERAS = {
    es: { dir: 'h', franjas: [['#AA151B', 1], ['#F1BF00', 2], ['#AA151B', 1]] },
    fr: { dir: 'v', franjas: [['#002654', 1], ['#FFFFFF', 1], ['#CE1126', 1]] },
    it: { dir: 'v', franjas: [['#009246', 1], ['#FFFFFF', 1], ['#CE2B37', 1]] },
    de: { dir: 'h', franjas: [['#000000', 1], ['#DD0000', 1], ['#FFCE00', 1]] },
    pt: { dir: 'v', franjas: [['#006600', 2], ['#FF0000', 3]] },
    nl: { dir: 'h', franjas: [['#AE1C28', 1], ['#FFFFFF', 1], ['#21468B', 1]] },
    be: { dir: 'v', franjas: [['#000000', 1], ['#FDDA24', 1], ['#EF3340', 1]] },
    ie: { dir: 'v', franjas: [['#169B62', 1], ['#FFFFFF', 1], ['#FF883E', 1]] },
  };

  const PERSONALIDAD = { agresiva: 'IA agresiva', diplomatica: 'IA diplomática', equilibrada: 'IA equilibrada' };

  let raiz;            // contenedor de la vista de juego
  let opciones;        // { alSalir, alPerderSesion }
  let partida = null;  // última vista recibida del servidor
  let temporizador = null;
  let activo = false;
  let menuAbierto = null;

  // --- utilidades de DOM (siempre textContent: nunca se interpreta HTML de los datos) ---
  function el(tag, props = {}, hijos = []) {
    const nodo = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') nodo.className = v;
      else if (k === 'text') nodo.textContent = v;
      else if (k === 'style') Object.assign(nodo.style, v);
      else if (k.startsWith('on')) nodo.addEventListener(k.slice(2), v);
      else nodo.setAttribute(k, v);
    }
    for (const h of [].concat(hijos)) if (h) nodo.appendChild(typeof h === 'string' ? document.createTextNode(h) : h);
    return nodo;
  }

  function bandera(id) {
    const b = BANDERAS[id];
    const total = b.franjas.reduce((s, [, p]) => s + p, 0);
    let acumulado = 0;
    const tramos = b.franjas.map(([color, peso]) => {
      const inicio = (acumulado / total) * 100;
      acumulado += peso;
      return `${color} ${inicio}% ${(acumulado / total) * 100}%`;
    });
    const nodo = el('div', { class: 'bandera', title: '' });
    nodo.style.background = `linear-gradient(${b.dir === 'h' ? 'to bottom' : 'to right'}, ${tramos.join(', ')})`;
    return nodo;
  }

  function corazones(vidas, total = 3) {
    const span = el('span', { class: 'corazones' });
    for (let i = 0; i < total; i++) span.appendChild(el('span', { class: i < vidas ? '' : 'vacio', text: '♥' }));
    return span;
  }

  const distancia = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const yo = () => partida.jugadores.find(j => j.id === partida.tuPais);

  function mensaje(texto, ok = false) {
    const m = raiz.querySelector('.juego-msg');
    if (!m) return;
    m.className = `juego-msg ${ok ? 'ok' : 'ko'}`;
    m.textContent = texto;
    clearTimeout(mensaje.t);
    mensaje.t = setTimeout(() => { m.textContent = ''; }, 3500);
  }

  // Errores de red o del servidor: si la sesión caducó se vuelve al login
  function tratarError(err) {
    if (err.estado === 401) {
      cerrar();
      opciones.alPerderSesion();
      return;
    }
    mensaje(err.message);
  }

  // --- ciclo de consulta al servidor ---
  function programarConsulta() {
    clearTimeout(temporizador);
    if (!activo || !partida || partida.pausada || partida.estado !== 'en_curso') return;
    temporizador = setTimeout(async () => {
      try {
        const vista = await RestClient.obtenerPartida();
        if (!activo) return;
        if (vista) actualizar(vista);
      } catch (err) {
        tratarError(err);
      }
      programarConsulta();
    }, INTERVALO_CONSULTA_MS);
  }

  function actualizar(vista) {
    partida = vista;
    dibujarPartida();
    programarConsulta();
  }

  async function actuar(accion) {
    cerrarMenu();
    try {
      actualizar(await RestClient.accionPartida(accion));
    } catch (err) {
      tratarError(err);
    }
  }

  // --- pantallas ---
  async function abrir(raizDom, opts) {
    raiz = raizDom;
    opciones = opts;
    activo = true;
    try {
      const vista = await RestClient.obtenerPartida();
      if (vista && vista.estado === 'en_curso') {
        actualizar(vista);
      } else {
        await dibujarSeleccion(vista);
      }
    } catch (err) {
      tratarError(err);
    }
  }

  function cerrar() {
    activo = false;
    clearTimeout(temporizador);
    partida = null;
    ui = null;
    menuAbierto = null;
    if (raiz) raiz.replaceChildren();
  }

  async function dibujarSeleccion(anterior = null) {
    clearTimeout(temporizador);
    partida = null;
    ui = null;
    menuAbierto = null;
    const paises = await RestClient.listarPaises();
    const rejilla = el('div', { class: 'paises' }, paises.map(p =>
      el('div', {
        class: 'pais-opcion', role: 'button', tabindex: '0',
        onclick: () => empezar(p.id),
        onkeydown: e => { if (e.key === 'Enter') empezar(p.id); },
      }, [bandera(p.id), el('span', { text: p.nombre })])
    ));
    raiz.replaceChildren(el('div', { class: 'juego' }, [
      el('div', { class: 'juego-cabecera' }, [
        el('h2', { text: 'Alianzas · Elige tu país' }),
        el('div', { class: 'juego-botones' }, [el('button', { class: 'btn-sec', text: 'Volver al panel', onclick: salir })]),
      ]),
      anterior ? el('p', { class: 'ayuda', text: `Tu última partida terminó: ${anterior.resultado === 'victoria' ? 'ganaste' : 'perdiste'}${anterior.ganador ? ` (ganó ${anterior.ganador})` : ''}.` }) : null,
      el('p', { class: 'ayuda', text: 'Jugarás contra 3 IAs con países al azar. Gana el último país en pie.' }),
      rejilla,
      el('p', { class: 'juego-msg' }),
    ]));
  }

  async function empezar(pais) {
    try {
      actualizar(await RestClient.nuevaPartida(pais));
    } catch (err) {
      tratarError(err);
    }
  }

  function salir() {
    cerrar();
    opciones.alSalir();
  }

  async function guardar() {
    try {
      actualizar(await RestClient.guardarPartida());
      mensaje('Partida guardada. Está en pausa hasta que pulses «Reanudar».', true);
    } catch (err) {
      tratarError(err);
    }
  }

  async function reanudar() {
    try {
      actualizar(await RestClient.reanudarPartida());
    } catch (err) {
      tratarError(err);
    }
  }

  // --- partida en curso ---
  // La estructura (cabecera, tablero, panel) se crea una vez; cada consulta solo actualiza lo que cambia.
  // Así un click no se pierde porque el tablero se redibuje mientras el usuario pulsa.
  let ui = null;

  function dibujarPartida() {
    if (!ui || !raiz.contains(ui.raiz)) crearEstructura();
    actualizarCabecera();
    actualizarTablero();
    actualizarLateral();
  }

  function crearEstructura() {
    const p = partida;
    const tablero = el('div', { class: 'tablero' });
    tablero.style.setProperty('--tam', p.tam);
    const celdas = [];
    for (let y = 0; y < p.tam; y++) {
      for (let x = 0; x < p.tam; x++) {
        const celda = el('div', { class: 'celda', onclick: ev => clicCelda(x, y, ev) });
        celda.dataset.clave = '';
        celdas.push(celda);
        tablero.appendChild(celda);
      }
    }
    ui = {
      titulo: el('h2'),
      botones: el('div', { class: 'juego-botones' }),
      clavesBotones: '',
      ronda: el('strong'),
      barra: el('div'),
      temporizador: null,
      puntos: el('strong'),
      recarga: el('strong'),
      vidas: el('strong'),
      tablero,
      celdas,
      capa: null,
      envoltorio: el('div', { class: 'tablero-envoltorio' }, [tablero]),
      paises: el('ul', { class: 'lista-paises' }),
      eventos: el('ul', { class: 'eventos' }),
      guardado: el('p', { class: 'ayuda' }),
    };
    ui.temporizador = el('div', { class: 'temporizador' }, ui.barra);
    ui.raiz = el('div', { class: 'juego' }, [
      el('div', { class: 'juego-cabecera' }, [ui.titulo, ui.botones]),
      el('div', { class: 'juego-estado' }, [
        el('div', { class: 'dato' }, ['Ronda termina en', ui.ronda, ui.temporizador]),
        el('div', { class: 'dato' }, ['Tus puntos de acción', ui.puntos]),
        el('div', { class: 'dato' }, ['Recarga +2 en', ui.recarga]),
        el('div', { class: 'dato' }, ['Tus vidas · radio', ui.vidas]),
      ]),
      el('p', { class: 'juego-msg' }),
      el('div', { class: 'juego-cuerpo' }, [
        ui.envoltorio,
        el('div', { class: 'juego-lateral' }, [
          el('h3', { text: 'Países' }), ui.paises,
          el('h3', { text: 'Últimos sucesos' }), ui.eventos,
          ui.guardado,
          el('p', { class: 'ayuda', text: 'Haz click en una casilla contigua para moverte, o en un país dentro de tu radio (zona azul) para atacarle o darle un punto. Cada acción cuesta 1 punto; los que no gastes se acumulan hasta 6.' }),
        ]),
      ]),
    ]);
    raiz.replaceChildren(ui.raiz);
  }

  function actualizarCabecera() {
    const p = partida;
    const mio = yo();
    const s = Math.ceil(p.msRestantesRonda / 1000);
    ui.titulo.textContent = `Alianzas · Ronda ${p.ronda}`;
    ui.ronda.textContent = `${s} s`;
    ui.barra.style.width = `${(p.msRestantesRonda / p.duracionRondaMs) * 100}%`;
    ui.temporizador.classList.toggle('urgente', s <= 3);
    ui.recarga.textContent = `${Math.ceil(p.msHastaRecarga / 1000)} s`;

    const pips = el('span', { class: 'pips' });
    for (let i = 0; i < p.topePuntos; i++) pips.appendChild(el('span', { class: i < mio.puntos ? 'lleno' : '' }));
    ui.puntos.replaceChildren(pips, ` ${mio.puntos}/${p.topePuntos}`);
    ui.vidas.replaceChildren(corazones(mio.vidas), ` · ${mio.radio}`);

    // Los botones solo se recrean si cambia la situación (pausa, fin, eliminado)
    const clave = `${p.estado}|${p.pausada}|${mio.vivo}`;
    if (clave === ui.clavesBotones) return;
    ui.clavesBotones = clave;
    const puedeJugar = p.estado === 'en_curso' && !p.pausada && mio.vivo;
    ui.botones.replaceChildren(
      el('button', { text: 'Ampliar radio (1 punto)', onclick: () => actuar({ tipo: 'expandir' }), ...(puedeJugar ? {} : { disabled: '' }) }),
      p.estado === 'en_curso'
        ? (p.pausada
          ? el('button', { text: 'Reanudar', onclick: reanudar })
          : el('button', { class: 'btn-sec', text: 'Guardar y pausar', onclick: guardar }))
        : el('button', { text: 'Nueva partida', onclick: () => dibujarSeleccion(p) }),
      el('button', { class: 'btn-sec', text: 'Salir', onclick: salir }),
    );
  }

  function actualizarTablero() {
    const p = partida;
    const mio = yo();
    const porCasilla = new Map(p.jugadores.map(j => [`${j.x},${j.y}`, j]));

    for (let y = 0; y < p.tam; y++) {
      for (let x = 0; x < p.tam; x++) {
        const celda = ui.celdas[y * p.tam + x];
        const ocupante = porCasilla.get(`${x},${y}`);
        const d = distancia(mio, { x, y });
        const clases = ['celda'];
        if (mio.vivo && d <= mio.radio) clases.push('en-radio');
        if (mio.vivo && d === 1) clases.push('contigua');
        if (ocupante) {
          clases.push('ocupada');
          if (ocupante.id === mio.id) clases.push('mio');
          if (!ocupante.vivo) clases.push('eliminado');
        }
        const className = clases.join(' ');
        if (celda.className !== className) celda.className = className;

        // El contenido solo se toca si cambia quién está y cuántas vidas tiene
        const clave = ocupante ? `${ocupante.id}:${ocupante.vidas}:${ocupante.vivo}` : '';
        if (celda.dataset.clave !== clave) {
          celda.dataset.clave = clave;
          celda.title = ocupante ? `${ocupante.nombre}${ocupante.vivo ? '' : ' (eliminado)'}` : '';
          celda.replaceChildren();
          if (ocupante) {
            celda.appendChild(bandera(ocupante.id));
            if (ocupante.vivo) celda.appendChild(el('span', { class: 'vidas-mini', text: '♥'.repeat(ocupante.vidas) }));
          }
        }
      }
    }

    // Capa de pausa o de final de partida
    const claveCapa = p.estado === 'terminada' ? `fin-${p.resultado}` : (p.pausada ? 'pausa' : '');
    if ((ui.capa?.dataset.clave || '') !== claveCapa) {
      ui.capa?.remove();
      ui.capa = null;
      if (p.estado === 'terminada') {
        ui.capa = el('div', { class: 'capa' }, [
          el('h3', { text: p.resultado === 'victoria' ? '¡Victoria!' : 'Derrota' }),
          el('p', { text: p.resultado === 'victoria' ? 'Tu país es el último en pie.' : (p.ganador ? `Gana ${p.ganador}.` : 'Tu país ha sido eliminado.') }),
          el('button', { text: 'Nueva partida', onclick: () => dibujarSeleccion(p) }),
        ]);
      } else if (p.pausada) {
        ui.capa = el('div', { class: 'capa' }, [
          el('h3', { text: 'En pausa' }),
          el('p', { text: 'La partida está guardada.' }),
          el('button', { text: 'Reanudar', onclick: reanudar }),
        ]);
      }
      if (ui.capa) {
        ui.capa.dataset.clave = claveCapa;
        ui.envoltorio.appendChild(ui.capa);
        cerrarMenu();
      }
    }
  }

  function actualizarLateral() {
    const p = partida;
    ui.paises.replaceChildren(...p.jugadores.map(j =>
      el('li', { class: `${j.id === p.tuPais ? 'mio' : ''} ${j.vivo ? '' : 'eliminado'}` }, [
        bandera(j.id),
        el('div', {}, [
          el('div', {}, [el('strong', { text: j.nombre }), ` · ${j.humano ? 'Tú' : PERSONALIDAD[j.personalidad]}`]),
          el('div', { class: 'detalle' }, [corazones(j.vidas), ` · ${j.puntos} pts · radio ${j.radio}`]),
        ]),
      ])
    ));
    ui.eventos.replaceChildren(...p.eventos.map(ev =>
      el('li', {}, [el('span', { class: 'r', text: `R${ev.ronda}` }), ev.texto])
    ));
    const guardado = p.guardadaEn ? `Guardada manualmente: ${new Date(p.guardadaEn).toLocaleTimeString()}. ` : '';
    ui.guardado.textContent = `${guardado}Autoguardado en la ronda ${p.autoguardadoRonda}.`;
  }

  function clicCelda(x, y, ev) {
    const p = partida;
    const mio = yo();
    if (!p || p.pausada || p.estado !== 'en_curso' || !mio.vivo) return;
    const ocupante = p.jugadores.find(j => j.x === x && j.y === y);
    const d = distancia(mio, { x, y });

    cerrarMenu();
    if (ocupante && ocupante.id === mio.id) return;
    if (d > mio.radio) {
      mensaje('Esa casilla está fuera de tu radio de acción.');
      return;
    }
    if (!ocupante) {
      if (d === 1) actuar({ tipo: 'mover', x, y });
      else mensaje('Solo puedes moverte a una casilla contigua.');
      return;
    }
    if (!ocupante.vivo) {
      mensaje(`${ocupante.nombre} ya está eliminado.`);
      return;
    }
    abrirMenu(ocupante, ev.currentTarget);
  }

  function abrirMenu(objetivo, celda) {
    menuAbierto = el('div', { class: 'menu-accion' }, [
      el('p', { text: objetivo.nombre }),
      el('button', { class: 'btn-danger', text: 'Atacar (1 punto)', onclick: () => actuar({ tipo: 'atacar', objetivo: objetivo.id }) }),
      el('button', { text: 'Dar 1 punto', onclick: () => actuar({ tipo: 'regalar', objetivo: objetivo.id }) }),
      el('button', { class: 'btn-sec', text: 'Cancelar', onclick: cerrarMenu }),
    ]);
    menuAbierto.style.left = `${celda.offsetLeft + celda.offsetWidth}px`;
    menuAbierto.style.top = `${celda.offsetTop}px`;
    ui.envoltorio.appendChild(menuAbierto);
  }

  function cerrarMenu() {
    menuAbierto?.remove();
    menuAbierto = null;
  }

  return { abrir, cerrar };
})();
