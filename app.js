/**
 * ============================================================================
 * SOL DEL NORTE - SISTEMA DE GESTIÓN GASTRONÓMICA
 * Lógica de Negocio y Control de Estados
 * CUS-01-01: Registrar comanda (Mesera)
 * CUS-01-02: Actualizar catálogo (Cocinero)
 * CUS-01-03: Gestionar comandas en cocina FIFO (Cocinero KDS)
 * CUS-01-04: Gestionar pre-cuenta y cobro (Cajero)
 * CUS-01-05: Realizar cuadre de caja (Administrador)
 * ============================================================================
 */

// --- 1. ESTADO GLOBAL INICIAL Y PERSISTENCIA ---
const DEFAULT_MENU = [
  { id: 'PL-01', name: 'Ceviche Clásico del Día', category: 'Ceviches', price: 38.00, desc: 'Pesca fresca, cebolla morada, canchita, camote glaseado y choclo', isAvailable: true },
  { id: 'PL-02', name: 'Ceviche Mixto Norteño', category: 'Ceviches', price: 44.00, desc: 'Pescado, pulpo, calamar y langostinos en leche de tigre al ají limo', isAvailable: true },
  { id: 'PL-03', name: 'Tiradito al Ají Amarillo', category: 'Ceviches', price: 40.00, desc: 'Láminas de corvina en crema sedosa de ají amarillo y chalaquita', isAvailable: true },
  { id: 'PL-04', name: 'Arroz con Mariscos', category: 'Calientes', price: 45.00, desc: 'Mariscos salteados en aderezo norteño con punto de culantro y pisco', isAvailable: true },
  { id: 'PL-05', name: 'Chicharrón de Calamar', category: 'Calientes', price: 36.00, desc: 'Crocantes aros de calamar con yucas doradas y salsa tártara artesanal', isAvailable: true },
  { id: 'PL-06', name: 'Parihuela Especial', category: 'Calientes', price: 48.00, desc: 'Sopa concentrada marina con cangrejo, pescado y conchas negras', isAvailable: true },
  { id: 'PL-07', name: 'Causa de Pulpa de Cangrejo', category: 'Entradas', price: 32.00, desc: 'Masa de papa amarilla y ají con relleno abundante de cangrejo y palta', isAvailable: true },
  { id: 'PL-08', name: 'Leche de Tigre Clásica', category: 'Entradas', price: 22.00, desc: 'Copa concentrada con chicharrón de pota y canchita chulpi', isAvailable: true },
  { id: 'PL-09', name: 'Chicha Morada Natural (Jarra 1L)', category: 'Bebidas', price: 16.00, desc: 'Maíz morado hervido con piña, manzana, canela y clavo', isAvailable: true },
  { id: 'PL-10', name: 'Cerveza Cusqueña Trigo (620ml)', category: 'Bebidas', price: 14.00, desc: 'Bien helada para maridar cebiches y calientes', isAvailable: true }
];

class RestaurantStore {
  constructor() {
    this.loadState();
  }

  loadState() {
    const saved = localStorage.getItem('soldelnorte_state_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.menu = parsed.menu || DEFAULT_MENU;
        this.orders = parsed.orders || [];
        this.payments = parsed.payments || [];
        this.cashDrawer = parsed.cashDrawer || {
          initialCash: 200.00,
          expenses: [],
          isClosed: false,
          closedData: null
        };
        this.nextOrderId = parsed.nextOrderId || 101;
        this.nextTakeoutNum = parsed.nextTakeoutNum || 1;
        return;
      } catch (e) {
        console.error('Error cargando estado, restableciendo...', e);
      }
    }

    // Inicial si no existe
    this.menu = JSON.parse(JSON.stringify(DEFAULT_MENU));
    this.orders = [];
    this.payments = [];
    this.cashDrawer = {
      initialCash: 200.00,
      expenses: [
        { id: 'EXP-1', reason: 'Compra de hielo en bolsa (Urgencia)', amount: 15.00, time: '11:30' }
      ],
      isClosed: false,
      closedData: null
    };
    this.nextOrderId = 101;
    this.nextTakeoutNum = 1;
    this.saveState();
  }

  saveState() {
    const data = {
      menu: this.menu,
      orders: this.orders,
      payments: this.payments,
      cashDrawer: this.cashDrawer,
      nextOrderId: this.nextOrderId,
      nextTakeoutNum: this.nextTakeoutNum
    };
    localStorage.setItem('soldelnorte_state_v1', JSON.stringify(data));
  }

  // CUS-01-02: Actualizar disponibilidad de catálogo (< 5 seg / instantáneo)
  toggleDishStock(dishId) {
    const dish = this.menu.find(d => d.id === dishId);
    if (dish) {
      dish.isAvailable = !dish.isAvailable;
      this.saveState();
      return dish;
    }
    return null;
  }

  // CUS-01-01: Registrar comanda
  createOrder(channel, targetNumber, items) {
    // Validar que ningún plato esté agotado
    for (const item of items) {
      const liveDish = this.menu.find(d => d.id === item.id);
      if (!liveDish || !liveDish.isAvailable) {
        throw new Error(`El plato "${item.name}" acaba de marcarse como Agotado. Modifique la comanda.`);
      }
      if (item.quantity <= 0) {
        throw new Error('Todas las cantidades deben ser mayores a cero.');
      }
    }

    const orderCode = `COM-${this.nextOrderId++}`;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const newOrder = {
      id: orderCode,
      channel: channel, // 'Salón' o 'Para llevar'
      targetNumber: targetNumber, // ej: 'Mesa 4' o 'Recojo #03'
      items: items.map(it => ({
        id: it.id,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
        note: (it.note || '').trim()
      })),
      total: items.reduce((sum, it) => sum + (it.price * it.quantity), 0),
      createdAt: now.toISOString(),
      createdTimeStr: timeStr,
      status: 'Pendiente', // Pendiente -> En preparación -> Listo -> Cobrado
      prepStartTime: null,
      readyTime: null
    };

    this.orders.push(newOrder);
    this.saveState();
    return newOrder;
  }

  // CUS-01-03: Gestionar estados en cocina (FIFO)
  updateOrderStatus(orderId, nextStatus) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) throw new Error('Comanda no encontrada');

    // Regla de Negocio CUS-01-03: Bloquear salto directo de Pendiente a Listo
    if (order.status === 'Pendiente' && nextStatus === 'Listo') {
      throw new Error('Regla de Cocina: No se puede saltar directamente de "Pendiente" a "Listo". Debe pasar primero a "En preparación".');
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (nextStatus === 'En preparación') {
      order.status = 'En preparación';
      order.prepStartTime = timeStr;
    } else if (nextStatus === 'Listo') {
      order.status = 'Listo';
      order.readyTime = timeStr;
    }

    this.saveState();
    return order;
  }

  // CUS-01-04: Gestionar pre-cuenta y cobro
  getBillForTarget(targetNumber) {
    // Buscar comandas no cobradas de esta mesa / recojo
    const activeOrders = this.orders.filter(o => o.targetNumber === targetNumber && o.status !== 'Cobrado');
    if (activeOrders.length === 0) return null;

    // Consolidar ítems
    const consolidatedMap = new Map();
    let grandTotal = 0;

    activeOrders.forEach(ord => {
      ord.items.forEach(it => {
        const key = `${it.id}__${it.note || ''}`;
        if (!consolidatedMap.has(key)) {
          consolidatedMap.set(key, {
            id: it.id,
            name: it.name,
            price: it.price,
            quantity: 0,
            note: it.note,
            subtotal: 0
          });
        }
        const record = consolidatedMap.get(key);
        record.quantity += it.quantity;
        record.subtotal = record.quantity * record.price;
      });
    });

    const items = Array.from(consolidatedMap.values());
    grandTotal = items.reduce((sum, it) => sum + it.subtotal, 0);

    return {
      targetNumber,
      orderIds: activeOrders.map(o => o.id),
      items,
      grandTotal
    };
  }

  confirmPayment(targetNumber, paymentMethod, referenceCode = '', amountPaid = 0) {
    const bill = this.getBillForTarget(targetNumber);
    if (!bill) throw new Error('No hay comandas activas pendientes de cobro para esta mesa o recojo.');

    const now = new Date();
    const paymentRecord = {
      id: `PAG-${Date.now().toString().slice(-6)}`,
      targetNumber,
      orderIds: bill.orderIds,
      items: bill.items,
      total: bill.grandTotal,
      method: paymentMethod, // 'Efectivo', 'Yape', 'Plin'
      referenceCode: referenceCode.trim(),
      amountPaid: Number(amountPaid) || bill.grandTotal,
      change: Math.max(0, (Number(amountPaid) || bill.grandTotal) - bill.grandTotal),
      timestamp: now.toISOString(),
      timeStr: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Bloquear comandas para evitar doble cobro o modificaciones
    this.orders.forEach(o => {
      if (bill.orderIds.includes(o.id)) {
        o.status = 'Cobrado';
      }
    });

    this.payments.push(paymentRecord);
    this.saveState();
    return paymentRecord;
  }

  // CUS-01-05: Cuadre de caja y reportes
  getCashSummary() {
    let cashSales = 0;
    let yapeSales = 0;
    let plinSales = 0;

    this.payments.forEach(p => {
      if (p.method === 'Efectivo') cashSales += p.total;
      else if (p.method === 'Yape') yapeSales += p.total;
      else if (p.method === 'Plin') plinSales += p.total;
    });

    const totalSales = cashSales + yapeSales + plinSales;
    const totalExpenses = this.cashDrawer.expenses.reduce((sum, e) => sum + e.amount, 0);
    const expectedCash = (this.cashDrawer.initialCash + cashSales) - totalExpenses;

    return {
      initialCash: this.cashDrawer.initialCash,
      cashSales,
      yapeSales,
      plinSales,
      totalSales,
      totalExpenses,
      expectedCash,
      expensesList: this.cashDrawer.expenses
    };
  }

  addExpense(reason, amount) {
    if (!reason || amount <= 0) throw new Error('Ingrese un motivo y monto válido de gasto');
    const now = new Date();
    this.cashDrawer.expenses.push({
      id: `EXP-${Date.now().toString().slice(-4)}`,
      reason: reason.trim(),
      amount: Number(amount),
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    this.saveState();
  }

  updateInitialCash(newAmount) {
    if (newAmount < 0) throw new Error('El fondo inicial no puede ser negativo');
    this.cashDrawer.initialCash = Number(newAmount);
    this.saveState();
  }
}

// Instancia única compartida
const store = new RestaurantStore();

// --- 2. GESTIÓN DE LA INTERFAZ Y EVENTOS ---
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initRoleTabs();
  initWaitressView();
  initKitchenView();
  initCashierView();
  initAdminView();
});

// Reloj en tiempo real
function initClock() {
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

// Navegación de Roles
function initRoleTabs() {
  const tabs = document.querySelectorAll('.role-tab');
  const panels = document.querySelectorAll('.view-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetRole = tab.dataset.role;

      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const targetPanel = document.getElementById(`panel-${targetRole}`);
      if (targetPanel) targetPanel.classList.add('active');

      // Refrescar la vista específica al entrar
      if (targetRole === 'waitress') renderWaitressView();
      if (targetRole === 'kitchen') renderKitchenView();
      if (targetRole === 'cashier') renderCashierView();
      if (targetRole === 'admin') renderAdminView();
    });
  });
}

// Utilidad de Toasts limpios
function showToast(message, type = 'normal') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 200);
  }, 4000);
}

// ============================================================================
// 3. MÓDULO SALÓN / MESERA (CUS-01-01)
// ============================================================================
let currentChannel = 'Salón';
let currentTargetNumber = 'Mesa 1';
let currentCart = []; // [{ id, name, price, quantity, note }]
let currentCategoryFilter = 'Todos';

function initWaitressView() {
  // Canales
  const btnSalon = document.getElementById('btnChannelSalon');
  const btnTakeout = document.getElementById('btnChannelTakeout');
  const tablesContainer = document.getElementById('tablesContainer');

  btnSalon.addEventListener('click', () => {
    currentChannel = 'Salón';
    btnSalon.classList.add('active');
    btnTakeout.classList.remove('active');
    tablesContainer.style.display = 'block';
    currentTargetNumber = 'Mesa 1';
    renderTablesGrid();
    updateOrderTargetBadge();
  });

  btnTakeout.addEventListener('click', () => {
    currentChannel = 'Para llevar';
    btnTakeout.classList.add('active');
    btnSalon.classList.remove('active');
    tablesContainer.style.display = 'none';
    currentTargetNumber = `Recojo #${String(store.nextTakeoutNum).padStart(2, '0')}`;
    updateOrderTargetBadge();
  });

  // Filtro de categorías
  const catPills = document.querySelectorAll('.cat-pill');
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategoryFilter = pill.dataset.cat;
      renderMenuGrid();
    });
  });

  // Botón Confirmar Comanda
  const btnConfirm = document.getElementById('btnConfirmOrder');
  btnConfirm.addEventListener('click', handleConfirmOrder);

  renderWaitressView();
}

function renderWaitressView() {
  renderTablesGrid();
  renderMenuGrid();
  renderCart();
  updateOrderTargetBadge();
  renderActiveWaitressOrders();
}

function updateOrderTargetBadge() {
  const badge = document.getElementById('currentDestBadge');
  if (badge) {
    badge.textContent = `${currentChannel}: ${currentTargetNumber}`;
  }
}

function renderTablesGrid() {
  const grid = document.getElementById('tablesGrid');
  if (!grid) return;
  grid.innerHTML = '';

  for (let i = 1; i <= 12; i++) {
    const tableNum = `Mesa ${i}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'table-btn';
    if (currentTargetNumber === tableNum && currentChannel === 'Salón') {
      btn.classList.add('selected');
    }

    // Verificar si tiene comandas abiertas
    const hasActiveOrders = store.orders.some(o => o.targetNumber === tableNum && o.status !== 'Cobrado');
    if (hasActiveOrders) {
      btn.classList.add('occupied');
    }

    btn.innerHTML = `
      <span>Mesa ${i}</span>
      <span class="table-status-indicator">${hasActiveOrders ? 'Ocupada' : 'Libre'}</span>
    `;

    btn.addEventListener('click', () => {
      currentTargetNumber = tableNum;
      renderTablesGrid();
      updateOrderTargetBadge();
    });

    grid.appendChild(btn);
  }
}

function renderMenuGrid() {
  const grid = document.getElementById('menuGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const filtered = currentCategoryFilter === 'Todos'
    ? store.menu
    : store.menu.filter(m => m.category === currentCategoryFilter);

  filtered.forEach(dish => {
    const card = document.createElement('div');
    card.className = `menu-card ${!dish.isAvailable ? 'out-of-stock' : ''}`;

    card.innerHTML = `
      <div>
        <div class="card-title-row">
          <span class="menu-item-name">${dish.name}</span>
          <span class="menu-item-price">S/ ${dish.price.toFixed(2)}</span>
        </div>
        <div class="menu-item-desc">${dish.desc}</div>
      </div>
      <div class="card-action-row">
        ${!dish.isAvailable
          ? '<span class="out-badge">Agotado en cocina</span>'
          : '<button type="button" class="btn-add-item">+ Agregar</button>'
        }
      </div>
    `;

    if (dish.isAvailable) {
      const addBtn = card.querySelector('.btn-add-item');
      addBtn.addEventListener('click', () => {
        addItemToCart(dish);
      });
    }

    grid.appendChild(card);
  });
}

function addItemToCart(dish) {
  // Doble verificación de stock (CUS-01-01 Excepción)
  const freshDish = store.menu.find(d => d.id === dish.id);
  if (!freshDish || !freshDish.isAvailable) {
    showToast(`El plato "${dish.name}" está marcado como Agotado en cocina.`, 'warning');
    renderMenuGrid();
    return;
  }

  const existing = currentCart.find(it => it.id === dish.id && !it.note);
  if (existing) {
    existing.quantity += 1;
  } else {
    currentCart.push({
      id: dish.id,
      name: dish.name,
      price: dish.price,
      quantity: 1,
      note: ''
    });
  }
  renderCart();
}

function renderCart() {
  const container = document.getElementById('orderItemsList');
  const totalValEl = document.getElementById('orderTotalVal');
  const confirmBtn = document.getElementById('btnConfirmOrder');
  if (!container) return;

  if (currentCart.length === 0) {
    container.innerHTML = `<div class="empty-order-hint">Seleccione platos del catálogo a la izquierda para armar la comanda.</div>`;
    totalValEl.textContent = 'S/ 0.00';
    confirmBtn.disabled = true;
    return;
  }

  container.innerHTML = '';
  let grandTotal = 0;

  currentCart.forEach((item, index) => {
    const itemSubtotal = item.price * item.quantity;
    grandTotal += itemSubtotal;

    const row = document.createElement('div');
    row.className = 'order-item-row';
    row.innerHTML = `
      <div class="item-main-line">
        <div>
          <strong style="font-size: 0.85rem;">${item.name}</strong>
          <div style="font-size: 0.75rem; color: var(--color-text-muted);">S/ ${item.price.toFixed(2)} c/u</div>
        </div>
        <div class="item-qty-controls">
          <button type="button" class="qty-btn btn-minus">-</button>
          <span style="font-weight: 700; font-size: 0.85rem; min-width: 18px; text-align: center;">${item.quantity}</span>
          <button type="button" class="qty-btn btn-plus">+</button>
        </div>
      </div>
      <input type="text" class="item-note-input" placeholder="Nota opcional: ej. sin picante, ají aparte..." value="${escapeHtml(item.note || '')}">
    `;

    // Eventos
    const btnMinus = row.querySelector('.btn-minus');
    const btnPlus = row.querySelector('.btn-plus');
    const noteInput = row.querySelector('.item-note-input');

    btnMinus.addEventListener('click', () => {
      if (item.quantity > 1) {
        item.quantity -= 1;
      } else {
        currentCart.splice(index, 1);
      }
      renderCart();
    });

    btnPlus.addEventListener('click', () => {
      item.quantity += 1;
      renderCart();
    });

    noteInput.addEventListener('input', (e) => {
      item.note = e.target.value;
    });

    container.appendChild(row);
  });

  totalValEl.textContent = `S/ ${grandTotal.toFixed(2)}`;
  confirmBtn.disabled = false;
}

function handleConfirmOrder() {
  if (currentCart.length === 0) return;

  try {
    const created = store.createOrder(currentChannel, currentTargetNumber, currentCart);
    showToast(`Comanda ${created.id} confirmada para ${created.targetNumber} enviada a Cocina.`, 'success');

    // Limpiar carrito
    currentCart = [];
    renderCart();

    // Si era para llevar, avanzar número de recojo
    if (currentChannel === 'Para llevar') {
      store.nextTakeoutNum++;
      currentTargetNumber = `Recojo #${String(store.nextTakeoutNum).padStart(2, '0')}`;
      updateOrderTargetBadge();
    }

    renderWaitressView();
    updateHeaderCounters();
  } catch (err) {
    showToast(err.message, 'warning');
    renderMenuGrid();
  }
}

function renderActiveWaitressOrders() {
  const container = document.getElementById('waitressActiveOrdersList');
  if (!container) return;

  const active = store.orders.filter(o => o.status !== 'Cobrado');
  if (active.length === 0) {
    container.innerHTML = '<div style="font-size:0.8rem; color:var(--color-text-subtle);">No hay comandas pendientes de entrega.</div>';
    return;
  }

  container.innerHTML = '';
  active.slice(-6).reverse().forEach(ord => {
    const item = document.createElement('div');
    item.style.padding = '0.45rem 0';
    item.style.borderBottom = '1px dashed var(--color-border-subtle)';
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    item.style.fontSize = '0.8rem';

    let statusStyle = 'background: #FEF9C3; color:#854D0E;';
    if (ord.status === 'En preparación') statusStyle = 'background:#E0F2FE; color:#0369A1;';
    if (ord.status === 'Listo') statusStyle = 'background:#DCFCE7; color:#15803D; font-weight:700;';

    item.innerHTML = `
      <div>
        <strong>${ord.id}</strong> — <span>${ord.targetNumber}</span>
        <div style="font-size: 0.72rem; color: var(--color-text-muted);">${ord.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</div>
      </div>
      <span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; ${statusStyle}">${ord.status}</span>
    `;
    container.appendChild(item);
  });
}

// ============================================================================
// 4. MÓDULO COCINA (KDS FIFO) & CATÁLOGO (CUS-01-02 & CUS-01-03)
// ============================================================================
let kitchenActiveTab = 'queue'; // 'queue' o 'catalog'

function initKitchenView() {
  const btnTabQueue = document.getElementById('btnKitchenQueueTab');
  const btnTabCatalog = document.getElementById('btnKitchenCatalogTab');
  const panelQueue = document.getElementById('kitchenQueueView');
  const panelCatalog = document.getElementById('kitchenCatalogView');

  btnTabQueue.addEventListener('click', () => {
    kitchenActiveTab = 'queue';
    btnTabQueue.classList.add('active');
    btnTabCatalog.classList.remove('active');
    panelQueue.style.display = 'block';
    panelCatalog.style.display = 'none';
    renderKitchenView();
  });

  btnTabCatalog.addEventListener('click', () => {
    kitchenActiveTab = 'catalog';
    btnTabCatalog.classList.add('active');
    btnTabQueue.classList.remove('active');
    panelQueue.style.display = 'none';
    panelCatalog.style.display = 'block';
    renderKitchenView();
  });

  // Temporizador para refrescar cronómetro visual cada 30 segundos
  setInterval(() => {
    if (kitchenActiveTab === 'queue') {
      renderKitchenQueue();
    }
  }, 30000);
}

function renderKitchenView() {
  if (kitchenActiveTab === 'queue') {
    renderKitchenQueue();
  } else {
    renderKitchenCatalog();
  }
}

function renderKitchenQueue() {
  const grid = document.getElementById('kdsQueueGrid');
  if (!grid) return;
  grid.innerHTML = '';

  // Orden estrictamente cronológico (FIFO): las más antiguas primero
  const kitchenOrders = store.orders
    .filter(o => o.status === 'Pendiente' || o.status === 'En preparación' || o.status === 'Listo')
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  if (kitchenOrders.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 3rem; text-align: center; color: var(--color-text-subtle);">
        <p style="font-size: 1.1rem; font-weight: 600; color: var(--color-marine-navy);">Cola de Cocina Limpia</p>
        <p style="font-size: 0.85rem; margin-top: 4px;">No hay comandas pendientes en este momento.</p>
      </div>
    `;
    return;
  }

  const now = new Date();

  kitchenOrders.forEach(order => {
    const createdDate = new Date(order.createdAt);
    const elapsedMinutes = Math.floor((now - createdDate) / 60000);

    const ticket = document.createElement('div');
    const statusClass = order.status === 'Pendiente' ? 'status-pending' : (order.status === 'En preparación' ? 'status-in_prep' : 'status-ready');
    ticket.className = `kds-ticket ${statusClass}`;

    let statusBadgeText = order.status;
    let badgeColor = 'background: #FEF9C3; color: #854D0E;';
    if (order.status === 'En preparación') badgeColor = 'background: #E0F2FE; color: #0369A1;';
    if (order.status === 'Listo') badgeColor = 'background: #DCFCE7; color: #15803D;';

    const itemsHtml = order.items.map(it => `
      <div class="ticket-item">
        <span class="ticket-item-qty">${it.quantity}x</span>
        <span class="ticket-item-name">${it.name}</span>
        ${it.note ? `<div class="ticket-item-note">Nota: ${escapeHtml(it.note)}</div>` : ''}
      </div>
    `).join('');

    ticket.innerHTML = `
      <div>
        <div class="ticket-header">
          <div>
            <div class="ticket-id">${order.id}</div>
            <div class="ticket-channel">${order.channel} • <strong>${order.targetNumber}</strong></div>
          </div>
          <div class="ticket-timer ${elapsedMinutes >= 15 ? 'urgent' : ''}">
            ⏱ ${elapsedMinutes} min (${order.createdTimeStr})
          </div>
        </div>
        <div class="ticket-items">
          ${itemsHtml}
        </div>
      </div>

      <div class="ticket-footer">
        <span class="ticket-status-pill" style="${badgeColor}">${statusBadgeText}</span>
        <div class="ticket-actions">
          ${order.status === 'Pendiente' ? `
            <button type="button" class="btn-kds-action prep" data-action="prep">Empezar Prep.</button>
            <button type="button" class="btn-kds-action ready" data-action="ready_direct" title="Intento de salto directo">Listo</button>
          ` : ''}
          ${order.status === 'En preparación' ? `
            <button type="button" class="btn-kds-action ready" data-action="ready">Terminar y Notificar</button>
          ` : ''}
          ${order.status === 'Listo' ? `
            <span style="font-size: 0.75rem; color: #15803D; font-weight: 600;">✓ Esperando servicio</span>
          ` : ''}
        </div>
      </div>
    `;

    // Eventos de botones con validación estricta CUS-01-03
    const btnPrep = ticket.querySelector('[data-action="prep"]');
    const btnReadyDirect = ticket.querySelector('[data-action="ready_direct"]');
    const btnReady = ticket.querySelector('[data-action="ready"]');

    if (btnPrep) {
      btnPrep.addEventListener('click', () => {
        store.updateOrderStatus(order.id, 'En preparación');
        renderKitchenQueue();
        updateHeaderCounters();
      });
    }

    if (btnReadyDirect) {
      btnReadyDirect.addEventListener('click', () => {
        // Intentar pasar directo: el sistema debe bloquearlo según la excepción CUS-01-03
        try {
          store.updateOrderStatus(order.id, 'Listo');
        } catch (err) {
          showToast(`Bloqueo de cocina: ${err.message}`, 'warning');
        }
      });
    }

    if (btnReady) {
      btnReady.addEventListener('click', () => {
        store.updateOrderStatus(order.id, 'Listo');
        showToast(`¡Comanda ${order.id} (${order.targetNumber}) marcada como LISTA para servir!`, 'success');
        renderKitchenQueue();
        updateHeaderCounters();
      });
    }

    grid.appendChild(ticket);
  });
}

function renderKitchenCatalog() {
  const tbody = document.getElementById('kitchenCatalogTbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  store.menu.forEach(dish => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${dish.name}</strong><br><small style="color:var(--color-text-muted);">${dish.desc}</small></td>
      <td>${dish.category}</td>
      <td style="font-weight: 700;">S/ ${dish.price.toFixed(2)}</td>
      <td>
        <button type="button" class="stock-toggle-btn ${dish.isAvailable ? 'active' : 'out'}">
          ${dish.isAvailable ? '✓ Disponible' : '✕ Agotado'}
        </button>
      </td>
    `;

    const toggleBtn = tr.querySelector('.stock-toggle-btn');
    toggleBtn.addEventListener('click', () => {
      const updated = store.toggleDishStock(dish.id);
      showToast(
        updated.isAvailable 
          ? `"${updated.name}" ahora está DISPONIBLE en salón.` 
          : `"${updated.name}" marcado como AGOTADO. Bloqueado en salón inmediatamente.`,
        updated.isAvailable ? 'success' : 'warning'
      );
      renderKitchenCatalog();
      // Refrescar salón si la mesera está activa
      renderMenuGrid();
    });

    tbody.appendChild(tr);
  });
}

// ============================================================================
// 5. MÓDULO CAJA / PRE-CUENTA Y COBRO (CUS-01-04)
// ============================================================================
let selectedBillingTarget = null;
let selectedPaymentMethod = 'Efectivo'; // 'Efectivo', 'Yape', 'Plin'

function initCashierView() {
  // Métodos de pago
  const methodCards = document.querySelectorAll('.payment-method-card');
  const yapePlinRow = document.getElementById('yapePlinReferenceRow');
  const cashGivenRow = document.getElementById('cashGivenRow');

  methodCards.forEach(card => {
    card.addEventListener('click', () => {
      methodCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedPaymentMethod = card.dataset.method;

      if (selectedPaymentMethod === 'Efectivo') {
        yapePlinRow.style.display = 'none';
        cashGivenRow.style.display = 'block';
      } else {
        yapePlinRow.style.display = 'block';
        cashGivenRow.style.display = 'none';
      }
    });
  });

  // Cálculo dinámico de vuelto en efectivo
  const cashInput = document.getElementById('inputCashGiven');
  const changeValEl = document.getElementById('cashChangeValue');
  cashInput.addEventListener('input', () => {
    if (!selectedBillingTarget) return;
    const bill = store.getBillForTarget(selectedBillingTarget);
    if (!bill) return;

    const given = parseFloat(cashInput.value) || 0;
    const change = Math.max(0, given - bill.grandTotal);
    changeValEl.textContent = `S/ ${change.toFixed(2)}`;
  });

  // Botón Confirmar Cobro
  const btnConfirmPay = document.getElementById('btnConfirmPayment');
  btnConfirmPay.addEventListener('click', handleConfirmPayment);

  // Botón Imprimir Pre-cuenta
  const btnPrint = document.getElementById('btnPrintPreaccount');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      if (!selectedBillingTarget) return;
      window.print();
    });
  }

  renderCashierView();
}

function renderCashierView() {
  renderPendingBillsList();
  renderSelectedBillDetail();
}

function renderPendingBillsList() {
  const container = document.getElementById('pendingBillsList');
  if (!container) return;
  container.innerHTML = '';

  // Agrupar mesas y recojos no cobrados
  const targets = new Set();
  store.orders
    .filter(o => o.status !== 'Cobrado')
    .forEach(o => targets.add(o.targetNumber));

  if (targets.size === 0) {
    container.innerHTML = '<div style="font-size:0.85rem; color:var(--color-text-subtle); padding: 1rem 0;">No hay cuentas pendientes por cobrar.</div>';
    selectedBillingTarget = null;
    renderSelectedBillDetail();
    return;
  }

  // Si no hay seleccionado o el seleccionado ya no existe, tomar el primero
  if (!selectedBillingTarget || !targets.has(selectedBillingTarget)) {
    selectedBillingTarget = Array.from(targets)[0];
  }

  targets.forEach(target => {
    const bill = store.getBillForTarget(target);
    if (!bill) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `bill-item-btn ${selectedBillingTarget === target ? 'selected' : ''}`;

    btn.innerHTML = `
      <div class="bill-item-title">
        <span>${target}</span>
        <span style="color: var(--color-marine-navy);">S/ ${bill.grandTotal.toFixed(2)}</span>
      </div>
      <div class="bill-item-sub">
        ${bill.orderIds.join(', ')} • ${bill.items.reduce((acc, i) => acc + i.quantity, 0)} platos
      </div>
    `;

    btn.addEventListener('click', () => {
      selectedBillingTarget = target;
      renderPendingBillsList();
      renderSelectedBillDetail();
    });

    container.appendChild(btn);
  });
}

function renderSelectedBillDetail() {
  const detailPanel = document.getElementById('billingDetailPanel');
  const emptyPanel = document.getElementById('billingEmptyPanel');
  if (!detailPanel || !emptyPanel) return;

  if (!selectedBillingTarget) {
    detailPanel.style.display = 'none';
    emptyPanel.style.display = 'block';
    return;
  }

  const bill = store.getBillForTarget(selectedBillingTarget);
  if (!bill) {
    detailPanel.style.display = 'none';
    emptyPanel.style.display = 'block';
    return;
  }

  detailPanel.style.display = 'block';
  emptyPanel.style.display = 'none';

  // Llenar hoja de pre-cuenta
  document.getElementById('preaccountTargetTitle').textContent = bill.targetNumber;
  document.getElementById('preaccountOrdersCodes').textContent = bill.orderIds.join(' | ');

  const tbody = document.getElementById('preaccountTableBody');
  tbody.innerHTML = '';

  bill.items.forEach(it => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${it.quantity}</td>
      <td>${it.name}${it.note ? `<br><small style="color:#777;">(${it.note})</small>` : ''}</td>
      <td style="text-align: right;">${it.price.toFixed(2)}</td>
      <td style="text-align: right;">${it.subtotal.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('preaccountTotalVal').textContent = `S/ ${bill.grandTotal.toFixed(2)}`;
  document.getElementById('checkoutTotalToPay').textContent = `S/ ${bill.grandTotal.toFixed(2)}`;

  // Restablecer inputs
  document.getElementById('inputCashGiven').value = bill.grandTotal.toFixed(2);
  document.getElementById('cashChangeValue').textContent = 'S/ 0.00';
  document.getElementById('inputPaymentReference').value = '';

  // Actualizar ticket oculto de impresión
  renderPrintTicket(bill);
}

function handleConfirmPayment() {
  if (!selectedBillingTarget) return;

  const refCode = document.getElementById('inputPaymentReference').value;
  const cashGiven = parseFloat(document.getElementById('inputCashGiven').value) || 0;

  if ((selectedPaymentMethod === 'Yape' || selectedPaymentMethod === 'Plin') && !refCode.trim()) {
    showToast(`Para pagos con ${selectedPaymentMethod}, ingrese el número o referencia de validación.`, 'warning');
    return;
  }

  try {
    const payment = store.confirmPayment(selectedBillingTarget, selectedPaymentMethod, refCode, cashGiven);
    showToast(`Cobro registrado con éxito para ${payment.targetNumber} (S/ ${payment.total.toFixed(2)} vía ${payment.method}).`, 'success');
    
    selectedBillingTarget = null;
    renderCashierView();
    updateHeaderCounters();
  } catch (err) {
    showToast(err.message, 'warning');
  }
}

function renderPrintTicket(bill) {
  const container = document.getElementById('printOnlyTicket');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">
      <h2 style="margin: 0; font-size: 1.1rem;">CEVICHERÍA SOL DEL NORTE</h2>
      <p style="margin: 2px 0; font-size: 0.8rem;">RUC: 20601234567 • Huanchaco, Trujillo</p>
      <p style="margin: 2px 0; font-size: 0.8rem;"><strong>PRE-CUENTA DE CONSUMO</strong></p>
      <p style="margin: 2px 0; font-size: 0.8rem;">${bill.targetNumber} • ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
    </div>
    <table style="width: 100%; font-size: 0.8rem; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 1px dashed #000;">
          <th style="text-align: left;">Cant</th>
          <th style="text-align: left;">Descripción</th>
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${bill.items.map(i => `
          <tr>
            <td>${i.quantity}</td>
            <td>${i.name}</td>
            <td style="text-align: right;">S/ ${i.subtotal.toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div style="border-top: 1px dashed #000; margin-top: 8px; padding-top: 8px; text-align: right; font-size: 1rem; font-weight: bold;">
      TOTAL A PAGAR: S/ ${bill.grandTotal.toFixed(2)}
    </div>
    <div style="text-align: center; margin-top: 15px; font-size: 0.75rem;">
      ¡Muchas gracias por su preferencia!
    </div>
  `;
}

// ============================================================================
// 6. MÓDULO ADMINISTRACIÓN & CUADRE DE CAJA (CUS-01-05)
// ============================================================================
function initAdminView() {
  // Apertura / Fondo inicial
  const btnSaveInitialCash = document.getElementById('btnSaveInitialCash');
  const inputInitialCash = document.getElementById('inputInitialCash');

  btnSaveInitialCash.addEventListener('click', () => {
    const val = parseFloat(inputInitialCash.value);
    if (isNaN(val) || val < 0) {
      showToast('Ingrese un monto válido de fondo inicial', 'warning');
      return;
    }
    store.updateInitialCash(val);
    showToast(`Fondo inicial actualizado a S/ ${val.toFixed(2)}`, 'success');
    renderAdminView();
  });

  // Agregar Gasto/Salida
  const btnAddExpense = document.getElementById('btnAddExpense');
  const inputExpReason = document.getElementById('inputExpenseReason');
  const inputExpAmount = document.getElementById('inputExpenseAmount');

  btnAddExpense.addEventListener('click', () => {
    const reason = inputExpReason.value;
    const amount = parseFloat(inputExpAmount.value);
    try {
      store.addExpense(reason, amount);
      inputExpReason.value = '';
      inputExpAmount.value = '';
      showToast(`Salida de caja registrada: S/ ${amount.toFixed(2)}`, 'success');
      renderAdminView();
    } catch (err) {
      showToast(err.message, 'warning');
    }
  });

  // Ejecutar Cuadre de Caja
  const btnRunReconciliation = document.getElementById('btnRunReconciliation');
  const inputCountedCash = document.getElementById('inputCountedCash');

  btnRunReconciliation.addEventListener('click', () => {
    const counted = parseFloat(inputCountedCash.value);
    if (isNaN(counted) || counted < 0) {
      showToast('Ingrese el monto de efectivo físico contado en caja.', 'warning');
      return;
    }
    calculateCashReconciliation(counted);
  });

  renderAdminView();
}

function renderAdminView() {
  const summary = store.getCashSummary();

  // Inputs y valores
  document.getElementById('inputInitialCash').value = summary.initialCash.toFixed(2);
  document.getElementById('metricTotalSales').textContent = `S/ ${summary.totalSales.toFixed(2)}`;
  document.getElementById('metricCashSales').textContent = `S/ ${summary.cashSales.toFixed(2)}`;
  document.getElementById('metricDigitalSales').textContent = `S/ ${(summary.yapeSales + summary.plinSales).toFixed(2)}`;
  document.getElementById('metricExpenses').textContent = `S/ ${summary.totalExpenses.toFixed(2)}`;

  // Desglose de canales de pago
  document.getElementById('summarySalesCash').textContent = `S/ ${summary.cashSales.toFixed(2)}`;
  document.getElementById('summarySalesYape').textContent = `S/ ${summary.yapeSales.toFixed(2)}`;
  document.getElementById('summarySalesPlin').textContent = `S/ ${summary.plinSales.toFixed(2)}`;
  document.getElementById('summarySalesTotal').textContent = `S/ ${summary.totalSales.toFixed(2)}`;

  // Fórmula explicativa de efectivo esperado
  document.getElementById('formulaExpectedResult').textContent = `S/ ${summary.expectedCash.toFixed(2)}`;
  document.getElementById('formulaBreakdown').textContent = `(Fondo: S/ ${summary.initialCash.toFixed(2)} + Efectivo: S/ ${summary.cashSales.toFixed(2)}) - Salidas: S/ ${summary.totalExpenses.toFixed(2)}`;

  // Lista de salidas
  renderExpensesList(summary.expensesList);
}

function renderExpensesList(expenses) {
  const container = document.getElementById('adminExpensesList');
  if (!container) return;

  if (expenses.length === 0) {
    container.innerHTML = '<div style="font-size:0.75rem; color:var(--color-text-subtle); padding: 4px 0;">No se han registrado salidas de caja hoy.</div>';
    return;
  }

  container.innerHTML = '';
  expenses.forEach(exp => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.fontSize = '0.78rem';
    row.style.padding = '3px 0';
    row.style.borderBottom = '1px dashed var(--color-border-subtle)';

    row.innerHTML = `
      <span>${exp.time} • ${escapeHtml(exp.reason)}</span>
      <strong style="color: var(--color-terracotta);">- S/ ${exp.amount.toFixed(2)}</strong>
    `;
    container.appendChild(row);
  });
}

function calculateCashReconciliation(counted) {
  const summary = store.getCashSummary();
  const diff = counted - summary.expectedCash;

  const resultBox = document.getElementById('reconciliationResultBox');
  const titleEl = document.getElementById('reconciliationResultTitle');
  const amountEl = document.getElementById('reconciliationResultAmount');
  const detailEl = document.getElementById('reconciliationResultDetail');

  resultBox.style.display = 'block';
  resultBox.className = 'difference-result-box';

  if (Math.abs(diff) < 0.01) {
    resultBox.classList.add('balanced');
    titleEl.textContent = '✓ CUADRE DE CAJA EXACTO';
    amountEl.textContent = 'Diferencia: S/ 0.00';
    detailEl.textContent = 'El efectivo físico coincide al 100% con las ventas en efectivo esperadas.';
  } else if (diff < 0) {
    resultBox.classList.add('shortage');
    titleEl.textContent = '⚠ ALERTA: FALTANTE DE CAJA';
    amountEl.textContent = `- S/ ${Math.abs(diff).toFixed(2)}`;
    detailEl.textContent = `Se contaron S/ ${counted.toFixed(2)} en físico, pero el sistema esperaba S/ ${summary.expectedCash.toFixed(2)}. Faltan S/ ${Math.abs(diff).toFixed(2)}.`;
  } else {
    resultBox.classList.add('surplus');
    titleEl.textContent = 'ℹ AVISO: SOBRANTE EN CAJA';
    amountEl.textContent = `+ S/ ${diff.toFixed(2)}`;
    detailEl.textContent = `Se contaron S/ ${counted.toFixed(2)} en físico, superando el esperado de S/ ${summary.expectedCash.toFixed(2)}.`;
  }
}

// Utilidades globales
function updateHeaderCounters() {
  const pendingCount = store.orders.filter(o => o.status === 'Pendiente' || o.status === 'En preparación').length;
  const badge = document.getElementById('kitchenBadgeCounter');
  if (badge) {
    badge.textContent = pendingCount;
    badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
