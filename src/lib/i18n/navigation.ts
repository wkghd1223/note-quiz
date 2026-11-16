import { georgianNavigation } from "./ka";
import { esperantoNavigation } from "./eo";

export interface NavigationTranslations {
  label: string;
  home: string;
  practice: string;
  melody: string;
}
export const navigationTranslations: Record<Language, NavigationTranslations> =
  {
    ka: georgianNavigation,
    eo: esperantoNavigation,
    en: {
      label: "Main navigation",
      home: "Home",
      practice: "Basic practice",
      melody: "Melody practice",
    },
    ko: {
      label: "주요 메뉴",
      home: "홈",
      practice: "기초 연습",
      melody: "멜로디 연습",
    },
    ja: {
      label: "メインメニュー",
      home: "ホーム",
      practice: "基礎練習",
      melody: "メロディー練習",
    },
    es: {
      label: "Navegación principal",
      home: "Inicio",
      practice: "Práctica básica",
      melody: "Melodías",
    },
    de: {
      label: "Hauptnavigation",
      home: "Start",
      practice: "Grundübungen",
      melody: "Melodieübung",
    },
    fr: {
      label: "Navigation principale",
      home: "Accueil",
      practice: "Exercices de base",
      melody: "Mélodies",
    },
    pt: {
      label: "Navegação principal",
      home: "Início",
      practice: "Prática básica",
      melody: "Prática de melodias",
    },
    ru: {
      label: "Главная навигация",
      home: "Главная",
      practice: "Базовая практика",
      melody: "Практика мелодий",
    },
    zh: {
      label: "主导航",
      home: "首页",
      practice: "基础练习",
      melody: "旋律练习",
    },
  };
