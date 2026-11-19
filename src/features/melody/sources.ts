export const melodySources = ["generated", "upload"] as const;
export type MelodySource = (typeof melodySources)[number];

type SourceWords = {
  generated: string;
  upload: string;
  openHint: string;
  originalMelody: string;
  reopenScore: string;
  replaceMelody: string;
};
export const melodySourceCopy: Record<Language, SourceWords> = {
  en: {
    originalMelody: "View generated original",
    reopenScore: "Open edited score",
    replaceMelody: "Generate a new melody and discard the edits to this one?",
    generated: "Generated melody",
    upload: "My score",
    openHint:
      "Choose a MusicXML/MXL, MuseScore, or MIDI file, or drop it here. The file stays on this device.",
  },
  ko: {
    originalMelody: "생성 원본 보기",
    reopenScore: "편집한 악보 열기",
    replaceMelody: "이 멜로디의 편집 내용을 지우고 새 멜로디를 만들까요?",
    generated: "생성 멜로디",
    upload: "내 악보",
    openHint:
      "MusicXML/MXL, MuseScore, MIDI 파일을 선택하거나 여기에 놓으세요. 악보는 이 기기에서만 읽습니다.",
  },
  ja: {
    originalMelody: "生成時の楽譜を見る",
    reopenScore: "編集した楽譜を開く",
    replaceMelody: "この楽譜の編集を破棄して新しいメロディーを生成しますか？",
    generated: "生成メロディー",
    upload: "自分の楽譜",
    openHint:
      "MusicXML/MXL・MuseScore・MIDI ファイルを選ぶか、ここにドロップしてください。楽譜はこの端末で読み込みます。",
  },
  es: {
    originalMelody: "Ver melodía original",
    reopenScore: "Abrir partitura editada",
    replaceMelody: "¿Descartar los cambios y generar otra melodía?",
    generated: "Melodía generada",
    upload: "Mi partitura",
    openHint:
      "Elige un archivo MusicXML/MXL, MuseScore o MIDI o suéltalo aquí. La partitura se lee en este dispositivo.",
  },
  de: {
    originalMelody: "Originalmelodie ansehen",
    reopenScore: "Bearbeitete Partitur öffnen",
    replaceMelody: "Änderungen verwerfen und eine neue Melodie erzeugen?",
    generated: "Generierte Melodie",
    upload: "Meine Partitur",
    openHint:
      "Wähle eine MusicXML/MXL-, MuseScore- oder MIDI-Datei oder ziehe sie hierher. Die Datei bleibt auf diesem Gerät.",
  },
  fr: {
    originalMelody: "Voir la mélodie d’origine",
    reopenScore: "Ouvrir la partition modifiée",
    replaceMelody:
      "Abandonner les modifications et générer une nouvelle mélodie ?",
    generated: "Mélodie générée",
    upload: "Ma partition",
    openHint:
      "Choisissez un fichier MusicXML/MXL, MuseScore ou MIDI ou déposez-le ici. La partition reste sur cet appareil.",
  },
  zh: {
    originalMelody: "查看生成的原谱",
    reopenScore: "打开已编辑的乐谱",
    replaceMelody: "要放弃此乐谱的编辑并生成新旋律吗？",
    generated: "生成旋律",
    upload: "我的乐谱",
    openHint:
      "选择 MusicXML/MXL、MuseScore 或 MIDI 文件，或将文件拖到这里。乐谱只在此设备上读取。",
  },
  pt: {
    originalMelody: "Ver melodia original",
    reopenScore: "Abrir partitura editada",
    replaceMelody: "Descartar as alterações e gerar uma nova melodia?",
    generated: "Melodia gerada",
    upload: "Minha partitura",
    openHint:
      "Escolha um arquivo MusicXML/MXL, MuseScore ou MIDI ou solte-o aqui. A partitura permanece neste dispositivo.",
  },
  ru: {
    originalMelody: "Показать исходную мелодию",
    reopenScore: "Открыть изменённую партитуру",
    replaceMelody: "Сбросить изменения и создать новую мелодию?",
    generated: "Генератор мелодий",
    upload: "Мои ноты",
    openHint:
      "Выберите файл MusicXML/MXL, MuseScore или MIDI либо перетащите его сюда. Ноты останутся на этом устройстве.",
  },
  ka: {
    originalMelody: "საწყისი მელოდიის ნახვა",
    reopenScore: "შეცვლილი პარტიტურის გახსნა",
    replaceMelody: "გაუქმდეს ცვლილებები და შეიქმნას ახალი მელოდია?",
    generated: "გენერირებული მელოდია",
    upload: "ჩემი ნოტები",
    openHint:
      "აირჩიეთ MusicXML/MXL, MuseScore ან MIDI ფაილი ან გადმოიტანეთ აქ. ფაილი ამ მოწყობილობაზე რჩება.",
  },
  eo: {
    originalMelody: "Vidi la originan melodion",
    reopenScore: "Malfermi la redaktitan partituron",
    replaceMelody: "Ĉu forĵeti la redaktojn kaj generi novan melodion?",
    generated: "Generita melodio",
    upload: "Mia partituro",
    openHint:
      "Elektu MusicXML/MXL-, MuseScore- aŭ MIDI-dosieron aŭ faligu ĝin ĉi tien. La dosiero restas en ĉi tiu aparato.",
  },
};
