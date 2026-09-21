import axios from "axios";

/**
 * Reusable Axios HTTP Client
 * Configured with API base URL and automatic credential inclusion for session cookies.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1",
  withCredentials: true, // Crucial: Transmits connect.sid / sessionId cookie automatically
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest"
  }
});

// Response Interceptor: Standardizes data unwrapping and logs session expirations
api.interceptors.response.use(
  (response) => {
    // Return standard response data envelope
    return response.data;
  },
  (error) => {
    // Extract server error envelope if available
    const customError = {
      message: error.response?.data?.message || error.message || "Network Error",
      code: error.response?.data?.code || "UNKNOWN_ERROR",
      statusCode: error.response?.status || 500,
      errors: error.response?.data?.errors || []
    };

    // If 401 Unauthorized occurs on an authenticated route, client can react accordingly
    if (customError.statusCode === 401 && !window.location.pathname.includes("/login")) {
      console.warn("[Auth Interceptor] Session expired or unauthenticated. Redirect may be required.");
    }

    return Promise.reject(customError);
  }
);

export default api;
