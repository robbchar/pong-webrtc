import { combineReducers } from "@reduxjs/toolkit";
import gameReducer from "./slices/gameSlice";
import connectionReducer from "./slices/connectionSlice";
import chatReducer from "./slices/chatSlice";

const rootReducer = combineReducers({
  game: gameReducer,
  connection: connectionReducer,
  chat: chatReducer,
});

export default rootReducer;
