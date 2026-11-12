import React from 'react';
import { render } from '@testing-library/react-native';
import RiderToStorePanel from '../components/RiderToStorePanel';

/**
 * What the customer sees while the rider is shopping: ETA and distance to the
 * store, and no map. The map opens with the delivery run.
 */
const draw = async (props: Partial<React.ComponentProps<typeof RiderToStorePanel>> = {}) =>
  (await render(
    <RiderToStorePanel
      storeName="Julie's Bakeshop"
      storesLeft={1}
      etaSeconds={54 * 60}
      distanceMeters={44800}
      atStore={false}
      riderLocated
      {...props}
    />
  )) as any;

describe('RiderToStorePanel', () => {
  it('says where the rider is going, how long, and how far', async () => {
    const view = await draw();
    expect(view.getByText("Your rider is heading to Julie's Bakeshop")).toBeTruthy();
    expect(view.getByTestId('store-distance').props.children).toBe('44.8 km');
    expect(view.getByTestId('store-eta')).toBeTruthy();
  });

  it('counts the stores still to come', async () => {
    const view = await draw({ storesLeft: 3 });
    expect(view.getByText("Your rider is heading to Julie's Bakeshop, then 2 more stores")).toBeTruthy();
  });

  it('says the rider is buying once they are inside, with no travel numbers', async () => {
    const view = await draw({ atStore: true });
    expect(view.getByText("Your rider is buying your items at Julie's Bakeshop")).toBeTruthy();
    expect(view.queryByTestId('store-eta')).toBeNull();
  });

  it('waits honestly before the rider can be located', async () => {
    const view = await draw({ riderLocated: false });
    expect(view.getByText('Waiting for your rider')).toBeTruthy();
    expect(view.queryByTestId('store-eta')).toBeNull();
  });

  it('promises the map and a notification for the delivery run', async () => {
    const view = await draw();
    expect(view.getByText(/live map opens when your rider is on the way to you/)).toBeTruthy();
  });
});
