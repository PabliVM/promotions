// ================================================
// CAMPOGRAMA-FIREBASE-INIT.JS — Init Firebase compat 9.23.0
// Expone: window._db, window._fbReady, window.fbGuardarSesion,
//         window.fbCargarSesion, window.fbListarSesiones, window.fbEliminarSesion
// ================================================

function _fbStub(mensaje){
  return async function(){ return { ok:false, reason:'firebase_no_disponible', message: mensaje }; };
}

try {
  if (typeof firebase === 'undefined') {
    throw new Error('Las librerías de Firebase (gstatic.com) no llegaron a cargar en el navegador.');
  }

  const firebaseConfig = {
    apiKey: "AIzaSyCvoSR0sAyXkQ96HdaO4G5sF8kBn0go-Ig",
    authDomain: "promotions-532a7.firebaseapp.com",
    projectId: "promotions-532a7",
    storageBucket: "promotions-532a7.firebasestorage.app",
    messagingSenderId: "365543412948",
    appId: "1:365543412948:web:19afe2a748305fd2f71741"
  };
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  // Safari (y algunas redes/navegadores restrictivos) fallan con el canal de conexión
  // en tiempo real por defecto de Firestore ("access control checks" en el WebChannel).
  // Esto detecta el problema y usa long-polling en su lugar, mucho más compatible.
  db.settings({ experimentalAutoDetectLongPolling: true, merge: true });
  const auth = firebase.auth();
  window._db = db;
  window._auth = auth;
  window._fbReady = false; // se activa tras login correcto

  // ── LOGIN ──
  window.fbLogin = async function(email, password){
    try{
      await auth.signInWithEmailAndPassword(email, password);
      return { ok:true };
    }catch(e){
      console.error('fbLogin error:', e);
      let msg = 'Email o contraseña incorrectos.';
      if(e.code === 'auth/too-many-requests') msg = 'Demasiados intentos. Espera unos minutos.';
      return { ok:false, message: msg };
    }
  };
  window.fbLogout = function(){
    return auth.signOut();
  };

  // Escuchar cambios de sesión
  auth.onAuthStateChanged(user => {
    if(user){
      window._fbReady = true;
      window._fbUser = user;
      window.dispatchEvent(new Event('firebase-ready'));
      document.dispatchEvent(new Event('auth-ready'));
    } else {
      window._fbReady = false;
      window._fbUser = null;
      document.dispatchEvent(new Event('auth-logout'));
    }
  });
  function fbErrorMsg(e){
    if(!e) return 'Error desconocido';
    return e.message || String(e);
  }
  // ── Días CON fecha real para guardar en Firebase ──
  // Por dentro, la app usa siempre "LUNES"/"MARTES"... (sin tocar nada de eso). Pero al
  // guardar en Firebase, las claves de día pasan a incluir la fecha real (ej.
  // "2026-07-21_MARTES"), para que se pueda identificar la semana con solo mirar
  // Firestore. Al cargar, se revierte automáticamente — invisible para el resto del código.
  const _CAMPOS_POR_DIA = ['data','promInfo','historicoJugador','modoPartido','modoDescanso','tipoPartido','primerEquipoJugadores'];
  function _mapaDiaConFecha(fechas){
    const anio = new Date().getFullYear();
    const mapa = {};
    Object.keys(fechas||{}).forEach(dia=>{
      const partes = String(fechas[dia]||'').split('/');
      if(partes.length===2){
        const dd = partes[0].padStart(2,'0');
        const mm = partes[1].padStart(2,'0');
        mapa[dia] = anio+'-'+mm+'-'+dd+'_'+dia;
      } else {
        mapa[dia] = dia; // sin fecha disponible: usar el nombre tal cual
      }
    });
    return mapa;
  }
  // Aplica el sellado de fecha (día->clave con fecha) a un objeto "tipo snapshot de
  // semana" (data/promInfo/historicoJugador/... + pos), usando el mapa de fechas dado.
  // Reutilizable tanto para la semana activa como para cada semana archivada.
  function _sellarSnapshot(obj, mapa){
    const out = { ...obj };
    _CAMPOS_POR_DIA.forEach(campo=>{
      if(!out[campo] || typeof out[campo] !== 'object') return;
      const nuevo = {};
      Object.keys(out[campo]).forEach(dia=>{
        nuevo[mapa[dia] || dia] = out[campo][dia];
      });
      out[campo] = nuevo;
    });
    if(out.pos && typeof out.pos === 'object'){
      const nuevoPos = {};
      Object.keys(out.pos).forEach(k=>{
        const partes = k.split('|');
        if(partes.length===3 && mapa[partes[0]]){
          nuevoPos[mapa[partes[0]]+'|'+partes[1]+'|'+partes[2]] = out.pos[k];
        } else {
          nuevoPos[k] = out.pos[k];
        }
      });
      out.pos = nuevoPos;
    }
    return out;
  }
  function _aplicarFechaAClaves(payload){
    if(!payload.fechas) return payload;
    const mapa = _mapaDiaConFecha(payload.fechas);
    let out = _sellarSnapshot(payload, mapa);
    // Semanas archivadas: cada una tiene sus propias fechas reales (distintas de la
    // semana activa) — se calculan a partir de su propia clave (el lunes de esa semana)
    // usando fechaCompletaDeDia(), y se sella cada una con SU mapa correspondiente.
    if(out.semanasGuardadas && typeof out.semanasGuardadas === 'object' && typeof fechaCompletaDeDia === 'function'){
      const nuevasSemanas = {};
      Object.keys(out.semanasGuardadas).forEach(weekKey=>{
        const mapaSemana = {};
        DIAS.forEach(dia=>{ mapaSemana[dia] = fechaCompletaDeDia(dia, weekKey)+'_'+dia; });
        nuevasSemanas[weekKey] = _sellarSnapshot(out.semanasGuardadas[weekKey], mapaSemana);
      });
      out.semanasGuardadas = nuevasSemanas;
    }
    return out;
  }
  function _desellarSnapshot(obj){
    const out = { ...obj };
    _CAMPOS_POR_DIA.forEach(campo=>{
      if(!out[campo] || typeof out[campo] !== 'object') return;
      const nuevo = {};
      Object.keys(out[campo]).forEach(k=>{
        const idx = k.indexOf('_');
        const diaLimpio = (idx>=0 && /^\d{4}-\d{2}-\d{2}$/.test(k.slice(0,idx))) ? k.slice(idx+1) : k;
        nuevo[diaLimpio] = out[campo][k];
      });
      out[campo] = nuevo;
    });
    if(out.pos && typeof out.pos === 'object'){
      const nuevoPos = {};
      Object.keys(out.pos).forEach(k=>{
        const partes = k.split('|');
        if(partes.length===3){
          const idx = partes[0].indexOf('_');
          const diaLimpio = (idx>=0 && /^\d{4}-\d{2}-\d{2}$/.test(partes[0].slice(0,idx))) ? partes[0].slice(idx+1) : partes[0];
          nuevoPos[diaLimpio+'|'+partes[1]+'|'+partes[2]] = out.pos[k];
        } else {
          nuevoPos[k] = out.pos[k];
        }
      });
      out.pos = nuevoPos;
    }
    return out;
  }
  function _quitarFechaDeClaves(raw){
    let out = _desellarSnapshot(raw);
    if(out.semanasGuardadas && typeof out.semanasGuardadas === 'object'){
      const nuevasSemanas = {};
      Object.keys(out.semanasGuardadas).forEach(weekKey=>{
        nuevasSemanas[weekKey] = _desellarSnapshot(out.semanasGuardadas[weekKey]);
      });
      out.semanasGuardadas = nuevasSemanas;
    }
    return out;
  }
  // Guardar sesión en Firebase
  window.fbGuardarSesion = async function(nombre, payload){
    try{
      const clean = _aplicarFechaAClaves(JSON.parse(JSON.stringify(payload)));
      await db.collection('sesiones').doc(nombre).set({
        ...clean,
        _nombre: nombre,
        _ts: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return { ok:true };
    }catch(e){
      console.error('fbGuardarSesion error:', e);
      return { ok:false, reason:'error', error:e, message:fbErrorMsg(e) };
    }
  };
  // Cargar sesión desde Firebase
  // Puede haber quedado un residuo del guardado dividido por equipo (data_por_eq /
  // prominfo_por_eq) de una versión anterior que luego se revirtió. Si existe y tiene
  // contenido, hay que RECONSTRUIR 'data'/'promInfo' a partir de ahí — es la copia real
  // y más reciente de los datos; el campo plano 'data' puede haber quedado vacío/desfasado.
  function _reconstruirDesdePorEq(raw){
    const out = { ...raw };
    if(raw.data_por_eq && typeof raw.data_por_eq === 'object' && Object.keys(raw.data_por_eq).length){
      out.data = raw.data_por_eq;
      delete out.data_por_eq;
    }
    if(raw.prominfo_por_eq && typeof raw.prominfo_por_eq === 'object' && Object.keys(raw.prominfo_por_eq).length){
      out.promInfo = raw.prominfo_por_eq;
      delete out.prominfo_por_eq;
    }
    return _quitarFechaDeClaves(out);
  }
  window.fbCargarSesion = async function(nombre){
    try{
      const snap = await db.collection('sesiones').doc(nombre).get();
      if(!snap.exists){
        return { ok:false, reason:'not_found', message:'La sesión no existe en Firebase.' };
      }
      // Diagnóstico de solo lectura: lista todos los campos guardados, para poder ver
      // a simple vista si hay algo residual/sin usar. No borra ni cambia nada.
      console.log('[diag-campos] Campos guardados en el documento:', Object.keys(snap.data()));
      return { ok:true, data: _reconstruirDesdePorEq(snap.data()) };
    }catch(e){
      console.error('fbCargarSesion error:', e);
      return { ok:false, reason:'error', error:e, message:fbErrorMsg(e) };
    }
  };
  // Listar sesiones guardadas
  window.fbListarSesiones = async function(){
    try{
      const snap = await db.collection('sesiones').get();
      return { ok:true, data:snap.docs.map(d=>({id:d.id, ...d.data()})) };
    }catch(e){
      console.error('fbListarSesiones error:', e);
      return { ok:false, reason:'error', error:e, message:fbErrorMsg(e), data:[] };
    }
  };
  // Eliminar sesión
  window.fbEliminarSesion = async function(nombre){
    try{
      await db.collection('sesiones').doc(nombre).delete();
      return { ok:true };
    }catch(e){
      console.error('fbEliminarSesion error:', e);
      return { ok:false, reason:'error', error:e, message:fbErrorMsg(e) };
    }
  };
  // Lectura rápida SOLO para comparar cuántos jugadores hay ahora mismo en el servidor,
  // justo antes de guardar — así se detecta si OTRA pestaña/dispositivo tiene datos más
  // completos que los que esta pestaña está a punto de guardar (y evitar pisarlos).
  window.fbContarJugadoresServidor = async function(){
    try{
      const snap = await db.collection('sesiones').doc('principal').get();
      if(!snap.exists) return { ok:true, total: 0 };
      const plantillasSrv = snap.data().plantillas || {};
      const total = Object.values(plantillasSrv).reduce((acc,arr)=>acc+(Array.isArray(arr)?arr.length:0), 0);
      return { ok:true, total };
    }catch(e){
      console.error('fbContarJugadoresServidor error:', e);
      return { ok:false, reason:'error', error:e, message:fbErrorMsg(e) };
    }
  };
  // Copia de seguridad DIARIA automática — independiente del guardado normal, en una
  // colección aparte ('backups'). Si algo rompe la sesión principal, aquí queda un
  // punto de recuperación de cada día. Se sobreescribe si se llama varias veces el
  // mismo día (no crece sin límite), pero los días anteriores NUNCA se tocan.
  window.fbGuardarBackupDiario = async function(payload){
    try{
      const hoy = new Date().toISOString().slice(0,10); // 'YYYY-MM-DD'
      const clean = _aplicarFechaAClaves(JSON.parse(JSON.stringify(payload)));
      await db.collection('backups').doc(hoy).set({
        ...clean,
        _fecha: hoy,
        _ts: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { ok:true };
    }catch(e){
      console.error('fbGuardarBackupDiario error:', e);
      return { ok:false, reason:'error', error:e, message:fbErrorMsg(e) };
    }
  };
  // Copia de seguridad justo ANTES de una acción destructiva (Borrar todo, Borrar
  // definitivo de un jugador). Se guardan las últimas 5 en rotación (pre_accion_0..4),
  // así siempre hay un paso atrás disponible sin esperar al backup diario.
  window.fbGuardarBackupPreAccion = async function(payload, etiqueta){
    try{
      const clean = _aplicarFechaAClaves(JSON.parse(JSON.stringify(payload)));
      let contador = 0;
      try{ contador = parseInt(localStorage.getItem('rm_backup_pre_accion_contador')||'0', 10) || 0; }catch(e){}
      const slot = 'pre_accion_' + (contador % 5);
      try{ localStorage.setItem('rm_backup_pre_accion_contador', String(contador+1)); }catch(e){}
      await db.collection('backups').doc(slot).set({
        ...clean,
        _etiqueta: etiqueta || '',
        _fechaHora: new Date().toISOString(),
        _ts: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { ok:true };
    }catch(e){
      console.error('fbGuardarBackupPreAccion error:', e);
      return { ok:false, reason:'error', error:e, message:fbErrorMsg(e) };
    }
  };
  // Listar backups disponibles (para poder restaurar uno concreto si hace falta)
  window.fbListarBackups = async function(){
    try{
      const snap = await db.collection('backups').orderBy('_fecha','desc').limit(30).get();
      return { ok:true, data: snap.docs.map(d=>d.id) };
    }catch(e){
      console.error('fbListarBackups error:', e);
      return { ok:false, reason:'error', error:e, message:fbErrorMsg(e), data:[] };
    }
  };
  // ── Temporadas: guardar/cargar la lista completa (nombre, activa, payload de cada una) ──
  window.fbGuardarTemporadas = async function(temporadasArr, temporadaActualId){
    try{
      const clean = JSON.parse(JSON.stringify(temporadasArr));
      await db.collection('config').doc('temporadas').set({
        temporadas: clean,
        temporadaActual: temporadaActualId,
        _ts: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { ok:true };
    }catch(e){
      console.error('fbGuardarTemporadas error:', e);
      return { ok:false, reason:'error', error:e, message:fbErrorMsg(e) };
    }
  };
  window.fbCargarTemporadas = async function(){
    try{
      const snap = await db.collection('config').doc('temporadas').get();
      if(!snap.exists) return { ok:true, temporadas: [], temporadaActual: null };
      const d = snap.data();
      return { ok:true, temporadas: d.temporadas||[], temporadaActual: d.temporadaActual||null };
    }catch(e){
      console.error('fbCargarTemporadas error:', e);
      return { ok:false, reason:'error', error:e, message:fbErrorMsg(e), temporadas:[], temporadaActual:null };
    }
  };
  // Cargar un backup concreto por fecha ('YYYY-MM-DD')
  window.fbCargarBackup = async function(fecha){
    try{
      const snap = await db.collection('backups').doc(fecha).get();
      if(!snap.exists) return { ok:false, reason:'not_found', message:'No hay backup de ese día.' };
      return { ok:true, data: _quitarFechaDeClaves(snap.data()) };
    }catch(e){
      console.error('fbCargarBackup error:', e);
      return { ok:false, reason:'error', error:e, message:fbErrorMsg(e) };
    }
  };
  // Escuchar cambios EN VIVO de una sesión (de otros dispositivos/pestañas).
  // callback(data) se llama cada vez que hay un cambio confirmado en el servidor
  // que NO viene de una escritura pendiente nuestra (evita reaccionar a nuestro propio guardado).
  window.fbEscucharSesion = function(nombre, callback){
    return db.collection('sesiones').doc(nombre)
      .onSnapshot({ includeMetadataChanges: true }, (snap) => {
        if(!snap.exists) return;
        if(snap.metadata.hasPendingWrites) return; // es nuestra propia escritura local, ignorar
        callback(_reconstruirDesdePorEq(snap.data()));
      }, (err) => {
        console.error('fbEscucharSesion error:', err);
      });
  };
  // Marcar/desmarcar portero de forma ATÓMICA — no depende del guardado general (buildPayload),
  // así nunca se pisa aunque otra persona esté guardando algo distinto en ese mismo instante.
  window.fbTogglePortero = async function(nombre, marcar){
    try{
      const ref = db.collection('sesiones').doc('principal');
      const cambio = marcar
        ? firebase.firestore.FieldValue.arrayUnion(nombre)
        : firebase.firestore.FieldValue.arrayRemove(nombre);
      await ref.set({ porteros: cambio }, { merge: true });
      return { ok:true };
    }catch(e){
      console.error('fbTogglePortero error:', e);
      return { ok:false, reason:'error', error:e, message:fbErrorMsg(e) };
    }
  };
  // Sobrescribe la lista de porteros entera (para "Borrar todo" u otras operaciones masivas)
  window.fbSetPorterosCompleto = async function(arr){
    try{
      await db.collection('sesiones').doc('principal').set({ porteros: arr }, { merge: true });
      return { ok:true };
    }catch(e){
      console.error('fbSetPorterosCompleto error:', e);
      return { ok:false, reason:'error', error:e, message:fbErrorMsg(e) };
    }
  };
  // (firebase-ready ahora se dispara desde onAuthStateChanged tras login)

} catch (errorInicial) {
  // ── Firebase no se pudo inicializar (librerías bloqueadas, red, config, etc.) ──
  // Nunca dejamos las funciones sin definir: así el resto de la app no revienta
  // con "window.fbLogin is not a function", y el usuario ve un mensaje claro.
  console.error('[Firebase] No se pudo inicializar:', errorInicial);
  const MSG = 'No se pudo conectar con el servidor (Firebase). Revisa tu conexión o si algún bloqueador de anuncios/privacidad está impidiendo cargar gstatic.com, y recarga la página.';
  window._fbReady = false;
  window.fbLogin = async function(){ return { ok:false, message: MSG }; };
  window.fbLogout = _fbStub(MSG);
  window.fbGuardarSesion = _fbStub(MSG);
  window.fbCargarSesion = _fbStub(MSG);
  window.fbListarSesiones = _fbStub(MSG);
  window.fbEliminarSesion = _fbStub(MSG);
  window.fbContarJugadoresServidor = _fbStub(MSG);
  window.fbGuardarBackupDiario = _fbStub(MSG);
  window.fbGuardarBackupPreAccion = _fbStub(MSG);
  window.fbListarBackups = _fbStub(MSG);
  window.fbGuardarTemporadas = _fbStub(MSG);
  window.fbCargarTemporadas = async function(){ return { ok:false, temporadas:[], temporadaActual:null, message:MSG }; };
  window.fbCargarBackup = _fbStub(MSG);
  window.fbEscucharSesion = function(){ return function(){}; }; // no-op: devuelve un "cancelar" vacío
  window.fbTogglePortero = _fbStub(MSG);
  window.fbSetPorterosCompleto = _fbStub(MSG);
}
