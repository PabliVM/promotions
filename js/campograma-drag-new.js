// ── campograma-drag.js — Drag & drop de chips ──
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
    dia: c.dataset.dia || dia, // día de origen del chip (vista semana)
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
  const _diaOrigDrop = dia;
  try {
    off('touchmove',moveChip);off('touchend',endChip);off('mousemove',moveChip);off('mouseup',endChip);
    if(!drag){
      // Puede que el drag no haya arrancado todavía (dentro del delay de 160ms)
      // En ese caso no hacer nada — el doble tap ya se habrá gestionado
      return;
    }
    // Usar el día de origen del chip arrastrado (vista semana puede tener varios días)
    dia = drag.dia || dia;
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
    const toDia = dz.dataset.dia || dia;
    dia = toDia; // el destino manda: usar el día de la columna donde se suelta
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
      // Si el jugador (sea de su equipo propio o prestado) va al campo de un equipo
      // distinto a su EQUIPO PROPIO, se registra como promovido desde su equipo propio.
      const _nombre2 = drag.nombre;
      const _fromEq2 = drag.eq;
      const _fromZona2 = drag.zona;
      const _eqPropio2 = origen[_nombre2] || _fromEq2;
      const _zonasOrigenValidas = ['disponibles','campo'];
      const esPromocionAuto = (
        toEq !== _eqPropio2 &&                       // destino distinto a su equipo propio
        _zonasOrigenValidas.includes(_fromZona2)     // viene de disponibles o campo
      );
      if(esPromocionAuto){
        // Quitar de la zona origen (puede ser su equipo propio o uno prestado)
        const srcArr = data[dia][_fromEq2]?.[_fromZona2];
        if(srcArr){ const si=srcArr.indexOf(_nombre2); if(si>=0) srcArr.splice(si,1); }
        // Si venía prestado en otro equipo, también quitar cualquier rastro de promoción previa
        if(_fromEq2 !== _eqPropio2){
          const promArrPrevio = data[dia][_eqPropio2]?.promovidos_1er;
          if(promArrPrevio){ const pi=promArrPrevio.indexOf(_nombre2); if(pi>=0) promArrPrevio.splice(pi,1); }
        }
        // Añadir al campo del equipo destino (ya guardamos pos arriba)
        data[dia][toEq].campo.push(_nombre2);
        // Registrar en promovidos_1er del equipo PROPIO con el nuevo destino
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
    // Registrar movimiento
    const _mv = drag.nombre, _mvEq = toEq, _mvDia = dia;
    move(drag.eq,drag.zona,toEq,toZona,drag.nombre);
    if(!movimientos[_mvDia]) movimientos[_mvDia]={};
    if(!movimientos[_mvDia][_mvEq]) movimientos[_mvDia][_mvEq]={};
    const _user = window._fbUser?.email || window._fbUser?.displayName || 'Desconocido';
    movimientos[_mvDia][_mvEq][_mv] = { ts: Date.now(), user: _user };
    drag=null; render();
  } finally {
    dia = _diaOrigDrop;
  }
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
