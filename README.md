# pong-webrtc

Local‑first multiplayer Pong built on WebRTC, with a lightweight WebSocket signaling server and a React/Vite client. The host is authoritative for game state; the guest sends inputs and renders interpolated snapshots.

## Features

- **Peer‑to‑peer gameplay over WebRTC data channels**
- **WebSocket signaling + pairing** (local server)
- **Host‑authoritative physics and match loop**
- **Guest interpolation** for smooth rendering between 20Hz snapshots
- **Debug overlay** (toggle with `?`) showing snapshot/input rates and quality
- **Lobby chat** over signaling WS

Status: hobby/MVP‑ish. Designed primarily for running locally in multiple tabs/windows.

## Tech stack

- **Client**: React 19, Redux Toolkit, Vite 6, TypeScript
- **Server**: Node + Express 5, `ws` WebSocket server, TypeScript
- **Tests**: Vitest + React Testing Library

## Getting started

### Prerequisites

- Node.js (latest LTS recommended)
- npm

### Install

```bash
npm install
```

### Run in development (client + server)

```bash
npm run dev
```

This runs:

- Vite client on `http://localhost:3000`
- Signaling server on `http://localhost:8080`

Vite proxies `/api` and WS upgrades to the signaling server.

### Run only the client

```bash
npm run dev:client
```

### Run only the signaling server

```bash
npm run dev:server
```

### Production build (local)

```bash
npm run build:client
npm run build:server
npm start
```

Client build output goes to `dist/client`, server build to `dist/server`.

## Useful scripts

- `npm run dev`: run client + server together
- `npm run dev:client`: Vite dev server
- `npm run dev:server`: Nodemon/ts-node signaling server
- `npm run build:client`: Typecheck + build client
- `npm run build:server`: build server only
- `npm start`: build server then run compiled server
- `npm test`: run tests once
- `npm run test:watch`: watch mode
- `npm run test:coverage`: coverage run
- `npm run lint`: typecheck client + server (includes unused locals/params checks)
- `npm run knip:report`: report unused files/exports (TypeScript-aware)
- `npm run depcheck:report`: report unused npm dependencies

## How to play locally

1. Start dev servers: `npm run dev`.
2. Open two tabs/windows at `http://localhost:3000`.
3. The first tab becomes **Host (left paddle)** and waits; the second tab joins as **Guest (right paddle)**.
4. Click **Ready** in both tabs to start the countdown.
5. Drag/touch your paddle to play.

## Architecture overview

### Roles and authority

- **Host**
  - Owns physics (`useBallPhysics`) and game state transitions.
  - Broadcasts `gameState` snapshots over WebRTC at ~20Hz.
  - Controls the **left paddle** locally.
- **Guest**
  - Sends **right paddle** moves at ~30Hz.
  - Receives host snapshots and renders an interpolated view.

### Transport layers

- **WebSocket signaling** (`src/server/server.ts`)
  - Pairs clients into a game.
  - Relays offers/answers/ICE candidates.
  - Carries lobby chat and start intents.
- **WebRTC data channel** (`src/client/services/webRTCService.ts`)
  - Carries real‑time game messages:
    - `gameState` (host → guest)
    - `paddleMove` (guest → host)
    - `pauseRequest`, `readyStatus`, `dc_ready`

### Snapshot + interpolation loop

- Host runs physics and emits snapshots every 50ms (`useHostGameStateBroadcast`).
- Guest stores the latest snapshots in Redux and interpolates in `useInterpolatedGameState`.

### Debug overlay

Toggle with `?` during play.

- Host shows outbound snapshot rate/interval/age.
- Guest shows inbound snapshot rate/interval/age plus input send rate/age.
- Quality is derived from snapshot staleness and average interval:
  - Good if age <120ms and avg interval <80ms.
  - OK if age <250ms or avg interval <140ms.
  - Poor otherwise.

## Folder structure

- `src/client/`
  - `components/`: React UI (GameBoard, Paddle, Ball, DebugOverlay, pages)
  - `hooks/`: gameplay + networking hooks
  - `services/`: signaling and WebRTC services
  - `store/`: Redux slices and store setup
  - `types/`: message and shared types
  - `constants/`: game constants
- `src/server/`
  - `server.ts`: signaling + pairing WebSocket server
- `docs/`: design notes and future plans

## Troubleshooting

- **No pairing / stuck “Connecting…”**
  - Ensure signaling server is running on port `8080`.
  - Check browser console for WS errors.
- **WebRTC doesn’t connect**
  - This project uses public STUN servers only; some networks require TURN (not implemented).
  - Try a different network or two local tabs first.
- **Debug overlay not showing**
  - Press `?` while the game board is focused (not typing in an input).

## Notes on deployment

Deployment hasn’t been a focus yet. The current setup assumes a local signaling server and Vite client. If/when deploying:

- Add TURN server support.
- Decide whether to serve the built client from the Express server or deploy separately.
