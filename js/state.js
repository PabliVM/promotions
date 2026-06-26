// ================================================
// STATE.JS — Estado de UI en memoria
// Solo vive mientras la página está abierta.
// NO se guarda en localStorage ni en ningún otro
// almacenamiento local.
// ================================================

import { APP_NAME, DEFAULT_SEASONS } from './constants.js';

const _state = {
  appName:       APP_NAME,
  seasons:       [...DEFAULT_SEASONS],
  activeSeason:  '2026/2027',
  activeTab:     'inicio',
  darkMode:      false,
};

export const state = _state;

export function setState(patch) {
  Object.assign(_state, patch);
}
