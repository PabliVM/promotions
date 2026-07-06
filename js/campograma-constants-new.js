// ================================================
// CAMPOGRAMA-CONSTANTS.JS — Constantes estáticas
// Cargar ANTES de campograma-state.js y campograma-logic.js
// ================================================

const RAW = {"LUNES": {"CASTILLA": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "RMC": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "JUVENIL A": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "JUVENIL B": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "JUVENIL C": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "CADETE A": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": [], "banquillo": []}}, "MARTES": {"CASTILLA": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "RMC": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "JUVENIL A": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "JUVENIL B": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "JUVENIL C": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "CADETE A": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": [], "banquillo": []}}, "MIÉRCOLES": {"CASTILLA": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "RMC": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "JUVENIL A": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "JUVENIL B": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "JUVENIL C": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "CADETE A": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": [], "banquillo": []}}, "JUEVES": {"CASTILLA": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "RMC": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "JUVENIL A": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "JUVENIL B": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "JUVENIL C": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "CADETE A": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": [], "banquillo": []}}, "VIERNES": {"CASTILLA": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "RMC": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "JUVENIL A": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "JUVENIL B": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "JUVENIL C": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "CADETE A": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": [], "banquillo": []}}, "SÁBADO": {"CASTILLA": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "RMC": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "JUVENIL A": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "JUVENIL B": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "JUVENIL C": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "CADETE A": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": [], "banquillo": []}}, "DOMINGO": {"CASTILLA": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "RMC": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "JUVENIL A": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "JUVENIL B": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "JUVENIL C": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": []}, "CADETE A": {"campo": [], "disponibles": [], "promovidos_1er": [], "lesionados": [], "otros": [], "banquillo": []}}};

const DIAS    = ["LUNES","MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO","DOMINGO"];
const EQUIPOS = ["CASTILLA","RMC","JUVENIL A","JUVENIL B","JUVENIL C","CADETE A"];
const ZONAS   = ["campo","banquillo","disponibles","promovidos_1er","lesionados","otros","extra"];

const SNAP_SLOTS = [];
const FILAS  = [90, 76, 62, 49, 36, 22,  8];
const COLS   = [8, 22, 36, 50, 64, 78, 92];
FILAS.forEach(t => COLS.forEach(l => SNAP_SLOTS.push([t, l])));
const FILAS_EXT = [83, 69, 55, 42, 29, 15];
const COLS_EXT  = [15, 36, 50, 64, 85];
FILAS_EXT.forEach(t => COLS_EXT.forEach(l => SNAP_SLOTS.push([t, l])));
const ROMBO_PORTERO = [[84,50],[90,33],[90,67],[96,50]];
ROMBO_PORTERO.forEach(s=>SNAP_SLOTS.push(s));
const POS_DEF = SNAP_SLOTS;
const LINEAS_FORMACION = FILAS.map(t => [t, COLS]);

const AREA_Y = 82;

const TIPOS_BASE = [
  {k:'liga',    l:'🏆 Liga',         c:'#3b82f6'},
  {k:'amistoso',l:'🤝 Amistoso',     c:'#6b7280'},
  {k:'copa',    l:'🏅 Copa',         c:'#f59e0b'},
  {k:'torneo',  l:'🎯 Torneo',       c:'#8b5cf6'},
];

const JERARQUIA = ['CADETE A','JUVENIL C','JUVENIL B','JUVENIL A','RMC','CASTILLA'];
const EQUIPO_SUPERIOR = {
  'CADETE A':  'JUVENIL C',
  'JUVENIL C': 'JUVENIL B',
  'JUVENIL B': 'JUVENIL A',
  'JUVENIL A': 'RMC',
  'RMC':       'CASTILLA',
  'CASTILLA':  '1ER EQUIPO',
};

const EQ_DOT_COLORS = {
  'CASTILLA':'#1e3a8a','RMC':'#7c3aed','JUVENIL A':'#eab308',
  'JUVENIL B':'#16a34a','JUVENIL C':'#db2777','CADETE A':'#ea580c',
};

const LS_KEY     = 'rm_cantera_v2';
const LS_SEASONS = 'rm_cantera_seasons';
const LS_CUR     = 'rm_cantera_current';

function mk(tag,cls=''){const e=document.createElement(tag);if(cls)e.className=cls;return e;}
const ZONAS_ACTIVAS = ['campo','banquillo','disponibles','lesionados','otros','extra'];
const EQ_COLORS={
  'CASTILLA':'c-prestado-CASTILLA',
  'RMC':'c-prestado-RMC',
  'JUVENIL A':'c-prestado-JUVENIL_A',
  'JUVENIL B':'c-prestado-JUVENIL_B',
  'JUVENIL C':'c-prestado-JUVENIL_C',
  'CADETE A':'c-prestado-CADETE_A'
};
const _dispColapsado = new Set();
