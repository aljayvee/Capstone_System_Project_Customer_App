import { API_BASE_URL, ENDPOINTS } from '../config/api';

describe('CustomerApp Network & Auth Configuration', () => {
  it('defines API_BASE_URL correctly without trailing slashes', () => {
    expect(API_BASE_URL).toBeDefined();
    expect(typeof API_BASE_URL).toBe('string');
    expect(API_BASE_URL).toMatch(/http:\/\/(10\.0\.2\.2|localhost):5000/);
    expect(API_BASE_URL.endsWith('/')).toBe(false);
  });

  it('defines ENDPOINTS with correct routes without double slashes', () => {
    expect(ENDPOINTS.LOGIN).toBe(`${API_BASE_URL}/api/auth/login`);
    expect(ENDPOINTS.REGISTER).toBe(`${API_BASE_URL}/api/users`);
    expect(ENDPOINTS.CUSTOMER_LOGIN).toBe(`${API_BASE_URL}/api/customers/login`);
    expect(ENDPOINTS.CUSTOMER_REGISTER).toBe(`${API_BASE_URL}/api/customers/register`);
    expect(ENDPOINTS.LOGIN_DIRECT).toBe(`${API_BASE_URL}/login`);
    expect(ENDPOINTS.REGISTER_DIRECT).toBe(`${API_BASE_URL}/register`);
    expect(ENDPOINTS.LOGIN).not.toContain('//api');
  });
});
