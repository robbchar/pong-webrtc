import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { setCountdown, setGameStatus } from '@/store/slices/gameSlice';

export const useCountdown = () => {
  const dispatch = useDispatch();
  const { status, countdown } = useSelector((state: RootState) => state.game);
  const timerRef = useRef<number>();

  useEffect(() => {
    if (status === 'countdown') {
      timerRef.current = window.setInterval(() => {
        dispatch(setCountdown(countdown - 1));
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [status, countdown, dispatch]);

  useEffect(() => {
    if (countdown === 0) {
      dispatch(setGameStatus('playing'));
    }
  }, [countdown, dispatch]);
}; 