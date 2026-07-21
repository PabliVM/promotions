// ── campograma-render.js — Render principal, cards, lista, calendario, filtros ──
// Blindaje: si este script se llegara a ejecutar más de una vez en la misma página
// (doble <script>, caché vieja, service worker fantasma, etc.), no debe romper nada.
if (window.__rmRenderLoaded) {
  console.warn('campograma-render-new.js ya estaba cargado — segunda ejecución ignorada.');
} else {
window.__rmRenderLoaded = true;
(function(){
let _diaElegidoManualmente = false; // en móvil, ningún día se marca hasta que el usuario toque uno
let _yaSubidoInicial = false; // para no forzar scroll arriba en CADA acción, solo al arrancar
function esMovilVista(){ return window.matchMedia('(max-width: 640px)').matches; }
let _yaCentradoEscritorio = false; // el centrado en "hoy" de escritorio, solo una vez al arrancar
function render(){
  const _scrollXPrevio = window.scrollX, _scrollYPrevio = window.scrollY;
  renderDias(); renderEqs(); renderCards();
  // Restaurar posición de scroll ANTES de que el navegador pinte, para que no se note el salto
  if(document.scrollingElement){
    document.scrollingElement.scrollLeft = _scrollXPrevio;
    document.scrollingElement.scrollTop = _scrollYPrevio;
  }
  autoGuardar();
  if(esMovilVista()){
    if(!_yaSubidoInicial){
      _yaSubidoInicial = true;
      window.scrollTo(0,0); // móvil: solo al ARRANCAR la app sube arriba
    }
  } else if(vistaActual==='semana' && !_yaCentradoEscritorio){
    _yaCentradoEscritorio = true;
    centrarDiaEnEscritorio(); // solo la primera vez: centra la card de hoy
  }
}
function centrarDiaEnEscritorio(){
  if(vistaActual!=='semana') return;
  requestAnimationFrame(()=>{
    const hoyEl = document.querySelector('.card-hdr-hoy');
    if(hoyEl){
      const td = hoyEl.closest('.semana-td-card');
      if(td) td.scrollIntoView({behavior:'auto', block:'nearest', inline:'center'});
      return;
    }
    // Si no hay card marcada como "hoy" (p.ej. semana sin hoy dentro), centrar en el día activo
    const hdrs = document.querySelectorAll('.card-hdr-fecha');
    hdrs.forEach(h=>{
      if(h.textContent.trim().startsWith(dia)){
        const td = h.closest('.semana-td-card');
        if(td) td.scrollIntoView({behavior:'auto', block:'nearest', inline:'center'});
      }
    });
  });
}
function renderDias(){
  // Actualizar etiqueta semana en botón
  const lunes = FECHAS['LUNES']||'';
  const domingo = FECHAS['DOMINGO']||'';
  // Fechas apiladas: ini arriba, fin abajo
  const iniEl = document.getElementById('semana-fecha-ini');
  const finEl = document.getElementById('semana-fecha-fin');
  if(iniEl && finEl){
    iniEl.textContent = lunes  || '—';
    finEl.textContent = domingo|| '—';
  }
  const subLbl = document.getElementById('sub-semana-lbl');
  if(subLbl) subLbl.textContent = (lunes && domingo) ? lunes + ' – ' + domingo : 'Semana';
  document.getElementById('top-semana-lbl').textContent =
    lunes ? lunes + ' – ' + domingo : 'Semana';
  // Días strip
  const strip = document.getElementById('dias-strip');
  strip.innerHTML='';
  DIAS.forEach(d=>{
    const tieneDatos = EQUIPOS.some(e=>data[d][e].campo.length>0);
    const esP = EQUIPOS.some(e=>modoPartido[d]?.[e]);
    // Escritorio: se marca el día activo normalmente. Móvil: solo si el usuario ya eligió uno.
    const marcado = esMovilVista() ? (_diaElegidoManualmente && d===dia) : (d===dia);
    const tab = mk('div','dia-tab'+(marcado?' active':'')+(tieneDatos?' tiene-datos':'')+(esP?' es-partido':''));
    tab.setAttribute('role','tab');
    const f = FECHAS[d] || '';
    const [numDia] = f.split('/');
    tab.innerHTML=`
      <span class="dia-tab-nombre">${d.slice(0,3)}</span>
      <span class="dia-tab-fecha">${numDia||''}</span>
      <span class="dia-tab-dot"></span>`;
    tab.onclick=()=>{
      dia=d;sessionStorage.setItem('rm_dia',d);
      _diaElegidoManualmente = true;
      renderDias();renderCards();
      if(!esMovilVista()) centrarDiaEnEscritorio();
    };
    strip.appendChild(tab);
  });
}
// ══════════════════════════════════════════════════
// CALENDARIO MINI
// ══════════════════════════════════════════════════
let _calFecha = new Date(); // mes visible en el calendario
let _calLunesSel = null;    // lunes seleccionado
const DIAS_DOW = ['L','M','X','J','V','S','D'];
function abrirCal(){
  // Iniciar en el lunes actual de FECHAS
  const partes = FECHAS['LUNES'] ? FECHAS['LUNES'].split('/') : null;
  if(partes){
    const hoy = new Date();
    _calFecha = new Date(hoy.getFullYear(), parseInt(partes[1])-1, parseInt(partes[0]));
    _calLunesSel = new Date(_calFecha);
  } else {
    _calFecha = new Date();
    _calLunesSel = null;
  }
  renderCal();
  document.getElementById('cal-overlay').classList.add('open');
}
let _calModoCopia = false;
function cerrarCal(){
  document.getElementById('cal-overlay').classList.remove('open');
  if(_calModoCopia){
    _calModoCopia = false;
    document.getElementById('copy-modal-overlay').classList.add('open');
  }
}
function renderCal(){
  const mes = _calFecha.getMonth();
  const anyo = _calFecha.getFullYear();
  // Nombre mes en inglés capitalizado (como en la foto)
  const mesNombre = _calFecha.toLocaleString('en-GB',{month:'long'});
  const mesLabel = mesNombre.charAt(0).toUpperCase()+mesNombre.slice(1)+' '+anyo;
  document.getElementById('cal-mes').textContent = mesLabel;
  const grid = document.getElementById('cal-grid');
  grid.innerHTML='';
  // Cabecera días semana — MON TUE WED...
  ['MON','TUE','WED','THU','FRI','SAT','SUN'].forEach(d=>{
    const el=mk('div','cal-dow'); el.textContent=d; grid.appendChild(el);
  });
  // Primer día del mes
  const primerDia = new Date(anyo, mes, 1);
  let dow = primerDia.getDay();
  dow = dow===0 ? 6 : dow-1; // lunes=0
  for(let i=0;i<dow;i++){
    grid.appendChild(mk('div','cal-day vacio'));
  }
  const diasEnMes = new Date(anyo, mes+1, 0).getDate();
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  for(let d=1;d<=diasEnMes;d++){
    const fecha = new Date(anyo, mes, d);
    const dowDia = fecha.getDay(); // 0=dom,1=lun...
    const esLunes = dowDia===1;
    const el=mk('div','cal-day');
    el.textContent=d;
    if(fecha.getTime()===hoy.getTime()) el.classList.add('hoy');
    // Resaltar semana seleccionada
    if(_calLunesSel){
      const domingo = new Date(_calLunesSel);
      domingo.setDate(_calLunesSel.getDate()+6);
      if(fecha>=_calLunesSel && fecha<=domingo){
        el.classList.add('semana-sel');
        if(esLunes) el.classList.add('lunes-sel');
        if(dowDia===0) el.classList.add('domingo-sel');
        // Día de hoy dentro de semana seleccionada → círculo azul
        if(fecha.getTime()===hoy.getTime()) el.classList.add('dia-sel');
      }
      // Lunes seleccionado → círculo azul
      if(fecha.getTime()===_calLunesSel.getTime()) el.classList.add('dia-sel');
    }
    // Todos los días son clicables — seleccionan la semana del lunes correspondiente
    el.onclick=()=>{
      // Calcular el lunes de esa semana
      const d2 = new Date(anyo, mes, d);
      const dw = d2.getDay();
      const diff = dw===0 ? -6 : 1-dw;
      const lun = new Date(d2); lun.setDate(d2.getDate()+diff);
      _calLunesSel = lun;
      renderCal();
    };
    grid.appendChild(el);
  }
}
function resetCal(){
  _calLunesSel = null;
  if(!_calModoCopia) FECHAS = calcFechasSemana(new Date());
  renderCal();
}
function aplicarSemana(){
  if(!_calLunesSel){ toast('Selecciona un día'); return; }
  if(_calModoCopia === 'semana'){
    _copySemanaDestLunes = new Date(_calLunesSel);
    // Resetear DESPUÉS para que cerrarCal no reabra el modal (lo hacemos nosotros)
    const modoBak = _calModoCopia;
    _calModoCopia = false;
    document.getElementById('cal-overlay').classList.remove('open');
    actualizarLblSemana();
    document.getElementById('copy-modal-overlay').classList.add('open');
    return;
  }
  if(_calModoCopia === 'dia'){
    _copyDiaSemanaLunes = new Date(_calLunesSel);
    _calModoCopia = false;
    document.getElementById('cal-overlay').classList.remove('open');
    // Mostrar label y re-renderizar días de esa semana
    const fechas = calcFechasSemana(_copyDiaSemanaLunes);
    const lbl = document.getElementById('copy-dia-semana-lbl');
    lbl.textContent = 'Semana del ' + fechas['LUNES'] + ' al ' + fechas['DOMINGO'];
    lbl.style.display = 'block';
    renderCopyDias();
    document.getElementById('copy-modal-overlay').classList.add('open');
    return;
  }
  guardarFotoSemanaActual();
  FECHAS = calcFechasSemana(_calLunesSel);
  if(!cargarFotoSemana(_semanaKeyActual)) crearSemanaVacia();
  // Si hoy cae dentro de esta semana, seleccionar ese día automáticamente
  DIAS.forEach(d=>{
    const [dd,mm] = (FECHAS[d]||'').split('/');
    const hoy = new Date();
    if(dd && mm && parseInt(dd)===hoy.getDate() && parseInt(mm)===(hoy.getMonth()+1)){
      dia = d;
      sessionStorage.setItem('rm_dia', d);
    }
  });
  autoGuardar();
  renderDias();
  renderCards();
  cerrarCal();
  toast('📅 Semana actualizada');
  if(document.getElementById('control-overlay').classList.contains('open')){
    _controlDia = dia;
    renderControlDiaBtns();
    renderControl();
  }
}
// Navegación meses
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('cal-prev').onclick=()=>{
    _calFecha.setMonth(_calFecha.getMonth()-1); renderCal();
  };
  document.getElementById('cal-next').onclick=()=>{
    _calFecha.setMonth(_calFecha.getMonth()+1); renderCal();
  };
  // Cerrar al clicar fuera
  document.getElementById('cal-overlay').onclick=(e)=>{
    if(e.target===document.getElementById('cal-overlay')) cerrarCal();
  };
});
const EQ_LABEL = {
  'TODOS':'Todos','CASTILLA':'CAST','RMC':'RMC',
  'JUVENIL A':'JA','JUVENIL B':'JB','JUVENIL C':'JC','CADETE A':'CA',
  '1ER EQUIPO':'1ER EQ'
};
function renderEqs(){
  const w=document.getElementById('eq-strip');
  if(!w) return;
  w.innerHTML='';
  const bTodos=mk('div','eq-tab'+('TODOS'===eqF?' active':''));
  bTodos.textContent=EQ_LABEL['TODOS']||'TODOS';
  bTodos.onclick=()=>{eqF='TODOS';renderEqs();renderCards();};
  w.appendChild(bTodos);
  const b1=mk('div','eq-tab eq-primer'+(eqF==='1ER EQUIPO'?' active':''));
  b1.textContent='1ER EQ';
  b1.title='Ver jugadores con Primer Equipo';
  b1.onclick=()=>{eqF='1ER EQUIPO';renderEqs();renderCards();};
  w.appendChild(b1);
  EQUIPOS.forEach(e=>{
    const b=mk('div','eq-tab'+(e===eqF?' active':''));
    b.textContent=EQ_LABEL[e]||e;
    b.onclick=()=>{eqF=e;renderEqs();renderCards();};
    w.appendChild(b);
  });
}
function renderCopyBar(){ /* eliminado — usar modal copiar */ }

// ══════════════════════════════════════════════════
// VISTA LISTA — alternativa al campo
// ══════════════════════════════════════════════════
let _vistaListaGlobal = false;
const _vistaListaCards = new Set(); // cards individuales en modo lista

function toggleVistaListaGlobal(){
  _vistaListaGlobal = !_vistaListaGlobal;
  const btn = document.getElementById('btn-vista-lista-global');
  if(btn){
    btn.style.background = _vistaListaGlobal ? 'rgba(37,99,235,.08)' : '';
    btn.style.borderColor = _vistaListaGlobal ? '#2563eb' : '';
    btn.style.color = _vistaListaGlobal ? '#2563eb' : '';
  }
  renderCards();
  if(vistaActual==='semana') requestAnimationFrame(()=>{
    igualarZonasSemana(document.getElementById('grid'));
  });
}

function toggleVistaListaCard(eq, d){
  const key = eq+'_'+d;
  if(_vistaListaCards.has(key)) _vistaListaCards.delete(key);
  else _vistaListaCards.add(key);
  renderCards();
  if(vistaActual==='semana') requestAnimationFrame(()=>igualarZonasSemana(document.getElementById('grid')));
}

function esVistaLista(eq, d){
  return _vistaListaGlobal || _vistaListaCards.has(eq+'_'+(d||dia));
}

function reordenarEnZona(eq, d, zona, nombreMovido, nombreDestino){
  const arr = data[d]?.[eq]?.[zona];
  if(!Array.isArray(arr)) return;
  const fromIdx = arr.indexOf(nombreMovido);
  const toIdx = arr.indexOf(nombreDestino);
  if(fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
  arr.splice(fromIdx, 1);
  const newToIdx = arr.indexOf(nombreDestino);
  arr.splice(newToIdx, 0, nombreMovido);
  autoGuardar();
  renderCards();
}

function renombrarJugadorGlobal(nombreViejo, nombreNuevo){
  nombreNuevo = nombreNuevo.trim().toUpperCase();
  if(!nombreNuevo || nombreNuevo === nombreViejo) return false;

  // Reemplazar en data: todas las zonas, todos los días, todos los equipos
  DIAS.forEach(d => {
    EQUIPOS.forEach(eq => {
      const eqData = data[d]?.[eq];
      if(!eqData) return;
      ['campo','banquillo','disponibles','promovidos_1er','lesionados','otros','extra'].forEach(zona => {
        const arr = eqData[zona];
        if(!Array.isArray(arr)) return;
        const idx = arr.indexOf(nombreViejo);
        if(idx >= 0) arr[idx] = nombreNuevo;
      });
    });
  });

  // Reemplazar en origen
  if(origen[nombreViejo] !== undefined){
    origen[nombreNuevo] = origen[nombreViejo];
    delete origen[nombreViejo];
  }

  // Reemplazar en porteros
  const pIdx = porteros.indexOf(nombreViejo);
  if(pIdx >= 0) porteros[pIdx] = nombreNuevo;

  // Reemplazar en listaUYL
  const uIdx = listaUYL.indexOf(nombreViejo);
  if(uIdx >= 0) listaUYL[uIdx] = nombreNuevo;

  // Reemplazar en plantillas
  Object.keys(plantillas).forEach(eq => {
    const arr = plantillas[eq];
    if(!Array.isArray(arr)) return;
    const idx = arr.indexOf(nombreViejo);
    if(idx >= 0) arr[idx] = nombreNuevo;
  });

  // Reemplazar en promInfo (destinos de promoción)
  DIAS.forEach(d => {
    EQUIPOS.forEach(eq => {
      const pi = promInfo[d]?.[eq];
      if(pi && pi[nombreViejo] !== undefined){
        pi[nombreNuevo] = pi[nombreViejo];
        delete pi[nombreViejo];
      }
    });
  });

  autoGuardar();
  renderCards();
  toast('✓ Renombrado a ' + nombreNuevo);
  return true;
}

function buildListaView(eq, d){
  const diaKey = d || dia;
  const eqData = data[diaKey][eq] || {};
  const wrap = mk('div','card-lista-wrap');

  const zonas = [
    { key:'campo',          label:'LISTADO DE JUGADORES',  color:'#2563eb' },
    { key:'banquillo',      label:'BANQUILLO',     color:'#d97706' },
    { key:'promovidos_1er', label: colNames[eq]?.[0]||'PROMOCIONADOS', color:'#d97706' },
    { key:'lesionados',     label: colNames[eq]?.[1]||'LESIONADOS',    color:'#dc2626' },
    { key:'otros',          label: colNames[eq]?.[2]||'OTROS',     color:'#6b7280' },
    { key:'extra',          label: colNames[eq]?.[3]||'EXTRA',     color:'#7c3aed' },
  ];

  // Barra de acciones
  const acciones = mk('div','card-lista-acciones');

  // Botón copiar texto
  const btnCopiar = mk('button','card-lista-btn');
  btnCopiar.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copiar';
  btnCopiar.onclick = (e) => {
    e.stopPropagation();
    const [_fD,_fM] = (FECHAS[diaKey]||'').split('/');
    const _fAA = new Date().getFullYear().toString().slice(2);
    const fechaFmt = (_fD&&_fM) ? _fD.padStart(2,'0')+'/'+_fM.padStart(2,'0')+'/'+_fAA : '';
    let texto = eq + ' - ' + diaKey + ' ' + fechaFmt + '\n';
    texto += '='.repeat(26) + '\n';
    zonas.forEach(({key, label}) => {
      const jugs = eqData[key] || [];
      if(!jugs.length) return;
      let labelOut = label.toUpperCase();
      if(key === 'campo'){
        // Listado de jugadores: contador con porteros separados (21+3)
        const numPorteros = jugs.filter(n => porteros.includes(n)).length;
        const numNormal = jugs.length - numPorteros;
        labelOut += ' (' + numNormal + (numPorteros>0 ? '+'+numPorteros : '') + ')';
      } else if(key === 'banquillo'){
        // Banquillo: solo el total
        labelOut += ' (' + jugs.length + ')';
      }
      // Promocionados y demás zonas: sin número
      texto += '\n*' + labelOut + ':*\n';
      // Porteros primero, luego el resto, manteniendo orden relativo dentro de cada grupo
      const jugsOrdenados = [...jugs].sort((a, b) => {
        const aPor = porteros.includes(a) ? 0 : 1;
        const bPor = porteros.includes(b) ? 0 : 1;
        return aPor - bPor;
      });
      jugsOrdenados.forEach(n => {
        const esPor = porteros.includes(n);
        let linea = '  - ' + n + (esPor ? ' (POR)' : '');
        if(key === 'promovidos_1er'){
          const destino = promInfo[diaKey]?.[eq]?.[n];
          const siglas = {'CASTILLA':'CAST','RMC':'RMC','JUVENIL A':'JA','JUVENIL B':'JB','JUVENIL C':'JC','CADETE A':'CA'};
          if(destino) linea += '  → ' + (destino === '1ER EQUIPO' ? '1ER' : (siglas[destino]||destino));
        }
        texto += linea + '\n';
      });
    });
    navigator.clipboard.writeText(texto).then(()=>toast('✓ Copiado al portapapeles')).catch(()=>toast('❌ Error al copiar'));
  };
  acciones.appendChild(btnCopiar);
  wrap.appendChild(acciones);

  // Zonas
  let hayJugadores = false;
  zonas.forEach(({key, label, color}) => {
    const jugadores = eqData[key] || [];
    if(!jugadores.length) return;
    hayJugadores = true;

    const seccion = mk('div','card-lista-seccion');
    const lbl = mk('div','card-lista-lbl');
    lbl.textContent = label;
    lbl.style.color = color;
    lbl.style.borderLeftColor = color;
    seccion.appendChild(lbl);

    jugadores.forEach(nombre => {
      const row = mk('div','card-lista-row');
      row.textContent = nombre;
      seccion.appendChild(row);
    });

    wrap.appendChild(seccion);
  });

  if(!hayJugadores){
    const empty = mk('div','card-lista-empty');
    empty.textContent = 'Sin jugadores';
    wrap.appendChild(empty);
  }

  return wrap;
}

function capturarLista(eq, diaKey, zonas, eqData){
  if(typeof html2canvas === 'undefined'){ toast('❌ html2canvas no cargado'); return; }
  toast('Generando imagen…');
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const fecha = FECHAS[diaKey] || '';
  const W = 700;
  const HEADER_H = 70;
  const ROW_H = 30;
  const LABEL_H = 26;
  const PAD = 16;

  // Calcular altura total
  let totalH = HEADER_H + PAD;
  zonas.forEach(({key}) => {
    const jugs = eqData[key] || [];
    if(!jugs.length) return;
    totalH += LABEL_H + jugs.length * ROW_H + 8;
  });
  totalH += PAD;

  const DPR = Math.min(window.devicePixelRatio||2, 3);
  const cv = document.createElement('canvas');
  cv.width = W * DPR; cv.height = totalH * DPR;
  const ctx = cv.getContext('2d');
  ctx.scale(DPR, DPR);

  // Fondo blanco
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, totalH);

  // Header azul
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(0, 0, W, HEADER_H);
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.font = '600 13px Segoe UI, sans-serif';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(eq, PAD, 10);
  const partesFecha = fecha.split('/');
  const aaStr = new Date().getFullYear().toString().slice(2);
  const fechaFmt = partesFecha.length===2
    ? (diaKey + '  ' + partesFecha[0] + '/' + partesFecha[1] + '/' + aaStr)
    : diaKey;
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 28px Segoe UI, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(fechaFmt, PAD, HEADER_H/2 + 6);

  // Zonas
  let y = HEADER_H + PAD;
  zonas.forEach(({key, label, color}) => {
    const jugs = eqData[key] || [];
    if(!jugs.length) return;

    // Label con barra de color
    ctx.fillStyle = color;
    ctx.fillRect(PAD, y, 4, LABEL_H);
    ctx.fillStyle = color;
    ctx.font = '700 11px Segoe UI, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(label.toUpperCase(), PAD + 10, y + LABEL_H/2);
    y += LABEL_H;

    jugs.forEach((nombre, i) => {
      ctx.fillStyle = i%2===0 ? '#f8fafd' : '#ffffff';
      ctx.fillRect(PAD, y, W - PAD*2, ROW_H);
      // Borde
      ctx.strokeStyle = '#e8eef8';
      ctx.lineWidth = 1;
      ctx.strokeRect(PAD, y, W - PAD*2, ROW_H);
      ctx.fillStyle = '#1a1d23';
      ctx.font = '600 14px Segoe UI, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(nombre, PAD + 10, y + ROW_H/2);
      y += ROW_H;
    });
    y += 8;
  });

  _exportarImagen(cv, eq, diaKey, fecha, isIOS);
}

function renderCards(){
  const grid=document.getElementById('grid'); grid.innerHTML='';
  grid.className='cards-grid view-'+vistaActual;
  if(vistaActual==='semana'){
    renderFiltrosSemana();
    renderCardsSemana(grid);
    initDrag();
    requestAnimationFrame(() => {
      igualarZonasSemana(grid);
      sincronizarScrollBar(grid);
    });
    return;
  }
  if(eqF==='1ER EQUIPO'){
    grid.appendChild(buildCardPrimerEquipo());
  } else if(vistaActual==='2col' || vistaActual==='3col'){
    // Vista multi: mostrar equipos seleccionados (o todos si eqF=TODOS)
    const lista = eqF==='TODOS' ? EQUIPOS.filter(e=>eqsMultiSel.has(e)) : [eqF];
    lista.forEach(eq=>grid.appendChild(buildCard(eq)));
  } else {
    const lista=eqF==='TODOS'?EQUIPOS:[eqF];
    lista.forEach(eq=>grid.appendChild(buildCard(eq)));
  }
  initDrag();
  requestAnimationFrame(equalizarCards);
}

function sincronizarScrollBar(grid){
  const bar = document.getElementById('scroll-sync-bar');
  const inner = document.getElementById('scroll-sync-inner');
  if(!bar || !inner || !grid) return;
  // El ancho del inner debe igualar el scrollWidth del grid
  inner.style.width = grid.scrollWidth + 'px';
  // Sincronizar scroll en ambas direcciones, evitando bucle infinito
  let syncing = false;
  grid.onscroll = () => {
    if(syncing) return;
    syncing = true;
    bar.scrollLeft = grid.scrollLeft;
    syncing = false;
  };
  bar.onscroll = () => {
    if(syncing) return;
    syncing = true;
    grid.scrollLeft = bar.scrollLeft;
    syncing = false;
  };
}

function igualarZonasSemana(grid){
  const rows = grid.querySelectorAll('.semana-tr-eq');
  rows.forEach(tr => {
    const cells = tr.querySelectorAll('.semana-td-card');

    // Reset alturas previas
    cells.forEach(td => {
      const z = td.querySelector('.zona-disponibles');
      const c = td.querySelector('.cols-estado');
      const cw = td.querySelector('.campo-wrap');
      if(z) z.style.minHeight = '';
      if(c) c.style.minHeight = '';
      if(cw) cw.style.marginTop = '';
    });

    // Igualar inicio del campo: medir altura de todo lo que hay ENCIMA del campo
    // (card-hdr + partido-banner + tipo-partido-sel)
    let maxPreCampo = 0;
    cells.forEach(td => {
      const card = td.querySelector('.card');
      const cw = td.querySelector('.campo-wrap');
      if(!card || !cw) return;
      const cardTop = card.getBoundingClientRect().top;
      const cwTop = cw.getBoundingClientRect().top;
      const preCampo = cwTop - cardTop;
      maxPreCampo = Math.max(maxPreCampo, preCampo);
    });
    // Añadir margin-top al campo de los días que tienen menos elementos encima
    cells.forEach(td => {
      const card = td.querySelector('.card');
      const cw = td.querySelector('.campo-wrap');
      if(!card || !cw) return;
      const cardTop = card.getBoundingClientRect().top;
      const cwTop = cw.getBoundingClientRect().top;
      const preCampo = cwTop - cardTop;
      const diff = maxPreCampo - preCampo;
      if(diff > 2) cw.style.marginTop = diff + 'px';
    });

    // Igualar zona-disponibles
    let maxDisp = 0;
    cells.forEach(td => {
      const z = td.querySelector('.zona-disponibles');
      if(z) maxDisp = Math.max(maxDisp, z.scrollHeight);
    });
    if(maxDisp > 0){
      cells.forEach(td => {
        const z = td.querySelector('.zona-disponibles');
        if(z) z.style.minHeight = maxDisp + 'px';
      });
    }

    // Igualar cols-estado
    let maxCols = 0;
    cells.forEach(td => {
      const c = td.querySelector('.cols-estado');
      if(c) maxCols = Math.max(maxCols, c.scrollHeight);
    });
    if(maxCols > 0){
      cells.forEach(td => {
        const c = td.querySelector('.cols-estado');
        if(c) c.style.minHeight = maxCols + 'px';
      });
    }
  });
}

// Exponer al scope global las funciones/variables que otros archivos o el HTML necesitan
window.render = render;
window.renderDias = renderDias;
window.abrirCal = abrirCal;
window.cerrarCal = cerrarCal;
window.renderCal = renderCal;
window.resetCal = resetCal;
window.aplicarSemana = aplicarSemana;
window.renderEqs = renderEqs;
window.renderCopyBar = renderCopyBar;
window.toggleVistaListaGlobal = toggleVistaListaGlobal;
window.toggleVistaListaCard = toggleVistaListaCard;
window.esVistaLista = esVistaLista;
window.reordenarEnZona = reordenarEnZona;
window.renombrarJugadorGlobal = renombrarJugadorGlobal;
window.buildListaView = buildListaView;
window.capturarLista = capturarLista;
window.renderCards = renderCards;
window.sincronizarScrollBar = sincronizarScrollBar;
window.igualarZonasSemana = igualarZonasSemana;
window.EQ_LABEL = EQ_LABEL;
Object.defineProperty(window, '_calFecha', { get:()=>_calFecha, set:(v)=>{_calFecha=v;}, configurable:true });
Object.defineProperty(window, '_calLunesSel', { get:()=>_calLunesSel, set:(v)=>{_calLunesSel=v;}, configurable:true });
Object.defineProperty(window, '_calModoCopia', { get:()=>_calModoCopia, set:(v)=>{_calModoCopia=v;}, configurable:true });
})();
}
