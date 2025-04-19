import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SignalingStatus } from '@/types/signalingTypes';

export type ConnectionStatus = SignalingStatus | 'peerConnected' | 'peerDisconnected';

export type DataChannelStatus = 'opening' | 'open' | 'closing' | 'closed';

export interface ConnectionState {
  signalingStatus: SignalingStatus; // Track WS connection
  peerStatus: 'idle' | 'connecting' | 'connected' | 'failed' | 'disconnected';
  peerId: string | null;
  isHost: boolean | null;
  gameId: string | null;
  dataChannelStatus: 'closed' | 'connecting' | 'open' | 'error';
  error: string | null;
}

const initialState: ConnectionState = {
  signalingStatus: SignalingStatus.CLOSED,
  peerStatus: 'idle',
  peerId: null,
  isHost: null,
  gameId: null,
  dataChannelStatus: 'closed',
  error: null,
};

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    setSignalingStatus: (state, action: PayloadAction<SignalingStatus>) => {
      state.signalingStatus = action.payload;
    },
    setPeerConnecting: (state) => {
      state.peerStatus = 'connecting';
    },
    setPeerConnected: (state, action: PayloadAction<{ peerId: string; isHost: boolean }>) => {
      state.peerId = action.payload.peerId;
      state.isHost = action.payload.isHost;
      state.peerStatus = 'connected';
      state.error = null;
    },
    setPeerDisconnected: (state) => {
      state.peerId = null;
      state.isHost = false;
      state.peerStatus = 'disconnected';
      state.dataChannelStatus = 'closed';
    },
    setPeerFailed: (state) => {
      state.peerStatus = 'failed';
      state.dataChannelStatus = 'closed';
    },
    setDataChannelStatus: (state, action: PayloadAction<ConnectionState['dataChannelStatus']>) => {
      state.dataChannelStatus = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    setGameId: (state, action: PayloadAction<string>) => {
      state.gameId = action.payload;
    },
    setIsHost: (state, action: PayloadAction<boolean>) => {
      state.isHost = action.payload;
    },
    // We might add specific peer connection status updates later (e.g., connecting, failed)
  },
});

export const {
  setSignalingStatus,
  setPeerConnecting,
  setPeerConnected,
  setPeerDisconnected,
  setPeerFailed,
  setDataChannelStatus,
  setError,
  clearError,
  setGameId,
  setIsHost,
} = connectionSlice.actions;
export default connectionSlice.reducer; 