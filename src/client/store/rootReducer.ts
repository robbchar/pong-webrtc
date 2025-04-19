import { combineReducers } from "@reduxjs/toolkit";
import gameReducer from "./slices/gameSlice";
import connectionReducer from "./slices/connectionSlice";

const rootReducer = combineReducers({
  game: gameReducer,
  connection: connectionReducer,
});

export default rootReducer;
