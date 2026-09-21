import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import cartReducer from "./slices/cartSlice";
import uiReducer from "./slices/uiSlice";

/**
 * Central Redux Store Configuration
 * Strictly manages global client state (Auth, Cart Count, UI Toasts).
 * Form states and catalog cache are kept local to components/hooks.
 */
export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    ui: uiReducer
  },
  devTools: process.env.NODE_ENV !== "production"
});

export default store;
