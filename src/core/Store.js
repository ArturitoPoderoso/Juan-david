/**
 * ============================================================================
 * SOL DEL NORTE - CENTRALIZED STATE STORE (REACTIVO E INMUTABLE)
 * ============================================================================
 */

import { eventBus } from './EventBus.js';
import { EVENTS, ORDER_STATUS } from './Constants.js';

const STORAGE_KEY = 'soldelnorte_enterprise_v2';

// Catálogo con enrutamiento de estación de cocina (Fría, Caliente, Barra)
const INITIAL_MENU = [
  { id: 'PL-01', name: 'Ceviche Clásico del Día', category: 'Ceviches', station: 'COLD', price: 38.00, desc: 'Pesca fresca del día, ají limo norteño, choclo tierno y camote glaseado', isAvailable: true, prepMinutes: 8 },
  { id: 'PL-02', name: 'Ceviche Mixto Especial', category: 'Ceviches', station: 'COLD', price: 44.00, desc: 'Pescado fresco, pulpo tierno, langostinos y calamar crocante', isAvailable: true, prepMinutes: 10 },
  { id: 'PL-03', name: 'Tiradito al Ají Amarillo', category: 'Ceviches', station: 'COLD', price: 40.00, desc: 'Finas láminas de corvina bañadas en crema de ají amarillo ahumado', isAvailable: true, prepMinutes: 8 },
  { id: 'PL-04', name: 'Arroz con Mariscos a la Chiclayana', category: 'Calientes', station: 'HOT', price: 45.00, desc: 'Arroz meloso en aderezo norteño con mariscos selectos al wok y toque de pisco', isAvailable: true, prepMinutes: 15 },
  { id: 'PL-05', name: 'Chicharrón de Calamar & Pescado', category: 'Calientes', station: 'HOT', price: 38.00, desc: 'Trocitos dorados y crocantes con yucas fritas y salsa tártara de la casa', isAvailable: true, prepMinutes: 12 },
  { id: 'PL-06', name: 'Parihuela Levanta Muertos', category: 'Calientes', station: 'HOT', price: 48.00, desc: 'Concentrado marino norteño con cangrejo entero, mariscos y chicha de jora', isAvailable: true, prepMinutes: 18 },
  { id: 'PL-07', name: 'Causa Marina con Pulpa de Cangrejo', category: 'Entradas', station: 'COLD', price: 32.00, desc: 'Papa amarilla con toque de ají, palta cremosa y pulpa pura de cangrejo', isAvailable: true, prepMinutes: 6 },
  { id: 'PL-08', name: 'Leche de Tigre con Chicharrón', category: 'Entradas', station: 'COLD', price: 24.00, desc: 'Copa concentrada con canchita chulpi y chicharrón crocante de pota', isAvailable: true, prepMinutes: 5 },
  { id: 'PL-09', name: 'Chicha Morada Tradicional (Jarra 1L)', category: 'Bebidas', station: 'BAR', price: 16.00, desc: 'Elaborada artesanalmente con maíz morado, piña, membrillo y canela', isAvailable: true, prepMinutes: 2 },
  { id: 'PL-10', name: 'Cerveza Cusqueña Trigo (620ml)', category: 'Bebidas', station: 'BAR', price: 15.00, desc: 'Bien fría en vaso servido para acompañar mariscos', isAvailable: true, prepMinutes: 1 },
  { id: 'PL-11', name: 'Limonada Frozen al Hierbaluisa', category: 'Bebidas', station: 'BAR', price: 14.00, desc: 'Refrescante frappeada con limones norteños y hierbaluisa', isAvailable: true, prepMinutes: 3 }
];

// Estructura de Mesas con Zonas físicas del restaurante
const INITIAL_TABLES = [
  { id: 'M-01', number: 'Mesa 1', zone: 'MAIN', capacity: 4 },
  { id: 'M-02', number: 'Mesa 2', zone: 'MAIN', capacity: 4 },
  { id: 'M-03', number: 'Mesa 3', zone: 'MAIN', capacity: 2 },
  { id: 'M-04', number: 'Mesa 4', zone: 'MAIN', capacity: 6 },
  { id: 'M-05', number: 'Mesa 5', zone: 'MAIN', capacity: 4 },
  { id: 'M-06', number: 'Mesa 6', zone: 'MAIN', capacity: 4 },
  { id: 'M-07', number: 'Mesa 7', zone: 'TERRACE', capacity: 4 },
  { id: 'M-08', number: 'Mesa 8', zone: 'TERRACE', capacity: 4 },
  { id: 'M-09', number: 'Mesa 9', zone: 'TERRACE', capacity: 6 },
  { id: 'M-10', number: 'Mesa 10', zone: 'TERRACE', capacity: 2 },
  { id: 'M-11', number: 'Barra 1', zone: 'BAR', capacity: 2 },
  { id: 'M-12', number: 'Barra 2', zone: 'BAR', capacity: 2 }
];

class Store {
  constructor() {
    this.state = this.loadInitialState();
  }

  loadInitialState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return {
          menu: parsed.menu || INITIAL_MENU,
          tables: parsed.tables || INITIAL_TABLES,
          orders: parsed.orders || [],
          payments: parsed.payments || [],
          cashDrawer: parsed.cashDrawer || {
            initialCash: 200.00,
            expenses: [
              { id: 'EXP-101', reason: 'Hielo en bolsa para pescadería', amount: 15.00, time: '11:15' }
            ],
            history: []
          },
          counters: parsed.counters || { orderSeq: 101, takeoutSeq: 1 }
        };
      } catch (err) {
        console.error('Error parseando almacenamiento local:', err);
      }
    }

    return {
      menu: JSON.parse(JSON.stringify(INITIAL_MENU)),
      tables: JSON.parse(JSON.stringify(INITIAL_TABLES)),
      orders: [],
      payments: [],
      cashDrawer: {
        initialCash: 200.00,
        expenses: [
          { id: 'EXP-101', reason: 'Hielo en bolsa para pescadería', amount: 15.00, time: '11:15' }
        ],
        history: []
      },
      counters: { orderSeq: 101, takeoutSeq: 1 }
    };
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    eventBus.emit(EVENTS.STATE_CHANGED, this.state);
  }

  getState() {
    return this.state;
  }
}

export const store = new Store();
