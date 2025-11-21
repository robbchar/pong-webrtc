import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";

export interface ChatMessage {
  id: string;
  fromId: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface ChatState {
  self: {
    clientId: string;
    name: string;
  } | null;
  room: {
    gameId: string | null;
  };
  messages: ChatMessage[];
}

const initialState: ChatState = {
  self: null,
  room: { gameId: null },
  messages: [],
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setSelfIdentity: (
      state,
      action: PayloadAction<{ clientId: string; name: string }>,
    ) => {
      state.self = action.payload;
    },
    setRoomGameId: (state, action: PayloadAction<string | null>) => {
      state.room.gameId = action.payload;
    },
    chatMessageReceived: (
      state,
      action: PayloadAction<Omit<ChatMessage, "id"> & { id?: string }>,
    ) => {
      const messageId = action.payload.id ?? uuidv4();
      state.messages.push({ ...action.payload, id: messageId });
    },
    chatMessageSent: (
      state,
      action: PayloadAction<{ text: string; timestamp: number }>,
    ) => {
      if (!state.self) return;
      state.messages.push({
        id: uuidv4(),
        fromId: state.self.clientId,
        text: action.payload.text,
        timestamp: action.payload.timestamp,
      });
    },
    addSystemMessage: (
      state,
      action: PayloadAction<{ text: string; timestamp: number }>,
    ) => {
      state.messages.push({
        id: uuidv4(),
        fromId: "system",
        text: action.payload.text,
        timestamp: action.payload.timestamp,
        isSystem: true,
      });
    },
    clearChat: (state) => {
      state.messages = [];
    },
  },
});

export const {
  setSelfIdentity,
  setRoomGameId,
  chatMessageReceived,
  chatMessageSent,
  addSystemMessage,
  clearChat,
} = chatSlice.actions;

export default chatSlice.reducer;
