import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { setGameStatus, setCountdown } from '@/store/slices/gameSlice';

export const useCountdown = () => {
  const dispatch = useDispatch();
  const status = useSelector((state: RootState) => state.game.status);
  const countdown = useSelector((state: RootState) => state.game.countdown);
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (status === 'countdown') {
      const interval = setInterval(() => {
        dispatch(setCountdown(countdown - 1));
      }, 1000);
      setTimer(interval);

      if (countdown <= 0) {
        dispatch(setGameStatus('playing'));
      }
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [status, countdown, dispatch, timer]);

  return countdown;
}; 