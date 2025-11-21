import { describe, it, expect } from "vitest";
import chatReducer, {
  setSelfIdentity,
  setRoomGameId,
  chatMessageReceived,
  chatMessageSent,
  addSystemMessage,
} from "./chatSlice";

describe("chatSlice", () => {
  const initialState = {
    self: null,
    room: { gameId: null },
    messages: [],
  };

  it("should handle initial state", () => {
    expect(chatReducer(undefined, { type: "unknown" })).toEqual(initialState);
  });

  it("should set self identity", () => {
    const actual = chatReducer(
      initialState,
      setSelfIdentity({ clientId: "c1", name: "Player-c1" }),
    );
    expect(actual.self).toEqual({ clientId: "c1", name: "Player-c1" });
  });

  it("should set room game id", () => {
    const actual = chatReducer(initialState, setRoomGameId("g1"));
    expect(actual.room.gameId).toBe("g1");
  });

  it("should append received chat message", () => {
    const actual = chatReducer(
      initialState,
      chatMessageReceived({
        fromId: "c2",
        text: "hello",
        timestamp: 1,
      }),
    );
    expect(actual.messages).toHaveLength(1);
    expect(actual.messages[0].fromId).toBe("c2");
  });

  it("should append sent message when self is set", () => {
    const stateWithSelf = chatReducer(
      initialState,
      setSelfIdentity({ clientId: "c1", name: "Player-c1" }),
    );
    const actual = chatReducer(
      stateWithSelf,
      chatMessageSent({ text: "hi", timestamp: 2 }),
    );
    expect(actual.messages).toHaveLength(1);
    expect(actual.messages[0].fromId).toBe("c1");
    expect(actual.messages[0].text).toBe("hi");
  });

  it("should not append sent message when self is null", () => {
    const actual = chatReducer(
      initialState,
      chatMessageSent({ text: "hi", timestamp: 2 }),
    );
    expect(actual.messages).toHaveLength(0);
  });

  it("should append system message", () => {
    const actual = chatReducer(
      initialState,
      addSystemMessage({ text: "sys", timestamp: 3 }),
    );
    expect(actual.messages).toHaveLength(1);
    expect(actual.messages[0].isSystem).toBe(true);
  });
});
