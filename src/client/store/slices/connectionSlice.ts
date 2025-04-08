import { createSlice, PayloadAction } from '@reduxjs/toolkit';
// import { SignalingStatus } from '@/services/signalingService'; // Old import
import { SignalingStatus } from '@/types/signalingTypes'; // Import from new file

// Extend connection status to include signaling states
export type ConnectionStatus = SignalingStatus | 'peerConnected' | 'peerDisconnected';

export interface ConnectionState {
  signalingStatus: SignalingStatus; // Track WS connection
  peerStatus: 'idle' | 'connected' | 'disconnected'; // Track peer connection
  peerId: string | null;
  isHost: boolean; // Are we the one initiating the WebRTC offer?
  error: string | null;
}

const initialState: ConnectionState = {
  signalingStatus: SignalingStatus.CLOSED,
  peerStatus: 'idle',
  peerId: null,
  isHost: false,
  error: null,
};

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    setSignalingStatus: (state, action: PayloadAction<SignalingStatus>) => {
      state.signalingStatus = action.payload;
    },
    setPeerConnected: (state, action: PayloadAction<{ peerId: string; isHost: boolean }>) => {
      state.peerId = action.payload.peerId;
      state.isHost = action.payload.isHost;
      state.peerStatus = 'connected';
      state.error = null; // Clear error on successful connection
    },
    setPeerDisconnected: (state) => {
      state.peerId = null;
      state.isHost = false;
      state.peerStatus = 'disconnected';
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    // We might add specific peer connection status updates later (e.g., connecting, failed)
  },
});

export const {
  setSignalingStatus,
  setPeerConnected,
  setPeerDisconnected,
  setError,
  clearError,
} = connectionSlice.actions;
export default connectionSlice.reducer; 