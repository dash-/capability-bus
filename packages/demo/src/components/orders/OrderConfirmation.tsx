import React from 'react';
import { useStore } from '../../store/index.js';

export function OrderConfirmation() {
  const { state, dispatch } = useStore();
  const order = state.lastOrder;

  if (!order) {
    return (
      <div className="empty-state">
        <p>No order to display.</p>
      </div>
    );
  }

  return (
    <div className="order-confirmation">
      <div className="checkmark">&#10003;</div>
      <h2>Order Confirmed!</h2>
      <p style={{ color: 'var(--text-muted)' }}>
        Order <strong>{order.orderId}</strong> has been placed.
      </p>

      <div className="order-details">
        <div style={{ marginBottom: 12 }}>
          <strong>Estimated Delivery:</strong> {order.estimatedDelivery}
        </div>
        <div style={{ marginBottom: 12 }}>
          <strong>Shipping to:</strong> {order.shippingAddress.label} — {order.shippingAddress.street},{' '}
          {order.shippingAddress.city}
        </div>
        <div style={{ marginBottom: 12 }}>
          <strong>Payment:</strong> {order.paymentMethod.label}
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {order.items.map((item) => (
            <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>
                {item.product.name} x {item.quantity}
              </span>
              <span>${(item.product.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 8,
              paddingTop: 8,
              borderTop: '1px solid var(--border)',
              fontWeight: 600,
            }}
          >
            <span>Total</span>
            <span>${order.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <button
        className="btn-primary"
        style={{ marginTop: 24 }}
        onClick={() => dispatch({ type: 'NAVIGATE', page: 'products' })}
      >
        Continue Shopping
      </button>
    </div>
  );
}
