/**
 * ============================================================================
 * SOL DEL NORTE - VISTA CAJA & COBRO (CUS-01-04)
 * Cuentas pendientes, pre-cuenta consolidada, pagos y ticket de consumo
 * ============================================================================
 */

import { store } from '../core/Store.js';
import { eventBus } from '../core/EventBus.js';
import { billingService } from '../services/BillingService.js';
import { EVENTS, ORDER_STATUS, PAYMENT_METHODS } from '../core/Constants.js';

export class CashierView {
  constructor() {
    this.selectedTarget = null;
    this.selectedMethod = PAYMENT_METHODS.CASH;
    this.isSplitMode = false;
  }

  mount() {
    this.initDOMElements();
    this.attachEventListeners();
    this.render();

    // Eventos
    eventBus.on(EVENTS.ORDER_CREATED, () => this.render());
    eventBus.on(EVENTS.PAYMENT_PROCESSED, () => this.render());
  }

  initDOMElements() {
    this.pendingBillsList = document.getElementById('pendingBillsList');
    this.billingEmptyPanel = document.getElementById('billingEmptyPanel');
    this.billingDetailPanel = document.getElementById('billingDetailPanel');
    this.targetTitle = document.getElementById('preaccountTargetTitle');
    this.ordersCodes = document.getElementById('preaccountOrdersCodes');
    this.preaccountTableBody = document.getElementById('preaccountTableBody');
    this.preaccountTotalVal = document.getElementById('preaccountTotalVal');
    this.checkoutTotalToPay = document.getElementById('checkoutTotalToPay');
    this.btnPrintPreaccount = document.getElementById('btnPrintPreaccount');

    this.methodCards = document.querySelectorAll('.payment-method-card');
    this.yapePlinRow = document.getElementById('yapePlinReferenceRow');
    this.cashGivenRow = document.getElementById('cashGivenRow');
    this.inputReference = document.getElementById('inputPaymentReference');
    this.inputCashGiven = document.getElementById('inputCashGiven');
    this.cashChangeValue = document.getElementById('cashChangeValue');
    this.btnConfirmPayment = document.getElementById('btnConfirmPayment');
    this.printOnlyTicket = document.getElementById('printOnlyTicket');
  }

  attachEventListeners() {
    // Selección de métodos de pago
    this.methodCards.forEach(card => {
      card.addEventListener('click', () => {
        this.methodCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedMethod = card.dataset.method;

        if (this.selectedMethod === PAYMENT_METHODS.CASH) {
          this.yapePlinRow.style.display = 'none';
          this.cashGivenRow.style.display = 'block';
        } else {
          this.yapePlinRow.style.display = 'block';
          this.cashGivenRow.style.display = 'none';
        }
      });
    });

    // Cálculo dinámico de vuelto
    if (this.inputCashGiven) {
      this.inputCashGiven.addEventListener('input', () => {
        this.updateCashChange();
      });
    }

    // Botón Confirmar Cobro
    if (this.btnConfirmPayment) {
      this.btnConfirmPayment.addEventListener('click', () => this.handleConfirmPayment());
    }

    // Botón Imprimir
    if (this.btnPrintPreaccount) {
      this.btnPrintPreaccount.addEventListener('click', () => {
        if (this.selectedTarget) window.print();
      });
    }
  }

  render() {
    this.renderPendingBills();
    this.renderBillDetails();
  }

  renderPendingBills() {
    if (!this.pendingBillsList) return;
    this.pendingBillsList.innerHTML = '';

    const orders = store.getState().orders;
    const activeTargets = new Set();

    orders.filter(o => o.status !== ORDER_STATUS.PAID).forEach(o => {
      activeTargets.add(o.targetNumber);
    });

    if (activeTargets.size === 0) {
      this.pendingBillsList.innerHTML = `
        <div style="font-size:0.85rem; color:var(--color-text-subtle); padding: 1.5rem 0; text-align: center;">
          No hay cuentas pendientes por cobrar.
        </div>
      `;
      this.selectedTarget = null;
      this.renderBillDetails();
      return;
    }

    if (!this.selectedTarget || !activeTargets.has(this.selectedTarget)) {
      this.selectedTarget = Array.from(activeTargets)[0];
    }

    activeTargets.forEach(target => {
      const bill = billingService.generatePreBill(target);
      if (!bill) return;

      const isSelected = this.selectedTarget === target;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `bill-item-btn ${isSelected ? 'selected' : ''}`;

      btn.innerHTML = `
        <div class="bill-item-title">
          <span>${target}</span>
          <span style="font-weight:800; color:var(--color-marine-navy);">S/ ${bill.total.toFixed(2)}</span>
        </div>
        <div class="bill-item-sub">
          ${bill.orderCodes.join(', ')} • ${bill.items.reduce((acc, i) => acc + i.quantity, 0)} platos
        </div>
      `;

      btn.addEventListener('click', () => {
        this.selectedTarget = target;
        this.renderPendingBills();
        this.renderBillDetails();
      });

      this.pendingBillsList.appendChild(btn);
    });
  }

  renderBillDetails() {
    if (!this.billingDetailPanel || !this.billingEmptyPanel) return;

    if (!this.selectedTarget) {
      this.billingDetailPanel.style.display = 'none';
      this.billingEmptyPanel.style.display = 'block';
      return;
    }

    const bill = billingService.generatePreBill(this.selectedTarget);
    if (!bill) {
      this.billingDetailPanel.style.display = 'none';
      this.billingEmptyPanel.style.display = 'block';
      return;
    }

    this.billingDetailPanel.style.display = 'block';
    this.billingEmptyPanel.style.display = 'none';

    this.targetTitle.textContent = bill.targetNumber;
    this.ordersCodes.textContent = `Comandas consolidadas: ${bill.orderCodes.join(' | ')}`;

    this.preaccountTableBody.innerHTML = '';
    bill.items.forEach(it => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:700;">${it.quantity}</td>
        <td>${it.name}${it.note ? `<br><small style="color:#777;">(${it.note})</small>` : ''}</td>
        <td style="text-align: right;">S/ ${it.price.toFixed(2)}</td>
        <td style="text-align: right; font-weight:700;">S/ ${it.subtotal.toFixed(2)}</td>
      `;
      this.preaccountTableBody.appendChild(tr);
    });

    this.preaccountTotalVal.textContent = `S/ ${bill.total.toFixed(2)}`;
    this.checkoutTotalToPay.textContent = `S/ ${bill.total.toFixed(2)}`;

    // Resetear efectivo recibido por defecto al monto exacto
    this.inputCashGiven.value = bill.total.toFixed(2);
    this.updateCashChange();

    this.renderPrintTicket(bill);
  }

  updateCashChange() {
    if (!this.selectedTarget) return;
    const bill = billingService.generatePreBill(this.selectedTarget);
    if (!bill) return;

    const given = parseFloat(this.inputCashGiven.value) || 0;
    const change = Math.max(0, given - bill.total);
    this.cashChangeValue.textContent = `S/ ${change.toFixed(2)}`;
  }

  handleConfirmPayment() {
    if (!this.selectedTarget) return;

    const ref = (this.inputReference?.value || '').trim();
    const cashGiven = parseFloat(this.inputCashGiven?.value) || 0;

    try {
      const payment = billingService.processPayment({
        targetNumber: this.selectedTarget,
        method: this.selectedMethod,
        reference: ref,
        cashGiven: cashGiven
      });

      eventBus.emit(EVENTS.TOAST_TRIGGERED, {
        message: `Pago de S/ ${payment.total.toFixed(2)} registrado para ${payment.targetNumber} vía ${payment.method}.`,
        type: 'success'
      });

      if (this.inputReference) this.inputReference.value = '';
      this.selectedTarget = null;
      this.render();
    } catch (err) {
      eventBus.emit(EVENTS.TOAST_TRIGGERED, {
        message: err.message,
        type: 'warning'
      });
    }
  }

  renderPrintTicket(bill) {
    if (!this.printOnlyTicket) return;

    const now = new Date();
    this.printOnlyTicket.innerHTML = `
      <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">
        <h2 style="margin: 0; font-size: 1.1rem; letter-spacing: 1px;">CEVICHERÍA SOL DEL NORTE</h2>
        <p style="margin: 2px 0; font-size: 0.75rem;">RUC: 20608974512 • Huanchaco, La Libertad</p>
        <p style="margin: 2px 0; font-size: 0.8rem; font-weight: bold;">PRE-CUENTA DE CONSUMO</p>
        <p style="margin: 2px 0; font-size: 0.75rem;">${bill.targetNumber} • ${now.toLocaleDateString()} ${now.toLocaleTimeString()}</p>
      </div>

      <table style="width: 100%; font-size: 0.8rem; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px dashed #000;">
            <th style="text-align: left; width: 30px;">Cant</th>
            <th style="text-align: left;">Descripción</th>
            <th style="text-align: right; width: 60px;">Importe</th>
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

      <div style="border-top: 1px dashed #000; margin-top: 8px; padding-top: 6px; font-size: 0.8rem;">
        <div style="display:flex; justify-content:space-between;">
          <span>Op. Gravada:</span>
          <span>S/ ${bill.subtotalBase.toFixed(2)}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>I.G.V. (18%):</span>
          <span>S/ ${bill.igv.toFixed(2)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-weight: bold; font-size: 1rem; margin-top: 4px;">
          <span>TOTAL A COBRAR:</span>
          <span>S/ ${bill.total.toFixed(2)}</span>
        </div>
      </div>

      <div style="text-align: center; margin-top: 12px; font-size: 0.75rem;">
        Conserve este comprobante para su atención.<br>¡Gracias por su visita!
      </div>
    `;
  }
}
