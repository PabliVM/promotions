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
