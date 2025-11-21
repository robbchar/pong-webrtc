import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import App from "./App";
import gameReducer, { GameStatus } from "@/store/slices/gameSlice";
import connectionReducer from "@/store/slices/connectionSlice";
import chatReducer from "@/store/slices/chatSlice";
import { SignalingStatus } from "@/types/signalingTypes";

const createTestStore = () => {
  const defaultGameState = {
    status: "waiting" as GameStatus,
    ball: {
      x: 50,
      y: 50,
      velocityX: 0,
      velocityY: 0,
    },
    leftPaddle: {
      y: 50,
    },
    rightPaddle: {
      y: 50,
    },
    score: {
      left: 0,
      right: 0,
    },
    wins: {
      left: 0,
      right: 0,
    },
    countdown: 5,
    isReady: false,
    opponentReady: false,
  };

  return configureStore({
    reducer: {
      game: gameReducer,
      connection: connectionReducer,
      chat: chatReducer,
    },
    preloadedState: {
      game: defaultGameState,
      connection: {
        signalingStatus: SignalingStatus.OPEN,
        peerStatus: "connected" as const,
        peerId: "test-peer",
        isHost: true,
        gameId: "test-game",
        dataChannelStatus: "open" as const,
        error: null,
        selfStartIntent: false,
        opponentStartIntent: false,
      },
      chat: {
        self: { clientId: "test-client", name: "Player-test" },
        room: { gameId: "test-game" },
        messages: [],
      },
    },
  });
};

describe("App", () => {
  it("renders the lobby identity and status", () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );
    expect(screen.getByText(/You are:/)).toBeInTheDocument();
    expect(screen.getByText(/^Player-/)).toBeInTheDocument();
    expect(screen.getByText(/Status:/)).toBeInTheDocument();
  });

  it("renders the chat input and empty state", () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <App />
      </Provider>,
    );
    expect(screen.getByLabelText("Message input")).toBeInTheDocument();
    expect(screen.getByText("No messages yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });
});
