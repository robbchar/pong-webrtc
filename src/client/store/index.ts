import { configureStore } from '@reduxjs/toolkit';
import gameReducer from './slices/gameSlice';
import connectionReducer from './slices/connectionSlice';

export const store = configureStore({
  reducer: {
    game: gameReducer,
    connection: connectionReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 