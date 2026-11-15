import type { HomeCopy } from "./home";

export const portugueseHome: HomeCopy = {
  title: "Leia, ouça e toque as notas",
  introduction:
    "Escolha um exercício curto ou acompanhe uma melodia de oito compassos.",
  access: "Grátis · Sem cadastro",
  basicHint: "Uma questão por vez",
  modeDescriptions: {
    note: "Identifique a nota na pauta",
    ear: "Identifique a nota que você ouve",
    interval: "Reconheça a distância entre as notas",
    chord: "Reconheça acordes e progressões",
  },
  melodyDescription:
    "Acompanhe uma nova partitura de oito compassos e toque uma nota por vez usando o microfone.",
  melodyFeatures: "Exemplo no piano · Metrônomo · Andamento ajustável",
  melodyAction: "Praticar uma melodia",
  howTitle: "Escolha como praticar",
  steps: [
    {
      title: "Escolha um exercício",
      description:
        "Use a prática básica para responder uma questão por vez ou a prática de melodias para tocar as notas no ritmo.",
    },
    {
      title: "Ajuste o que vai praticar",
      description:
        "Escolha a dificuldade e o conteúdo nas configurações. Na prática de melodias, você também pode ajustar o andamento e a fórmula de compasso.",
    },
    {
      title: "Ouça, responda e tente novamente",
      description:
        "Confira suas respostas e repita com as mesmas configurações. Para as melodias, ouça primeiro o exemplo no piano.",
    },
  ],
  faqTitle: "Antes de começar",
  faq: [
    {
      question: "Preciso de uma conta?",
      answer: "Não. Você pode usar o Note Quiz gratuitamente, sem cadastro.",
    },
    {
      question: "Preciso de um microfone?",
      answer:
        "Na prática básica, você pode responder pelas teclas na tela ou pelas alternativas. A prática de melodias usa um microfone e aceita uma nota por vez.",
    },
    {
      question: "Como as melodias são criadas?",
      answer:
        "Cada nova melodia de oito compassos usa a tonalidade, a extensão, a fórmula de compasso e as durações que você escolher. Ouça um exemplo ou ative o metrônomo antes de praticar.",
    },
    {
      question: "O áudio do microfone é armazenado?",
      answer:
        "O áudio do microfone é analisado no navegador. Ele não é gravado nem enviado. Permita o acesso ao microfone quando o navegador solicitar.",
    },
  ],
  metaTitle:
    "Note Quiz | Leitura musical, treino auditivo e prática de melodias",
  metaDescription:
    "Pratique notas, intervalos e acordes ou toque uma melodia de oito compassos pelo microfone. Grátis, com exemplos no piano e metrônomo. Sem cadastro.",
};
