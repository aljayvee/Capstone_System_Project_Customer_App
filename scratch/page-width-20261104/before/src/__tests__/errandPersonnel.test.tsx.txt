import React from 'react';
import { render } from '@testing-library/react-native';
import {
  dispatcherNameOf,
  mergeErrandDetails,
  paymentMethodOf,
  personnelLines,
  riderNameOf,
} from '../utils/errandPersonnel';
import ErrandDetailsModal from '../components/ErrandDetailsModal';

jest.mock('../components/ErrandProofStrip', () => () => null);
jest.mock('../components/FeeBreakdownCard', () => () => null);

/** What My Errands holds: /customers/:id/transactions, flattened. */
const listCopy = {
  id: 'SGO-2B37D6',
  orderId: 'SGO-2B37D6',
  status: 'ASSIGNED',
  riderId: 9,
  riderName: 'Juan Dela Cruz',
  paymentMethod: 'GCash / PayMaya',
  grandTotal: 220,
  totalCost: 220,
  categories: 'Ballpen Set, Notebooks',
};

/** What GET /errands/:id sends for the same errand: relations, no flat names. */
const serverCopy = {
  id: 'SGO-2B37D6',
  status: 'ASSIGNED',
  riderId: 9,
  rider: { firstName: 'Juan', lastName: 'Dela Cruz', phone: '0917', name: 'Juan Dela Cruz' },
  dispatchLogs: [{ dispatcherId: 7, dispatcher: { firstName: 'Maria', lastName: 'Santos', name: 'Maria Santos' } }],
  paymentSelection: { paymentMode: { name: 'GCash / PayMaya' } },
  totalCost: 220,
  pabiliDetails: [{ itemName: 'Ballpen Set', quantity: 1 }],
};

describe('errandPersonnel readers', () => {
  it('reads the rider from either shape', () => {
    expect(riderNameOf(listCopy)).toBe('Juan Dela Cruz');
    expect(riderNameOf(serverCopy)).toBe('Juan Dela Cruz');
    expect(riderNameOf({ rider: { firstName: 'Ana', lastName: 'Reyes' } })).toBe('Ana Reyes');
  });

  it('prefers the rider relation over a stale flat name', () => {
    // A rider who declined: the server says nobody, the list copy still names them.
    expect(riderNameOf({ riderName: 'Juan Dela Cruz', rider: null })).toBeNull();
  });

  it('reads the dispatcher from the latest dispatch log', () => {
    expect(dispatcherNameOf(serverCopy)).toBe('Maria Santos');
    expect(dispatcherNameOf({ dispatchLogs: [] })).toBeNull();
  });

  it('tells "cannot say" from "nobody"', () => {
    // The list copy carries no dispatcher at all.
    expect(dispatcherNameOf(listCopy)).toBeUndefined();
    expect(riderNameOf({ status: 'PENDING' })).toBeUndefined();
    expect(riderNameOf({ riderName: null })).toBeNull();
  });

  it('reads the confirmed payment mode before any flat method', () => {
    expect(paymentMethodOf(serverCopy)).toBe('GCash / PayMaya');
    expect(paymentMethodOf(listCopy)).toBe('GCash / PayMaya');
    expect(paymentMethodOf({ paymentMethod: 'PENDING', paymentSelection: { paymentMode: { name: 'Cash on Delivery' } } })).toBe(
      'Cash on Delivery'
    );
    expect(paymentMethodOf({ paymentSelection: null })).toBeNull();
  });
});

describe('mergeErrandDetails', () => {
  it('keeps the rider and payment, and adds the dispatcher, when the server copy lands', () => {
    const merged = mergeErrandDetails(listCopy, serverCopy);
    expect(merged.riderName).toBe('Juan Dela Cruz');
    expect(merged.dispatcherName).toBe('Maria Santos');
    expect(merged.paymentMethod).toBe('GCash / PayMaya');
    expect(merged.orderId).toBe('SGO-2B37D6');
    expect(merged.pabiliDetails).toHaveLength(1);
  });

  it('keeps the list payment when the server copy cannot name one', () => {
    const merged = mergeErrandDetails(listCopy, { ...serverCopy, paymentSelection: null });
    expect(merged.paymentMethod).toBe('GCash / PayMaya');
  });

  it('drops a rider who declined', () => {
    const merged = mergeErrandDetails(listCopy, { ...serverCopy, status: 'PENDING', riderId: null, rider: null });
    expect(merged.riderName).toBeNull();
    expect(personnelLines(merged).rider).toEqual({ name: null, waiting: 'Dispatcher assigning...' });
  });

  it('follows a reprice', () => {
    expect(mergeErrandDetails(listCopy, { ...serverCopy, totalCost: 260 }).grandTotal).toBe(260);
  });

  it('is stable when merged twice (a second refresh)', () => {
    const once = mergeErrandDetails(listCopy, serverCopy);
    expect(mergeErrandDetails(once, serverCopy)).toEqual(once);
  });

  it('ignores an empty response', () => {
    expect(mergeErrandDetails(listCopy, null)).toBe(listCopy);
  });
});

describe('personnelLines', () => {
  it('names both people once assigned', () => {
    expect(personnelLines(serverCopy)).toEqual({
      dispatcher: { name: 'Maria Santos', waiting: null },
      rider: { name: 'Juan Dela Cruz', waiting: null },
    });
  });

  it('waits for a dispatcher on an unclaimed errand', () => {
    const lines = personnelLines({ status: 'AVAILABLE', rider: null, dispatchLogs: [] });
    expect(lines.dispatcher.waiting).toBe('Finding a dispatcher...');
    expect(lines.rider.waiting).toBe('Assigned after a dispatcher reviews your request');
  });

  it('shows the dispatcher choosing a rider on a claimed errand', () => {
    const lines = personnelLines({ ...serverCopy, status: 'PENDING', rider: null });
    expect(lines.dispatcher.name).toBe('Maria Santos');
    expect(lines.rider.waiting).toBe('Dispatcher assigning...');
  });

  it('never says "assigning" on a finished errand', () => {
    const lines = personnelLines({ status: 'CANCELLED', rider: null, dispatchLogs: [] });
    expect(lines.dispatcher.waiting).toBe('None assigned');
    expect(lines.rider.waiting).toBe('None assigned');
  });

  it('says "Checking..." only while a fetch could still answer', () => {
    expect(personnelLines(listCopy, true).dispatcher.waiting).toBe('Checking...');
    expect(personnelLines(listCopy, false).dispatcher.waiting).toBe('Pull down to load');
  });
});

describe('ErrandDetailsModal (chat)', () => {
  it('shows the dispatcher, rider and payment from the GET /errands/:id shape', async () => {
    const res: any = await render(
      <ErrandDetailsModal visible errand={serverCopy} user={{ id: 1 }} navigation={{ navigate: jest.fn() }} onClose={jest.fn()} />
    );
    expect(res.getByText('Dispatcher: Maria Santos')).toBeTruthy();
    expect(res.getByText('Rider: Juan Dela Cruz')).toBeTruthy();
    expect(res.getByText('GCash / PayMaya')).toBeTruthy();
    expect(res.queryByText(/Assigning/)).toBeNull();
  });
});
