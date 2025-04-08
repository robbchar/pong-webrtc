import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import gameReducer, { GameStatus } from '@/store/slices/gameSlice';
import GameBoard from './GameBoard';
import styles from './GameBoard.module.css';
import useDeviceOrientation from '@/hooks/useDeviceOrientation';

// Mock the hooks
vi.mock('@/hooks/useBallMovement', () => ({
  useBallMovement: vi.fn(),
}));

vi.mock('@/hooks/useCountdown', () => ({
  useCountdown: vi.fn(() => 5),
}));

vi.mock('@/hooks/useDeviceOrientation', () => ({
  __esModule: true,
  default: vi.fn(() => ({ 
    isPortrait: false,
    isLandscape: true,
    angle: 0,
  })),
}));

describe('GameBoard', () => {
  const createMockStore = (initialState: Partial<{
    status: GameStatus;
    ball: { x: number; y: number; velocityX: number; velocityY: number };
    leftPaddle: { y: number };
    rightPaddle: { y: number };
    score: { left: number; right: number };
    wins: { left: number; right: number };
    countdown: number;
    isReady: boolean;
  }> = {}) => {
    return configureStore({
      reducer: {
        game: gameReducer,
      },
      preloadedState: {
        game: {
          status: 'waiting' as GameStatus,
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
          ...initialState,
        },
      },
    });
  };

  const renderWithStore = (store = createMockStore()) => {
    return render(
      <Provider store={store}>
        <GameBoard />
      </Provider>
    );
  };

  it('should render the game board', () => {
    renderWithStore();
    expect(screen.getByTestId('game-board')).toBeInTheDocument();
    expect(screen.getByTestId('center-line')).toBeInTheDocument();
  });

  it('should show ready button in waiting state when not ready', () => {
    renderWithStore(createMockStore({ status: 'waiting', isReady: false }));
    expect(screen.getByTestId('ready-button')).toBeInTheDocument();
  });

  it('should not show ready button when ready', () => {
    renderWithStore(createMockStore({ status: 'waiting', isReady: true }));
    expect(screen.queryByTestId('ready-button')).not.toBeInTheDocument();
  });

  it('should show countdown when in countdown state', () => {
    renderWithStore(createMockStore({ status: 'countdown', countdown: 3 }));
    expect(screen.getByTestId('countdown')).toBeInTheDocument();
    expect(screen.getByTestId('countdown')).toHaveTextContent('3');
  });

  it('should show pause button during gameplay', () => {
    renderWithStore(createMockStore({ status: 'playing' }));
    expect(screen.getByTestId('pause-button')).toBeInTheDocument();
  });

  it('should show pause overlay when game is paused', () => {
    renderWithStore(createMockStore({ status: 'paused' }));
    expect(screen.getByText('PAUSED')).toBeInTheDocument();
    expect(screen.getByTestId('resume-button')).toBeInTheDocument();
  });

  it('should show game over when game is finished', () => {
    renderWithStore(createMockStore({ status: 'gameOver' }));
    expect(screen.getByTestId('game-over')).toBeInTheDocument();
  });

  it('should handle ready button click', () => {
    const store = createMockStore({ status: 'waiting', isReady: false });
    renderWithStore(store);
    
    fireEvent.click(screen.getByTestId('ready-button'));
    
    expect(store.getState().game.isReady).toBe(true);
    expect(store.getState().game.status).toBe('countdown');
  });

  it('should handle pause button click', () => {
    const store = createMockStore({ status: 'playing' });
    renderWithStore(store);
    
    fireEvent.click(screen.getByTestId('pause-button'));
    
    expect(store.getState().game.status).toBe('paused');
  });

  it('should handle resume button click', () => {
    const store = createMockStore({ status: 'paused' });
    renderWithStore(store);
    
    fireEvent.click(screen.getByTestId('resume-button'));
    
    expect(store.getState().game.status).toBe('playing');
  });

  it('renders game board with correct elements', () => {
    renderWithStore();

    expect(screen.getByTestId('game-board')).toBeInTheDocument();
    expect(screen.getByTestId('center-line')).toBeInTheDocument();
    expect(screen.getByTestId('left-paddle')).toBeInTheDocument();
    expect(screen.getByTestId('right-paddle')).toBeInTheDocument();
    expect(screen.getByTestId('ball')).toBeInTheDocument();
  });

  it('should apply portrait styles when in portrait orientation', () => {
    vi.mocked(useDeviceOrientation).mockReturnValue({ 
      isPortrait: true,
      isLandscape: false,
      angle: 0,
    });
    renderWithStore();
    expect(screen.getByTestId('game-board')).toHaveClass(styles.portrait);
  });

  it('should apply landscape styles when in landscape orientation', () => {
    vi.mocked(useDeviceOrientation).mockReturnValue({ 
      isPortrait: false,
      isLandscape: true,
      angle: 0,
    });
    renderWithStore();
    expect(screen.getByTestId('game-board')).toHaveClass(styles.landscape);
  });

  it('should display initial scores and no win ticks', () => {
    renderWithStore();
    const scores = screen.getAllByText('0');
    expect(scores).toHaveLength(2); // One for each player
    expect(screen.queryByText('✓')).not.toBeInTheDocument();
  });

  it('should display win ticks for left player', () => {
    const store = createMockStore({ wins: { left: 2, right: 0 } });
    renderWithStore(store);
    const ticks = screen.getAllByText('✓');
    expect(ticks).toHaveLength(2);
  });

  it('should display win ticks for right player', () => {
    const store = createMockStore({ wins: { left: 0, right: 3 } });
    renderWithStore(store);
    const ticks = screen.getAllByText('✓');
    expect(ticks).toHaveLength(3);
  });

  it('should display current scores', () => {
    const store = createMockStore({ 
      score: { left: 5, right: 3 } 
    });
    renderWithStore(store);
    const scores = screen.getAllByText(/[0-9]/);
    expect(scores[0]).toHaveTextContent('5');
    expect(scores[1]).toHaveTextContent('3');
  });

  it('should show game over and winner when score reaches 10', () => {
    const store = createMockStore({ 
      status: 'gameOver',
      score: { left: 10, right: 5 } 
    });
    renderWithStore(store);
    expect(screen.getByText('GAME OVER')).toBeInTheDocument();
    expect(screen.getByText('Left Player Wins!')).toBeInTheDocument();
  });

  it('should show restart button after game over', () => {
    const store = createMockStore({ status: 'gameOver' });
    renderWithStore(store);
    expect(screen.getByText('PLAY AGAIN')).toBeInTheDocument();
  });

  it('should reset game when restart button is clicked', () => {
    const store = createMockStore({ 
      status: 'gameOver',
      score: { left: 10, right: 5 },
      wins: { left: 1, right: 0 }
    });
    renderWithStore(store);
    
    fireEvent.click(screen.getByText('PLAY AGAIN'));
    
    const state = store.getState().game;
    expect(state.status).toBe('waiting');
    expect(state.score.left).toBe(0);
    expect(state.score.right).toBe(0);
    expect(state.wins.left).toBe(1); // Wins should persist
  });
}); 