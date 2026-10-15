import React from 'react';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';
import ErrandDetailsScreen from '../screens/ErrandDetailsScreen';
import { apiClient } from '../services/apiClient';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: ({ children }: any) => children,
    useSafeAreaInsets: () => inset,
  };
});

jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(() => Promise.resolve({ data: null })),
  },
}));

jest.mock('../components/FeeBreakdownCard', () => {
  return function MockFeeBreakdownCard() {
    const { View, Text } = require('react-native');
    return (
      <View testID="mock-fee-breakdown-card">
        <Text>Mock Fee Breakdown</Text>
      </View>
    );
  };
});

jest.mock('../components/ErrandProofStrip', () => {
  return function MockErrandProofStrip() {
    const { View, Text } = require('react-native');
    return (
      <View testID="mock-errand-proof-strip">
        <Text>Mock Errand Proof</Text>
      </View>
    );
  };
});

const mockNavigation: any = {
  goBack: jest.fn(),
  navigate: jest.fn(),
};

const mockUser = {
  id: 1,
  username: 'johndoe',
  firstName: 'John',
  lastName: 'Doe',
};

const mockActiveErrand = {
  id: 42,
  orderId: 'SGO-2E2246',
  status: 'PENDING',
  categories: 'Supermarket & Grocery',
  items: [
    { name: 'Fresh Milk', quantity: 2 },
    { name: 'Loaf of Bread', quantity: 1 },
  ],
  deliveryAddress: 'Isulan - Tacurong City Road, City of Tacurong, SOCCSKSARGEN',
  paymentMethod: 'COD',
  deliveryFee: 70,
  totalCost: 150,
  grandTotal: 220,
  createdAt: new Date().toISOString(),
};

describe('ErrandDetailsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without "#" in the Errand ID and displays clean typography', async () => {
    const res: any = await render(
      <ErrandDetailsScreen
        route={{
          key: 'ErrandDetails-1',
          name: 'ErrandDetails',
          params: { user: mockUser, errand: mockActiveErrand, errandId: 'SGO-2E2246' },
        } as any}
        navigation={mockNavigation}
      />
    );

    // Verified: Displays "Errand SGO-2E2246" without "#"
    expect(res.getByText('Errand SGO-2E2246')).toBeTruthy();
    expect(res.queryByText('Errand #SGO-2E2246')).toBeNull();
    expect(res.getByText('Transaction Summary')).toBeTruthy();

    // Section headers
    expect(res.getByText('Current Status')).toBeTruthy();
    expect(res.getByText('Items Requested')).toBeTruthy();
    expect(res.getByText('Delivery Destination')).toBeTruthy();
    expect(res.getByText('Assigned Personnel')).toBeTruthy();
    expect(res.getByText('Payment & Fees')).toBeTruthy();

    // Item contents
    expect(res.getByText('Fresh Milk')).toBeTruthy();
    expect(res.getByText('Loaf of Bread')).toBeTruthy();
    expect(res.getByText(/Isulan - Tacurong City Road/)).toBeTruthy();
  });

  it('invokes navigation.goBack() when tapping the back button', async () => {
    const res: any = await render(
      <ErrandDetailsScreen
        route={{
          key: 'ErrandDetails-1',
          name: 'ErrandDetails',
          params: { user: mockUser, errand: mockActiveErrand, errandId: 'SGO-2E2246' },
        } as any}
        navigation={mockNavigation}
      />
    );

    const backBtn = res.getByTestId('errand-details-back-button');
    fireEvent.press(backBtn);
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('navigates to CustomerChat when tapping "Open Live Chat" for active errand', async () => {
    const res: any = await render(
      <ErrandDetailsScreen
        route={{
          key: 'ErrandDetails-1',
          name: 'ErrandDetails',
          params: { user: mockUser, errand: mockActiveErrand, errandId: 'SGO-2E2246' },
        } as any}
        navigation={mockNavigation}
      />
    );

    const chatBtn = res.getByTestId('open-live-chat-button');
    fireEvent.press(chatBtn);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('CustomerChat', {
      user: mockUser,
      errandId: 'SGO-2E2246',
      initialStatus: 'PENDING',
    });
  });

  it('renders "Back to Errands" button and calls goBack for completed errand', async () => {
    const mockCompletedErrand = {
      ...mockActiveErrand,
      status: 'DELIVERED',
      riderName: 'Juan Rider',
    };

    const res: any = await render(
      <ErrandDetailsScreen
        route={{
          key: 'ErrandDetails-1',
          name: 'ErrandDetails',
          params: { user: mockUser, errand: mockCompletedErrand, errandId: 'SGO-2E2246' },
        } as any}
        navigation={mockNavigation}
      />
    );

    expect(res.queryByTestId('open-live-chat-button')).toBeNull();
    const backToErrandsBtn = res.getByText('Back to Errands');
    expect(backToErrandsBtn).toBeTruthy();
    fireEvent.press(backToErrandsBtn);
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });
});

/**
 * Pull-to-refresh used to swap the list's flat copy for GET /errands/:id's
 * relational one, and the assigned rider went back to "Assigning" (2026-10-10).
 */
describe('ErrandDetailsScreen personnel across a refresh', () => {
  const getMock = apiClient.get as jest.Mock;

  /** As My Errands passes it: /customers/:id/transactions. */
  const listCopy = {
    id: 'SGO-2B37D6',
    orderId: 'SGO-2B37D6',
    status: 'ASSIGNED',
    riderId: 9,
    riderName: 'Juan Dela Cruz',
    paymentMethod: 'GCash / PayMaya',
    totalCost: 220,
    grandTotal: 220,
    categories: 'Ballpen Set',
    createdAt: new Date().toISOString(),
  };

  /** As GET /errands/:id sends the same errand. */
  const serverCopy = {
    id: 'SGO-2B37D6',
    status: 'ASSIGNED',
    riderId: 9,
    rider: { firstName: 'Juan', lastName: 'Dela Cruz', name: 'Juan Dela Cruz' },
    dispatchLogs: [{ dispatcher: { firstName: 'Maria', lastName: 'Santos', name: 'Maria Santos' } }],
    paymentSelection: { paymentMode: { name: 'GCash / PayMaya' } },
    totalCost: 220,
    pabiliDetails: [{ itemName: 'Ballpen Set', quantity: 1 }],
    createdAt: listCopy.createdAt,
  };

  const renderFromList = () =>
    render(
      <ErrandDetailsScreen
        route={{
          key: 'ErrandDetails-2',
          name: 'ErrandDetails',
          params: { user: mockUser, errand: listCopy, errandId: 'SGO-2B37D6' },
        } as any}
        navigation={mockNavigation}
      />
    );

  const line = (res: any, who: 'dispatcher' | 'rider') => within(res.getByTestId(`personnel-${who}`));

  beforeEach(() => {
    getMock.mockReset();
  });

  afterAll(() => {
    getMock.mockImplementation(() => Promise.resolve({ data: null }));
  });

  it('says "Checking..." for the dispatcher until the server copy lands, never "Assigning"', async () => {
    getMock.mockImplementation(() => new Promise(() => {}));
    const res: any = await renderFromList();
    expect(line(res, 'dispatcher').getByText('Checking...')).toBeTruthy();
    expect(line(res, 'rider').getByText('Juan Dela Cruz')).toBeTruthy();
    expect(res.queryByText(/Assigning/i)).toBeNull();
  });

  it('keeps the rider and payment, and names the dispatcher, through a pull-to-refresh', async () => {
    getMock.mockResolvedValue({ data: serverCopy });
    const res: any = await renderFromList();

    await waitFor(() => expect(line(res, 'dispatcher').getByText('Maria Santos')).toBeTruthy());
    expect(getMock).toHaveBeenCalledWith('/errands/SGO-2B37D6');

    // A reprice on the refresh, so the test can tell when its answer has landed.
    getMock.mockResolvedValue({ data: { ...serverCopy, totalCost: 260 } });

    // The customer's pull-down. RN's jest mock renders RefreshControl as a bare
    // RCTRefreshControl host; fireEvent finds onRefresh on the component above it.
    const findRefresh = (node: any): any => {
      if (!node || typeof node !== 'object') return null;
      if (node.type === 'RCTRefreshControl' || typeof node.props?.onRefresh === 'function') return node;
      for (const child of node.children ?? []) {
        const hit = findRefresh(child);
        if (hit) return hit;
      }
      return null;
    };
    await fireEvent(findRefresh(res.container), 'refresh');

    await waitFor(() => expect(res.getByText('₱260.00')).toBeTruthy());
    expect(getMock).toHaveBeenCalledTimes(2);
    expect(line(res, 'dispatcher').getByText('Maria Santos')).toBeTruthy();
    expect(line(res, 'rider').getByText('Juan Dela Cruz')).toBeTruthy();
    expect(res.getByText('GCash / PayMaya')).toBeTruthy();
    expect(res.queryByText(/Assigning/i)).toBeNull();
    expect(res.queryByText('Pending Selection')).toBeNull();
  });

  it('shows the dispatcher choosing again when the rider declined', async () => {
    getMock.mockResolvedValue({ data: { ...serverCopy, status: 'PENDING', riderId: null, rider: null } });
    const res: any = await renderFromList();

    await waitFor(() => expect(line(res, 'rider').getByText('Dispatcher assigning...')).toBeTruthy());
    expect(res.queryByText('Juan Dela Cruz')).toBeNull();
    expect(line(res, 'dispatcher').getByText('Maria Santos')).toBeTruthy();
  });

  it('keeps the list copy on screen when the fetch fails', async () => {
    getMock.mockRejectedValue(Object.assign(new Error('offline'), { isOffline: true }));
    const res: any = await renderFromList();

    await waitFor(() => expect(line(res, 'dispatcher').getByText('Pull down to load')).toBeTruthy());
    expect(line(res, 'rider').getByText('Juan Dela Cruz')).toBeTruthy();
    expect(res.queryByText('Unable to load errand details. Please try again.')).toBeNull();
  });
});
