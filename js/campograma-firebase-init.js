// ================================================
// CAMPOGRAMA-FIREBASE-INIT.JS — Init Firebase compat 9.23.0
// Expone: window._db, window._fbReady, window.fbGuardarSesion,
//         window.fbCargarSesion, window.fbListarSesiones, window.fbEliminarSesion
// ================================================

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
