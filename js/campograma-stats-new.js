// ── campograma-stats.js — Estadísticas de jugadores y equipos ──
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
let _regEqSel = EQUIPOS[0];
function switchRegTab(tab){
  _regTab = tab;
  document.querySelectorAll('.reg-tab').forEach((b,i)=>b.classList.toggle('active', (i===0&&tab==='jugadores')||(i===1&&tab==='equipos')));
  const inp = document.getElementById('reg-search');
  const sel = document.getElementById('reg-eq-filter');
  const btns = document.getElementById('reg-eq-btns');
  inp.style.display = tab==='jugadores' ? '' : 'none';
  sel.style.display = tab==='jugadores' ? '' : 'none';
  btns.style.display = tab==='equipos' ? 'flex' : 'none';
  if(tab==='equipos') renderRegEqBtns();
  renderReg();
}
function renderRegEqBtns(){
  const wrap = document.getElementById('reg-eq-btns');
  wrap.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;padding:0 20px 12px;';
  wrap.innerHTML = '';
  const eqsShort = {'CASTILLA':'CAS','RMC':'RMC','JUVENIL A':'JA','JUVENIL B':'JB','JUVENIL C':'JC','CADETE A':'CA'};
  EQUIPOS.forEach(eq=>{
    const b = document.createElement('button');
    b.className = 'filtro-eq-btn'+(eq===_regEqSel?' activo':'');
    b.textContent = eqsShort[eq]||eq;
    b.onclick = ()=>{ _regEqSel = eq; renderRegEqBtns(); renderReg(); };
    wrap.appendChild(b);
  });
}
// Desglose de externos: de qué equipos vienen los jugadores prestados
function calcDesgloseExternos(eq){
  const contador = {};
  let total = 0;
  DIAS.forEach(d=>{
    (data[d][eq]?.campo||[]).forEach(n=>{
      const eqO = origen[n];
      if(eqO && eqO!==eq){ contador[eqO]=(contador[eqO]||0)+1; total++; }
    });
  });
  const juvGrupo = ['JUVENIL A','JUVENIL B','JUVENIL C'];
  const pct = (n)=> total ? Math.round((n/total)*100) : 0;
  const rmc = contador['RMC']||0;
  const juv = juvGrupo.reduce((a,e)=>a+(contador[e]||0),0);
  const cad = contador['CADETE A']||0;
  return { pctRMC: pct(rmc), pctJuveniles: pct(juv), pctCadete: pct(cad), total };
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
  let totalJugSesion=0, totalPorterosSesion=0;
  const conteoJugador={};
  DIAS.forEach(d=>{
    const campo = data[d][eq].campo||[];
    if(!campo.length) return;
    totalSesiones++;
    const esP = !!(modoPartido[d]?.[eq]);
    if(esP) sesionesPartido++; else sesionesEntreno++;
    let propios=0, externos=0, porterosSesion=0;
    campo.forEach(n=>{
      if(origen[n]===eq) propios++; else externos++;
      if(porteros.includes(n)) porterosSesion++;
      conteoJugador[n]=(conteoJugador[n]||0)+1;
    });
    totalJugadoresPropios+=propios;
    totalJugadoresExteros+=externos;
    totalJugSesion+=campo.length;
    totalPorterosSesion+=porterosSesion;
    jugsDias.push({dia:d, total:campo.length, propios, externos, esPartido:esP});
    // Promovidos
    Object.entries(promInfo[d]?.[eq]||{}).forEach(([n,dest])=>{ if(dest) promosSemana.add(n); });
  });
  const pctExternos = totalSesiones ? Math.round(totalJugadoresExteros/(totalJugadoresPropios+totalJugadoresExteros)*100)||0 : 0;
  const avgJugadores = totalSesiones ? +(totalJugSesion/totalSesiones).toFixed(1) : 0;
  const avgPorteros = totalSesiones ? +(totalPorterosSesion/totalSesiones).toFixed(1) : 0;
  let topJugador=null, topN=0;
  Object.entries(conteoJugador).forEach(([n,c])=>{ if(c>topN){ topN=c; topJugador=n; } });
  return { totalSesiones, sesionesPartido, sesionesEntreno, pctExternos, promosSemana:[...promosSemana], jugsDias, avgJugadores, avgPorteros, topJugador, topN };
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
    html+=`<tr><td><span class="reg-eq-pill" style="background:${col}1a;color:${col};border:1px solid ${col}55;">${eqOrig}</span><div class="reg-jug-name">${nombre}</div></td>`;
    DIAS.forEach(d=>{
      let cls='empty', txt='·';
      EQUIPOS.forEach(eq=>{
        const esP=!!(modoPartido[d]?.[eq]);
        if((data[d][eq].campo||[]).includes(nombre)){ cls=esP?'partido':'active'; txt=esP?'⚽':'✓'; }
        else if((data[d][eq].banquillo||[]).includes(nombre) && cls==='empty'){ cls='banco'; txt='B'; }
      });
      html+=`<td><span class="reg-dot ${cls}">${txt}</span></td>`;
    });
    html+=`<td><span style="color:#4ade80;font-weight:800;">${entrenos||''}</span></td>`;
    html+=`<td><span style="color:#f59e0b;font-weight:800;">${partidos||''}</span></td>`;
    html+=`<td><span style="color:#60a5fa;font-weight:800;">${banco||''}</span></td>`;
    html+=`<td class="reg-total">${total||'—'}</td></tr>`;
  });
  html+='</tbody></table></div>';
  if(!filtrados.length) html='<div style="padding:30px;text-align:center;color:rgba(255,255,255,.25);font-family:\'Segoe UI\',-apple-system,sans-serif;font-size:14px;text-transform:uppercase;">Sin jugadores</div>';
  container.innerHTML=html;
}
function renderRegEquipos(container){
  const eq = _regEqSel;
  const col=EQ_COLOR[eq]||'#94a3b8';
  const s=calcStatsEquipo(eq);
  let html='<div id="reg-equipo-grid">';
  if(!s.totalSesiones){
    html+=`<div class="reg-eq-card"><div class="reg-eq-card-title" style="color:${col}">${eq}<span class="reg-eq-badge" style="background:rgba(0,0,0,.05);color:rgba(0,0,0,.3)">Sin datos esta semana</span></div></div>`;
  } else {
    const pctPropios=100-s.pctExternos;
    const desg = calcDesgloseExternos(eq);
    html+=`<div class="reg-eq-card">
      <div class="reg-eq-card-title" style="color:${col}">${eq}
        <span class="reg-eq-badge" style="background:${col}18;color:${col}">${s.totalSesiones} sesiones esta semana</span>
      </div>
      <div class="reg-stat-row">
        <div class="reg-stat-box"><div class="reg-stat-num" style="color:#16a34a">${s.sesionesEntreno}</div><div class="reg-stat-lbl">Entrenos</div></div>
        <div class="reg-stat-box"><div class="reg-stat-num" style="color:#d97706">${s.sesionesPartido}</div><div class="reg-stat-lbl">Partidos</div></div>
        <div class="reg-stat-box"><div class="reg-stat-num" style="color:#2563eb">${s.avgJugadores}</div><div class="reg-stat-lbl">Media jugadores/sesión</div></div>
        <div class="reg-stat-box"><div class="reg-stat-num" style="color:#7c3aed">${s.avgPorteros}</div><div class="reg-stat-lbl">Media porteros/sesión</div></div>
      </div>
      <div class="reg-stat-row">
        <div class="reg-stat-box"><div class="reg-stat-num" style="font-size:14px;color:#1a1d23">${s.topJugador||'—'}</div><div class="reg-stat-lbl">Jugador con más entrenos (${s.topN||0})</div></div>
      </div>
      <div class="reg-bar-row">
        <span class="reg-bar-label">Propios</span>
        <div class="reg-bar-track"><div class="reg-bar-fill" style="width:${pctPropios}%;background:#16a34a"></div></div>
        <span class="reg-bar-val" style="color:#16a34a">${pctPropios}%</span>
      </div>
      <div class="reg-bar-row">
        <span class="reg-bar-label">Externos</span>
        <div class="reg-bar-track"><div class="reg-bar-fill" style="width:${s.pctExternos}%;background:#dc2626"></div></div>
        <span class="reg-bar-val" style="color:#dc2626">${s.pctExternos}%</span>
      </div>`;
    if(desg.total>0){
      html+=`<div style="margin-top:10px;font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;">De dónde vienen los externos</div>
      <div class="reg-bar-row"><span class="reg-bar-label">RMC</span><div class="reg-bar-track"><div class="reg-bar-fill" style="width:${desg.pctRMC}%;background:#7c3aed"></div></div><span class="reg-bar-val" style="color:#7c3aed">${desg.pctRMC}%</span></div>
      <div class="reg-bar-row"><span class="reg-bar-label">Juveniles</span><div class="reg-bar-track"><div class="reg-bar-fill" style="width:${desg.pctJuveniles}%;background:#eab308"></div></div><span class="reg-bar-val" style="color:#b45309">${desg.pctJuveniles}%</span></div>
      <div class="reg-bar-row"><span class="reg-bar-label">Cadete A</span><div class="reg-bar-track"><div class="reg-bar-fill" style="width:${desg.pctCadete}%;background:#ea580c"></div></div><span class="reg-bar-val" style="color:#ea580c">${desg.pctCadete}%</span></div>`;
    }
    // Días con sesión
    html+=`<div style="margin-top:10px;font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;">Días con sesión</div>`;
    html+=`<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap;">`;
    s.jugsDias.forEach(({dia,total,propios,externos,esPartido})=>{
      const diaCort=dia.slice(0,3);
      const c=esPartido?'#d97706':'#16a34a';
      html+=`<div title="${dia}: ${total} jugadores (${propios} propios, ${externos} externos)" style="background:${c}18;border:1px solid ${c}44;border-radius:6px;padding:3px 7px;font-size:10px;font-weight:700;color:${c}">${diaCort} ${total}${esPartido?' ⚽':''}</div>`;
    });
    html+=`</div>`;
    if(s.promosSemana.length){
      html+=`<div style="margin-top:10px;font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Promovidos esta semana</div><div class="reg-prom-list">`;
      s.promosSemana.forEach(n=>{ html+=`<span class="reg-prom-chip">${n}</span>`; });
      html+=`</div>`;
    }
    html+=`</div>`;
  }
  html+='</div>';
  container.innerHTML=html;
}
// ══════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════
