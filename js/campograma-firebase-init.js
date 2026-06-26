// ================================================
// CAMPOGRAMA-FIREBASE-INIT.JS — Init Firebase compat 9.23.0
// Expone: window._db, window._fbReady, window.fbGuardarSesion,
//         window.fbCargarSesion, window.fbListarSesiones, window.fbEliminarSesion
// ================================================

const firebaseConfig = {
  apiKey: "AIzaSyA19qehf21kHWkKNN_jVjXQ1dpsuHN7hTE",
  authDomain: "promociones-c76fd.firebaseapp.com",
  projectId: "promociones-c76fd",
  storageBucket: "promociones-c76fd.firebasestorage.app",
  messagingSenderId: "518492143356",
  appId: "1:518492143356:web:d0c8b05c53cac8d55e6179",
  measurementId: "G-WFRD7XJMW3"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
window._db = db;
window._fbReady = true;
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
// Señalizar que Firebase está listo
window.dispatchEvent(new Event('firebase-ready'));
