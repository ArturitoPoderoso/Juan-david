/**
 * ============================================================================
 * SOL DEL NORTE - SERVICIO DE COMANDAS (CUS-01-01)
 * Creación estructurada, validaciones de disponibilidad y asignación
 * ============================================================================
 */

import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import { EVENTS, ORDER_STATUS, CHANNELS } from '../core/Constants.js';
import { sound } from '../core/AudioAlerts.js';

export class OrderService {
  getAll() {
    return store.getState().orders;
  }

  getActiveOrders() {
    return store.getState().orders.filter(o => o.status !== ORDER_STATUS.PAID);
  }

  getOrdersByTarget(targetNumber) {
    return store.getState().orders.filter(
      o => o.targetNumber === targetNumber && o.status !== ORDER_STATUS.PAID
    );
  }

  // CUS-01-01: Registrar comanda
  createOrder({ channel, targetNumber, items, waiterName = 'Mesera' }) {
    if (!items || items.length === 0) {
      throw new Error('La comanda debe contener al menos un plato.');
    }

    const state = store.getState();

    // 1. Validar que las cantidades sean mayores a cero
    // 2. Excepción CUS-01-01: Validar que ningún plato esté "Agotado"
    for (const item of items) {
      if (item.quantity <= 0) {
        throw new Error(`La cantidad para "${item.name}" debe ser mayor a cero.`);
      }

      const liveDish = state.menu.find(d => d.id === item.id);
      if (!liveDish) {
        throw new Error(`El plato "${item.name}" no existe en el catálogo.`);
      }
      if (!liveDish.isAvailable) {
        sound.playWarning();
        throw new Error(`El plato "${liveDish.name}" acaba de marcarse como AGOTADO en cocina. Por favor elimínelo de la comanda.`);
      }
    }

    // Generar código único correlativo
    const orderSeq = state.counters.orderSeq++;
    const orderId = `COM-${orderSeq}`;
    const now = new Date();

    const orderRecord = {
      id: orderId,
      channel: channel || CHANNELS.DINE_IN,
      targetNumber: targetNumber || 'Mesa 1',
      waiterName,
      items: items.map(it => ({
        id: it.id,
        name: it.name,
        station: it.station || 'HOT',
        price: Number(it.price),
        quantity: Number(it.quantity),
        note: (it.note || '').trim()
      })),
      total: items.reduce((sum, it) => sum + (Number(it.price) * Number(it.quantity)), 0),
      status: ORDER_STATUS.PENDING,
      createdAt: now.toISOString(),
      createdTimeStr: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      prepStartTime: null,
      readyTime: null
    };

    state.orders.push(orderRecord);
    store.save();

    // Notificar por sonido y evento a la cocina
    sound.playOrderSent();
    eventBus.emit(EVENTS.ORDER_CREATED, orderRecord);

    return orderRecord;
  }

  generateNextTakeoutNumber() {
    const state = store.getState();
    const num = state.counters.takeoutSeq++;
    store.save();
    return `Recojo #${String(num).padStart(2, '0')}`;
  }
}

export const orderService = new OrderService();
