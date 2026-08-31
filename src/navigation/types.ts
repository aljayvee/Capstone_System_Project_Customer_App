import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PortalTab } from '../components/BottomNav';

export interface UserData {
  id: string | number;
  username: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  birthdate?: string | null;
  email?: string;
  phone?: string;
  avatar?: string | null;
}

export interface ErrandPayload {
  selectedServices: string[];
  pabiliCats: string[];
  catItems?: Record<string, string[]>;
  totalPurchaseAmount?: number;
  deliveryAddress?: string;
  latitude?: number;
  longitude?: number;
}

export interface FinalErrand {
  errandId: string;
  services: string[];
  payload: ErrandPayload;
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
  ForgotPassword: undefined;
  VerifyEmail: {
    customerId: number;
    email: string;
    pendingUser: UserData;
    pendingToken: string;
    // Optional: this screen predates rotating refresh tokens and nothing
    // currently routes to it (registration verifies inline). Carried so that if
    // it is ever reached again it opens a refreshable session rather than one
    // that dies with its first access token.
    pendingRefreshToken?: string;
  };
  CustomerPortal: { user: UserData; initialTab?: PortalTab };
  ServiceList: { user: UserData };
  ErrandForm: {
    user: UserData;
    selectedServices?: string[];
    // Carried by "Order again" on a delivered errand in My Errands. Holds the
    // previous errand's categories so the form opens with them already picked;
    // the customer still confirms items, address and payment, so a reorder is
    // never placed by a single tap.
    reorderFrom?: { errandId: string; categories: string; storeNames: string[] };
  };
  ErrandItems: { user: UserData; selectedCats: string[] };
  Checkout: { user: UserData; errandPayload: ErrandPayload };
  ErrandConfirmation: { user: UserData; finalErrand: FinalErrand };
  WaitingForDispatcher: { user: UserData; errandId: string; finalErrand?: FinalErrand };
  CustomerChat: { user: UserData; errandId: string; initialStatus?: string };
  ActiveChats: { user: UserData };
  CustomerLocation: { user: UserData };
  EditAccount: { user: UserData };
  Account: { user?: UserData } | undefined;
  Settings: { user: UserData };
  Notification: { user?: UserData } | undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
