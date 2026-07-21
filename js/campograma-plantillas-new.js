// ── campograma-plantillas.js — Gestión de plantillas de jugadores ──
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
var plantillas = buildPlantillasIniciales();
var plantEqActivo = EQUIPOS[0];
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
  // Pestaña Primer Equipo primero (antes que Castilla/cantera)
  const jj1er = plantillas['1ER EQUIPO'] || [];
  const btn1er = mk('button','plant-eq-tab'+('1ER EQUIPO'===plantEqActivo?' active':''));
  btn1er.textContent = '1ER EQUIPO (' + jj1er.length + ')';
  btn1er.onclick = ()=>{ plantEqActivo='1ER EQUIPO'; renderPlantTabs(); renderPlantBody(); actualizarPlantInput(); };
  wrap.appendChild(btn1er);
  EQUIPOS.forEach(eq=>{
    const btn = mk('button','plant-eq-tab'+(eq===plantEqActivo?' active':''));
    const _jj = plantillas[eq] || [];
    const _pp = _jj.filter(n => porteros.includes(n)).length;
    const _nn = _jj.length - _pp;
    btn.textContent = eq + ' (' + (_pp > 0 ? _nn+'+'+_pp : _jj.length) + ')';
    btn.onclick = ()=>{ plantEqActivo=eq; renderPlantTabs(); renderPlantBody(); actualizarPlantInput(); };
    wrap.appendChild(btn);
  });
  // Pestaña especial JA Youth
  const uylLista = getPlantillaUYL();
  const uylPor = uylLista.filter(n => porteros.includes(n)).length;
  const uylNorm = uylLista.length - uylPor;
  const uylN = uylPor > 0 ? uylNorm+'+'+uylPor : uylLista.length;
  const btnUYL = mk('button','plant-eq-tab uyl-tab'+('JA_YOUTH'===plantEqActivo?' active':''));
  btnUYL.innerHTML = 'JA Youth <span style="font-size:9px;opacity:.7">('+uylN+')</span>';
  btnUYL.onclick = ()=>{ plantEqActivo='JA_YOUTH'; renderPlantTabs(); renderPlantBody(); actualizarPlantInput(); };
  wrap.appendChild(btnUYL);
}
function renderPlantBody(){
  const list = document.getElementById('plant-list');
  list.innerHTML = '';
  document.getElementById('plant-add-input').value = '';
  const filaTexto = document.getElementById('plant-add-row');
  const filaSelects = document.getElementById('plant-uyl-add-row');
  if(plantEqActivo === 'JA_YOUTH'){
    filaTexto.style.display = 'none';
    filaSelects.style.display = 'flex';
    renderUYLEqSel();
  } else {
    filaTexto.style.display = '';
    filaSelects.style.display = 'none';
  }
  if(plantEqActivo === 'JA_YOUTH'){
    document.getElementById('plant-eq-title').textContent = 'JA Youth League';
    // Inicializar con JA si está vacía
    if(listaUYL.length === 0){
      listaUYL = Object.keys(origen).filter(n=>origen[n]==='JUVENIL A').sort();
      autoGuardar();
    }
    const _uylNumPor = listaUYL.filter(n => porteros.includes(n)).length;
    const _uylNumNorm = listaUYL.length - _uylNumPor;
    document.getElementById('plant-count').textContent = (_uylNumPor > 0 ? _uylNumNorm + '+' + _uylNumPor : listaUYL.length) + ' jugadores';
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
      row.draggable = true;
      row.dataset.nombre = nombre;
      // Drag para reordenar (reordena listaUYL)
      row.ondragstart = (e) => {
        e.dataTransfer.setData('text/plain', nombre);
        e.dataTransfer.effectAllowed = 'move';
        row.classList.add('dragging-row');
      };
      row.ondragend = () => row.classList.remove('dragging-row');
      row.ondragover = (e) => { e.preventDefault(); row.classList.add('drag-over-row'); };
      row.ondragleave = () => row.classList.remove('drag-over-row');
      row.ondrop = (e) => {
        e.preventDefault();
        row.classList.remove('drag-over-row');
        const nombreMovido = e.dataTransfer.getData('text/plain');
        if(nombreMovido && nombreMovido !== nombre){
          const fromIdx = listaUYL.indexOf(nombreMovido);
          const toIdx = listaUYL.indexOf(nombre);
          if(fromIdx >= 0 && toIdx >= 0){
            listaUYL.splice(fromIdx, 1);
            const newToIdx = listaUYL.indexOf(nombre);
            listaUYL.splice(newToIdx, 0, nombreMovido);
            autoGuardar();
            renderPlantBody();
          }
        }
      };
      const num = mk('span','plant-num'); num.textContent = (i+1);
      const dragHandle = mk('span','plant-drag-handle'); dragHandle.textContent = '⠿';
      const nm  = mk('span','plant-name');
      nm.innerHTML = nombre + (eqO !== 'JUVENIL A' ? '<span class="plant-uyl-origin" style="color:#60b4ff">'+eqO+'</span>' : '');
      // Indicador de portero AUTOMÁTICO (de solo lectura) — se reconoce solo, sin tocar nada aquí
      const porTag = mk('span','plant-portero-tag');
      porTag.textContent = 'POR';
      porTag.style.display = porteros.includes(nombre) ? '' : 'none';
      const del = mk('button','plant-del'); del.textContent = '×';
      del.title = 'Quitar de JA Youth';
      del.onclick = ()=>{
        const idx = listaUYL.indexOf(nombre);
        if(idx>=0) listaUYL.splice(idx,1);
        renderPlantTabs(); renderPlantBody(); autoGuardar();
      };
      row.appendChild(dragHandle); row.appendChild(num); row.appendChild(nm); row.appendChild(porTag); row.appendChild(del);
      list.appendChild(row);
    });
    return;
  }
  // ── Vista normal de equipo ──
  const jugadores = plantillas[plantEqActivo] || [];
  document.getElementById('plant-eq-title').textContent = plantEqActivo;
  const _numPor = jugadores.filter(n => porteros.includes(n)).length;
  const _numNorm = jugadores.length - _numPor;
  document.getElementById('plant-count').textContent = (_numPor > 0 ? _numNorm + '+' + _numPor : jugadores.length) + ' jugadores';
  jugadores.forEach((nombre, i)=>{
    const row = mk('div','plant-row');
    row.draggable = true;
    row.dataset.nombre = nombre;

    // Drag para reordenar
    row.ondragstart = (e) => {
      e.dataTransfer.setData('text/plain', nombre);
      e.dataTransfer.effectAllowed = 'move';
      row.classList.add('dragging-row');
    };
    row.ondragend = () => row.classList.remove('dragging-row');
    row.ondragover = (e) => { e.preventDefault(); row.classList.add('drag-over-row'); };
    row.ondragleave = () => row.classList.remove('drag-over-row');
    row.ondrop = (e) => {
      e.preventDefault();
      row.classList.remove('drag-over-row');
      const nombreMovido = e.dataTransfer.getData('text/plain');
      if(nombreMovido && nombreMovido !== nombre){
        const arr = plantillas[plantEqActivo];
        const fromIdx = arr.indexOf(nombreMovido);
        const toIdx = arr.indexOf(nombre);
        if(fromIdx >= 0 && toIdx >= 0){
          arr.splice(fromIdx, 1);
          const newToIdx = arr.indexOf(nombre);
          arr.splice(newToIdx, 0, nombreMovido);
          autoGuardar();
          renderPlantBody();
        }
      }
    };

    const dragHandle = mk('span','plant-drag-handle'); dragHandle.textContent = '⠿';
    const num = mk('span','plant-num'); num.textContent = (i+1);
    const nm  = mk('span','plant-name'); nm.textContent = nombre;

    // Botón editar nombre
    const editBtn = mk('button','plant-edit-btn'); editBtn.innerHTML = '✏️';
    editBtn.title = 'Editar nombre';
    editBtn.onclick = () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = nombre;
      input.className = 'plant-edit-input';
      row.innerHTML = '';
      row.appendChild(input);
      input.focus();
      input.select();
      const guardarEdit = () => {
        const nuevo = input.value.trim().toUpperCase();
        if(nuevo && nuevo !== nombre){
          const arr = plantillas[plantEqActivo];
          const idx = arr.indexOf(nombre);
          if(idx >= 0) arr[idx] = nuevo;
          renombrarJugadorGlobal(nombre, nuevo);
          renderPlantBody();
        } else {
          renderPlantBody();
        }
      };
      input.onblur = guardarEdit;
      input.onkeydown = (ev) => {
        ev.stopPropagation();
        if(ev.key === 'Enter') input.blur();
        if(ev.key === 'Escape'){ input.onblur = null; renderPlantBody(); }
      };
    };

    // Checkbox portero
    const porLabel = mk('label','plant-portero-chk');
    const porInput = mk('input','');
    porInput.type = 'checkbox';
    porInput.checked = porteros.includes(nombre);
    porInput.title = 'Marcar como portero';
    porInput.onchange = ()=>{
      if(porInput.checked){
        if(!porteros.includes(nombre)) porteros.push(nombre);
      } else {
        const idx = porteros.indexOf(nombre);
        if(idx>=0) porteros.splice(idx,1);
      }
      autoGuardar();
      // Escritura directa e independiente: no se pisa aunque otra persona guarde algo a la vez
      if(typeof window.fbTogglePortero === 'function') window.fbTogglePortero(nombre, porInput.checked);
    };
    const porTxt = document.createElement('span');
    porTxt.textContent = 'POR';
    porLabel.appendChild(porInput);
    porLabel.appendChild(porTxt);

    const del = mk('button','plant-del'); del.textContent = '×';
    del.title = 'Eliminar '+nombre;
    del.onclick = ()=> plantEliminar(nombre);

    // Selector cambiar de equipo
    const eqSel = mk('select','plant-eq-sel');
    eqSel.title = 'Cambiar de equipo';
    EQUIPOS.concat(['1ER EQUIPO']).forEach(eqOpt=>{
      const opt = document.createElement('option');
      opt.value = eqOpt;
      opt.textContent = EQ_LABEL[eqOpt] || eqOpt;
      if(eqOpt === plantEqActivo) opt.selected = true;
      eqSel.appendChild(opt);
    });
    eqSel.onclick = (e)=> e.stopPropagation();
    eqSel.onchange = ()=> plantCambiarEquipo(nombre, eqSel.value);

    row.appendChild(dragHandle); row.appendChild(num); row.appendChild(nm);
    row.appendChild(editBtn); row.appendChild(porLabel); row.appendChild(eqSel); row.appendChild(del);
    list.appendChild(row);
  });
}
function plantCambiarEquipo(nombre, nuevoEq){
  if(!nuevoEq || nuevoEq === plantEqActivo) return;
  const arr = plantillas[plantEqActivo];
  const idx = arr.indexOf(nombre);
  if(idx >= 0) arr.splice(idx, 1);
  if(!plantillas[nuevoEq]) plantillas[nuevoEq] = [];
  if(!plantillas[nuevoEq].includes(nombre)) plantillas[nuevoEq].push(nombre);
  origen[nombre] = nuevoEq;
  // Limpiar cualquier duplicado que estuviera archivado bajo el equipo ANTIGUO
  // (si no, se queda "fantasma": ya no se puede gestionar desde ningún sitio)
  DIAS.forEach(d=>{
    if(promInfo[d]?.[plantEqActivo]?.[nombre]){
      const destinos = getDestinos(d, plantEqActivo, nombre);
      destinos.forEach(destino=>limpiarUnDestino(d, destino, nombre));
      delete promInfo[d][plantEqActivo][nombre];
    }
  });
  // Quitar cualquier rastro del jugador en el equipo ANTERIOR (todas las zonas, todos los días)
  if(plantEqActivo !== '1ER EQUIPO'){
    DIAS.forEach(d=>{
      ZONAS.forEach(z=>{
        const a = data[d][plantEqActivo]?.[z];
        if(!a) return;
        const i = a.indexOf(nombre);
        if(i>=0){ a.splice(i,1); if(z==='campo') delete pos[key(d,plantEqActivo,nombre)]; }
      });
    });
  }
  // Si entra en un equipo de cantera, que aparezca en Disponibles (si no está ya en otra zona)
  if(nuevoEq !== '1ER EQUIPO'){
    DIAS.forEach(d=>{
      if(!data[d][nuevoEq].disponibles.includes(nombre) &&
         !ZONAS.some(z=>data[d][nuevoEq][z].includes(nombre))){
        data[d][nuevoEq].disponibles.push(nombre);
      }
    });
  }
  // Si sale del Primer Equipo, quitarlo también de su campo (si estaba puesto ahí algún día)
  if(plantEqActivo === '1ER EQUIPO'){
    DIAS.forEach(d=>{
      if(primerEquipoJugadores[d]){
        const i = primerEquipoJugadores[d].indexOf(nombre);
        if(i>=0) primerEquipoJugadores[d].splice(i,1);
      }
    });
  }
  autoGuardar();
  renderPlantBody();
  toast('✓ '+nombre+' movido a '+(EQ_LABEL[nuevoEq]||nuevoEq));
}
function _normalizarNombre(s){
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
}
function buscarPosiblesDuplicados(nombre){
  const nombreNorm = _normalizarNombre(nombre);
  const palabras = nombreNorm.split(/\s+/).filter(w=>w.length>=3); // ignorar iniciales sueltas
  const encontrados = [];
  Object.keys(origen).forEach(existente=>{
    if(existente === nombre) return; // el mismo exacto se avisa aparte
    const existenteNorm = _normalizarNombre(existente);
    if(existenteNorm === nombreNorm){ encontrados.push(existente); return; }
    const palabrasExistente = existenteNorm.split(/\s+/).filter(w=>w.length>=3);
    const coincide = palabras.some(p=>palabrasExistente.includes(p));
    if(coincide) encontrados.push(existente);
  });
  return encontrados;
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
  // Avisar si hay nombres iguales o parecidos en OTRO equipo (posible duplicado) — sin bloquear
  const parecidos = buscarPosiblesDuplicados(nombre);
  _plantAñadirConfirmado(nombre);
  if(parecidos.length){
    const lista = parecidos.map(n=>n+' ('+(origen[n]||'?')+')').join(', ');
    toast('⚠️ Revisa: nombre parecido a '+lista);
  }
}
function _plantAñadirConfirmado(nombre){
  const input = document.getElementById('plant-add-input');
  plantillas[plantEqActivo].push(nombre);
  plantillas[plantEqActivo].sort((a,b)=>a.localeCompare(b,'es'));
  origen[nombre] = plantEqActivo;
  if(plantEqActivo !== '1ER EQUIPO'){
    DIAS.forEach(d=>{
      if(!data[d][plantEqActivo].disponibles.includes(nombre) &&
         !ZONAS.some(z=>data[d][plantEqActivo][z].includes(nombre))){
        data[d][plantEqActivo].disponibles.push(nombre);
      }
    });
  }
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
  // Quitar de porteros si lo era (local y Firebase)
  const pIdx = porteros.indexOf(nombre);
  if(pIdx >= 0){
    porteros.splice(pIdx,1);
    if(typeof window.fbTogglePortero === 'function') window.fbTogglePortero(nombre, false);
  }
  if(plantEqActivo !== '1ER EQUIPO'){
    // Quitar de data en todos los días
    DIAS.forEach(d=>{
      ZONAS.forEach(z=>{
        const i=(data[d][plantEqActivo][z]||[]).indexOf(nombre);
        if(i>=0) data[d][plantEqActivo][z].splice(i,1);
      });
    });
  } else {
    // 1ER EQUIPO usa su propia lista de campo (no data[d][eq])
    DIAS.forEach(d=>{
      if(primerEquipoJugadores[d]){
        const i = primerEquipoJugadores[d].indexOf(nombre);
        if(i>=0) primerEquipoJugadores[d].splice(i,1);
      }
    });
  }
  renderPlantTabs();
  renderPlantBody();
  render();
  toast('🗑️ '+nombre+' eliminado de '+plantEqActivo);
}
// Borra TODOS los jugadores de TODOS los equipos (plantillas, orígenes, posiciones,
// promociones, campo, etc.) para empezar de cero. Acción irreversible — pide confirmación.
function borrarTodosLosJugadores(){
  showAlert(
    '⚠️ Esto borrará TODOS los jugadores de TODOS los equipos (plantillas, campo, promociones, todo) de forma irreversible. ¿Seguro que quieres empezar de cero?',
    ()=>{
      EQUIPOS.concat(['1ER EQUIPO']).forEach(eq=>{ plantillas[eq] = []; });
      origen = {};
      porteros = [];
      if(typeof window.fbSetPorterosCompleto === 'function') window.fbSetPorterosCompleto([]);
      listaUYL = [];
      if(window.listaUYLExcl) window.listaUYLExcl = [];
      primerEquipoJugadores = {};
      promInfo = {};
      pos = {};
      multiEq = {};
      movimientos = {};
      data = JSON.parse(JSON.stringify(RAW));
      autoGuardar();
      renderPlantTabs();
      renderPlantBody();
      render();
      toast('🗑️ Todos los jugadores han sido borrados');
    },
    'Borrar todo'
  );
}
// ── JA Youth: añadir por selector de equipo → jugador (en vez de buscador de texto) ──
function renderUYLEqSel(){
  const sel = document.getElementById('plant-uyl-eq-sel');
  sel.innerHTML = '';
  EQUIPOS.filter(eq=>eq!=='JUVENIL A').forEach(eq=>{
    const opt = document.createElement('option');
    opt.value = eq;
    opt.textContent = EQ_LABEL[eq] || eq;
    sel.appendChild(opt);
  });
  renderUYLJugSel();
}
function renderUYLJugSel(){
  const eqSel = document.getElementById('plant-uyl-eq-sel');
  const jugSel = document.getElementById('plant-uyl-jug-sel');
  jugSel.innerHTML = '';
  const eq = eqSel.value;
  const candidatos = (plantillas[eq] || []).filter(n=>!listaUYL.includes(n)).sort((a,b)=>a.localeCompare(b,'es'));
  if(!candidatos.length){
    const opt = document.createElement('option');
    opt.textContent = '— sin jugadores disponibles —';
    opt.disabled = true;
    jugSel.appendChild(opt);
    return;
  }
  candidatos.forEach(nombre=>{
    const opt = document.createElement('option');
    opt.value = nombre;
    opt.textContent = nombre;
    jugSel.appendChild(opt);
  });
}
function uylAñadirDesdeSelects(){
  const jugSel = document.getElementById('plant-uyl-jug-sel');
  const nombre = jugSel.value;
  if(!nombre) return;
  if(listaUYL.includes(nombre)){ toast('⚠️ '+nombre+' ya está en JA Youth'); return; }
  listaUYL.push(nombre);
  listaUYL.sort((a,b)=>a.localeCompare(b,'es'));
  renderPlantTabs(); renderPlantBody(); autoGuardar();
  toast('✅ '+nombre+' añadido a JA Youth');
}
