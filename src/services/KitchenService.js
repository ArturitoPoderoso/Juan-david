/**
 * ============================================================================
 * SOL DEL NORTE - SERVICIO DE COCINA KDS (CUS-01-03)
 * Cola FIFO estricta, máquina de estados y enrutamiento por estaciones
 * ============================================================================
 */

import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import { EVENTS, ORDER_STATUS } from '../core/Constants.js';
import { sound } from '../core/AudioAlerts.js';

export class KitchenService {
  /**
   * CUS-01-03 Paso 1: Visualizar cola ordenada estrictamente por fecha y hora (FIFO).
   * Filtra opcionalmente por estación de cocina (Fría, Caliente, Barra)
   */
  getFifoQueue(stationFilter = 'ALL') {
    const orders = store.getState().orders.filter(o => 
      o.status === ORDER_STATUS.PENDING ||
      o.status === ORDER_STATUS.IN_PREPARATION ||
      o.status === ORDER_STATUS.READY
    );

    // Orden estrictamente cronológico: la más antigua primero (FIFO)
    const sorted = [...orders].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    if (stationFilter === 'ALL') {
      return sorted;
    }

    // Filtrar si alguno de los platos pertenece a la estación
    return sorted.filter(ord => ord.items.some(it => it.station === stationFilter));
  }

  /**
   * CUS-01-03 Paso 2: Cambiar comanda a "En preparación".
   */
  startPreparation(orderId) {
    const state = store.getState();
    const order = state.orders.find(o => o.id === orderId);

    if (!order) {
      throw new Error(`Comanda ${orderId} no encontrada.`);
    }

    if (order.status !== ORDER_STATUS.PENDING) {
      throw new Error(`Solo se pueden iniciar comandas con estado "${ORDER_STATUS.PENDING}".`);
    }

    const now = new Date();
    order.status = ORDER_STATUS.IN_PREPARATION;
    order.prepStartTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    store.save();
    eventBus.emit(EVENTS.ORDER_STATUS_UPDATED, order);
    return order;
  }

  /**
   * CUS-01-03 Paso 3 y Excepción:
   * - Finaliza preparación y cambia a "Listo". Notifica a salón.
   * - Excepción obligatoria: Bloquea si intenta pasar directo de "Pendiente" a "Listo".
   */
  markAsReady(orderId) {
    const state = store.getState();
    const order = state.orders.find(o => o.id === orderId);

    if (!order) {
      throw new Error(`Comanda ${orderId} no encontrada.`);
    }

    // Regla de Negocio CUS-01-03:
    // "El Cocinero intenta pasar una comanda de 'Pendiente' directamente a 'Listo':
    // El sistema bloquea el salto de estado y obliga a pasar primero por 'En preparación'".
    if (order.status === ORDER_STATUS.PENDING) {
      sound.playWarning();
      throw new Error('Regla Operativa de Cocina: No se puede saltar de "Pendiente" directamente a "Listo". Debe iniciar primero "En preparación" para registrar los tiempos.');
    }

    if (order.status !== ORDER_STATUS.IN_PREPARATION) {
      throw new Error(`La comanda no está en preparación.`);
    }

    const now = new Date();
    order.status = ORDER_STATUS.READY;
    order.readyTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    store.save();

    // Campana de aviso a salón y notificación por evento
    sound.playOrderReady();
    eventBus.emit(EVENTS.ORDER_STATUS_UPDATED, order);

    return order;
  }
}

export const kitchenService = new KitchenService();
