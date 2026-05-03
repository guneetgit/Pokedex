import axios from 'axios';
import Constants from 'expo-constants';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from '../utils/tokenStorage';

// Dynamically grab Mac IP for Expo (same as your AuthContext)
// Hardcoding home IP because Constants.expoConfig might not resolve correctly
const BACKEND_URL = `http://192.168.29.199:3002`;

export const apiClient = axios.create({
  baseURL: BACKEND_URL, 
});

// 1. Add Access Token to all outgoing requests
apiClient.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const refreshSession = async (): Promise<string | null> => {
  try {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    console.log('🔄 Attempting to refresh access token...');
    const response = await axios.post(`${BACKEND_URL}/auth/refresh`, {
      refreshToken: refreshToken
    });

    const newAccessToken = response.data.token;
    const newRefreshToken = response.data.refreshToken || refreshToken;

    await saveTokens(newAccessToken, newRefreshToken);
    console.log('✅ Access token refreshed successfully!');
    return newAccessToken;
  } catch (error) {
    console.error('❌ Session expired or refresh failed. Please log in again.', error);
    await clearTokens();
    throw error;
  }
};

// 2. Catch 401 errors and attempt Silent Refresh
apiClient.interceptors.response.use(
  (response) => response, 
  async (error) => {
    const originalRequest = error.config;

    // If the error is 401 (Unauthorized) and we haven't already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Prevent infinite loops

      try {
        const newAccessToken = await refreshSession();

        // Update the failed request with the new token and retry it
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);

      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
