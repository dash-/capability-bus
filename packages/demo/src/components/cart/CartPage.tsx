import React, { useState } from 'react';
import { useCapability } from '@capability-bus/react';
import { useStore } from '../../store/index.js';

export function CartPage() {
  const { state } = useStore();
  const { invoke: removeItem } = useCapability('cart.removeItem');
  const { invoke: submitOrder, isLoading: isSubmitting } = useCapability('checkout.submit');

  const [selectedAddress, setSelectedAddress] = useState(state.user.addresses[0]?.id ?? '');
  const [selectedPayment, setSelectedPayment] = useState(state.user.paymentMethods[0]?.id ?? '');

  const subtotal = state.cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  if (state.cart.length === 0) {
    return (
      <div className="cart-page">
        <h2 style={{ marginBottom: 16 }}>Shopping Cart</h2>
        <div className="empty-state">
          <p>Your cart is empty.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <h2 style={{ marginBottom: 16 }}>Shopping Cart</h2>

      {state.cart.map((item) => (
        <div key={item.product.id} className="cart-item">
          <div className="item-info">
            <div className="item-name">{item.product.name}</div>
            <div className="item-price">
              ${item.product.price.toFixed(2)} x {item.quantity} = $
              {(item.product.price * item.quantity).toFixed(2)}
            </div>
          </div>
          <button className="btn-ghost btn-sm" onClick={() => removeItem({ productId: item.product.id })}>
            Remove
          </button>
        </div>
      ))}

      <div className="cart-summary">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <strong>Subtotal</strong>
          <strong>${subtotal.toFixed(2)}</strong>
        </div>

        <div className="checkout-section">
          <h3>Shipping Address</h3>
          <div className="option-list">
            {state.user.addresses.map((addr) => (
              <label
                key={addr.id}
                className={`option-item ${selectedAddress === addr.id ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="address"
                  value={addr.id}
                  checked={selectedAddress === addr.id}
                  onChange={() => setSelectedAddress(addr.id)}
                />
                <div>
                  <strong>{addr.label}</strong>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {addr.street}, {addr.city}, {addr.state} {addr.zip}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="checkout-section">
          <h3>Payment Method</h3>
          <div className="option-list">
            {state.user.paymentMethods.map((pm) => (
              <label
                key={pm.id}
                className={`option-item ${selectedPayment === pm.id ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="payment"
                  value={pm.id}
                  checked={selectedPayment === pm.id}
                  onChange={() => setSelectedPayment(pm.id)}
                />
                <span>{pm.label}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          className="btn-primary"
          style={{ width: '100%', padding: '12px', fontSize: 16 }}
          disabled={isSubmitting || !selectedAddress || !selectedPayment}
          onClick={() =>
            submitOrder({
              shippingAddressId: selectedAddress,
              paymentMethodId: selectedPayment,
            })
          }
        >
          {isSubmitting ? 'Placing Order...' : `Place Order — $${subtotal.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}
