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
    // Inicializar con JA si está vacía — SOLO si Firebase ya terminó de cargar la
    // sesión real (window._fbSesionActiva). Si esto se dispara ANTES (justo tras
    // refrescar la página, con la lista vacía transitoriamente mientras llegan los
    // datos guardados), sobrescribía y guardaba una lista sin los extras de otros
    // equipos, perdiéndolos de verdad.
    if(listaUYL.length === 0 && window._fbSesionActiva){
      listaUYL = Object.keys(origen).filter(n=>origen[n]==='JUVENIL A').sort();
      autoGuardar();
    }
    const _uylNumPor = listaUYL.filter(n => porteros.includes(n)).length;
    const _uylNumNorm = listaUYL.length - _uylNumPor;
    document.getElementById('plant-count').textContent = (_uylNumPor > 0 ? _uylNumNorm + '+' + _uylNumPor : listaUYL.length) + ' jugadores';
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
    listaUYL.forEach((nombre, i)=>{
      const eqO = origen[nombre] || 'JA';
      const row = mk('div','plant-row');
      row.draggable = true;
      row.dataset.nombre = nombre;
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
  const jugadores = plantillas[plantEqActivo] || [];
  document.getElementById('plant-eq-title').textContent = plantEqActivo;
  const _numPor = jugadores.filter(n => porteros.includes(n)).length;
  const _numNorm = jugadores.length - _numPor;
  document.getElementById('plant-count').textContent = (_numPor > 0 ? _numNorm + '+' + _numPor : jugadores.length) + ' jugadores';
  jugadores.forEach((nombre, i)=>{
    const row = mk('div','plant-row');
    row.draggable = true;
    row.dataset.nombre = nombre;
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
      if(typeof window.fbTogglePortero === 'function') window.fbTogglePortero(nombre, porInput.checked);
    };
    const porTxt = document.createElement('span');
    porTxt.textContent = 'POR';
    porLabel.appendChild(porInput);
    porLabel.appendChild(porTxt);
    const del = mk('button','plant-del'); del.textContent = '×';
    del.title = 'Eliminar '+nombre;
    del.onclick = ()=> plantEliminar(nombre);
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
    eqSel.onchange = ()=>{
      const nuevoEq = eqSel.value;
      const eqViejo = plantEqActivo;
      abrirDiaAplicaModal(nombre, eqViejo, nuevoEq, (diaIdx)=>{
        plantCambiarEquipo(nombre, nuevoEq, diaIdx);
      }, ()=>{ eqSel.value = eqViejo; });
    };
    const tienePromo = DIAS.some(d => getDestinos(d, plantEqActivo, nombre).length > 0);
    let quitarPromoBtn = null;
    if(tienePromo){
      quitarPromoBtn = mk('button','plant-del');
      quitarPromoBtn.textContent = '🚫';
      quitarPromoBtn.title = 'Quitar la promoción (sigue en '+plantEqActivo+', solo se le quita el destino)';
      quitarPromoBtn.onclick = ()=> quitarPromocionCompleta(nombre, plantEqActivo);
    }
    row.appendChild(dragHandle); row.appendChild(num); row.appendChild(nm);
    row.appendChild(editBtn); row.appendChild(porLabel); row.appendChild(eqSel);
    if(quitarPromoBtn) row.appendChild(quitarPromoBtn);
    row.appendChild(del);
    list.appendChild(row);
  });
}
function quitarTodasLasPromociones(eqPropio){
  let totalJugadores = 0, totalDias = 0;
  (plantillas[eqPropio]||[]).forEach(nombre=>{
    let tuvo = false;
    DIAS.forEach(d=>{
      const destinos = getDestinos(d, eqPropio, nombre);
      if(!destinos.length) return;
      tuvo = true;
      destinos.forEach(destino=>limpiarUnDestino(d, destino, nombre));
      if(promInfo[d]?.[eqPropio]) delete promInfo[d][eqPropio][nombre];
      const prom = data[d]?.[eqPropio]?.promovidos_1er;
      if(prom){ const i=prom.indexOf(nombre); if(i>=0) prom.splice(i,1); }
      totalDias++;
    });
    if(tuvo) totalJugadores++;
  });
  renderPlantBody();
  autoGuardar();
  render();
  toast(totalJugadores>0
    ? '🚫 Quitadas '+totalDias+' promociones de '+totalJugadores+' jugador(es) en '+eqPropio
    : 'ℹ️ No había promociones activas en '+eqPropio);
}
function quitarPromocionCompleta(nombre, eqPropio){
  let quitados = 0;
  DIAS.forEach(d=>{
    const destinos = getDestinos(d, eqPropio, nombre);
    if(!destinos.length) return;
    destinos.forEach(destino=>limpiarUnDestino(d, destino, nombre));
    if(promInfo[d]?.[eqPropio]) delete promInfo[d][eqPropio][nombre];
    const prom = data[d]?.[eqPropio]?.promovidos_1er;
    if(prom){ const i=prom.indexOf(nombre); if(i>=0) prom.splice(i,1); }
    quitados++;
  });
  renderPlantBody();
  autoGuardar();
  render();
  toast('🚫 Promoción de '+nombre+' quitada ('+quitados+' día'+(quitados===1?'':'s')+')');
}
function plantCambiarEquipo(nombre, nuevoEq, diaAplicaIdx){
  if(!nuevoEq || nuevoEq === plantEqActivo) return;
  const arr = plantillas[plantEqActivo];
  const idx = arr.indexOf(nombre);
  if(idx >= 0) arr.splice(idx, 1);
  if(!plantillas[nuevoEq]) plantillas[nuevoEq] = [];
  if(!plantillas[nuevoEq].includes(nombre)) plantillas[nuevoEq].push(nombre);
  origen[nombre] = nuevoEq;
  const idxHoy = (typeof diaAplicaIdx === 'number') ? diaAplicaIdx : diaHoyIdx();
  const diasFuturos = DIAS.filter((d,i)=>i>=idxHoy);
  diasFuturos.forEach(d=>{
    if(promInfo[d]?.[plantEqActivo]?.[nombre]){
      const destinos = getDestinos(d, plantEqActivo, nombre);
      destinos.forEach(destino=>limpiarUnDestino(d, destino, nombre));
      delete promInfo[d][plantEqActivo][nombre];
    }
  });
  if(plantEqActivo !== '1ER EQUIPO'){
    diasFuturos.forEach(d=>{
      ZONAS.forEach(z=>{
        const a = data[d][plantEqActivo]?.[z];
        if(!a) return;
        const i = a.indexOf(nombre);
        if(i>=0){ a.splice(i,1); if(z==='campo') delete pos[key(d,plantEqActivo,nombre)]; }
      });
    });
  }
  if(nuevoEq !== '1ER EQUIPO'){
    diasFuturos.forEach(d=>{
      if(!data[d][nuevoEq].disponibles.includes(nombre) &&
         !ZONAS.some(z=>data[d][nuevoEq][z].includes(nombre))){
        data[d][nuevoEq].disponibles.push(nombre);
      }
    });
  }
  if(plantEqActivo === '1ER EQUIPO'){
    diasFuturos.forEach(d=>{
      if(primerEquipoJugadores[d]){
        const i = primerEquipoJugadores[d].indexOf(nombre);
        if(i>=0) primerEquipoJugadores[d].splice(i,1);
      }
    });
  }
  diasFuturos.forEach(d=>{
    if(historicoJugador[d]) delete historicoJugador[d][nombre];
  });
  DIAS.forEach(d=>asegurarHistoricoJugador(d));
  renderPlantBody();
  render();
  toast('✓ '+nombre+' movido a '+(EQ_LABEL[nuevoEq]||nuevoEq));
}
function _normalizarNombre(s){
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
}
function buscarPosiblesDuplicados(nombre){
  const nombreNorm = _normalizarNombre(nombre);
  const palabras = nombreNorm.split(/\s+/).filter(w=>w.length>=3);
  const encontrados = [];
  Object.keys(origen).forEach(existente=>{
    if(existente === nombre) return;
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
  if(!plantillas[plantEqActivo]) plantillas[plantEqActivo]=[];
  if(plantillas[plantEqActivo].includes(nombre)){
    toast('⚠️ '+nombre+' ya está en '+plantEqActivo);
    return;
  }
  const parecidos = buscarPosiblesDuplicados(nombre);
  const nombreNorm = _normalizarNombre(nombre);
  const exactoEnOtroEquipo = parecidos.find(n=>_normalizarNombre(n)===nombreNorm);
  if(exactoEnOtroEquipo){
    showAlert(
      '⚠️ "'+nombre+'" ya existe en '+(origen[exactoEnOtroEquipo]||'otro equipo')+'. Si continúas, quedará en LAS DOS plantillas a la vez. ¿Seguro que quieres añadirlo también aquí?',
      ()=>_plantAñadirConfirmado(nombre),
      'Añadir de todas formas'
    );
    return;
  }
  _plantAñadirConfirmado(nombre);
  if(parecidos.length){
    const lista = parecidos.map(n=>n+' ('+(origen[n]||'?')+')').join(', ');
    toast('⚠️ Revisa: nombre parecido a '+lista);
  }
}
function abrirImportarTablaModal(){
  const overlay = mk('div','');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10410;background:rgba(0,0,0,.4);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:calc(24px + env(safe-area-inset-top,0px)) 16px 24px;backdrop-filter:blur(4px);';
  const box = mk('div','');
  box.style.cssText = 'width:100%;max-width:520px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.15);';
  const hdr = mk('div','');
  hdr.style.cssText = 'background:#2563eb;padding:14px 18px;';
  hdr.innerHTML = `<div style="font-family:'Segoe UI',sans-serif;font-size:14px;font-weight:800;color:#fff;">📋 Importar jugadores desde tabla</div>`;
  const body = mk('div','');
  body.style.cssText = 'padding:18px;';
  const sub = mk('div','');
  sub.style.cssText = 'font-family:\'Segoe UI\',sans-serif;font-size:12px;color:#5a6170;margin-bottom:12px;line-height:1.5;';
  sub.innerHTML = 'Pega aquí, una línea por jugador. Puedes escribir solo el nombre (se usa el equipo de abajo), o "Nombre, Equipo" / "Nombre" + TAB + "Equipo" (copiado directo de Excel/Sheets, cada línea con su propio equipo).';
  body.appendChild(sub);
  const eqLbl = mk('div','');
  eqLbl.style.cssText = 'font-family:\'Segoe UI\',sans-serif;font-size:11px;font-weight:700;color:#5a6170;margin-bottom:6px;text-transform:uppercase;letter-spacing:.4px;';
  eqLbl.textContent = 'Equipo por defecto (si una línea no trae equipo)';
  body.appendChild(eqLbl);
  const sel = document.createElement('select');
  sel.style.cssText = 'width:100%;padding:9px 12px;border-radius:10px;border:1.5px solid #dfe1e6;font-family:\'Segoe UI\',sans-serif;font-size:13px;color:#1a1d23;margin-bottom:14px;box-sizing:border-box;';
  EQUIPOS.forEach(eq=>{
    const opt = document.createElement('option');
    opt.value = eq; opt.textContent = EQ_LABEL[eq] || eq;
    if(eq === plantEqActivo) opt.selected = true;
    sel.appendChild(opt);
  });
  body.appendChild(sel);
  const textLbl = mk('div','');
  textLbl.style.cssText = 'font-family:\'Segoe UI\',sans-serif;font-size:11px;font-weight:700;color:#5a6170;margin-bottom:6px;text-transform:uppercase;letter-spacing:.4px;';
  textLbl.textContent = 'Lista de jugadores';
  body.appendChild(textLbl);
  const textarea = document.createElement('textarea');
  textarea.placeholder = 'ÁLVARO LEZCANO\nÁNGEL CARVAJAL, RMC\nMANEX REZOLA\tJUVENIL A\n...';
  textarea.style.cssText = 'width:100%;min-height:180px;padding:10px 12px;border-radius:10px;border:1.5px solid #dfe1e6;font-family:\'Segoe UI\',monospace;font-size:13px;color:#1a1d23;margin-bottom:14px;box-sizing:border-box;resize:vertical;';
  body.appendChild(textarea);
  const btnRow = mk('div','');
  btnRow.style.cssText = 'display:flex;gap:8px;';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.style.cssText = 'flex:1;padding:10px;border-radius:10px;border:1px solid #dfe1e6;background:transparent;color:#5a6170;font-family:\'Segoe UI\',sans-serif;font-size:13px;font-weight:700;cursor:pointer;';
  const okBtn = document.createElement('button');
  okBtn.textContent = 'Importar';
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
    const texto = textarea.value;
    const eqDefecto = sel.value;
    cerrar();
    importarTablaJugadores(texto, eqDefecto);
  };
}
const _ALIAS_EQUIPO = {
  'CASTILLA':'CASTILLA', 'CAS':'CASTILLA',
  'RMC':'RMC', 'REAL MADRID C':'RMC',
  'JUVENIL A':'JUVENIL A', 'JA':'JUVENIL A',
  'JUVENIL B':'JUVENIL B', 'JB':'JUVENIL B',
  'JUVENIL C':'JUVENIL C', 'JC':'JUVENIL C',
  'CADETE A':'CADETE A', 'CA':'CADETE A',
  '1ER EQUIPO':'1ER EQUIPO', 'PRIMER EQUIPO':'1ER EQUIPO', '1ER':'1ER EQUIPO',
};
function importarTablaJugadores(texto, eqDefecto){
  const lineas = texto.split('\n').map(l=>l.trim()).filter(Boolean);
  if(!lineas.length){ toast('⚠️ No hay nada que importar'); return; }
  let añadidos = 0, yaExistian = 0, equipoNoReconocido = [];
  lineas.forEach(linea=>{
    const partes = linea.split(/\t|,/).map(p=>p.trim()).filter(Boolean);
    const nombre = (partes[0]||'').toUpperCase();
    if(!nombre) return;
    let eq = eqDefecto;
    if(partes[1]){
      const alias = _ALIAS_EQUIPO[partes[1].toUpperCase()];
      if(alias) eq = alias;
      else equipoNoReconocido.push(partes[1]+' ('+nombre+')');
    }
    if(!plantillas[eq]) plantillas[eq] = [];
    if(plantillas[eq].includes(nombre)){ yaExistian++; return; }
    plantillas[eq].push(nombre);
    origen[nombre] = eq;
    if(eq !== '1ER EQUIPO'){
      DIAS.forEach(d=>{
        if(!data[d][eq].disponibles.includes(nombre) && !ZONAS.some(z=>(data[d][eq][z]||[]).includes(nombre))){
          if(!data[d][eq].disponibles) data[d][eq].disponibles = [];
          data[d][eq].disponibles.push(nombre);
        }
      });
    }
    añadidos++;
  });
  plantillas[eqDefecto] && plantillas[eqDefecto].sort((a,b)=>a.localeCompare(b,'es'));
  EQUIPOS.forEach(eq=>{ if(plantillas[eq]) plantillas[eq].sort((a,b)=>a.localeCompare(b,'es')); });
  renderPlantTabs(); renderPlantBody();
  autoGuardar(); render();
  let msg = '✅ '+añadidos+' jugadores importados';
  if(yaExistian) msg += ', '+yaExistian+' ya existían (omitidos)';
  if(equipoNoReconocido.length){
    msg += '. ⚠️ Equipo no reconocido en: '+equipoNoReconocido.slice(0,3).join('; ')+(equipoNoReconocido.length>3?'...':'');
  }
  toast(msg);
}
function plantAñadirDesdeFecha(){
  const input = document.getElementById('plant-add-input');
  const nombre = input.value.trim().toUpperCase();
  if(!nombre){ input.focus(); return; }
  if(plantEqActivo === 'JA_YOUTH' || plantEqActivo === '1ER EQUIPO'){
    toast('⚠️ Esta opción no aplica aquí, usa "+ Añadir"');
    return;
  }
  if(!plantillas[plantEqActivo]) plantillas[plantEqActivo]=[];
  if(plantillas[plantEqActivo].includes(nombre)){
    toast('⚠️ '+nombre+' ya está en '+plantEqActivo);
    return;
  }
  const parecidos = buscarPosiblesDuplicados(nombre);
  const nombreNorm = _normalizarNombre(nombre);
  const exactoEnOtroEquipo = parecidos.find(n=>_normalizarNombre(n)===nombreNorm);
  function continuar(){
    abrirCalendarioFechaModal(nombre, (diaIdx)=>{
      _plantAñadirConfirmado(nombre, diaIdx);
      if(parecidos.length){
        const lista = parecidos.map(n=>n+' ('+(origen[n]||'?')+')').join(', ');
        toast('⚠️ Revisa: nombre parecido a '+lista);
      }
    });
  }
  if(exactoEnOtroEquipo){
    showAlert(
      '⚠️ "'+nombre+'" ya existe en '+(origen[exactoEnOtroEquipo]||'otro equipo')+'. Si continúas, quedará en LAS DOS plantillas a la vez. ¿Seguro que quieres añadirlo también aquí?',
      continuar,
      'Añadir de todas formas'
    );
    return;
  }
  continuar();
}
function _plantAñadirConfirmado(nombre, idxDesde){
  const input = document.getElementById('plant-add-input');
  plantillas[plantEqActivo].push(nombre);
  plantillas[plantEqActivo].sort((a,b)=>a.localeCompare(b,'es'));
  origen[nombre] = plantEqActivo;
  if(plantEqActivo !== '1ER EQUIPO'){
    DIAS.forEach((d,i)=>{
      if(typeof idxDesde === 'number' && i < idxDesde) return;
      if(!(data[d][plantEqActivo].disponibles||[]).includes(nombre) &&
         !ZONAS.some(z=>(data[d][plantEqActivo][z]||[]).includes(nombre))){
        if(!data[d][plantEqActivo].disponibles) data[d][plantEqActivo].disponibles = [];
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
  showAlert(
    '¿Cómo quieres eliminar a '+nombre+'? "Borrar todo" lo quita también del histórico de días anteriores (como si nunca hubiera existido). "Borrar desde hoy" lo quita de la plantilla a partir de hoy, pero mantiene intacto lo que pasó en días anteriores.',
    ()=>_ejecutarBorradoJugador(nombre, 'todo'),
    'Borrar todo',
    ()=>_ejecutarBorradoJugador(nombre, 'desdeHoy'),
    'Borrar desde hoy'
  );
}
function _ejecutarBorradoJugador(nombre, alcance){
  if(!plantillas[plantEqActivo]) return;
  if(typeof window.fbGuardarBackupPreAccion === 'function'){
    window.fbGuardarBackupPreAccion(buildPayload(false), 'Antes de borrar a '+nombre+' ('+alcance+')');
  }
  const idx = plantillas[plantEqActivo].indexOf(nombre);
  if(idx>=0) plantillas[plantEqActivo].splice(idx,1);
  if(origen[nombre]===plantEqActivo || !EQUIPOS.some(e=>(plantillas[e]||[]).includes(nombre) && origen[nombre]===e)){
    const otroEqConEl = EQUIPOS.find(e=>e!==plantEqActivo && (plantillas[e]||[]).includes(nombre));
    if(otroEqConEl) origen[nombre] = otroEqConEl;
    else delete origen[nombre];
  }
  const pIdx = porteros.indexOf(nombre);
  if(pIdx >= 0){
    porteros.splice(pIdx,1);
    if(typeof window.fbTogglePortero === 'function') window.fbTogglePortero(nombre, false);
  }
  const diasATocar = alcance === 'todo' ? DIAS : DIAS.filter((d,i)=>i>=diaHoyIdx());
  if(plantEqActivo !== '1ER EQUIPO'){
    diasATocar.forEach(d=>{
      ZONAS.forEach(z=>{
        const i=(data[d][plantEqActivo][z]||[]).indexOf(nombre);
        if(i>=0) data[d][plantEqActivo][z].splice(i,1);
      });
      if(promInfo[d]?.[plantEqActivo]) delete promInfo[d][plantEqActivo][nombre];
    });
  } else {
    diasATocar.forEach(d=>{
      if(primerEquipoJugadores[d]){
        const i = primerEquipoJugadores[d].indexOf(nombre);
        if(i>=0) primerEquipoJugadores[d].splice(i,1);
      }
    });
  }
  EQUIPOS.forEach(otroEq=>{
    if(otroEq === plantEqActivo) return;
    diasATocar.forEach(d=>{
      ZONAS.forEach(z=>{
        const arr = data[d]?.[otroEq]?.[z];
        if(!arr) return;
        const i = arr.indexOf(nombre);
        if(i>=0){ arr.splice(i,1); if(z==='campo') delete pos[key(d,otroEq,nombre)]; }
      });
      if(promInfo[d]?.[otroEq]) delete promInfo[d][otroEq][nombre];
    });
  });
  if(plantEqActivo !== '1ER EQUIPO'){
    diasATocar.forEach(d=>{
      if(primerEquipoJugadores[d]){
        const i = primerEquipoJugadores[d].indexOf(nombre);
        if(i>=0) primerEquipoJugadores[d].splice(i,1);
      }
    });
  }
  if(alcance === 'todo'){
    DIAS.forEach(d=>{ if(historicoJugador[d]) delete historicoJugador[d][nombre]; });
    if(typeof _semanasGuardadas === 'object' && _semanasGuardadas){
      Object.keys(_semanasGuardadas).forEach(weekKey=>{
        const foto = _semanasGuardadas[weekKey];
        if(!foto) return;
        if(foto.origen) delete foto.origen[nombre];
        if(foto.historicoJugador){
          Object.keys(foto.historicoJugador).forEach(d=>{ delete foto.historicoJugador[d][nombre]; });
        }
        if(foto.data){
          Object.keys(foto.data).forEach(d=>{
            EQUIPOS.forEach(eq=>{
              ZONAS.forEach(z=>{
                const arr = foto.data[d]?.[eq]?.[z];
                if(!arr) return;
                const i = arr.indexOf(nombre);
                if(i>=0) arr.splice(i,1);
              });
            });
          });
        }
        if(foto.primerEquipoJugadores){
          Object.keys(foto.primerEquipoJugadores).forEach(d=>{
            const arr = foto.primerEquipoJugadores[d];
            if(!arr) return;
            const i = arr.indexOf(nombre);
            if(i>=0) arr.splice(i,1);
          });
        }
        if(foto.pos){
          Object.keys(foto.pos).forEach(k=>{
            if(k.endsWith('|'+nombre)) delete foto.pos[k];
          });
        }
      });
    }
  }
  renderPlantTabs();
  renderPlantBody();
  window._saltarFrenoGuardado = true;
  render();
  toast(alcance==='todo'
    ? '🗑️ '+nombre+' eliminado por completo (incluido el histórico)'
    : '🗑️ '+nombre+' eliminado desde hoy (histórico anterior intacto)');
}
function borrarTodosLosJugadores(){
  showAlert(
    '⚠️ Esto borrará TODOS los jugadores de TODOS los equipos (plantillas, campo, promociones, todo) de forma irreversible. ¿Seguro que quieres empezar de cero?',
    ()=>{
      if(typeof window.fbGuardarBackupPreAccion === 'function'){
        window.fbGuardarBackupPreAccion(buildPayload(false), 'Antes de Borrar todo');
      }
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
      window._saltarFrenoGuardado = true;
      autoGuardar();
      if(typeof fijarTotalJugadoresConocido === 'function') fijarTotalJugadoresConocido();
      renderPlantTabs();
      renderPlantBody();
      render();
      toast('🗑️ Todos los jugadores han sido borrados');
    },
    'Borrar todo'
  );
}
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
