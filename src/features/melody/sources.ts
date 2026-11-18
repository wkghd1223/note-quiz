export const melodySources = ["generated", "upload"] as const;
export type MelodySource = (typeof melodySources)[number];

type SourceWords = { generated: string; upload: string; openHint: string };
export const melodySourceCopy: Record<Language, SourceWords> = {
  en: {
    generated: "Generated melody",
    upload: "My score",
    openHint:
      "Choose a MusicXML or MXL file, or drop it here. The file stays on this device.",
  },
  ko: {
    generated: "생성 멜로디",
    upload: "내 악보",
    openHint:
      "MusicXML 또는 MXL 파일을 선택하거나 여기에 놓으세요. 악보는 이 기기에서만 읽습니다.",
  },
  ja: {
    generated: "生成メロディー",
    upload: "自分の楽譜",
    openHint:
      "MusicXML または MXL ファイルを選ぶか、ここにドロップしてください。楽譜はこの端末で読み込みます。",
  },
  es: {
    generated: "Melodía generada",
    upload: "Mi partitura",
    openHint:
      "Elige un archivo MusicXML o MXL o suéltalo aquí. La partitura se lee en este dispositivo.",
  },
  de: {
    generated: "Generierte Melodie",
    upload: "Meine Partitur",
    openHint:
      "Wähle eine MusicXML- oder MXL-Datei oder ziehe sie hierher. Die Datei bleibt auf diesem Gerät.",
  },
  fr: {
    generated: "Mélodie générée",
    upload: "Ma partition",
    openHint:
      "Choisissez un fichier MusicXML ou MXL ou déposez-le ici. La partition reste sur cet appareil.",
  },
  zh: {
    generated: "生成旋律",
    upload: "我的乐谱",
    openHint:
      "选择 MusicXML 或 MXL 文件，或将文件拖到这里。乐谱只在此设备上读取。",
  },
  pt: {
    generated: "Melodia gerada",
    upload: "Minha partitura",
    openHint:
      "Escolha um arquivo MusicXML ou MXL ou solte-o aqui. A partitura permanece neste dispositivo.",
  },
  ru: {
    generated: "Генератор мелодий",
    upload: "Мои ноты",
    openHint:
      "Выберите файл MusicXML или MXL либо перетащите его сюда. Ноты останутся на этом устройстве.",
  },
  ka: {
    generated: "გენერირებული მელოდია",
    upload: "ჩემი ნოტები",
    openHint:
      "აირჩიეთ MusicXML ან MXL ფაილი ან გადმოიტანეთ აქ. ფაილი ამ მოწყობილობაზე რჩება.",
  },
  eo: {
    generated: "Generita melodio",
    upload: "Mia partituro",
    openHint:
      "Elektu MusicXML- aŭ MXL-dosieron aŭ faligu ĝin ĉi tien. La dosiero restas en ĉi tiu aparato.",
  },
};
