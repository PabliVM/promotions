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
let FECHAS = calcFechasSemana();
const origen = {};
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
let dia  = "LUNES";
let eqF  = "TODOS";
let pos  = {};   // "dia|eq|nombre" → [top,left]
// Nombres editables de columnas por equipo: colNames[eq] = ['PROMOCIÓN','LESIÓN','OTROS']
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
EQUIPOS.forEach(eq=> colNames[eq]=['PROMOCIÓN','LESIÓN','OTROS']);
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
    // Sin bloqueo por duplicados — libertad total
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
function capturarCampo(eq, card, diaParam){
  if(typeof html2canvas === 'undefined'){ toast('❌ html2canvas no cargado'); return; }
  toast('Generando imagen…');
  const _diaOriginal = dia;
  if(diaParam) dia = diaParam; // usar el día de la card que disparó la captura
  const fecha  = FECHAS[dia] || '';
  const isIOS  = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  // Primer Equipo: recoger jugadores de todos los equipos promocionados
  let proms=[], lesion=[], otros=[], extra=[], banquillo=[];
  let esCas = false;
  let colN = ['PROMOCIÓN','LESIÓN','OTROS'];
  let promoInfoEq = {};
  const esPartidoHoy = esPartido(eq);
  if(eq === '1ER EQUIPO'){
    // Listar todos los jugadores promocionados a 1er equipo hoy
    EQUIPOS.forEach(e=>{
      const prom = promInfo[dia]?.[e]||{};
      Object.entries(prom).forEach(([nombre,dest])=>{
        if(dest==='1ER EQUIPO' && !proms.includes(nombre)) proms.push(nombre);
      });
    });
    colN = ['PROMOCIONADOS'];
  } else {
    const d = data[dia][eq];
    esCas  = eq === 'CASTILLA';
    colN   = colNames[eq] || ['PROMOCIÓN','LESIÓN','OTROS'];
    proms  = d.promovidos_1er || [];
    lesion = d.lesionados     || [];
    otros  = d.otros          || [];
    extra  = d.extra          || [];
    banquillo = d.banquillo   || [];
    promoInfoEq = promInfo[dia]?.[eq] || {};
  }
  const cWrap = card.querySelector('.campo-wrap');
  if(!cWrap){ toast('❌ No se encontró el campo'); return; }
  // Ocultar escudo: html2canvas no soporta mix-blend-mode
  const shieldEl = cWrap.querySelector('.campo-shield');
  if(shieldEl) shieldEl.style.visibility = 'hidden';
  html2canvas(cWrap, {
    scale: 3, useCORS: true, allowTaint: true,
    backgroundColor: '#1a6b2a', logging: false, imageTimeout: 0
  }).then(fieldCanvas=>{
    // Restaurar escudo en la UI
    if(shieldEl) shieldEl.style.visibility = '';
    // Dimensiones del canvas — respeta la proporción real del campo capturado
    const W       = 800;
    const HEADER_H = 80;
    // Usar la proporción real del campo (fieldCanvas tiene scale:2)
    const FIELD_H  = Math.round(W * (fieldCanvas.height / fieldCanvas.width));
    const ROW_H    = 28;
    const maxRows  = Math.max(proms.length, lesion.length, otros.length, extra.length, banquillo.length, 1);
    const COL_H    = 30 + maxRows * ROW_H + 16;
    const bannerHpre = esPartidoHoy ? 32 : 0;
    const H        = HEADER_H + bannerHpre + FIELD_H + COL_H + 10;
    // Escalar canvas por devicePixelRatio para salida nítida en retina/iPhone
    const DPR = Math.min(window.devicePixelRatio || 2, 3);
    const cv  = document.createElement('canvas');
    cv.width  = W * DPR; cv.height = H * DPR;
    cv.style.width  = W + 'px';
    cv.style.height = H + 'px';
    const ctx = cv.getContext('2d');
    ctx.scale(DPR, DPR);
    // Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    // Cabecera azul corporativa
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(0, 0, W, HEADER_H);
    // Equipo arriba izquierda pequeño
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.font = '600 13px Segoe UI, -apple-system, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(eq, 16, 10);
    // Fecha grande izquierda — LUNES DD/MM/AA
    const partesFecha = fecha.split('/');
    const aaStr = new Date().getFullYear().toString().slice(2);
    const fechaFmt = partesFecha.length===2
      ? (dia + '  ' + partesFecha[0] + '/' + partesFecha[1] + '/' + aaStr)
      : dia;
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 32px Segoe UI, -apple-system, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(fechaFmt, 16, HEADER_H/2 + 8);
    // Sin escudo en header (evitar fondo negro por transparencia)

    // Banner PARTIDO vs Rival + tipo, si aplica
    let bannerH = 0;
    if(esPartidoHoy){
      bannerH = 32;
      const rivalVal = rivales[dia]?.[eq] || 'Rival por confirmar';
      const tiposBase = (tiposConfig[eq] && tiposConfig[eq].length) ? tiposConfig[eq] : TIPOS_BASE;
      const tipoKey = tipoPartido[dia]?.[eq] || tiposBase[0]?.k || 'liga';
      const tipoObj = tiposBase.find(t=>t.k===tipoKey) || tiposBase[0] || {l:'Liga'};
      ctx.fillStyle = '#fffbeb';
      ctx.fillRect(0, HEADER_H, W, bannerH);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(0, HEADER_H, W, 2);
      ctx.font = '700 13px Segoe UI, -apple-system, sans-serif';
      ctx.fillStyle = '#d97706';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText('⚽ PARTIDO', 16, HEADER_H + bannerH/2);
      ctx.font = '600 13px Segoe UI, -apple-system, sans-serif';
      ctx.fillStyle = '#92400e';
      ctx.fillText((tipoObj.l||'').toUpperCase() + '  vs ' + rivalVal, 130, HEADER_H + bannerH/2);
    }

    // Campo capturado
    ctx.drawImage(fieldCanvas, 0, HEADER_H + bannerH, W, FIELD_H);
    function dibujarColumnas(){
      const colY = HEADER_H + bannerH + FIELD_H + 8;
      const eqsShort = {'CASTILLA':'CAS','RMC':'RMC','JUVENIL A':'JA','JUVENIL B':'JB','JUVENIL C':'JC','CADETE A':'CA'};
      const colDefs = [];
      if(esPartidoHoy && banquillo.length) colDefs.push({ label: '🔄 BANQUILLO', items: banquillo, color:'#f59e0b' });
      colDefs.push({ label: colN[0], items: proms, color:'#7c3aed', destinos: promoInfoEq });
      colDefs.push({ label: colN[1], items: lesion, color:'#dc2626' });
      colDefs.push({ label: colN[2], items: otros, color:'#6b7280' });
      if(extra && extra.length) colDefs.push({ label: colN[3]||colNames[eq]?.[3]||'EXTRA', items: extra, color:'#7c3aed' });
      const cW = Math.floor(W / colDefs.length);
      colDefs.forEach((col, ci)=>{
        const cx = ci * cW;
        // Cabecera columna con color de zona
        ctx.fillStyle = '#f8fafd';
        ctx.fillRect(cx+2, colY, cW-4, 30);
        ctx.fillStyle = col.color;
        ctx.fillRect(cx+2, colY, 4, 30);
        ctx.fillStyle = col.color;
        ctx.font = '700 12px Segoe UI, -apple-system, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(col.label, cx+12, colY+15);
        col.items.forEach((nombre, ri)=>{
          const ry = colY + 30 + ri*ROW_H;
          ctx.fillStyle = ri%2===0 ? '#f8fafd' : '#ffffff';
          ctx.fillRect(cx+2, ry, cW-4, ROW_H);
          ctx.fillStyle = '#1a1d23';
          ctx.font = '600 14px Segoe UI, -apple-system, sans-serif';
          ctx.fillText(nombre, cx+10, ry+ROW_H/2);
          // Destino promoción
          if(col.destinos && col.destinos[nombre]){
            const dest = col.destinos[nombre];
            const destLbl = dest==='1ER EQUIPO' ? '1ER' : (eqsShort[dest]||dest);
            ctx.fillStyle = '#a78bfa';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('→ '+destLbl, cx+cW-8, ry+ROW_H/2);
            ctx.textAlign = 'left';
          }
        });
        if(!col.items.length){
          ctx.fillStyle = '#9ca3af';
          ctx.font = '14px Segoe UI, sans-serif';
          ctx.fillText('—', cx+10, colY+30+ROW_H/2);
        }
      });
    }
    function finalizarYExportar(){
      // Escudo sobre el campo (screen blend — sin cuadro negro)
      const shieldEl2 = cWrap.querySelector('.campo-shield');
      if(shieldEl2 && shieldEl2.src){
        const si=new Image();
        si.onload=()=>{
          const sw=W*0.38;
          const sx=(W-sw)/2;
          // Centrar escudo en el campo visual (vertical: 45% del FIELD_H desde arriba)
          const sy=HEADER_H+(FIELD_H*0.5)-(sw/2);
          ctx.save();
          ctx.globalAlpha=0.22;
          ctx.globalCompositeOperation='screen';
          ctx.drawImage(si,sx,sy,sw,sw);
          ctx.restore();
          dibujarColumnas();
          _exportarImagen(cv,eq,dia,fecha,isIOS);
        };
        si.onerror=()=>{dibujarColumnas();_exportarImagen(cv,eq,dia,fecha,isIOS);};
        si.src=shieldEl2.src;
        return; // salir — continuará en onload
      }
      // Columnas
      dibujarColumnas();
      // Exportar
      _exportarImagen(cv,eq,dia,fecha,isIOS);
    }
    function _exportarImagen(cv,eq,dia,fecha,isIOS){
      try{
        cv.toBlob(blob=>{
          if(!blob){toast('❌ Error generando imagen');return;}
          const blobUrl=URL.createObjectURL(blob);
          let ov=document.getElementById('photo-ov');
          if(ov) ov.remove();
          ov=document.createElement('div');
          ov.id='photo-ov';
          ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.97);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:env(safe-area-inset-top,16px) 16px env(safe-area-inset-bottom,16px);box-sizing:border-box;overflow-y:auto;-webkit-overflow-scrolling:touch;';
          const instruccion=isIOS?'📥 Mantén pulsada la imagen → <b>Añadir a Fotos</b>':'📥 Mantén pulsada la imagen para guardarla';
          const imgEl=document.createElement('img');
          imgEl.src=blobUrl;
          imgEl.style.cssText='max-width:100%;max-height:70vh;border-radius:8px;border:2px solid #2563eb;display:block;';
          const p=document.createElement('p');
          p.innerHTML=instruccion;
          p.style.cssText='color:#fff;font-family:Segoe UI,sans-serif;font-size:15px;text-align:center;margin:0;font-weight:600;';
          const btnC=document.createElement('button');
          btnC.textContent='Cerrar';
          btnC.style.cssText='padding:12px 32px;background:#2563eb;color:#fff;border:none;border-radius:20px;font-weight:600;font-size:14px;cursor:pointer;min-height:44px;font-family:Segoe UI,sans-serif;';
          btnC.onclick=()=>{ov.remove();URL.revokeObjectURL(blobUrl);};
          ov.appendChild(p);ov.appendChild(imgEl);ov.appendChild(btnC);
          document.body.appendChild(ov);
        },'image/png');
      }catch(e){toast('❌ Error: '+e.message);}
    }
    // Sin escudo en la foto (más fiable en iOS)
    finalizarYExportar();
    dia = _diaOriginal; // restaurar
  }).catch(err=>{
    if(shieldEl) shieldEl.style.visibility = '';
    toast('❌ Error: '+err.message);
    dia = _diaOriginal; // restaurar
  });
}
// ══════════════════════════════════════════════════
// PANEL SESIONES FIREBASE
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
    if(!colNames[eq]) colNames[eq]=['PROMOCIÓN','LESIÓN','OTROS'];
    
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
function abrirControl(){
  document.getElementById('control-overlay').classList.add('open');
  renderControl();
}
function cerrarControl(){
  document.getElementById('control-overlay').classList.remove('open');
}
function getEstadoJugador(nombre, eq){
  // Devuelve {estado, multi} donde estado es dónde está en su equipo
  const d = data[dia][eq];
  if(!d) return {estado:'vacio', multi:false};
  // ¿Está en otro equipo además del suyo?
  const eqsActivos = EQUIPOS.filter(e=>
    ['campo','banquillo','disponibles','lesionados','otros','extra','promovidos_1er']
      .some(z=>(data[dia][e]?.[z]||[]).includes(nombre))
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
  const fecha = FECHAS[dia]||'';
  document.getElementById('control-dia-lbl').textContent = dia+(fecha?'  '+fecha:'');
  const thead = document.getElementById('control-thead');
  const tbody = document.getElementById('control-tbody');
  thead.innerHTML=''; tbody.innerHTML='';
  const eqsShort = {
    'CASTILLA':'CAS','RMC':'RMC',
    'JUVENIL A':'JA','JUVENIL B':'JB','JUVENIL C':'JC','CADETE A':'CA'
  };
  // ── FILA 1 cabecera: nombre equipo (colspan 2)
  const trH1 = document.createElement('tr');
  EQUIPOS.forEach(eq=>{
    const color = EQ_DOT_COLORS[eq]||'#888';
    const th = document.createElement('th');
    th.className = 'th-eq-grupo';
    th.colSpan = 2;
    // Contar jugadores: propios en campo + los que están en alguna zona activa
    const totalJugs = (plantillas[eq]||[]).length;
    const enCampo = (data[dia][eq]?.campo||[]).length;
    const prestados = EQUIPOS.filter(e=>e!==eq).reduce((acc,e)=>
      acc + (data[dia][e]?.campo||[]).filter(n=>origen[n]===eq).length, 0);
    const countStr = enCampo > 0
      ? `${enCampo}${prestados>0?'+'+prestados:''}`
      : `${totalJugs}`;
    th.innerHTML = `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${color};margin-right:6px;vertical-align:middle;"></span>${eq}<span style="margin-left:8px;color:rgba(255,255,255,.45);font-weight:700;">${countStr}</span>`;
    trH1.appendChild(th);
  });
  thead.appendChild(trH1);
  // ── FILA 2 cabecera: Jugador | Estado por cada equipo
  const trH2 = document.createElement('tr');
  EQUIPOS.forEach(eq=>{
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
  const maxJug = Math.max(...EQUIPOS.map(eq=>(plantillas[eq]||[]).length), 0);
  for(let i=0; i<maxJug; i++){
    const tr = document.createElement('tr');
    EQUIPOS.forEach(eq=>{
      const jugs = plantillas[eq]||[];
      const tdJ = document.createElement('td');
      tdJ.className = 'td-jugador';
      const tdE = document.createElement('td');
      tdE.className = 'td-estado-cel';
      if(i < jugs.length){
        const nombre = jugs[i];
        const {estado, multi} = getEstadoJugador(nombre, eq);
        tdJ.textContent = nombre;
        if(multi){
          tdJ.classList.add('td-multi');
          tdE.classList.add('td-multi');
          const eqsActivos = EQUIPOS
            .filter(e=>ZONAS_ACTIVAS.some(z=>(data[dia][e]?.[z]||[]).includes(nombre)))
            .map(e=>eqsShort[e]||e).join('+');
          tdE.textContent = '🔴 '+eqsActivos;
        } else if(estado==='disponible'){
          tdJ.classList.add('td-disponible');
          tdE.classList.add('td-disponible');
          tdE.textContent = '—';
        } else if(estado==='vacio'){
          tdJ.style.color='rgba(255,255,255,.1)';
          tdE.classList.add('td-vacio');
          tdE.textContent = '';
        } else {
          tdE.classList.add('td-'+estado);
          const labels = {
            campo:'⬤ Campo',banquillo:'⬤ Banco',
            lesion:'⬤ Lesión',promo:'⬤ Promoc.',otros:'⬤ Otros'
          };
          // Si promoción, añadir destino
          let lbl = labels[estado]||estado;
          if(estado==='promo' && promInfo[dia]?.[eq]?.[nombre]){
            const dest=promInfo[dia][eq][nombre];
            lbl += ' →'+(dest==='1ER EQUIPO'?'1ER':eqsShort[dest]||dest);
          }
          tdE.textContent = lbl;
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
let vistaActual = 'semana';
let eqsMultiSel = new Set(EQUIPOS);
function setView(n){
  vistaActual = n;
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
// RENDER PRINCIPAL
// ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════
// PLANTILLAS — fuente de verdad de jugadores por equipo
// ══════════════════════════════════════════════════
// Construir plantillas iniciales desde RAW (primer día, disponibles)
function buildPlantillasIniciales(){
  const p = {};
  EQUIPOS.forEach(eq=>{
    // Unir todos los jugadores que aparecen en ese equipo en RAW
    const set = new Set();
    DIAS.forEach(d=> ZONAS.forEach(z=> (RAW[d]?.[eq]?.[z]||[]).forEach(n=>set.add(n))));
    // Además los del origen
    Object.entries(origen).forEach(([n,e])=>{ if(e===eq) set.add(n); });
    p[eq] = [...set].sort((a,b)=>a.localeCompare(b,'es'));
  });
  return p;
}
let plantillas = buildPlantillasIniciales();
let plantEqActivo = EQUIPOS[0];
function openPlant(){
  document.getElementById('plant-overlay').classList.add('show');
  renderPlantTabs();
  renderPlantBody();
  actualizarPlantInput();
}
function actualizarPlantInput(){
  const inp = document.getElementById('plant-add-input');
  if(plantEqActivo==='JA_YOUTH'){
    inp.placeholder = 'Buscar jugador de otro equipo…';
    inp.oninput = filtrarUYLDrop;
    inp.onfocus = filtrarUYLDrop;
    inp.onblur  = ()=>setTimeout(cerrarUYLDrop,200);
  } else {
    inp.placeholder = 'Nombre del jugador…';
    inp.oninput = null;
    inp.onfocus = null;
    inp.onblur  = null;
    inp.onkeydown = (e)=>{ if(e.key==='Enter') plantAñadir(); };
    cerrarUYLDrop();
  }
}
function closePlant(){
  document.getElementById('plant-overlay').classList.remove('show');
}
function renderPlantTabs(){
  const wrap = document.getElementById('plant-eq-tabs');
  wrap.innerHTML = '';
  EQUIPOS.forEach(eq=>{
    const btn = mk('button','plant-eq-tab'+(eq===plantEqActivo?' active':''));
    btn.textContent = eq + ' ('+(plantillas[eq]?.length||0)+')';
    btn.onclick = ()=>{ plantEqActivo=eq; renderPlantTabs(); renderPlantBody(); actualizarPlantInput(); };
    wrap.appendChild(btn);
  });
  // Pestaña especial JA Youth
  const uylN = getPlantillaUYL().length;
  const btnUYL = mk('button','plant-eq-tab uyl-tab'+('JA_YOUTH'===plantEqActivo?' active':''));
  btnUYL.innerHTML = 'JA Youth <span style="font-size:9px;opacity:.7">('+uylN+')</span>';
  btnUYL.onclick = ()=>{ plantEqActivo='JA_YOUTH'; renderPlantTabs(); renderPlantBody(); actualizarPlantInput(); };
  wrap.appendChild(btnUYL);
}
function renderPlantBody(){
  const list = document.getElementById('plant-list');
  list.innerHTML = '';
  document.getElementById('plant-add-input').value = '';
  if(plantEqActivo === 'JA_YOUTH'){
    document.getElementById('plant-eq-title').textContent = 'JA Youth League';
    // Inicializar con JA si está vacía
    if(listaUYL.length === 0){
      listaUYL = Object.keys(origen).filter(n=>origen[n]==='JUVENIL A').sort();
      autoGuardar();
    }
    document.getElementById('plant-count').textContent = listaUYL.length + ' jugadores';
    // Botón para re-sincronizar con JA actual
    const syncBtn = mk('button','');
    syncBtn.textContent = '↺ Sincronizar con JA actual';
    syncBtn.style.cssText = 'margin:0 0 10px;padding:6px 12px;border-radius:8px;border:1px solid rgba(96,180,255,.3);background:rgba(96,180,255,.08);color:#60b4ff;font-size:12px;cursor:pointer;font-family:"Barlow Condensed",sans-serif;font-weight:700;';
    syncBtn.title = 'Añade los jugadores de JA que falten (no elimina los que ya están)';
    syncBtn.onclick = ()=>{
      const jaActual = Object.keys(origen).filter(n=>origen[n]==='JUVENIL A');
      let añadidos = 0;
      jaActual.forEach(n=>{ if(!listaUYL.includes(n)){ listaUYL.push(n); añadidos++; } });
      listaUYL.sort((a,b)=>a.localeCompare(b,'es'));
      renderPlantTabs(); renderPlantBody(); autoGuardar();
      if(añadidos) toast('↺ '+añadidos+' jugadores de JA añadidos');
      else toast('✓ Ya estaba sincronizado con JA');
    };
    list.appendChild(syncBtn);
    // Lista de jugadores Youth
    listaUYL.forEach((nombre, i)=>{
      const eqO = origen[nombre] || 'JA';
      const row = mk('div','plant-row');
      const num = mk('span','plant-num'); num.textContent = (i+1);
      const nm  = mk('span','plant-name');
      nm.innerHTML = nombre + (eqO !== 'JUVENIL A' ? '<span class="plant-uyl-origin" style="color:#60b4ff">'+eqO+'</span>' : '');
      const del = mk('button','plant-del'); del.textContent = '×';
      del.title = 'Quitar de JA Youth';
      del.onclick = ()=>{
        const idx = listaUYL.indexOf(nombre);
        if(idx>=0) listaUYL.splice(idx,1);
        renderPlantTabs(); renderPlantBody(); autoGuardar();
      };
      row.appendChild(num); row.appendChild(nm); row.appendChild(del);
      list.appendChild(row);
    });
    return;
  }
  // ── Vista normal de equipo ──
  const jugadores = plantillas[plantEqActivo] || [];
  document.getElementById('plant-eq-title').textContent = plantEqActivo;
  document.getElementById('plant-count').textContent = jugadores.length + ' jugadores';
  jugadores.forEach((nombre, i)=>{
    const row = mk('div','plant-row');
    const num = mk('span','plant-num'); num.textContent = (i+1);
    const nm  = mk('span','plant-name'); nm.textContent = nombre;
    const del = mk('button','plant-del'); del.textContent = '×';
    del.title = 'Eliminar '+nombre;
    del.onclick = ()=> plantEliminar(nombre);
    row.appendChild(num); row.appendChild(nm); row.appendChild(del);
    list.appendChild(row);
  });
}
function plantAñadir(){
  const input = document.getElementById('plant-add-input');
  const nombre = input.value.trim().toUpperCase();
  if(!nombre){ input.focus(); return; }
  // ── JA Youth: añadir cualquier jugador ──
  if(plantEqActivo === 'JA_YOUTH'){
    if(listaUYL.includes(nombre)){
      toast('⚠️ '+nombre+' ya está en JA Youth');
      input.value=''; return;
    }
    if(!origen[nombre]){
      toast('⚠️ '+nombre+' no existe en ninguna plantilla');
      input.value=''; return;
    }
    listaUYL.push(nombre);
    listaUYL.sort((a,b)=>a.localeCompare(b,'es'));
    input.value=''; input.focus();
    renderPlantTabs(); renderPlantBody();
    autoGuardar();
    toast('✅ '+nombre+' añadido a JA Youth');
    return;
  }
  // ── Equipo normal ──
  if(!plantillas[plantEqActivo]) plantillas[plantEqActivo]=[];
  if(plantillas[plantEqActivo].includes(nombre)){
    toast('⚠️ '+nombre+' ya está en '+plantEqActivo);
    return;
  }
  plantillas[plantEqActivo].push(nombre);
  plantillas[plantEqActivo].sort((a,b)=>a.localeCompare(b,'es'));
  origen[nombre] = plantEqActivo;
  DIAS.forEach(d=>{
    if(!data[d][plantEqActivo].disponibles.includes(nombre) &&
       !ZONAS.some(z=>data[d][plantEqActivo][z].includes(nombre))){
      data[d][plantEqActivo].disponibles.push(nombre);
    }
  });
  input.value=''; input.focus();
  renderPlantTabs(); renderPlantBody();
  autoGuardar(); render();
  toast('✅ '+nombre+' añadido a '+plantEqActivo);
}
function plantEliminar(nombre){
  if(!plantillas[plantEqActivo]) return;
  const idx = plantillas[plantEqActivo].indexOf(nombre);
  if(idx<0) return;
  plantillas[plantEqActivo].splice(idx,1);
  // Quitar de origen si era de este equipo
  if(origen[nombre]===plantEqActivo) delete origen[nombre];
  // Quitar de data en todos los días
  DIAS.forEach(d=>{
    ZONAS.forEach(z=>{
      const i=(data[d][plantEqActivo][z]||[]).indexOf(nombre);
      if(i>=0) data[d][plantEqActivo][z].splice(i,1);
    });
  });
  renderPlantTabs();
  renderPlantBody();
  render();
  toast('🗑️ '+nombre+' eliminado de '+plantEqActivo);
}
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
let _lastManualTS = null;
function buildPayload(manualSave=false){
  if(manualSave) _lastManualTS = new Date().toISOString();
  return {
    data,pos,plantillas,origen,colNames,extraZonas,promInfo,multiEq,fechas:FECHAS,notas:window._notasData||{},
    modoUYL, listaUYL, listaUYLExcl: window.listaUYLExcl||[], tipoPartido, tiposConfig, modoDescanso,
    modoPartido, primerEquipoJugadores, rivales: window.rivales||{},
    ts: _lastManualTS
  };
}
// Autoguardado silencioso — guarda datos, NO toca el timestamp
let _autoSaveTimer=null;
function autoGuardar(){
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer=setTimeout(()=>{
    try{
      const payload=buildPayload(false);
      // localStorage desactivado — solo Firebase
      // Sync Firebase — siempre en sesión 'principal'
      if(window._fbReady){
        if(!_fbSesionActiva) _fbSesionActiva = 'principal';
        window.fbGuardarSesion(_fbSesionActiva, payload).then(res=>{
          if(res && res.ok) console.log('✓ Auto-sync Firebase:', _fbSesionActiva);
          else console.warn('Auto-sync Firebase error:', res && res.message);
        });
      }
    }catch(e){ console.warn('autoGuardar error:', e); }
  },1500); // 1.5s debounce para no saturar Firestore
}
// Guardado manual — botón elegante arriba
let _fbSesionActiva = null; // nombre de la sesión Firebase activa
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
let temporadas = [];
let temporadaActual = null;   // id de la temporada activa
function cargarTemporadas(){
  // localStorage desactivado — temporadas vienen de Firebase
  temporadas = [];
  temporadaActual = null;
}
function guardarTemporadas(){
  // localStorage desactivado
}
// Calcular nombre siguiente temporada: "2025-26" → "2026-27"
function siguienteNombreTemporada(actual){
  const m = actual.match(/(\d{4})[-–](\d{2,4})/);
  if(!m) return actual;
  const ini = parseInt(m[1]);
  return (ini+1)+'-'+(String(ini+2).slice(-2));
}
function actualizarBadgeTemporada(){
  const t = temporadas.find(t=>t.id===temporadaActual);
  const lbl = document.getElementById('season-label');
  if(lbl) lbl.textContent = t ? t.nombre : '2026-27';
}
// ── Modal de selección ──
function abrirSeasonModal(){
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
    }
    list.appendChild(row);
  });
  if(!temporadas.length){
    list.innerHTML = '<div style="padding:16px 20px;font-family:Segoe UI,sans-serif;font-size:12px;color:#9ca3af;">Sin temporadas guardadas aún</div>';
  }
  document.getElementById('season-modal').classList.add('open');
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
  if(p.fechas) FECHAS = p.fechas;
  if(p.ts){ _lastManualTS=p.ts; updateSaveTS('Guardado '+fmtTS(new Date(p.ts))); }
  guardarTemporadas();
  actualizarBadgeTemporada();
  render();
  document.getElementById('season-modal').classList.remove('open');
  toast('✅ Temporada '+t.nombre+' cargada');
}
// ── Nueva temporada con ascenso ──
let _pendingAscenso = null;
function nuevaTemporada(){
  document.getElementById('season-modal').classList.remove('open');
  // Calcular nombre sugerido
  const actual = temporadas.find(t=>t.id===temporadaActual);
  const nombreActual = actual ? actual.nombre : '2026-27';
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
  temporadaActual = '2026_27';
  temporadas = [{ id:'2026_27', nombre:'2026-27', payload:{}, ts:Date.now() }];
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
      if(!colNames[eq]) colNames[eq]=['PROMOCIÓN','LESIÓN','OTROS'];
      if(colNames[eq][0]==='1ER EQUIPO') colNames[eq][0]='PROMOCIÓN'; // normalizar datos viejos
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
  rows.push(['CAMPO ('+equipoData.campo.length+')','','BANQUILLO','','DISPONIBLES','','PROMOVIDO','LESIÓN','OTROS']);
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
  const colN       = colNames[eq] || ['PROMOCIÓN','LESIÓN','OTROS','EXTRA'];
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
    secciones.push({ label: esCas ? '1ER EQUIPO' : (colN[0]||'PROMOCIÓN'), items: proms, color: '#a78bfa', destinos: promoInfoEq });
  }
  if(lesion.length){
    secciones.push({ label: colN[1]||'LESIÓN', items: lesion, color: '#f87171' });
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
function render(){
  renderDias(); renderEqs(); renderCards();
  autoGuardar();
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
    const tab = mk('div','dia-tab'+(d===dia?' active':'')+(tieneDatos?' tiene-datos':'')+(esP?' es-partido':''));
    tab.setAttribute('role','tab');
    const f = FECHAS[d] || '';
    const [numDia] = f.split('/');
    tab.innerHTML=`
      <span class="dia-tab-nombre">${d.slice(0,3)}</span>
      <span class="dia-tab-fecha">${numDia||''}</span>
      <span class="dia-tab-dot"></span>`;
    tab.onclick=()=>{dia=d;renderDias();renderCards();};
    strip.appendChild(tab);
  });
}
// ══════════════════════════════════════════════════
// CALENDARIO MINI
// ══════════════════════════════════════════════════
let _calFecha = new Date(); // mes visible en el calendario
let _calLunesSel = null;    // lunes seleccionado
const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
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
  FECHAS = calcFechasSemana(_calLunesSel);
  autoGuardar();
  renderDias();
  renderCards();
  cerrarCal();
  toast('📅 Semana actualizada');
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
  ['TODOS',...EQUIPOS].forEach(e=>{
    const b=mk('div','eq-tab'+(e===eqF?' active':''));
    b.textContent=EQ_LABEL[e]||e;
    b.onclick=()=>{eqF=e;renderEqs();renderCards();};
    w.appendChild(b);
  });
  const b1=mk('div','eq-tab eq-primer'+(eqF==='1ER EQUIPO'?' active':''));
  b1.textContent='1ER EQ';
  b1.title='Ver jugadores con Primer Equipo';
  b1.onclick=()=>{eqF='1ER EQUIPO';renderEqs();renderCards();};
  w.appendChild(b1);
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
  if(vistaActual==='semana') requestAnimationFrame(()=>igualarZonasSemana(document.getElementById('grid')));
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

function buildListaView(eq, d){
  const diaKey = d || dia;
  const eqData = data[diaKey][eq] || {};
  const wrap = mk('div','card-lista-wrap');

  const zonas = [
    { key:'campo',          label:'LISTADO DE JUGADORES',  color:'#2563eb' },
    { key:'banquillo',      label:'BANQUILLO',     color:'#d97706' },
    { key:'promovidos_1er', label: colNames[eq]?.[0]||'PROMOCIÓN', color:'#d97706' },
    { key:'lesionados',     label: colNames[eq]?.[1]||'LESIÓN',    color:'#dc2626' },
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
    let texto = eq + ' - ' + diaKey + ' ' + (FECHAS[diaKey]||'') + '\n';
    texto += '='.repeat(30) + '\n';
    zonas.forEach(({key, label}) => {
      const jugs = eqData[key] || [];
      if(!jugs.length) return;
      texto += '\n' + label + ':\n';
      jugs.forEach(n => { texto += '  - ' + n + '\n'; });
    });
    navigator.clipboard.writeText(texto).then(()=>toast('✓ Copiado al portapapeles')).catch(()=>toast('❌ Error al copiar'));
  };
  acciones.appendChild(btnCopiar);

  // Botón foto/imprimir
  const btnFoto = mk('button','card-lista-btn');
  btnFoto.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg> Foto';
  btnFoto.onclick = (e) => {
    e.stopPropagation();
    capturarLista(eq, diaKey, zonas, eqData);
  };
  acciones.appendChild(btnFoto);
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


// ══════════════════════════════════════════════════
// FILTROS VISTA SEMANA — días y equipos visibles
// ══════════════════════════════════════════════════
let _filtroDiasActivos = new Set(DIAS);
let _filtroEqsActivos = new Set(EQUIPOS);

function renderFiltrosSemana(){
  const diasRow = document.getElementById('filtro-dias-row');
  const eqsRow = document.getElementById('filtro-eqs-row');
  if(!diasRow || !eqsRow) return;

  const DIA_INICIAL = {'LUNES':'L','MARTES':'M','MIÉRCOLES':'X','JUEVES':'J','VIERNES':'V','SÁBADO':'S','DOMINGO':'D'};

  diasRow.innerHTML='';
  DIAS.forEach(d=>{
    const btn=mk('button','filtro-dia-btn'+(_filtroDiasActivos.has(d)?' activo':''));
    btn.textContent = DIA_INICIAL[d]||d[0];
    btn.title = d;
    btn.onclick=()=>{
      if(_filtroDiasActivos.has(d)) _filtroDiasActivos.delete(d);
      else _filtroDiasActivos.add(d);
      renderFiltrosSemana();
      renderCards();
      if(vistaActual==='semana') requestAnimationFrame(()=>igualarZonasSemana(document.getElementById('grid')));
    };
    diasRow.appendChild(btn);
  });

  eqsRow.innerHTML='';
  const EQ_CORTO = {'CASTILLA':'CAS','RMC':'RMC','JUVENIL A':'JA','JUVENIL B':'JB','JUVENIL C':'JC','CADETE A':'CA'};
  EQUIPOS.forEach(eq=>{
    const btn=mk('button','filtro-eq-btn'+(_filtroEqsActivos.has(eq)?' activo':''));
    btn.textContent = EQ_CORTO[eq]||eq;
    btn.title = eq;
    btn.onclick=()=>{
      if(_filtroEqsActivos.has(eq)) _filtroEqsActivos.delete(eq);
      else _filtroEqsActivos.add(eq);
      renderFiltrosSemana();
      renderCards();
      if(vistaActual==='semana') requestAnimationFrame(()=>igualarZonasSemana(document.getElementById('grid')));
    };
    eqsRow.appendChild(btn);
  });
}

function renderCardsSemana(grid){
  const hoy = new Date();
  let lista = eqF==='TODOS' ? EQUIPOS : [eqF];
  lista = lista.filter(eq => _filtroEqsActivos.has(eq));
  const diasFiltrados = DIAS.filter(d => _filtroDiasActivos.has(d));

  const table = document.createElement('table');
  table.className = 'semana-table';

  // SIN thead — el día/fecha va en el header de cada card
  const tbody = document.createElement('tbody');

  lista.forEach(eq => {
    const tr = document.createElement('tr');
    tr.className = 'semana-tr-eq';

    diasFiltrados.forEach(d => {
      const fechaStr = FECHAS[d] || '';
      const esHoy = (()=>{
        const [dd,mm] = (fechaStr||'').split('/');
        return dd && mm && parseInt(dd)===hoy.getDate() && parseInt(mm)===(hoy.getMonth()+1);
      })();
      const [dd2,mm2] = (fechaStr||'').split('/');
      const aaStr = String(hoy.getFullYear()).slice(2);
      const fechaFmt = dd2 && mm2 ? dd2.padStart(2,'0')+'/'+mm2.padStart(2,'0')+'/'+aaStr : d;

      const diaOrig = dia;
      dia = d;
      const card = buildCard(eq);
      dia = diaOrig;

      // Sustituir el card-hdr-name con: EQUIPO (negrita) + DIA DD/MM/AA (debajo, normal)
      const nm = card.querySelector('.card-hdr-name');
      if(nm){
        const nombreHtml = nm.innerHTML;
        nm.innerHTML = '';

        const nombreSpan = document.createElement('span');
        nombreSpan.className = 'card-hdr-nombre-txt';
        nombreSpan.innerHTML = nombreHtml;
        nm.appendChild(nombreSpan);

        const fechaSpan = document.createElement('span');
        fechaSpan.className = 'card-hdr-fecha';
        fechaSpan.textContent = d + '  ' + fechaFmt;
        if(esHoy) fechaSpan.className = 'card-hdr-fecha card-hdr-fecha-hoy';
        nm.appendChild(fechaSpan);
      }
      if(esHoy){
        const hdrEl = card.querySelector('.card-hdr');
        if(hdrEl) hdrEl.classList.add('card-hdr-hoy');
      }

      const td = document.createElement('td');
      td.className = 'semana-td-card';
      td.appendChild(card);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  grid.appendChild(table);
}
function buildCard(eq){
  const d=data[dia][eq];
  const card=mk('div','card');
  card.dataset.eqCard=eq;
  // Header
  const hdr=mk('div','card-hdr');
  const nm=mk('div','card-hdr-name');
  nm.id='count-'+eq.replace(/ /g,'_');
  const countTxt = d.campo.length ? countLabel(eq,d.campo) : '';
  nm.innerHTML = (EQ_LABEL[eq]||eq) + (countTxt ? `<span style="margin-left:8px;font-size:12px;color:rgba(255,255,255,.45);font-weight:700;">${countTxt}</span>` : '');
  hdr.appendChild(nm);
  const right=mk('div','card-hdr-right');
  // Botón descanso
  const _diaModo = dia; // capturar el día de ESTA card en el closure
  const descBtn=mk('button','modo-btn'+(esDescanso(eq,_diaModo)?' descanso':''));
  descBtn.textContent=esDescanso(eq,_diaModo)?'💤 DESCANSA':'💤';
  descBtn.title='Marcar día de descanso';
  descBtn.onclick=(e)=>{ e.stopPropagation(); toggleDescanso(eq,_diaModo); };
  right.appendChild(descBtn);
  const modoB=mk('button','modo-btn'+(esPartido(eq,_diaModo)?' partido':'')+(esDescanso(eq,_diaModo)?' hidden-btn':''));
  modoB.textContent=esPartido(eq,_diaModo)?'⚽ PARTIDO':'🏋️ ENTRENO';
  modoB.style.display = esDescanso(eq,_diaModo) ? 'none' : '';
  modoB.onclick=(e)=>{e.stopPropagation();togglePartido(eq,_diaModo);};
  right.appendChild(modoB);
  // Botón YL — solo Juvenil A: activa/desactiva modo Youth League en disponibles
  if(eq==='JUVENIL A'){
    const _esPartidoJA = esPartido('JUVENIL A');
    const _diaUYL = dia;
    const uylBtn=mk('button','modo-btn uyl'+(esUYL(_diaUYL)&&!_esPartidoJA?' active':''));
    uylBtn.textContent='YL';
    uylBtn.title = _esPartidoJA ? 'No disponible en modo partido' : (esUYL(_diaUYL) ? 'Youth League activa — clic para desactivar' : 'Activar Youth League');
    uylBtn.style.opacity = _esPartidoJA ? '0.6' : '';
    if(_esPartidoJA) uylBtn.classList.add('uyl-disabled');
    uylBtn.style.cursor  = _esPartidoJA ? 'default' : '';
    uylBtn.onclick=(e)=>{e.stopPropagation();toggleUYL(_diaUYL);};
    right.appendChild(uylBtn);
  }
  // Botón resetear equipo
  const resetBtn=mk('button','reset-btn');
  resetBtn.innerHTML='↺';
  resetBtn.title='Resetear equipo';
  resetBtn.onclick=(e)=>{ e.stopPropagation(); abrirResetModal(eq); };
  right.appendChild(resetBtn);
  const listaBtn=mk('button','snap-btn');
  listaBtn.textContent='📋';
  listaBtn.title='Foto de la lista de jugadores';
  listaBtn.style.cssText='padding:3px 6px;font-size:13px;';
  listaBtn.onclick=(e)=>{
    e.stopPropagation();
    try{
      generarFotoLista(eq);
    }catch(err){
      const msg = '❌ '+(err&&err.message?err.message:String(err));
      if(typeof toast==='function') toast(msg);
      alert('Error al generar foto de lista:\n\n'+msg+'\n\nStack:\n'+(err&&err.stack?err.stack.slice(0,500):''));
      console.error('generarFotoLista error:', err);
    }
  };
  right.appendChild(listaBtn);
  // Botón vista lista individual
  const listaBtn2=mk('button','snap-btn');
  listaBtn2.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>';
  listaBtn2.title='Vista lista';
  listaBtn2.style.cssText='padding:4px 6px;display:flex;align-items:center;justify-content:center;';
  const _diaLista = dia;
  if(esVistaLista(eq,dia)) listaBtn2.style.color='#2563eb';
  listaBtn2.onclick=(e)=>{e.stopPropagation();toggleVistaListaCard(eq,_diaLista);};
  right.appendChild(listaBtn2);

  const camBtn=mk('button','snap-btn');
  camBtn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>';
  camBtn.title='Capturar imagen del campo';
  camBtn.style.cssText='padding:4px 6px;display:flex;align-items:center;justify-content:center;';
  const _diaFoto = dia;
  camBtn.onclick=(e)=>{e.stopPropagation();capturarCampo(eq,card,_diaFoto);};
  right.appendChild(camBtn);
  hdr.appendChild(right);
  card.appendChild(hdr);
  // Banner partido: selector tipo + rival
  if(esPartido(eq)){
    const banner=mk('div','partido-banner');
    const rivalVal = rivales[dia]?.[eq] || '';
    const sugerido = sugerirRival(eq);
    banner.innerHTML=`
      <span class="partido-lbl">⚽ PARTIDO</span>
      <input class="rival-inp" type="text" placeholder="${sugerido?'vs '+sugerido:'vs Rival...'}"
        value="${rivalVal}"
        oninput="guardarRival('${eq}',this.value)"
        onclick="event.stopPropagation()">`;
    card.appendChild(banner);
    // Selector tipo de partido — dinámico desde tiposConfig
    const tipoSel=mk('div','tipo-partido-sel');
    const tipos = tiposConfig[eq] || TIPOS_BASE;
    const tipoActual = tipoPartido[dia]?.[eq] || tipos[0]?.k || 'liga';
    tipos.forEach(({k,l,c,uyl})=>{
      const btn=mk('button','tipo-btn'+(tipoActual===k?' active':''));
      btn.textContent=l;
      if(tipoActual===k && c){
        btn.style.cssText=`color:${c};border-color:${c};background:${c}22;`;
      }
      btn.onclick=(e)=>{
        e.stopPropagation();
        if(!tipoPartido[dia]) tipoPartido[dia]={};
        tipoPartido[dia][eq]=k;
        if(uyl) modoUYL[dia]=true;
        else if(eq==='JUVENIL A') modoUYL[dia]=false;
        autoGuardar();
        renderCards();
      };
      tipoSel.appendChild(btn);
    });
    // Botón ✏️ editar tipos de este equipo
    const editBtn=mk('button','tipo-btn');
    editBtn.textContent='⚙️';
    editBtn.title='Configurar tipos de partido';
    editBtn.style.cssText='color:rgba(255,255,255,.35);border-color:rgba(255,255,255,.12);margin-left:auto;';
    editBtn.onclick=(e)=>{ e.stopPropagation(); abrirConfigTipos(eq); };
    tipoSel.appendChild(editBtn);
    card.appendChild(tipoSel);
  }
  // Campo
  const cWrap=mk('div','campo-wrap dz');
  cWrap.dataset.eq=eq; cWrap.dataset.zona='campo';
  cWrap.innerHTML=`
    <svg class="campo-svg" viewBox="0 0 100 118" preserveAspectRatio="none">
      <rect x="2" y="2" width="96" height="114" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".8"/>
      <line x1="2" y1="59" x2="98" y2="59" stroke="rgba(255,255,255,.45)" stroke-width=".6"/>
      <rect x="26" y="2"   width="48" height="16" fill="none" stroke="rgba(255,255,255,.38)" stroke-width=".6"/>
      <rect x="38" y="2"   width="24" height="7"  fill="none" stroke="rgba(255,255,255,.28)" stroke-width=".5"/>
      <rect x="26" y="100" width="48" height="16" fill="none" stroke="rgba(255,255,255,.38)" stroke-width=".6"/>
      <rect x="38" y="109" width="24" height="7"  fill="none" stroke="rgba(255,255,255,.28)" stroke-width=".5"/>
    </svg>
    <svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;" viewBox="0 0 100 118" preserveAspectRatio="xMidYMid meet">
      <circle cx="50" cy="59" r="8.5" fill="none" stroke="rgba(255,255,255,.35)" stroke-width=".7"/>
      <circle cx="50" cy="59" r="1"   fill="rgba(255,255,255,.35)"/>
    </svg>
    <img class="campo-shield" src="data:image/png;base64,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" alt="RM"/>
    <div class="campo-players"></div>`;
  const pw=cWrap.querySelector('.campo-players');
  d.campo.slice(0,30).forEach((nombre,i)=>{
    const p=getPos(dia,eq,nombre,i);
    const pof=mk('div','pof');
    pof.style.top=p[0]+'%'; pof.style.left=p[1]+'%';
    pof.appendChild(chip(nombre,eq,'campo','c-verde','cf'));
    pw.appendChild(pof);
  });
  // Overlay DESCANSA
  if(esDescanso(eq)){
    const overlay=mk('div','campo-descanso-overlay');
    const txt=mk('div','campo-descanso-txt');
    txt.textContent='DESCANSA';
    overlay.appendChild(txt);
    cWrap.appendChild(overlay);
    card.classList.add('en-descanso');
  } else {
    card.classList.remove('en-descanso');
  }
  // Vista lista: reemplazar campo por listado de jugadores
  if(esVistaLista(eq, dia)){
    const lista = buildListaView(eq, dia);
    card.appendChild(lista);
  } else {
    card.appendChild(cWrap);
  }
  // Banquillo (solo en modo partido, justo debajo del campo)
  if(esPartido(eq)){
    const zBanq=mk('div','zona-banquillo dz');
    zBanq.dataset.eq=eq; zBanq.dataset.zona='banquillo';
    const lblB=mk('div','zona-lbl'); lblB.textContent='🔄 BANQUILLO';
    zBanq.appendChild(lblB);
    const cwB=mk('div','chips-wrap');
    d.banquillo.forEach(n=>cwB.appendChild(chip(n,eq,'banquillo','c-naranja','cz')));
    zBanq.appendChild(cwB);
    zBanq.appendChild(buildAddInput(eq,'banquillo'));
    card.appendChild(zBanq);
  }
  // Disponibles
  const zDisp=mk('div','zona-disponibles dz');
  zDisp.dataset.eq=eq; zDisp.dataset.zona='disponibles';
  const lblD=mk('div','zona-lbl'); lblD.textContent='DISPONIBLES ('+(d.disponibles||[]).length+')';
  zDisp.appendChild(lblD);
  const cwD=mk('div','chips-wrap');
  // En modo UYL (JA): mostrar SOLO la plantilla Youth League como disponibles
  if(eq==='JUVENIL A' && esUYL()){
    // Cambiar label
    // Contar los que no están en cancha en ningún equipo hoy
    const enCanchaTotal=new Set();
    EQUIPOS.forEach(eqX=>{ (data[dia][eqX].campo||[]).forEach(n=>enCanchaTotal.add(n)); (data[dia][eqX].banquillo||[]).forEach(n=>enCanchaTotal.add(n)); });
    lblD.textContent='PLANTILLA JA YOUTH ('+getPlantillaUYL().filter(n=>!enCanchaTotal.has(n)).length+')';
    lblD.style.color='#60b4ff';
    // Jugadores UYL no ya en campo/banquillo
    // Excluir los que ya están en campo/banquillo de cualquier equipo
    const enCancha=new Set();
    EQUIPOS.forEach(eqX=>{ (data[dia][eqX].campo||[]).forEach(n=>enCancha.add(n)); (data[dia][eqX].banquillo||[]).forEach(n=>enCancha.add(n)); });
    const uylDisp=getPlantillaUYL().filter(n=>!enCancha.has(n));
    uylDisp.forEach(n=>{
      const eqO=origen[n]||eq;
      // Color según equipo de origen (igual que chips prestados en otros campos)
      const colorCls = eqO===eq ? 'c-verde' : (EQ_COLORS[eqO]||'c-azul');
      const ch=chip(n,eqO,'disponibles',colorCls,'cz');
      ch.dataset.eq=eq; // siempre vuelve a JA al soltar
      // Badge equipo si es de otro equipo
      if(eqO && eqO!==eq){
        const eqsShort={'CASTILLA':'CAS','RMC':'RMC','JUVENIL A':'JA','JUVENIL B':'JB','JUVENIL C':'JC','CADETE A':'CA'};
        const eqTag=mk('span','chip-dest');
        eqTag.textContent=eqsShort[eqO]||eqO;
        ch.appendChild(eqTag);
      }
      cwD.appendChild(ch);
    });
  } else {
    // Modo normal: disponibles propios del equipo
    d.disponibles.forEach(n=>cwD.appendChild(chip(n,eq,'disponibles','c-verde','cz')));
  }
  zDisp.appendChild(cwD);
  zDisp.appendChild(buildAddInput(eq,'disponibles'));
  card.appendChild(zDisp);
  // Columnas estado
  if(!colNames[eq]) colNames[eq]=['PROMOCIÓN','LESIÓN','OTROS'];
  // Columnas estado
  if(!colNames[eq]) colNames[eq]=['PROMOCIÓN','LESIÓN','OTROS'];
  const promoInfo = promInfo[dia]?.[eq] || {};
  const esCas = eq==='CASTILLA';
  const eqsShort = {'CASTILLA':'CAS','RMC':'RMC','JUVENIL A':'JA','JUVENIL B':'JB','JUVENIL C':'JC','CADETE A':'CA'};
  const colDefs = [
    {zona:'promovidos_1er', cls:'col col-prom',  cc:'c-naranja', idx:0},
    {zona:'lesionados',     cls:'col col-les',   cc:'c-rojo',    idx:1},
    {zona:'otros',          cls:'col col-otros', cc:'c-gris',    idx:2},
  ];
  if(extraZonas[eq]) colDefs.push({zona:'extra', cls:'col col-extra', cc:'c-gris', idx:3});
  const numCols = colDefs.length;
  const cols=mk('div','cols-estado');
  cols.style.gridTemplateColumns = `repeat(${numCols},1fr)`;
  colDefs.forEach(({zona,cls,cc,idx})=>{
    if(!d[zona]) d[zona]=[];
    const col=mk('div',cls+' dz');
    col.dataset.eq=eq; col.dataset.zona=zona;
    // Label
    const lblWrap=mk('div','zona-lbl-wrap');
    const lbl=mk('input','zona-lbl-edit');
    lbl.type='text';
    lbl.value = colNames[eq][idx] || (zona==='extra'?'EXTRA':zona.toUpperCase());
    lbl.title='Pulsa para editar el nombre';
    lbl.onchange=()=>{
      if(!colNames[eq]) colNames[eq]=['PROMOCIÓN','LESIÓN','OTROS'];
      colNames[eq][idx]=lbl.value.trim().toUpperCase()||colNames[eq][idx];
      lbl.value=colNames[eq][idx];
      autoGuardar();
    };
    lbl.onkeydown=(e)=>{ if(e.key==='Enter'||e.key==='Escape') lbl.blur(); e.stopPropagation(); };
    lblWrap.appendChild(lbl);
    if(zona==='extra'){
      const delBtn=mk('button','col-del-btn');
      delBtn.textContent='×'; delBtn.title='Eliminar columna extra';
      delBtn.onclick=(e)=>{
        e.stopPropagation();
        if(!confirm('¿Eliminar esta columna? Los jugadores volverán a disponibles.')) return;
        // Devolver jugadores de la zona extra a disponibles
        DIAS.forEach(d=>{
          const extras = [...(data[d][eq].extra||[])];
          extras.forEach(n=>{
            if(!data[d][eq].disponibles.includes(n)) data[d][eq].disponibles.push(n);
          });
          data[d][eq].extra=[];
        });
        extraZonas[eq]=false;
        autoGuardar();
        render();
      };
      lblWrap.appendChild(delBtn);
    }
    if(idx===2 && !extraZonas[eq]){
      const addBtn=mk('button','col-add-btn');
      addBtn.textContent='+'; addBtn.title='Añadir 4ª columna';
      addBtn.onclick=(e)=>{ e.stopPropagation(); extraZonas[eq]=true;
        if(!colNames[eq][3]) colNames[eq][3]='EXTRA'; render(); };
      lblWrap.appendChild(addBtn);
    }
    col.appendChild(lblWrap);
    const cw=mk('div','chips-wrap');
    d[zona].forEach(n=>{
      const c=chip(n,eq,zona,cc,'cz');
      // Promoción: mostrar destino en el chip
      if(zona==='promovidos_1er'){
        const dest = promoInfo[n] || '';
        const destLbl = dest==='1ER EQUIPO' ? '1ER' : dest ? (eqsShort[dest]||dest) : '';
        const origLbl = eqsShort[eq]||eq;
        if(destLbl){
          const s=document.createElement('span');
          s.className='chip-dest';
          s.textContent=' →'+destLbl;
          s.title = n + ' — de ' + eq + ' al ' + (dest==='1ER EQUIPO'?'Primer Equipo':dest);
          c.appendChild(s);
        }
      }
      cw.appendChild(c);
    });
    col.appendChild(cw);
    cols.appendChild(col);
  });
  card.appendChild(cols);

  // Bloque de notas debajo de las columnas
  const notasKey = eq + '_' + dia + '_notas';
  const notasWrap = mk('div', 'card-notas-wrap');
  const notasTA = mk('textarea', 'card-notas-input');
  notasTA.placeholder = '📝 Notas del día...';
  notasTA.rows = 2;
  // Cargar notas guardadas
  if(!window._notasData) window._notasData = {};
  notasTA.value = window._notasData[notasKey] || '';
  notasTA.oninput = () => {
    window._notasData[notasKey] = notasTA.value;
    autoGuardar();
  };
  notasTA.onkeydown = e => e.stopPropagation();
  notasWrap.appendChild(notasTA);
  card.appendChild(notasWrap);

  return card;
}
// Formatea nombre en 2 líneas para chips de campo (cf)
// Nombre propio arriba, apellido(s) abajo, mismo ancho
function chipHTML(nombre, isCampo){
  if(!isCampo) return nombre; // zona: texto simple
  const partes = nombre.trim().split(/\s+/);
  if(partes.length < 2) return `<span class="chip-n1 chip-solo">${nombre}</span>`;
  const n1 = partes[0];
  const n2 = partes.slice(1).join(' ');
  return `<span class="chip-n1">${n1}</span><span class="chip-n2">${n2}</span>`;
}
function chip(nombre,eq,zona,color,type){
  const eqO=origen[nombre];
  const prueba   = eqO === 'PRUEBA';
  const prestado = !prueba && eqO && eqO!==eq;
  let cf = prueba ? 'c-prueba' : (prestado ? (EQ_COLORS[eqO]||'c-prestado') : color);
  const multi = esMulti(nombre);
  const isCampo = type === 'cf';
  const c=mk('div',`chip ${cf} ${multi?'c-multi':''} ${type}${isCampo?' chip-2l':''}`);
  c.innerHTML=chipHTML(nombre, isCampo);
  c.dataset.eq=eq; c.dataset.zona=zona; c.dataset.nombre=nombre;
  if(prueba) c.title='Jugador a prueba';
  else if(multi){
    const eqs = eqsDeNombre(dia,nombre).join(', ');
    c.title='En varios equipos hoy: '+eqs;
  }
  else if(prestado) c.title='Viene de '+eqO;
  return c;
}
const EQ_COLORS={
  'CASTILLA':'c-prestado-CASTILLA',
  'RMC':'c-prestado-RMC',
  'JUVENIL A':'c-prestado-JUVENIL_A',
  'JUVENIL B':'c-prestado-JUVENIL_B',
  'JUVENIL C':'c-prestado-JUVENIL_C',
  'CADETE A':'c-prestado-CADETE_A'
};
function mk(tag,cls=''){const e=document.createElement(tag);if(cls)e.className=cls;return e;}
// ── Auto-promoción: mover jugador al equipo destino y registrar en origen
function autoPromocionar(nombre, eqOrigen, eqDestino){
  if(!eqOrigen || eqOrigen===eqDestino || eqOrigen==='PRUEBA') return;
  // Quitar de todas las zonas activas del equipo origen
  ZONAS_ACTIVAS.forEach(z=>{
    const arr = data[dia][eqOrigen]?.[z] || [];
    const i = arr.indexOf(nombre);
    if(i>=0) arr.splice(i,1);
  });
  // Añadir a promovidos_1er del equipo origen
  if(!data[dia][eqOrigen].promovidos_1er) data[dia][eqOrigen].promovidos_1er=[];
  if(!data[dia][eqOrigen].promovidos_1er.includes(nombre)){
    data[dia][eqOrigen].promovidos_1er.push(nombre);
  }
  // Registrar en promInfo
  if(!promInfo[dia]) promInfo[dia]={};
  if(!promInfo[dia][eqOrigen]) promInfo[dia][eqOrigen]={};
  promInfo[dia][eqOrigen][nombre] = eqDestino;
}
// ── Multi-equipo helpers
function registrarMultiEq(d, nombre, eq){
  if(!multiEq[d]) multiEq[d]={};
  if(!multiEq[d][nombre]) multiEq[d][nombre]=[];
  if(!multiEq[d][nombre].includes(eq)) multiEq[d][nombre].push(eq);
}
function borrarMultiEq(d, nombre, eq){
  if(!multiEq[d]?.[nombre]) return;
  multiEq[d][nombre] = multiEq[d][nombre].filter(e=>e!==eq);
  if(multiEq[d][nombre].length<=1) delete multiEq[d][nombre];
}
// Zonas que cuentan como "presencia activa" en un equipo (excluye promovidos_1er)
const ZONAS_ACTIVAS = ['campo','banquillo','disponibles','lesionados','otros','extra'];
function eqsDeNombre(d, nombre){
  // Equipos donde el jugador tiene presencia ACTIVA hoy (no como promovido)
  return EQUIPOS.filter(eq=>
    ZONAS_ACTIVAS.some(z=>(data[d]?.[eq]?.[z]||[]).includes(nombre))
  );
}
function esMulti(nombre){
  return eqsDeNombre(dia, nombre).length > 1;
}
// ── Resetear equipo: todos los jugadores del equipo a disponibles ──
function resetearEquipo(eq){
  // Jugadores propios del equipo (origen === eq)
  const propios = Object.keys(origen).filter(n => origen[n] === eq);
  // 1. Limpiar todas las zonas del equipo HOY
  ZONAS_ACTIVAS.forEach(z => {
    if(data[dia][eq]?.[z]) data[dia][eq][z] = [];
  });
  if(data[dia][eq]?.promovidos_1er) data[dia][eq].promovidos_1er = [];
  if(data[dia][eq]?.banquillo)      data[dia][eq].banquillo      = [];
  // 2. Limpiar posiciones de campo de jugadores propios
  propios.forEach(n => delete pos[key(dia, eq, n)]);
  // 3. Limpiar promInfo del equipo
  if(promInfo[dia]?.[eq]) promInfo[dia][eq] = {};
  // 4. Limpiar multiEq de jugadores propios
  propios.forEach(n => {
    if(multiEq[dia]?.[n]){
      multiEq[dia][n] = multiEq[dia][n].filter(e => e !== eq);
      if(multiEq[dia][n].length <= 1) delete multiEq[dia][n];
    }
  });
  // 5. Quitar jugadores propios de otros equipos donde estuvieran prestados
  EQUIPOS.forEach(otroEq => {
    if(otroEq === eq) return;
    ZONAS_ACTIVAS.forEach(z => {
      const arr = data[dia][otroEq]?.[z];
      if(!arr) return;
      propios.forEach(n => {
        const i = arr.indexOf(n);
        if(i >= 0){
          arr.splice(i, 1);
          delete pos[key(dia, otroEq, n)];
        }
      });
    });
    // Limpiar promovidos en otros equipos
    const prom = data[dia][otroEq]?.promovidos_1er;
    if(prom) propios.forEach(n => {
      const i = prom.indexOf(n); if(i >= 0) prom.splice(i, 1);
    });
    if(promInfo[dia]?.[otroEq]) propios.forEach(n => delete promInfo[dia][otroEq][n]);
  });
  // 6. Todos los jugadores propios → disponibles de su equipo
  data[dia][eq].disponibles = [...propios];
  autoGuardar();
  render();
  toast(`↺ ${eq} reseteado — ${propios.length} jugadores en disponibles`);
}
// ══════════════════════════════════════════════════
// RESET GLOBAL — varios equipos a la vez
// ══════════════════════════════════════════════════
function abrirResetGlobal(){
  const container = document.getElementById('reset-global-checks');
  container.innerHTML = '';
  EQUIPOS.forEach(eq=>{
    const enCampo = (data[dia][eq]?.campo||[]).length;
    const propios = Object.keys(origen).filter(n=>origen[n]===eq).length;
    const row = document.createElement('label');
    row.style.cssText='display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.04);cursor:pointer;border:1px solid rgba(255,255,255,.07);';
    const cb = document.createElement('input');
    cb.type='checkbox'; cb.dataset.eq=eq;
    cb.style.cssText='width:16px;height:16px;accent-color:#ef4444;cursor:pointer;flex-shrink:0;';
    const info = document.createElement('div');
    info.style.cssText='display:flex;flex-direction:column;gap:1px;flex:1;';
    const name = document.createElement('span');
    name.style.cssText='font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:14px;color:#fff;letter-spacing:.3px;';
    name.textContent=eq;
    const desc = document.createElement('span');
    desc.style.cssText='font-size:11px;color:rgba(255,255,255,.4);font-family:"Barlow Condensed",sans-serif;';
    desc.textContent=enCampo+' en campo · '+propios+' en plantilla';
    info.appendChild(name); info.appendChild(desc);
    row.appendChild(cb); row.appendChild(info);
    container.appendChild(row);
  });
  document.getElementById('reset-global-overlay').style.display='flex';
}
function cerrarResetGlobal(e){
  if(!e || e.target===document.getElementById('reset-global-overlay'))
    document.getElementById('reset-global-overlay').style.display='none';
}
function resetGlobalSelAll(){
  document.querySelectorAll('#reset-global-checks input[type=checkbox]').forEach(cb=>cb.checked=true);
}
function resetGlobalNone(){
  document.querySelectorAll('#reset-global-checks input[type=checkbox]').forEach(cb=>cb.checked=false);
}
function ejecutarResetGlobal(){
  const seleccionados = [...document.querySelectorAll('#reset-global-checks input[type=checkbox]')]
    .filter(cb=>cb.checked).map(cb=>cb.dataset.eq);
  if(!seleccionados.length){ toast('⚠️ Selecciona al menos un equipo'); return; }
  cerrarResetGlobal();
  seleccionados.forEach(eq=>resetearEquipo(eq));
  toast('↺ '+seleccionados.length+' equipo(s) reseteado(s)');
}
// ══════════════════════════════════════════════════
// ── Dropdown autocomplete para JA Youth en modal plantillas ──
function filtrarUYLDrop(){
  if(plantEqActivo !== 'JA_YOUTH'){ cerrarUYLDrop(); return; }
  const drop = document.getElementById('plant-uyl-dropdown');
  const q = document.getElementById('plant-add-input').value.trim().toLowerCase();
  drop.innerHTML = '';
  const candidatos = Object.keys(origen)
    .filter(n => origen[n] !== 'JUVENIL A' && origen[n] !== 'PRUEBA' && !listaUYL.includes(n))
    .filter(n => !q || n.toLowerCase().includes(q))
    .sort((a,b)=>a.localeCompare(b,'es'));
  if(!candidatos.length){ cerrarUYLDrop(); return; }
  const grupos = {};
  candidatos.forEach(n=>{ const eq=origen[n]||'?'; if(!grupos[eq]) grupos[eq]=[]; grupos[eq].push(n); });
  const ordenEqs = EQUIPOS.filter(e=>e!=='JUVENIL A' && grupos[e]);
  let selIdx = -1;
  const items = [];
  ordenEqs.forEach(eq=>{
    const hdr = mk('div','puyl-group-hdr'); hdr.textContent=eq; drop.appendChild(hdr);
    grupos[eq].forEach(nombre=>{
      const it = mk('div','puyl-item'); it.textContent=nombre;
      it.onmousedown=(e)=>{ e.preventDefault(); elegirUYL(nombre); };
      drop.appendChild(it); items.push(it);
    });
  });
  const inp = document.getElementById('plant-add-input');
  inp.onkeydown = (e)=>{
    if(e.key==='ArrowDown'){ e.preventDefault(); selIdx=Math.min(selIdx+1,items.length-1); items.forEach((it,i)=>it.classList.toggle('sel',i===selIdx)); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); selIdx=Math.max(selIdx-1,0); items.forEach((it,i)=>it.classList.toggle('sel',i===selIdx)); }
    else if(e.key==='Enter'){ e.preventDefault(); if(selIdx>=0&&items[selIdx]) items[selIdx].onmousedown(e); else plantAñadir(); }
    else if(e.key==='Escape'){ cerrarUYLDrop(); }
  };
  drop.classList.add('open');
}
function cerrarUYLDrop(){ const d=document.getElementById('plant-uyl-dropdown'); if(d) d.classList.remove('open'); }
function elegirUYL(nombre){
  if(listaUYL.includes(nombre)){ toast('⚠️ '+nombre+' ya está en JA Youth'); return; }
  listaUYL.push(nombre);
  listaUYL.sort((a,b)=>a.localeCompare(b,'es'));
  document.getElementById('plant-add-input').value='';
  cerrarUYLDrop();
  renderPlantTabs(); renderPlantBody(); autoGuardar();
  toast('✅ '+nombre+' añadido a JA Youth');
}
// MODAL RESET EQUIPO
// ══════════════════════════════════════════════════
let _resetEq = null;
function abrirResetModal(eq){
  _resetEq = eq;
  document.getElementById('reset-modal-title').textContent = 'Resetear ' + eq;
  document.getElementById('reset-modal-sub').textContent = eq + ' — ' + dia;
  // Contar jugadores en campo para contexto
  const enCampo = data[dia][eq]?.campo?.length || 0;
  const propios = Object.keys(origen).filter(n=>origen[n]===eq).length;
  document.querySelector('.reset-opt-campo .reset-opt-desc').textContent =
    `${enCampo} jugadores del campo vuelven a disponibles. Lesiones, promociones y otros se mantienen.`;
  document.querySelector('.reset-opt-todo .reset-opt-desc').textContent =
    `Los ${propios} jugadores del equipo (campo, lesiones, promociones…) vuelven todos a disponibles.`;
  document.getElementById('reset-opt-campo').onclick = ()=>{
    cerrarResetModal();
    resetearSoloCampo(_resetEq);
  };
  document.getElementById('reset-opt-todo').onclick = ()=>{
    cerrarResetModal();
    resetearEquipo(_resetEq);
  };
  document.getElementById('reset-modal-overlay').classList.add('open');
}
function cerrarResetModal(e){
  if(!e || e.target===document.getElementById('reset-modal-overlay'))
    document.getElementById('reset-modal-overlay').classList.remove('open');
}
function resetearSoloCampo(eq){
  const propios = Object.keys(origen).filter(n => origen[n] === eq);
  const enCampo = [...(data[dia][eq]?.campo || [])];
  // Quitar del campo
  data[dia][eq].campo = [];
  // Limpiar posiciones
  enCampo.forEach(n => delete pos[key(dia, eq, n)]);
  // Quitar también de campos de otros equipos donde estuvieran prestados
  EQUIPOS.forEach(otroEq => {
    if(otroEq === eq) return;
    const arr = data[dia][otroEq]?.campo;
    if(!arr) return;
    enCampo.filter(n=>origen[n]===eq).forEach(n=>{
      const i = arr.indexOf(n); if(i>=0){ arr.splice(i,1); delete pos[key(dia,otroEq,n)]; }
    });
  });
  // Volver a disponibles del propio equipo (solo los que no están ya en otra zona)
  enCampo.forEach(n=>{
    const eqPropio = origen[n] || eq;
    if(eqPropio !== eq) return; // prestado — lo dejamos en su equipo
    const enOtraZona = ['banquillo','lesionados','promovidos_1er','otros','extra']
      .some(z=>(data[dia][eq]?.[z]||[]).includes(n));
    const disp = data[dia][eq].disponibles;
    if(!enOtraZona && !disp.includes(n)) disp.push(n);
  });
  // Limpiar multiEq del campo
  enCampo.forEach(n=>{
    if(multiEq[dia]?.[n]){
      multiEq[dia][n] = multiEq[dia][n].filter(e=>e!==eq);
      if(multiEq[dia][n].length<=1) delete multiEq[dia][n];
    }
  });
  autoGuardar();
  render();
  toast(`⬜ Campo de ${eq} reseteado — ${enCampo.length} jugadores a disponibles`);
}
// ── Toggle modo partido/entrenamiento
function togglePartido(eq, diaParam){
  const d = diaParam || dia;
  if(!modoPartido[d]) modoPartido[d]={};
  modoPartido[d][eq] = !modoPartido[d][eq];
  autoGuardar();
  renderCards();
  if(vistaActual==='semana') requestAnimationFrame(()=>igualarZonasSemana(document.getElementById('grid')));
}
function esPartido(eq, diaParam){
  const d = diaParam || dia;
  return !!(modoPartido[d]?.[eq]);
}
function esDescanso(eq, diaParam){
  const d = diaParam || dia;
  return !!(modoDescanso[d]?.[eq]);
}
function toggleDescanso(eq, diaParam){
  const diaT = diaParam || dia;
  if(!modoDescanso[diaT]) modoDescanso[diaT]={};
  const estabaEnDescanso = !!modoDescanso[diaT][eq];
  modoDescanso[diaT][eq] = !estabaEnDescanso;
  // Si activa descanso, desactivar partido y VACIAR el campo
  if(modoDescanso[diaT][eq]){
    if(modoPartido[diaT]?.[eq]) modoPartido[diaT][eq]=false;
    // BUG 3: mover jugadores del campo y banquillo → disponibles
    const dd = data[diaT]?.[eq];
    if(dd){
      if(!Array.isArray(dd.disponibles)) dd.disponibles = [];
      const mover = (arr)=>{
        if(!Array.isArray(arr)) return;
        arr.forEach(n=>{
          if(!dd.disponibles.includes(n)) dd.disponibles.push(n);
        });
        arr.length = 0;
      };
      mover(dd.campo);
      mover(dd.banquillo);
    }
  }
  autoGuardar(); renderCards();
  if(vistaActual==='semana') requestAnimationFrame(()=>igualarZonasSemana(document.getElementById('grid')));
}
// ══════════════════════════════════════════════════
// CONFIG TIPOS DE PARTIDO
// ══════════════════════════════════════════════════
let _cfgEqActivo = null;
function abrirConfigTipos(eq){
  _cfgEqActivo = eq || EQUIPOS[0];
  renderCfgEqStrip();
  renderCfgTiposList();
  document.getElementById('cfg-tipos-modal').classList.add('open');
}
function cerrarConfigTipos(e){
  if(!e || e.target===document.getElementById('cfg-tipos-modal'))
    document.getElementById('cfg-tipos-modal').classList.remove('open');
  autoGuardar();
  renderCards();
}
function renderCfgEqStrip(){
  const strip=document.getElementById('cfg-tipos-eq-strip');
  strip.innerHTML='';
  EQUIPOS.forEach(eq=>{
    const btn=mk('button','cfg-eq-btn'+(eq===_cfgEqActivo?' active':''));
    btn.textContent=eq;
    btn.onclick=()=>{ _cfgEqActivo=eq; renderCfgEqStrip(); renderCfgTiposList(); };
    strip.appendChild(btn);
  });
}
function renderCfgTiposList(){
  const list=document.getElementById('cfg-tipos-list');
  list.innerHTML='';
  const tipos=tiposConfig[_cfgEqActivo]||[];
  tipos.forEach((t,i)=>{
    const row=mk('div','cfg-tipo-row');
    row.innerHTML=`
      <div class="cfg-tipo-color" style="background:${t.c||'#6b7280'}"></div>
      <span class="cfg-tipo-label">${t.l}</span>
      <button class="cfg-tipo-del" onclick="delTipoConfig(${i})" title="Eliminar">×</button>`;
    // Drag handle para reordenar (simple: up/down)
    if(i>0){
      const up=mk('button','cfg-tipo-del');
      up.textContent='↑'; up.title='Subir';
      up.onclick=()=>{
        const a=tipos[i-1]; tipos[i-1]=tipos[i]; tipos[i]=a;
        renderCfgTiposList();
      };
      row.insertBefore(up, row.lastChild);
    }
    list.appendChild(row);
  });
  if(!tipos.length){
    list.innerHTML='<div style="padding:16px;font-family:Barlow Condensed,sans-serif;font-size:11px;color:rgba(255,255,255,.3);text-align:center;text-transform:uppercase;">Sin tipos — añade uno abajo</div>';
  }
}
function addTipoConfig(){
  const inp=document.getElementById('cfg-tipo-new-label');
  const col=document.getElementById('cfg-tipo-new-color');
  const lbl=inp.value.trim();
  if(!lbl){ inp.focus(); return; }
  const k=lbl.toLowerCase().replace(/[^a-z0-9]/g,'_').substring(0,20);
  if(!tiposConfig[_cfgEqActivo]) tiposConfig[_cfgEqActivo]=[];
  // Evitar duplicados por key
  if(!tiposConfig[_cfgEqActivo].find(t=>t.k===k)){
    tiposConfig[_cfgEqActivo].push({k, l:''+lbl, c:col.value});
  }
  inp.value='';
  renderCfgTiposList();
  autoGuardar();
}
function delTipoConfig(idx){
  if(!tiposConfig[_cfgEqActivo]) return;
  tiposConfig[_cfgEqActivo].splice(idx,1);
  renderCfgTiposList();
  autoGuardar();
}
function resetTiposConfig(){
  const defaults = {
    'CASTILLA':  [...TIPOS_BASE, {k:'intl',l:'🌍 Internacional',c:'#10b981'},{k:'premier',l:'⚽ Premier League',c:'#e11d48'}],
    'RMC':       [...TIPOS_BASE],
    'JUVENIL A': [...TIPOS_BASE, {k:'uyl',l:'Youth League',c:'#60b4ff',uyl:true}],
    'JUVENIL B': [...TIPOS_BASE],
    'JUVENIL C': [...TIPOS_BASE],
    'CADETE A':  [...TIPOS_BASE],
  };
  tiposConfig[_cfgEqActivo] = defaults[_cfgEqActivo] || [...TIPOS_BASE];
  renderCfgTiposList();
  toast('↺ Tipos restablecidos');
}
// ── UYL ──
function esUYL(diaParam){
  const d = diaParam || dia;
  return !!(modoUYL[d]);
}
function toggleUYL(diaParam){
  const d = diaParam || dia;
  if(esPartido('JUVENIL A', d)) return; // En partido no se puede activar YL
  modoUYL[d] = !modoUYL[d];
  autoGuardar();
  renderCards();
  if(vistaActual==='semana') requestAnimationFrame(()=>igualarZonasSemana(document.getElementById('grid')));
  toast(modoUYL[d]?'⚽ Youth League activada':'Youth League desactivada');
}
function abrirUYL(){
  document.getElementById('uyl-search').value='';
  renderUYLList();
  document.getElementById('uyl-modal').classList.add('open');
}
function cerrarUYL(e){
  if(!e||e.target===document.getElementById('uyl-modal'))
    document.getElementById('uyl-modal').classList.remove('open');
  autoGuardar();
  renderCards();
}
// listaUYL     = jugadores EXTRA de otros equipos añadidos manualmente
// listaUYLExcl = jugadores de JA explícitamente excluidos
if(!window.listaUYLExcl) window.listaUYLExcl=[];
var listaUYLExcl = window.listaUYLExcl;
function getPlantillaUYL(){
  // Si listaUYL tiene jugadores, usarla directamente
  // Si está vacía, inicializarla con los JA actuales y devolver eso
  if(listaUYL.length === 0){
    listaUYL = Object.keys(origen).filter(n=>origen[n]==='JUVENIL A').sort();
  }
  return [...listaUYL];
}
function renderUYLList(){
  const q=document.getElementById('uyl-search').value.trim().toLowerCase();
  // ── Sección JA base ──
  const jaList=document.getElementById('uyl-ja-list');
  jaList.innerHTML='';
  const jaJugadores=Object.keys(origen).filter(n=>origen[n]==='JUVENIL A').sort();
  jaJugadores.forEach(n=>{
    const excluido=listaUYLExcl.includes(n);
    const row=mk('div','uyl-player-row'+(excluido?' excluido':''));
    row.innerHTML=`
      <div>
        <div class="uyl-player-name">${n}</div>
        <div class="uyl-player-eq">JUVENIL A</div>
      </div>
      <div class="uyl-check ${excluido?'on':''}">${excluido?'✗':'✓'}</div>`;
    row.title=excluido?'Clic para incluir en Youth League':'Clic para excluir de Youth League';
    row.onclick=()=>{
      const idx=listaUYLExcl.indexOf(n);
      if(idx>=0) listaUYLExcl.splice(idx,1); // re-incluir
      else listaUYLExcl.push(n);              // excluir
      renderUYLList();
      updateUYLCount();
    };
    jaList.appendChild(row);
  });
  // ── Sección extras (otros equipos) ──
  const list=document.getElementById('uyl-player-list');
  list.innerHTML='';
  const extras=Object.keys(origen).filter(n=>origen[n]!=='JUVENIL A').sort();
  const filtrados=extras.filter(n=>!q||n.toLowerCase().includes(q));
  filtrados.forEach(n=>{
    const enLista=listaUYL.includes(n);
    const row=mk('div','uyl-player-row');
    row.innerHTML=`
      <div>
        <div class="uyl-player-name">${n}</div>
        <div class="uyl-player-eq">${origen[n]||''}</div>
      </div>
      <div class="uyl-check ${enLista?'on':''}">${enLista?'✓':''}</div>`;
    row.onclick=()=>{
      const idx=listaUYL.indexOf(n);
      if(idx>=0) listaUYL.splice(idx,1);
      else listaUYL.push(n);
      renderUYLList();
      updateUYLCount();
    };
    list.appendChild(row);
  });
  updateUYLCount();
}
function updateUYLCount(){
  const el=document.getElementById('uyl-count');
  if(el){
    const total=getPlantillaUYL().length;
    const excl=listaUYLExcl.length;
    const ext=listaUYL.length;
    el.textContent=total+' en plantilla'+(excl?` · ${excl} excluidos`:'')+(ext?` · ${ext} extras`:'');
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
function devolverADisponibles(nombre, eq, zona){
  const eqPropio = origen[nombre] || eq;
  // Caso especial: campo del Primer Equipo
  if(eq === '1ER EQUIPO' && zona === 'campo'){
    if(primerEquipoJugadores[dia]){
      const i = primerEquipoJugadores[dia].indexOf(nombre);
      if(i >= 0) primerEquipoJugadores[dia].splice(i, 1);
    }
    delete pos[key(dia, '1ER EQUIPO', nombre)];
    // No añadir a disponibles del equipo propio — ya estará en disponibles del 1ER EQUIPO
    autoGuardar(); render(); return;
  }
  // 1. Quitar de la zona específica donde está
  const arr = data[dia][eq]?.[zona];
  if(arr){
    const i = arr.indexOf(nombre);
    if(i >= 0) arr.splice(i, 1);
  }
  if(zona === 'campo') delete pos[key(dia, eq, nombre)];
  // 2. Si era de otro equipo (prestado), quitar de TODAS sus zonas activas
  //    en ese equipo prestado para no dejar rastro
  if(eq !== eqPropio){
    ZONAS_ACTIVAS.forEach(z => {
      const a = data[dia][eq]?.[z];
      if(!a) return;
      const i = a.indexOf(nombre);
      if(i >= 0) a.splice(i, 1);
    });
    delete pos[key(dia, eq, nombre)];
  }
  // 3. Quitar de promovidos_1er en su equipo propio (si fue promovido)
  const prom = data[dia][eqPropio]?.promovidos_1er;
  if(prom){ const pi = prom.indexOf(nombre); if(pi >= 0) prom.splice(pi, 1); }
  if(promInfo[dia]?.[eqPropio]) delete promInfo[dia][eqPropio][nombre];
  // 4. Limpiar multiEq
  borrarMultiEq(dia, nombre, eq);
  // 5. Añadir a disponibles de su equipo propio (si no está ya)
  const disp = data[dia][eqPropio]?.disponibles;
  if(disp && !disp.includes(nombre)) disp.push(nombre);
}
// dispararDobleTap recibe strings (no elemento DOM) — seguro tras re-render
function dispararDobleTap(nombre, eq, zona){
  const eqPropio = origen[nombre] || eq;
  // ── No se puede quitar de disponibles del propio equipo ──
  if(zona === 'disponibles' && eq === eqPropio){
    toast('⚠️ ' + nombre + ' siempre debe estar en disponibles de su equipo');
    return;
  }
  // ── Mensaje ──
  let msg;
  if(zona === 'campo'){
    msg = `Quitar a ${nombre} del campo → disponibles${eq !== eqPropio ? ' de ' + eqPropio : ''}`;
  } else if(zona === 'banquillo'){
    msg = `Quitar a ${nombre} del banquillo → disponibles${eq !== eqPropio ? ' de ' + eqPropio : ''}`;
  } else if(zona === 'disponibles'){
    msg = `Devolver a ${nombre} a disponibles de ${eqPropio}`;
  } else {
    const zonaLabel = {lesionados:'lesiones', promovidos_1er:'promoción', otros:'otros', extra:'extra'}[zona] || zona;
    msg = `Quitar a ${nombre} de ${zonaLabel} → disponibles${eq !== eqPropio ? ' de ' + eqPropio : ''}`;
  }
  showAlert(msg, ()=>{
    devolverADisponibles(nombre, eq, zona);
    autoGuardar();
    render();
    toast('↩️ ' + nombre + ' → disponibles ' + eqPropio);
  }, 'Eliminar');
}
// Alias por compatibilidad (ya no se usa pero por si acaso)
function onChipDoubleTap(c){ dispararDobleTap(c.dataset.nombre, c.dataset.eq, c.dataset.zona||'campo'); }
// ── DRAG UNIFICADO — cualquier chip puede ir a cualquier zona o campo ──
// El drag arranca tras 180ms para dejar hueco al doble clic
const _dragDelay = new WeakMap();  // chip → timeout del drag pendiente
const _lastClick = new WeakMap();   // chip → timestamp (legacy)
const _globalLastClick = new Map(); // clave nombre|eq|zona → timestamp doble tap
function equalizarCards(){
  const grid = document.getElementById('grid');
  if(!grid) return;
  // Resetear alturas previas
  grid.querySelectorAll('.campo-wrap').forEach(c=>{ c.style.height=''; });
  const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  if(cols < 2) return; // 1 columna: no hace falta
  const cards = [...grid.querySelectorAll('.card')];
  for(let i=0; i<cards.length; i+=cols){
    const fila = cards.slice(i, i+cols);
    const campos = fila.map(c=>c.querySelector('.campo-wrap')).filter(Boolean);
    if(!campos.length) continue;
    // El campo tiene padding-bottom:% → altura intrínseca = offsetWidth * ratio
    const maxH = Math.max(...campos.map(c=>c.offsetWidth * (c.offsetHeight / c.offsetWidth || 1.18)));
    // Forzar todos al mismo offsetWidth derivado
    const refW = campos[0].offsetWidth;
    const h = refW * 1.18; // siempre usar ratio estándar
    campos.forEach(c=>{ c.style.height = c.offsetWidth * (parseFloat(c.style.paddingBottom||'118')/100 || 1.18) + 'px'; });
    // Mejor: simplemente igualar por el más alto
    const maxOff = Math.max(...campos.map(c=>c.offsetHeight));
    campos.forEach(c=>{ c.style.height = maxOff+'px'; });
  }
}
function initDrag(){
  document.querySelectorAll('.cf,.cz').forEach(c=>{
    // Capturar datos del chip AHORA (el elemento puede re-renderizarse)
    const nombre = c.dataset.nombre;
    const eq     = c.dataset.eq;
    const zona   = c.dataset.zona || 'campo';
    // Touch
    // Touch: doble tap por clave nombre+eq+zona (no por referencia DOM)
    const _tapKey = nombre+'|'+eq+'|'+zona;
    c.addEventListener('touchstart', e=>{
      e.preventDefault();
      const ev = e.touches[0];
      const now = Date.now();
      const last = _globalLastClick.get(_tapKey) || 0;
      if(now - last < 400){
        clearTimeout(_dragDelay.get(c));
        _globalLastClick.set(_tapKey, 0);
        dispararDobleTap(nombre, eq, zona);
        return;
      }
      _globalLastClick.set(_tapKey, now);
      const saved = {clientX: ev.clientX, clientY: ev.clientY};
      const t = setTimeout(()=>{ startChip(c, saved); }, 200);
      _dragDelay.set(c, t);
    },{passive:false});
    // Mouse
    c.addEventListener('mousedown', e=>{
      if(e.button) return;
      e.preventDefault();
      const now = Date.now();
      const last = _globalLastClick.get(_tapKey) || 0;
      if(now - last < 400){
        clearTimeout(_dragDelay.get(c));
        _globalLastClick.set(_tapKey, 0);
        dispararDobleTap(nombre, eq, zona);
        return;
      }
      _globalLastClick.set(_tapKey, now);
      const saved = {clientX: e.clientX, clientY: e.clientY};
      const t = setTimeout(()=>{ startChip(c, saved); }, 200);
      _dragDelay.set(c, t);
    });
    // dblclick (ratón escritorio) — siempre funciona
    c.addEventListener('dblclick', e=>{
      e.preventDefault(); e.stopPropagation();
      clearTimeout(_dragDelay.get(c));
      _globalLastClick.set(_tapKey, 0);
      dispararDobleTap(nombre, eq, zona);
    });
  });
}
function startChip(c,ev){
  if(!c.isConnected) return; // el chip puede haber sido re-renderizado
  const esDeCampo = c.classList.contains('cf');
  drag={
    c, nombre:c.dataset.nombre, eq:c.dataset.eq, zona:c.dataset.zona||'campo',
    esDeCampo,
    pof: esDeCampo ? c.parentElement : null,
    campo: esDeCampo ? c.parentElement.closest('.campo-wrap') : null
  };
  c.classList.add('dragging');
  if(esDeCampo){ c.parentElement.classList.add('no-anim'); c.parentElement.style.zIndex='9990'; }
  // Ghost para chips de zona
  if(!esDeCampo){
    const g=document.getElementById('ghost');
    g.className='chip '+c.className.replace(/cf|cz|dragging/g,'').trim();
    g.textContent=c.dataset.nombre; g.style.display='block';
  }
  const r=c.getBoundingClientRect();
  dOff.x=ev.clientX-r.left-r.width/2; dOff.y=ev.clientY-r.top-r.height/2;
  moveGhost(ev.clientX,ev.clientY);
  on('touchmove',moveChip,{passive:false}); on('touchend',endChip);
  on('mousemove',moveChip); on('mouseup',endChip);
}
function moveChip(e){
  e.preventDefault&&e.preventDefault();
  if(!drag)return;
  const ev=e.touches?e.touches[0]:e;
  moveGhost(ev.clientX,ev.clientY);
  // Si viene del campo, mover el pof visualmente
  if(drag.esDeCampo && drag.pof && drag.campo){
    const cr=drag.campo.getBoundingClientRect();
    drag.pof.style.top  =clamp(((ev.clientY-dOff.y-cr.top   )/cr.height)*100,0,100)+'%';
    drag.pof.style.left =clamp(((ev.clientX-dOff.x-cr.left  )/cr.width )*100,0,100)+'%';
  }
  // Highlight zona bajo cursor
  document.querySelectorAll('.dz').forEach(z=>z.classList.remove('dz-active'));
  const t=document.elementFromPoint(ev.clientX,ev.clientY);
  if(t){const dz=t.closest('.dz');if(dz)dz.classList.add('dz-active');}
}
function endChip(e){
  off('touchmove',moveChip);off('touchend',endChip);off('mousemove',moveChip);off('mouseup',endChip);
  if(!drag){
    // Puede que el drag no haya arrancado todavía (dentro del delay de 160ms)
    // En ese caso no hacer nada — el doble tap ya se habrá gestionado
    return;
  }
  document.getElementById('ghost').style.display='none';
  drag.c.classList.remove('dragging');
  if(drag.pof){ drag.pof.classList.remove('no-anim'); drag.pof.style.zIndex=''; }
  document.querySelectorAll('.dz').forEach(z=>z.classList.remove('dz-active'));
  const ev=e.changedTouches?e.changedTouches[0]:e;
  // ── Detectar zona destino
  // En touch, ocultar también el chip arrastrado para que elementFromPoint lo atraviese
  const _chipWasHidden = drag.c.style.visibility;
  drag.c.style.visibility='hidden';
  if(drag.pof) drag.pof.style.visibility='hidden';
  const t=document.elementFromPoint(ev.clientX,ev.clientY);
  drag.c.style.visibility=_chipWasHidden||'';
  if(drag.pof) drag.pof.style.visibility='';
  const dz=t&&t.closest('.dz');
  if(!dz){
    // Soltado fuera de todo — si era del campo volver a snap, si era de zona no hacer nada
    if(drag.esDeCampo && drag.campo){
      const cr=drag.campo.getBoundingClientRect();
      const inside=ev.clientX>=cr.left&&ev.clientX<=cr.right&&ev.clientY>=cr.top&&ev.clientY<=cr.bottom;
      if(inside){
        const rawT=clamp(((ev.clientY-dOff.y-cr.top   )/cr.height)*100,0,100);
        const rawL=clamp(((ev.clientX-dOff.x-cr.left  )/cr.width )*100,0,100);
        const [snapT,snapL]=snapToGrid(drag.eq,drag.nombre,rawT,rawL);
        savePos(dia,drag.eq,drag.nombre,snapT,snapL);
        drag.pof.style.top=snapT+'%'; drag.pof.style.left=snapL+'%';
        updateCount(drag.eq); autoGuardar();
      } else {
        // Fuera del campo → borrar
        const arr=data[dia][drag.eq].campo;
        const i=arr.indexOf(drag.nombre); if(i>=0) arr.splice(i,1);
        drag.pof.remove();
        autoGuardar(); updateCount(drag.eq);
        render();
      }
    }
    drag=null; return;
  }
  const toEq=dz.dataset.eq, toZona=dz.dataset.zona;
  // ── Destino: campo
  if(toZona==='campo'){
    const cr=dz.getBoundingClientRect();
    const rawT=clamp(((ev.clientY-cr.top )/cr.height)*100,0,100);
    const rawL=clamp(((ev.clientX-cr.left)/cr.width )*100,0,100);
    const [snapT,snapL]=snapToGrid(toEq,drag.nombre,rawT,rawL);
    savePos(dia,toEq,drag.nombre,snapT,snapL);
    // Caso especial: campo del Primer Equipo
    if(toEq==='1ER EQUIPO'){
      // Quitar de zona origen
      if(drag.eq !== '1ER EQUIPO'){
        const arr=data[dia][drag.eq]?.[drag.zona];
        if(arr){ const i=arr.indexOf(drag.nombre); if(i>=0) arr.splice(i,1); }
      }
      // Añadir a primerEquipoJugadores
      if(!primerEquipoJugadores[dia]) primerEquipoJugadores[dia]=[];
      if(!primerEquipoJugadores[dia].includes(drag.nombre))
        primerEquipoJugadores[dia].push(drag.nombre);
      drag=null; autoGuardar(); render(); return;
    }
    // ── PROMOCIÓN AUTOMÁTICA ──
    // Si el jugador viene de disponibles de su equipo propio y va al campo de otro equipo
    const _nombre2 = drag.nombre;
    const _fromEq2 = drag.eq;
    const _fromZona2 = drag.zona;
    const _eqPropio2 = origen[_nombre2] || _fromEq2;
    const esPromocionAuto = (
      toEq !== _eqPropio2 &&              // va a un equipo distinto al suyo
      _fromZona2 === 'disponibles' &&      // viene de disponibles
      _fromEq2 === _eqPropio2              // de su propio equipo
    );
    if(esPromocionAuto){
      // Quitar de disponibles del equipo origen
      const srcArr = data[dia][_fromEq2]?.disponibles;
      if(srcArr){ const si=srcArr.indexOf(_nombre2); if(si>=0) srcArr.splice(si,1); }
      // Añadir al campo del equipo destino (ya guardamos pos arriba)
      data[dia][toEq].campo.push(_nombre2);
      // Registrar en promovidos_1er del equipo propio con destino
      autoPromocionar(_nombre2, _eqPropio2, toEq);
      toast(_nombre2 + ' → ' + toEq + ' (promoción auto)');
      drag=null; autoGuardar(); render(); return;
    }
    move(drag.eq,drag.zona,toEq,'campo',drag.nombre);
    drag=null; render(); return;
  }
  // ── Destino: misma zona origen → recolocar en campo si viene del campo
  if(drag.eq===toEq && drag.zona===toZona){ drag=null; return; }
  // ── Destino: promovidos_1er → preguntar a qué equipo va
  if(toZona==='promovidos_1er'){
    const _nombre=drag.nombre, _fromEq=drag.eq, _fromZona=drag.zona;
    // Quitar de zona origen (puede ser campo, disponibles, etc.)
    if(_fromZona==='campo'){
      // Si viene del campo, quitar pos
      delete pos[key(dia,_fromEq,_nombre)];
      if(drag.pof) drag.pof.remove();
    }
    const srcArr = data[dia][_fromEq]?.[_fromZona];
    if(srcArr){ const i=srcArr.indexOf(_nombre); if(i>=0) srcArr.splice(i,1); }
    // El equipo origen para la promoción es siempre el equipo propio del jugador
    const _eqPropio = origen[_nombre] || _fromEq;
    drag=null;
    abrirPromoDestModal(_nombre, _eqPropio, (destino)=>{
      ejecutarPromocion(_nombre, _eqPropio, destino);
    });
    return;
  }
  // ── Destino: cualquier otra zona
  move(drag.eq,drag.zona,toEq,toZona,drag.nombre);
  drag=null; render();
}
const ZONA_NAMES={campo:'Campo',banquillo:'Banquillo',disponibles:'Disponibles',promovidos_1er:'Promovido',lesionados:'Lesión',otros:'Otros'};
function move(fromEq,fromZona,toEq,toZona,nombre){
  const arr=data[dia][fromEq][fromZona];
  const i=arr.indexOf(nombre); if(i===-1)return;
  arr.splice(i,1);
  data[dia][toEq][toZona].push(nombre);
  borrarMultiEq(dia, nombre, fromEq);
  // ── Si vuelve al campo de su equipo propio, limpiar promoción automática
  const eqPropio = origen[nombre] || fromEq;
  if(toEq === eqPropio && toZona === 'campo'){
    // Quitar de promovidos_1er de su equipo propio
    const prom = data[dia][eqPropio]?.promovidos_1er;
    if(prom){ const pi=prom.indexOf(nombre); if(pi>=0) prom.splice(pi,1); }
    if(promInfo[dia]?.[eqPropio]) delete promInfo[dia][eqPropio][nombre];
    // Si estaba en el campo del equipo destino, quitarlo de allí
    EQUIPOS.forEach(eq2=>{
      if(eq2===eqPropio) return;
      const c2=data[dia][eq2]?.campo;
      if(c2){ const ci=c2.indexOf(nombre); if(ci>=0) c2.splice(ci,1); }
      if(promInfo[dia]?.[eq2]) delete promInfo[dia][eq2][nombre];
    });
  }
  toast(nombre+' → '+(fromEq!==toEq?toEq+' / ':'')+ZONA_NAMES[toZona]);
}
// ══════════════════════════════════════════════════
// MODAL COPIAR
// ══════════════════════════════════════════════════
let _copyTipo = 'dia'; // 'dia' | 'semana'
let _copyDiasDest = new Set();
let _copyDiaSemanaLunes = null; // semana destino para modo día (null = semana actual)
let _copyEqs = new Set(EQUIPOS);
let _copyDiaOrigen = null; // día origen seleccionado
function abrirCopiarModal(){
  // Reset
  _copyTipo='dia';
  _copyDiasDest=new Set();
  _copyEqs=new Set(EQUIPOS);
  _copySemanaDestLunes=null;
  _copyDiaSemanaLunes=null;
  _copyDiaOrigen = dia; // por defecto el día activo
  // Equipos
  const checksEl=document.getElementById('copy-eq-checks');
  checksEl.innerHTML='';
  EQUIPOS.forEach(eq=>{
    const lbl=mk('label','copy-eq-chk sel');
    lbl.innerHTML=`<input type="checkbox" checked onchange="toggleCopyEq('${eq}',this.checked)"><span>${eq}</span>`;
    checksEl.appendChild(lbl);
  });
  // Día ORIGEN
  const origenEl = document.getElementById('copy-origen-btns');
  if(origenEl){
    origenEl.innerHTML='';
    DIAS.forEach(d=>{
      const btn=mk('button','copy-dia-btn'+(d===_copyDiaOrigen?' sel':''));
      btn.textContent=d.slice(0,3);
      btn.title=d;
      btn.onclick=()=>{
        _copyDiaOrigen=d;
        origenEl.querySelectorAll('.copy-dia-btn').forEach(b=>b.classList.remove('sel'));
        btn.classList.add('sel');
      };
      origenEl.appendChild(btn);
    });
  }
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
// Lunes de la semana destino para la copia semana completa
let _copySemanaDestLunes = null;
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
// Abrir calendario en modo copia de semana
function abrirCalCopia(){
  _calModoCopia = 'semana';
  _calLunesSel = _copySemanaDestLunes ? new Date(_copySemanaDestLunes) : null;
  _calFecha = _copySemanaDestLunes ? new Date(_copySemanaDestLunes) : new Date();
  renderCal();
  document.getElementById('cal-overlay').classList.add('open');
}
function abrirCalCopiaDir(){
  _calModoCopia = 'dia';
  _calLunesSel = _copyDiaSemanaLunes ? new Date(_copyDiaSemanaLunes) : null;
  _calFecha = _copyDiaSemanaLunes ? new Date(_copyDiaSemanaLunes) : new Date();
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
function copyDiaBase(from,to,eqs){
  eqs.forEach(eq=>{
    data[to][eq]=JSON.parse(JSON.stringify(data[from][eq]));
    data[from][eq].campo.forEach(n=>{
      const k=key(from,eq,n);
      if(pos[k]) pos[key(to,eq,n)]=[...pos[k]];
    });
  });
}
function ejecutarCopia(){
  const eqs=[..._copyEqs];
  if(!eqs.length){toast('Selecciona al menos un equipo');return;}
  if(_copyTipo==='semana'){
    if(!_copySemanaDestLunes){ toast('⚠️ Selecciona una semana destino'); return; }
    // Calcular fechas de la semana destino y copiar día a día
    const fechasDest = calcFechasSemana(_copySemanaDestLunes);
    // Verificar que no es la misma semana
    if(fechasDest['LUNES'] === FECHAS['LUNES']){ toast('⚠️ La semana destino es la misma que la actual'); return; }
    // Necesitamos que los datos de esa semana existan — usamos los nombres de días como claves
    DIAS.forEach((d, i)=>{
      // Copiar el día actual a cada día de la semana destino
      // Como data usa nombres de días (LUNES, MARTES…) no fechas, copiamos entre mismos días
      copyDiaBase(_copyDiaOrigen||dia, d, eqs);
    });
    const fechas = calcFechasSemana(_copySemanaDestLunes);
    toast('Copiado a semana ' + fechas['LUNES'] + ' – ' + fechas['DOMINGO']);
  } else {
    if(!_copyDiasDest.size){toast('Selecciona al menos un día');return;}
    if(_copyDiaSemanaLunes){
      // Copiar a días de otra semana: guardar en data con clave semana_dia
      const fechasDest = calcFechasSemana(_copyDiaSemanaLunes);
      const esMismaSemana = fechasDest['LUNES'] === FECHAS['LUNES'];
      if(esMismaSemana){
        _copyDiasDest.forEach(d=>copyDiaBase(_copyDiaOrigen||dia,d,eqs));
      } else {
        // Guardar datos de semana destino en localStorage con clave propia
        const lunesKey = _copyDiaSemanaLunes.toISOString().slice(0,10);
        const storeKey = 'campograma_semana_'+lunesKey;
        let semanaDest = {};
        _copyDiasDest.forEach(d=>{
          if(!semanaDest[d]) semanaDest[d]={};
          eqs.forEach(eq=>{
            semanaDest[d][eq] = JSON.parse(JSON.stringify(data[_copyDiaOrigen||dia][eq]));
          });
        });
        // localStorage desactivado
        toast('Copiado a semana '+ fechasDest['LUNES']+' – '+fechasDest['DOMINGO']);
        cerrarCopiarModal(); autoGuardar(); return;
      }
    } else {
      _copyDiasDest.forEach(d=>copyDiaBase(_copyDiaOrigen||dia,d,eqs));
    }
    toast('Copiado a '+ [..._copyDiasDest].map(d=>d.slice(0,3)).join(', '));
  }
  autoGuardar(); renderDias();
  cerrarCopiarModal();
}
// Alias para compatibilidad
function copyDia(from,to){
  copyDiaBase(from,to,EQUIPOS);
  toast('Copiado '+from+' → '+to);
  autoGuardar(); renderDias();
}
// ══════════════════════════════════════════════════
// RIVAL Y CALENDARIO DE PARTIDOS
// ══════════════════════════════════════════════════
function guardarRival(eq, valor){
  if(!rivales[dia]) rivales[dia]={};
  rivales[dia][eq] = valor;
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
let _regTab = 'jugadores';
function openReg(){
  document.getElementById('reg-overlay').classList.add('show');
  // Poblar filtro equipos
  const sel = document.getElementById('reg-eq-filter');
  sel.innerHTML = '<option value="">Todos los equipos</option>';
  EQUIPOS.forEach(eq=>{ const o=document.createElement('option'); o.value=eq; o.textContent=eq; sel.appendChild(o); });
  renderReg();
}
function closeReg(){
  document.getElementById('reg-overlay').classList.remove('show');
}
function switchRegTab(tab){
  _regTab = tab;
  document.querySelectorAll('.reg-tab').forEach((b,i)=>b.classList.toggle('active', (i===0&&tab==='jugadores')||(i===1&&tab==='equipos')));
  const inp = document.getElementById('reg-search');
  const sel = document.getElementById('reg-eq-filter');
  inp.style.display = tab==='jugadores' ? '' : 'none';
  sel.style.display = tab==='jugadores' ? '' : 'none';
  renderReg();
}
function calcStatsJugador(nombre){
  let entrenos=0, partidos=0, banco=0, eqsConEntrenamiento={};
  DIAS.forEach(d=>{
    EQUIPOS.forEach(eq=>{
      const esP = !!(modoPartido[d]?.[eq]);
      const enCampo = (data[d][eq].campo||[]).includes(nombre);
      const enBanco = (data[d][eq].banquillo||[]).includes(nombre);
      if(enCampo){
        if(esP){ partidos++; } else { entrenos++; }
        if(!eqsConEntrenamiento[eq]) eqsConEntrenamiento[eq]=0;
        eqsConEntrenamiento[eq]++;
      }
      if(enBanco) banco++;
    });
  });
  return { entrenos, partidos, banco, eqsConEntrenamiento };
}
function calcStatsEquipo(eq){
  let totalSesiones=0, totalJugadoresPropios=0, totalJugadoresExteros=0;
  let sesionesPartido=0, sesionesEntreno=0;
  let promosSemana=new Set();
  let jugsDias=[]; // por día: {dia, jugadores, externos, esPartido}
  DIAS.forEach(d=>{
    const campo = data[d][eq].campo||[];
    if(!campo.length) return;
    totalSesiones++;
    const esP = !!(modoPartido[d]?.[eq]);
    if(esP) sesionesPartido++; else sesionesEntreno++;
    let propios=0, externos=0;
    campo.forEach(n=>{
      if(origen[n]===eq) propios++; else externos++;
    });
    totalJugadoresPropios+=propios;
    totalJugadoresExteros+=externos;
    jugsDias.push({dia:d, total:campo.length, propios, externos, esPartido:esP});
    // Promovidos
    Object.entries(promInfo[d]?.[eq]||{}).forEach(([n,dest])=>{ if(dest) promosSemana.add(n); });
  });
  const pctExternos = totalSesiones ? Math.round(totalJugadoresExteros/(totalJugadoresPropios+totalJugadoresExteros)*100)||0 : 0;
  return { totalSesiones, sesionesPartido, sesionesEntreno, pctExternos, promosSemana:[...promosSemana], jugsDias };
}
const EQ_COLOR = {
  'CASTILLA':'#C8A800','RMC':'#3b82f6','JUVENIL A':'#10b981',
  'JUVENIL B':'#f59e0b','JUVENIL C':'#ec4899','CADETE A':'#8b5cf6'
};
function renderReg(){
  const content = document.getElementById('reg-content');
  if(_regTab==='jugadores') renderRegJugadores(content);
  else renderRegEquipos(content);
}
function renderRegJugadores(container){
  const q=(document.getElementById('reg-search').value||'').toLowerCase().trim();
  const eqF=document.getElementById('reg-eq-filter').value;
  const todos=[...new Set([...Object.keys(origen), ...EQUIPOS.flatMap(eq=>DIAS.flatMap(d=>ZONAS.flatMap(z=>data[d][eq][z]||[])))])].sort();
  const filtrados=todos.filter(n=>{
    if(q && !n.toLowerCase().includes(q)) return false;
    if(eqF && origen[n]!==eqF) return false;
    return true;
  });
  // Tabla
  let html = '<div id="reg-table-wrap"><table id="reg-table"><thead id="reg-thead"><tr>';
  html += '<th>Jugador</th>';
  DIAS.forEach(d=>{ html+=`<th title="${d}">${d.slice(0,3)}</th>`; });
  html += '<th title="Entrenamientos">🏋️</th><th title="Partidos">⚽</th><th title="Banco">🔄</th><th>TOTAL</th></tr></thead><tbody>';
  filtrados.forEach(nombre=>{
    const eqOrig=origen[nombre]||'—';
    const col=EQ_COLOR[eqOrig]||'#94a3b8';
    const {entrenos,partidos,banco}=calcStatsJugador(nombre);
    const total=entrenos+partidos;
    html+=`<tr><td><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${col};margin-right:5px;vertical-align:middle;"></span><span style="font-size:9px;opacity:.45">${(eqOrig.slice(0,4))}</span><br><strong>${nombre}</strong></td>`;
    DIAS.forEach(d=>{
      let cls='empty', txt='·';
      EQUIPOS.forEach(eq=>{
        const esP=!!(modoPartido[d]?.[eq]);
        if((data[d][eq].campo||[]).includes(nombre)){ cls=esP?'partido':'active'; txt=esP?'⚽':'✓'; }
        else if((data[d][eq].banquillo||[]).includes(nombre) && cls==='empty'){ cls='banco'; txt='B'; }
      });
      html+=`<td><span class="reg-dot ${cls}">${txt}</span></td>`;
    });
    html+=`<td><span style="color:#4ade80;font-weight:800;font-family:'Barlow Condensed',sans-serif">${entrenos||''}</span></td>`;
    html+=`<td><span style="color:#f59e0b;font-weight:800;font-family:'Barlow Condensed',sans-serif">${partidos||''}</span></td>`;
    html+=`<td><span style="color:#60a5fa;font-weight:800;font-family:'Barlow Condensed',sans-serif">${banco||''}</span></td>`;
    html+=`<td class="reg-total">${total||'—'}</td></tr>`;
  });
  html+='</tbody></table></div>';
  if(!filtrados.length) html='<div style="padding:30px;text-align:center;color:rgba(255,255,255,.25);font-family:Barlow Condensed,sans-serif;font-size:14px;text-transform:uppercase;">Sin jugadores</div>';
  container.innerHTML=html;
}
function renderRegEquipos(container){
  let html='<div id="reg-equipo-grid">';
  EQUIPOS.forEach(eq=>{
    const col=EQ_COLOR[eq]||'#94a3b8';
    const s=calcStatsEquipo(eq);
    if(!s.totalSesiones){ html+=`<div class="reg-eq-card"><div class="reg-eq-card-title" style="color:${col}">${eq}<span class="reg-eq-badge" style="background:rgba(255,255,255,.07);color:rgba(255,255,255,.3)">Sin datos</span></div></div>`; return; }
    const pctPropios=100-s.pctExternos;
    html+=`<div class="reg-eq-card">
      <div class="reg-eq-card-title" style="color:${col}">${eq}
        <span class="reg-eq-badge" style="background:${col}22;color:${col}">${s.totalSesiones} sesiones</span>
      </div>
      <div class="reg-stat-row">
        <div class="reg-stat-box"><div class="reg-stat-num" style="color:#4ade80">${s.sesionesEntreno}</div><div class="reg-stat-lbl">Entrenos</div></div>
        <div class="reg-stat-box"><div class="reg-stat-num" style="color:#f59e0b">${s.sesionesPartido}</div><div class="reg-stat-lbl">Partidos</div></div>
        <div class="reg-stat-box"><div class="reg-stat-num" style="color:${s.pctExternos>30?'#f87171':'#4ade80'}">${s.pctExternos}%</div><div class="reg-stat-lbl">Externos</div></div>
      </div>
      <div class="reg-bar-row">
        <span class="reg-bar-label">Propios</span>
        <div class="reg-bar-track"><div class="reg-bar-fill" style="width:${pctPropios}%;background:#4ade80"></div></div>
        <span class="reg-bar-val" style="color:#4ade80">${pctPropios}%</span>
      </div>
      <div class="reg-bar-row">
        <span class="reg-bar-label">Externos</span>
        <div class="reg-bar-track"><div class="reg-bar-fill" style="width:${s.pctExternos}%;background:${s.pctExternos>30?'#f87171':'#60a5fa'}"></div></div>
        <span class="reg-bar-val" style="color:${s.pctExternos>30?'#f87171':'#60a5fa'}">${s.pctExternos}%</span>
      </div>`;
    // Días con sesión
    html+=`<div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap;">`;
    s.jugsDias.forEach(({dia,total,propios,externos,esPartido})=>{
      const diaCort=dia.slice(0,3);
      const c=esPartido?'#f59e0b':'#4ade80';
      html+=`<div title="${dia}: ${total} jugadores (${propios} propios, ${externos} externos)" style="background:${c}18;border:1px solid ${c}44;border-radius:6px;padding:3px 7px;font-family:'Barlow Condensed',sans-serif;font-size:10px;font-weight:700;color:${c}">${diaCort} ${total}${esPartido?'⚽':''}</div>`;
    });
    html+=`</div>`;
    if(s.promosSemana.length){
      html+=`<div style="margin-top:8px"><div style="font-family:'Barlow Condensed',sans-serif;font-size:9px;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Promovidos</div><div class="reg-prom-list">`;
      s.promosSemana.forEach(n=>{ html+=`<span class="reg-prom-chip">${n}</span>`; });
      html+=`</div></div>`;
    }
    html+=`</div>`;
  });
  html+='</div>';
  container.innerHTML=html;
}
// ══════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════
function moveGhost(x,y){const g=document.getElementById('ghost');g.style.left=(x-dOff.x)+'px';g.style.top=(y-dOff.y)+'px';}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function on(ev,fn,opts){document.addEventListener(ev,fn,opts);}
function off(ev,fn){document.removeEventListener(ev,fn);}
let alertCb=null;
function showAlert(msg,onConfirm,okLabel='Añadir'){
  document.getElementById('alert-msg').textContent=msg;
  document.getElementById('alert-ok-btn').textContent=okLabel;
  // Estilo rojo si es destructivo
  const okBtn=document.getElementById('alert-ok-btn');
  if(okLabel==='Eliminar'){ okBtn.style.background='#ef4444'; okBtn.style.borderColor='#ef4444'; }
  else { okBtn.style.background=''; okBtn.style.borderColor=''; }
  document.getElementById('alert-overlay').classList.add('show');
  alertCb=onConfirm;
  okBtn.onclick=()=>{const cb=alertCb;closeAlert();if(cb)cb();};
}
function closeAlert(){
  document.getElementById('alert-overlay').classList.remove('show');
  alertCb=null;
}
let tT=null;
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(tT);tT=setTimeout(()=>t.classList.remove('show'),2200);}
// Intentar cargar guardado previo
// ── ARRANQUE: cargar sesión principal desde Firebase ──
// Firebase es la fuente de verdad. localStorage solo como fallback mientras carga.
const cargado = cargarGuardado();
initTiposConfig();
if(cargado) render(); // render provisional con datos locales
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
      if(payload.extraZonas  && typeof payload.extraZonas==='object')  extraZonas  = payload.extraZonas;
      if(payload.promInfo    && typeof payload.promInfo==='object')    promInfo    = payload.promInfo;
      if(payload.tiposConfig && typeof payload.tiposConfig==='object') tiposConfig = payload.tiposConfig;
      if(payload.tipoPartido && typeof payload.tipoPartido==='object') tipoPartido = payload.tipoPartido;
      if(payload.modoPartido && typeof payload.modoPartido==='object') modoPartido = payload.modoPartido;
      if(payload.modoDescanso&& typeof payload.modoDescanso==='object')modoDescanso= payload.modoDescanso;
      if(payload.multiEq     && typeof payload.multiEq==='object')     multiEq     = payload.multiEq;
      if(payload.fechas      && typeof payload.fechas==='object')      Object.assign(FECHAS, payload.fechas);
      if(Array.isArray(payload.primerEquipoJugadores)) primerEquipoJugadores = payload.primerEquipoJugadores;
      if(payload.rivales     && typeof payload.rivales==='object')     window.rivales = payload.rivales;
      // Normalizar colNames
      EQUIPOS.forEach(eq=>{
        if(!colNames[eq]) colNames[eq]=['PROMOCIÓN','LESIÓN','OTROS'];
        if(colNames[eq][0]==='1ER EQUIPO') colNames[eq][0]='PROMOCIÓN';
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
