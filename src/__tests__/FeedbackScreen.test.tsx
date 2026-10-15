import React from 'react';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react-native';

const mockPost = jest.fn();
const mockUser = {
  id: 12,
  username: 'juandelacruz',
  firstName: 'Juan',
  lastName: 'Dela Cruz',
  email: 'juan@example.com',
  phone: '+639171234567',
};

jest.mock('../services/apiClient', () => ({
  apiClient: { post: (...args: any[]) => mockPost(...args) },
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock('expo-device', () => ({
  modelName: 'Samsung Galaxy A04',
  designName: 'a04',
}));

jest.mock('expo-constants', () => ({
  expoConfig: { version: '1.0.0' },
}));

import FeedbackScreen from '../screens/FeedbackScreen';

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

beforeEach(() => {
  mockPost.mockReset();
  navigation.goBack.mockReset();
  navigation.navigate.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('FeedbackScreen', () => {
  it('renders all form fields, categories, and initial 0-star prompt', async () => {
    const res: any = await render(<FeedbackScreen navigation={navigation as any} route={{} as any} />);

    expect(res.getByText('Help & Feedback')).toBeTruthy();
    expect(res.getByText('Your Voice Shapes Sugo')).toBeTruthy();
    expect(res.getByText('Bug Report')).toBeTruthy();
    expect(res.getByText('Feature Idea')).toBeTruthy();
    expect(res.getByText('Rider & Delivery')).toBeTruthy();
    expect(res.getByText('App Usability')).toBeTruthy();
    expect(res.getByText('General')).toBeTruthy();

    expect(res.getByTestId('feedback-subject-input')).toBeTruthy();
    expect(res.getByTestId('feedback-message-input')).toBeTruthy();
    expect(res.getByTestId('feedback-submit-button')).toBeTruthy();

    // Reset 0-star prompt and friendly diagnostics copy
    expect(res.getByText('Tap a star to rate your experience')).toBeTruthy();
    expect(res.getByText('Include technical diagnostics')).toBeTruthy();
    expect(res.getByText('Helps our engineering team identify and solve app issues faster.')).toBeTruthy();
  });

  it('notifies the user to leave a star rating before submitting', async () => {
    const res: any = await render(<FeedbackScreen navigation={navigation as any} route={{} as any} />);

    const submitBtn = await res.findByTestId('feedback-submit-button');
    await fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(res.getByText('Please select a star rating for your experience.')).toBeTruthy();
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('validates empty subject and message after rating is selected', async () => {
    const res: any = await render(<FeedbackScreen navigation={navigation as any} route={{} as any} />);

    // Select 4-star rating
    const starBtn = await res.findByTestId('feedback-star-4');
    await fireEvent.press(starBtn);

    const submitBtn = await res.findByTestId('feedback-submit-button');
    await fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(res.getByText('Please provide a short summary of your feedback.')).toBeTruthy();
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('updates category and star rating when tapped', async () => {
    const res: any = await render(<FeedbackScreen navigation={navigation as any} route={{} as any} />);

    // Tap Feature Idea category
    const catBtn = await res.findByTestId('feedback-category-FEATURE_REQUEST');
    await fireEvent.press(catBtn);

    // Tap 3-star rating
    const starBtn = await res.findByTestId('feedback-star-3');
    await fireEvent.press(starBtn);

    await waitFor(() => {
      expect(res.getByText('Average · Works, but can improve')).toBeTruthy();
    });
  });

  it('submits feedback successfully and displays reference ticket without exposing developer email', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        success: true,
        refCode: 'FB-261009-8821',
        message: 'Feedback received successfully',
      },
    });

    const res: any = await render(<FeedbackScreen navigation={navigation as any} route={{} as any} />);

    // Tap 5-star rating
    const starBtn = await res.findByTestId('feedback-star-5');
    await fireEvent.press(starBtn);

    const subjectInput = await res.findByTestId('feedback-subject-input');
    const messageInput = await res.findByTestId('feedback-message-input');
    const emailInput = await res.findByTestId('feedback-email-input');
    const submitBtn = await res.findByTestId('feedback-submit-button');

    // Verify contact email starts empty
    expect(emailInput.props.value).toBe('');

    await fireEvent.changeText(subjectInput, 'Map Pinpoint GPS Lag');
    await fireEvent.changeText(
      messageInput,
      'When picking a store in Tacurong City, the GPS pinpoint took 4 seconds to settle.'
    );
    await fireEvent.changeText(emailInput, 'juan@example.com');

    await fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/feedback',
        expect.objectContaining({
          category: 'BUG_REPORT',
          rating: 5,
          subject: 'Map Pinpoint GPS Lag',
          message: 'When picking a store in Tacurong City, the GPS pinpoint took 4 seconds to settle.',
          contactEmail: 'juan@example.com',
          contactPhone: '+639171234567',
          deviceModel: 'Samsung Galaxy A04',
        })
      );
    });

    const successTitle = await res.findByText('Feedback Submitted!');
    expect(successTitle).toBeTruthy();
    expect(res.getByText('FB-261009-8821')).toBeTruthy();
    expect(
      res.getByText('Your review has been directly dispatched to our engineering team.')
    ).toBeTruthy();

    // Verify personal developer email is completely absent from customer screen
    expect(res.queryByText(/aljayveeversola@gmail\.com/i)).toBeNull();

    // Press Done button
    const doneBtn = await res.findByTestId('feedback-done-button');
    await fireEvent.press(doneBtn);
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('shows humanized error when API post fails', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network disconnected'));

    const res: any = await render(<FeedbackScreen navigation={navigation as any} route={{} as any} />);

    // Tap 4-star rating
    const starBtn = await res.findByTestId('feedback-star-4');
    await fireEvent.press(starBtn);

    const subjectInput = await res.findByTestId('feedback-subject-input');
    const messageInput = await res.findByTestId('feedback-message-input');
    const submitBtn = await res.findByTestId('feedback-submit-button');

    await fireEvent.changeText(subjectInput, 'Cannot checkout order');
    await fireEvent.changeText(messageInput, 'The submit button did not respond.');

    await fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(res.getByText(/We couldn't connect to our services|Network error|Something went wrong/i)).toBeTruthy();
    });
  });
});
