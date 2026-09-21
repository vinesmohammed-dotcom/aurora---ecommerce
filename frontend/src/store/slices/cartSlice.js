import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  itemCount: 0,
  isDrawerOpen: false
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    setCartItemCount: (state, action) => {
      state.itemCount = action.payload;
    },
    toggleCartDrawer: (state) => {
      state.isDrawerOpen = !state.isDrawerOpen;
    },
    setCartDrawer: (state, action) => {
      state.isDrawerOpen = action.payload;
    }
  }
});

export const { setCartItemCount, toggleCartDrawer, setCartDrawer } = cartSlice.actions;
export default cartSlice.reducer;
