// ── campograma-copiar.js — Copiar campograma entre días/semanas ──
var _copyTipo = 'dia'; // 'dia' | 'semana'
var _copyDiasDest = new Set();
var _copyDiaSemanaLunes = null; // semana destino para modo día (null = semana actual)
var _copyOrigenSemanaLunes = null; // semana origen (null = semana actual — la que se ve ahora)
var _copyEqs = new Set(EQUIPOS);
var _copyDiaOrigen = null; // día origen seleccionado
var _copyModo = 'todo'; // 'todo' | 'campo' | 'inferiores' — qué se copia de cada jugador
function abrirCopiarModal(){
  // Reset
  _copyTipo='dia';
  _copyDiasDest=new Set();
  _copyEqs=new Set(EQUIPOS);
  _copySemanaDestLunes=null;
  _copyDiaSemanaLunes=null;
  _copyOrigenSemanaLunes=null;
  _copyDiaOrigen = dia; // por defecto el día activo
  _copyModo = 'todo';
  // Equipos
  const checksEl=document.getElementById('copy-eq-checks');
  checksEl.innerHTML='';
  EQUIPOS.forEach(eq=>{
    const lbl=mk('label','copy-eq-chk sel');
    lbl.innerHTML=`<input type="checkbox" checked onchange="toggleCopyEq('${eq}',this.checked)"><span>${eq}</span>`;
    checksEl.appendChild(lbl);
  });
  // Qué copiar (modo)
  renderCopyModoBtns();
  // Día ORIGEN (semana actual por defecto)
  actualizarLblOrigenSemana();
  renderCopyOrigenBtns();
  // Días destino
  renderCopyDias();
  document.getElementById('ctype-dia').classList.add('active');
  document.getElementById('ctype-semana').classList.remove('active');
  const _cdsel = document.getElementById('copy-dia-sel');
  if(_cdsel) _cdsel.style.display='block';
  document.getElementById('copy-modal-overlay').classList.add('open');
}
function cerrarCopiarModal(){
  document.getElementById('copy-modal-overlay').classList.remove('open');
}
// Botones "Todo el equipo / Solo el campo / Solo cuadros inferiores"
function renderCopyModoBtns(){
  const cont = document.getElementById('copy-modo-btns');
  if(!cont) return;
  cont.innerHTML = '';
  const opciones = [
    {v:'todo', l:'Todo el equipo'},
    {v:'campo', l:'Solo el campo'},
    {v:'inferiores', l:'Solo cuadros inferiores'},
  ];
  opciones.forEach(({v,l})=>{
    const btn = mk('button','copy-dia-btn'+(v===_copyModo?' sel':''));
    btn.textContent = l;
    btn.style.cssText = 'flex:1;';
    btn.onclick = ()=>{
      _copyModo = v;
      cont.querySelectorAll('.copy-dia-btn').forEach(b=>b.classList.remove('sel'));
      btn.classList.add('sel');
    };
    cont.appendChild(btn);
  });
}
// Botones de día ORIGEN — usa la semana actual, salvo que se haya elegido otra semana
// (_copyOrigenSemanaLunes) con "📅 Otra semana", en cuyo caso muestra los días de ESA
// semana (con sus fechas reales) para elegir uno concreto.
function renderCopyOrigenBtns(){
  const origenEl = document.getElementById('copy-origen-btns');
  if(!origenEl) return;
  const fechasRef = _copyOrigenSemanaLunes ? calcFechasSemanaSoloLectura(_copyOrigenSemanaLunes) : FECHAS;
  origenEl.innerHTML='';
  DIAS.forEach(d=>{
    const btn=mk('button','copy-dia-btn'+(d===_copyDiaOrigen?' sel':''));
    btn.textContent=d.slice(0,3)+' '+(fechasRef[d]||'');
    btn.title=d;
    btn.onclick=()=>{
      _copyDiaOrigen=d;
      origenEl.querySelectorAll('.copy-dia-btn').forEach(b=>b.classList.remove('sel'));
      btn.classList.add('sel');
    };
    origenEl.appendChild(btn);
  });
}
function actualizarLblOrigenSemana(){
  const lbl = document.getElementById('copy-origen-semana-lbl');
  if(!lbl) return;
  if(!_copyOrigenSemanaLunes){
    lbl.style.display = 'none';
  } else {
    const fechas = calcFechasSemanaSoloLectura(_copyOrigenSemanaLunes);
    lbl.textContent = 'Origen: semana del ' + fechas['LUNES'] + ' al ' + fechas['DOMINGO'];
    lbl.style.display = 'block';
  }
}
// Lunes de la semana destino para la copia semana completa
var _copySemanaDestLunes = null;
function setCopyTipo(t){
  _copyTipo=t;
  document.getElementById('ctype-dia').classList.toggle('active',t==='dia');
  document.getElementById('ctype-semana').classList.toggle('active',t==='semana');
  document.getElementById('copy-dia-sel').style.display=t==='dia'?'block':'none';
  document.getElementById('copy-semana-sel').style.display=t==='semana'?'block':'none';
  if(t==='semana') actualizarLblSemana();
}
function actualizarLblSemana(){
  const btn = document.getElementById('copy-semana-btn');
  const lbl = document.getElementById('copy-semana-lbl');
  if(!_copySemanaDestLunes){
    lbl.textContent = 'Seleccionar semana destino…';
    btn.classList.remove('has-sel');
  } else {
    const fechas = calcFechasSemanaSoloLectura(_copySemanaDestLunes);
    lbl.textContent = 'Semana del ' + fechas['LUNES'] + ' al ' + fechas['DOMINGO'];
    btn.classList.add('has-sel');
  }
}
// Abrir calendario en modo copia de semana (destino, semana completa)
// Lunes de la semana a la que pertenece una fecha cualquiera — para tener siempre un
// día preseleccionado por defecto al abrir el calendario (si no, si el usuario no
// clica activamente un día, _calLunesSel se quedaba en null y "confirmar" no hacía
// nada, sin ningún aviso de que faltaba elegir).
function _lunesDeSemana(fecha){
  const d = new Date(fecha);
  const dow = d.getDay();
  const diff = dow===0 ? -6 : 1-dow;
  d.setDate(d.getDate()+diff);
  d.setHours(0,0,0,0);
  return d;
}
// Selector de fecha propio del modal de Copiar — completamente independiente del
// calendario compartido de la app (el que usa "Semana" en la cabecera). No toca
// _calModoCopia/_calLunesSel/aplicarSemana para nada, así no puede interferir con la
// semana que tienes abierta ni sufrir efectos raros de estado compartido entre
// archivos. Usa el selector de fecha nativo del navegador.
function elegirFechaOtraSemana(valorActual, onElegir){
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10600;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px;';
  const box = document.createElement('div');
  box.style.cssText = 'background:#fff;border-radius:14px;padding:20px;max-width:320px;width:100%;font-family:\'Segoe UI\',sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.3);';
  const lbl = document.createElement('div');
  lbl.textContent = 'Elige cualquier día de la semana que quieras (se usa toda esa semana)';
  lbl.style.cssText = 'font-size:13px;color:#5a6170;margin-bottom:10px;line-height:1.4;';
  box.appendChild(lbl);
  const inp = document.createElement('input');
  inp.type = 'date';
  if(valorActual){
    const d = new Date(valorActual);
    inp.value = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  inp.style.cssText = 'width:100%;padding:10px;border-radius:8px;border:1.5px solid #dfe1e6;font-size:14px;margin-bottom:14px;box-sizing:border-box;';
  box.appendChild(inp);
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:8px;';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.style.cssText = 'flex:1;padding:10px;border-radius:8px;border:1px solid #dfe1e6;background:transparent;color:#5a6170;font-weight:700;cursor:pointer;font-family:\'Segoe UI\',sans-serif;';
  const okBtn = document.createElement('button');
  okBtn.textContent = 'Elegir';
  okBtn.style.cssText = 'flex:1;padding:10px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-weight:700;cursor:pointer;font-family:\'Segoe UI\',sans-serif;';
  btnRow.appendChild(cancelBtn); btnRow.appendChild(okBtn);
  box.appendChild(btnRow);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  inp.focus();
  function cerrar(){ overlay.remove(); }
  cancelBtn.onclick = cerrar;
  overlay.onclick = (e)=>{ if(e.target===overlay) cerrar(); };
  okBtn.onclick = ()=>{
    if(!inp.value){ cerrar(); return; }
    const [y,m,d] = inp.value.split('-').map(Number);
    const fecha = new Date(y, m-1, d);
    cerrar();
    onElegir(fecha);
  };
}
function abrirCalCopia(){
  elegirFechaOtraSemana(_copySemanaDestLunes, (fecha)=>{
    _copySemanaDestLunes = _lunesDeSemana(fecha);
    actualizarLblSemana();
  });
}
// Abrir selector en modo copia de día (destino, día concreto de otra semana)
function abrirCalCopiaDir(){
  elegirFechaOtraSemana(_copyDiaSemanaLunes, (fecha)=>{
    _copyDiaSemanaLunes = _lunesDeSemana(fecha);
    const fechas = calcFechasSemanaSoloLectura(_copyDiaSemanaLunes);
    const lbl = document.getElementById('copy-dia-semana-lbl');
    lbl.textContent = 'Semana del ' + fechas['LUNES'] + ' al ' + fechas['DOMINGO'];
    lbl.style.display = 'block';
    renderCopyDias();
  });
}
// Abrir selector en modo ORIGEN — elegir de qué semana pasada/futura viene el día a copiar
function abrirCalCopiaOrigen(){
  elegirFechaOtraSemana(_copyOrigenSemanaLunes, (fecha)=>{
    _copyOrigenSemanaLunes = _lunesDeSemana(fecha);
    _copyDiaOrigen = null; // hay que elegir de nuevo un día concreto de la nueva semana
    actualizarLblOrigenSemana();
    renderCopyOrigenBtns();
  });
}
function toggleCopyEq(eq,checked){
  if(checked) _copyEqs.add(eq); else _copyEqs.delete(eq);
  document.querySelectorAll('.copy-eq-chk').forEach((el,i)=>{
    el.classList.toggle('sel',_copyEqs.has(EQUIPOS[i]));
  });
}
function renderCopyDias(){
  const cont=document.getElementById('copy-dias-btns');
  cont.innerHTML='';
  _copyDiasDest = new Set(); // reset selección al cambiar semana
  const fechasRef = _copyDiaSemanaLunes ? calcFechasSemanaSoloLectura(_copyDiaSemanaLunes) : FECHAS;
  DIAS.forEach(d=>{
    const btn=mk('button','copy-dia-btn');
    btn.textContent=d.slice(0,3)+' '+(fechasRef[d]||'');
    btn.onclick=()=>{
      if(_copyDiasDest.has(d)){_copyDiasDest.delete(d);btn.classList.remove('sel');}
      else{_copyDiasDest.add(d);btn.classList.add('sel');}
    };
    cont.appendChild(btn);
  });
}
// Lee (sin tocar la sesión activa) la foto de una semana guardada — de caché en memoria
// si ya se visitó esta sesión, o pidiéndola a Firebase si no. A diferencia de
// cargarFotoSemana() (en campograma-core-new.js), esta NO sustituye 'data'/'pos'/
// 'promInfo' en vivo — solo los devuelve para leer de ahí, sin tocar lo que se ve ahora.
async function obtenerFotoSemanaSoloLectura(lunesKey){
  if(_semanasGuardadas[lunesKey]) return _semanasGuardadas[lunesKey];
  if(typeof window.fbCargarSemanaArchivada === 'function'){
    const res = await window.fbCargarSemanaArchivada(lunesKey);
    if(res && res.ok && res.data){
      _semanasGuardadas[lunesKey] = res.data; // cachear para no volver a pedirla
      return res.data;
    }
  }
  return null;
}
// Igual que obtenerFotoSemanaSoloLectura, pero si esa semana no existe todavía en
// ningún sitio, crea una estructura nueva vacía (con las plantillas actuales en
// Disponibles) — sin tocar la sesión en vivo. Se usa para poder copiar A una semana
// destino distinta a la activa aunque esa semana nunca se haya abierto antes.
async function obtenerOCrearFotoSemana(lunesKey){
  const existente = await obtenerFotoSemanaSoloLectura(lunesKey);
  const foto = existente || {
    data: JSON.parse(JSON.stringify(RAW)), pos: {}, promInfo: {}, multiEq: {}, modoPartido: {}, modoDescanso: {},
    tipoPartido: {}, primerEquipoJugadores: {}, notas: {}, origen: JSON.parse(JSON.stringify(origen)),
    historicoJugador: {}
  };
  // Blindaje: asegurar TODOS los días/equipos/zonas, tanto si la semana es nueva como
  // si ya existía guardada (por si quedó incompleta de antes por cualquier motivo) —
  // evita crashes más adelante al pintar esa semana.
  for(const d of DIAS) for(const e of EQUIPOS){
    if(!foto.data[d])    foto.data[d]={};
    if(!foto.data[d][e]) foto.data[d][e]={};
    for(const z of ZONAS) if(!foto.data[d][e][z]) foto.data[d][e][z]=[];
  }
  if(!existente){
    EQUIPOS.forEach(eq=>{
      (plantillas[eq]||[]).forEach(nombre=>{
        DIAS.forEach(d=>{
          if(!foto.data[d][eq].disponibles.includes(nombre)) foto.data[d][eq].disponibles.push(nombre);
        });
      });
    });
  }
  return foto;
}
// Copia un equipo de un día concreto (de la semana ORIGEN indicada) a un día concreto
// (de la semana DESTINO indicada — por defecto la semana activa en vivo, pero puede
// ser cualquier otra pasando datosDestinoSemana/posDestinoSemana/promInfoDestinoSemana).
// Respeta el modo elegido (todo/campo/inferiores) y, si el jugador copiado está
// promocionado a otro equipo, copia también esa promoción (promInfo) y lo añade a
// Disponibles del equipo destino de la promoción — igual que hace el sistema normal
// al promocionar, para que no aparezca como "huérfano"/doblado.
function copyUnEquipo(datosOrigenSemana, posOrigenSemana, promInfoOrigenSemana, fromDia, toDia, eq, modo, datosDestinoSemana, posDestinoSemana, promInfoDestinoSemana){
  // Por defecto, el destino es la sesión EN VIVO (comportamiento de siempre)
  const dDestino = datosDestinoSemana || data;
  const pDestino = posDestinoSemana || pos;
  const piDestino = promInfoDestinoSemana || promInfo;
  const origenData = datosOrigenSemana?.[fromDia]?.[eq];
  if(!origenData) return;
  if(!dDestino[toDia]) dDestino[toDia] = {};
  if(!dDestino[toDia][eq]) dDestino[toDia][eq] = {};
  const destino = dDestino[toDia][eq];

  if(modo === 'todo'){
    ZONAS.forEach(z=>{ destino[z] = JSON.parse(JSON.stringify(origenData[z]||[])); });
  } else if(modo === 'campo'){
    destino.campo = JSON.parse(JSON.stringify(origenData.campo||[]));
  } else if(modo === 'inferiores'){
    ['lesionados','otros','promovidos_1er','extra'].forEach(z=>{
      destino[z] = JSON.parse(JSON.stringify(origenData[z]||[]));
    });
    // Evitar que un jugador quede duplicado dentro del MISMO equipo (en Disponibles Y
    // en un cuadro inferior a la vez)
    if(!destino.disponibles) destino.disponibles = [];
    const copiados = new Set(['lesionados','otros','promovidos_1er','extra'].flatMap(z=>origenData[z]||[]));
    destino.disponibles = destino.disponibles.filter(n=>!copiados.has(n));
  }

  // Posiciones de campo (si se copió el campo) — se usa la clave robusta (fecha real,
  // no solo nombre de día) tanto para leer el origen como para escribir el destino,
  // igual que hace savePos()/getPos() en el resto de la app. La fecha del ORIGEN se
  // calcula sobre la semana de origen real (que puede ser otra semana distinta a la
  // actual, si se copió con "📅 Otra semana"), y la del DESTINO sobre la semana a la
  // que se está copiando de verdad (puede ser distinta a la activa también).
  if(modo === 'todo' || modo === 'campo'){
    const fechaOrigen = fechaCompletaDeDia(fromDia, _copyOrigenSemanaLunes);
    const fechaDestino = fechaCompletaDeDia(toDia, _copyDestinoSemanaLunesActual);
    (origenData.campo||[]).forEach(n=>{
      const kOrigenNuevo = (fechaOrigen||fromDia)+'|'+eq+'|'+n;
      const kOrigenViejo = fromDia+'|'+eq+'|'+n; // compatibilidad con datos ya guardados
      const p = posOrigenSemana?.[kOrigenNuevo] || posOrigenSemana?.[kOrigenViejo];
      if(p) pDestino[(fechaDestino||toDia)+'|'+eq+'|'+n] = [...p];
    });
  }

  // Reconstruir promociones a partir de quién es cada jugador de verdad — si entre lo
  // copiado (campo, lesionados, otros...) hay algún jugador que NO es de este equipo
  // (origen[nombre] apunta a otro), es que viene prestado/promocionado: se marca esa
  // promoción en su equipo REAL para el día destino (si no estaba ya) y se le quita de
  // Disponibles ahí, para que no quede como "doblado"/huérfano en su equipo real.
  // Antes esto solo miraba el campo — un jugador ajeno en lesionados/otros se quedaba
  // sin marcar, y por eso reaparecía en Disponibles de su equipo real por error.
  {
    const zonasCopiadas = modo === 'todo' ? ZONAS
                        : modo === 'campo' ? ['campo']
                        : ['lesionados','otros','promovidos_1er','extra']; // 'inferiores'
    const jugadoresAjenos = new Set();
    zonasCopiadas.forEach(z=>{ (destino[z]||[]).forEach(n=>jugadoresAjenos.add(n)); });
    jugadoresAjenos.forEach(n=>{
      const eqReal = origen[n];
      if(!eqReal || eqReal === eq || eqReal === 'PRUEBA') return; // es de este equipo, o a prueba
      if(!dDestino[toDia][eqReal]) dDestino[toDia][eqReal] = {};
      ZONAS.forEach(z=>{ if(!dDestino[toDia][eqReal][z]) dDestino[toDia][eqReal][z] = []; });
      // En Castilla, según el destino, la promoción va a "Promoción 1er Eq." o a
      // "Otro equipo" (zona extra) — mismo criterio que usa el resto de la app.
      const zonaOrigenDestino = (typeof _zonaPromoParaDestino === 'function') ? _zonaPromoParaDestino(eqReal, eq) : 'promovidos_1er';
      if(!dDestino[toDia][eqReal][zonaOrigenDestino].includes(n)){
        dDestino[toDia][eqReal][zonaOrigenDestino].push(n);
      }
      if(!piDestino[toDia]) piDestino[toDia] = {};
      if(!piDestino[toDia][eqReal]) piDestino[toDia][eqReal] = {};
      const yaTiene = piDestino[toDia][eqReal][n];
      const yaTieneArr = yaTiene ? (Array.isArray(yaTiene) ? yaTiene : [yaTiene]) : [];
      if(!yaTieneArr.includes(eq)){
        const nuevaLista = [...yaTieneArr, eq];
        piDestino[toDia][eqReal][n] = nuevaLista.length===1 ? nuevaLista[0] : nuevaLista;
      }
      // Quitar de Disponibles/Banquillo de su equipo real ese día, para no duplicar
      ['disponibles','banquillo'].forEach(z=>{
        const arr = dDestino[toDia][eqReal][z];
        const i = arr.indexOf(n);
        if(i>=0) arr.splice(i,1);
      });
    });
  }

  // Promociones (promInfo) — solo si se copió la columna de promoción
  if(modo === 'todo' || modo === 'inferiores'){
    const infoOrigen = promInfoOrigenSemana?.[fromDia]?.[eq] || {};
    if(Object.keys(infoOrigen).length){
      if(!piDestino[toDia]) piDestino[toDia] = {};
      if(!piDestino[toDia][eq]) piDestino[toDia][eq] = {};
      Object.keys(infoOrigen).forEach(nombre=>{
        piDestino[toDia][eq][nombre] = infoOrigen[nombre];
        const destinos = Array.isArray(infoOrigen[nombre]) ? infoOrigen[nombre] : [infoOrigen[nombre]];
        destinos.forEach(destEq=>{
          if(destEq === '1ER EQUIPO') return; // no tiene 'disponibles' normal
          if(!dDestino[toDia][destEq]) return;
          if(!dDestino[toDia][destEq].disponibles) dDestino[toDia][destEq].disponibles = [];
          if(!dDestino[toDia][destEq].disponibles.includes(nombre)){
            dDestino[toDia][destEq].disponibles.push(nombre);
          }
        });
      });
    }
  }
}
function copyDiaBase(datosOrigenSemana, posOrigenSemana, promInfoOrigenSemana, from, to, eqs, modo, datosDestinoSemana, posDestinoSemana, promInfoDestinoSemana){
  eqs.forEach(eq=>copyUnEquipo(datosOrigenSemana, posOrigenSemana, promInfoOrigenSemana, from, to, eq, modo, datosDestinoSemana, posDestinoSemana, promInfoDestinoSemana));
}
// Semana destino de la que se están calculando fechas ahora mismo en copyUnEquipo —
// null cuando el destino es la semana activa en vivo. Se fija justo antes de copiar.
var _copyDestinoSemanaLunesActual = null;
async function ejecutarCopia(){
  const eqs=[..._copyEqs];
  if(!eqs.length){toast('Selecciona al menos un equipo');return;}
  if(!_copyDiaOrigen){toast('⚠️ Selecciona un día origen');return;}

  // Determinar de dónde se LEE el origen: la semana en vivo (la que se ve ahora) o
  // una semana distinta pedida por calendario (se lee, nunca se sustituye la actual).
  let datosOrigenSemana = data, posOrigenSemana = pos, promInfoOrigenSemana = promInfo;
  if(_copyOrigenSemanaLunes){
    const lunesKey = _copyOrigenSemanaLunes.getFullYear()+'-'+String(_copyOrigenSemanaLunes.getMonth()+1).padStart(2,'0')+'-'+String(_copyOrigenSemanaLunes.getDate()).padStart(2,'0');
    toast('📅 Cargando semana origen…');
    const foto = await obtenerFotoSemanaSoloLectura(lunesKey);
    if(!foto){ toast('❌ No se pudo cargar esa semana'); return; }
    datosOrigenSemana = foto.data; posOrigenSemana = foto.pos; promInfoOrigenSemana = foto.promInfo;
  }

  if(_copyTipo==='semana'){
    if(!_copySemanaDestLunes){ toast('⚠️ Selecciona una semana destino'); return; }
    const fechasDest = calcFechasSemanaSoloLectura(_copySemanaDestLunes);
    const lunesDestKey = _copySemanaDestLunes.getFullYear()+'-'+String(_copySemanaDestLunes.getMonth()+1).padStart(2,'0')+'-'+String(_copySemanaDestLunes.getDate()).padStart(2,'0');
    const esMismaSemana = fechasDest['LUNES'] === FECHAS['LUNES'];
    if(esMismaSemana){ toast('⚠️ La semana destino es la misma que la actual'); return; }
    toast('📅 Preparando semana destino…');
    const fotoDest = await obtenerOCrearFotoSemana(lunesDestKey);
    _copyDestinoSemanaLunesActual = _copySemanaDestLunes;
    DIAS.forEach((d)=>{
      copyDiaBase(datosOrigenSemana, posOrigenSemana, promInfoOrigenSemana, _copyDiaOrigen, d, eqs, _copyModo, fotoDest.data, fotoDest.pos, fotoDest.promInfo);
    });
    _copyDestinoSemanaLunesActual = null;
    await guardarFotoSemanaEnFirebase(lunesDestKey, fotoDest);
    toast('Copiado a semana ' + fechasDest['LUNES'] + ' – ' + fechasDest['DOMINGO']);
  } else {
    if(!_copyDiasDest.size){toast('Selecciona al menos un día');return;}
    if(_copyDiaSemanaLunes){
      const fechasDest = calcFechasSemanaSoloLectura(_copyDiaSemanaLunes);
      const lunesDestKey = _copyDiaSemanaLunes.getFullYear()+'-'+String(_copyDiaSemanaLunes.getMonth()+1).padStart(2,'0')+'-'+String(_copyDiaSemanaLunes.getDate()).padStart(2,'0');
      const esMismaSemana = fechasDest['LUNES'] === FECHAS['LUNES'];
      if(esMismaSemana){
        _copyDiasDest.forEach(d=>copyDiaBase(datosOrigenSemana, posOrigenSemana, promInfoOrigenSemana, _copyDiaOrigen, d, eqs, _copyModo));
      } else {
        // Copiar a una semana DISTINTA a la actual: se lee/crea esa semana, se copia
        // en su propia estructura (sin tocar la sesión en vivo), y se guarda
        // directamente en su documento de Firebase.
        toast('📅 Preparando semana destino…');
        const fotoDest = await obtenerOCrearFotoSemana(lunesDestKey);
        _copyDestinoSemanaLunesActual = _copyDiaSemanaLunes;
        _copyDiasDest.forEach(d=>copyDiaBase(datosOrigenSemana, posOrigenSemana, promInfoOrigenSemana, _copyDiaOrigen, d, eqs, _copyModo, fotoDest.data, fotoDest.pos, fotoDest.promInfo));
        _copyDestinoSemanaLunesActual = null;
        await guardarFotoSemanaEnFirebase(lunesDestKey, fotoDest);
      }
    } else {
      _copyDiasDest.forEach(d=>copyDiaBase(datosOrigenSemana, posOrigenSemana, promInfoOrigenSemana, _copyDiaOrigen, d, eqs, _copyModo));
    }
    toast('Copiado a '+ [..._copyDiasDest].map(d=>d.slice(0,3)).join(', '));
  }
  autoGuardar(); renderDias(); renderCards();
  cerrarCopiarModal();
}
// Guarda una foto de semana (posiblemente distinta a la activa) directamente en su
// documento de Firebase, y actualiza también la caché local para que si se navega
// ahí con el calendario en esta misma sesión, se vea ya actualizada sin re-pedirla.
async function guardarFotoSemanaEnFirebase(lunesKey, foto){
  _semanasGuardadas[lunesKey] = foto;
  if(typeof window.fbGuardarSemanaArchivada === 'function'){
    const res = await window.fbGuardarSemanaArchivada(lunesKey, foto);
    if(!res || !res.ok){
      toast('❌ Error al guardar en Firebase: '+(res && res.message || ''));
      return;
    }
  }
  // Si esta semana estaba marcada como pendiente de archivar por otro motivo, ya no
  // hace falta — se acaba de guardar ahora mismo directamente.
  if(window._semanasSucias) window._semanasSucias.delete(lunesKey);
}
// Alias para compatibilidad
function copyDia(from,to){
  copyDiaBase(data, pos, promInfo, from, to, EQUIPOS, 'todo');
  toast('Copiado '+from+' → '+to);
  autoGuardar(); renderDias(); renderCards();
}
// ══════════════════════════════════════════════════
// RIVAL Y CALENDARIO DE PARTIDOS
// ══════════════════════════════════════════════════
function guardarRival(eq, valor, diaParam){
  const d = diaParam || dia;
  if(!rivales[d]) rivales[d]={};
  rivales[d][eq] = valor;
  autoGuardar();
}
function sugerirRival(eq){
  const cal = calendarioPartidos[eq];
  if(!cal || !cal.length) return '';
  // Fecha actual de la semana para ese día
  const fechaStr = FECHAS[dia]; // 'DD/M'
  if(!fechaStr) return '';
  const [d,m] = fechaStr.split('/').map(Number);
  const anyo = new Date().getFullYear();
  const fechaActual = new Date(anyo,m-1,d);
  // Buscar partido más cercano
  let mejor=null, minDiff=Infinity;
  cal.forEach(p=>{
    const fp=new Date(p.fecha);
    const diff=Math.abs(fp-fechaActual);
    if(diff<minDiff){minDiff=diff;mejor=p;}
  });
  if(mejor && minDiff < 4*24*3600*1000) return mejor.rival; // dentro de 4 días
  return '';
}
// ══════════════════════════════════════════════════
// MODAL REGISTRO DE ENTRENAMIENTO
// ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════
// STATS — Vista por jugador y por equipo
// ══════════════════════════════════════════════════
