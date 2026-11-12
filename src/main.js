/**
 * ============================================================================
 * SOL DEL NORTE - PUNTO DE ENTRADA PRINCIPAL (MAIN BOOTSTRAPPER)
 * Arquitectura modular ES Modules con inyección de vistas y bus de eventos
 * ============================================================================
 */

import { eventBus } from './core/EventBus.js';
import { store } from './core/Store.js';
import { EVENTS, ORDER_STATUS } from './core/Constants.js';
import { SalonView } from './views/SalonView.js';
import { KitchenView } from './views/KitchenView.js';
import { CashierView } from './views/CashierView.js';
import { AdminView } from './views/AdminView.js';

class App {
  constructor() {
    this.salonView = new SalonView();
    this.kitchenView = new KitchenView();
    this.cashierView = new CashierView();
    this.adminView = new AdminView();
  }

  init() {
    this.initClock();
    this.initRoleNavigation();
    this.initToastListener();
    this.initHeaderCounters();

    // Montar vistas
    this.salonView.mount();
    this.kitchenView.mount();
    this.cashierView.mount();
    this.adminView.mount();

    // Actualizar contadores iniciales
    this.updateCounters();

    // Reaccionar a cambios globales
    eventBus.on(EVENTS.ORDER_CREATED, () => this.updateCounters());
    eventBus.on(EVENTS.ORDER_STATUS_UPDATED, () => this.updateCounters());
    eventBus.on(EVENTS.PAYMENT_PROCESSED, () => this.updateCounters());

    console.info('Sol del Norte: Sistema gastronómico inicializado exitosamente.');
  }

  initClock() {
    const clockEl = document.getElementById('liveClock');
    const update = () => {
      const d = new Date();
      if (clockEl) {
        clockEl.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    };
    setInterval(update, 1000);
    update();
  }

  initRoleNavigation() {
    const tabs = document.querySelectorAll('.role-tab');
    const panels = document.querySelectorAll('.view-panel');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetRole = tab.dataset.role;

        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const targetPanel = document.getElementById(`panel-${targetRole}`);
        if (targetPanel) {
          targetPanel.classList.add('active');
        }

        // Renderizado fresco al entrar a cada vista
        if (targetRole === 'waitress') this.salonView.render();
        if (targetRole === 'kitchen') this.kitchenView.render();
        if (targetRole === 'cashier') this.cashierView.render();
        if (targetRole === 'admin') this.adminView.render();
      });
    });
  }

  initToastListener() {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    eventBus.on(EVENTS.TOAST_TRIGGERED, ({ message, type = 'normal' }) => {
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.innerHTML = `<span>${message}</span>`;

      container.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        setTimeout(() => toast.remove(), 250);
      }, 4200);
    });
  }

  initHeaderCounters() {
    this.kitchenBadge = document.getElementById('kitchenBadgeCounter');
  }

  updateCounters() {
    const orders = store.getState().orders;
    const pendingKitchen = orders.filter(
      o => o.status === ORDER_STATUS.PENDING || o.status === ORDER_STATUS.IN_PREPARATION
    ).length;

    if (this.kitchenBadge) {
      this.kitchenBadge.textContent = pendingKitchen;
      this.kitchenBadge.style.display = pendingKitchen > 0 ? 'inline-block' : 'none';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
