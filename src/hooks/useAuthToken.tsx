'use client';

import { reissue } from '@/services/authService';
import { useUserStore } from '@/store/userStore';
import { useEffect } from 'react';

export default function useAuthToken() {
  const setUser = useUserStore((state) => state.setUser);
  const setPrepared = useUserStore((state) => state.setPrepared);
  useEffect(() => {
    async function refreshToken() {
      // Call token reissue API
      const user = await reissue();
      if (user) {
        setUser(user);
      } else {
        localStorage.removeItem('token');
        setPrepared();
      }
    }
    refreshToken();
  }, []); // Runs once on page load
}
