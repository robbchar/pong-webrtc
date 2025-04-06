import { describe, it, expect } from 'vitest';
import connectionReducer, { setConnectionStatus, setPeerId, setError, clearError } from './connectionSlice';
import type { ConnectionStatus } from './connectionSlice';

describe('connectionSlice', () => {
  const initialState = {
    status: 'disconnected' as ConnectionStatus,
    peerId: null,
    error: null,
  };

  it('should handle initial state', () => {
    expect(connectionReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  describe('setConnectionStatus', () => {
    it('should update connection status', () => {
      const actual = connectionReducer(initialState, setConnectionStatus('connected'));
      expect(actual.status).toEqual('connected');
    });

    it('should handle all connection statuses', () => {
      const statuses: ConnectionStatus[] = ['disconnected', 'connecting', 'connected'];
      statuses.forEach(status => {
        const actual = connectionReducer(initialState, setConnectionStatus(status));
        expect(actual.status).toEqual(status);
      });
    });
  });

  describe('setPeerId', () => {
    it('should set peer ID', () => {
      const peerId = 'test-peer-id';
      const actual = connectionReducer(initialState, setPeerId(peerId));
      expect(actual.peerId).toEqual(peerId);
    });

    it('should handle empty peer ID', () => {
      const peerId = '';
      const actual = connectionReducer(initialState, setPeerId(peerId));
      expect(actual.peerId).toEqual(peerId);
    });
  });

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