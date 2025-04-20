import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./store";
import App from "./App";
import "@/styles/index.css";
import { logger, LogLevel } from "@/utils/logger";

logger.setConfig({ minLevel: LogLevel.INFO });

logger.info("Starting application...");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
);
