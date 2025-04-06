import { useState, useEffect } from 'react';

interface OrientationState {
  isPortrait: boolean;
  isLandscape: boolean;
  angle: number;
}

const useDeviceOrientation = (): OrientationState => {
  const [orientation, setOrientation] = useState<OrientationState>({
    isPortrait: window.innerHeight > window.innerWidth,
    isLandscape: window.innerWidth > window.innerHeight,
    angle: window.screen.orientation?.angle || 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setOrientation({
        isPortrait: window.innerHeight > window.innerWidth,
        isLandscape: window.innerWidth > window.innerHeight,
        angle: window.screen.orientation?.angle || 0,
      });
    };

    const handleOrientationChange = () => {
      setOrientation({
        isPortrait: window.innerHeight > window.innerWidth,
        isLandscape: window.innerWidth > window.innerHeight,
        angle: window.screen.orientation?.angle || 0,
      });
    };

    window.addEventListener('resize', handleResize);
    window.screen.orientation?.addEventListener('change', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.screen.orientation?.removeEventListener('change', handleOrientationChange);
    };
  }, []);

  return orientation;
};

export default useDeviceOrientation; 