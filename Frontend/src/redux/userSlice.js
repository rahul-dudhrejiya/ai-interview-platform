import { createSlice } from "@reduxjs/toolkit";

const userSlice = createSlice({
  name: "user",
  initialState: {
    userData: null,
  },
  reducers: {
    setUserData: (state, action) => {
      state.userData = action.payload;
    },
  },
});

// BUG FIX: action creators live under `userSlice.actions`, not directly
// on `userSlice` itself. `const { setUserData } = userSlice` would have
// given you `undefined`, and every `dispatch(setUserData(...))` call
// in the app would throw "setUserData is not a function".
export const { setUserData } = userSlice.actions;

export default userSlice.reducer;