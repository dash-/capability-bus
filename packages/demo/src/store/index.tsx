import React, { createContext, useContext, useReducer, type ReactNode } from 'react';
import productsData from '../data/products.json';
import userData from '../data/user.json';
import type { CartItem, Order, Product, User } from './types.js';

// --- State ---

interface AppState {
  products: Product[];
  cart: CartItem[];
  user: User;
  orders: Order[];
  currentPage: 'products' | 'cart' | 'confirmation';
  lastOrder: Order | null;
}

const initialState: AppState = {
  products: productsData as Product[],
  cart: [],
  user: userData as User,
  orders: [],
  currentPage: 'products',
  lastOrder: null,
};

// --- Actions ---

type AppAction =
  | { type: 'CART_ADD'; product: Product; quantity: number }
  | { type: 'CART_REMOVE'; productId: string }
  | { type: 'CART_UPDATE_QUANTITY'; productId: string; quantity: number }
  | { type: 'CART_CLEAR' }
  | { type: 'ORDER_PLACED'; order: Order }
  | { type: 'NAVIGATE'; page: AppState['currentPage'] };

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'CART_ADD': {
      const existing = state.cart.find((i) => i.product.id === action.product.id);
      if (existing) {
        return {
          ...state,
          cart: state.cart.map((i) =>
            i.product.id === action.product.id
              ? { ...i, quantity: i.quantity + action.quantity }
              : i,
          ),
        };
      }
      return {
        ...state,
        cart: [...state.cart, { product: action.product, quantity: action.quantity }],
      };
    }
    case 'CART_REMOVE':
      return {
        ...state,
        cart: state.cart.filter((i) => i.product.id !== action.productId),
      };
    case 'CART_UPDATE_QUANTITY':
      return {
        ...state,
        cart: state.cart.map((i) =>
          i.product.id === action.productId ? { ...i, quantity: action.quantity } : i,
        ),
      };
    case 'CART_CLEAR':
      return { ...state, cart: [] };
    case 'ORDER_PLACED':
      return {
        ...state,
        orders: [...state.orders, action.order],
        cart: [],
        lastOrder: action.order,
        currentPage: 'confirmation',
      };
    case 'NAVIGATE':
      return { ...state, currentPage: action.page };
    default:
      return state;
  }
}

// --- Context ---

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

export type { AppState, AppAction };
