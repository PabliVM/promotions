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
  // Guardar sesión en Firebase
  window.fbGuardarSesion = async function(nombre, payload){
    try{
      const clean = JSON.parse(JSON.stringify(payload));
      await db.collection('sesiones').doc(nombre).set({
        ...clean,
        _nombre: nombre,
        _ts: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { ok:true };
    }catch(e){
      console.error('fbGuardarSesion error:', e);
      return { ok:false, reason:'error', error:e, message:fbErrorMsg(e) };
    }
  };
  // Cargar sesión desde Firebase
  window.fbCargarSesion = async function(nombre){
    try{
      const snap = await db.collection('sesiones').doc(nombre).get();
      if(!snap.exists){
        return { ok:false, reason:'not_found', message:'La sesión no existe en Firebase.' };
      }
      return { ok:true, data:snap.data() };
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
}
