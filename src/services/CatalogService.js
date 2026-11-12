/**
 * ============================================================================
 * SOL DEL NORTE - SERVICIO DE CATÁLOGO (CUS-01-02)
 * Actualización en tiempo real del estado de platos (SLA < 5s)
 * ============================================================================
 */

import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import { EVENTS } from '../core/Constants.js';

export class CatalogService {
  getAll() {
    return store.getState().menu;
  }

  getAvailableOnly() {
    return store.getState().menu.filter(dish => dish.isAvailable);
  }

  getById(dishId) {
    return store.getState().menu.find(d => d.id === dishId);
  }

  // CUS-01-02: Actualizar disponibilidad de platos (Cocinero)
  toggleStock(dishId) {
    const state = store.getState();
    const dish = state.menu.find(d => d.id === dishId);
    if (!dish) {
      throw new Error(`Plato con ID ${dishId} no encontrado en catálogo.`);
    }

    dish.isAvailable = !dish.isAvailable;
    dish.lastStockUpdate = new Date().toISOString();

    store.save();

    eventBus.emit(EVENTS.CATALOG_AVAILABILITY_CHANGED, {
      dishId: dish.id,
      dishName: dish.name,
      isAvailable: dish.isAvailable
    });

    return dish;
  }

  search(query, category = 'Todos', station = 'ALL') {
    let list = store.getState().menu;

    if (category !== 'Todos') {
      list = list.filter(d => d.category === category);
    }

    if (station !== 'ALL') {
      list = list.filter(d => d.station === station);
    }

    if (query && query.trim() !== '') {
      const q = query.toLowerCase().trim();
      list = list.filter(d => 
        d.name.toLowerCase().includes(q) || 
        d.desc.toLowerCase().includes(q)
      );
    }

    return list;
  }
}

export const catalogService = new CatalogService();
