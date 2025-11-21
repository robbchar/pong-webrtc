import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import LobbyChat from "./LobbyChat";
import gameReducer from "@/store/slices/gameSlice";
import connectionReducer from "@/store/slices/connectionSlice";
import rootReducer from "@/store/rootReducer";
import { SignalingStatus } from "@/types/signalingTypes";

vi.mock("@/services/signalingService", () => ({
  signalingService: {
    sendChatMessage: vi.fn(),
  },
}));

const createTestStore = (overrides?: any) => {
  const defaultGameState = gameReducer(undefined, { type: "unknown" });
  const defaultConnectionState = connectionReducer(undefined, {
    type: "unknown",
  });

  return configureStore({
    reducer: rootReducer,
    preloadedState: {
      game: defaultGameState,
      connection: {
        ...defaultConnectionState,
        signalingStatus: SignalingStatus.OPEN,
      },
      chat: {
        self: { clientId: "c1", name: "Player-c1" },
        room: { gameId: "abcd-1234" },
        messages: [],
      },
      ...overrides,
    },
  });
};

describe("LobbyChat", () => {
  it("renders identity and room label", () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <LobbyChat />
      </Provider>,
    );
    expect(screen.getByText("Player-c1")).toBeInTheDocument();
    expect(screen.getByText(/Room-/, { exact: false })).toBeInTheDocument();
  });

  it("disables input when disconnected", () => {
    const store = createTestStore({
      connection: {
        signalingStatus: SignalingStatus.CLOSED,
        peerStatus: "idle",
        peerId: null,
        isHost: null,
        gameId: null,
        dataChannelStatus: "closed",
        error: null,
      },
    });
    render(
      <Provider store={store}>
        <LobbyChat />
      </Provider>,
    );
    expect(screen.getByLabelText("Message input")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("sends message through signaling service and clears input", async () => {
    const store = createTestStore();
    const user = userEvent.setup();

    const { signalingService } = await import("@/services/signalingService");

    render(
      <Provider store={store}>
        <LobbyChat />
      </Provider>,
    );

    const input = screen.getByLabelText("Message input");
    await user.type(input, "hello");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(signalingService.sendChatMessage).toHaveBeenCalledWith("hello");
    expect((input as HTMLInputElement).value).toBe("");
  });
});
