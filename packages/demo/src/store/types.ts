export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface PaymentMethod {
  id: string;
  label: string;
  type: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  addresses: Address[];
  paymentMethods: PaymentMethod[];
}

export interface Order {
  orderId: string;
  items: CartItem[];
  total: number;
  shippingAddress: Address;
  paymentMethod: PaymentMethod;
  estimatedDelivery: string;
  createdAt: string;
}
