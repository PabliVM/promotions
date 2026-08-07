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
  const fechasRef = _copyOrigenSemanaLunes ? calcFechasSemana(_copyOrigenSemanaLunes) : FECHAS;
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
    const fechas = calcFechasSemana(_copyOrigenSemanaLunes);
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
    const fechas = calcFechasSemana(_copySemanaDestLunes);
    lbl.textContent = 'Semana del ' + fechas['LUNES'] + ' al ' + fechas['DOMINGO'];
    btn.classList.add('has-sel');
  }
}
// Abrir calendario en modo copia de semana (destino, semana completa)
function abrirCalCopia(){
  _calModoCopia = 'semana';
  _calLunesSel = _copySemanaDestLunes ? new Date(_copySemanaDestLunes) : null;
  _calFecha = _copySemanaDestLunes ? new Date(_copySemanaDestLunes) : new Date();
  renderCal();
  document.getElementById('cal-overlay').classList.add('open');
}
// Abrir calendario en modo copia de día (destino, día concreto de otra semana)
function abrirCalCopiaDir(){
  _calModoCopia = 'dia';
  _calLunesSel = _copyDiaSemanaLunes ? new Date(_copyDiaSemanaLunes) : null;
  _calFecha = _copyDiaSemanaLunes ? new Date(_copyDiaSemanaLunes) : new Date();
  renderCal();
  document.getElementById('cal-overlay').classList.add('open');
}
// Abrir calendario en modo ORIGEN — elegir de qué semana pasada/futura viene el día a copiar
function abrirCalCopiaOrigen(){
  _calModoCopia = 'origen';
  _calLunesSel = _copyOrigenSemanaLunes ? new Date(_copyOrigenSemanaLunes) : null;
  _calFecha = _copyOrigenSemanaLunes ? new Date(_copyOrigenSemanaLunes) : new Date();
  renderCal();
  document.getElementById('cal-overlay').classList.add('open');
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
  const fechasRef = _copyDiaSemanaLunes ? calcFechasSemana(_copyDiaSemanaLunes) : FECHAS;
  const esMismoLunes = !_copyDiaSemanaLunes || calcFechasSemana(_copyDiaSemanaLunes)['LUNES'] === FECHAS['LUNES'];
  DIAS.forEach(d=>{
    // Excluir el día actual solo si es la misma semana
    if(esMismoLunes && d===dia) return;
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
// Copia un equipo de un día concreto (de la semana ORIGEN indicada) a un día concreto
// (de la semana actual, que es donde vive 'data' en vivo). Respeta el modo elegido
// (todo/campo/inferiores) y, si el jugador copiado está promocionado a otro equipo,
// copia también esa promoción (promInfo) y lo añade a Disponibles del equipo destino
// de la promoción — igual que hace el sistema normal al promocionar, para que no
// aparezca como "huérfano"/doblado.
function copyUnEquipo(datosOrigenSemana, posOrigenSemana, promInfoOrigenSemana, fromDia, toDia, eq, modo){
  const origenData = datosOrigenSemana?.[fromDia]?.[eq];
  if(!origenData) return;
  if(!data[toDia]) data[toDia] = {};
  if(!data[toDia][eq]) data[toDia][eq] = {};
  const destino = data[toDia][eq];

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

  // Posiciones de campo (si se copió el campo)
  if(modo === 'todo' || modo === 'campo'){
    (origenData.campo||[]).forEach(n=>{
      const kOrigen = fromDia+'|'+eq+'|'+n;
      const p = posOrigenSemana?.[kOrigen];
      if(p) pos[toDia+'|'+eq+'|'+n] = [...p];
    });
  }

  // Reconstruir promociones a partir de quién es cada jugador de verdad — si tras
  // copiar el campo hay algún jugador que NO es de este equipo (origen[nombre] apunta
  // a otro), es que viene prestado/promocionado: se marca esa promoción en su equipo
  // REAL para el día destino (si no estaba ya) y se le quita de Disponibles ahí, para
  // que no quede como "doblado"/huérfano. Aplica también en modo "Solo el campo",
  // donde antes no se tocaba nada de promociones.
  if(modo === 'todo' || modo === 'campo'){
    (destino.campo||[]).forEach(n=>{
      const eqReal = origen[n];
      if(!eqReal || eqReal === eq || eqReal === 'PRUEBA') return; // es de este equipo, o a prueba
      if(!data[toDia][eqReal]) data[toDia][eqReal] = {};
      ZONAS.forEach(z=>{ if(!data[toDia][eqReal][z]) data[toDia][eqReal][z] = []; });
      // En Castilla, según el destino, la promoción va a "Promoción 1er Eq." o a
      // "Otro equipo" (zona extra) — mismo criterio que usa el resto de la app.
      const zonaOrigenDestino = (typeof _zonaPromoParaDestino === 'function') ? _zonaPromoParaDestino(eqReal, eq) : 'promovidos_1er';
      if(!data[toDia][eqReal][zonaOrigenDestino].includes(n)){
        data[toDia][eqReal][zonaOrigenDestino].push(n);
      }
      if(!promInfo[toDia]) promInfo[toDia] = {};
      if(!promInfo[toDia][eqReal]) promInfo[toDia][eqReal] = {};
      const yaTiene = promInfo[toDia][eqReal][n];
      const yaTieneArr = yaTiene ? (Array.isArray(yaTiene) ? yaTiene : [yaTiene]) : [];
      if(!yaTieneArr.includes(eq)){
        const nuevaLista = [...yaTieneArr, eq];
        promInfo[toDia][eqReal][n] = nuevaLista.length===1 ? nuevaLista[0] : nuevaLista;
      }
      // Quitar de Disponibles/Banquillo de su equipo real ese día, para no duplicar
      ['disponibles','banquillo'].forEach(z=>{
        const arr = data[toDia][eqReal][z];
        const i = arr.indexOf(n);
        if(i>=0) arr.splice(i,1);
      });
    });
  }

  // Promociones (promInfo) — solo si se copió la columna de promoción
  if(modo === 'todo' || modo === 'inferiores'){
    const infoOrigen = promInfoOrigenSemana?.[fromDia]?.[eq] || {};
    if(Object.keys(infoOrigen).length){
      if(!promInfo[toDia]) promInfo[toDia] = {};
      if(!promInfo[toDia][eq]) promInfo[toDia][eq] = {};
      Object.keys(infoOrigen).forEach(nombre=>{
        promInfo[toDia][eq][nombre] = infoOrigen[nombre];
        const destinos = Array.isArray(infoOrigen[nombre]) ? infoOrigen[nombre] : [infoOrigen[nombre]];
        destinos.forEach(destEq=>{
          if(destEq === '1ER EQUIPO') return; // no tiene 'disponibles' normal
          if(!data[toDia][destEq]) return;
          if(!data[toDia][destEq].disponibles) data[toDia][destEq].disponibles = [];
          if(!data[toDia][destEq].disponibles.includes(nombre)){
            data[toDia][destEq].disponibles.push(nombre);
          }
        });
      });
    }
  }
}
function copyDiaBase(datosOrigenSemana, posOrigenSemana, promInfoOrigenSemana, from, to, eqs, modo){
  eqs.forEach(eq=>copyUnEquipo(datosOrigenSemana, posOrigenSemana, promInfoOrigenSemana, from, to, eq, modo));
}
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
    const fechasDest = calcFechasSemana(_copySemanaDestLunes);
    if(fechasDest['LUNES'] === FECHAS['LUNES']){ toast('⚠️ La semana destino es la misma que la actual'); return; }
    DIAS.forEach((d)=>{
      copyDiaBase(datosOrigenSemana, posOrigenSemana, promInfoOrigenSemana, _copyDiaOrigen, d, eqs, _copyModo);
    });
    toast('Copiado a semana ' + fechasDest['LUNES'] + ' – ' + fechasDest['DOMINGO']);
  } else {
    if(!_copyDiasDest.size){toast('Selecciona al menos un día');return;}
    if(_copyDiaSemanaLunes){
      const fechasDest = calcFechasSemana(_copyDiaSemanaLunes);
      const esMismaSemana = fechasDest['LUNES'] === FECHAS['LUNES'];
      if(esMismaSemana){
        _copyDiasDest.forEach(d=>copyDiaBase(datosOrigenSemana, posOrigenSemana, promInfoOrigenSemana, _copyDiaOrigen, d, eqs, _copyModo));
      } else {
        // Copiar a una semana DISTINTA a la actual: de momento no soportado (el
        // guardado de esa semana no está conectado a Firebase desde aquí). Avisar en
        // vez de fingir que se ha hecho algo.
        toast('⚠️ Copiar a una semana distinta a la actual no está disponible todavía');
        return;
      }
    } else {
      _copyDiasDest.forEach(d=>copyDiaBase(datosOrigenSemana, posOrigenSemana, promInfoOrigenSemana, _copyDiaOrigen, d, eqs, _copyModo));
    }
    toast('Copiado a '+ [..._copyDiasDest].map(d=>d.slice(0,3)).join(', '));
  }
  autoGuardar(); renderDias(); renderCards();
  cerrarCopiarModal();
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
