import { create } from 'zustand';

interface UserStoreInf {
  user?: UserType;
  _prepared: boolean;
  setPrepared: () => void;
  setUser: (user: UserType) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserStoreInf>((set) => ({
  user: undefined,
  _prepared: false,
  setPrepared: () => set((state) => ({ ...state, _prepared: true })),
  setUser: (user) => set(() => ({ user, _prepared: true })),
  clearUser: () => set({ user: undefined, _prepared: true }),
}));
