/**
 * ============================================================================
 * SOL DEL NORTE - BUS DE EVENTOS (PUB/SUB)
 * Desacopla la lógica de negocio de los componentes visuales
 * ============================================================================
 */

class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback); // Función de desuscripción
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, payload) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try {
          cb(payload);
        } catch (err) {
          console.error(`Error en listener del evento [${event}]:`, err);
        }
      });
    }
  }
}

export const eventBus = new EventBus();
