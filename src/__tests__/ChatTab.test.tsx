import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.setTimeout(30000);

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('../firebase/config', () => ({
  database: {},
  auth: {},
  app: {},
}));

// Mock hooks
const mockRefresh = jest.fn();
let mockErrandsList: any[] = [];
let mockLoading = false;
let mockError = false;

jest.mock('../hooks/useActiveErrands', () => ({
  useActiveErrands: () => ({
    get errands() {
      return mockErrandsList;
    },
    get loading() {
      return mockLoading;
    },
    get error() {
      return mockError;
    },
    refresh: mockRefresh,
  }),
}));

jest.mock('../hooks/useThemeColor', () => ({
  useThemeColor: () => ({
    isDark: false,
    colors: {
      primary: '#F62459',
      card: '#FFFFFF',
      border: '#E5E7EB',
      textDark: '#1F2937',
      textGray: '#6B7280',
      textLight: '#9CA3AF',
      textMedium: '#4B5563',
      bgApp: '#F9FAFB',
      bgGray: '#F3F4F6',
      borderLight: '#F3F4F6',
      danger: '#EF4444',
    },
  }),
}));

jest.mock('../hooks/useRateConfig', () => ({
  useRateConfig: () => ({
    baseFee: 70,
    rateConfig: { baseFare: 70, perKmRate: 15 },
  }),
}));

jest.mock('firebase/database', () => ({
  ref: jest.fn(),
  onValue: jest.fn(() => jest.fn()),
  query: jest.fn(),
  limitToLast: jest.fn(),
}));

import ChatTab from '../screens/portal/ChatTab';

describe('ChatTab (Messages & Support Screen)', () => {
  const mockUser = {
    id: 'cust-123',
    firstName: 'Juan',
    username: 'juandelacruz',
  };

  const mockNavigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockErrandsList = [];
    mockLoading = false;
    mockError = false;
  });

  it('renders header without left icon, search input, and filter capsules', async () => {
    mockErrandsList = [
      { id: 'errand-1', status: 'PENDING', category: 'Fast Food & Restaurant' },
      { id: 'errand-2', status: 'IN_TRANSIT', category: 'Medicine & Pharmacy' },
    ];

    const res: any = await render(<ChatTab user={mockUser} navigation={mockNavigation} />);

    expect(res.getByText('Messages & Support')).toBeTruthy();
    expect(res.getByText('Chat live with dispatchers or tap (?) for customer assistance and FAQs.')).toBeTruthy();
    expect(res.queryByText('Need Dispatcher Assistance?')).toBeNull();
    expect(res.getByTestId('chat-search-input')).toBeTruthy();
    expect(res.getByTestId('chat-filter-ALL')).toBeTruthy();
    expect(res.getByTestId('chat-filter-PENDING')).toBeTruthy();
    expect(res.getByTestId('chat-filter-IN_TRANSIT')).toBeTruthy();
  });

  it('filters active chats when typing into the search bar', async () => {
    mockErrandsList = [
      { id: 'SGO-FOOD99', status: 'PENDING', category: 'Fast Food & Restaurant' },
      { id: 'SGO-MEDS88', status: 'ASSIGNED', category: 'Medicine & Pharmacy' },
    ];

    const res: any = await render(<ChatTab user={mockUser} navigation={mockNavigation} />);

    expect(res.getByText('Fast Food & Restaurant')).toBeTruthy();
    expect(res.getByText('Medicine & Pharmacy')).toBeTruthy();

    const searchInput = res.getByTestId('chat-search-input');
    fireEvent.changeText(searchInput, 'FOOD');

    await waitFor(() => {
      expect(res.queryByText('Medicine & Pharmacy')).toBeNull();
      expect(res.getByText('Fast Food & Restaurant')).toBeTruthy();
    });
  });

  it('filters active chats when pressing status tabs', async () => {
    mockErrandsList = [
      { id: 'SGO-FOOD99', status: 'PENDING', category: 'Fast Food & Restaurant' },
      { id: 'SGO-MEDS88', status: 'IN_TRANSIT', category: 'Medicine & Pharmacy' },
    ];

    const res: any = await render(<ChatTab user={mockUser} navigation={mockNavigation} />);

    const inTransitTab = res.getByTestId('chat-filter-IN_TRANSIT');
    fireEvent.press(inTransitTab);

    await waitFor(() => {
      expect(res.queryByText('Fast Food & Restaurant')).toBeNull();
      expect(res.getByText('Medicine & Pharmacy')).toBeTruthy();
    });
  });

  it('renders empty state card with CTA when there are no active chats', async () => {
    mockErrandsList = [];

    const res: any = await render(<ChatTab user={mockUser} navigation={mockNavigation} />);

    expect(res.getByText('No Active Errand Chats')).toBeTruthy();
    const newErrandBtn = res.getByTestId('empty-request-errand-btn');
    expect(newErrandBtn).toBeTruthy();

    fireEvent.press(newErrandBtn);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ServiceList', { user: mockUser });
  });

  it('navigates to customer chat when clicking an errand channel row', async () => {
    mockErrandsList = [
      { id: 'SGO-12345', status: 'ASSIGNED', category: 'Fast Food & Restaurant' },
    ];

    const res: any = await render(<ChatTab user={mockUser} navigation={mockNavigation} />);

    const channelRow = res.getByTestId('chat-channel-row-SGO-12345');
    expect(channelRow).toBeTruthy();

    fireEvent.press(channelRow);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('CustomerChat', {
      user: mockUser,
      errandId: 'SGO-12345',
      initialStatus: 'ASSIGNED',
    });
  });
});
