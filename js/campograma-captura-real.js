// ── campograma-captura.js — Captura de fotos y panel Firebase ──
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
  let colN = ['PROMOCIONADOS','LESIONADOS','OTROS'];
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
    colN   = colNames[eq] || ['PROMOCIONADOS','LESIONADOS','OTROS'];
    proms  = d.promovidos_1er || [];
    lesion = d.lesionados     || [];
    otros  = d.otros          || [];
    extra  = d.extra          || [];
    banquillo = d.banquillo   || [];
    promoInfoEq = promInfo[dia]?.[eq] || {};
  }
  const _campoArr = (eq === '1ER EQUIPO') ? [] : (data[dia][eq]?.campo || []);
  const _numPorterosCampo = _campoArr.filter(n => porteros.includes(n)).length;
  const _numCampoNormal = _campoArr.length - _numPorterosCampo;
  const _contadorTxt = _numCampoNormal + (_numPorterosCampo>0 ? '+'+_numPorterosCampo : '');
  const cWrap = card.querySelector('.campo-wrap');
  if(!cWrap){ toast('❌ No se encontró el campo'); return; }
  // Ocultar escudo: html2canvas no soporta mix-blend-mode
  const shieldEl = cWrap.querySelector('.campo-shield');
  if(shieldEl) shieldEl.style.visibility = 'hidden';
  // Resaltar porteros en el campo con borde amarillo grueso temporal
  const _chipsPortero = [];
  const _chipsPorteroOriginal = [];
  cWrap.querySelectorAll('.chip[data-nombre]').forEach(chipEl => {
    const nombreChip = chipEl.dataset.nombre;
    if(porteros.includes(nombreChip)){
      _chipsPorteroOriginal.push({
        el: chipEl,
        border: chipEl.style.border,
        shadow: chipEl.style.boxShadow,
        padding: chipEl.style.padding
      });
      chipEl.style.border = '2.5px solid #facc15';
      chipEl.style.boxSizing = 'border-box';
      _chipsPortero.push(chipEl);
    }
  });
  html2canvas(cWrap, {
    scale: 3, useCORS: true, allowTaint: true,
    backgroundColor: '#1a6b2a', logging: false, imageTimeout: 0
  }).then(fieldCanvas=>{
    // Restaurar escudo y bordes de porteros en la UI
    if(shieldEl) shieldEl.style.visibility = '';
    _chipsPorteroOriginal.forEach(({el, border, shadow, padding}) => { el.style.border = border; el.style.boxShadow = shadow; el.style.padding = padding; });
    // Dimensiones del canvas — respeta la proporción real del campo capturado
    const W       = 800;
    const HEADER_H = 80;
    // Usar la proporción real del campo (fieldCanvas tiene scale:2)
    const FIELD_H  = Math.round(W * (fieldCanvas.height / fieldCanvas.width));
    const ROW_H    = 28;
    const maxRows  = Math.max(proms.length, lesion.length, otros.length, extra.length, banquillo.length, 1);
    const COL_H    = 30 + maxRows * ROW_H + 16;
    const bannerHpre = esPartidoHoy ? 42 : 0;
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
    // Contador de jugadores en campo (con porteros) — arriba derecha
    if(eq !== '1ER EQUIPO'){
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      ctx.font = '700 20px Segoe UI, -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(_contadorTxt, W - 16, HEADER_H/2 + 8);
      ctx.textAlign = 'left';
    }
    // Sin escudo en header (evitar fondo negro por transparencia)

    // Banner PARTIDO vs Rival + tipo, si aplica
    let bannerH = 0;
    if(esPartidoHoy){
      bannerH = 42;
      const rivalVal = rivales[dia]?.[eq] || 'Rival por confirmar';
      const tiposBase = (tiposConfig[eq] && tiposConfig[eq].length) ? tiposConfig[eq] : TIPOS_BASE;
      const tipoKey = tipoPartido[dia]?.[eq] || tiposBase[0]?.k || 'liga';
      const tipoObj = tiposBase.find(t=>t.k===tipoKey) || tiposBase[0] || {l:'Liga'};
      ctx.fillStyle = '#eff4fe';
      ctx.fillRect(0, HEADER_H, W, bannerH);
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(0, HEADER_H, W, 3);
      ctx.font = '700 16px Segoe UI, -apple-system, sans-serif';
      ctx.fillStyle = '#2563eb';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText('⚽ PARTIDO', 16, HEADER_H + bannerH/2);
      ctx.font = '600 15px Segoe UI, -apple-system, sans-serif';
      ctx.fillStyle = '#1e3a8a';
      ctx.fillText((tipoObj.l||'').toUpperCase() + '  vs ' + rivalVal, 160, HEADER_H + bannerH/2);
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
        // Línea de separación vertical entre columnas (excepto la primera)
        if(ci > 0){
          ctx.strokeStyle = '#dfe1e6';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx, colY);
          ctx.lineTo(cx, H - 10);
          ctx.stroke();
        }
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
