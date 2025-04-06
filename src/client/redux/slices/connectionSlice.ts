import { createSlice } from '@reduxjs/toolkit';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface ConnectionState {
  status: ConnectionStatus;
}

const initialState: ConnectionState = {
  status: 'disconnected',
};

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    setConnectionStatus: (state, action: { payload: ConnectionStatus }) => {
      state.status = action.payload;
    },
  },
});

export const { setConnectionStatus } = connectionSlice.actions;
export default connectionSlice.reducer; 