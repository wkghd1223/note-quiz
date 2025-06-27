'use client';

import { useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getTranslation, Translations } from '@/lib/i18n/translations';

export function useTranslation() {
  const { settings } = useGameStore();
  
  const t = useMemo(() => {
    return getTranslation(settings.language);
  }, [settings.language]);
  
  return { t, language: settings.language };
}
