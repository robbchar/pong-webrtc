import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { SignalingStatus } from "@/types/signalingTypes";

export type ConnectionStatus =
  | SignalingStatus
  | "peerConnected"
  | "peerDisconnected";

export type DataChannelStatus = "opening" | "open" | "closing" | "closed";

export type PlayerSide = "left" | "right";

export interface ConnectionState {
  signalingStatus: SignalingStatus; // Track WS connection
  peerStatus: "idle" | "connecting" | "connected" | "failed" | "disconnected";
  peerId: string | null;
  isHost: boolean | null;
  playerSide: PlayerSide | null;
  gameId: string | null;
  dataChannelStatus: "closed" | "connecting" | "open" | "error";
  error: string | null;
  selfStartIntent: boolean;
  opponentStartIntent: boolean;
  debugOverlayEnabled: boolean;
}

const derivePlayerSide = (isHost: boolean | null): PlayerSide | null => {
  if (isHost === true) {
    return "left";
  }
  if (isHost === false) {
    return "right";
  }
  return null;
};

const initialState: ConnectionState = {
  signalingStatus: SignalingStatus.CLOSED,
  peerStatus: "idle",
  peerId: null,
  isHost: null,
  playerSide: null,
  gameId: null,
  dataChannelStatus: "closed",
  error: null,
  selfStartIntent: false,
  opponentStartIntent: false,
  debugOverlayEnabled: false,
};

const connectionSlice = createSlice({
  name: "connection",
  initialState,
  reducers: {
    setSignalingStatus: (state, action: PayloadAction<SignalingStatus>) => {
      state.signalingStatus = action.payload;
    },
    setPeerConnecting: (state) => {
      state.peerStatus = "connecting";
    },
    setPeerConnected: (
      state,
      action: PayloadAction<{ peerId: string; isHost: boolean }>,
    ) => {
      state.peerId = action.payload.peerId;
      state.isHost = action.payload.isHost;
      state.playerSide = derivePlayerSide(action.payload.isHost);
      state.peerStatus = "connected";
      state.error = null;
      state.opponentStartIntent = false;
      state.selfStartIntent = false;
    },
    setPeerDisconnected: (state) => {
      state.peerId = null;
      state.isHost = false;
      state.playerSide = null;
      state.peerStatus = "disconnected";
      state.dataChannelStatus = "closed";
      state.selfStartIntent = false;
      state.opponentStartIntent = false;
    },
    setPeerFailed: (state) => {
      state.peerStatus = "failed";
      state.dataChannelStatus = "closed";
    },
    setDataChannelStatus: (
      state,
      action: PayloadAction<ConnectionState["dataChannelStatus"]>,
    ) => {
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
      state.playerSide = derivePlayerSide(action.payload);
    },
    setSelfStartIntent: (state, action: PayloadAction<boolean>) => {
      state.selfStartIntent = action.payload;
    },
    setOpponentStartIntent: (state, action: PayloadAction<boolean>) => {
      state.opponentStartIntent = action.payload;
    },
    toggleDebugOverlay: (state) => {
      state.debugOverlayEnabled = !state.debugOverlayEnabled;
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
  setSelfStartIntent,
  setOpponentStartIntent,
  toggleDebugOverlay,
} = connectionSlice.actions;
export default connectionSlice.reducer;
