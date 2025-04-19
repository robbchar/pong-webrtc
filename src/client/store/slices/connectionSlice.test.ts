import { describe, it, expect } from 'vitest';
import connectionReducer, { 
  setSignalingStatus, 
  setPeerConnected, 
  setPeerDisconnected, 
  setError, 
  clearError 
} from './connectionSlice';
import type { ConnectionState } from './connectionSlice';
import { SignalingStatus } from '@/types/signalingTypes';

// Define the correct initial state structure, explicitly casting peerStatus
const initialState: ConnectionState = {
  signalingStatus: SignalingStatus.CLOSED,
  peerStatus: 'idle' as const,
  dataChannelStatus: 'closed' as const,
  peerId: null,
  isHost: null,
  gameId: null,
  error: null,
};

describe('connectionSlice', () => {

  it('should handle initial state', () => {
    // Use the correctly defined initialState for comparison
    expect(connectionReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  describe('setSignalingStatus', () => {
    it('should update signaling status', () => {
      const actual = connectionReducer(initialState, setSignalingStatus(SignalingStatus.OPEN));
      expect(actual.signalingStatus).toEqual(SignalingStatus.OPEN);
    });

    it('should handle all signaling statuses', () => {
      const statuses: SignalingStatus[] = [
        SignalingStatus.CONNECTING,
        SignalingStatus.OPEN,
        SignalingStatus.CLOSING,
        SignalingStatus.CLOSED,
      ];
      statuses.forEach(status => {
        const actual = connectionReducer(initialState, setSignalingStatus(status));
        expect(actual.signalingStatus).toEqual(status);
      });
    });
  });

  describe('setPeerConnected', () => {
    it('should set peer ID, host status, and peer status', () => {
      const payload = { peerId: 'test-peer-123', isHost: true };
      const actual = connectionReducer(initialState, setPeerConnected(payload));
      expect(actual.peerId).toEqual(payload.peerId);
      expect(actual.isHost).toEqual(payload.isHost);
      expect(actual.peerStatus).toEqual('connected' as const);
      expect(actual.error).toBeNull(); // Should clear errors
    });
  });

  describe('setPeerDisconnected', () => {
    it('should clear peer ID, host status, and set peer status to disconnected', () => {
      const connectedState = {
        ...initialState,
        peerStatus: 'connected' as const,
        peerId: 'test-peer-123',
        isHost: true,
      };
      const actual = connectionReducer(connectedState, setPeerDisconnected());
      expect(actual.peerId).toBeNull();
      expect(actual.isHost).toBe(false);
      expect(actual.peerStatus).toEqual('disconnected' as const);
    });
  });

  // Keep setError and clearError tests as they are compatible
  describe('setError', () => {
    it('should set error message', () => {
      const error = 'Connection failed';
      const actual = connectionReducer(initialState, setError(error));
      expect(actual.error).toEqual(error);
    });

    it('should handle empty error message', () => {
      const error = '';
      const actual = connectionReducer(initialState, setError(error));
      expect(actual.error).toEqual(error);
    });
  });

  describe('clearError', () => {
    it('should clear error message', () => {
      const stateWithError = {
        ...initialState,
        error: 'Connection failed',
      };
      const actual = connectionReducer(stateWithError, clearError());
      expect(actual.error).toBeNull();
    });

    it('should not change state when no error exists', () => {
      const actual = connectionReducer(initialState, clearError());
      expect(actual).toEqual(initialState);
    });
  });
}); 