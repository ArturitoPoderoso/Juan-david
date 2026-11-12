/**
 * ============================================================================
 * SOL DEL NORTE - CONSTANTES Y ENUMS DEL SISTEMA
 * ============================================================================
 */

export const ORDER_STATUS = {
  PENDING: 'Pendiente',
  IN_PREPARATION: 'En preparación',
  READY: 'Listo',
  PAID: 'Cobrado',
  CANCELLED: 'Cancelado'
};

export const CHANNELS = {
  DINE_IN: 'Salón',
  TAKEOUT: 'Para llevar'
};

export const PAYMENT_METHODS = {
  CASH: 'Efectivo',
  YAPE: 'Yape',
  PLIN: 'Plin',
  CARD: 'Tarjeta'
};

export const KITCHEN_STATIONS = {
  ALL: 'Todas las Estaciones',
  COLD: 'Estación Fría (Ceviches/Causas)',
  HOT: 'Estación Caliente (Salteados/Sopas)',
  BAR: 'Barra & Bebidas'
};

export const TABLE_ZONES = {
  MAIN: 'Salón Principal',
  TERRACE: 'Terraza Marina',
  BAR: 'Barra'
};

export const EVENTS = {
  STATE_CHANGED: 'state:changed',
  ORDER_CREATED: 'order:created',
  ORDER_STATUS_UPDATED: 'order:status:updated',
  CATALOG_AVAILABILITY_CHANGED: 'catalog:availability:changed',
  PAYMENT_PROCESSED: 'payment:processed',
  CASH_EXPENSE_ADDED: 'cash:expense:added',
  PLAY_NOTIFICATION: 'ui:play:notification',
  TOAST_TRIGGERED: 'ui:toast'
};
