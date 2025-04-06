import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useDeviceOrientation from './useDeviceOrientation';

describe('useDeviceOrientation', () => {
  const mockWindow = {
    innerWidth: 375,
    innerHeight: 812,
    orientation: 0,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  let resizeHandler: (() => void) | null = null;
  let orientationHandler: (() => void) | null = null;

  beforeEach(() => {
    // Define orientation property if it doesn't exist
    if (!('orientation' in window)) {
      Object.defineProperty(window, 'orientation', {
        value: mockWindow.orientation,
        writable: true,
        configurable: true,
      });
    }

    // Mock window properties
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(mockWindow.innerWidth);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(mockWindow.innerHeight);
    vi.spyOn(window, 'orientation', 'get').mockReturnValue(mockWindow.orientation);
    
    // Mock event listeners to capture handlers
    vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'resize') {
        resizeHandler = handler as () => void;
      } else if (event === 'orientationchange') {
        orientationHandler = handler as () => void;
      }
    });
    
    vi.spyOn(window, 'removeEventListener').mockImplementation(mockWindow.removeEventListener);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resizeHandler = null;
    orientationHandler = null;
  });

  it('should initialize with portrait orientation', () => {
    const { result } = renderHook(() => useDeviceOrientation());
    expect(result.current.isPortrait).toBe(true);
    expect(result.current.isLandscape).toBe(false);
    expect(result.current.angle).toBe(0);
  });

  it('should detect landscape orientation', () => {
    // Mock landscape dimensions
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(812);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(375);
    Object.defineProperty(window, 'orientation', { value: 90 });
    vi.spyOn(window, 'orientation', 'get').mockReturnValue(90);

    const { result } = renderHook(() => useDeviceOrientation());
    expect(result.current.isPortrait).toBe(false);
    expect(result.current.isLandscape).toBe(true);
    expect(result.current.angle).toBe(90);
  });

  it('should handle orientation changes', () => {
    const { result } = renderHook(() => useDeviceOrientation());

    // Simulate orientation change to landscape
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(812);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(375);
    Object.defineProperty(window, 'orientation', { value: 90 });
    vi.spyOn(window, 'orientation', 'get').mockReturnValue(90);

    act(() => {
      if (orientationHandler) {
        orientationHandler();
      }
    });

    expect(result.current.isPortrait).toBe(false);
    expect(result.current.isLandscape).toBe(true);
    expect(result.current.angle).toBe(90);
  });

  it('should handle device rotation', () => {
    const { result } = renderHook(() => useDeviceOrientation());

    // Simulate device rotation
    Object.defineProperty(window, 'orientation', { value: 180 });
    vi.spyOn(window, 'orientation', 'get').mockReturnValue(180);

    act(() => {
      if (orientationHandler) {
        orientationHandler();
      }
    });

    expect(result.current.angle).toBe(180);
  });

  it('should clean up event listeners on unmount', () => {
    const { unmount } = renderHook(() => useDeviceOrientation());

    unmount();

    expect(window.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(window.removeEventListener).toHaveBeenCalledWith('orientationchange', expect.any(Function));
  });
}); 