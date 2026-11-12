/**
 * ============================================================================
 * SOL DEL NORTE - SERVICIO DE PRE-CUENTA Y COBROS (CUS-01-04)
 * Consolidación aritmética, desglose y registro manual de pagos
 * ============================================================================
 */

import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import { EVENTS, ORDER_STATUS, PAYMENT_METHODS } from '../core/Constants.js';

export class BillingService {
  /**
   * CUS-01-04 Paso 1: Generar la pre-cuenta consolidada
   * Desglosa cantidades, precios unitarios y suma automáticamente (cantidad x precio)
   */
  generatePreBill(targetNumber) {
    const activeOrders = store.getState().orders.filter(
      o => o.targetNumber === targetNumber && o.status !== ORDER_STATUS.PAID
    );

    if (activeOrders.length === 0) return null;

    // Consolidar ítems agrupados por plato y nota
    const itemMap = new Map();

    activeOrders.forEach(ord => {
      ord.items.forEach(it => {
        const key = `${it.id}__${it.note || ''}`;
        if (!itemMap.has(key)) {
          itemMap.set(key, {
            id: it.id,
            name: it.name,
            price: Number(it.price),
            quantity: 0,
            note: it.note || '',
            subtotal: 0
          });
        }
        const row = itemMap.get(key);
        row.quantity += Number(it.quantity);
        row.subtotal = Number((row.quantity * row.price).toFixed(2));
      });
    });

    const consolidatedItems = Array.from(itemMap.values());
    const total = Number(consolidatedItems.reduce((acc, it) => acc + it.subtotal, 0).toFixed(2));

    // Desglose tributario informativo (Base imponible + IGV 18%)
    const subtotalBase = Number((total / 1.18).toFixed(2));
    const igv = Number((total - subtotalBase).toFixed(2));

    return {
      targetNumber,
      orderCodes: activeOrders.map(o => o.id),
      items: consolidatedItems,
      subtotalBase,
      igv,
      total,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * CUS-01-04 Paso 2 y 3: Confirmar cobro y bloquear comanda
   * Soporta Efectivo, Yape, Plin y Pagos Mixtos (Divididos)
   */
  processPayment({ targetNumber, method, reference = '', cashGiven = 0, splitDetails = null }) {
    const preBill = this.generatePreBill(targetNumber);
    if (!preBill) {
      throw new Error(`No hay consumo activo por cobrar para "${targetNumber}".`);
    }

    // Validar referencia si es medio digital
    if ((method === PAYMENT_METHODS.YAPE || method === PAYMENT_METHODS.PLIN) && (!reference || reference.trim() === '')) {
      throw new Error(`Para cobros con ${method}, es obligatorio ingresar el código de operación o comprobante de validación.`);
    }

    const state = store.getState();
    const now = new Date();
    const paymentId = `PAG-${Date.now().toString().slice(-6)}`;

    const totalToPay = preBill.total;
    let change = 0;

    if (method === PAYMENT_METHODS.CASH) {
      if (cashGiven < totalToPay) {
        throw new Error(`El efectivo entregado (S/ ${cashGiven.toFixed(2)}) es menor al total a cobrar (S/ ${totalToPay.toFixed(2)}).`);
      }
      change = Number((cashGiven - totalToPay).toFixed(2));
    }

    const paymentRecord = {
      id: paymentId,
      targetNumber,
      orderCodes: preBill.orderCodes,
      items: preBill.items,
      total: totalToPay,
      method,
      reference: reference.trim(),
      cashGiven: Number(cashGiven) || totalToPay,
      change,
      splitDetails: splitDetails || null,
      timestamp: now.toISOString(),
      timeFormatted: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Bloquear inmediatamente todas las órdenes involucradas
    state.orders.forEach(ord => {
      if (preBill.orderCodes.includes(ord.id)) {
        ord.status = ORDER_STATUS.PAID;
        ord.paidAt = now.toISOString();
      }
    });

    state.payments.push(paymentRecord);
    store.save();

    eventBus.emit(EVENTS.PAYMENT_PROCESSED, paymentRecord);
    return paymentRecord;
  }
}

export const billingService = new BillingService();
