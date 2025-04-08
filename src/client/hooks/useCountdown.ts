import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { setGameStatus, setCountdown } from '@/store/slices/gameSlice';

export const useCountdown = () => {
  const dispatch = useDispatch();
  const status = useSelector((state: RootState) => state.game.status);
  const countdown = useSelector((state: RootState) => state.game.countdown);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (status === 'countdown') {
      timerRef.current = setInterval(() => {
        dispatch(setCountdown(countdown - 1));
      }, 1000);

      if (countdown <= 0) {
        dispatch(setGameStatus('playing'));
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status, countdown, dispatch]);

  return countdown;
}; 