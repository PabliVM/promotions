// ── campograma-temporadas.js — Gestión de temporadas y persistencia ──
// ══════════════════════════════════════════════════
// PERSISTENCIA — localStorage
// ══════════════════════════════════════════════════
// ── Helpers de timestamp ──
function fmtTS(d){
  const dd=String(d.getDate()).padStart(2,'0');
  const mo=String(d.getMonth()+1).padStart(2,'0');
  const yy=String(d.getFullYear()).slice(2);
  const hh=String(d.getHours()).padStart(2,'0');
  const mm=String(d.getMinutes()).padStart(2,'0');
  return dd+'/'+mo+'/'+yy+' '+hh+':'+mm;
}
function updateSaveTS(label){
  const el=document.getElementById('save-ts');
  if(el) el.textContent=label;
}
// Payload completo para guardar
// Timestamp del último guardado MANUAL
var _lastManualTS = null;
function buildPayload(manualSave=false){
  if(manualSave) _lastManualTS = new Date().toISOString();
  return {
    data,pos,plantillas,origen,colNames,extraZonas,promInfo,multiEq,fechas:FECHAS,notas:window._notasData||{},movimientos,
    historicoJugador,
    modoUYL, listaUYL, listaUYLExcl: window.listaUYLExcl||[], tipoPartido, tiposConfig, modoDescanso,
    modoPartido, primerEquipoJugadores, rivales: window.rivales||{},
    semanasGuardadas: _semanasGuardadas,
    ultimaSemanaKey: _semanaKeyActual,
    ts: _lastManualTS
    // 'porteros' NO va aquí a propósito: se guarda con fbTogglePortero (escritura atómica),
    // así nunca se pisa aunque otra persona esté guardando algo distinto a la vez.
  };
}
// Autoguardado silencioso — guarda datos, NO toca el timestamp
var _autoSaveTimer=null;
var _guardadoVersion = 0; // se incrementa en cada cambio local
window._hayGuardadoPendiente = false; // true desde que hay un cambio local hasta que se confirma en Firebase
function autoGuardar(){
  _guardadoVersion++;
  window._hayGuardadoPendiente = true;
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer=setTimeout(async ()=>{
    const miVersion = _guardadoVersion; // versión en el momento de EMPEZAR a guardar esto
    try{
      // ── FRENO DE EMERGENCIA (memoria local de esta pestaña) ──
      if(typeof hayQueFrenarGuardado === 'function' && hayQueFrenarGuardado()){
        if(_guardadoVersion === miVersion) window._hayGuardadoPendiente = false;
        if(!window._frenoYaAvisado){
          window._frenoYaAvisado = true;
          showAlert(
            '⚠️ Se han detectado MUCHOS MENOS jugadores de golpe en las plantillas. Esto puede indicar un fallo — el guardado automático se ha PARADO para no sobreescribir datos buenos. ¿Guardar de todas formas?',
            ()=>{
              window._frenoYaAvisado = false;
              fijarTotalJugadoresConocido(); // aceptar el nuevo estado como bueno
              autoGuardar(); // reintentar ya sin freno
            },
            'Guardar igualmente'
          );
        }
        return;
      }
      // ── FRENO DE EMERGENCIA (contra el SERVIDOR, no solo esta pestaña) ──
      // Cubre el caso de tener otra pestaña/dispositivo abierto con datos buenos: si el
      // servidor tiene bastantes MÁS jugadores que los que esta pestaña va a guardar,
      // parar y avisar en vez de pisarlos.
      const totalASalvar = EQUIPOS.reduce((acc,eq)=>acc+(plantillas[eq]||[]).length, 0);
      if(typeof window.fbContarJugadoresServidor === 'function' && totalASalvar >= 0){
        const chk = await window.fbContarJugadoresServidor();
        if(chk && chk.ok && chk.total > 5 && totalASalvar < chk.total * 0.5){
          if(_guardadoVersion === miVersion) window._hayGuardadoPendiente = false;
          if(!window._frenoYaAvisado){
            window._frenoYaAvisado = true;
            showAlert(
              '⚠️ El servidor tiene bastantes MÁS jugadores ('+chk.total+') que los que esta pestaña va a guardar ('+totalASalvar+'). Puede que tengas otra pestaña/dispositivo con datos más completos. El guardado se ha PARADO para no pisarlos. ¿Guardar de todas formas?',
              ()=>{
                window._frenoYaAvisado = false;
                fijarTotalJugadoresConocido();
                autoGuardar();
              },
              'Guardar igualmente'
            );
          }
          return;
        }
      }
      const payload=buildPayload(false);
      // localStorage desactivado — solo Firebase
      // Sync Firebase — siempre en sesión 'principal'
      if(window._fbReady){
        if(!_fbSesionActiva) _fbSesionActiva = 'principal';
        window.fbGuardarSesion(_fbSesionActiva, payload).then(res=>{
          if(res && res.ok) console.log('✓ Auto-sync Firebase:', _fbSesionActiva);
          else console.warn('Auto-sync Firebase error:', res && res.message);
          // Solo "sin pendientes" si NADA ha cambiado desde que empezamos a guardar esto
          if(_guardadoVersion === miVersion) window._hayGuardadoPendiente = false;
        });
      } else {
        if(_guardadoVersion === miVersion) window._hayGuardadoPendiente = false;
      }
    }catch(e){
      console.warn('autoGuardar error:', e);
      if(_guardadoVersion === miVersion) window._hayGuardadoPendiente = false;
    }
  },1500); // 1.5s debounce para no saturar Firestore
}
// Guardado manual — botón elegante arriba
var _fbSesionActiva = null; // nombre de la sesión Firebase activa
function guardarManual(){
  try{
    const payload=buildPayload(true);  // true → guarda timestamp ahora
    // localStorage desactivado
    // Si hay sesión Firebase activa, guardar también en la nube
    if(window._fbReady){
      if(!_fbSesionActiva) _fbSesionActiva = 'principal';
      window.fbGuardarSesion(_fbSesionActiva, payload).then(res=>{
        if(res && res.ok) console.log('✓ Guardado en Firebase:', _fbSesionActiva);
        else console.warn('Firebase sync error:', res && res.message);
      });
    }
    const btn=document.getElementById('save-btn');
    const ts =fmtTS(new Date(_lastManualTS));
    updateSaveTS('Guardado '+ts);
    // Feedback visual
    btn.classList.add('saving');
    setTimeout(()=>{ btn.classList.remove('saving'); },2000);
  }catch(err){
    toast('❌ Error al guardar: '+err.message);
  }
}
// Alias por si algún sitio llama guardarDia
function guardarDia(){ guardarManual(); }
// ══════════════════════════════════════════════════
// GESTIÓN DE TEMPORADAS
// ══════════════════════════════════════════════════
// Jerarquía de equipos para el ascenso automático
// Temporadas guardadas: { id, nombre, ts, payload }
var temporadas = [];
var temporadaActual = null;   // id de la temporada activa
function cargarTemporadas(){
  // localStorage desactivado — temporadas vienen de Firebase
  temporadas = [];
  temporadaActual = null;
}
function guardarTemporadas(){
  // localStorage desactivado
}
// Calcular nombre siguiente temporada: "2025-2026" → "2026-2027"
function siguienteNombreTemporada(actual){
  const m = actual.match(/(\d{4})[-–](\d{2,4})/);
  if(!m) return actual;
  const ini = parseInt(m[1]);
  return (ini+1)+'-'+(String(ini+2).slice(-2));
}
function actualizarBadgeTemporada(){
  const t = temporadas.find(t=>t.id===temporadaActual);
  const lbl = document.getElementById('season-label');
  if(lbl) lbl.textContent = t ? t.nombre : '2026-2027';
}
// ── Modal de selección ──
function abrirSeasonModal(){
  try{
  const list = document.getElementById('season-list');
  list.innerHTML = '';
  temporadas.forEach(t=>{
    const row = document.createElement('div');
    row.className = 'season-row' + (t.id===temporadaActual?' active':'');
    row.innerHTML = `
      <div>
        <div class="season-row-name">${t.nombre}</div>
        <div class="season-row-meta">${t.id===temporadaActual?'Activa':'Guardada'}</div>
      </div>
      ${t.id===temporadaActual?'<span class="season-row-badge">✓ ACTIVA</span>':''}
    `;
    if(t.id!==temporadaActual){
      row.onclick = ()=>cambiarATemporada(t.id);
      const delBtn = document.createElement('button');
      delBtn.textContent = '🗑';
      delBtn.title = 'Borrar temporada';
      delBtn.style.cssText = 'background:none;border:none;cursor:pointer;color:#ef4444;font-size:14px;padding:4px 8px;flex-shrink:0;';
      delBtn.onclick = (e)=>{ e.stopPropagation(); borrarTemporada(t.id); };
      row.appendChild(delBtn);
    }
    list.appendChild(row);
  });
  if(!temporadas.length){
    list.innerHTML = '<div style="padding:16px 20px;font-family:Segoe UI,sans-serif;font-size:12px;color:#9ca3af;">Sin temporadas guardadas aún</div>';
  }
  document.getElementById('season-modal').classList.add('open');
  }catch(e){
    console.error('abrirSeasonModal error:', e);
    alert('Error al abrir Temporada:\n\n'+(e&&e.message?e.message:String(e))+'\n\n'+(e&&e.stack?e.stack.slice(0,400):''));
  }
}
function borrarTemporada(id){
  const t = temporadas.find(x=>x.id===id);
  if(!t) return;
  if(id === temporadaActual){ toast('⚠️ No puedes borrar la temporada activa'); return; }
  showAlert('¿Borrar la temporada "'+t.nombre+'"? No se puede deshacer.', ()=>{
    temporadas = temporadas.filter(x=>x.id!==id);
    guardarTemporadas();
    abrirSeasonModal();
    toast('🗑️ Temporada "'+t.nombre+'" borrada');
  }, 'Borrar');
}
function cerrarSeasonModal(e){
  if(!e||e.target===document.getElementById('season-modal')||e.currentTarget===document.getElementById('season-box-close'))
    document.getElementById('season-modal').classList.remove('open');
}
// ── Cambiar a una temporada guardada ──
function cambiarATemporada(id){
  // Guardar estado actual si hay temporada activa
  if(temporadaActual){
    const idx = temporadas.findIndex(t=>t.id===temporadaActual);
    if(idx>=0) temporadas[idx].payload = buildPayload(false);
  }
  // Cargar la nueva
  const t = temporadas.find(t=>t.id===id);
  if(!t){ toast('❌ Temporada no encontrada'); return; }
  temporadaActual = id;
  // Restaurar datos
  const p = t.payload;
  if(p.data) data = p.data;
  if(p.pos)  pos  = p.pos;
  if(p.plantillas) plantillas = p.plantillas;
  if(p.origen) Object.assign(origen, p.origen);
  if(p.colNames) colNames = p.colNames;
  if(p.porteros) porteros = p.porteros;
  if(p.fechas) FECHAS = p.fechas;
  if(p.ts){ _lastManualTS=p.ts; updateSaveTS('Guardado '+fmtTS(new Date(p.ts))); }
  guardarTemporadas();
  actualizarBadgeTemporada();
  render();
  document.getElementById('season-modal').classList.remove('open');
  toast('✅ Temporada '+t.nombre+' cargada');
}
// ── Nueva temporada con ascenso ──
var _pendingAscenso = null;
function nuevaTemporada(){
  document.getElementById('season-modal').classList.remove('open');
  // Calcular nombre sugerido
  const actual = temporadas.find(t=>t.id===temporadaActual);
  const nombreActual = actual ? actual.nombre : '2026-2027';
  const nombreNuevo  = siguienteNombreTemporada(nombreActual);
  // Construir vista previa de ascenso
  const ascensoVista = JERARQUIA.map(eq=>{
    const sup = EQUIPO_SUPERIOR[eq];
    if(!sup) return null;
    // Contar jugadores de este equipo (disponibles + campo)
    const jugadores = new Set();
    DIAS.forEach(d=>{
      ZONAS.forEach(z=>{ (data[d][eq][z]||[]).forEach(n=>jugadores.add(n)); });
    });
    return { de: eq, a: sup, n: jugadores.size };
  }).filter(Boolean);
  _pendingAscenso = { nombreNuevo, nombreActual, ascensoVista };
  // Rellenar modal
  document.getElementById('ascenso-body').innerHTML =
    `Al crear la temporada <strong style="color:#fff">${nombreNuevo}</strong>, los jugadores de cada equipo pasarán al equipo superior como disponibles:`;
  const eqDiv = document.getElementById('ascenso-equipos');
  eqDiv.innerHTML = '';
  ascensoVista.forEach(({de, a, n})=>{
    const row = document.createElement('div');
    row.className = 'ascenso-equipo-row';
    row.innerHTML = `<span>${de}</span><span class="ascenso-arrow">→</span><span>${a}</span><span style="margin-left:auto;color:rgba(255,255,255,.4);font-size:10px;">${n} jugadores</span>`;
    eqDiv.appendChild(row);
  });
  document.getElementById('ascenso-modal').classList.add('open');
}
function cancelarAscenso(){
  _pendingAscenso = null;
  document.getElementById('ascenso-modal').classList.remove('open');
}
function confirmarAscenso(){
  if(!_pendingAscenso) return;
  const {nombreNuevo, nombreActual} = _pendingAscenso;
  // 1. Guardar temporada actual
  const payloadActual = buildPayload(false);
  if(temporadaActual){
    const idx = temporadas.findIndex(t=>t.id===temporadaActual);
    if(idx>=0) temporadas[idx].payload = payloadActual;
  } else {
    // Primera vez — guardar como temporada actual
    const id = nombreActual.replace(/[^a-zA-Z0-9]/g,'_');
    temporadas.push({ id, nombre: nombreActual, payload: payloadActual, ts: Date.now() });
    temporadaActual = id;
  }
  // 2. Construir nuevo estado: ascender jugadores
  // Reset data vacío
  const nuevaData = {};
  DIAS.forEach(d=>{
    nuevaData[d]={};
    EQUIPOS.forEach(eq=>{
      nuevaData[d][eq]={};
      ZONAS.forEach(z=>{ nuevaData[d][eq][z]=[]; });
    });
  });
  // Para cada equipo excepto CASTILLA, recoger todos sus jugadores y ponerlos
  // en disponibles del equipo superior en TODOS los días
  const nuevoOrigen = {};
  JERARQUIA.forEach(eq=>{
    const sup = EQUIPO_SUPERIOR[eq];
    // Recoger jugadores únicos de este equipo en todos los días/zonas
    const jugadores = new Set();
    DIAS.forEach(d=>{
      ZONAS.forEach(z=>{ (data[d][eq][z]||[]).forEach(n=>jugadores.add(n)); });
    });
    jugadores.forEach(n=>{ nuevoOrigen[n] = sup || eq; });
    if(sup){
      // Añadir a disponibles del equipo superior en todos los días
      DIAS.forEach(d=>{
        jugadores.forEach(n=>{
          if(!nuevaData[d][sup].disponibles.includes(n))
            nuevaData[d][sup].disponibles.push(n);
        });
      });
    }
  });
  // 3. Aplicar nueva temporada
  data     = nuevaData;
  pos      = {};
  plantillas = {};
  EQUIPOS.forEach(eq=>{ plantillas[eq]=[]; });
  // Poblar plantillas desde nuevoOrigen
  Object.entries(nuevoOrigen).forEach(([nombre, eq])=>{
    if(!plantillas[eq]) plantillas[eq]=[];
    if(!plantillas[eq].includes(nombre)) plantillas[eq].push(nombre);
  });
  Object.assign(origen, nuevoOrigen);
  _lastManualTS = null;
  updateSaveTS('');
  // 4. Guardar nueva temporada
  const newId = nombreNuevo.replace(/[^a-zA-Z0-9]/g,'_');
  temporadas.push({ id: newId, nombre: nombreNuevo, payload: buildPayload(false), ts: Date.now() });
  temporadaActual = newId;
  guardarTemporadas();
  actualizarBadgeTemporada();
  document.getElementById('ascenso-modal').classList.remove('open');
  _pendingAscenso = null;
  render();
  toast('⬆️ Temporada '+nombreNuevo+' creada');
}
// Inicializar temporadas al arrancar
cargarTemporadas();
if(!temporadaActual && temporadas.length===0){
  // Primera vez: crear temporada 2026-27 automáticamente
  temporadaActual = '2026_2027';
  temporadas = [{ id:'2026_2027', nombre:'2026-2027', payload:{}, ts:Date.now() }];
  guardarTemporadas();
}
actualizarBadgeTemporada();
function cargarGuardado(){
  try{
    const raw = null; // localStorage desactivado
    if(!raw) return false;
    let payload;
    try{ payload = JSON.parse(raw); } catch(pe){ console.error('[cargarGuardado] JSON parse error:', pe); return false; }
    if(!payload || typeof payload !== 'object') return false;
    if(payload.data       && typeof payload.data === 'object')       data        = payload.data;
    if(payload.pos        && typeof payload.pos  === 'object')       pos         = payload.pos;
    if(payload.plantillas && typeof payload.plantillas === 'object') plantillas  = payload.plantillas;
    if(payload.origen     && typeof payload.origen === 'object')     Object.assign(origen, payload.origen);
    if(payload.colNames   && typeof payload.colNames === 'object')   colNames    = payload.colNames;
    if(payload.porteros   && Array.isArray(payload.porteros))            porteros    = payload.porteros;
    if(payload.extraZonas && typeof payload.extraZonas === 'object') extraZonas  = payload.extraZonas;
    if(payload.fechas     && typeof payload.fechas === 'object')     FECHAS      = payload.fechas;
    if(payload.promInfo   && typeof payload.promInfo === 'object')   promInfo    = payload.promInfo;
    if(payload.tiposConfig  && typeof payload.tiposConfig === 'object')  tiposConfig  = payload.tiposConfig;
    if(payload.tipoPartido  && typeof payload.tipoPartido === 'object')  tipoPartido  = payload.tipoPartido;
    if(payload.modoPartido  && typeof payload.modoPartido === 'object')  modoPartido  = payload.modoPartido;
    if(payload.modoDescanso && typeof payload.modoDescanso === 'object') modoDescanso = payload.modoDescanso;
    if(payload.multiEq      && typeof payload.multiEq === 'object')      multiEq      = payload.multiEq;
    if(payload.modoUYL      && typeof payload.modoUYL === 'object')      modoUYL      = payload.modoUYL;
    if(payload.listaUYL     && Array.isArray(payload.listaUYL))          listaUYL     = payload.listaUYL;
    if(Array.isArray(payload.listaUYLExcl)) window.listaUYLExcl = payload.listaUYLExcl;
    if(payload.rivales      && typeof payload.rivales === 'object')      window.rivales = payload.rivales;
    if(Array.isArray(payload.primerEquipoJugadores)) primerEquipoJugadores = payload.primerEquipoJugadores;
    // Asegurar estructura promInfo para todos los días/equipos
    DIAS.forEach(d=>{ if(!promInfo[d]) promInfo[d]={}; EQUIPOS.forEach(eq=>{ if(!promInfo[d][eq]) promInfo[d][eq]={}; }); });
    // Asegurar que todos los equipos tienen sus colNames
    EQUIPOS.forEach(eq=>{
      if(!colNames[eq]) colNames[eq]=['PROMOCIONADOS','LESIONADOS','OTROS'];
      if(colNames[eq][0]==='1ER EQUIPO') colNames[eq][0]='PROMOCIONADOS'; // normalizar datos viejos
      if(colNames[eq][0]==='PROMOCIÓN') colNames[eq][0]='PROMOCIONADOS';
      if(colNames[eq][1]==='LESIÓN')    colNames[eq][1]='LESIONADOS';
    });
    // Asegurar zonas banquillo
    for(const d of DIAS) for(const e of EQUIPOS){
      if(!data[d])    data[d]={};
      if(!data[d][e]) data[d][e]={};
      for(const z of ZONAS) if(!data[d][e][z]) data[d][e][z]=[];
    }
    // Sincronizar plantillas → disponibles:
    // Si un jugador está en plantillas pero no en ninguna zona de ese equipo ese día, añadirlo a disponibles
    EQUIPOS.forEach(eq=>{
      (plantillas[eq]||[]).forEach(nombre=>{
        DIAS.forEach(d=>{
          const enAlgunaZona = ZONAS.some(z=>(data[d][eq][z]||[]).includes(nombre));
          if(!enAlgunaZona && !data[d][eq].disponibles.includes(nombre)){
            data[d][eq].disponibles.push(nombre);
          }
        });
      });
    });
    // Restaurar el timestamp del último guardado manual
    if(payload.ts){
      _lastManualTS = payload.ts;
      updateSaveTS('Guardado '+fmtTS(new Date(payload.ts)));
    }
    return true;
  }catch(e){
    console.error('[cargarGuardado] ERROR:', e);
    toast('⚠️ Error al cargar datos: ' + (e.message || e));
    return false;
  }
}
