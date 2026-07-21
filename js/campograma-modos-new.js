// ── campograma-modos.js — Reset, partido, descanso, tipos, UYL ──
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
var _resetEq = null;
var _resetDia = null;
function abrirResetModal(eq, diaP){
  diaP = diaP || dia;
  _resetEq = eq;
  _resetDia = diaP;
  document.getElementById('reset-modal-title').textContent = 'Resetear ' + eq;
  document.getElementById('reset-modal-sub').textContent = eq + ' — ' + diaP;
  // Contar jugadores en campo para contexto
  const enCampo = data[diaP][eq]?.campo?.length || 0;
  const propios = Object.keys(origen).filter(n=>origen[n]===eq).length;
  document.querySelector('.reset-opt-campo .reset-opt-desc').textContent =
    `${enCampo} jugadores del campo vuelven a disponibles. Lesiones, promociones y otros se mantienen.`;
  document.querySelector('.reset-opt-todo .reset-opt-desc').textContent =
    `Los ${propios} jugadores del equipo (campo, lesiones, promociones…) vuelven todos a disponibles.`;
  document.getElementById('reset-opt-campo').onclick = ()=>{
    cerrarResetModal();
    resetearSoloCampo(_resetEq, _resetDia);
  };
  document.getElementById('reset-opt-todo').onclick = ()=>{
    cerrarResetModal();
    resetearEquipo(_resetEq, _resetDia);
  };
  document.getElementById('reset-modal-overlay').classList.add('open');
}
function cerrarResetModal(e){
  if(!e || e.target===document.getElementById('reset-modal-overlay'))
    document.getElementById('reset-modal-overlay').classList.remove('open');
}
function resetearSoloCampo(eq, diaP){
  diaP = diaP || dia;
  const propios = Object.keys(origen).filter(n => origen[n] === eq);
  const enCampo = [...(data[diaP][eq]?.campo || [])];
  // Quitar del campo
  data[diaP][eq].campo = [];
  // Limpiar posiciones
  enCampo.forEach(n => delete pos[key(diaP, eq, n)]);
  // Quitar también de campos de otros equipos donde estuvieran prestados
  EQUIPOS.forEach(otroEq => {
    if(otroEq === eq) return;
    const arr = data[diaP][otroEq]?.campo;
    if(!arr) return;
    enCampo.filter(n=>origen[n]===eq).forEach(n=>{
      const i = arr.indexOf(n); if(i>=0){ arr.splice(i,1); delete pos[key(diaP,otroEq,n)]; }
    });
  });
  // Volver a disponibles del propio equipo (solo los que no están ya en otra zona)
  enCampo.forEach(n=>{
    const eqPropio = origen[n] || eq;
    if(eqPropio !== eq) return; // prestado — lo dejamos en su equipo
    const enOtraZona = ['banquillo','lesionados','promovidos_1er','otros','extra']
      .some(z=>(data[diaP][eq]?.[z]||[]).includes(n));
    const disp = data[diaP][eq].disponibles;
    if(!enOtraZona && !disp.includes(n)) disp.push(n);
  });
  // Limpiar multiEq del campo
  enCampo.forEach(n=>{
    if(multiEq[diaP]?.[n]){
      multiEq[diaP][n] = multiEq[diaP][n].filter(e=>e!==eq);
      if(multiEq[diaP][n].length<=1) delete multiEq[diaP][n];
    }
  });
  autoGuardar();
  render();
  toast(`⬜ Campo de ${eq} reseteado (${diaP}) — ${enCampo.length} jugadores a disponibles`);
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
    // Mover jugadores del campo y banquillo → disponibles DE SU EQUIPO DE ORIGEN
    const dd = data[diaT]?.[eq];
    if(dd){
      const mover = (arr)=>{
        if(!Array.isArray(arr)) return;
        // Copia porque vamos a vaciar el array original
        [...arr].forEach(n=>{
          const eqOrigen = origen[n] || eq; // equipo propietario real del jugador
          const dOrigen = data[diaT]?.[eqOrigen];
          if(dOrigen){
            if(!Array.isArray(dOrigen.disponibles)) dOrigen.disponibles = [];
            if(!dOrigen.disponibles.includes(n)) dOrigen.disponibles.push(n);
          }
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
var _cfgEqActivo = null;
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
