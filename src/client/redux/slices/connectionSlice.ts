import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected';
  isHost: boolean;
  error: string | null;
}

const initialState: ConnectionState = {
  status: 'disconnected',
  isHost: false,
  error: null,
};

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    setConnectionStatus: (state, action: PayloadAction<ConnectionState['status']>) => {
      state.status = action.payload;
    },
    setIsHost: (state, action: PayloadAction<boolean>) => {
      state.isHost = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      if (action.payload) {
        state.status = 'disconnected';
      }
    },
    resetConnection: () => initialState,
  },
});

export const {
  setConnectionStatus,
  setIsHost,
  setError,
  resetConnection,
} = connectionSlice.actions;

export default connectionSlice.reducer; 