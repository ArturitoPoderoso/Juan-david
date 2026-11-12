/**
 * ============================================================================
 * SOL DEL NORTE - VISTA ADMINISTRACIÓN & CUADRE (CUS-01-05)
 * Balance diario, salidas de caja chica, fórmula de efectivo esperado y exportación
 * ============================================================================
 */

import { eventBus } from '../core/EventBus.js';
import { cashService } from '../services/CashService.js';
import { EVENTS } from '../core/Constants.js';

export class AdminView {
  constructor() {
    this.lastReconciliationResult = null;
  }

  mount() {
    this.initDOMElements();
    this.attachEventListeners();
    this.render();

    // Eventos
    eventBus.on(EVENTS.PAYMENT_PROCESSED, () => this.render());
    eventBus.on(EVENTS.CASH_EXPENSE_ADDED, () => this.render());
  }

  initDOMElements() {
    this.metricTotalSales = document.getElementById('metricTotalSales');
    this.metricCashSales = document.getElementById('metricCashSales');
    this.metricDigitalSales = document.getElementById('metricDigitalSales');
    this.metricExpenses = document.getElementById('metricExpenses');

    this.inputInitialCash = document.getElementById('inputInitialCash');
    this.btnSaveInitialCash = document.getElementById('btnSaveInitialCash');

    this.inputExpenseReason = document.getElementById('inputExpenseReason');
    this.inputExpenseAmount = document.getElementById('inputExpenseAmount');
    this.btnAddExpense = document.getElementById('btnAddExpense');
    this.adminExpensesList = document.getElementById('adminExpensesList');

    this.summarySalesCash = document.getElementById('summarySalesCash');
    this.summarySalesYape = document.getElementById('summarySalesYape');
    this.summarySalesPlin = document.getElementById('summarySalesPlin');
    this.summarySalesTotal = document.getElementById('summarySalesTotal');

    this.formulaBreakdown = document.getElementById('formulaBreakdown');
    this.formulaExpectedResult = document.getElementById('formulaExpectedResult');
    this.inputCountedCash = document.getElementById('inputCountedCash');
    this.btnRunReconciliation = document.getElementById('btnRunReconciliation');

    this.resultBox = document.getElementById('reconciliationResultBox');
    this.resultTitle = document.getElementById('reconciliationResultTitle');
    this.resultAmount = document.getElementById('reconciliationResultAmount');
    this.resultDetail = document.getElementById('reconciliationResultDetail');
  }

  attachEventListeners() {
    if (this.btnSaveInitialCash) {
      this.btnSaveInitialCash.addEventListener('click', () => {
        const val = parseFloat(this.inputInitialCash.value);
        try {
          cashService.setInitialCash(val);
          eventBus.emit(EVENTS.TOAST_TRIGGERED, {
            message: `Fondo inicial fijado en S/ ${val.toFixed(2)}.`,
            type: 'success'
          });
          this.render();
        } catch (err) {
          eventBus.emit(EVENTS.TOAST_TRIGGERED, {
            message: err.message,
            type: 'warning'
          });
        }
      });
    }

    if (this.btnAddExpense) {
      this.btnAddExpense.addEventListener('click', () => {
        const reason = this.inputExpenseReason.value;
        const amount = parseFloat(this.inputExpenseAmount.value);
        try {
          cashService.addExpense(reason, amount);
          this.inputExpenseReason.value = '';
          this.inputExpenseAmount.value = '';
          eventBus.emit(EVENTS.TOAST_TRIGGERED, {
            message: `Salida de S/ ${amount.toFixed(2)} registrada correctamente.`,
            type: 'success'
          });
          this.render();
        } catch (err) {
          eventBus.emit(EVENTS.TOAST_TRIGGERED, {
            message: err.message,
            type: 'warning'
          });
        }
      });
    }

    if (this.btnRunReconciliation) {
      this.btnRunReconciliation.addEventListener('click', () => {
        const counted = parseFloat(this.inputCountedCash.value);
        try {
          const res = cashService.reconcileCash(counted);
          this.displayReconciliation(res);
        } catch (err) {
          eventBus.emit(EVENTS.TOAST_TRIGGERED, {
            message: err.message,
            type: 'warning'
          });
        }
      });
    }
  }

  render() {
    const summary = cashService.getDailyAuditSummary();

    if (this.metricTotalSales) this.metricTotalSales.textContent = `S/ ${summary.totalSales.toFixed(2)}`;
    if (this.metricCashSales) this.metricCashSales.textContent = `S/ ${summary.cashSales.toFixed(2)}`;
    if (this.metricDigitalSales) this.metricDigitalSales.textContent = `S/ ${summary.digitalSales.toFixed(2)}`;
    if (this.metricExpenses) this.metricExpenses.textContent = `S/ ${summary.totalExpenses.toFixed(2)}`;

    if (this.inputInitialCash && document.activeElement !== this.inputInitialCash) {
      this.inputInitialCash.value = summary.initialCash.toFixed(2);
    }

    if (this.summarySalesCash) this.summarySalesCash.textContent = `S/ ${summary.cashSales.toFixed(2)}`;
    if (this.summarySalesYape) this.summarySalesYape.textContent = `S/ ${summary.yapeSales.toFixed(2)}`;
    if (this.summarySalesPlin) this.summarySalesPlin.textContent = `S/ ${summary.plinSales.toFixed(2)}`;
    if (this.summarySalesTotal) this.summarySalesTotal.textContent = `S/ ${summary.totalSales.toFixed(2)}`;

    if (this.formulaBreakdown) {
      this.formulaBreakdown.textContent = `(Fondo: S/ ${summary.initialCash.toFixed(2)} + Efectivo: S/ ${summary.cashSales.toFixed(2)}) - Salidas: S/ ${summary.totalExpenses.toFixed(2)}`;
    }
    if (this.formulaExpectedResult) {
      this.formulaExpectedResult.textContent = `S/ ${summary.expectedCash.toFixed(2)}`;
    }

    this.renderExpensesList(summary.expensesList);
  }

  renderExpensesList(expenses) {
    if (!this.adminExpensesList) return;

    if (expenses.length === 0) {
      this.adminExpensesList.innerHTML = `
        <div style="font-size:0.75rem; color:var(--color-text-subtle); padding: 4px 0;">
          No se han registrado salidas de caja hoy.
        </div>
      `;
      return;
    }

    this.adminExpensesList.innerHTML = '';
    expenses.slice(-6).reverse().forEach(exp => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.fontSize = '0.78rem';
      row.style.padding = '4px 0';
      row.style.borderBottom = '1px dashed var(--color-border-subtle)';

      row.innerHTML = `
        <span>${exp.time} • ${this.escapeHtml(exp.reason)}</span>
        <strong style="color:var(--color-terracotta);">- S/ ${Number(exp.amount).toFixed(2)}</strong>
      `;
      this.adminExpensesList.appendChild(row);
    });
  }

  displayReconciliation(res) {
    if (!this.resultBox) return;

    this.resultBox.style.display = 'block';
    this.resultBox.className = 'difference-result-box';

    if (res.status === 'BALANCED') {
      this.resultBox.classList.add('balanced');
      this.resultTitle.textContent = '✓ CUADRE DE CAJA EXACTO';
      this.resultAmount.textContent = 'Diferencia: S/ 0.00';
      this.resultDetail.textContent = 'El efectivo físico contado coincide al 100% con la fórmula operativa esperada.';
    } else if (res.status === 'SHORTAGE') {
      this.resultBox.classList.add('shortage');
      this.resultTitle.textContent = '⚠ ALERTA DE FALTANTE EN CAJA';
      this.resultAmount.textContent = `- S/ ${Math.abs(res.difference).toFixed(2)}`;
      this.resultDetail.textContent = `Se contaron S/ ${res.countedCash.toFixed(2)} en físico, pero el sistema esperaba S/ ${res.expectedCash.toFixed(2)}. Faltan S/ ${Math.abs(res.difference).toFixed(2)}.`;
    } else {
      this.resultBox.classList.add('surplus');
      this.resultTitle.textContent = 'ℹ AVISO DE SOBRANTE EN CAJA';
      this.resultAmount.textContent = `+ S/ ${res.difference.toFixed(2)}`;
      this.resultDetail.textContent = `Se contaron S/ ${res.countedCash.toFixed(2)} en físico, superando el esperado de S/ ${res.expectedCash.toFixed(2)}.`;
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
