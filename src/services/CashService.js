/**
 * ============================================================================
 * SOL DEL NORTE - SERVICIO DE ARQUEO Y CUADRE DE CAJA (CUS-01-05)
 * Balance diario, salidas de caja chica y auditoría financiera
 * ============================================================================
 */

import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import { EVENTS, PAYMENT_METHODS } from '../core/Constants.js';

export class CashService {
  /**
   * CUS-01-05 Paso 1 y 2: Reporte de ventas desagregado y cálculo del efectivo esperado
   * Fórmula Operativa: (Fondo inicial + Cobros en efectivo) - Salidas registradas
   */
  getDailyAuditSummary() {
    const state = store.getState();
    const payments = state.payments || [];
    const expenses = state.cashDrawer.expenses || [];
    const initialCash = Number(state.cashDrawer.initialCash) || 0;

    let cashSales = 0;
    let yapeSales = 0;
    let plinSales = 0;
    let cardSales = 0;

    payments.forEach(p => {
      const amount = Number(p.total) || 0;
      if (p.method === PAYMENT_METHODS.CASH) cashSales += amount;
      else if (p.method === PAYMENT_METHODS.YAPE) yapeSales += amount;
      else if (p.method === PAYMENT_METHODS.PLIN) plinSales += amount;
      else if (p.method === PAYMENT_METHODS.CARD) cardSales += amount;
    });

    const totalSales = Number((cashSales + yapeSales + plinSales + cardSales).toFixed(2));
    const totalExpenses = Number(expenses.reduce((acc, e) => acc + Number(e.amount), 0).toFixed(2));

    // Fórmula R05: (Fondo inicial + Cobros en efectivo) - Salidas registradas
    const expectedCash = Number(((initialCash + cashSales) - totalExpenses).toFixed(2));

    return {
      initialCash,
      cashSales: Number(cashSales.toFixed(2)),
      yapeSales: Number(yapeSales.toFixed(2)),
      plinSales: Number(plinSales.toFixed(2)),
      cardSales: Number(cardSales.toFixed(2)),
      digitalSales: Number((yapeSales + plinSales + cardSales).toFixed(2)),
      totalSales,
      totalExpenses,
      expectedCash,
      expensesList: expenses,
      paymentsCount: payments.length
    };
  }

  /**
   * CUS-01-05 Paso 3: Comparar efectivo contado vs esperado
   */
  reconcileCash(physicalCashCounted) {
    const counted = Number(physicalCashCounted);
    if (isNaN(counted) || counted < 0) {
      throw new Error('El monto de efectivo físico contado debe ser un número válido y mayor o igual a cero.');
    }

    const summary = this.getDailyAuditSummary();
    const difference = Number((counted - summary.expectedCash).toFixed(2));

    let status = 'BALANCED'; // 'BALANCED', 'SHORTAGE', 'SURPLUS'
    if (Math.abs(difference) < 0.01) {
      status = 'BALANCED';
    } else if (difference < 0) {
      status = 'SHORTAGE'; // Faltante
    } else {
      status = 'SURPLUS'; // Sobrante
    }

    const result = {
      countedCash: counted,
      expectedCash: summary.expectedCash,
      difference,
      status,
      timestamp: new Date().toISOString()
    };

    return result;
  }

  addExpense(reason, amount) {
    if (!reason || reason.trim() === '') {
      throw new Error('Debe especificar el motivo de la salida de caja chica.');
    }
    const val = Number(amount);
    if (isNaN(val) || val <= 0) {
      throw new Error('El monto de la salida debe ser mayor a cero.');
    }

    const state = store.getState();
    const now = new Date();
    const expenseItem = {
      id: `EXP-${Date.now().toString().slice(-4)}`,
      reason: reason.trim(),
      amount: val,
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: now.toLocaleDateString()
    };

    state.cashDrawer.expenses.push(expenseItem);
    store.save();

    eventBus.emit(EVENTS.CASH_EXPENSE_ADDED, expenseItem);
    return expenseItem;
  }

  setInitialCash(amount) {
    const val = Number(amount);
    if (isNaN(val) || val < 0) {
      throw new Error('El fondo inicial de caja no puede ser negativo.');
    }
    const state = store.getState();
    state.cashDrawer.initialCash = val;
    store.save();
    return val;
  }
}

export const cashService = new CashService();
