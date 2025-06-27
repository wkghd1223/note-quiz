'use client';

import { useState, useEffect } from 'react';

const useComponentSize = (ref: React.RefObject<HTMLElement | null>) => {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const handleResize = () => {
    if (ref.current) {
      setSize({
        width: ref.current.offsetWidth,
        height: ref.current.offsetHeight,
      });
    }
  };
  useEffect(() => {
    if (ref.current) {
      handleResize(); // Initialize size on mount
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [ref]);

  return size;
};

export default useComponentSize;
