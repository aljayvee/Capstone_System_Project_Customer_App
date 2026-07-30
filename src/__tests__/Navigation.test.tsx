import React from 'react';
import { render } from '@testing-library/react-native';
import AppNavigator from '../navigation/AppNavigator';

describe('AppNavigator Component', () => {
  it('renders initial route Login screen', async () => {
    const res: any = await render(<AppNavigator />);

    expect(res.getByText('Welcome to Sugo Express')).toBeTruthy();
    expect(res.getByPlaceholderText('Username')).toBeTruthy();
    expect(res.getByPlaceholderText('Password')).toBeTruthy();
  });
});

