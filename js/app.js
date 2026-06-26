// ================================================
// APP.JS — Punto de entrada
// ================================================

import { initFirebase } from './firebase-service.js';
import { isFirebaseUnconfigured } from './firebase-config.js';
import { renderHeader } from './render-header.js';
import { renderTabs } from './render-tabs.js';
import { renderFooter } from './render-footer.js';
import { TABS } from './constants.js';
import { state } from './state.js';

// ── CONTENIDO DE CADA PANEL ──────────────────────

function renderPanelInicio(container) {
  container.innerHTML = `
    ${firebaseNotice()}
    <div class="card card-lg">
      <div class="card-title">Base preparada para nueva aplicación</div>
      <div class="card-body">
        <p>Este repositorio es la plantilla base de las apps internas de la Cantera del Real Madrid.</p>
        <p style="margin-top:10px;">Para crear una nueva app:</p>
        <ol style="margin:10px 0 0 18px;line-height:2;">
          <li>Haz clic en <strong>Use this template</strong> en GitHub.</li>
          <li>Cambia <code>APP_NAME</code> en <code>js/constants.js</code>.</li>
          <li>Añade las credenciales Firebase en <code>js/firebase-config.js</code>.</li>
          <li>Añade tus módulos en <code>js/</code> e impórtalos desde <code>app.js</code>.</li>
        </ol>
      </div>
    </div>
  `;
}

function renderPanelDashboard(container) {
  container.innerHTML = `
    ${firebaseNotice()}
    <div class="card">
      <div class="card-title">Dashboard</div>
      <div class="card-body">Espacio para métricas y resúmenes de la aplicación.</div>
    </div>
  `;
}

function renderPanelConfig(container) {
  container.innerHTML = `
    ${firebaseNotice()}
    <div class="card">
      <div class="card-title">Configuración</div>
      <div class="card-body">Opciones de configuración de la aplicación.</div>
    </div>
  `;
}

// ── AVISO FIREBASE ────────────────────────────────

function firebaseNotice() {
  if (!isFirebaseUnconfigured()) return '';
  return `
    <div class="firebase-notice mb-16">
      ⚠ Firebase pendiente de configurar — edita <code>js/firebase-config.js</code>
    </div>
  `;
}

// ── RENDERIZAR MAIN ───────────────────────────────

function renderMain() {
  const main = document.getElementById('rm-main');
  main.innerHTML = '';

  const renderers = {
    inicio:        renderPanelInicio,
    dashboard:     renderPanelDashboard,
    configuracion: renderPanelConfig,
  };

  TABS.forEach(tab => {
    const panel = document.createElement('div');
    panel.className = 'tab-panel' + (tab.key !== state.activeTab ? ' hidden' : '');
    panel.dataset.tab = tab.key;
    main.appendChild(panel);

    const render = renderers[tab.key];
    if (render) render(panel);
  });
}

// ── EVENTOS GLOBALES ─────────────────────────────

function setupEvents() {
  document.addEventListener('rm:tab-changed', e => {
    const tabKey = e.detail;
    const panel  = document.querySelector(`.tab-panel[data-tab="${tabKey}"]`);
    if (!panel) return;

    const renderers = {
      inicio:        renderPanelInicio,
      dashboard:     renderPanelDashboard,
      configuracion: renderPanelConfig,
    };
    const render = renderers[tabKey];
    if (render) render(panel);
  });
}

// ── BOOT ─────────────────────────────────────────

function boot() {
  // Intentar inicializar Firebase (no falla si hay placeholders)
  initFirebase();

  renderFooter();
  renderHeader();
  renderTabs();
  renderMain();
  setupEvents();
}

document.addEventListener('DOMContentLoaded', boot);

