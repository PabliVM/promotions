// ── campograma-buildcard.js — buildCard, chip, autoPromocionar, multiEq ──
// ══════════════════════════════════════════════════
// FILTROS VISTA SEMANA — días y equipos visibles
// ══════════════════════════════════════════════════
let _filtroDiasActivos = new Set(DIAS);
let _filtroEqsActivos = new Set(EQUIPOS);
let _incluirPrimerEquipo = false; // botón "1ER EQ" en filtros de vista semana — apagado por defecto

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
  // Botón extra: incluir Primer Equipo como card más (apagado por defecto)
  const btnPrimer = mk('button','filtro-eq-btn'+(_incluirPrimerEquipo?' activo':''));
  btnPrimer.textContent = '1ER EQ';
  btnPrimer.title = 'Mostrar Primer Equipo como equipo más';
  btnPrimer.onclick=()=>{
    _incluirPrimerEquipo = !_incluirPrimerEquipo;
    renderFiltrosSemana();
    renderCards();
    if(vistaActual==='semana') requestAnimationFrame(()=>igualarZonasSemana(document.getElementById('grid')));
  };
  eqsRow.appendChild(btnPrimer);
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

  if(_incluirPrimerEquipo){
    const trP = document.createElement('tr');
    trP.className = 'semana-tr-eq';
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
      const card = buildCardPrimerEquipo();
      dia = diaOrig;

      const nm = card.querySelector('.card-hdr-name');
      if(nm){
        const nombreHtml = nm.innerHTML;
        nm.innerHTML = '';
        const nombreSpan = document.createElement('span');
        nombreSpan.className = 'card-hdr-nombre-txt';
        nombreSpan.innerHTML = nombreHtml;
        nm.appendChild(nombreSpan);
        const fechaSpan = document.createElement('span');
        fechaSpan.className = 'card-hdr-fecha'+(esHoy?' card-hdr-fecha-hoy':'');
        fechaSpan.textContent = d + '  ' + fechaFmt;
        nm.appendChild(fechaSpan);
      }
      if(esHoy){
        const hdrEl = card.querySelector('.card-hdr');
        if(hdrEl) hdrEl.classList.add('card-hdr-hoy');
      }
      const td = document.createElement('td');
      td.className = 'semana-td-card';
      td.appendChild(card);
      trP.appendChild(td);
    });
    tbody.appendChild(trP);
  }

  table.appendChild(tbody);
  grid.appendChild(table);
}
function buildCard(eq){
  if(!data[dia] || !data[dia][eq]) return mk('div','card');
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
  descBtn.textContent='💤 DESCANSA';
  descBtn.title='Marcar día de descanso';
  descBtn.onclick=(e)=>{ e.stopPropagation(); toggleDescanso(eq,_diaModo); };
  right.appendChild(descBtn);
  const modoB=mk('button','modo-btn'+(esPartido(eq,_diaModo)?' partido':''));
  modoB.textContent=esPartido(eq,_diaModo)?'⚽ PARTIDO':'🏋️ ENTRENO';
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
    const _diaRival = dia;
    const banner=mk('div','partido-banner');
    const rivalVal = rivales[_diaRival]?.[eq] || '';
    const sugerido = sugerirRival(eq);
    banner.innerHTML=`
      <span class="partido-lbl">⚽ PARTIDO</span>
      <input class="rival-inp" type="text" placeholder="${sugerido?'vs '+sugerido:'vs Rival...'}"
        value="${rivalVal}"
        oninput="guardarRival('${eq}',this.value,'${_diaRival}')"
        onclick="event.stopPropagation()">`;
    card.appendChild(banner);
    // Selector tipo de partido — dinámico desde tiposConfig
    const _diaTipo = dia; // capturar día de ESTA card
    const tipoSel=mk('div','tipo-partido-sel');
    const tipos = tiposConfig[eq] || TIPOS_BASE;
    const tipoActual = tipoPartido[_diaTipo]?.[eq] || tipos[0]?.k || 'liga';
    tipos.forEach(({k,l,c,uyl})=>{
      const btn=mk('button','tipo-btn'+(tipoActual===k?' active':''));
      btn.textContent=l;
      if(tipoActual===k && c){
        btn.style.cssText=`color:${c};border-color:${c};background:${c}22;`;
      }
      btn.onclick=(e)=>{
        e.stopPropagation();
        if(!tipoPartido[_diaTipo]) tipoPartido[_diaTipo]={};
        tipoPartido[_diaTipo][eq]=k;
        if(uyl) modoUYL[_diaTipo]=true;
        else if(eq==='JUVENIL A') modoUYL[_diaTipo]=false;
        autoGuardar();
        renderCards();
        if(vistaActual==='semana') requestAnimationFrame(()=>igualarZonasSemana(document.getElementById('grid')));
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
  cWrap.dataset.eq=eq; cWrap.dataset.zona='campo'; cWrap.dataset.dia=dia;
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
  if(!esVistaLista(eq, dia)){
  // Banquillo (solo en modo partido, justo debajo del campo)
  if(esPartido(eq)){
    const zBanq=mk('div','zona-banquillo dz');
    zBanq.dataset.eq=eq; zBanq.dataset.zona='banquillo'; zBanq.dataset.dia=dia;
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
  zDisp.dataset.eq=eq; zDisp.dataset.zona='disponibles'; zDisp.dataset.dia=dia;
  const lblD=mk('div','zona-lbl');
  zDisp.appendChild(lblD);
  lblD.textContent='DISPONIBLES ('+(d.disponibles||[]).length+')';
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
    // Modo normal: disponibles propios del equipo, ordenados según Plantillas
    const ordenPlant = plantillas[eq] || [];
    const dispOrdenados = [...d.disponibles].sort((a,b)=>{
      const ia = ordenPlant.indexOf(a), ib = ordenPlant.indexOf(b);
      return (ia===-1?999:ia) - (ib===-1?999:ib);
    });
    dispOrdenados.forEach(n=>cwD.appendChild(chip(n,eq,'disponibles','c-verde','cz')));
  }
  zDisp.appendChild(cwD);
  zDisp.appendChild(buildAddInput(eq,'disponibles'));
  card.appendChild(zDisp);
  // Columnas estado
  if(!colNames[eq]) colNames[eq]=['PROMOCIONADOS','LESIONADOS','OTROS'];
  // Columnas estado
  if(!colNames[eq]) colNames[eq]=['PROMOCIONADOS','LESIONADOS','OTROS'];
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
    col.dataset.eq=eq; col.dataset.zona=zona; col.dataset.dia=dia;
    // Label
    const lblWrap=mk('div','zona-lbl-wrap');
    const lbl=mk('input','zona-lbl-edit');
    lbl.type='text';
    lbl.value = colNames[eq][idx] || (zona==='extra'?'EXTRA':zona.toUpperCase());
    lbl.title='Pulsa para editar el nombre';
    lbl.onchange=()=>{
      if(!colNames[eq]) colNames[eq]=['PROMOCIONADOS','LESIONADOS','OTROS'];
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
      // Si sigue activo en otra zona de su equipo, es duplicado → rojo en vez de naranja
      let ccChip = cc;
      if(zona==='promovidos_1er' && ZONAS_ACTIVAS.some(z=>z!=='promovidos_1er' && (d[z]||[]).includes(n))){
        ccChip = 'c-rojo';
      }
      const c=chip(n,eq,zona,ccChip,'cz');
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
  }

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
  return nombre; // texto plano siempre
}
function chip(nombre,eq,zona,color,type){
  const eqO=origen[nombre];
  const prueba   = eqO === 'PRUEBA';
  const prestado = !prueba && eqO && eqO!==eq;
  let cf = prueba ? 'c-prueba' : (prestado ? (EQ_COLORS[eqO]||'c-prestado') : color);
  const multi = esMulti(nombre);
  const isCampo = type === 'cf';
  const esPort = porteros.includes(nombre);
  const c=mk('div',`chip ${cf} ${multi?'c-multi':''} ${type}${esPort?' chip-portero':''}`);
  c.innerHTML=chipHTML(nombre, isCampo);
  c.dataset.eq=eq; c.dataset.zona=zona; c.dataset.nombre=nombre; c.dataset.dia=dia;
  // Tooltip: último movimiento registrado
  const _mv = movimientos[dia]?.[eq]?.[nombre];
  if(_mv){
    const _d = new Date(_mv.ts);
    const _fmt = _d.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit'}) + ' ' + _d.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
    c.title = '✏️ ' + (_mv.user.includes('@') ? _mv.user.split('@')[0] : _mv.user) + ' · ' + _fmt;
  } else if(prueba) c.title='Jugador a prueba';
  else if(multi){
    const eqs = eqsDeNombre(dia,nombre).join(', ');
    c.title='En varios equipos hoy: '+eqs;
  }
  else if(prestado) c.title='Viene de '+eqO;
  return c;
}
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
