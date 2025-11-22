import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import rootReducer from "@/store/rootReducer";
import { useDebugToggle } from "./useDebugToggle";

describe("useDebugToggle", () => {
  let store: ReturnType<typeof configureStore>;

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  beforeEach(() => {
    store = configureStore({ reducer: rootReducer });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("toggles debugOverlayEnabled when ? is pressed", () => {
    renderHook(() => useDebugToggle(), { wrapper: Wrapper });

    expect(store.getState().connection.debugOverlayEnabled).toBe(false);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));

    expect(store.getState().connection.debugOverlayEnabled).toBe(true);
  });

  it("does not toggle when typing in input", () => {
    renderHook(() => useDebugToggle(), { wrapper: Wrapper });

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));

    expect(store.getState().connection.debugOverlayEnabled).toBe(false);
    document.body.removeChild(input);
  });
});
