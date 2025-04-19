import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useDeviceOrientation from "./useDeviceOrientation";

describe("useDeviceOrientation", () => {
  const mockWindow = {
    innerWidth: 375,
    innerHeight: 812,
    screen: {
      orientation: {
        angle: 0,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  let orientationHandler: (() => void) | null = null;

  beforeEach(() => {
    // Mock window properties
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(
      mockWindow.innerWidth,
    );
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(
      mockWindow.innerHeight,
    );

    // Mock screen.orientation
    Object.defineProperty(window, "screen", {
      value: {
        orientation: {
          angle: mockWindow.screen.orientation.angle,
          addEventListener: vi.fn((event, handler) => {
            if (event === "change") {
              orientationHandler = handler as () => void;
            }
          }),
          removeEventListener: vi.fn(),
        },
      },
      writable: true,
      configurable: true,
    });

    // Mock event listeners
    vi.spyOn(window, "addEventListener").mockImplementation(
      mockWindow.addEventListener,
    );
    vi.spyOn(window, "removeEventListener").mockImplementation(
      mockWindow.removeEventListener,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    orientationHandler = null;
  });

  it("should initialize with portrait orientation", () => {
    const { result } = renderHook(() => useDeviceOrientation());
    expect(result.current.isPortrait).toBe(true);
    expect(result.current.isLandscape).toBe(false);
    expect(result.current.angle).toBe(0);
  });

  it("should detect landscape orientation", () => {
    // Mock landscape dimensions
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(812);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(375);
    Object.defineProperty(window.screen.orientation, "angle", { value: 90 });

    const { result } = renderHook(() => useDeviceOrientation());
    expect(result.current.isPortrait).toBe(false);
    expect(result.current.isLandscape).toBe(true);
    expect(result.current.angle).toBe(90);
  });

  it("should handle orientation changes", () => {
    const { result } = renderHook(() => useDeviceOrientation());

    // Simulate orientation change to landscape
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(812);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(375);
    Object.defineProperty(window.screen.orientation, "angle", { value: 90 });

    act(() => {
      orientationHandler?.();
    });

    expect(result.current.isPortrait).toBe(false);
    expect(result.current.isLandscape).toBe(true);
    expect(result.current.angle).toBe(90);
  });

  it("should handle device rotation", () => {
    const { result } = renderHook(() => useDeviceOrientation());

    // Simulate device rotation
    Object.defineProperty(window.screen.orientation, "angle", { value: 180 });

    act(() => {
      orientationHandler?.();
    });

    expect(result.current.angle).toBe(180);
  });

  it("should clean up event listeners on unmount", () => {
    const { unmount } = renderHook(() => useDeviceOrientation());

    unmount();

    expect(window.removeEventListener).toHaveBeenCalledWith(
      "resize",
      expect.any(Function),
    );
    expect(window.screen.orientation.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
  });
});
