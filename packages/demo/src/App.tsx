import React, { useEffect, useMemo, useRef } from 'react';
import { CapabilityBus } from '@capability-bus/core';
import { BusProvider } from '@capability-bus/react';
import { StoreProvider, useStore } from './store/index.js';
import { registerAllCapabilities } from './capabilities/index.js';
import { Header } from './components/layout/Header.js';
import { ProductList } from './components/products/ProductList.js';
import { CartPage } from './components/cart/CartPage.js';
import { OrderConfirmation } from './components/orders/OrderConfirmation.js';
import { ChatPanel } from './components/agent/ChatPanel.js';
import { BusDebugPanel } from './components/shared/BusDebugPanel.js';

function AppInner() {
  const { state, dispatch } = useStore();
  const stateRef = useRef(state);
  stateRef.current = state;

  const bus = useMemo(() => new CapabilityBus(), []);

  useEffect(() => {
    registerAllCapabilities(bus, () => stateRef.current, dispatch);
  }, [bus, dispatch]);

  return (
    <BusProvider bus={bus}>
      <div className="app-shell">
        <Header />
        <div className="app-body">
          <div className="main-content">
            {state.currentPage === 'products' && <ProductList />}
            {state.currentPage === 'cart' && <CartPage />}
            {state.currentPage === 'confirmation' && <OrderConfirmation />}
            <BusDebugPanel />
          </div>
          <ChatPanel />
        </div>
      </div>
    </BusProvider>
  );
}

export function App() {
  return (
    <StoreProvider>
      <AppInner />
    </StoreProvider>
  );
}
