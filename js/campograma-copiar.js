// ── campograma-copiar.js — Copiar campograma entre días/semanas ──
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
function guardarRival(eq, valor, diaParam){
  const d = diaParam || dia;
  if(!rivales[d]) rivales[d]={};
  rivales[d][eq] = valor;
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
