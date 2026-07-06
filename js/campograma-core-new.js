// ================================================
// CAMPOGRAMA-LOGIC.JS — Lógica principal (Fase 1: monolito intacto)
// ================================================

// ══════════════════════════════════════════════════
// DATOS
// ══════════════════════════════════════════════════
// Calcular fechas de la semana actual (lunes = día 0)
function calcFechasSemana(lunesBase){
  const base = lunesBase ? new Date(lunesBase) : (()=>{
    const hoy = new Date();
    const d = hoy.getDay(); // 0=dom
    const diff = d===0 ? -6 : 1-d;
    const lun = new Date(hoy); lun.setDate(hoy.getDate()+diff); return lun;
  })();
  const fechas = {};
  DIAS.forEach((dia,i)=>{
    const f = new Date(base); f.setDate(base.getDate()+i);
    fechas[dia] = f.getDate()+'/'+(f.getMonth()+1);
  });
  return fechas;
}
let dia   = sessionStorage.getItem("rm_dia") || "LUNES"; // día activo global
let FECHAS = calcFechasSemana();
const origen = {};
let movimientos = {}; // movimientos[dia][eq][nombre] = {ts, user}
let porteros = []; // array de nombres marcados como portero
// ══════════════════════════════════════════════════
// ESTADO
// ══════════════════════════════════════════════════
let data = JSON.parse(JSON.stringify(RAW));
for(const d of DIAS) for(const e of EQUIPOS){
  if(!data[d])  data[d]={};
  if(!data[d][e]) data[d][e]={};
  for(const z of ZONAS) if(!data[d][e][z]) data[d][e][z]=[];
  // migrar disponibles antiguo si no tiene banquillo
  if(data[d][e].banquillo === undefined) data[d][e].banquillo = [];
}
// dia declarada en campograma-constants.js
let eqF  = "TODOS";
let pos  = {};   // "dia|eq|nombre" → [top,left]
// Nombres editables de columnas por equipo: colNames[eq] = ['PROMOCIONADOS','LESIONADOS','OTROS']
let colNames = {};
// Info de promoción: promInfo[dia][eqOrigen][nombre] = 'CASTILLA' (equipo destino)
let promInfo = {};
let multiEq    = {};
let primerEqVisible = false; // pestaña 1er Equipo visible o no
let promDestinos = {}; // promDestinos[dia][eq][nombre] = 'RMC' | '1ER EQUIPO' | 'CASTILLA'... // multiEq[dia][nombre] = [eq1, eq2, ...] — jugadores en varios equipos
let modoPartido = {}; // modoPartido[dia][eq] = true/false
let modoDescanso = {}; // modoDescanso[dia][eq] = true/false
let modoUYL     = {}; // modoUYL[dia] = true/false (solo Juvenil A)
let listaUYL    = []; // jugadores elegibles para Youth League (fija temporada)
let rivales     = {}; // rivales[dia][eq] = 'Nombre rival'
let tipoPartido  = {}; // tipoPartido[dia][eq] = key del tipo
// Configuración de tipos por equipo — editable por el usuario
// { key, label, color (hex), esUYL? }
// tiposConfig[eq] = [{k,l,c,uyl?}] — null = usar base
let tiposConfig = {};
// Inicializar con valores por equipo
function initTiposConfig(){
  const defaults = {
    'CASTILLA':  [...TIPOS_BASE, {k:'intl',l:'🌍 Internacional',c:'#10b981'},{k:'premier',l:'⚽ Premier League',c:'#e11d48'}],
    'RMC':       [...TIPOS_BASE],
    'JUVENIL A': [...TIPOS_BASE, {k:'uyl',l:'Youth League',c:'#60b4ff',uyl:true}],
    'JUVENIL B': [...TIPOS_BASE],
    'JUVENIL C': [...TIPOS_BASE],
    'CADETE A':  [...TIPOS_BASE],
  };
  EQUIPOS.forEach(eq=>{ if(!tiposConfig[eq]) tiposConfig[eq]=defaults[eq]||[...TIPOS_BASE]; });
}
let calendarioPartidos = {}; // calendarioPartidos[eq] = [{fecha:'YYYY-MM-DD', rival:'...'}]
function initPromInfo(){ DIAS.forEach(d=>{ promInfo[d]={}; EQUIPOS.forEach(eq=>{ promInfo[d][eq]={}; }); }); }
initPromInfo();
EQUIPOS.forEach(eq=> colNames[eq]=['PROMOCIONADOS','LESIONADOS','OTROS']);
// Zonas extra (4ª columna) por equipo: extraZonas[eq] = bool
let extraZonas = {};
EQUIPOS.forEach(eq=> extraZonas[eq]=false);
let drag = null;
let dOff = {x:0,y:0};
const key    = (d,e,n) => d+'|'+e+'|'+n;
const getPos = (d,e,n,i) => pos[key(d,e,n)] || POS_DEF[i%POS_DEF.length] || [50,50];
const savePos= (d,e,n,t,l) => pos[key(d,e,n)] = [clamp(t,0,100), clamp(l,0,100)];
// Zona del área (portero) — viewBox 0 0 100 118 — portero a partir de top 85%
function esPortero(eq,nombre,i){
  const [t,l]=getPos(dia,eq,nombre,i);
  return t>84 && l>=24 && l<=76;
}
function countLabel(eq,campo){
  let p=0,j=0;
  campo.forEach((n,i)=>{ if(esPortero(eq,n,i)) p++; else j++; });
  return p===0 ? campo.length+'' : j+'+'+p+'P';
}
function updateCount(eq){
  const el=document.getElementById('count-'+eq.replace(/ /g,'_'));
  if(!el) return;
  const campo = data[dia][eq]?.campo||[];
  const countTxt = campo.length ? countLabel(eq,campo) : '';
  el.innerHTML = eq + (countTxt ? `<span style="margin-left:8px;font-size:12px;color:rgba(255,255,255,.45);font-weight:700;">${countTxt}</span>` : '');
}
// ══════════════════════════════════════════════════
// SNAP AL SLOT MÁS CERCANO
// ══════════════════════════════════════════════════
// Devuelve posiciones reales de todos los jugadores en campo (excepto el que movemos)
function posOcupadas(eq, nombreMovido){
  const campo = data[dia][eq].campo;
  return campo
    .filter(n => n !== nombreMovido)
    .map((n,i) => pos[key(dia,eq,n)] || POS_DEF[i % POS_DEF.length] || [50,50]);
}
// Distancia mínima entre punto y lista de posiciones ocupadas
function distMinOcupadas(t, l, ocupadas){
  if(!ocupadas.length) return 999;
  return Math.min(...ocupadas.map(([ot,ol]) => Math.hypot(t-ot, l-ol)));
}
// Radio de exclusión — los chips no se solapan si están al menos RADIO_MIN % separados
const RADIO_MIN = 6; // % del campo
function snapToGrid(eq, nombre, rawTop, rawLeft){
  const ocupadas = posOcupadas(eq, nombre);
  // 1. Si el punto exacto de drop está libre, usarlo tal cual
  if(distMinOcupadas(rawTop, rawLeft, ocupadas) >= RADIO_MIN){
    return [rawTop, rawLeft];
  }
  // 2. Si hay solapamiento, desplazar en pequeños incrementos en 8 direcciones
  //    buscando el punto libre más cercano al drop original
  const step = 1.5; // % del campo por paso
  for(let radio = step; radio <= RADIO_MIN * 2; radio += step){
    for(let ang = 0; ang < 360; ang += 30){
      const rad = ang * Math.PI / 180;
      const t = clamp(rawTop  + radio * Math.sin(rad), 0, 100);
      const l = clamp(rawLeft + radio * Math.cos(rad), 0, 100);
      if(distMinOcupadas(t, l, ocupadas) >= RADIO_MIN){
        return [t, l];
      }
    }
  }
  // 3. Fallback: posición exacta aunque haya solapamiento (campo muy lleno)
  return [rawTop, rawLeft];
}
// Reordenar todos los jugadores del campo — garantiza sin solapamientos
function autoAlinear(eq){
  const campo = data[dia][eq].campo;
  if(campo.length === 0) return;
  // Asignar slots en orden estricto: cada jugador al siguiente slot libre
  const asignados = new Set();
  campo.forEach((nombre) => {
    // Encontrar el primer slot libre
    let idx = 0;
    while(idx < SNAP_SLOTS.length && asignados.has(idx)) idx++;
    const [t,l] = SNAP_SLOTS[idx] || [50, 50];
    asignados.add(idx);
    savePos(dia, eq, nombre, t, l);
  });
}
// ══════════════════════════════════════════════════
// AUTOCOMPLETE — desplegable para añadir jugadores
// ══════════════════════════════════════════════════
function candidatos(eq, zona){
  const todos = new Set();
  // Solo jugadores de OTROS equipos (nunca del propio)
  EQUIPOS.forEach(e=>{
    if(e===eq) return;
    (plantillas[e]||[]).forEach(n=>todos.add(n));
  });
  // Añadir jugadores en data de otros equipos por si no están en plantillas
  DIAS.forEach(d=> EQUIPOS.forEach(e=>{
    if(e===eq) return;
    ZONAS.forEach(z=> (data[d][e][z]||[]).forEach(n=>todos.add(n)));
  }));
  const enZona = new Set(data[dia][eq][zona]||[]);
  // También excluir los que ya están en cualquier zona de este equipo hoy
  const enEquipo = new Set();
  ZONAS.forEach(z=>(data[dia][eq][z]||[]).forEach(n=>enEquipo.add(n)));
  return [...todos]
    .filter(n=>!enZona.has(n) && !enEquipo.has(n))
    .sort((a,b)=>{
      const idxA=EQUIPOS.indexOf(origen[a]||''), idxB=EQUIPOS.indexOf(origen[b]||'');
      if(idxA!==idxB) return idxA-idxB;
      return a.localeCompare(b,'es');
    });
}
function buildAddInput(eq, zona){
  const wrap  = mk('div','zona-add');
  const input = mk('input','zona-add-input');
  input.type='text';
  input.placeholder='+ Añadir jugador…';
  const clearBtn = mk('button','zona-add-clear');
  clearBtn.textContent='×'; clearBtn.tabIndex=-1;
  clearBtn.onmousedown=(e)=>{e.preventDefault();input.value='';list.classList.remove('open');input.focus();};
  const list = mk('div','ac-list');
  let selIdx = -1;
  function filtrar(){
    const q = input.value.trim().toLowerCase();
    list.innerHTML=''; selIdx=-1;
    const todos = candidatos(eq,zona).filter(n=>!q||n.toLowerCase().includes(q));
    const hayResultados = todos.length > 0;
    if(hayResultados){
      // Agrupar por equipo de origen
      const grupos = {};
      todos.forEach(nombre=>{
        const eqO = origen[nombre] || '—';
        if(!grupos[eqO]) grupos[eqO]=[];
        grupos[eqO].push(nombre);
      });
      const ordenGrupos = [...EQUIPOS.filter(e=>e!==eq)].filter(e=>grupos[e]);
      ordenGrupos.forEach(grupo=>{
        const hdr = mk('div','ac-group-hdr');
        hdr.textContent = grupo;
        list.appendChild(hdr);
        grupos[grupo].forEach(nombre=>{
          const it = mk('div','ac-item');
          it.dataset.nombre=nombre;
          it.textContent=nombre;
          it.onmousedown=(e)=>{e.preventDefault();elegir(nombre);};
          list.appendChild(it);
        });
      });
    }
    // Opción "a prueba": si hay texto escrito y no coincide exacto con nadie
    if(zona==='disponibles' && q.length>1){
      const qUp = q.toUpperCase().trim();
      const exacto = todos.some(n=>n.toUpperCase()===qUp);
      if(!exacto){
        const hint = mk('div','ac-prueba-hint');
        hint.textContent = '⚡ Añadir "'+qUp+'" como jugador a prueba';
        hint.onmousedown=(e)=>{ e.preventDefault(); elegirPrueba(qUp); };
        list.appendChild(hint);
      }
    }
    if(list.children.length>0) list.classList.add('open');
    else list.classList.remove('open');
  }
  function elegirPrueba(nombre){
    // Jugador a prueba: se marca en origen como null/'PRUEBA'
    origen[nombre] = 'PRUEBA';
    data[dia][eq].disponibles.push(nombre);
    toast('⚡ '+nombre+' añadido a prueba en '+eq);
    input.value=''; list.classList.remove('open');
    render();
  }
  function elegir(nombre){
    // Evitar duplicado dentro del MISMO equipo: quitarlo de cualquier otra zona suya en este equipo
    ZONAS_ACTIVAS.forEach(z=>{
      if(z===zona) return;
      const arr = data[dia][eq]?.[z];
      if(arr){
        const i = arr.indexOf(nombre);
        if(i>=0){ arr.splice(i,1); if(z==='campo') delete pos[key(dia,eq,nombre)]; }
      }
    });
    if(zona==='campo'){
      // Buscar slot libre sin solapar con los ya colocados
      const ocupadas = posOcupadas(eq, nombre);
      let bestIdx = 0;
      for(let i = 0; i < SNAP_SLOTS.length; i++){
        const [t,l] = SNAP_SLOTS[i];
        if(distMinOcupadas(t, l, ocupadas) >= RADIO_MIN){ bestIdx = i; break; }
        bestIdx = i; // fallback: último índice si todo lleno
      }
      const [t,l] = SNAP_SLOTS[bestIdx] || [50,50];
      savePos(dia,eq,nombre,t,l);
    }
    // Si viene de otro equipo → registrar promoción en su equipo de origen
    const eqPropio = origen[nombre];
    if(eqPropio && eqPropio !== eq && eqPropio !== 'PRUEBA'){
      // Quitar de disponibles del equipo origen si estaba ahí
      const dispOrigen = data[dia][eqPropio]?.disponibles;
      if(dispOrigen){
        const idx = dispOrigen.indexOf(nombre);
        if(idx >= 0) dispOrigen.splice(idx, 1);
      }
      // Registrar en promovidos_1er del equipo origen
      if(!data[dia][eqPropio].promovidos_1er) data[dia][eqPropio].promovidos_1er = [];
      if(!data[dia][eqPropio].promovidos_1er.includes(nombre)){
        data[dia][eqPropio].promovidos_1er.push(nombre);
      }
      // Guardar destino
      if(!promInfo[dia]) promInfo[dia] = {};
      if(!promInfo[dia][eqPropio]) promInfo[dia][eqPropio] = {};
      promInfo[dia][eqPropio][nombre] = eq;
    }
    data[dia][eq][zona].push(nombre);
    toast(nombre+' → '+ZONA_NAMES[zona]);
    input.value='';list.classList.remove('open');
    render();
  }
  input.addEventListener('input', filtrar);
  input.addEventListener('focus', filtrar);
  input.addEventListener('blur', ()=>setTimeout(()=>list.classList.remove('open'),150));
  input.addEventListener('keydown',(e)=>{
    const its=[...list.querySelectorAll('.ac-item')];
    if(e.key==='ArrowDown'){e.preventDefault();selIdx=Math.min(selIdx+1,its.length-1);its.forEach((it,i)=>it.classList.toggle('ac-sel',i===selIdx));}
    else if(e.key==='ArrowUp'){e.preventDefault();selIdx=Math.max(selIdx-1,0);its.forEach((it,i)=>it.classList.toggle('ac-sel',i===selIdx));}
    else if(e.key==='Enter'){e.preventDefault();if(selIdx>=0&&its[selIdx])elegir(its[selIdx].dataset.nombre);else if(its.length===1)elegir(its[0].dataset.nombre);}
    else if(e.key==='Escape'){list.classList.remove('open');input.blur();}
  });
  wrap.appendChild(input); wrap.appendChild(clearBtn); wrap.appendChild(list);
  return wrap;
}
// ══════════════════════════════════════════════════
// CAPTURA DE CAMPO
// ══════════════════════════════════════════════════
function abrirFbPanel(){
  if(!window._fbReady){ toast('⏳ Firebase no conectado aún'); return; }
  document.getElementById('fb-overlay').classList.add('open');
  // Mostrar sesión activa
  const actLbl = document.getElementById('fb-sesion-activa-lbl');
  if(actLbl) actLbl.textContent = _fbSesionActiva ? '🔄 Sync: '+_fbSesionActiva : 'Sin sesión activa';
  renderFbLista();
}
function cerrarFbPanel(){
  document.getElementById('fb-overlay').classList.remove('open');
}
async function renderFbLista(){
  const lista = document.getElementById('fb-lista');
  lista.innerHTML = '<div class="fb-empty">Cargando...</div>';
  const res = await window.fbListarSesiones();
  if(!res.ok){
    lista.innerHTML = '<div class="fb-empty">Error al leer Firebase</div>';
    toast('❌ Firebase: ' + (res.message || 'no se pudieron listar las sesiones'));
    return;
  }
  const sesiones = Array.isArray(res.data) ? res.data : [];
  if(!sesiones.length){
    lista.innerHTML = '<div class="fb-empty">No hay sesiones guardadas</div>';
    return;
  }
  sesiones.sort((a,b)=> (b._ts?.seconds||0) - (a._ts?.seconds||0));
  lista.innerHTML = '';
  sesiones.forEach(s=>{
    const row = document.createElement('div');
    row.className = 'fb-sesion-row';
    const fecha = s._ts?.seconds
      ? new Date(s._ts.seconds*1000).toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})
      : '';
    const safeNombre = String(s._nombre || s.id || '').replace(/'/g, "\\'");
    row.innerHTML = `
      <span class="fb-sesion-nombre" title="${s._nombre || s.id || ''}">${s._nombre || s.id || ''}</span>
      <span class="fb-sesion-ts">${fecha}</span>
      <button class="fb-btn cargar" onclick="fbCargar('${safeNombre}')">⬇️ Cargar</button>
      <button class="fb-btn borrar" onclick="fbBorrar('${safeNombre}', this)">🗑️</button>`;
    lista.appendChild(row);
  });
}
async function fbGuardarActual(){
  if(!window._fbReady){ toast('⏳ Firebase no conectado'); return; }
  const inp = document.getElementById('fb-nueva-inp');
  const nombre = inp.value.trim();
  if(!nombre){ toast('⚠️ Escribe un nombre'); return; }
  toast('☁️ Guardando...');
  const payload = {
    data, pos, plantillas, origen,
    colNames, extraZonas, promInfo, multiEq,
    modoPartido, modoDescanso,
    modoUYL, listaUYL, listaUYLExcl: window.listaUYLExcl||[],
    tipoPartido, tiposConfig,
    rivales: window.rivales||{},
    primerEquipoJugadores,
    fechas: FECHAS
  };
  const res = await window.fbGuardarSesion(nombre, payload);
  if(res.ok){
    _fbSesionActiva = nombre;
    toast('✅ Guardado en la nube: '+nombre);
    inp.value = '';
    renderFbLista();
  } else {
    toast('❌ Firebase: ' + (res.message || 'error al guardar'));
  }
}
async function fbCargar(nombre){
  if(!window._fbReady){ toast('⏳ Firebase no conectado'); return; }
  if(!confirm('¿Cargar "'+nombre+'"? Se sobreescribirá lo actual.')){ return; }
  toast('☁️ Cargando...');
  const res = await window.fbCargarSesion(nombre);
  if(!res.ok){
    if(res.reason === 'not_found'){
      toast('❌ La sesión no existe en Firebase');
    }else{
      toast('❌ Firebase: ' + (res.message || 'error al cargar'));
    }
    return;
  }
  const payload = res.data || {};
  if(payload.data)                  data = payload.data;
  if(payload.pos)                   pos = payload.pos;
  if(payload.plantillas)            plantillas = payload.plantillas;
  if(payload.origen)                origen = { ...origen, ...payload.origen };
  if(payload.colNames)              colNames = payload.colNames;
  if(payload.porteros)               porteros = payload.porteros;
  if(payload.movimientos)            movimientos = payload.movimientos;
  if(payload.extraZonas)            extraZonas = payload.extraZonas;
  if(payload.promInfo)              promInfo = payload.promInfo;
  if(payload.multiEq)               multiEq = payload.multiEq;
  if(payload.modoPartido)           modoPartido = payload.modoPartido;
  if(payload.modoDescanso)          modoDescanso = payload.modoDescanso;
  if(payload.modoUYL)               modoUYL = payload.modoUYL;
  if(payload.listaUYL)              listaUYL = payload.listaUYL;
  if(payload.listaUYLExcl)          window.listaUYLExcl = payload.listaUYLExcl;
  if(payload.tipoPartido)           tipoPartido = payload.tipoPartido;
  if(payload.tiposConfig)           tiposConfig = payload.tiposConfig;
  if(payload.rivales)               window.rivales = payload.rivales;
  if(payload.primerEquipoJugadores) primerEquipoJugadores = payload.primerEquipoJugadores;
  if(payload.fechas)                Object.assign(FECHAS, payload.fechas);
  
  // ── Asegurar estructura completa ──
  for(const d of DIAS) for(const e of EQUIPOS){
    if(!data[d])    data[d]={};
    if(!data[d][e]) data[d][e]={};
    for(const z of ZONAS) if(!data[d][e][z]) data[d][e][z]=[];
  }
  // Asegurar estructura promInfo
  DIAS.forEach(d=>{ if(!promInfo[d]) promInfo[d]={}; EQUIPOS.forEach(eq=>{ if(!promInfo[d][eq]) promInfo[d][eq]={}; }); });
  // Asegurar colNames
  EQUIPOS.forEach(eq=>{
    if(!colNames[eq]) colNames[eq]=['PROMOCIONADOS','LESIONADOS','OTROS'];
    
  });
  // Sincronizar plantillas → disponibles (exacto igual que cargarGuardado)
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
  // Reconstruir origen desde plantillas si viene vacío
  if(!payload.origen || Object.keys(payload.origen).length===0){
    EQUIPOS.forEach(eq=>{
      (plantillas[eq]||[]).forEach(nombre=>{ origen[nombre]=eq; });
    });
  }
  _fbSesionActiva = nombre;
  // Diagnóstico en consola
  console.log('[fbCargar] Sesión:', nombre);
  EQUIPOS.forEach(eq=>{
    const disp = (data[DIAS[0]]?.[eq]?.disponibles||[]).length;
    const campo = (data[DIAS[0]]?.[eq]?.campo||[]).length;
    const plnt  = (plantillas[eq]||[]).length;
    console.log('  '+eq+' → plantilla:'+plnt+' disponibles[lun]:'+disp+' campo[lun]:'+campo);
  });
  try{
    render();
    renderDias();
    renderEqs();
    renderCards();
    renderMultiEqBar();
    cerrarFbPanel();
    toast('✅ Sesión "'+nombre+'" cargada');
    autoGuardar();
  }catch(e){
    console.error('fbCargar render error:', e);
    toast('⚠️ Datos cargados, pero hubo un error al pintar la pantalla: ' + (e.message || e));
  }
}
async function fbBorrar(nombre, btn){
  if(!confirm('¿Eliminar "'+nombre+'"? No se puede deshacer.')){ return; }
  btn.textContent = '...';
  const res = await window.fbEliminarSesion(nombre);
  if(res.ok){
    toast('🗑️ "'+nombre+'" eliminado');
    renderFbLista();
  } else {
    toast('❌ Firebase: ' + (res.message || 'error al eliminar'));
    btn.textContent = '🗑️';
  }
}
// Cerrar al clicar fuera
document.addEventListener('DOMContentLoaded',()=>{
  // Cerrar modal copiar al click fuera
  document.getElementById('copy-modal-overlay').addEventListener('click',e=>{
    if(e.target===document.getElementById('copy-modal-overlay')) cerrarCopiarModal();
  });
  document.getElementById('foto-multi-overlay').addEventListener('click',e=>{
    if(e.target===document.getElementById('foto-multi-overlay')) cerrarFotoMultiModal();
  });
  document.getElementById('promo-dest-overlay').addEventListener('click',e=>{
    if(e.target===document.getElementById('promo-dest-overlay')) cerrarPromoDestModal();
  });
  document.getElementById('fb-overlay').addEventListener('click', e=>{
    if(e.target===document.getElementById('fb-overlay')) cerrarFbPanel();
  });
  // Cargar plantillas Firebase cuando esté listo
  window.addEventListener('firebase-ready', ()=>{
    if(window._fbPlantillas){
      // Firebase es la única fuente de verdad
      const hayLocal = false; // localStorage desactivado
      if(!hayLocal){
        Object.assign(plantillas, window._fbPlantillas);
        if(window._fbOrigen) Object.assign(origen, window._fbOrigen);
        render();
        toast('☁️ Plantillas cargadas desde Firebase');
      }
    }
  });
});
// ══════════════════════════════════════════════════
// FOTO MÚLTIPLE — varios equipos en una imagen
// ══════════════════════════════════════════════════
let _fotoEqsSel = new Set();
function abrirFotoMultiModal(){
  // Preseleccionar equipos visibles en la vista actual
  const enVista = (vistaActual==='2col'||vistaActual==='3col')
    ? new Set(EQUIPOS.filter(e=>eqsMultiSel.has(e)))
    : (eqF==='TODOS' ? new Set(EQUIPOS) : new Set([eqF]));
  _fotoEqsSel = new Set(enVista);
  const cont = document.getElementById('foto-eq-checks');
  cont.innerHTML = '';
  EQUIPOS.forEach(eq=>{
    const sel = _fotoEqsSel.has(eq);
    const row = document.createElement('div');
    row.className = 'foto-eq-row' + (sel?' sel':'');
    row.innerHTML = `
      <span class="foto-eq-dot" style="background:${EQ_DOT_COLORS[eq]||'#888'}"></span>
      <span class="foto-eq-nombre">${eq}</span>
      <span class="foto-eq-check"></span>`;
    row.onclick = ()=>{
      if(_fotoEqsSel.has(eq)){
        _fotoEqsSel.delete(eq);
        row.classList.remove('sel');
      } else {
        _fotoEqsSel.add(eq);
        row.classList.add('sel');
      }
    };
    cont.appendChild(row);
  });
  document.getElementById('foto-multi-overlay').classList.add('open');
}
function cerrarFotoMultiModal(){
  document.getElementById('foto-multi-overlay').classList.remove('open');
}
async function generarFotoMulti(){
  if(!_fotoEqsSel.size){ toast('Selecciona al menos un equipo'); return; }
  if(_fotoEqsSel.size === 1){
    // Un solo equipo → usar capturarCampo normal
    const eq = [..._fotoEqsSel][0];
    const card = document.querySelector(`[data-eq-card="${eq}"]`);
    if(card){ cerrarFotoMultiModal(); capturarCampo(eq, card); return; }
  }
  cerrarFotoMultiModal();
  toast('Generando foto conjunta…');
  // Capturar cada campo con html2canvas en orden del grid
  const equiposOrden = EQUIPOS.filter(e => _fotoEqsSel.has(e));
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  try{
    // Capturar todos los campos
    const capturas = [];
    for(const eq of equiposOrden){
      const card = document.querySelector(`[data-eq-card="${eq}"]`);
      if(!card) continue;
      const cWrap = card.querySelector('.campo-wrap');
      if(!cWrap) continue;
      // Ocultar escudo antes de capturar
      const shieldEl = cWrap.querySelector('.campo-shield');
      if(shieldEl) shieldEl.style.visibility='hidden';
      const fc = await html2canvas(cWrap,{
        scale:2,useCORS:true,allowTaint:true,
        backgroundColor:'#1a6b2a',logging:false,imageTimeout:0
      });
      if(shieldEl) shieldEl.style.visibility='';
      capturas.push({eq, fc, cWrap});
    }
    if(!capturas.length){ toast('❌ No se pudo capturar ningún equipo'); return; }
    // Construir canvas compuesto: cada equipo apilado verticalmente
    const W = 800;
    // Usar la proporción real del campo de la primera captura
    const _fc0 = capturas[0].fc;
    const BLOQUE_H = Math.round(W * (_fc0.height / _fc0.width));
    const HDR_H = 36; // cabecera por equipo
    const SEP = 6;    // separador entre equipos
    const TOP_H = 60; // cabecera global (día + fecha)
    const H = TOP_H + capturas.length * (HDR_H + BLOQUE_H + SEP);
    const DPR2 = Math.min(window.devicePixelRatio || 2, 3);
    const cv = document.createElement('canvas');
    cv.width = W * DPR2; cv.height = H * DPR2;
    cv.style.width  = W + 'px';
    cv.style.height = H + 'px';
    const ctx = cv.getContext('2d');
    ctx.scale(DPR2, DPR2);
    // Fondo global
    ctx.fillStyle = '#07101e';
    ctx.fillRect(0,0,W,H);
    // Cabecera global
    const grad = ctx.createLinearGradient(0,0,W,0);
    grad.addColorStop(0,'#001a52'); grad.addColorStop(1,'#0a1628');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,W,TOP_H);
    ctx.fillStyle='#C8A800';
    ctx.fillRect(0,TOP_H-1,W,1);
    // Fecha y día en cabecera global
    const fecha = FECHAS[dia]||'';
    const partes = fecha.split('/');
    const aaStr = new Date().getFullYear().toString().slice(2);
    const fechaFmt = partes.length===2
      ? `${dia}  ${partes[0]}/${partes[1]}/${aaStr}`
      : dia;
    ctx.fillStyle='#fff';
    ctx.font='bold 26px sans-serif';
    ctx.textBaseline='middle';
    ctx.textAlign='left';
    ctx.fillText('Real Madrid Cantera', 16, TOP_H/2);
    ctx.fillStyle='#C8A800';
    ctx.font='bold 18px sans-serif';
    ctx.textAlign='right';
    ctx.fillText(fechaFmt, W-16, TOP_H/2);
    ctx.textAlign='left';
    // Dibujar cada equipo
    let yOff = TOP_H;
    for(const {eq, fc} of capturas){
      // Cabecera equipo
      const dotColor = EQ_DOT_COLORS[eq]||'#888';
      ctx.fillStyle = 'rgba(255,255,255,.04)';
      ctx.fillRect(0, yOff, W, HDR_H);
      // Punto color equipo
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(20, yOff+HDR_H/2, 5, 0, Math.PI*2);
      ctx.fill();
      // Nombre equipo
      ctx.fillStyle='#fff';
      ctx.font='bold 16px sans-serif';
      ctx.textBaseline='middle';
      ctx.fillText(eq, 34, yOff+HDR_H/2);
      // Partido?
      if(modoDescanso[dia]?.[eq]){
        td.textContent='-';
        td.style.cssText='text-align:center;color:#64748b;font-weight:700;font-size:13px;';
        tr.appendChild(td); continue;
      }
      if(modoPartido[dia]?.[eq]){
        const rival = rivales[dia]?.[eq]||'';
        ctx.fillStyle='#f59e0b';
        ctx.font='bold 12px sans-serif';
        ctx.textAlign='right';
        ctx.fillText('⚽ PARTIDO'+(rival?' vs '+rival:''), W-12, yOff+HDR_H/2);
        ctx.textAlign='left';
      }
      yOff += HDR_H;
      // Campo capturado
      ctx.drawImage(fc, 0, yOff, W, BLOQUE_H);
      yOff += BLOQUE_H + SEP;
    }
    // Exportar
    cv.toBlob(blob=>{
      if(!blob){toast('❌ Error generando imagen');return;}
      const blobUrl = URL.createObjectURL(blob);
      let ov = document.getElementById('photo-ov');
      if(ov) ov.remove();
      ov = document.createElement('div');
      ov.id='photo-ov';
      ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.97);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:16px;box-sizing:border-box;overflow-y:auto;-webkit-overflow-scrolling:touch;';
      const instruccion = isIOS
        ? '📥 Mantén pulsada la imagen → <b>Añadir a Fotos</b>'
        : '📥 Mantén pulsada la imagen para guardarla';
      const p=document.createElement('p');
      p.innerHTML=instruccion;
      p.style.cssText='color:#ffd700;font-family:sans-serif;font-size:15px;text-align:center;margin:0;font-weight:700;';
      const imgEl=document.createElement('img');
      imgEl.src=blobUrl;
      imgEl.style.cssText='max-width:100%;max-height:72vh;border-radius:8px;border:2px solid #ffd700;display:block;';
      const btnC=document.createElement('button');
      btnC.textContent='Cerrar';
      btnC.style.cssText='padding:13px 36px;background:#ffd700;border:none;border-radius:12px;font-weight:700;font-size:16px;cursor:pointer;';
      btnC.onclick=()=>{ov.remove();URL.revokeObjectURL(blobUrl);};
      ov.appendChild(p);ov.appendChild(imgEl);ov.appendChild(btnC);
      document.body.appendChild(ov);
    },'image/png');
  }catch(e){ toast('❌ Error: '+e.message); }
}
// ══════════════════════════════════════════════════
// TABLA DE CONTROL
// ══════════════════════════════════════════════════
let _controlDia = null;
let _controlEqsActivos = new Set(EQUIPOS);
function abrirControl(){
  document.getElementById('control-overlay').classList.add('open');
  _controlDia = dia;
  _controlEqsActivos = new Set(EQUIPOS);
  const sel = document.getElementById('control-dia-sel');
  sel.innerHTML = '';
  DIAS.forEach(d=>{
    const o=document.createElement('option'); o.value=d; o.textContent=d+(FECHAS[d]?' · '+FECHAS[d]:'');
    if(d===_controlDia) o.selected=true;
    sel.appendChild(o);
  });
  renderControlEqsRow();
  renderControl();
}
function cambiarControlDia(d){ _controlDia = d; renderControl(); }
function toggleControlEq(eq){
  if(_controlEqsActivos.has(eq)) _controlEqsActivos.delete(eq);
  else _controlEqsActivos.add(eq);
  renderControlEqsRow();
  renderControl();
}
function renderControlEqsRow(){
  const row = document.getElementById('control-eqs-row');
  row.innerHTML = '';
  EQUIPOS.forEach(eq=>{
    const activo = _controlEqsActivos.has(eq);
    const b = document.createElement('button');
    b.className = 'filtro-eq-btn'+(activo?' activo':'');
    b.textContent = (EQ_LABEL[eq]||eq);
    b.onclick = ()=>toggleControlEq(eq);
    row.appendChild(b);
  });
}
function cerrarControl(){
  document.getElementById('control-overlay').classList.remove('open');
}
function getEstadoJugador(nombre, eq, diaP){
  const diaC = diaP || dia;
  // Devuelve {estado, multi} donde estado es dónde está en su equipo
  const d = data[diaC][eq];
  if(!d) return {estado:'vacio', multi:false};
  // ¿Está en otro equipo además del suyo?
  const eqsActivos = EQUIPOS.filter(e=>
    ['campo','banquillo','disponibles','lesionados','otros','extra','promovidos_1er']
      .some(z=>(data[diaC][e]?.[z]||[]).includes(nombre))
  );
  const multi = eqsActivos.length > 1;
  // Estado en su propio equipo
  if((d.campo||[]).includes(nombre))           return {estado:'campo',     multi};
  if((d.banquillo||[]).includes(nombre))       return {estado:'banquillo', multi};
  if((d.lesionados||[]).includes(nombre))      return {estado:'lesion',    multi};
  if((d.promovidos_1er||[]).includes(nombre))  return {estado:'promo',     multi};
  if((d.otros||[]).includes(nombre))           return {estado:'otros',     multi};
  if((d.extra||[]).includes(nombre))           return {estado:'otros',     multi};
  if((d.disponibles||[]).includes(nombre))     return {estado:'disponible',multi};
  return {estado:'vacio', multi};
}
function estadoLabel(estado){
  switch(estado){
    case 'campo':     return '⬤ Campo';
    case 'banquillo': return '⬤ Banco';
    case 'lesion':    return '⬤ Lesión';
    case 'promo':     return '⬤ Promoc.';
    case 'otros':     return '⬤ Otros';
    case 'disponible':return '—';
    default:          return '';
  }
}
function renderControl(){
  const diaC = _controlDia || dia;
  const thead = document.getElementById('control-thead');
  const tbody = document.getElementById('control-tbody');
  thead.innerHTML=''; tbody.innerHTML='';
  const eqsShort = {
    'CASTILLA':'CAS','RMC':'RMC',
    'JUVENIL A':'JA','JUVENIL B':'JB','JUVENIL C':'JC','CADETE A':'CA'
  };
  const eqsVisibles = EQUIPOS.filter(eq=>_controlEqsActivos.has(eq));
  // ── Colgroup: fija el ancho real (table-layout:fixed usa la 1ª fila si no hay colgroup)
  const oldColgroup = document.getElementById('control-colgroup');
  if(oldColgroup) oldColgroup.remove();
  const colgroup = document.createElement('colgroup');
  colgroup.id = 'control-colgroup';
  eqsVisibles.forEach(()=>{
    const colJ = document.createElement('col'); colJ.style.width='67%';
    const colE = document.createElement('col'); colE.style.width='33%';
    colgroup.appendChild(colJ); colgroup.appendChild(colE);
  });
  document.getElementById('control-table').insertBefore(colgroup, document.getElementById('control-table').firstChild);
  // ── FILA 1 cabecera: nombre equipo (colspan 2)
  const trH1 = document.createElement('tr');
  eqsVisibles.forEach(eq=>{
    const color = EQ_DOT_COLORS[eq]||'#888';
    const th = document.createElement('th');
    th.className = 'th-eq-grupo';
    th.colSpan = 2;
    // Contar jugadores: propios en campo + los que están en alguna zona activa
    const totalJugs = (plantillas[eq]||[]).length;
    const enCampo = (data[diaC][eq]?.campo||[]).length;
    const prestados = EQUIPOS.filter(e=>e!==eq).reduce((acc,e)=>
      acc + (data[diaC][e]?.campo||[]).filter(n=>origen[n]===eq).length, 0);
    const countStr = enCampo > 0
      ? `${enCampo}${prestados>0?'+'+prestados:''}`
      : `${totalJugs}`;
    th.innerHTML = `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${color};margin-right:6px;vertical-align:middle;"></span>${eq}<span style="margin-left:8px;color:rgba(255,255,255,.45);font-weight:700;">${countStr}</span>`;
    trH1.appendChild(th);
  });
  thead.appendChild(trH1);
  // ── FILA 2 cabecera: Jugador | Estado por cada equipo
  const trH2 = document.createElement('tr');
  eqsVisibles.forEach(eq=>{
    const thJ = document.createElement('th');
    thJ.className = 'th-sub th-sub-jugador';
    thJ.textContent = 'Jugador';
    trH2.appendChild(thJ);
    const thE = document.createElement('th');
    thE.className = 'th-sub th-sub-estado';
    thE.textContent = 'Estado';
    trH2.appendChild(thE);
  });
  thead.appendChild(trH2);
  // ── FILAS de datos
  const maxJug = Math.max(...eqsVisibles.map(eq=>(plantillas[eq]||[]).length), 0);
  for(let i=0; i<maxJug; i++){
    const tr = document.createElement('tr');
    eqsVisibles.forEach(eq=>{
      const jugs = plantillas[eq]||[];
      const tdJ = document.createElement('td');
      tdJ.className = 'td-jugador';
      const tdE = document.createElement('td');
      tdE.className = 'td-estado-cel';
      if(i < jugs.length){
        const nombre = jugs[i];
        const {estado, multi} = getEstadoJugador(nombre, eq, diaC);
        tdJ.textContent = nombre;
        const isPor = porteros.includes(nombre);
        if(multi){
          tdJ.classList.add('td-multi');
          tdE.classList.add('td-multi');
          const eqsActivos = EQUIPOS
            .filter(e=>ZONAS_ACTIVAS.some(z=>(data[diaC][e]?.[z]||[]).includes(nombre)))
            .map(e=>eqsShort[e]||e).join('+');
          tdE.innerHTML = `<span class="ctrl-badge ctrl-multi">⚡ ${eqsActivos}</span>`;
        } else if(estado==='disponible'){
          tdJ.classList.add('td-disponible');
          tdE.classList.add('td-disponible');
          tdE.innerHTML = '<span class="ctrl-badge ctrl-disp">Disp.</span>';
        } else if(estado==='vacio'){
          tdJ.style.opacity='.15';
          tdE.classList.add('td-vacio');
          tdE.textContent = '';
        } else {
          tdE.classList.add('td-'+estado);
          const badges = {
            campo:    '<span class="ctrl-badge ctrl-campo">Campo</span>',
            banquillo:'<span class="ctrl-badge ctrl-banco">Banco</span>',
            lesion:   '<span class="ctrl-badge ctrl-lesion">Lesión</span>',
            promo:    '<span class="ctrl-badge ctrl-promo">↑ PROMO</span>',
            otros:    '<span class="ctrl-badge ctrl-otros">Otros</span>'
          };
          let lbl = badges[estado] || estado;
          if(estado==='promo' && promInfo[diaC]?.[eq]?.[nombre]){
            const dest=promInfo[diaC][eq][nombre];
            const destCorto = dest==='1ER EQUIPO'?'1ER':(eqsShort[dest]||dest);
            lbl = `<span class="ctrl-badge ctrl-promo">↑ ${destCorto}</span>`;
          }
          tdE.innerHTML = lbl;
        }
      }
      tr.appendChild(tdJ);
      tr.appendChild(tdE);
    });
    tbody.appendChild(tr);
  }
}
// ══════════════════════════════════════════════════
// MODAL DESTINO PROMOCIÓN
// ══════════════════════════════════════════════════
let _promoCallback = null; // fn a llamar con el destino elegido
function abrirPromoDestModal(nombre, eqOrigen, callback){
  _promoCallback = callback;
  document.getElementById('promo-dest-title').textContent = '¿A qué equipo va '+nombre+'?';
  document.getElementById('promo-dest-sub').textContent = 'Equipo de origen: '+eqOrigen;
  const opts = document.getElementById('promo-dest-opts');
  opts.innerHTML='';
  // Opción 1er Equipo siempre primera
  const opt1er = mk('div','promo-dest-opt promo-dest-1er');
  opt1er.innerHTML=`<span class="promo-dest-dot" style="background:#C8A800;"></span>
    <span class="promo-dest-nombre">1ER EQUIPO</span>`;
  opt1er.onclick=()=>{ cerrarPromoDestModal(); callback('1ER EQUIPO'); };
  opts.appendChild(opt1er);
  // Equipos superiores (todos menos el propio)
  const superiores = EQUIPOS.filter(e=>e!==eqOrigen);
  superiores.forEach(eq=>{
    const opt=mk('div','promo-dest-opt');
    const color=EQ_DOT_COLORS[eq]||'#888';
    opt.innerHTML=`<span class="promo-dest-dot" style="background:${color};"></span>
      <span class="promo-dest-nombre">${eq}</span>`;
    opt.onclick=()=>{ cerrarPromoDestModal(); callback(eq); };
    opts.appendChild(opt);
  });
  document.getElementById('promo-dest-overlay').classList.add('open');
}
function cerrarPromoDestModal(){
  document.getElementById('promo-dest-overlay').classList.remove('open');
  _promoCallback=null;
}
// Ejecutar promoción con destino elegido
function ejecutarPromocion(nombre, eqOrigen, destino){
  // Siempre queda en promovidos_1er del equipo origen
  if(!data[dia][eqOrigen].promovidos_1er) data[dia][eqOrigen].promovidos_1er=[];
  if(!data[dia][eqOrigen].promovidos_1er.includes(nombre)){
    data[dia][eqOrigen].promovidos_1er.push(nombre);
  }
  // Guardar destino
  if(!promInfo[dia]) promInfo[dia]={};
  if(!promInfo[dia][eqOrigen]) promInfo[dia][eqOrigen]={};
  promInfo[dia][eqOrigen][nombre]=destino;
  // Si va a otro equipo cantera → añadir a disponibles de ese equipo
  if(destino!=='1ER EQUIPO'){
    if(!data[dia][destino]) data[dia][destino]={campo:[],disponibles:[],promovidos_1er:[],lesionados:[],otros:[]};
    limpiarEquipoExcepto(nombre, destino, 'disponibles');
    if(!data[dia][destino].disponibles.includes(nombre)){
      data[dia][destino].disponibles.push(nombre);
    }
  }
  // Si va a 1ER EQUIPO → acumular en primerEquipoJugadores
  if(destino==='1ER EQUIPO'){
    if(!primerEquipoJugadores[dia]) primerEquipoJugadores[dia]=[];
    if(!primerEquipoJugadores[dia].includes(nombre)){
      primerEquipoJugadores[dia].push(nombre);
    }
  }
  autoGuardar();
  render();
}
// ══════════════════════════════════════════════════
// CARD PRIMER EQUIPO
// ══════════════════════════════════════════════════
// Acumula jugadores que han sido promocionados a 1ER EQUIPO
let primerEquipoJugadores = {}; // primerEquipoJugadores[dia] = [nombres]
function buildCardPrimerEquipo(){
  const card=mk('div','card');
  card.dataset.eqCard='1ER EQUIPO';
  // Header
  const hdr=mk('div','card-hdr');
  const nm=mk('div','card-hdr-name');
  nm.textContent='PRIMER EQUIPO';
  hdr.appendChild(nm);
  const right=mk('div','card-hdr-right');
  const camBtn=mk('button','snap-btn');
  camBtn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>';
  camBtn.onclick=(e)=>{e.stopPropagation();capturarCampo('1ER EQUIPO',card);};
  right.appendChild(camBtn);
  hdr.appendChild(right);
  card.appendChild(hdr);
  // Campo
  const cWrap=mk('div','campo-wrap dz');
  cWrap.dataset.eq='1ER EQUIPO'; cWrap.dataset.zona='campo';
  cWrap.innerHTML=`
    <svg class="campo-svg" viewBox="0 0 100 118" preserveAspectRatio="none">
      <rect x="2" y="2" width="96" height="114" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".8"/>
      <line x1="2" y1="59" x2="98" y2="59" stroke="rgba(255,255,255,.45)" stroke-width=".6"/>
      <rect x="26" y="2" width="48" height="16" fill="none" stroke="rgba(255,255,255,.38)" stroke-width=".6"/>
      <rect x="26" y="100" width="48" height="16" fill="none" stroke="rgba(255,255,255,.38)" stroke-width=".6"/>
      <circle cx="50" cy="59" r="8.5" fill="none" stroke="rgba(255,255,255,.35)" stroke-width=".7"/>
    </svg>
    <img class="campo-shield" src="data:image/png;base64,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" alt="RM"/>
    <div class="campo-players"></div>`;
  // Jugadores del primer equipo este día
  const jugsHoy = primerEquipoJugadores[dia] || [];
  const pw=cWrap.querySelector('.campo-players');
  // Recoger los que han sido marcados con destino 1ER EQUIPO
  const dePromocion = [];
  EQUIPOS.forEach(eq=>{
    // Desde promInfo (destino explícito)
    const prom = promInfo[dia]?.[eq]||{};
    Object.entries(prom).forEach(([nombre,dest])=>{
      if(dest==='1ER EQUIPO' && !dePromocion.includes(nombre)) dePromocion.push(nombre);
    });
    // Desde promovidos_1er con destino en promInfo
    (data[dia]?.[eq]?.promovidos_1er||[]).forEach(nombre=>{
      const dest = promInfo[dia]?.[eq]?.[nombre];
      if(dest==='1ER EQUIPO' && !dePromocion.includes(nombre)) dePromocion.push(nombre);
    });
  });
  // Solo poner en campo los que ya tienen posición guardada
  jugsHoy.forEach((nombre,i)=>{
    const pos2=getPos(dia,'1ER EQUIPO',nombre,i);
    const pof=mk('div','pof');
    pof.style.top=pos2[0]+'%'; pof.style.left=pos2[1]+'%';
    const c=mk('div','chip c-verde cf chip-2l');
    c.innerHTML=chipHTML(nombre,true);
    c.dataset.eq='1ER EQUIPO'; c.dataset.zona='campo'; c.dataset.nombre=nombre;
    pof.appendChild(c);
    pw.appendChild(pof);
  });
  card.appendChild(cWrap);
  // Disponibles: todos los promocionados que NO están ya en el campo
  const enCampo = new Set(jugsHoy);
  const disponiblesHoy = dePromocion.filter(n=>!enCampo.has(n));
  const zDisp=mk('div','zona-disponibles dz');
  zDisp.dataset.eq='1ER EQUIPO'; zDisp.dataset.zona='disponibles';
  const lblD=mk('div','zona-lbl'); lblD.textContent='DISPONIBLES ('+(d.disponibles||[]).length+')';
  zDisp.appendChild(lblD);
  const cwD=mk('div','chips-wrap');
  disponiblesHoy.forEach(nombre=>{
    const eqOrig=origen[nombre]||'?';
    const eqsShort={'CASTILLA':'CAS','RMC':'RMC','JUVENIL A':'JA','JUVENIL B':'JB','JUVENIL C':'JC','CADETE A':'CA'};
    const c=mk('div','chip c-naranja cz');
    c.textContent=nombre;
    const s=document.createElement('span');
    s.className='chip-dest';
    s.textContent=' ('+( eqsShort[eqOrig]||eqOrig)+')';
    c.appendChild(s);
    c.dataset.eq='1ER EQUIPO'; c.dataset.zona='disponibles'; c.dataset.nombre=nombre;
    cwD.appendChild(c);
  });
  zDisp.appendChild(cwD);
  card.appendChild(zDisp);
  if(!jugsHoy.length && !disponiblesHoy.length){
    const empty=mk('div','');
    empty.style.cssText='padding:20px;text-align:center;color:rgba(255,255,255,.25);font-family:Barlow Condensed,sans-serif;font-size:13px;';
    empty.textContent='No hay jugadores con Primer Equipo hoy';
    card.appendChild(empty);
  }
  return card;
}
// ══════════════════════════════════════════════════
// SELECTOR DE VISTA
// ══════════════════════════════════════════════════
let vistaActual = sessionStorage.getItem('rm_vista') || 'semana';
let eqsMultiSel = new Set(EQUIPOS);
function setView(n){
  vistaActual = n;
  sessionStorage.setItem('rm_vista', n);
  const grid = document.getElementById('grid');
  if(grid) grid.className = 'cards-grid view-'+n;
  // Botones activos
  ['1','2col','3col','semana'].forEach(v=>{
    const btn=document.getElementById('vbtn-'+v);
    if(btn) btn.classList.toggle('active', v===String(n));
  });
  // Barra multi-eq solo en vistas multi-columna
  const bar = document.getElementById('multi-eq-bar');
  if((n==='2col' || n==='3col') && eqF==='TODOS'){
    bar.classList.add('visible');
    renderMultiEqBar();
  } else {
    bar.classList.remove('visible');
  }
  renderCards();
}
function renderMultiEqBar(){
  const bar=document.getElementById('multi-eq-bar');
  bar.innerHTML='';
  // Botón "Todos"
  const btnTodos=document.createElement('button');
  btnTodos.className='meq-btn'+(eqsMultiSel.size===EQUIPOS.length?' sel':'');
  btnTodos.innerHTML='<span style="font-size:10px;">≡</span> Todos';
  btnTodos.onclick=()=>{
    if(eqsMultiSel.size===EQUIPOS.length) eqsMultiSel=new Set([EQUIPOS[0]]);
    else eqsMultiSel=new Set(EQUIPOS);
    renderMultiEqBar(); renderCards();
  };
  bar.appendChild(btnTodos);
  EQUIPOS.forEach(eq=>{
    const sel=eqsMultiSel.has(eq);
    const color=EQ_DOT_COLORS[eq]||'#888';
    const btn=document.createElement('button');
    btn.className='meq-btn'+(sel?' sel':'');
    btn.innerHTML=`<span class="meq-dot" style="background:${color};"></span>${EQ_LABEL[eq]||eq}`;
    btn.onclick=()=>{
      if(eqsMultiSel.has(eq)){
        if(eqsMultiSel.size>1) eqsMultiSel.delete(eq);
      } else {
        eqsMultiSel.add(eq);
      }
      renderMultiEqBar(); renderCards();
    };
    bar.appendChild(btn);
  });
  // Botón foto — captura los equipos visibles
  const btnFoto=document.createElement('button');
  btnFoto.className='meq-btn meq-foto';
  btnFoto.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg> Foto`;
  btnFoto.onclick=()=>{
    _fotoEqsSel=new Set(eqsMultiSel);
    generarFotoMulti();
  };
  bar.appendChild(btnFoto);
}
// ── Exportar datos a fichero JSON
function exportarDatos(){
  try{
    const payload = {
      data, pos, plantillas, origen,
      colNames, extraZonas, promInfo, multiEq, fechas: FECHAS,
      ts: new Date().toISOString(),
      version: 'rm_cantera_v2'
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], {type:'application/json'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const fecha = new Date().toLocaleDateString('es-ES').replace(/\//g,'-');
    a.href = url;
    a.download = 'campograma_datos_'+fecha+'.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('✅ Datos exportados correctamente');
  }catch(e){ toast('❌ Error al exportar: '+e.message); }
}
// ── Abrir selector de fichero
function importarDatos(){
  document.getElementById('import-file').value = '';
  document.getElementById('import-file').click();
}
// ── Cargar fichero JSON importado
function cargarFicheroImport(ev){
  const file = ev.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try{
      const payload = JSON.parse(e.target.result);
      if(!payload.data){ toast('❌ Fichero no válido'); return; }
      if(!confirm('¿Cargar estos datos? Se sobreescribirá todo lo actual.')){return;}
      if(payload.data)       data       = payload.data;
      if(payload.pos)        pos        = payload.pos;
      if(payload.plantillas) plantillas = payload.plantillas;
      if(payload.origen)     Object.assign(origen, payload.origen);
      if(payload.colNames)   colNames   = payload.colNames;
      if(payload.porteros)    porteros   = payload.porteros;
      if(payload.movimientos) movimientos = payload.movimientos;
      if(payload.extraZonas) extraZonas = payload.extraZonas;
      if(payload.promInfo)   promInfo   = payload.promInfo;
    if(payload.multiEq)    multiEq    = payload.multiEq;
    if(payload.modoPartido) modoPartido = payload.modoPartido;
    if(payload.rivales)          rivales              = payload.rivales;
    if(payload.primerEquipoJugadores) primerEquipoJugadores = payload.primerEquipoJugadores;
      if(payload.fechas)     Object.assign(FECHAS, payload.fechas);
      autoGuardar();
      render();
      renderDias();
      toast('✅ Datos cargados correctamente');
    }catch(err){ toast('❌ Error al leer fichero: '+err.message); }
  };
  reader.readAsText(file);
}
// ══════════════════════════════════════════════════
// EXPORTAR EXCEL
// ══════════════════════════════════════════════════
// Exportar un equipo en un día concreto (al pulsar el contador)
function exportarEquipoDia(eq, d){
  const rows = [];
  // Título
  rows.push(['REAL MADRID CANTERA — '+eq+' — '+d]);
  rows.push(['']);
  const equipoData = data[d][eq];
  const maxLen = Math.max(
    equipoData.campo.length,
    equipoData.banquillo.length,
    equipoData.disponibles.length,
    equipoData.promovidos_1er.length,
    equipoData.lesionados.length,
    equipoData.otros.length
  );
  rows.push(['CAMPO ('+equipoData.campo.length+')','','BANQUILLO','','DISPONIBLES','','PROMOVIDO','LESIONADOS','OTROS']);
  rows.push(['---','','---','','---','','---','---','---']);
  for(let i=0;i<Math.max(maxLen,1);i++){
    rows.push([
      equipoData.campo[i]||'',
      '',
      equipoData.banquillo[i]||'',
      '',
      equipoData.disponibles[i]||'',
      '',
      equipoData.promovidos_1er[i]||'',
      equipoData.lesionados[i]||'',
      equipoData.otros[i]||'',
    ]);
  }
  const csv = rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom+csv],{type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url;
  a.download=eq.replace(/ /g,'_')+'_'+d+'_'+new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit'}).replace(/\//g,'-')+'.csv';
  a.click();
  URL.revokeObjectURL(url);
  toast('📥 Exportando '+eq+' — '+d);
}
// Exportar semana completa (todos los días, todos los equipos) → CSV multi-hoja simulado
function exportarSemana(){
  const rows = [];
  rows.push(['REAL MADRID CANTERA — SEMANA COMPLETA']);
  rows.push(['Generado: '+new Date().toLocaleString('es-ES')]);
  rows.push(['']);
  DIAS.forEach(d=>{
    rows.push(['══ '+d+' ══']);
    rows.push(['EQUIPO','ZONA','JUGADOR','EQUIPO_ORIGEN']);
    EQUIPOS.forEach(eq=>{
      const zonaData = data[d][eq];
      const zonasExport = [
        {key:'campo',       lbl:'Campo'},
        {key:'banquillo',   lbl:'Banquillo'},
        {key:'disponibles', lbl:'Disponible'},
        {key:'promovidos_1er',lbl:'Promovido'},
        {key:'lesionados',  lbl:'Lesión'},
        {key:'otros',       lbl:'Otros'},
      ];
      zonasExport.forEach(({key:z,lbl})=>{
        (zonaData[z]||[]).forEach(nombre=>{
          rows.push([eq, lbl, nombre, origen[nombre]||'']);
        });
      });
    });
    rows.push(['']);
  });
  // Añadir tabla registro al final
  rows.push(['══ REGISTRO DE ENTRENAMIENTO ══']);
  const header = ['JUGADOR','EQUIPO',...DIAS,'TOTAL_CAMPO','TOTAL_BANQUILLO'];
  rows.push(header);
  const allJugs = [...new Set([...Object.keys(origen)])].sort();
  allJugs.forEach(nombre=>{
    let tc=0, tb=0;
    const diasRow = DIAS.map(d=>{
      let estado='';
      EQUIPOS.forEach(eq=>{
        if((data[d][eq].campo||[]).includes(nombre))    estado='Campo';
        if((data[d][eq].banquillo||[]).includes(nombre) && !estado) estado='Banco';
      });
      if(estado==='Campo') tc++;
      if(estado==='Banco') tb++;
      return estado||'';
    });
    rows.push([nombre, origen[nombre]||'', ...diasRow, tc, tb]);
  });
  const csv = rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom+csv],{type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url;
  a.download='RM_Cantera_Semana_'+new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'2-digit'}).replace(/\//g,'-')+'.csv';
  a.click();
  URL.revokeObjectURL(url);
  toast('📥 Exportando semana completa…');
}
// ══════════════════════════════════════════════════
// FOTO LISTA — imagen con texto sin campo visual
// ══════════════════════════════════════════════════
function generarFotoLista(eq){
  const d = data[dia][eq];
  const fecha = FECHAS[dia] || '';
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const eqsShort = {'CASTILLA':'CAS','RMC':'RMC','JUVENIL A':'JA','JUVENIL B':'JB','JUVENIL C':'JC','CADETE A':'CA'};
  const campo      = d.campo      || [];
  const banquillo  = d.banquillo  || [];
  const proms      = d.promovidos_1er || [];
  const lesion     = d.lesionados || [];
  const otros      = d.otros      || [];
  const promoInfoEq = promInfo[dia]?.[eq] || {};
  const colN       = colNames[eq] || ['PROMOCIONADOS','LESIONADOS','OTROS','EXTRA'];
  const esCas      = eq === 'CASTILLA';
  const esPartidoHoy = esPartido(eq);
  const countTxt   = campo.length ? countLabel(eq, campo) : '0';
  // ── Canvas ──
  const W = 640;
  const FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif";
  const PAD = 28;
  const LINE_H = 28;
  const SEC_H  = 36; // cabecera sección
  // Calcular altura total
  const secciones = [
    { label: 'CAMPO', items: campo, extra: countTxt, color: '#4ade80' },
  ];
  if(esPartidoHoy && banquillo.length){
    secciones.push({ label: '🔄 BANQUILLO', items: banquillo, color: '#f59e0b' });
  }
  if(proms.length){
    secciones.push({ label: esCas ? '1ER EQUIPO' : (colN[0]||'PROMOCIONADOS'), items: proms, color: '#a78bfa', destinos: promoInfoEq });
  }
  if(lesion.length){
    secciones.push({ label: colN[1]||'LESIONADOS', items: lesion, color: '#f87171' });
  }
  if(otros.length){
    secciones.push({ label: colN[2]||'OTROS', items: otros, color: '#94a3b8' });
  }
  // Zona extra (4ª columna: TTT o nombre personalizado)
  if(extraZonas[eq]){
    const extra = d.extra || [];
    const extraNombre = colN[3] || 'EXTRA';
    if(extra.length){
      secciones.push({ label: extraNombre, items: extra, color: '#38bdf8' });
    }
  }
  const HEADER_H = 90;
  let totalH = HEADER_H + PAD;
  secciones.forEach(s => {
    totalH += SEC_H + s.items.length * LINE_H + 12;
  });
  totalH += PAD;
  const DPR = Math.min(window.devicePixelRatio || 2, 3);
  const cv = document.createElement('canvas');
  cv.width = W * DPR; cv.height = totalH * DPR;
  const ctx = cv.getContext('2d');
  ctx.scale(DPR, DPR);
  // Fondo
  ctx.fillStyle = '#0a1628';
  ctx.fillRect(0, 0, W, totalH);
  // Cabecera
  const grad = ctx.createLinearGradient(0,0,W,0);
  grad.addColorStop(0,'#001a52'); grad.addColorStop(1,'#0a1628');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, HEADER_H);
  ctx.fillStyle = '#C8A800';
  ctx.fillRect(0, HEADER_H-2, W, 2);
  // Escudo Real Madrid (arriba derecha)
  const shieldImgEl = document.querySelector('#hdr-escudo img');
  function dibujarCuerpoLista(){
    // Emoji libreta
    ctx.font = '28px serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('📋', PAD, HEADER_H/2 - 6);
    // Equipo + fecha
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.font = `600 12px ${FONT}`;
    ctx.textBaseline = 'top';
    ctx.fillText(eq, PAD + 40, 14);
  const partesFecha = fecha.split('/');
  const aaStr = new Date().getFullYear().toString().slice(2);
  const fechaFmt = partesFecha.length===2
    ? `${dia}   ${partesFecha[0]}/${partesFecha[1]}/${aaStr}`
    : dia;
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 26px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(fechaFmt, PAD + 40, HEADER_H/2 + 6);
  // Indicador partido + rival
  if(esPartidoHoy){
    const rivalVal = (window.rivales && window.rivales[dia] && window.rivales[dia][eq]) || '';
    const partidoTxt = '⚽ PARTIDO' + (rivalVal ? '  vs ' + rivalVal : '');
    ctx.fillStyle = '#f59e0b';
    ctx.font = `700 13px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(partidoTxt, W - PAD, HEADER_H/2 + 6);
    ctx.textAlign = 'left';
  }
  // (contador eliminado — ya aparece en la sección CAMPO abajo)
    // Secciones
    let y = HEADER_H + PAD;
  secciones.forEach(sec => {
    // Cabecera sección
    ctx.fillStyle = sec.color + '22';
    ctx.fillRect(PAD, y, W - PAD*2, SEC_H);
    ctx.fillStyle = sec.color;
    ctx.font = `700 12px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(sec.label + (sec.extra ? '  ' + sec.extra : '') + '  (' + sec.items.length + ')', PAD + 10, y + SEC_H/2);
    y += SEC_H;
    if(sec.items.length === 0){
      ctx.fillStyle = 'rgba(255,255,255,.2)';
      ctx.font = `400 13px ${FONT}`;
      ctx.fillText('—', PAD + 10, y + LINE_H/2);
      y += LINE_H;
    } else {
      sec.items.forEach((nombre, i) => {
        // Fila alternada
        if(i % 2 === 0){
          ctx.fillStyle = 'rgba(255,255,255,.04)';
          ctx.fillRect(PAD, y, W - PAD*2, LINE_H);
        }
        // Número
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.font = `400 11px ${FONT}`;
        ctx.textBaseline = 'middle';
        ctx.fillText((i+1)+'', PAD + 8, y + LINE_H/2);
        // Nombre
        ctx.fillStyle = '#ffffff';
        ctx.font = `600 14px ${FONT}`;
        ctx.fillText(nombre, PAD + 28, y + LINE_H/2);
        // Destino promoción
        if(sec.destinos && sec.destinos[nombre]){
          const dest = sec.destinos[nombre];
          const destLbl = dest==='1ER EQUIPO' ? '1ER' : (eqsShort[dest]||dest);
          ctx.fillStyle = '#a78bfa';
          ctx.font = `700 11px ${FONT}`;
          ctx.textAlign = 'right';
          ctx.fillText('→ '+destLbl, W - PAD - 8, y + LINE_H/2);
          ctx.textAlign = 'left';
        }
        y += LINE_H;
      });
    }
    y += 12;
  });
    // Exportar
    cv.toBlob(blob => {
    if(!blob){ toast('❌ Error generando lista'); return; }
    const blobUrl = URL.createObjectURL(blob);
    let ov = document.getElementById('photo-ov');
    if(ov) ov.remove();
    ov = document.createElement('div');
    ov.id = 'photo-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.97);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:16px;box-sizing:border-box;overflow-y:auto;-webkit-overflow-scrolling:touch;';
    const instruccion = isIOS ? '📥 Mantén pulsada la imagen → <b>Añadir a Fotos</b>' : '📥 Mantén pulsada la imagen para guardarla';
    const p = document.createElement('p');
    p.innerHTML = instruccion;
    p.style.cssText = 'color:#ffd700;font-family:sans-serif;font-size:15px;text-align:center;margin:0;font-weight:700;';
    const imgEl = document.createElement('img');
    imgEl.src = blobUrl;
    imgEl.style.cssText = 'max-width:100%;max-height:72vh;border-radius:8px;border:2px solid #ffd700;display:block;';
    const btnC = document.createElement('button');
    btnC.textContent = 'Cerrar';
    btnC.style.cssText = 'padding:13px 36px;background:#ffd700;border:none;border-radius:12px;font-weight:700;font-size:16px;cursor:pointer;';
    btnC.onclick = () => { ov.remove(); URL.revokeObjectURL(blobUrl); };
    ov.appendChild(p); ov.appendChild(imgEl); ov.appendChild(btnC);
    document.body.appendChild(ov);
    }, 'image/png');
  } // fin dibujarCuerpoLista
  // Dibujar escudo arriba a la derecha si existe
  if(shieldImgEl && shieldImgEl.src){
    const si = new Image();
    si.onload = () => {
      const sh = HEADER_H - 12;
      ctx.save();
      ctx.drawImage(si, W - PAD - sh, 6, sh, sh);
      ctx.restore();
      dibujarCuerpoLista();
    };
    si.onerror = () => dibujarCuerpoLista();
    si.src = shieldImgEl.src;
  } else {
    dibujarCuerpoLista();
  }
}
// ══════════════════════════════════════════════════
// DRAG
// ══════════════════════════════════════════════════
// ── Doble tap/click para eliminar chip ──
const _tapTimer = new WeakMap();   // chip → timeout id
const _tapCount = new WeakMap();   // chip → nº de taps
// Devuelve un jugador a disponibles de su equipo propio desde eq/zona
// Devuelve un jugador a disponibles de su equipo propio desde cualquier zona/equipo
function moveGhost(x,y){const g=document.getElementById('ghost');g.style.left=(x-dOff.x)+'px';g.style.top=(y-dOff.y)+'px';}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function on(ev,fn,opts){document.addEventListener(ev,fn,opts);}
function off(ev,fn){document.removeEventListener(ev,fn);}
let alertCb=null;
function showAlert(msg,onConfirm,okLabel='Añadir',onExtra=null,extraLabel=''){
  document.getElementById('alert-msg').textContent=msg;
  document.getElementById('alert-ok-btn').textContent=okLabel;
  // Estilo rojo si es destructivo
  const okBtn=document.getElementById('alert-ok-btn');
  if(okLabel==='Eliminar'){ okBtn.style.background='#ef4444'; okBtn.style.borderColor='#ef4444'; }
  else { okBtn.style.background=''; okBtn.style.borderColor=''; }
  const extraBtn=document.getElementById('alert-extra-btn');
  if(onExtra){
    extraBtn.textContent=extraLabel;
    extraBtn.style.display='';
    extraBtn.onclick=()=>{closeAlert();onExtra();};
  } else {
    extraBtn.style.display='none';
    extraBtn.onclick=null;
  }
  document.getElementById('alert-overlay').classList.add('show');
  alertCb=onConfirm;
  okBtn.onclick=()=>{const cb=alertCb;closeAlert();if(cb)cb();};
}
function closeAlert(){
  document.getElementById('alert-overlay').classList.remove('show');
  alertCb=null;
  const extraBtn=document.getElementById('alert-extra-btn');
  extraBtn.style.display='none';
  extraBtn.onclick=null;
}
let tT=null;
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(tT);tT=setTimeout(()=>t.classList.remove('show'),2200);}
// Intentar cargar guardado previo
// ── ARRANQUE: cargar sesión principal desde Firebase ──
// Firebase es la fuente de verdad. localStorage solo como fallback mientras carga.
initTiposConfig();
async function arrancarDesdeFirebase(){
  try{
    // Esperar Firebase listo (máx 6s)
    if(!window._fbReady){
      await new Promise((res,rej)=>{
        const t=setTimeout(()=>rej('timeout'),6000);
        window.addEventListener('firebase-ready',()=>{clearTimeout(t);res();},{once:true});
      });
    }
    // 1. Cargar sesión principal
    const res = await window.fbCargarSesion('principal');
    if(res.ok && res.data && res.data.plantillas){
      const payload = res.data;
      // Aplicar payload de Firebase (misma lógica que fbCargar pero silenciosa)
      if(payload.data        && typeof payload.data==='object')        data        = payload.data;
      if(payload.pos         && typeof payload.pos==='object')         pos         = payload.pos;
      if(payload.plantillas  && typeof payload.plantillas==='object')  plantillas  = payload.plantillas;
      if(payload.origen      && typeof payload.origen==='object')      Object.assign(origen, payload.origen);
      if(payload.colNames    && typeof payload.colNames==='object')    colNames    = payload.colNames;
      if(payload.porteros    && Array.isArray(payload.porteros))           porteros    = payload.porteros;
      if(payload.movimientos  && typeof payload.movimientos==='object')    movimientos = payload.movimientos;
      if(payload.extraZonas  && typeof payload.extraZonas==='object')  extraZonas  = payload.extraZonas;
      if(payload.promInfo    && typeof payload.promInfo==='object')    promInfo    = payload.promInfo;
      if(payload.tiposConfig && typeof payload.tiposConfig==='object') tiposConfig = payload.tiposConfig;
      if(payload.tipoPartido && typeof payload.tipoPartido==='object') tipoPartido = payload.tipoPartido;
      if(payload.modoPartido && typeof payload.modoPartido==='object') modoPartido = payload.modoPartido;
      if(payload.modoDescanso&& typeof payload.modoDescanso==='object')modoDescanso= payload.modoDescanso;
      if(payload.multiEq     && typeof payload.multiEq==='object')     multiEq     = payload.multiEq;
      // FECHAS no se restaura del guardado: la app siempre abre en la semana actual
      if(Array.isArray(payload.primerEquipoJugadores)) primerEquipoJugadores = payload.primerEquipoJugadores;
      if(payload.rivales     && typeof payload.rivales==='object')     window.rivales = payload.rivales;
      // Normalizar colNames
      EQUIPOS.forEach(eq=>{
        if(!colNames[eq]) colNames[eq]=['PROMOCIONADOS','LESIONADOS','OTROS'];
        if(colNames[eq][0]==='1ER EQUIPO') colNames[eq][0]='PROMOCIONADOS';
        // Migrar nombres antiguos en singular a plural (solo si no fueron personalizados manualmente)
        if(colNames[eq][0]==='PROMOCIÓN') colNames[eq][0]='PROMOCIONADOS';
        if(colNames[eq][1]==='LESIÓN')    colNames[eq][1]='LESIONADOS';
      });
      // Asegurar estructura completa
      for(const d of DIAS) for(const e of EQUIPOS){
        if(!data[d])    data[d]={};
        if(!data[d][e]) data[d][e]={};
        for(const z of ZONAS) if(!data[d][e][z]) data[d][e][z]=[];
      }
      DIAS.forEach(d=>{if(!promInfo[d])promInfo[d]={};EQUIPOS.forEach(eq=>{if(!promInfo[d][eq])promInfo[d][eq]={};});});
      // Sincronizar plantillas → disponibles
      EQUIPOS.forEach(eq=>{
        (plantillas[eq]||[]).forEach(nombre=>{
          DIAS.forEach(d=>{
            const enAlgunaZona=ZONAS.some(z=>(data[d][eq][z]||[]).includes(nombre));
            if(!enAlgunaZona && !data[d][eq].disponibles.includes(nombre))
              data[d][eq].disponibles.push(nombre);
          });
        });
      });
      initTiposConfig();
      _fbSesionActiva = 'principal';
      // Guardar en local como caché
      // localStorage desactivado
      render(); renderDias(); renderEqs(); renderCards(); renderMultiEqBar();
      console.log('✅ Sesión principal cargada desde Firebase');
    } else {
      // No existe sesión principal todavía — crearla con los datos actuales
      _fbSesionActiva = 'principal';
      // Importar plantillas desde campograma/plantillas si existen
      try{
        const snap = await db.collection('campograma').doc('plantillas').get();
        if(snap.exists){
          const origenFb = snap.data().origen || {};
          EQUIPOS.forEach(eq=>{ if(!plantillas[eq]) plantillas[eq]=[]; });
          Object.entries(origenFb).forEach(([nombre,eq])=>{
            if(!plantillas[eq]) plantillas[eq]=[];
            if(!plantillas[eq].includes(nombre)) plantillas[eq].push(nombre);
            if(!origen[nombre]) origen[nombre]=eq;
            DIAS.forEach(d=>{
              if(!data[d]||!data[d][eq]) return;
              const enAlgunaZona=ZONAS.some(z=>(data[d][eq][z]||[]).includes(nombre));
              if(!enAlgunaZona && !data[d][eq].disponibles.includes(nombre))
                data[d][eq].disponibles.push(nombre);
            });
          });
          render();
          toast('☁️ Plantillas importadas desde Firebase');
        }
      }catch(e){ console.warn('Sin plantillas Firebase:', e); }
      autoGuardar();
      console.log('ℹ️ Sesión principal creada en Firebase');
    }
  }catch(e){
    console.warn('[arranque] Firebase no disponible, usando datos locales:', e);
    if(!cargado){ initTiposConfig(); render(); }
  }
}
arrancarDesdeFirebase();
function doblarJugador(nombre, eqOrigen, destino){
  if(destino==='1ER EQUIPO' || !data[dia][destino]) { toast('❌ No se puede doblar ahí'); return; }
  limpiarEquipoExcepto(nombre, destino, 'disponibles'); // evitar duplicado en destino
  if(!data[dia][destino].disponibles.includes(nombre)){
    data[dia][destino].disponibles.push(nombre);
  }
  // Marcar en PROMOCIONADOS del origen SIN quitarlo de donde está (es duplicado, no promoción real)
  if(!data[dia][eqOrigen].promovidos_1er) data[dia][eqOrigen].promovidos_1er=[];
  if(!data[dia][eqOrigen].promovidos_1er.includes(nombre)){
    data[dia][eqOrigen].promovidos_1er.push(nombre);
  }
  if(!promInfo[dia]) promInfo[dia]={};
  if(!promInfo[dia][eqOrigen]) promInfo[dia][eqOrigen]={};
  promInfo[dia][eqOrigen][nombre] = destino;
  autoGuardar();
  render();
  toast('⧉ '+nombre+' doblado en '+destino);
}
// Asegura que un jugador solo esté en UNA zona activa por equipo (evita duplicados internos)
function limpiarEquipoExcepto(nombre, eq, zonaMantener){
  ZONAS_ACTIVAS.forEach(z=>{
    if(z===zonaMantener) return;
    const arr = data[dia][eq]?.[z];
    if(arr){
      const i = arr.indexOf(nombre);
      if(i>=0){ arr.splice(i,1); if(z==='campo') delete pos[key(dia,eq,nombre)]; }
    }
  });
}
