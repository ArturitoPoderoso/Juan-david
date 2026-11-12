/**
 * ============================================================================
 * SOL DEL NORTE - VISTA COCINA KDS (CUS-01-02 & CUS-01-03)
 * Cola FIFO estricta, filtros por estación y toggle de disponibilidad (< 5s)
 * ============================================================================
 */

import { eventBus } from '../core/EventBus.js';
import { kitchenService } from '../services/KitchenService.js';
import { catalogService } from '../services/CatalogService.js';
import { EVENTS, ORDER_STATUS } from '../core/Constants.js';

export class KitchenView {
  constructor() {
    this.currentSubtab = 'queue'; // 'queue' o 'catalog'
    this.currentStationFilter = 'ALL';
    this.timerInterval = null;
  }

  mount() {
    this.initDOMElements();
    this.attachEventListeners();
    this.render();

    // Eventos
    eventBus.on(EVENTS.ORDER_CREATED, () => {
      if (this.currentSubtab === 'queue') this.renderQueue();
    });

    eventBus.on(EVENTS.ORDER_STATUS_UPDATED, () => {
      if (this.currentSubtab === 'queue') this.renderQueue();
    });

    // Actualización de cronómetros cada 20 segundos
    this.timerInterval = setInterval(() => {
      if (this.currentSubtab === 'queue') this.renderQueue();
    }, 20000);
  }

  initDOMElements() {
    this.btnQueueTab = document.getElementById('btnKitchenQueueTab');
    this.btnCatalogTab = document.getElementById('btnKitchenCatalogTab');
    this.queueView = document.getElementById('kitchenQueueView');
    this.catalogView = document.getElementById('kitchenCatalogView');
    this.queueGrid = document.getElementById('kdsQueueGrid');
    this.catalogTbody = document.getElementById('kitchenCatalogTbody');
    this.stationFilterSelect = document.getElementById('kitchenStationFilter');
  }

  attachEventListeners() {
    if (this.btnQueueTab && this.btnCatalogTab) {
      this.btnQueueTab.addEventListener('click', () => {
        this.currentSubtab = 'queue';
        this.btnQueueTab.classList.add('active');
        this.btnCatalogTab.classList.remove('active');
        this.queueView.style.display = 'block';
        this.catalogView.style.display = 'none';
        this.render();
      });

      this.btnCatalogTab.addEventListener('click', () => {
        this.currentSubtab = 'catalog';
        this.btnCatalogTab.classList.add('active');
        this.btnQueueTab.classList.remove('active');
        this.queueView.style.display = 'none';
        this.catalogView.style.display = 'block';
        this.render();
      });
    }

    if (this.stationFilterSelect) {
      this.stationFilterSelect.addEventListener('change', (e) => {
        this.currentStationFilter = e.target.value;
        this.renderQueue();
      });
    }
  }

  render() {
    if (this.currentSubtab === 'queue') {
      this.renderQueue();
    } else {
      this.renderCatalog();
    }
  }

  renderQueue() {
    if (!this.queueGrid) return;
    this.queueGrid.innerHTML = '';

    const orders = kitchenService.getFifoQueue(this.currentStationFilter);

    if (orders.length === 0) {
      this.queueGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 4rem 1rem; text-align: center; color: var(--color-text-subtle);">
          <div style="font-size: 1.15rem; font-weight: 700; color: var(--color-marine-navy);">Cola de Cocina al Día</div>
          <p style="font-size: 0.85rem; margin-top: 4px;">No hay comandas pendientes de preparación en este momento.</p>
        </div>
      `;
      return;
    }

    const now = new Date();

    orders.forEach((order, index) => {
      const createdDate = new Date(order.createdAt);
      const elapsedMin = Math.floor((now - createdDate) / 60000);

      const ticket = document.createElement('div');
      let statusBorder = 'status-pending-border';
      if (order.status === ORDER_STATUS.IN_PREPARATION) statusBorder = 'status-prep-border';
      if (order.status === ORDER_STATUS.READY) statusBorder = 'status-ready-border';

      ticket.className = `kds-card ${statusBorder}`;

      ticket.innerHTML = `
        <div class="kds-card-header">
          <div>
            <div style="display:flex; align-items:center; gap: 6px;">
              <span class="kds-fifo-pos">#${index + 1}</span>
              <span class="kds-order-id">${order.id}</span>
            </div>
            <div class="kds-target-title">${order.channel} • <strong>${order.targetNumber}</strong></div>
          </div>
          <div class="kds-timer-pill ${elapsedMin >= 15 ? 'urgent' : ''}">
            ⏱ ${elapsedMin} min (${order.createdTimeStr})
          </div>
        </div>

        <div class="kds-card-items">
          ${order.items.map(it => `
            <div class="kds-item-row">
              <span class="kds-item-qty">${it.quantity}x</span>
              <span class="kds-item-name">${it.name}</span>
              <span class="kds-item-station-tag">${it.station}</span>
              ${it.note ? `<div class="kds-item-note">Nota: ${this.escapeHtml(it.note)}</div>` : ''}
            </div>
          `).join('')}
        </div>

        <div class="kds-card-footer">
          <span class="kds-status-pill ${order.status.toLowerCase().replace(/ /g, '-')}">
            ${order.status}
          </span>
          <div class="kds-actions-group">
            ${order.status === ORDER_STATUS.PENDING ? `
              <button type="button" class="btn-kds btn-prep" data-id="${order.id}">Iniciar Prep.</button>
              <button type="button" class="btn-kds btn-ready-attempt" data-id="${order.id}" title="Intento de salto directo">Listo</button>
            ` : ''}
            ${order.status === ORDER_STATUS.IN_PREPARATION ? `
              <button type="button" class="btn-kds btn-ready" data-id="${order.id}">✓ Terminar y Avisar</button>
            ` : ''}
            ${order.status === ORDER_STATUS.READY ? `
              <span style="font-size:0.75rem; color:#15803D; font-weight:700;">✓ Esperando mozo</span>
            ` : ''}
          </div>
        </div>
      `;

      // Eventos
      const btnPrep = ticket.querySelector('.btn-prep');
      const btnReadyAttempt = ticket.querySelector('.btn-ready-attempt');
      const btnReady = ticket.querySelector('.btn-ready');

      if (btnPrep) {
        btnPrep.addEventListener('click', () => {
          kitchenService.startPreparation(order.id);
          this.renderQueue();
        });
      }

      if (btnReadyAttempt) {
        btnReadyAttempt.addEventListener('click', () => {
          // Excepción CUS-01-03: Debe bloquear el salto directo
          try {
            kitchenService.markAsReady(order.id);
          } catch (err) {
            eventBus.emit(EVENTS.TOAST_TRIGGERED, {
              message: err.message,
              type: 'warning'
            });
          }
        });
      }

      if (btnReady) {
        btnReady.addEventListener('click', () => {
          kitchenService.markAsReady(order.id);
          eventBus.emit(EVENTS.TOAST_TRIGGERED, {
            message: `¡Comanda ${order.id} (${order.targetNumber}) lista para entrega!`,
            type: 'success'
          });
          this.renderQueue();
        });
      }

      this.queueGrid.appendChild(ticket);
    });
  }

  renderCatalog() {
    if (!this.catalogTbody) return;
    this.catalogTbody.innerHTML = '';

    const dishes = catalogService.getAll();

    dishes.forEach(dish => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <strong>${dish.name}</strong>
          <div style="font-size:0.72rem; color:var(--color-text-muted);">${dish.desc}</div>
        </td>
        <td><span class="station-pill ${dish.station.toLowerCase()}">${dish.station}</span></td>
        <td>${dish.category}</td>
        <td style="font-weight:700;">S/ ${dish.price.toFixed(2)}</td>
        <td>
          <button type="button" class="stock-toggle-btn ${dish.isAvailable ? 'active' : 'out'}">
            ${dish.isAvailable ? '✓ Disponible' : '✕ Agotado'}
          </button>
        </td>
      `;

      const toggleBtn = tr.querySelector('.stock-toggle-btn');
      toggleBtn.addEventListener('click', () => {
        const updated = catalogService.toggleStock(dish.id);
        eventBus.emit(EVENTS.TOAST_TRIGGERED, {
          message: updated.isAvailable 
            ? `"${updated.name}" habilitado en salón.` 
            : `"${updated.name}" marcado como AGOTADO. Bloqueado en salón de inmediato.`,
          type: updated.isAvailable ? 'success' : 'warning'
        });
        this.renderCatalog();
      });

      this.catalogTbody.appendChild(tr);
    });
  }

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
