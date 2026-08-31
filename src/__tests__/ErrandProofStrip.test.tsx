import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ErrandProofStrip from '../components/ErrandProofStrip';
import { apiClient } from '../services/apiClient';

jest.mock('../services/apiClient', () => ({
  apiClient: { get: jest.fn() },
}));

const mockGet = apiClient.get as jest.Mock;

const RECEIPT = {
  id: 1,
  kind: 'RECEIPT',
  capturedAt: '2026-08-25T02:00:00Z',
  verified: true,
  declaredTotal: null,
  extraction: { confirmedTotal: 994, extractedTotal: 994 },
};

const SARI_SARI = {
  id: 2,
  kind: 'NO_RECEIPT',
  capturedAt: '2026-08-25T02:10:00Z',
  verified: false,
  declaredTotal: 176,
  extraction: null,
};

const HANDOVER = {
  id: 3,
  kind: 'PROOF_OF_DELIVERY',
  capturedAt: '2026-08-25T02:40:00Z',
  verified: true,
  declaredTotal: null,
  extraction: null,
};

const draw = async (proofs: unknown[]) => {
  mockGet.mockResolvedValueOnce({ data: proofs });
  return (await render(<ErrandProofStrip errandId="ERR-1" />)) as any;
};

beforeEach(() => jest.clearAllMocks());

describe("the photos a customer can see", () => {
  it('shows what the rider photographed', async () => {
    const res = await draw([RECEIPT, SARI_SARI, HANDOVER]);

    await waitFor(() => expect(res.getByTestId('errand-proof-strip')).toBeTruthy());
    expect(res.getByTestId('proof-1')).toBeTruthy();
    expect(res.getByTestId('proof-2')).toBeTruthy();
    expect(res.getByTestId('proof-3')).toBeTruthy();
  });

  it('names each kind so a handover is not mistaken for a receipt', async () => {
    const res = await draw([RECEIPT, HANDOVER]);

    await waitFor(() => expect(res.getByText('Receipt')).toBeTruthy());
    expect(res.getByText('Handover')).toBeTruthy();
  });

  it('says plainly when the amount is only the rider\'s word', async () => {
    // A sari-sari purchase has no receipt behind it. A customer paying for those
    // goods should know which purchase that was.
    const res = await draw([RECEIPT, SARI_SARI]);

    await waitFor(() => expect(res.getByTestId('proof-2-unverified')).toBeTruthy());
    // And a read receipt carries no such warning.
    expect(res.queryByTestId('proof-1-unverified')).toBeNull();
  });

  it('shows the declared amount for a receiptless purchase', async () => {
    const res = await draw([SARI_SARI]);
    await waitFor(() => expect(res.getByText('₱176')).toBeTruthy());
  });

  it('shows the confirmed total for a read receipt', async () => {
    const res = await draw([RECEIPT]);
    await waitFor(() => expect(res.getByText('₱994')).toBeTruthy());
  });

  it('shows no amount on a handover, because there is none', async () => {
    const res = await draw([HANDOVER]);
    await waitFor(() => expect(res.getByText('Handover')).toBeTruthy());
    expect(res.queryByText(/₱/)).toBeNull();
  });

  it('fetches the bytes only when a photo is tapped', async () => {
    const res = await draw([RECEIPT]);
    await waitFor(() => expect(res.getByTestId('proof-1')).toBeTruthy());

    // The list omits every blob on purpose; nothing heavy is fetched until the
    // customer asks to look at one.
    expect(mockGet).toHaveBeenCalledTimes(1);

    mockGet.mockResolvedValueOnce({ data: { mimeType: 'image/jpeg', imageData: 'AAAA' } });
    await fireEvent.press(res.getByTestId('proof-1'));

    await waitFor(() =>
      expect(mockGet).toHaveBeenLastCalledWith('/errands/ERR-1/proof-images/1')
    );
  });

  it('renders nothing at all when the errand has no photos', async () => {
    const res = await draw([]);
    await waitFor(() => expect(res.queryByTestId('errand-proof-strip')).toBeNull());
  });

  it('stays silent when the request is refused', async () => {
    // An older errand, or one the caller may not read. Neither is worth an error
    // banner on a receipt the customer opened to look at their fees.
    mockGet.mockRejectedValueOnce(new Error('403'));
    const res: any = await render(<ErrandProofStrip errandId="ERR-OTHER" />);

    await waitFor(() => expect(res.queryByTestId('errand-proof-strip')).toBeNull());
  });
});
