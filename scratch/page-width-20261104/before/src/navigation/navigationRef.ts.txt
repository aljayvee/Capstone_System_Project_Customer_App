import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/**
 * Navigation from outside a screen.
 *
 * For the few prompts that float over whatever is open, such as the
 * half-payment prompt, which has to take the customer to one particular chat
 * from anywhere in the app. Screens keep using their own `navigation` prop.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
