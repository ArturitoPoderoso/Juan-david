/**
 * ============================================================================
 * SOL DEL NORTE - VISTA SALÓN & MESERA (CUS-01-01)
 * Plano interactivo de mesas, toma de comandas, buscador y validación de stock
 * ============================================================================
 */

import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import { orderService } from '../services/OrderService.js';
import { catalogService } from '../services/CatalogService.js';
import { EVENTS, CHANNELS, ORDER_STATUS, TABLE_ZONES } from '../core/Constants.js';

export class SalonView {
  constructor() {
    this.currentChannel = CHANNELS.DINE_IN;
    this.selectedTable = 'Mesa 1';
    this.cart = [];
    this.currentCategory = 'Todos';
    this.searchQuery = '';
    this.currentZoneFilter = 'ALL';
  }

  mount() {
    this.initDOMElements();
    this.attachEventListeners();
    this.render();

    // Reaccionar a eventos del sistema
    eventBus.on(EVENTS.CATALOG_AVAILABILITY_CHANGED, (data) => {
      this.handleStockChanged(data);
    });

    eventBus.on(EVENTS.ORDER_CREATED, () => {
      this.renderTablesMap();
      this.renderActiveWaitressOrders();
    });

    eventBus.on(EVENTS.ORDER_STATUS_UPDATED, () => {
      this.renderTablesMap();
      this.renderActiveWaitressOrders();
    });

    eventBus.on(EVENTS.PAYMENT_PROCESSED, () => {
      this.renderTablesMap();
      this.renderActiveWaitressOrders();
    });
  }

  initDOMElements() {
    this.btnSalon = document.getElementById('btnChannelSalon');
    this.btnTakeout = document.getElementById('btnChannelTakeout');
    this.tablesContainer = document.getElementById('tablesContainer');
    this.tablesGrid = document.getElementById('tablesGrid');
    this.zoneFilters = document.getElementById('tableZoneFilters');
    this.menuSearch = document.getElementById('menuSearchInput');
    this.menuGrid = document.getElementById('menuGrid');
    this.orderItemsList = document.getElementById('orderItemsList');
    this.orderTotalVal = document.getElementById('orderTotalVal');
    this.btnConfirmOrder = document.getElementById('btnConfirmOrder');
    this.currentDestBadge = document.getElementById('currentDestBadge');
    this.waitressActiveOrdersList = document.getElementById('waitressActiveOrdersList');
  }

  attachEventListeners() {
    // Canales
    if (this.btnSalon && this.btnTakeout) {
      this.btnSalon.addEventListener('click', () => {
        this.currentChannel = CHANNELS.DINE_IN;
        this.btnSalon.classList.add('active');
        this.btnTakeout.classList.remove('active');
        this.tablesContainer.style.display = 'block';
        this.selectedTable = 'Mesa 1';
        this.updateHeaderBadge();
        this.renderTablesMap();
      });

      this.btnTakeout.addEventListener('click', () => {
        this.currentChannel = CHANNELS.TAKEOUT;
        this.btnTakeout.classList.add('active');
        this.btnSalon.classList.remove('active');
        this.tablesContainer.style.display = 'none';
        this.selectedTable = `Recojo #${String(store.getState().counters.takeoutSeq).padStart(2, '0')}`;
        this.updateHeaderBadge();
      });
    }

    // Filtros de zona de mesas
    if (this.zoneFilters) {
      this.zoneFilters.querySelectorAll('.zone-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.zoneFilters.querySelectorAll('.zone-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.currentZoneFilter = btn.dataset.zone;
          this.renderTablesMap();
        });
      });
    }

    // Filtro de categorías del menú
    document.querySelectorAll('.cat-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.currentCategory = pill.dataset.cat;
        this.renderMenuGrid();
      });
    });

    // Búsqueda en vivo de platos
    if (this.menuSearch) {
      this.menuSearch.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderMenuGrid();
      });
    }

    // Confirmación de comanda
    if (this.btnConfirmOrder) {
      this.btnConfirmOrder.addEventListener('click', () => this.handleConfirmOrder());
    }
  }

  render() {
    this.updateHeaderBadge();
    this.renderTablesMap();
    this.renderMenuGrid();
    this.renderCart();
    this.renderActiveWaitressOrders();
  }

  updateHeaderBadge() {
    if (this.currentDestBadge) {
      this.currentDestBadge.textContent = `${this.currentChannel}: ${this.selectedTable}`;
    }
  }

  renderTablesMap() {
    if (!this.tablesGrid) return;
    this.tablesGrid.innerHTML = '';

    const tables = store.getState().tables;
    const orders = store.getState().orders;

    const filteredTables = this.currentZoneFilter === 'ALL'
      ? tables
      : tables.filter(t => t.zone === this.currentZoneFilter);

    filteredTables.forEach(table => {
      // Analizar estado de la mesa
      const tableOrders = orders.filter(
        o => o.targetNumber === table.number && o.status !== ORDER_STATUS.PAID
      );

      const isOccupied = tableOrders.length > 0;
      const isSelected = this.selectedTable === table.number && this.currentChannel === CHANNELS.DINE_IN;
      const hasReadyDish = tableOrders.some(o => o.status === ORDER_STATUS.READY);

      const tableEl = document.createElement('div');
      tableEl.className = `table-tile ${isSelected ? 'selected' : ''} ${isOccupied ? 'occupied' : ''} ${hasReadyDish ? 'has-ready' : ''}`;

      const totalSpent = tableOrders.reduce((acc, o) => acc + o.total, 0);

      tableEl.innerHTML = `
        <div class="table-tile-header">
          <span class="table-number">${table.number}</span>
          <span class="table-zone-tag">${TABLE_ZONES[table.zone]?.split(' ')[0] || ''}</span>
        </div>
        <div class="table-tile-body">
          ${isOccupied 
            ? `<div class="table-spent">S/ ${totalSpent.toFixed(2)}</div>
               <div class="table-time">${tableOrders.length} orden(es)</div>`
            : `<div class="table-free">Disponible</div>`
          }
        </div>
        ${hasReadyDish ? `<div class="table-ready-bell">🔔 ¡Plato listo!</div>` : ''}
      `;

      tableEl.addEventListener('click', () => {
        this.selectedTable = table.number;
        this.updateHeaderBadge();
        this.renderTablesMap();
      });

      this.tablesGrid.appendChild(tableEl);
    });
  }

  renderMenuGrid() {
    if (!this.menuGrid) return;
    this.menuGrid.innerHTML = '';

    const dishes = catalogService.search(this.searchQuery, this.currentCategory);

    if (dishes.length === 0) {
      this.menuGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 2rem; text-align: center; color: var(--color-text-subtle);">
          No se encontraron platos activos que coincidan con la búsqueda.
        </div>
      `;
      return;
    }

    dishes.forEach(dish => {
      const card = document.createElement('div');
      card.className = `dish-item-card ${!dish.isAvailable ? 'out-of-stock' : ''}`;

      card.innerHTML = `
        <div class="dish-item-info">
          <div class="dish-title-row">
            <h4 class="dish-name">${dish.name}</h4>
            <span class="dish-price">S/ ${dish.price.toFixed(2)}</span>
          </div>
          <p class="dish-desc">${dish.desc}</p>
        </div>
        <div class="dish-action-row">
          <span class="station-pill ${dish.station.toLowerCase()}">${dish.station}</span>
          ${dish.isAvailable 
            ? `<button type="button" class="btn-add-dish">+ Agregar</button>`
            : `<span class="badge-out">Agotado en cocina</span>`
          }
        </div>
      `;

      if (dish.isAvailable) {
        card.querySelector('.btn-add-dish').addEventListener('click', () => {
          this.addToCart(dish);
        });
      }

      this.menuGrid.appendChild(card);
    });
  }

  addToCart(dish) {
    // Validar frescura de stock
    const fresh = catalogService.getById(dish.id);
    if (!fresh || !fresh.isAvailable) {
      eventBus.emit(EVENTS.TOAST_TRIGGERED, {
        message: `El plato "${dish.name}" acaba de agotarse en cocina.`,
        type: 'warning'
      });
      this.renderMenuGrid();
      return;
    }

    const item = this.cart.find(it => it.id === dish.id && it.note === '');
    if (item) {
      item.quantity += 1;
    } else {
      this.cart.push({
        id: dish.id,
        name: dish.name,
        station: dish.station,
        price: dish.price,
        quantity: 1,
        note: ''
      });
    }
    this.renderCart();
  }

  renderCart() {
    if (!this.orderItemsList) return;

    if (this.cart.length === 0) {
      this.orderItemsList.innerHTML = `
        <div class="empty-order-hint">
          Seleccione platos del catálogo a la izquierda para armar la comanda.
        </div>
      `;
      this.orderTotalVal.textContent = 'S/ 0.00';
      this.btnConfirmOrder.disabled = true;
      return;
    }

    this.orderItemsList.innerHTML = '';
    let total = 0;

    this.cart.forEach((item, index) => {
      const itemSubtotal = item.price * item.quantity;
      total += itemSubtotal;

      const row = document.createElement('div');
      row.className = 'cart-item-row';
      row.innerHTML = `
        <div class="cart-item-header">
          <div>
            <strong class="cart-item-name">${item.name}</strong>
            <div class="cart-item-unit">S/ ${item.price.toFixed(2)} c/u</div>
          </div>
          <div class="qty-pill-controls">
            <button type="button" class="qty-btn btn-minus">-</button>
            <span class="qty-value">${item.quantity}</span>
            <button type="button" class="qty-btn btn-plus">+</button>
          </div>
        </div>
        <input type="text" class="cart-note-input" placeholder="Nota opcional (ej. sin culantro, ají aparte)" value="${this.escapeHtml(item.note)}">
      `;

      row.querySelector('.btn-minus').addEventListener('click', () => {
        if (item.quantity > 1) {
          item.quantity -= 1;
        } else {
          this.cart.splice(index, 1);
        }
        this.renderCart();
      });

      row.querySelector('.btn-plus').addEventListener('click', () => {
        item.quantity += 1;
        this.renderCart();
      });

      row.querySelector('.cart-note-input').addEventListener('input', (e) => {
        item.note = e.target.value;
      });

      this.orderItemsList.appendChild(row);
    });

    this.orderTotalVal.textContent = `S/ ${total.toFixed(2)}`;
    this.btnConfirmOrder.disabled = false;
  }

  handleConfirmOrder() {
    if (this.cart.length === 0) return;

    try {
      const created = orderService.createOrder({
        channel: this.currentChannel,
        targetNumber: this.selectedTable,
        items: this.cart
      });

      eventBus.emit(EVENTS.TOAST_TRIGGERED, {
        message: `Comanda ${created.id} enviada a Cocina (${created.targetNumber}).`,
        type: 'success'
      });

      this.cart = [];
      this.renderCart();

      if (this.currentChannel === CHANNELS.TAKEOUT) {
        this.selectedTable = orderService.generateNextTakeoutNumber();
        this.updateHeaderBadge();
      }

      this.renderTablesMap();
      this.renderActiveWaitressOrders();
    } catch (err) {
      eventBus.emit(EVENTS.TOAST_TRIGGERED, {
        message: err.message,
        type: 'warning'
      });
      this.renderMenuGrid();
    }
  }

  renderActiveWaitressOrders() {
    if (!this.waitressActiveOrdersList) return;
    const active = orderService.getActiveOrders();

    if (active.length === 0) {
      this.waitressActiveOrdersList.innerHTML = `
        <div style="font-size:0.75rem; color:var(--color-text-subtle);">No hay comandas en curso.</div>
      `;
      return;
    }

    this.waitressActiveOrdersList.innerHTML = '';
    active.slice(-8).reverse().forEach(ord => {
      const item = document.createElement('div');
      item.className = 'waiter-order-tracker';

      let statusBadge = 'status-pending';
      if (ord.status === ORDER_STATUS.IN_PREPARATION) statusBadge = 'status-prep';
      if (ord.status === ORDER_STATUS.READY) statusBadge = 'status-ready blink';

      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>${ord.id} • ${ord.targetNumber}</strong>
          <span class="status-tracker-badge ${statusBadge}">${ord.status}</span>
        </div>
        <div style="font-size:0.72rem; color:var(--color-text-muted); margin-top:2px;">
          ${ord.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
        </div>
      `;

      this.waitressActiveOrdersList.appendChild(item);
    });
  }

  handleStockChanged(data) {
    this.renderMenuGrid();
    if (!data.isAvailable) {
      // Si el plato estaba en el carrito, alertar
      const inCart = this.cart.find(it => it.id === data.dishId);
      if (inCart) {
        eventBus.emit(EVENTS.TOAST_TRIGGERED, {
          message: `Atención: "${data.dishName}" fue marcado como AGOTADO mientras armaba la comanda.`,
          type: 'warning'
        });
      }
    }
  }

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
