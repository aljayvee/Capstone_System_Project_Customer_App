import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export interface UserData {
  id: string | number;
  username: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

export interface OrderPayload {
  selectedServices: string[];
  pabiliCats: string[];
  catItems?: Record<string, string[]>;
  totalPurchaseAmount?: number;
  deliveryAddress?: string;
  latitude?: number;
  longitude?: number;
}

export interface FinalOrder {
  orderId: string;
  services: string[];
  payload: OrderPayload;
  baseFee: number;
  distanceKm: number;
  distanceFee: number;
  commission: number;
  subtotal: number;
  grandTotal: number;
  paymentMethod: 'COD' | 'GCash' | 'Bank Transfer';
  proofUrl?: string;
  status: string;
  createdAt: number;
}

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  CustomerPortal: { user: UserData };
  ServiceList: { user: UserData };
  OrderForm: { user: UserData; selectedServices: string[] };
  Checkout: { user: UserData; orderPayload: OrderPayload };
  OrderConfirmation: { user: UserData; finalOrder: FinalOrder };
  WaitingForDispatcher: { user: UserData; orderId: string; finalOrder?: FinalOrder };
  CustomerChat: { user: UserData; orderId: string };
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
