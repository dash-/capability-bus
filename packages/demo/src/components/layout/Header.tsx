import React from 'react';
import { useStore } from '../../store/index.js';

export function Header() {
  const { state, dispatch } = useStore();
  const itemCount = state.cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <header className="app-header">
      <h1>CapabilityBus Demo Store</h1>
      <nav>
        <button
          className={state.currentPage === 'products' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => dispatch({ type: 'NAVIGATE', page: 'products' })}
        >
          Products
        </button>
        <button
          className={state.currentPage === 'cart' ? 'btn-primary' : 'btn-ghost'}
          onClick={() => dispatch({ type: 'NAVIGATE', page: 'cart' })}
        >
          Cart
          {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
        </button>
      </nav>
    </header>
  );
}
