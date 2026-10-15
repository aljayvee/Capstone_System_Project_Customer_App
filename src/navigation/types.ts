import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PortalTab } from '../components/BottomNav';
import type { PaymentMethodId } from '../services/paymentMethodStrategy';
import type { PickedStore } from '../services/pabiliDraft';
import type { Establishment } from '../services/establishments';
import type { LegalDocumentId } from '../constants/legalDocuments';

export interface UserData {
  id: string | number;
  username: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  birthdate?: string | null;
  email?: string;
  phone?: string;
  /** How the account was created: a Google sign-up has no password. Absent from servers before 2026-10-09. */
  signUpMethod?: 'password' | 'google';
  googleId?: string | null;
  phoneVerified?: boolean;
  phoneVerifiedAt?: string | null;
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
  /**
   * Was a raw `'COD' | 'GCash' | 'Bank Transfer'` union — a second, mismatched
   * vocabulary alongside the canonical `PaymentMethodId` the chat payment
   * modal actually submits (`"GCASH"`, not `"GCash"`). Unified on the one the
   * backend's catalogue matches.
   */
  paymentMethod: PaymentMethodId;
  proofUrl?: string;
  status: string;
  createdAt: number;
}

export type RootStackParamList = {
  OnboardingLocation: undefined;
  OnboardingAuthChoice: {
    detectedLocation?: { latitude: number; longitude: number; address?: string | null };
  };
  Login: undefined;
  Register: {
    detectedLocation?: { latitude: number; longitude: number; address?: string | null };
  } | undefined;
  ForgotPassword: undefined;
  GooglePhoneSetup: {
    googleIdToken: string;
    email: string;
    firstName: string;
    lastName: string;
    googleUid: string;
    avatar?: string | null;
    detectedLocation?: { latitude: number; longitude: number; address?: string | null };
  };
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
  CustomerPortal: {
    user: UserData;
    initialTab?: PortalTab;
    focusedErrandId?: string;
    triggerOnboardingLocationSetup?: boolean;
    detectedLocation?: { latitude: number; longitude: number; address?: string | null };
  };
  ServiceList: { user: UserData };
  ErrandForm: {
    user: UserData;
    selectedServices?: string[];
    // Carried by "Order again" on a delivered errand in My Errands. Holds the
    // previous errand's categories so the form opens with them already picked;
    // the customer still confirms items, address and payment, so a reorder is
    // never placed by a single tap.
    reorderFrom?: { errandId: string; categories: string; storeNames: string[] };
    /** Which list step 1 opens on. Home's "Stores near you" opens "location". */
    initialMode?: 'merchant' | 'location';
  };
  // The store hub (PabiliHubScreen). The name predates the split into hub,
  // store editor and review, and is kept so ErrandForm and HomeTab open it as before.
  // `stores` is set when the customer picked real stores in step 1's "Location"
  // list; `selectedCats` then holds their keys.
  ErrandItems: { user: UserData; selectedCats: string[]; stores?: PickedStore[] };
  // "See all popular stores" on Home: up to 20 shops near the customer, paged and sortable.
  // `selected`: the store tapped on Home's row, already picked (2026-10-11).
  PopularStores: { user: UserData; selected?: Establishment };
  // Home's "Stores near you" row (2026-10-11): its arrow, its See all card and its
  // stores open this, a tapped store already picked (`selected`).
  NearbyStores: { user: UserData; selected?: Establishment };
  MerchantCategoryStores: {
    user: UserData;
    category: { id: number; name: string; description?: string | null };
    selected?: Establishment;
  };
  // Step 1 of a Pabili errand since 2026-10-10: search for 1 to 3 stores, then
  // the Shopping list (ErrandItems). Home's Search button and the bottom bar's "+".
  // "Order again" in My Errands opens it with the past errand's stores picked
  // (services/establishments.ts establishmentsFromStops).
  // A Home category tile opens it on that merchant category's stores (`category`).
  StoreSearch: {
    user: UserData;
    reorderFrom?: { errandId: string; stores: Establishment[] };
    category?: { id: number; name: string };
  };
  PabiliStoreEditor: { user: UserData; category: string };
  PabiliReview: { user: UserData };
  Checkout: { user: UserData; errandPayload: ErrandPayload };
  ErrandConfirmation: { user: UserData; finalErrand: FinalErrand };
  WaitingForDispatcher: { user: UserData; errandId: string; finalErrand?: FinalErrand };
  CustomerChat: { user: UserData; errandId: string; initialStatus?: string };
  ActiveChats: { user: UserData };
  CustomerLocation: {
    user: UserData;
    initialMode?: 'list' | 'wizard';
    initialStep?: 1 | 2;
    detectedLocation?: { latitude: number; longitude: number; address?: string | null };
  };
  // `focusField`: open pointed at one field, from a Home reminder (keyboard on
  // the mobile number, the date picker for the birthdate).
  EditAccount: { user: UserData; focusField?: 'phone' | 'birthdate' };
  Account: { user?: UserData } | undefined;
  Settings: { user: UserData };
  Notification: { user?: UserData } | undefined;
  ErrandDetails: { user: UserData; errand?: any; errandId?: string };
  // Home's liquid glass button (2026-10-10): the active errands. `errands` is
  // Home's list, shown at once while the screen reads them again.
  ActiveErrands: { user: UserData; errands?: any[] };
  Feedback: { user?: UserData } | undefined;
  // The Terms of Service or the Privacy Policy, full screen. Registered outside
  // the signed-in/signed-out split so onboarding and Settings both reach it.
  LegalDocument: { doc: LegalDocumentId };
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
