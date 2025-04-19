import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Game from './pages/Game';
import { signalingService } from '@/services/signalingService';
import { webRTCService } from '@/services/webRTCService';

// Use a module-level variable to track initialization state
let isInitialized = false;

const App: React.FC = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    // Only initialize and connect once
    console.log('Initializing services...');
    
    // Initialize signaling service
    signalingService.init(dispatch);
    
    // Set up WebRTC service
    webRTCService.setDispatch(dispatch);

    // Connect to signaling server
    const wsUrl = 'ws://localhost:8080';
    console.log('Connecting to Signaling Server at:', wsUrl);
    signalingService.connect(wsUrl);
    
    isInitialized = true;

    // Cleanup on unmount
    return () => {
        console.log('Cleaning up services...');
        webRTCService.cleanup();
        signalingService.disconnect();
    };
  }, [dispatch]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Game />} />
      </Routes>
    </Router>
  );
};

export default App; 