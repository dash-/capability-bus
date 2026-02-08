import React from 'react';
import { useCapability } from '@capability-bus/react';
import { useStore } from '../../store/index.js';

export function ProductList() {
  const { state } = useStore();
  const { invoke: addToCart } = useCapability('cart.addItem');

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Products</h2>
      <div className="product-grid">
        {state.products.map((product) => (
          <div key={product.id} className="product-card">
            <img src={product.imageUrl} alt={product.name} />
            <span className="category">{product.category}</span>
            <h3>{product.name}</h3>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{product.description}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="price">${product.price.toFixed(2)}</span>
              <button
                className="btn-primary btn-sm"
                onClick={() => addToCart({ productId: product.id, quantity: 1 })}
              >
                Add to Cart
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
