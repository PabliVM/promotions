// ================================================
// CAMPOGRAMA-LOGIC.JS — Lógica principal (Fase 1: monolito intacto)
// ================================================

// ══════════════════════════════════════════════════
// DATOS
// ══════════════════════════════════════════════════
var _semanaKeyActual = null;
function calcFechasSemana(lunesBase){
  const base = lunesBase ? new Date(lunesBase) : (()=>{
    const hoy = new Date();
    const d = hoy.getDay();
    const diff = d===0 ? -6 : 1-d;
    const lun = new Date(hoy); lun.setDate(hoy.getDate()+diff); return lun;
  })();
  _semanaKeyActual = base.getFullYear()+'-'+String(base.getMonth()+1).padStart(2,'0')+'-'+String(base.getDate()).padStart(2,'0');
  const fechas = {};
  window.FECHAS_COMPLETAS = window.FECHAS_COMPLETAS || {};
  DIAS.forEach((dia,i)=>{
    const f = new Date(base); f.setDate(base.getDate()+i);
    fechas[dia] = f.getDate()+'/'+(f.getMonth()+1);
    window.FECHAS_COMPLETAS[dia] = f.getFullYear()+'-'+String(f.getMonth()+1).padStart(2,'0')+'-'+String(f.getDate()).padStart(2,'0');
  });
  return fechas;
}
function fechaCompletaDeDia(diaNombre, lunesKey){
  if(!lunesKey) return (window.FECHAS_COMPLETAS||{})[diaNombre] || '';
  const idx = DIAS.indexOf(diaNombre);
  if(idx < 0) return '';
  const base = new Date(lunesKey);
  const f = new Date(base); f.setDate(base.getDate()+idx);
  return f.getFullYear()+'-'+String(f.getMonth()+1).padStart(2,'0')+'-'+String(f.getDate()).padStart(2,'0');
}
function abrevDiaDesdeFecha(fechaCompleta){
  const ABREV = ['D','L','M','X','J','V','S'];
  const f = new Date(fechaCompleta+'T00:00:00');
  if(isNaN(f.getTime())) return '?';
  return ABREV[f.getDay()];
}
var dia   = sessionStorage.getItem("rm_dia") || "LUNES";
var FECHAS = calcFechasSemana();
(function(){
  var hoy = new Date();
  DIAS.forEach(function(d){
    var partes = (FECHAS[d]||'').split('/');
    if(partes.length===2 && parseInt(partes[0])===hoy.getDate() && parseInt(partes[1])===(hoy.getMonth()+1)){
      dia = d;
      sessionStorage.setItem('rm_dia', d);
    }
  });
})();
var origen = {};
var historicoJugador = {};
var movimientos = {};
var porteros = [];
// ══════════════════════════════════════════════════
// ESTADO
// ══════════════════════════════════════════════════
var data = JSON.parse(JSON.stringify(RAW));
var _semanasGuardadas = {};
function guardarFotoSemanaActual(){
  if(!_semanaKeyActual) return;
  _semanasGuardadas[_semanaKeyActual] = JSON.parse(JSON.stringify({
    data, pos, promInfo, multiEq, modoPartido, modoDescanso, tipoPartido,
    primerEquipoJugadores, notas: window._notasData || {}, origen, historicoJugador
  }));
  window._semanasSucias = window._semanasSucias || new Set();
  window._semanasSucias.add(_semanaKeyActual);
}
async function cargarFotoSemana(key){
  let foto = _semanasGuardadas[key];
  if(!foto){
    if(typeof window.fbCargarSemanaArchivada === 'function'){
      const res = await window.fbCargarSemanaArchivada(key);
      if(res && res.ok && res.data){
        foto = res.data;
        _semanasGuardadas[key] = foto;
      }
    }
  }
  if(!foto) return false;
  data = foto.data; pos = foto.pos; promInfo = foto.promInfo; multiEq = foto.multiEq;
  modoPartido = foto.modoPartido; modoDescanso = foto.modoDescanso; tipoPartido = foto.tipoPartido;
  primerEquipoJugadores = foto.primerEquipoJugadores || {};
  window._notasData = foto.notas || {};
  if(foto.origen) origen = foto.origen;
  historicoJugador = foto.historicoJugador || {};
  return true;
}
function crearSemanaVacia(){
  data = JSON.parse(JSON.stringify(RAW));
  pos = {}; promInfo = {}; multiEq = {}; modoPartido = {}; modoDescanso = {};
  tipoPartido = {}; primerEquipoJugadores = {}; window._notasData = {};
  historicoJugador = {};
  EQUIPOS.forEach(eq=>{
    (plantillas[eq]||[]).forEach(nombre=>{
      DIAS.forEach(d=>{
        if(!data[d][eq].disponibles.includes(nombre)) data[d][eq].disponibles.push(nombre);
      });
    });
  });
}
for(const d of DIAS) for(const e of EQUIPOS){
  if(!data[d])  data[d]={};
  if(!data[d][e]) data[d][e]={};
  for(const z of ZONAS) if(!data[d][e][z]) data[d][e][z]=[];
  if(data[d][e].banquillo === undefined) data[d][e].banquillo = [];
}
var eqF  = "TODOS";
var pos  = {};
var colNames = {};
var promInfo = {};
var multiEq    = {};
var primerEqVisible = false;
var promDestinos = {};
var modoPartido = {};
var modoDescanso = {};
var modoUYL     = {};
var listaUYL    = [];
var rivales     = {};
var tipoPartido  = {};
var tiposConfig = {};
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
var calendarioPartidos = {};
function initPromInfo(){ DIAS.forEach(d=>{ promInfo[d]={}; EQUIPOS.forEach(eq=>{ promInfo[d][eq]={}; }); }); }
initPromInfo();
EQUIPOS.forEach(eq=> colNames[eq]=['PROMOCIONADOS','LESIONADOS','OTROS']);
colNames['CASTILLA'][0] = 'PROMOCIÓN 1ER EQ.';
colNames['CASTILLA'][3] = 'OTRO EQUIPO';
var extraZonas = {};
EQUIPOS.forEach(eq=> extraZonas[eq]=false);
extraZonas['CASTILLA'] = true; // "Otros equipos" viene activada de fábrica en Castilla
var drag = null;
var dOff = {x:0,y:0};
var key    = (d,e,n) => d+'|'+e+'|'+n;
var getPos = (d,e,n,i) => pos[key(d,e,n)] || POS_DEF[i%POS_DEF.length] || [50,50];
var savePos= (d,e,n,t,l) => pos[key(d,e,n)] = [clamp(t,0,100), clamp(l,0,100)];
function esPortero(eq,nombre,i){
  const [t,l]=getPos(dia,eq,nombre,i);
  return t>84 && l>=24 && l<=76;
}
function asegurarHistoricoJugador(diaP){
  if(!diaP || !data[diaP]) return;
  if(!historicoJugador[diaP]) historicoJugador[diaP] = {};
  const registro = historicoJugador[diaP];
  let hayAlguienSinFoto = false;
  EQUIPOS.forEach(eq=>{
    if(hayAlguienSinFoto) return;
    ZONAS.forEach(z=>{
      if(hayAlguienSinFoto) return;
      if((data[diaP][eq]?.[z]||[]).some(n=>!registro[n])) hayAlguienSinFoto = true;
    });
  });
  if(!hayAlguienSinFoto && (primerEquipoJugadores[diaP]||[]).every(n=>registro[n])) return;
  const promEvidencia = {};
  EQUIPOS.forEach(eqOrigenPosible=>{
    const infoEq = promInfo[diaP]?.[eqOrigenPosible];
    if(!infoEq) return;
    Object.keys(infoEq).forEach(nombre=>{
      if(promEvidencia[nombre]) return;
      const destinos = getDestinos(diaP, eqOrigenPosible, nombre);
      if(destinos.length) promEvidencia[nombre] = { origenReal: eqOrigenPosible, destino: destinos[0] };
    });
  });
  EQUIPOS.forEach(eq=>{
    ZONAS.forEach(z=>{
      (data[diaP][eq]?.[z]||[]).forEach(nombre=>{
        if(registro[nombre]) return;
        let eqOrigen, entrenoCon, promocionado, promocionadoDesde;
        const ev = promEvidencia[nombre];
        if(z === 'promovidos_1er'){
          eqOrigen = eq;
          entrenoCon = (ev && ev.origenReal===eq) ? ev.destino : eq;
          promocionado = true;
          promocionadoDesde = eq;
        } else if(ev && ev.destino === eq){
          eqOrigen = ev.origenReal;
          entrenoCon = eq;
          promocionado = true;
          promocionadoDesde = ev.origenReal;
        } else {
          eqOrigen = origen[nombre] || eq;
          entrenoCon = eq;
          promocionado = eq !== eqOrigen;
          promocionadoDesde = promocionado ? eqOrigen : null;
        }
        registro[nombre] = { equipoOrigen: eqOrigen, entrenoCon, promocionado, promocionadoDesde };
      });
    });
  });
  (primerEquipoJugadores[diaP]||[]).forEach(nombre=>{
    if(registro[nombre]) return;
    const ev = promEvidencia[nombre];
    const eqOrigen = (ev && ev.destino==='1ER EQUIPO') ? ev.origenReal : (origen[nombre] || '1ER EQUIPO');
    const promocionado = eqOrigen !== '1ER EQUIPO';
    registro[nombre] = {
      equipoOrigen: eqOrigen,
      entrenoCon: '1ER EQUIPO',
      promocionado: promocionado,
      promocionadoDesde: promocionado ? eqOrigen : null
    };
  });
}
function equipoHistorico(diaP, nombre){
  return historicoJugador[diaP]?.[nombre]?.entrenoCon || origen[nombre];
}
function hacerBackupDiarioSiHaceFalta(){
  try{
    const hoy = new Date().toISOString().slice(0,10);
    const ultimo = localStorage.getItem('rm_ultimo_backup');
    if(ultimo === hoy) return;
    const payload = buildPayload(false);
    const nombreAuto = 'Auto ' + hoy;
    window.fbGuardarSesion(nombreAuto, payload).then(async res=>{
      if(res && res.ok){
        localStorage.setItem('rm_ultimo_backup', hoy);
        console.log('💾 Copia de seguridad diaria guardada:', hoy);
        // Mismo pool que "Guardar" manual — máximo 5 en total, se borran los viejos
        await limpiarSesionesAntiguas();
        try{ exportarDatos(); }catch(e){ console.warn('Descarga automática diaria falló:', e); }
      }
    });
  }catch(e){ console.warn('Error en backup diario:', e); }
}
var _ultimoTotalJugadoresConocido = null;
function fijarTotalJugadoresConocido(){
  _ultimoTotalJugadoresConocido = EQUIPOS.reduce((acc,eq)=>acc+(plantillas[eq]||[]).length, 0);
}
function hayQueFrenarGuardado(){
  if(_ultimoTotalJugadoresConocido === null || _ultimoTotalJugadoresConocido < 5) return false;
  const totalActual = EQUIPOS.reduce((acc,eq)=>acc+(plantillas[eq]||[]).length, 0);
  return totalActual < _ultimoTotalJugadoresConocido * 0.5;
}
function diaHoyIdx(){
  const d = new Date().getDay();
  return d===0 ? 6 : d-1;
}
function abrirCalendarioFechaModal(nombre, onConfirmar){
  const fechasSemana = DIAS.map(d=>(window.FECHAS_COMPLETAS||{})[d]).filter(Boolean);
  if(!fechasSemana.length){ onConfirmar(0); return; }
  const minFecha = fechasSemana[0];
  const maxFecha = fechasSemana[fechasSemana.length-1];
  const hoyFecha = (window.FECHAS_COMPLETAS||{})[dia] || minFecha;

  const overlay = mk('div','');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10400;background:rgba(0,0,0,.4);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:calc(24px + env(safe-area-inset-top,0px)) 16px 24px;backdrop-filter:blur(4px);';
  const box = mk('div','');
  box.style.cssText = 'width:100%;max-width:360px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.15);';
  const hdr = mk('div','');
  hdr.style.cssText = 'background:#2563eb;padding:14px 18px;';
  hdr.innerHTML = `<div style="font-family:'Segoe UI',sans-serif;font-size:14px;font-weight:800;color:#fff;">${nombre}: ¿desde qué fecha?</div>`;
  const body = mk('div','');
  body.style.cssText = 'padding:18px;';
  const sub = mk('div','');
  sub.style.cssText = 'font-family:\'Segoe UI\',sans-serif;font-size:12px;color:#5a6170;margin-bottom:12px;';
  sub.textContent = 'Solo se puede elegir dentro de la semana que estás viendo ahora mismo.';
  body.appendChild(sub);
  const inp = document.createElement('input');
  inp.type = 'date';
  inp.min = minFecha; inp.max = maxFecha; inp.value = hoyFecha;
  inp.style.cssText = 'width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid #dfe1e6;font-family:\'Segoe UI\',sans-serif;font-size:14px;color:#1a1d23;margin-bottom:16px;box-sizing:border-box;';
  body.appendChild(inp);
  const btnRow = mk('div','');
  btnRow.style.cssText = 'display:flex;gap:8px;';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.style.cssText = 'flex:1;padding:10px;border-radius:10px;border:1px solid #dfe1e6;background:transparent;color:#5a6170;font-family:\'Segoe UI\',sans-serif;font-size:13px;font-weight:700;cursor:pointer;';
  const okBtn = document.createElement('button');
  okBtn.textContent = 'Añadir';
  okBtn.style.cssText = 'flex:1;padding:10px;border-radius:10px;border:none;background:#2563eb;color:#fff;font-family:\'Segoe UI\',sans-serif;font-size:13px;font-weight:700;cursor:pointer;';
  btnRow.appendChild(cancelBtn); btnRow.appendChild(okBtn);
  body.appendChild(btnRow);
  box.appendChild(hdr); box.appendChild(body);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  function cerrar(){ overlay.remove(); }
  cancelBtn.onclick = cerrar;
  overlay.onclick = (e)=>{ if(e.target===overlay) cerrar(); };
  okBtn.onclick = ()=>{
    const fechaElegida = inp.value;
    if(!fechaElegida){ toast('⚠️ Elige una fecha'); return; }
    const idx = fechasSemana.indexOf(fechaElegida);
    cerrar();
    onConfirmar(idx >= 0 ? idx : 0);
  };
}
function abrirCopiarDiaModal(eq, diaOrigenDefecto){
  const overlay = mk('div','');
  overlay.id = 'copiar-dia-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10400;background:rgba(0,0,0,.4);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:calc(24px + env(safe-area-inset-top,0px)) 16px 24px;backdrop-filter:blur(4px);';
  const box = mk('div','');
  box.style.cssText = 'width:100%;max-width:400px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.15);';
  const hdr = mk('div','');
  hdr.style.cssText = 'background:#2563eb;padding:14px 18px;';
  hdr.innerHTML = `<div style="font-family:'Segoe UI',sans-serif;font-size:14px;font-weight:800;color:#fff;">Copiar ${eq} a otro día</div>`;
  const body = mk('div','');
  body.style.cssText = 'padding:16px 18px;';
  const diaAbrev = {'LUNES':'L','MARTES':'M','MIÉRCOLES':'X','JUEVES':'J','VIERNES':'V','SÁBADO':'S','DOMINGO':'D'};

  let diaOrigen = diaOrigenDefecto || dia;
  let diaDestino = DIAS.find(d=>d!==diaOrigen) || diaOrigenDefecto;
  let modo = 'todo';

  function filaDias(label, actual, onElegir){
    const lbl = mk('div','');
    lbl.style.cssText = 'font-family:\'Segoe UI\',sans-serif;font-size:11px;font-weight:700;color:#5a6170;margin:10px 0 6px;text-transform:uppercase;letter-spacing:.4px;';
    lbl.textContent = label;
    body.appendChild(lbl);
    const grid = mk('div','');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:6px;';
    const botones = [];
    DIAS.forEach(d=>{
      const btn = document.createElement('button');
      const _fc = (window.FECHAS_COMPLETAS||{})[d]; const _anio = _fc ? _fc.slice(2,4) : ''; btn.textContent = (diaAbrev[d]||d) + ' ' + (FECHAS[d]||'') + (FECHAS[d] && _anio ? '/'+_anio : '');
      const marcar = ()=>{
        botones.forEach((b,i)=>{
          const sel = DIAS[i]===actual();
          b.style.borderColor = sel ? '#2563eb' : '#dfe1e6';
          b.style.background  = sel ? '#2563eb' : '#fff';
          b.style.color       = sel ? '#fff' : '#1a1d23';
        });
      };
      btn.style.cssText = 'padding:8px 4px;border-radius:8px;border:1.5px solid #dfe1e6;background:#fff;color:#1a1d23;font-family:\'Segoe UI\',sans-serif;font-size:11px;font-weight:700;cursor:pointer;';
      btn.onclick = ()=>{ onElegir(d); marcar(); };
      botones.push(btn);
      grid.appendChild(btn);
    });
    body.appendChild(grid);
    botones.forEach((b,i)=>{
      const sel = DIAS[i]===actual();
      b.style.borderColor = sel ? '#2563eb' : '#dfe1e6';
      b.style.background  = sel ? '#2563eb' : '#fff';
      b.style.color       = sel ? '#fff' : '#1a1d23';
    });
  }

  filaDias('Copiar DESDE (origen)', ()=>diaOrigen, (d)=>{ diaOrigen = d; });
  filaDias('Copiar HACIA (destino)', ()=>diaDestino, (d)=>{ diaDestino = d; });

  const modoLbl = mk('div','');
  modoLbl.style.cssText = 'font-family:\'Segoe UI\',sans-serif;font-size:11px;font-weight:700;color:#5a6170;margin:10px 0 6px;text-transform:uppercase;letter-spacing:.4px;';
  modoLbl.textContent = 'Qué copiar';
  body.appendChild(modoLbl);
  const modoRow = mk('div','');
  modoRow.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-bottom:14px;';
  const btnTodo = document.createElement('button');
  btnTodo.textContent = 'Todo el equipo';
  const btnCampo = document.createElement('button');
  btnCampo.textContent = 'Solo el campo';
  const btnInferiores = document.createElement('button');
  btnInferiores.textContent = 'Solo cuadros inferiores (lesionados/otros/promocionados)';
  [btnTodo, btnCampo, btnInferiores].forEach(b=>{
    b.style.cssText = 'padding:10px;border-radius:10px;border:1.5px solid #dfe1e6;background:#fff;color:#1a1d23;font-family:\'Segoe UI\',sans-serif;font-size:12px;font-weight:700;cursor:pointer;';
  });
  function marcarModo(){
    btnTodo.style.background  = modo==='todo' ? '#2563eb' : '#fff';
    btnTodo.style.color       = modo==='todo' ? '#fff' : '#1a1d23';
    btnTodo.style.borderColor = modo==='todo' ? '#2563eb' : '#dfe1e6';
    btnCampo.style.background  = modo==='campo' ? '#2563eb' : '#fff';
    btnCampo.style.color       = modo==='campo' ? '#fff' : '#1a1d23';
    btnCampo.style.borderColor = modo==='campo' ? '#2563eb' : '#dfe1e6';
    btnInferiores.style.background  = modo==='inferiores' ? '#2563eb' : '#fff';
    btnInferiores.style.color       = modo==='inferiores' ? '#fff' : '#1a1d23';
    btnInferiores.style.borderColor = modo==='inferiores' ? '#2563eb' : '#dfe1e6';
  }
  btnTodo.onclick = ()=>{ modo='todo'; marcarModo(); };
  btnCampo.onclick = ()=>{ modo='campo'; marcarModo(); };
  btnInferiores.onclick = ()=>{ modo='inferiores'; marcarModo(); };
  marcarModo();
  modoRow.appendChild(btnTodo); modoRow.appendChild(btnCampo); modoRow.appendChild(btnInferiores);
  body.appendChild(modoRow);

  const aviso = mk('div','');
  aviso.style.cssText = 'font-family:\'Segoe UI\',sans-serif;font-size:11px;color:#9ca3af;margin-bottom:14px;line-height:1.4;';
  aviso.textContent = 'Se sobrescribirá lo que hubiera en el día destino para este equipo. Si algún jugador está prestado en otro equipo ese día, se le quitará de ahí primero.';
  body.appendChild(aviso);

  const btnRow = mk('div','');
  btnRow.style.cssText = 'display:flex;gap:8px;';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.style.cssText = 'flex:1;padding:10px;border-radius:10px;border:1px solid #dfe1e6;background:transparent;color:#5a6170;font-family:\'Segoe UI\',sans-serif;font-size:13px;font-weight:700;cursor:pointer;';
  const okBtn = document.createElement('button');
  okBtn.textContent = 'Copiar';
  okBtn.style.cssText = 'flex:1;padding:10px;border-radius:10px;border:none;background:#2563eb;color:#fff;font-family:\'Segoe UI\',sans-serif;font-size:13px;font-weight:700;cursor:pointer;';
  btnRow.appendChild(cancelBtn); btnRow.appendChild(okBtn);
  body.appendChild(btnRow);

  box.appendChild(hdr); box.appendChild(body);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  function cerrar(){ overlay.remove(); }
  cancelBtn.onclick = cerrar;
  overlay.onclick = (e)=>{ if(e.target===overlay) cerrar(); };
  okBtn.onclick = ()=>{
    if(diaOrigen === diaDestino){ toast('⚠️ Elige un día destino distinto al origen'); return; }
    cerrar();
    copiarEquipoDeDiaADia(eq, diaOrigen, diaDestino, modo);
  };
}
function copiarEquipoDeDiaADia(eq, diaOrigen, diaDestino, modo){
  const origenData = data[diaOrigen]?.[eq];
  if(!origenData){ toast('❌ No hay datos de '+eq+' en '+diaOrigen); return; }

  const zonasACopiar = modo === 'campo' ? ['campo']
    : modo === 'inferiores' ? ['lesionados','otros','promovidos_1er','extra']
    : ZONAS.slice();
  const nombresACopiar = new Set();
  zonasACopiar.forEach(z=>(origenData[z]||[]).forEach(n=>nombresACopiar.add(n)));

  EQUIPOS.forEach(otroEq=>{
    if(otroEq === eq) return;
    ZONAS.forEach(z=>{
      const arr = data[diaDestino]?.[otroEq]?.[z];
      if(!arr) return;
      nombresACopiar.forEach(n=>{
        const i = arr.indexOf(n);
        if(i>=0){ arr.splice(i,1); if(z==='campo') delete pos[key(diaDestino,otroEq,n)]; }
      });
    });
    if(promInfo[diaDestino]?.[otroEq]){
      nombresACopiar.forEach(n=>{ delete promInfo[diaDestino][otroEq][n]; });
    }
  });

  if(!data[diaDestino][eq]) data[diaDestino][eq] = {};
  ZONAS.forEach(z=>{ if(!data[diaDestino][eq][z]) data[diaDestino][eq][z] = []; });
  if(modo === 'campo'){
    data[diaDestino][eq].campo = [...(origenData.campo||[])];
    (origenData.campo||[]).forEach(n=>{
      const p = pos[key(diaOrigen,eq,n)];
      if(p) pos[key(diaDestino,eq,n)] = [...p];
    });
  } else if(modo === 'inferiores'){
    zonasACopiar.forEach(z=>{
      data[diaDestino][eq][z] = [...(origenData[z]||[])];
    });
    if(!promInfo[diaDestino]) promInfo[diaDestino] = {};
    promInfo[diaDestino][eq] = JSON.parse(JSON.stringify(promInfo[diaOrigen]?.[eq] || {}));
    const disp = data[diaDestino][eq].disponibles;
    if(Array.isArray(disp)){
      nombresACopiar.forEach(n=>{
        const i = disp.indexOf(n);
        if(i>=0) disp.splice(i,1);
      });
    }
  } else {
    ZONAS.forEach(z=>{
      data[diaDestino][eq][z] = [...(origenData[z]||[])];
    });
    (origenData.campo||[]).forEach(n=>{
      const p = pos[key(diaOrigen,eq,n)];
      if(p) pos[key(diaDestino,eq,n)] = [...p];
    });
    if(!promInfo[diaDestino]) promInfo[diaDestino] = {};
    promInfo[diaDestino][eq] = JSON.parse(JSON.stringify(promInfo[diaOrigen]?.[eq] || {}));
  }
  autoGuardar();
  render();
  const etiquetaModo = modo==='campo' ? 'solo campo' : (modo==='inferiores' ? 'solo cuadros inferiores' : 'todo');
  toast('⧉ '+eq+' copiado de '+diaOrigen+' a '+diaDestino+' ('+etiquetaModo+')');
}
function abrirDiaAplicaModal(nombre, eqViejo, nuevoEq, onConfirmar, onCancelar){
  const idxHoy = diaHoyIdx();
  const overlay = mk('div','');
  overlay.id = 'dia-aplica-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10400;background:rgba(0,0,0,.4);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:calc(24px + env(safe-area-inset-top,0px)) 16px 24px;backdrop-filter:blur(4px);';
  const box = mk('div','');
  box.style.cssText = 'width:100%;max-width:380px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.15);';
  const hdr = mk('div','');
  hdr.style.cssText = 'background:#2563eb;padding:14px 18px;';
  hdr.innerHTML = `<div style="font-family:'Segoe UI',sans-serif;font-size:14px;font-weight:800;color:#fff;">${eqViejo===nuevoEq ? nombre+': ¿desde qué día?' : nombre+': '+eqViejo+' → '+nuevoEq}</div>`;
  const body = mk('div','');
  body.style.cssText = 'padding:16px 18px;';
  const sub = mk('div','');
  sub.style.cssText = 'font-family:\'Segoe UI\',sans-serif;font-size:12px;color:#5a6170;margin-bottom:12px;';
  sub.textContent = '¿Desde qué día aplica este cambio? Los días anteriores no se tocan.';
  body.appendChild(sub);
  const grid = mk('div','');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:14px;';
  const diaAbrev = {'LUNES':'L','MARTES':'M','MIÉRCOLES':'X','JUEVES':'J','VIERNES':'V','SÁBADO':'S','DOMINGO':'D'};
  let diaElegidoIdx = idxHoy;
  const botones = [];
  DIAS.forEach((d,i)=>{
    const btn = document.createElement('button');
    const esPasado = i < idxHoy;
    const _fc = (window.FECHAS_COMPLETAS||{})[d]; const _anio = _fc ? _fc.slice(2,4) : ''; btn.textContent = (diaAbrev[d]||d) + ' ' + (FECHAS[d]||'') + (FECHAS[d] && _anio ? '/'+_anio : '');
    btn.disabled = esPasado;
    btn.style.cssText = `padding:8px 4px;border-radius:8px;border:1.5px solid ${i===idxHoy?'#2563eb':'#dfe1e6'};background:${i===idxHoy?'#2563eb':(esPasado?'#f0f4fa':'#fff')};color:${i===idxHoy?'#fff':(esPasado?'#b4b9c4':'#1a1d23')};font-family:'Segoe UI',sans-serif;font-size:11px;font-weight:700;cursor:${esPasado?'not-allowed':'pointer'};`;
    if(!esPasado){
      btn.onclick = ()=>{
        diaElegidoIdx = i;
        botones.forEach((b,bi)=>{
          b.style.borderColor = bi===i ? '#2563eb' : '#dfe1e6';
          b.style.background = bi===i ? '#2563eb' : '#fff';
          b.style.color = bi===i ? '#fff' : '#1a1d23';
        });
      };
    }
    botones.push(btn);
    grid.appendChild(btn);
  });
  body.appendChild(grid);
  const btnRow = mk('div','');
  btnRow.style.cssText = 'display:flex;gap:8px;';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.style.cssText = 'flex:1;padding:10px;border-radius:10px;border:1px solid #dfe1e6;background:transparent;color:#5a6170;font-family:\'Segoe UI\',sans-serif;font-size:13px;font-weight:700;cursor:pointer;';
  const okBtn = document.createElement('button');
  okBtn.textContent = 'Aplicar';
  okBtn.style.cssText = 'flex:1;padding:10px;border-radius:10px;border:none;background:#2563eb;color:#fff;font-family:\'Segoe UI\',sans-serif;font-size:13px;font-weight:700;cursor:pointer;';
  btnRow.appendChild(cancelBtn); btnRow.appendChild(okBtn);
  body.appendChild(btnRow);
  box.appendChild(hdr); box.appendChild(body);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  function cerrar(){ overlay.remove(); }
  cancelBtn.onclick = ()=>{ cerrar(); if(onCancelar) onCancelar(); };
  okBtn.onclick = ()=>{ cerrar(); if(onConfirmar) onConfirmar(diaElegidoIdx); };
  overlay.onclick = (e)=>{ if(e.target===overlay){ cerrar(); if(onCancelar) onCancelar(); } };
}
function countLabel(eq,campo){
  let p=0,j=0;
  campo.forEach((n)=>{ if(porteros.includes(n)) p++; else j++; });
  return p===0 ? campo.length+'' : j+'+'+p+'P';
}
function updateCount(eq){
  const el=document.getElementById('count-'+eq.replace(/ /g,'_'));
  if(!el) return;
  const campo = data[dia][eq]?.campo||[];
  const countTxt = campo.length ? countLabel(eq,campo) : '';
  el.innerHTML = eq + (countTxt ? `<span style="margin-left:8px;font-size:12px;color:#9ca3af;font-weight:700;">${countTxt}</span>` : '');
}
// ══════════════════════════════════════════════════
// SNAP AL SLOT MÁS CERCANO
// ══════════════════════════════════════════════════
function posOcupadas(eq, nombreMovido){
  const campo = data[dia][eq].campo;
  return campo
    .filter(n => n !== nombreMovido)
    .map((n,i) => pos[key(dia,eq,n)] || POS_DEF[i % POS_DEF.length] || [50,50]);
}
var GAP_V = 2;
var GAP_H = 4;
function distMinOcupadas(t, l, ocupadas, gaps){
  if(!ocupadas.length) return 999;
  const gV = gaps?.gapV ?? GAP_V;
  const gH = gaps?.gapH ?? GAP_H;
  let peor = 999;
  ocupadas.forEach(([ot,ol])=>{
    const dt = Math.abs(t-ot), dl = Math.abs(l-ol);
    const faltaV = Math.max(0, gV - dt);
    const faltaH = Math.max(0, gH - dl);
    if(faltaV > 0 && faltaH > 0){
      const gravedad = Math.max(faltaV, faltaH);
      peor = Math.min(peor, RADIO_MIN - gravedad);
    }
  });
  return peor;
}
var RADIO_MIN = 4;
function snapToGrid(eq, nombre, rawTop, rawLeft, gaps){
  const ocupadas = posOcupadas(eq, nombre);
  const gV = gaps?.gapV ?? GAP_V;
  const gH = gaps?.gapH ?? GAP_H;
  if(distMinOcupadas(rawTop, rawLeft, ocupadas, gaps) >= RADIO_MIN){
    return [rawTop, rawLeft];
  }
  let masCercanaIdx = -1, menorDist = Infinity;
  ocupadas.forEach(([ot,ol], i)=>{
    const d = Math.hypot(rawTop-ot, rawLeft-ol);
    if(d < menorDist){ menorDist = d; masCercanaIdx = i; }
  });
  if(masCercanaIdx >= 0){
    const [ot, ol] = ocupadas[masCercanaIdx];
    const dt = rawTop - ot, dl = rawLeft - ol;
    const nx = dl / gH, ny = dt / gV;
    const dist = Math.hypot(nx, ny);
    let t, l;
    if(dist < 1e-6){
      t = clamp(rawTop, 0, 100);
      l = clamp(ol + gH, 0, 100);
    } else {
      const factor = 1 / dist;
      t = clamp(ot + ny * gV * factor, 0, 100);
      l = clamp(ol + nx * gH * factor, 0, 100);
    }
    if(distMinOcupadas(t, l, ocupadas, gaps) >= RADIO_MIN){
      return [t, l];
    }
  }
  const step = Math.max(1.5, gV/2);
  for(let radio = step; radio <= Math.max(gH,gV) * 3; radio += step){
    for(let ang = 0; ang < 360; ang += 30){
      const rad = ang * Math.PI / 180;
      const t = clamp(rawTop  + radio * Math.sin(rad), 0, 100);
      const l = clamp(rawLeft + radio * Math.cos(rad), 0, 100);
      if(distMinOcupadas(t, l, ocupadas, gaps) >= RADIO_MIN){
        return [t, l];
      }
    }
  }
  return [rawTop, rawLeft];
}
function autoAlinear(eq, diaP){
  diaP = diaP || dia;
  const campo = data[diaP][eq].campo;
  if(campo.length === 0) return;
  const asignados = new Set();
  campo.forEach((nombre) => {
    let idx = 0;
    while(idx < SNAP_SLOTS.length && asignados.has(idx)) idx++;
    const [t,l] = SNAP_SLOTS[idx] || [50, 50];
    asignados.add(idx);
    savePos(diaP, eq, nombre, t, l);
  });
  autoGuardar();
  render();
  toast('⊞ '+eq+' reordenado sin solapes ('+diaP+')');
}
// ══════════════════════════════════════════════════
// AUTOCOMPLETE — desplegable para añadir jugadores
// ══════════════════════════════════════════════════
function candidatos(eq, zona, diaParam){
  const d0 = diaParam || dia;
  const todos = new Set();
  EQUIPOS.forEach(e=>{
    if(e===eq) return;
    (plantillas[e]||[]).forEach(n=>todos.add(n));
  });
  DIAS.forEach(d=> EQUIPOS.forEach(e=>{
    if(e===eq) return;
    ZONAS.forEach(z=> (data[d][e][z]||[]).forEach(n=>todos.add(n)));
  }));
  const enZona = new Set(data[d0][eq][zona]||[]);
  const enEquipo = new Set();
  ZONAS.forEach(z=>(data[d0][eq][z]||[]).forEach(n=>enEquipo.add(n)));
  return [...todos]
    .filter(n=>!enZona.has(n) && !enEquipo.has(n))
    .sort((a,b)=>{
      const idxA=EQUIPOS.indexOf(origen[a]||''), idxB=EQUIPOS.indexOf(origen[b]||'');
      if(idxA!==idxB) return idxA-idxB;
      return a.localeCompare(b,'es');
    });
}
function buildAddInput(eq, zona){
  const diaLocal = dia;
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
    const todos = candidatos(eq,zona,diaLocal).filter(n=>!q||n.toLowerCase().includes(q));
    const hayResultados = todos.length > 0;
    if(hayResultados){
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
    if(list.children.length>0) list.classList.add('open');
    else list.classList.remove('open');
  }
  function elegirPrueba(nombre){
    origen[nombre] = 'PRUEBA';
    data[diaLocal][eq].disponibles.push(nombre);
    toast('⚡ '+nombre+' añadido a prueba en '+eq);
    input.value=''; list.classList.remove('open');
    render();
  }
  function elegir(nombre){
    const eqPropio = origen[nombre];
    const esPromocionCruzada = eqPropio && eqPropio !== eq && eqPropio !== 'PRUEBA';

    if(esPromocionCruzada){
      ZONAS_ACTIVAS.forEach(z=>{
        const arr = data[diaLocal][eqPropio]?.[z];
        if(!arr) return;
        const i = arr.indexOf(nombre);
        if(i>=0){ arr.splice(i,1); if(z==='campo') delete pos[key(diaLocal,eqPropio,nombre)]; }
      });
      ejecutarPromocion(nombre, eqPropio, eq, diaLocal);
      toast(nombre+' promocionado a '+eq);
      input.value=''; list.classList.remove('open');
      render();
      return;
    }

    ZONAS_ACTIVAS.forEach(z=>{
      if(z===zona) return;
      const arr = data[diaLocal][eq]?.[z];
      if(arr){
        const i = arr.indexOf(nombre);
        if(i>=0){ arr.splice(i,1); if(z==='campo') delete pos[key(diaLocal,eq,nombre)]; }
      }
    });
    if(zona==='campo'){
      const ocupadas = posOcupadas(eq, nombre);
      let bestIdx = 0;
      for(let i = 0; i < SNAP_SLOTS.length; i++){
        const [t,l] = SNAP_SLOTS[i];
        if(distMinOcupadas(t, l, ocupadas) >= RADIO_MIN){ bestIdx = i; break; }
        bestIdx = i;
      }
      const [t,l] = SNAP_SLOTS[bestIdx] || [50,50];
      savePos(diaLocal,eq,nombre,t,l);
    }
    data[diaLocal][eq][zona].push(nombre);
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
  const actLbl = document.getElementById('fb-sesion-activa-lbl');
  if(actLbl) actLbl.textContent = _fbSesionActiva ? '🔄 Sync: '+_fbSesionActiva : 'Sin sesión activa';
  const inp = document.getElementById('fb-nueva-inp');
  if(inp){
    // Vacío a propósito: hay que escribir un nombre siempre, no se autorrellena para
    // evitar guardar sin querer con el nombre por defecto sin fijarse.
    inp.value = '';
    const hoy = new Date();
    inp.placeholder = 'Ej: Backup ' + String(hoy.getDate()).padStart(2,'0') + '/' + String(hoy.getMonth()+1).padStart(2,'0') + '/' + hoy.getFullYear();
  }
  actualizarBotonGuardarFb();
  renderFbLista();
}
// El botón "Guardar" está deshabilitado hasta que hay texto real en el nombre —
// obliga a escribir siempre, no solo un aviso que se puede pasar por alto.
function actualizarBotonGuardarFb(){
  const inp = document.getElementById('fb-nueva-inp');
  const btn = document.getElementById('fb-guardar-btn');
  if(!inp || !btn) return;
  const hayNombre = inp.value.trim().length > 0;
  btn.disabled = !hayNombre;
  btn.style.opacity = hayNombre ? '1' : '.5';
  btn.style.cursor = hayNombre ? 'pointer' : 'not-allowed';
}
function cerrarFbPanel(){
  document.getElementById('fb-overlay').classList.remove('open');
}
// Mostrar/ocultar el desplegable "Desde la nube" con los últimos backups (máx 5)
function toggleFbLista(){
  const lista = document.getElementById('fb-lista');
  const btn = document.getElementById('fb-nube-toggle-btn');
  if(!lista) return;
  const abierto = lista.style.display !== 'none';
  lista.style.display = abierto ? 'none' : 'block';
  if(btn) btn.textContent = (abierto ? '☁️ Desde la nube ▾' : '☁️ Desde la nube ▴');
  if(!abierto) renderFbLista();
}
// Mantiene como máximo 5 backups en la nube (automáticos + manuales mezclados,
// ordenados por fecha) — borra los más antiguos que sobren. Nunca toca "principal"
// (esa es la sesión en vivo, no un backup).
async function limpiarSesionesAntiguas(maxGuardados){
  maxGuardados = maxGuardados || 5;
  try{
    const res = await window.fbListarSesiones();
    if(!res || !res.ok) return;
    const sesiones = (Array.isArray(res.data) ? res.data : [])
      .filter(s => (s._nombre || s.id) !== 'principal');
    sesiones.sort((a,b)=> (b._ts?.seconds||0) - (a._ts?.seconds||0));
    const sobran = sesiones.slice(maxGuardados);
    for(const s of sobran){
      await window.fbEliminarSesion(s._nombre || s.id);
    }
  }catch(e){ console.warn('limpiarSesionesAntiguas error:', e); }
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
  const sesiones = (Array.isArray(res.data) ? res.data : [])
    .filter(s => (s._nombre || s.id) !== 'principal');
  if(!sesiones.length){
    lista.innerHTML = '<div class="fb-empty">No hay backups todavía</div>';
    return;
  }
  sesiones.sort((a,b)=> (b._ts?.seconds||0) - (a._ts?.seconds||0));
  lista.innerHTML = '';
  sesiones.slice(0,5).forEach(s=>{
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
  const payload = buildPayload(false);
  const res = await window.fbGuardarSesion(nombre, payload);
  if(res.ok){
    _fbSesionActiva = nombre;
    toast('✅ Guardado en la nube: '+nombre);
    inp.value = '';
    await limpiarSesionesAntiguas(); // mantener solo los 5 últimos backups
    renderFbLista();
    exportarDatos();
    exportarPDF();
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
  
  for(const d of DIAS) for(const e of EQUIPOS){
    if(!data[d])    data[d]={};
    if(!data[d][e]) data[d][e]={};
    for(const z of ZONAS) if(!data[d][e][z]) data[d][e][z]=[];
  }
  DIAS.forEach(d=>{ if(!promInfo[d]) promInfo[d]={}; EQUIPOS.forEach(eq=>{ if(!promInfo[d][eq]) promInfo[d][eq]={}; }); });
  EQUIPOS.forEach(eq=>{
    if(!colNames[eq]) colNames[eq]=['PROMOCIONADOS','LESIONADOS','OTROS'];
    
  });
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
  if(!payload.origen || Object.keys(payload.origen).length===0){
    EQUIPOS.forEach(eq=>{
      (plantillas[eq]||[]).forEach(nombre=>{ origen[nombre]=eq; });
    });
  }
  _fbSesionActiva = nombre;
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
async function limpiarCamposResidualesConfirmar(){
  if(!window._fbReady){ toast('⏳ Firebase no conectado'); return; }
  toast('🔍 Comprobando...');
  const chk = await window.fbContarCamposResiduales(_fbSesionActiva || 'principal');
  if(!chk || !chk.ok){
    toast('❌ No se pudo comprobar: '+(chk && chk.message || ''));
    return;
  }
  if(!chk.campos.length){
    toast('✅ No hay campos residuales que limpiar — ya está todo limpio');
    return;
  }
  showAlert(
    '🧹 Se han encontrado '+chk.campos.length+' campos antiguos sin uso ("data_por_eq.*"/"prominfo_por_eq.*", restos de una función ya revertida). Se borrarán SOLO esos — no toca plantillas, jugadores, histórico ni nada que uses ahora. ¿Confirmas?',
    async ()=>{
      toast('🧹 Limpiando...');
      const res = await window.fbLimpiarCamposResiduales(_fbSesionActiva || 'principal');
      if(res && res.ok){
        toast(res.borrados > 0 ? '✅ '+res.borrados+' campos residuales borrados' : 'ℹ️ No había campos residuales que borrar');
        console.log('[limpieza] campos borrados:', res.campos || []);
      } else {
        toast('❌ Error al limpiar: '+(res && res.message || ''));
      }
    },
    'Sí, limpiar'
  );
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
document.addEventListener('DOMContentLoaded',()=>{
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
  window.addEventListener('firebase-ready', ()=>{
    if(window._fbPlantillas){
      const hayLocal = false;
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
var _fotoEqsSel = new Set();
function abrirFotoMultiModal(){
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
// Captura la foto de UN solo campo (un equipo, el día actual). SOLO se ve el campo
// verde con los jugadores — se ocultan temporalmente los iconos de la cabecera
// (descansa/entreno/reset/etc.) y el bloque de Disponibles/Banquillo/columnas de abajo
// mientras se hace la captura, y se restauran justo después (nunca se borran de verdad).
async function capturarCampo(eq, card){
  if(!card){ card = document.querySelector(`[data-eq-card="${eq}"]`); }
  if(!card){ toast('❌ No se encontró la tarjeta de '+eq); return; }
  toast('📷 Generando foto de '+eq+'…');
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const elsAOcultar = [
    card.querySelector('.card-hdr-right'),
    card.querySelector('.zona-disponibles'),
  ].filter(Boolean);
  const estilosPrevios = elsAOcultar.map(el => el.style.display);
  try{
    elsAOcultar.forEach(el => { el.style.display = 'none'; });
    const shieldEl = card.querySelector('.campo-shield');
    if(shieldEl) shieldEl.style.visibility = 'hidden';
    const fc = await html2canvas(card, {
      scale: 2, useCORS: true, allowTaint: true,
      backgroundColor: '#ffffff', logging: false, imageTimeout: 0
    });
    if(shieldEl) shieldEl.style.visibility = '';
    fc.toBlob(blob=>{
      if(!blob){ toast('❌ Error generando imagen'); return; }
      const blobUrl = URL.createObjectURL(blob);
      let ov = document.getElementById('photo-ov');
      if(ov) ov.remove();
      ov = document.createElement('div');
      ov.id = 'photo-ov';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.97);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:16px;box-sizing:border-box;overflow-y:auto;-webkit-overflow-scrolling:touch;';
      const instruccion = isIOS
        ? '📥 Mantén pulsada la imagen → <b>Añadir a Fotos</b>'
        : '📥 Mantén pulsada la imagen para guardarla';
      const p = document.createElement('p');
      p.innerHTML = instruccion;
      p.style.cssText = 'color:#ffd700;font-family:sans-serif;font-size:15px;text-align:center;margin:0;font-weight:700;';
      const imgEl = document.createElement('img');
      imgEl.src = blobUrl;
      imgEl.style.cssText = 'max-width:100%;max-height:72vh;border-radius:8px;border:2px solid #ffd700;display:block;';
      const btnC = document.createElement('button');
      btnC.textContent = 'Cerrar';
      btnC.style.cssText = 'padding:13px 36px;background:#ffd700;border:none;border-radius:12px;font-weight:700;font-size:16px;cursor:pointer;';
      btnC.onclick = ()=>{ ov.remove(); URL.revokeObjectURL(blobUrl); };
      ov.appendChild(p); ov.appendChild(imgEl); ov.appendChild(btnC);
      document.body.appendChild(ov);
    }, 'image/png');
  }catch(e){ toast('❌ Error: '+e.message); }
  finally{
    elsAOcultar.forEach((el,i) => { el.style.display = estilosPrevios[i] || ''; });
  }
}
async function generarFotoMulti(){
  if(!_fotoEqsSel.size){ toast('Selecciona al menos un equipo'); return; }
  if(_fotoEqsSel.size === 1){
    const eq = [..._fotoEqsSel][0];
    const card = document.querySelector(`[data-eq-card="${eq}"]`);
    if(card){ cerrarFotoMultiModal(); capturarCampo(eq, card); return; }
  }
  cerrarFotoMultiModal();
  toast('Generando foto conjunta…');
  const equiposOrden = EQUIPOS.filter(e => _fotoEqsSel.has(e));
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  try{
    const capturas = [];
    for(const eq of equiposOrden){
      const card = document.querySelector(`[data-eq-card="${eq}"]`);
      if(!card) continue;
      const cWrap = card.querySelector('.campo-wrap');
      if(!cWrap) continue;
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
    const W = 800;
    const _fc0 = capturas[0].fc;
    const BLOQUE_H = Math.round(W * (_fc0.height / _fc0.width));
    const HDR_H = 36;
    const SEP = 6;
    const TOP_H = 60;
    const H = TOP_H + capturas.length * (HDR_H + BLOQUE_H + SEP);
    const DPR2 = Math.min(window.devicePixelRatio || 2, 3);
    const cv = document.createElement('canvas');
    cv.width = W * DPR2; cv.height = H * DPR2;
    cv.style.width  = W + 'px';
    cv.style.height = H + 'px';
    const ctx = cv.getContext('2d');
    ctx.scale(DPR2, DPR2);
    ctx.fillStyle = '#07101e';
    ctx.fillRect(0,0,W,H);
    const grad = ctx.createLinearGradient(0,0,W,0);
    grad.addColorStop(0,'#001a52'); grad.addColorStop(1,'#0a1628');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,W,TOP_H);
    ctx.fillStyle='#C8A800';
    ctx.fillRect(0,TOP_H-1,W,1);
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
    let yOff = TOP_H;
    for(const {eq, fc} of capturas){
      const dotColor = EQ_DOT_COLORS[eq]||'#888';
      ctx.fillStyle = 'rgba(255,255,255,.04)';
      ctx.fillRect(0, yOff, W, HDR_H);
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(20, yOff+HDR_H/2, 5, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle='#fff';
      ctx.font='bold 16px sans-serif';
      ctx.textBaseline='middle';
      ctx.fillText(eq, 34, yOff+HDR_H/2);
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
      ctx.drawImage(fc, 0, yOff, W, BLOQUE_H);
      yOff += BLOQUE_H + SEP;
    }
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
var _controlDia = null;
var _controlEqsActivos = new Set(['1ER EQUIPO', ...EQUIPOS]);
function abrirControl(){
  document.getElementById('control-overlay').classList.add('open');
  _controlDia = dia;
  const hoy = new Date();
  DIAS.forEach(d=>{
    const [dd,mm] = (FECHAS[d]||'').split('/');
    if(dd && mm && parseInt(dd)===hoy.getDate() && parseInt(mm)===(hoy.getMonth()+1)){
      _controlDia = d;
    }
  });
  _controlEqsActivos = new Set(['1ER EQUIPO', ...EQUIPOS]);
  renderControlDiaBtns();
  renderControlEqsRow();
  renderControl();
}
function renderControlDiaBtns(){
  const wrap = document.getElementById('control-dia-btns');
  wrap.innerHTML = '';
  const DIA_INICIAL = {'LUNES':'L','MARTES':'M','MIÉRCOLES':'X','JUEVES':'J','VIERNES':'V','SÁBADO':'S','DOMINGO':'D'};
  DIAS.forEach(d=>{
    const b = document.createElement('button');
    b.className = 'filtro-eq-btn'+(d===_controlDia?' activo':'');
    const _fc = (window.FECHAS_COMPLETAS||{})[d];
    const _anio = _fc ? _fc.slice(2,4) : new Date().getFullYear().toString().slice(2);
    b.textContent = DIA_INICIAL[d] + (FECHAS[d] ? ' ' + FECHAS[d] + '/' + _anio : '');
    b.onclick = ()=>{ cambiarControlDia(d); renderControlDiaBtns(); };
    wrap.appendChild(b);
  });
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
  ['1ER EQUIPO'].concat(EQUIPOS).forEach(eq=>{
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
function jugadoresHistoricosDeEquipo(diaP, eq){
  const historico = historicoJugador[diaP];
  if(historico && Object.keys(historico).length){
    return Object.keys(historico).filter(n => historico[n].equipoOrigen === eq);
  }
  return plantillas[eq] || [];
}
function getEstadoJugador(nombre, eq, diaP){
  const diaC = diaP || dia;
  const d = data[diaC][eq];
  if(!d) return {estado:'vacio', multi:false};
  if(esDescanso(eq, diaC)) return {estado:'descansa', multi:false};
  const eqsActivos = eqsDeNombre(diaC, nombre);
  const multi = eqsActivos.length > 1;
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
    case 'descansa':  return '💤 Descansa';
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
  const eqsVisibles = (_controlEqsActivos.has('1ER EQUIPO') ? ['1ER EQUIPO'] : []).concat(EQUIPOS.filter(eq=>_controlEqsActivos.has(eq)));
  const oldColgroup = document.getElementById('control-colgroup');
  if(oldColgroup) oldColgroup.remove();
  const colgroup = document.createElement('colgroup');
  colgroup.id = 'control-colgroup';
  eqsVisibles.forEach(()=>{
    const colJ = document.createElement('col'); colJ.style.width='150px';
    const colE = document.createElement('col'); colE.style.width='90px';
    colgroup.appendChild(colJ); colgroup.appendChild(colE);
  });
  document.getElementById('control-table').insertBefore(colgroup, document.getElementById('control-table').firstChild);
  const trH1 = document.createElement('tr');
  eqsVisibles.forEach(eq=>{
    const color = eq==='1ER EQUIPO' ? '#000' : (EQ_DOT_COLORS[eq]||'#888');
    const th = document.createElement('th');
    th.className = 'th-eq-grupo';
    th.colSpan = 2;
    let countStr;
    if(eq==='1ER EQUIPO'){
      countStr = (primerEquipoJugadores[diaC]||[]).length + '/' + (plantillas['1ER EQUIPO']||[]).length;
    } else {
      const totalJugs = (plantillas[eq]||[]).length;
      const enCampo = (data[diaC][eq]?.campo||[]).length;
      const prestados = EQUIPOS.filter(e=>e!==eq).reduce((acc,e)=>
        acc + (data[diaC][e]?.campo||[]).filter(n=>origen[n]===eq).length, 0);
      countStr = enCampo > 0 ? `${enCampo}${prestados>0?'+'+prestados:''}` : `${totalJugs}`;
    }
    th.innerHTML = `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${color};margin-right:6px;vertical-align:middle;"></span>${eqsShort[eq]||eq}<span style="margin-left:8px;color:rgba(255,255,255,.45);font-weight:700;">${countStr}</span>`;
    trH1.appendChild(th);
  });
  thead.appendChild(trH1);
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
  const maxJug = Math.max(...eqsVisibles.map(eq=>eq==='1ER EQUIPO' ? (plantillas[eq]||[]).length : jugadoresHistoricosDeEquipo(diaC,eq).length), 0);
  for(let i=0; i<maxJug; i++){
    const tr = document.createElement('tr');
    eqsVisibles.forEach(eq=>{
      const jugs = eq==='1ER EQUIPO' ? (plantillas[eq]||[]) : jugadoresHistoricosDeEquipo(diaC,eq);
      const tdJ = document.createElement('td');
      tdJ.className = 'td-jugador';
      const tdE = document.createElement('td');
      tdE.className = 'td-estado-cel';
      if(i < jugs.length){
        const nombre = jugs[i];
        tdJ.textContent = nombre;
        if(eq==='1ER EQUIPO'){
          const enCampo1er = (primerEquipoJugadores[diaC]||[]).includes(nombre);
          const eqsActivosArr = eqsDeNombre(diaC, nombre).map(e=>e==='1ER EQUIPO'?'1ER':(eqsShort[e]||e));
          if(eqsActivosArr.length>1){
            tdJ.classList.add('td-multi'); tdE.classList.add('td-multi');
            const etiqueta = eqsActivosArr.length>=3 ? 'TRIPLE' : 'DOBLE';
            tdE.innerHTML = `<span class="ctrl-badge ctrl-multi">⚡ ${etiqueta}: ${eqsActivosArr.join('+')}</span>`;
          } else if(enCampo1er){
            tdE.classList.add('td-campo');
            tdE.innerHTML = '<span class="ctrl-badge ctrl-campo">Campo</span>';
          } else {
            tdJ.classList.add('td-disponible'); tdE.classList.add('td-disponible');
            tdE.innerHTML = '<span class="ctrl-badge ctrl-disp">Disp.</span>';
          }
          tr.appendChild(tdJ); tr.appendChild(tdE);
          return;
        }
        const {estado, multi} = getEstadoJugador(nombre, eq, diaC);
        const isPor = porteros.includes(nombre);
        if(multi){
          tdJ.classList.add('td-multi');
          tdE.classList.add('td-multi');
          const eqsActivosArr = eqsDeNombre(diaC, nombre).map(e=>e==='1ER EQUIPO'?'1ER':(eqsShort[e]||e));
          const eqsActivos = eqsActivosArr.join('+');
          const etiqueta = eqsActivosArr.length>=3 ? 'TRIPLE' : 'DOBLE';
          tdE.innerHTML = `<span class="ctrl-badge ctrl-multi">⚡ ${etiqueta}: ${eqsActivos}</span>`;
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
            otros:    '<span class="ctrl-badge ctrl-otros">Otros</span>',
            descansa: '<span class="ctrl-badge ctrl-descansa">💤 Descansa</span>'
          };
          let lbl = badges[estado] || estado;
          if(estado==='promo' && promInfo[diaC]?.[eq]?.[nombre]){
            const dest=promInfo[diaC][eq][nombre];
            const destCorto = dest==='1ER EQUIPO'?'1ER':(eqsShort[dest]||dest);
            const esYL = dest==='JUVENIL A' && typeof esUYL==='function' && esUYL(diaC);
            lbl = esYL
              ? `<span class="ctrl-badge ctrl-uyl">⚽ YOUTH LEAGUE</span>`
              : `<span class="ctrl-badge ctrl-promo">↑ ${destCorto}</span>`;
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
var _promoCallback = null;
function abrirPromoDestModal(nombre, eqOrigen, callback, opcionesRestringidas){
  // opcionesRestringidas: array de nombres de equipo — si se pasa, se muestran SOLO
  // esos. Usado por "Otro equipo" de Castilla al arrastrar directo a esa columna
  // (solo RMC/JUVENIL A, sin 1ER EQUIPO). Para el resto de flujos (Duplicar, Cambiar,
  // Triplicar), Castilla ahora también pregunta — entre sus 2 destinos posibles.
  if(!opcionesRestringidas && eqOrigen === 'CASTILLA'){
    opcionesRestringidas = ['1ER EQUIPO','RMC','JUVENIL A'];
  }
  _promoCallback = callback;
  document.getElementById('promo-dest-title').textContent = '¿A qué equipo va '+nombre+'?';
  document.getElementById('promo-dest-sub').textContent = 'Equipo de origen: '+eqOrigen;
  const opts = document.getElementById('promo-dest-opts');
  opts.innerHTML='';
  if(opcionesRestringidas){
    opcionesRestringidas.forEach(eq=>{
      const opt=mk('div','promo-dest-opt');
      const color = eq==='1ER EQUIPO' ? '#C8A800' : (EQ_DOT_COLORS[eq]||'#888');
      opt.innerHTML=`<span class="promo-dest-dot" style="background:${color};"></span>
        <span class="promo-dest-nombre">${eq}</span>`;
      opt.onclick=()=>{ cerrarPromoDestModal(); callback(eq); };
      opts.appendChild(opt);
    });
    document.getElementById('promo-dest-overlay').classList.add('open');
    return;
  }
  const opt1er = mk('div','promo-dest-opt promo-dest-1er');
  opt1er.innerHTML=`<span class="promo-dest-dot" style="background:#C8A800;"></span>
    <span class="promo-dest-nombre">1ER EQUIPO</span>`;
  opt1er.onclick=()=>{ cerrarPromoDestModal(); callback('1ER EQUIPO'); };
  opts.appendChild(opt1er);
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
function ejecutarPromocion(nombre, eqOrigen, destino, diaP, zonaOrigenDestino){
  diaP = diaP || dia;
  // zonaOrigenDestino: en qué columna del equipo de ORIGEN se registra el jugador.
  // Por defecto "promovidos_1er" (Promocionados / Promoción a 1er Eq.). Para "Otros
  // equipos" de Castilla se pasa "extra" en su lugar — todo lo demás (promInfo,
  // duplicado en destino, histórico) funciona exactamente igual.
  zonaOrigenDestino = zonaOrigenDestino || 'promovidos_1er';
  if(!data[diaP][eqOrigen][zonaOrigenDestino]) data[diaP][eqOrigen][zonaOrigenDestino]=[];
  if(!data[diaP][eqOrigen][zonaOrigenDestino].includes(nombre)){
    data[diaP][eqOrigen][zonaOrigenDestino].push(nombre);
  }
  if(!promInfo[diaP]) promInfo[diaP]={};
  if(!promInfo[diaP][eqOrigen]) promInfo[diaP][eqOrigen]={};
  promInfo[diaP][eqOrigen][nombre]=destino;
  if(destino!=='1ER EQUIPO'){
    if(!data[diaP][destino]) data[diaP][destino]={campo:[],disponibles:[],promovidos_1er:[],lesionados:[],otros:[]};
    limpiarEquipoExcepto(nombre, destino, 'disponibles', diaP);
    if(!data[diaP][destino].disponibles.includes(nombre)){
      data[diaP][destino].disponibles.push(nombre);
    }
  }
  if(!historicoJugador[diaP]) historicoJugador[diaP] = {};
  if(!historicoJugador[diaP][nombre]){
    historicoJugador[diaP][nombre] = {
      equipoOrigen: eqOrigen,
      entrenoCon: destino,
      promocionado: true,
      promocionadoDesde: eqOrigen
    };
  }
  autoGuardar();
  render();
}
// ══════════════════════════════════════════════════
// CARD PRIMER EQUIPO
// ══════════════════════════════════════════════════
var primerEquipoJugadores = {};
function buildCardPrimerEquipo(){
  const card=mk('div','card');
  card.dataset.eqCard='1ER EQUIPO';
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
    <div class="campo-players"></div>`;
  const jugsHoy = primerEquipoJugadores[dia] || [];
  const pw=cWrap.querySelector('.campo-players');
  const dePromocion = [];
  EQUIPOS.forEach(eq=>{
    const prom = promInfo[dia]?.[eq]||{};
    Object.keys(prom).forEach(nombre=>{
      if(getDestinos(dia,eq,nombre).includes('1ER EQUIPO') && !dePromocion.includes(nombre)) dePromocion.push(nombre);
    });
  });
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
  const enCampo = new Set(jugsHoy);
  const nativos = (plantillas['1ER EQUIPO'] || []).filter(n=>!enCampo.has(n) && !dePromocion.includes(n));
  const disponiblesHoy = [...nativos, ...dePromocion.filter(n=>!enCampo.has(n))];
  const zDisp=mk('div','zona-disponibles dz');
  zDisp.dataset.eq='1ER EQUIPO'; zDisp.dataset.zona='disponibles';
  const lblD=mk('div','zona-lbl'); lblD.textContent='DISPONIBLES ('+disponiblesHoy.length+')';
  zDisp.appendChild(lblD);
  const cwD=mk('div','chips-wrap');
  disponiblesHoy.forEach(nombre=>{
    const eqOrig=origen[nombre]||'?';
    const eqsShort={'CASTILLA':'CAS','RMC':'RMC','JUVENIL A':'JA','JUVENIL B':'JB','JUVENIL C':'JC','CADETE A':'CA'};
    const c=chip(nombre,'1ER EQUIPO','disponibles','c-naranja','cz');
    if(eqOrig !== '1ER EQUIPO'){
      const s=document.createElement('span');
      s.className='chip-dest';
      s.textContent=' ('+( eqsShort[eqOrig]||eqOrig)+')';
      c.appendChild(s);
    }
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
var vistaActual = sessionStorage.getItem('rm_vista') || 'semana';
var eqsMultiSel = new Set(EQUIPOS);
function setView(n){
  vistaActual = n;
  sessionStorage.setItem('rm_vista', n);
  const grid = document.getElementById('grid');
  if(grid) grid.className = 'cards-grid view-'+n;
  ['1','2col','3col','semana'].forEach(v=>{
    const btn=document.getElementById('vbtn-'+v);
    if(btn) btn.classList.toggle('active', v===String(n));
  });
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
  const btnFoto=document.createElement('button');
  btnFoto.className='meq-btn meq-foto';
  btnFoto.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg> Foto`;
  btnFoto.onclick=()=>{
    _fotoEqsSel=new Set(eqsMultiSel);
    generarFotoMulti();
  };
  bar.appendChild(btnFoto);
}
function exportarPDF(){
  try{
    if(typeof window.jspdf === 'undefined'){ toast('❌ No se pudo cargar el generador de PDF'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'mm', format:'a4' });
    const margenIzq = 16;
    let y = 20;
    const anchoUtil = 210 - margenIzq*2;
    doc.setFont('helvetica','bold');
    doc.setFontSize(16);
    doc.setTextColor(37,99,235);
    doc.text('Real Madrid Cantera — Plantillas', margenIzq, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(120,120,120);
    doc.setFont('helvetica','normal');
    doc.text('Generado: '+new Date().toLocaleString('es-ES'), margenIzq, y);
    y += 10;
    const equiposOrden = ['1ER EQUIPO', ...EQUIPOS];
    equiposOrden.forEach(eq=>{
      const jugs = (plantillas[eq]||[]).slice().sort((a,b)=>a.localeCompare(b,'es'));
      if(y > 270){ doc.addPage(); y = 20; }
      doc.setFillColor(37,99,235);
      doc.rect(margenIzq, y-4.5, anchoUtil, 7, 'F');
      doc.setTextColor(255,255,255);
      doc.setFont('helvetica','bold');
      doc.setFontSize(11);
      doc.text(eq+'  ('+jugs.length+' jugadores)', margenIzq+3, y);
      y += 8;
      doc.setTextColor(30,30,30);
      doc.setFont('helvetica','normal');
      doc.setFontSize(10);
      if(!jugs.length){
        doc.setTextColor(150,150,150);
        doc.text('— sin jugadores —', margenIzq+3, y);
        y += 6;
      } else {
        const colAncho = anchoUtil/2;
        jugs.forEach((nombre,i)=>{
          if(y > 285){ doc.addPage(); y = 20; }
          const esPor = porteros.includes(nombre);
          const col = i % 2;
          const fila = Math.floor(i/2);
          const x = margenIzq + 3 + col*colAncho;
          const yy = y + fila*5.5;
          doc.text((i+1)+'. '+nombre+(esPor?' (POR)':''), x, yy);
        });
        const filas = Math.ceil(jugs.length/2);
        y += filas*5.5 + 4;
      }
      y += 3;
    });
    const fecha = new Date().toLocaleDateString('es-ES').replace(/\//g,'-');
    doc.save('campograma_plantillas_'+fecha+'.pdf');
    toast('✅ PDF descargado');
  }catch(e){ toast('❌ Error al generar PDF: '+e.message); console.error(e); }
}
function exportarDatos(){
  try{
    const payload = {
      ...buildPayload(false),
      exportadoEl: new Date().toISOString(),
      version: 'rm_cantera_v3_completo'
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], {type:'application/json'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const fecha = new Date().toLocaleDateString('es-ES').replace(/\//g,'-');
    a.href = url;
    a.download = 'campograma_backup_'+fecha+'.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('✅ Copia de seguridad completa descargada');
  }catch(e){ toast('❌ Error al exportar: '+e.message); }
}
function importarDatos(){
  document.getElementById('import-file').value = '';
  document.getElementById('import-file').click();
}
function cargarFicheroImport(ev){
  const file = ev.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try{
      const payload = JSON.parse(e.target.result);
      if(!payload.data){ toast('❌ Fichero no válido'); return; }
      if(!confirm('¿Cargar estos datos? Se sobreescribirá todo lo actual.')){return;}
      if(payload.data)                  data = payload.data;
      if(payload.pos)                   pos = payload.pos;
      if(payload.plantillas)            plantillas = payload.plantillas;
      if(payload.origen)                Object.assign(origen, payload.origen);
      if(payload.colNames)              colNames = payload.colNames;
      if(payload.porteros)              porteros = payload.porteros;
      if(payload.movimientos)           movimientos = payload.movimientos;
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
      if(payload.historicoJugador)      historicoJugador = payload.historicoJugador;
      if(payload.semanasGuardadas)      _semanasGuardadas = payload.semanasGuardadas;
      if(payload.notas)                 window._notasData = payload.notas;
      if(payload.fechas)                Object.assign(FECHAS, payload.fechas);
      window._saltarFrenoGuardado = true;
      autoGuardar();
      render();
      renderDias();
      toast('✅ Copia de seguridad restaurada correctamente (con histórico y semanas incluidos)');
    }catch(err){ toast('❌ Error al leer fichero: '+err.message); }
  };
  reader.readAsText(file);
}
// ══════════════════════════════════════════════════
// EXPORTAR EXCEL
// ══════════════════════════════════════════════════
function exportarEquipoDia(eq, d){
  const rows = [];
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
  const W = 640;
  const FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif";
  const PAD = 28;
  const LINE_H = 28;
  const SEC_H  = 36;
  const secciones = [
    { label: 'CAMPO', items: campo, extra: countTxt, color: '#4ade80' },
  ];
  if(esPartidoHoy && banquillo.length){
    secciones.push({ label: '🔄 BANQUILLO', items: banquillo, color: '#f59e0b' });
  }
  if(proms.length){
    secciones.push({ label: colN[0]||'PROMOCIONADOS', items: proms, color: '#a78bfa', destinos: promoInfoEq });
  }
  if(lesion.length){
    secciones.push({ label: colN[1]||'LESIONADOS', items: lesion, color: '#f87171' });
  }
  if(otros.length){
    secciones.push({ label: colN[2]||'OTROS', items: otros, color: '#94a3b8' });
  }
  if(extraZonas[eq]){
    const extra = d.extra || [];
    const extraNombre = colN[3] || 'EXTRA';
    if(extra.length){
      // Para Castilla, "Otros equipos" funciona como una promoción más — se le pasan
      // los destinos guardados en promInfo para que salga la flecha, igual que en
      // la columna de Promoción a 1er Eq.
      secciones.push({ label: extraNombre, items: extra, color: '#38bdf8', destinos: eq==='CASTILLA' ? promoInfoEq : undefined });
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
  ctx.fillStyle = '#0a1628';
  ctx.fillRect(0, 0, W, totalH);
  const grad = ctx.createLinearGradient(0,0,W,0);
  grad.addColorStop(0,'#001a52'); grad.addColorStop(1,'#0a1628');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, HEADER_H);
  ctx.fillStyle = '#C8A800';
  ctx.fillRect(0, HEADER_H-2, W, 2);
  const shieldImgEl = document.querySelector('#hdr-escudo img');
  function dibujarCuerpoLista(){
    ctx.font = '28px serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('📋', PAD, HEADER_H/2 - 6);
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
  if(esPartidoHoy){
    const rivalVal = (window.rivales && window.rivales[dia] && window.rivales[dia][eq]) || '';
    const partidoTxt = '⚽ PARTIDO' + (rivalVal ? '  vs ' + rivalVal : '');
    ctx.fillStyle = '#f59e0b';
    ctx.font = `700 13px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(partidoTxt, W - PAD, HEADER_H/2 + 6);
    ctx.textAlign = 'left';
  }
    let y = HEADER_H + PAD;
  secciones.forEach(sec => {
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
        if(i % 2 === 0){
          ctx.fillStyle = 'rgba(255,255,255,.04)';
          ctx.fillRect(PAD, y, W - PAD*2, LINE_H);
        }
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.font = `400 11px ${FONT}`;
        ctx.textBaseline = 'middle';
        ctx.fillText((i+1)+'', PAD + 8, y + LINE_H/2);
        ctx.fillStyle = '#ffffff';
        ctx.font = `600 14px ${FONT}`;
        ctx.fillText(nombre, PAD + 28, y + LINE_H/2);
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
var _tapTimer = new WeakMap();
var _tapCount = new WeakMap();
function moveGhost(x,y){const g=document.getElementById('ghost');g.style.left=(x-dOff.x)+'px';g.style.top=(y-dOff.y)+'px';}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function on(ev,fn,opts){document.addEventListener(ev,fn,opts);}
function off(ev,fn){document.removeEventListener(ev,fn);}
var alertCb=null;
function showAlert(msg,onConfirm,okLabel='Añadir',onExtra=null,extraLabel='',onExtra2=null,extra2Label=''){
  document.getElementById('alert-msg').textContent=msg;
  document.getElementById('alert-ok-btn').textContent=okLabel;
  const okBtn=document.getElementById('alert-ok-btn');
  if(okLabel==='Eliminar' || okLabel==='Volver a su equipo'){ okBtn.style.background='#ef4444'; okBtn.style.borderColor='#ef4444'; }
  else { okBtn.style.background=''; okBtn.style.borderColor=''; }
  function cerrarSinSaltoScroll(){
    const _sy = window.scrollY, _sx = window.scrollX;
    if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
    closeAlert();
    window.scrollTo(_sx, _sy);
  }
  const extraBtn=document.getElementById('alert-extra-btn');
  if(onExtra){
    extraBtn.textContent=extraLabel;
    extraBtn.style.display='';
    extraBtn.onclick=()=>{cerrarSinSaltoScroll();onExtra();};
  } else {
    extraBtn.style.display='none';
    extraBtn.onclick=null;
  }
  const extra2Btn=document.getElementById('alert-extra2-btn');
  if(onExtra2){
    extra2Btn.textContent=extra2Label;
    extra2Btn.style.display='';
    extra2Btn.onclick=()=>{cerrarSinSaltoScroll();onExtra2();};
  } else {
    extra2Btn.style.display='none';
    extra2Btn.onclick=null;
  }
  document.getElementById('alert-overlay').classList.add('show');
  alertCb=onConfirm;
  okBtn.onclick=()=>{const cb=alertCb;cerrarSinSaltoScroll();if(cb)cb();};
}
function closeAlert(){
  document.getElementById('alert-overlay').classList.remove('show');
  alertCb=null;
  const extraBtn=document.getElementById('alert-extra-btn');
  extraBtn.style.display='none';
  extraBtn.onclick=null;
  const extra2Btn=document.getElementById('alert-extra2-btn');
  extra2Btn.style.display='none';
  extra2Btn.onclick=null;
}
var tT=null;
function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;
  // Por encima de CUALQUIER panel/modal abierto (que suelen usar backdrop-filter:
  // blur) — si no, el toast queda detrás del cristal difuminado y se ve borroso.
  t.style.zIndex = '999999';
  t.style.position = 'fixed';
  t.classList.add('show');
  clearTimeout(tT);
  tT=setTimeout(()=>t.classList.remove('show'),2200);
}
function toggleDarkMaestro(){
  const activo = document.body.classList.toggle('dark');
  try{ localStorage.setItem('rm_dark', activo ? '1' : '0'); }catch(e){}
  const btn = document.getElementById('darkBtnMaestro');
  if(btn) btn.textContent = activo ? '☀' : '☾';
}
(function aplicarModoOscuroGuardado(){
  try{
    if(localStorage.getItem('rm_dark') === '1'){
      document.body.classList.add('dark');
      document.addEventListener('DOMContentLoaded', ()=>{
        const btn = document.getElementById('darkBtnMaestro');
        if(btn) btn.textContent = '☀';
      });
    }
  }catch(e){}
})();
initTiposConfig();
async function arrancarDesdeFirebase(){
  async function _esperarRenderListo(){
    if(typeof window.render === 'function') return;
    await new Promise(res=>{
      let intentos = 0;
      const iv = setInterval(()=>{
        intentos++;
        if(typeof window.render === 'function' || intentos > 150){
          clearInterval(iv); res();
        }
      }, 20);
    });
  }
  try{
    if(!window._fbReady){
      await new Promise((res,rej)=>{
        const t=setTimeout(()=>rej('timeout'),6000);
        window.addEventListener('firebase-ready',()=>{clearTimeout(t);res();},{once:true});
      });
    }
    const res = await window.fbCargarSesion('principal');
    if(res.ok && res.data && res.data.plantillas){
      const payload = res.data;
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
      if(payload.semanasGuardadas && typeof payload.semanasGuardadas==='object') _semanasGuardadas = payload.semanasGuardadas;
      if(payload.historicoJugador && typeof payload.historicoJugador==='object') historicoJugador = payload.historicoJugador;
      if(payload.ultimaSemanaKey && payload.ultimaSemanaKey !== _semanaKeyActual){
        _semanasGuardadas[payload.ultimaSemanaKey] = JSON.parse(JSON.stringify({
          data, pos, promInfo, multiEq, modoPartido, modoDescanso, tipoPartido,
          primerEquipoJugadores, notas: window._notasData || {}, origen, historicoJugador
        }));
        window._semanasSucias = window._semanasSucias || new Set();
        window._semanasSucias.add(payload.ultimaSemanaKey);
        if(!(await cargarFotoSemana(_semanaKeyActual))) crearSemanaVacia();
      }
      if(payload.fechas && typeof payload.fechas === 'object'){
        const distintas = Object.keys(FECHAS).some(d=>payload.fechas[d] && payload.fechas[d] !== FECHAS[d] && payload.ultimaSemanaKey === _semanaKeyActual);
        if(distintas) console.warn('[aviso semana] Las fechas guardadas no coinciden con las de la semana activa aunque la clave de semana sí — revisar.');
      }
      if(payload.primerEquipoJugadores && typeof payload.primerEquipoJugadores === 'object') primerEquipoJugadores = payload.primerEquipoJugadores;
      if(payload.rivales     && typeof payload.rivales==='object')     window.rivales = payload.rivales;
      if(payload.notas       && typeof payload.notas==='object')       window._notasData = payload.notas;
      EQUIPOS.forEach(eq=>{
        if(!colNames[eq]) colNames[eq]=['PROMOCIONADOS','LESIONADOS','OTROS'];
        if(colNames[eq][0]==='1ER EQUIPO') colNames[eq][0]='PROMOCIONADOS';
        if(colNames[eq][0]==='PROMOCIÓN') colNames[eq][0]='PROMOCIONADOS';
        if(colNames[eq][1]==='LESIÓN')    colNames[eq][1]='LESIONADOS';
      });
      // Migración: en cuentas ya existentes, renombrar las columnas de Castilla y
      // activar "Otro equipo" — solo pisa el nombre si sigue siendo el genérico o el
      // de la versión anterior (si el usuario ya lo personalizó a mano, se respeta).
      if(colNames['CASTILLA'][0]==='PROMOCIONADOS' || colNames['CASTILLA'][0]==='PROMOCIÓN A 1ER EQ.') colNames['CASTILLA'][0]='PROMOCIÓN 1ER EQ.';
      if(!extraZonas['CASTILLA']) extraZonas['CASTILLA'] = true;
      if(!colNames['CASTILLA'][3] || colNames['CASTILLA'][3]==='OTROS EQUIPOS') colNames['CASTILLA'][3] = 'OTRO EQUIPO';
      for(const d of DIAS) for(const e of EQUIPOS){
        if(!data[d])    data[d]={};
        if(!data[d][e]) data[d][e]={};
        for(const z of ZONAS) if(!data[d][e][z]) data[d][e][z]=[];
      }
      DIAS.forEach(d=>{if(!promInfo[d])promInfo[d]={};EQUIPOS.forEach(eq=>{if(!promInfo[d][eq])promInfo[d][eq]={};});});
      EQUIPOS.forEach(eq=>{
        (plantillas[eq]||[]).forEach(nombre=>{
          DIAS.forEach((d)=>{
            const enAlgunaZona=ZONAS.some(z=>(data[d][eq][z]||[]).includes(nombre)) || (data[d][eq].extra2||[]).includes(nombre);
            if(!enAlgunaZona && !data[d][eq].disponibles.includes(nombre))
              data[d][eq].disponibles.push(nombre);
          });
        });
      });
      DIAS.forEach(d=>{
        EQUIPOS.forEach(eqOrigen=>{
          const infoEq = promInfo[d]?.[eqOrigen];
          if(!infoEq) return;
          Object.keys(infoEq).forEach(nombre=>{
            const sigueEnPlantilla = (plantillas[eqOrigen]||[]).includes(nombre);
            const sigueEnColumnaPromo = (data[d]?.[eqOrigen]?.promovidos_1er||[]).includes(nombre) || (data[d]?.[eqOrigen]?.extra||[]).includes(nombre);
            if(!sigueEnPlantilla || !sigueEnColumnaPromo) delete infoEq[nombre];
          });
        });
        EQUIPOS.forEach(eq=>{
          ['disponibles','campo','banquillo'].forEach(z=>{
            const arr = data[d]?.[eq]?.[z];
            if(!Array.isArray(arr)) return;
            for(let i=arr.length-1; i>=0; i--){
              const nombre = arr[i];
              const esPropio = origen[nombre] === eq || (plantillas[eq]||[]).includes(nombre);
              const estaPrestadoDeVerdad = EQUIPOS.some(otroEq=>
                otroEq!==eq && getDestinos(d, otroEq, nombre).includes(eq)
              );
              if(!esPropio && !estaPrestadoDeVerdad){
                arr.splice(i,1);
                if(z==='campo') delete pos[key(d,eq,nombre)];
              }
            }
          });
        });
        const arr1er = primerEquipoJugadores[d];
        if(Array.isArray(arr1er)){
          for(let i=arr1er.length-1; i>=0; i--){
            const nombre = arr1er[i];
            const esPropio = (plantillas['1ER EQUIPO']||[]).includes(nombre);
            const estaPromocionadoDeVerdad = EQUIPOS.some(eqOrigen=>
              getDestinos(d, eqOrigen, nombre).includes('1ER EQUIPO')
            );
            if(!esPropio && !estaPromocionadoDeVerdad){
              arr1er.splice(i,1);
              delete pos[key(d,'1ER EQUIPO',nombre)];
            }
          }
        }
      });
      DIAS.forEach(d=>asegurarHistoricoJugador(d));
      Object.keys(origen).forEach(nombre=>{
        const eqApuntado = origen[nombre];
        if(eqApuntado && (plantillas[eqApuntado]||[]).includes(nombre)) return;
        const otroEqConEl = EQUIPOS.find(e=>(plantillas[e]||[]).includes(nombre));
        if(otroEqConEl) origen[nombre] = otroEqConEl;
        else delete origen[nombre];
      });
      EQUIPOS.forEach(eq=>{
        (plantillas[eq]||[]).forEach(nombre=>{
          if(!origen[nombre]) origen[nombre] = eq;
        });
      });
      initTiposConfig();
      _fbSesionActiva = 'principal';
      await _esperarRenderListo();
      render(); renderMultiEqBar();
      console.log('✅ Sesión principal cargada desde Firebase');
      fijarTotalJugadoresConocido();
      hacerBackupDiarioSiHaceFalta();
    } else {
      _fbSesionActiva = 'principal';
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
          await _esperarRenderListo();
          render();
          toast('☁️ Plantillas importadas desde Firebase');
        }
      }catch(e){ console.warn('Sin plantillas Firebase:', e); }
      autoGuardar();
      console.log('ℹ️ Sesión principal creada en Firebase');
    }
  }catch(e){
    console.warn('[arranque] Firebase no disponible, usando datos locales:', e);
    if(!cargado){ initTiposConfig(); await _esperarRenderListo(); render(); }
  }
}
arrancarDesdeFirebase();

// ══════════════════════════════════════════════════
// SINCRONIZACIÓN EN VIVO — aplica cambios de otras personas sin recargar
// ══════════════════════════════════════════════════
var _ultimoTsRemoto = null;
function iniciarEscuchaEnVivo(){
  if(typeof window.fbEscucharSesion !== 'function') return;
  window.fbEscucharSesion('principal', (payload)=>{
    try{
      if(window._hayGuardadoPendiente) return;
      const tsNum = payload._ts && payload._ts.toMillis ? payload._ts.toMillis() : null;
      if(tsNum !== null){
        if(tsNum === _ultimoTsRemoto) return;
        _ultimoTsRemoto = tsNum;
      }
      aplicarPayloadRemoto(payload);
    }catch(err){
      console.error('[escucha en vivo] error aplicando cambio remoto:', err);
    }
  });
}
function aplicarPayloadRemoto(payload){
  if(!payload || typeof payload !== 'object' || !payload.plantillas) return;
  if(payload.plantillas  && typeof payload.plantillas==='object')  plantillas  = payload.plantillas;
  if(payload.origen      && typeof payload.origen==='object')      origen      = payload.origen;
  if(payload.colNames    && typeof payload.colNames==='object')    colNames    = payload.colNames;
  if(payload.porteros    && Array.isArray(payload.porteros))       porteros    = payload.porteros;
  if(payload.movimientos && typeof payload.movimientos==='object') movimientos = payload.movimientos;
  if(payload.extraZonas  && typeof payload.extraZonas==='object')  extraZonas  = payload.extraZonas;
  if(payload.tiposConfig && typeof payload.tiposConfig==='object') tiposConfig = payload.tiposConfig;
  if(payload.listaUYL    && Array.isArray(payload.listaUYL))       listaUYL    = payload.listaUYL;
  if(Array.isArray(payload.listaUYLExcl)) window.listaUYLExcl = payload.listaUYLExcl;
  if(payload.rivales     && typeof payload.rivales==='object')     window.rivales = payload.rivales;
  if(payload.semanasGuardadas && typeof payload.semanasGuardadas==='object'){
    Object.keys(payload.semanasGuardadas).forEach(k=>{
      if(k !== _semanaKeyActual) _semanasGuardadas[k] = payload.semanasGuardadas[k];
    });
  }
  if(payload.ultimaSemanaKey === _semanaKeyActual){
    if(payload.data        && typeof payload.data==='object')        data        = payload.data;
    if(payload.pos         && typeof payload.pos==='object')         pos         = payload.pos;
    if(payload.promInfo    && typeof payload.promInfo==='object')    promInfo    = payload.promInfo;
    if(payload.tipoPartido && typeof payload.tipoPartido==='object') tipoPartido = payload.tipoPartido;
    if(payload.modoPartido && typeof payload.modoPartido==='object') modoPartido = payload.modoPartido;
    if(payload.modoDescanso&& typeof payload.modoDescanso==='object')modoDescanso= payload.modoDescanso;
    if(payload.multiEq     && typeof payload.multiEq==='object')     multiEq     = payload.multiEq;
    if(payload.primerEquipoJugadores && typeof payload.primerEquipoJugadores === 'object') primerEquipoJugadores = payload.primerEquipoJugadores;
  } else if(payload.semanasGuardadas && payload.semanasGuardadas[_semanaKeyActual]){
    cargarFotoSemana(_semanaKeyActual);
  }
  render();
  toast('☁️ Actualizado con cambios de otra persona');
}
function getDestinos(diaP, eqOrigen, nombre){
  const v = promInfo[diaP]?.[eqOrigen]?.[nombre];
  if(!v) return [];
  return Array.isArray(v) ? v.slice() : [v];
}
function getDestinosEnCualquierEquipo(diaP, nombre){
  const encontrados = [];
  EQUIPOS.forEach(eq=>{
    getDestinos(diaP, eq, nombre).forEach(destino=>{
      encontrados.push({eqArchivo: eq, destino});
    });
  });
  return encontrados;
}
function limpiarTodosLosRastros(nombre, diaP){
  diaP = diaP || dia;
  const encontrados = getDestinosEnCualquierEquipo(diaP, nombre);
  if(!encontrados.length) return 0;
  encontrados.forEach(({eqArchivo, destino})=>{
    limpiarUnDestino(diaP, destino, nombre);
    const prom = data[diaP][eqArchivo]?.promovidos_1er;
    if(prom){ const i=prom.indexOf(nombre); if(i>=0) prom.splice(i,1); }
    if(promInfo[diaP]?.[eqArchivo]) delete promInfo[diaP][eqArchivo][nombre];
  });
  autoGuardar();
  render();
  toast('🧹 '+nombre+': '+encontrados.length+' rastro(s) de duplicado eliminado(s)');
  return encontrados.length;
}
function limpiarUnDestino(diaP, destino, nombre){
  if(destino==='1ER EQUIPO'){
    if(primerEquipoJugadores[diaP]){
      const i = primerEquipoJugadores[diaP].indexOf(nombre);
      if(i>=0) primerEquipoJugadores[diaP].splice(i,1);
    }
    delete pos[key(diaP,'1ER EQUIPO',nombre)];
  } else if(data[diaP][destino]){
    ZONAS_ACTIVAS.forEach(z=>{
      const a = data[diaP][destino][z];
      if(!a) return;
      const i = a.indexOf(nombre);
      if(i>=0){ a.splice(i,1); if(z==='campo') delete pos[key(diaP,destino,nombre)]; }
    });
  }
}
// Decide en qué columna del equipo de ORIGEN se registra una promoción/duplicado,
// según el destino elegido. Solo importa para Castilla (que tiene 2 columnas de
// promoción distintas); para el resto de equipos siempre es "promovidos_1er".
function _zonaPromoParaDestino(eqOrigen, destino){
  return (eqOrigen === 'CASTILLA' && destino !== '1ER EQUIPO') ? 'extra' : 'promovidos_1er';
}
function doblarJugador(nombre, eqOrigen, destino, diaP, modo, zonaOrigenDestino){
  diaP = diaP || dia;
  modo = modo || 'cambiar';
  zonaOrigenDestino = zonaOrigenDestino || 'promovidos_1er';
  if(!promInfo[diaP]) promInfo[diaP]={};
  if(!promInfo[diaP][eqOrigen]) promInfo[diaP][eqOrigen]={};
  const previos = getDestinos(diaP, eqOrigen, nombre);
  if(modo === 'cambiar'){
    previos.forEach(d=>{ if(d!==destino) limpiarUnDestino(diaP, d, nombre); });
  }
  if(destino!=='1ER EQUIPO'){
    if(!data[diaP][destino]) { toast('❌ No se puede doblar ahí'); return; }
    limpiarEquipoExcepto(nombre, destino, 'disponibles', diaP);
    if(!data[diaP][destino].disponibles.includes(nombre)){
      data[diaP][destino].disponibles.push(nombre);
    }
  }
  if(!data[diaP][eqOrigen][zonaOrigenDestino]) data[diaP][eqOrigen][zonaOrigenDestino]=[];
  if(!data[diaP][eqOrigen][zonaOrigenDestino].includes(nombre)){
    data[diaP][eqOrigen][zonaOrigenDestino].push(nombre);
  }
  const nuevaLista = modo==='cambiar' ? [destino] : [...new Set([...previos, destino])];
  promInfo[diaP][eqOrigen][nombre] = nuevaLista.length===1 ? nuevaLista[0] : nuevaLista;
  autoGuardar();
  render();
  toast(nuevaLista.length>1 ? '⧉ '+nombre+' triplicado ('+nuevaLista.join(', ')+')' : '⧉ '+nombre+' doblado en '+destino);
}
function eliminarTodosLosDuplicados(nombre, eqOrigen, diaP){
  diaP = diaP || dia;
  const previos = getDestinos(diaP, eqOrigen, nombre);
  previos.forEach(d=>limpiarUnDestino(diaP, d, nombre));
  const prom = data[diaP][eqOrigen]?.promovidos_1er;
  if(prom){ const i=prom.indexOf(nombre); if(i>=0) prom.splice(i,1); }
  const promExtra = data[diaP][eqOrigen]?.extra;
  if(promExtra){ const ie=promExtra.indexOf(nombre); if(ie>=0) promExtra.splice(ie,1); }
  if(promInfo[diaP]?.[eqOrigen]) delete promInfo[diaP][eqOrigen][nombre];
  // Si era una promoción simple (el jugador ya no estaba en ninguna zona activa de su
  // equipo, se había ido de verdad), al quitarle la promoción hay que devolverlo a
  // Disponibles — si no, se queda sin sitio hasta la próxima recarga.
  const sigueActivo = ZONAS_ACTIVAS.some(z=>z!=='disponibles' && (data[diaP][eqOrigen]?.[z]||[]).includes(nombre));
  if(!sigueActivo){
    const disp = data[diaP][eqOrigen]?.disponibles;
    if(disp && !disp.includes(nombre)) disp.push(nombre);
  }
  autoGuardar();
  render();
  toast('✕ Duplicado(s) de '+nombre+' eliminado(s)');
}
function quitarUnDestino(nombre, eqOrigen, destino, diaP){
  diaP = diaP || dia;
  limpiarUnDestino(diaP, destino, nombre);
  const restantes = getDestinos(diaP, eqOrigen, nombre).filter(d=>d!==destino);
  if(restantes.length){
    promInfo[diaP][eqOrigen][nombre] = restantes.length===1 ? restantes[0] : restantes;
    toast('✕ '+nombre+' quitado de '+destino+' (sigue en '+restantes.join(', ')+')');
  } else {
    const prom = data[diaP][eqOrigen]?.promovidos_1er;
    if(prom){ const i=prom.indexOf(nombre); if(i>=0) prom.splice(i,1); }
    const promExtra = data[diaP][eqOrigen]?.extra;
    if(promExtra){ const ie=promExtra.indexOf(nombre); if(ie>=0) promExtra.splice(ie,1); }
    if(promInfo[diaP]?.[eqOrigen]) delete promInfo[diaP][eqOrigen][nombre];
    // Sin destinos ya, y si era una promoción simple (no seguía activo en su propio
    // equipo), hay que devolverlo a Disponibles de su equipo — si no, se queda sin
    // sitio visible hasta la próxima recarga (que es cuando la sincronización
    // automática lo rescataba, de ahí que hiciera falta refrescar).
    const sigueActivo = ZONAS_ACTIVAS.some(z=>z!=='disponibles' && (data[diaP][eqOrigen]?.[z]||[]).includes(nombre));
    if(!sigueActivo){
      const disp = data[diaP][eqOrigen]?.disponibles;
      if(disp && !disp.includes(nombre)) disp.push(nombre);
    }
    toast('✕ '+nombre+' quitado de '+destino);
  }
  autoGuardar();
  render();
}
function limpiarEquipoExcepto(nombre, eq, zonaMantener, diaP){
  diaP = diaP || dia;
  ZONAS_ACTIVAS.forEach(z=>{
    if(z===zonaMantener) return;
    const arr = data[diaP][eq]?.[z];
    if(arr){
      const i = arr.indexOf(nombre);
      if(i>=0){ arr.splice(i,1); if(z==='campo') delete pos[key(diaP,eq,nombre)]; }
    }
  });
}
