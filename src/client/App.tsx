import React, { useEffect } from "react";
import { useDispatch } from "react-redux";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Game from "./pages/Game";
import LobbyChat from "./pages/LobbyChat";
import { signalingService } from "@/services/signalingService";
import { webRTCService } from "@/services/webRTCService";
import { logger } from "@/utils/logger";

const App: React.FC = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    // Only initialize and connect once
    logger.info("Initializing services...");

    // Initialize signaling service
    signalingService.init(dispatch);

    // Set up WebRTC service
    webRTCService.setDispatch(dispatch);

    // Connect to signaling server
    const wsUrl = "ws://localhost:8080";
    logger.info("Connecting to Signaling Server at:", { wsUrl });
    signalingService.connect(wsUrl);

    // Cleanup on unmount
    return () => {
      logger.info("Cleaning up services...");
      webRTCService.cleanup();
      signalingService.disconnect();
    };
  }, [dispatch]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LobbyChat />} />
        <Route path="/game" element={<Game />} />
      </Routes>
    </Router>
  );
};

export default App;
