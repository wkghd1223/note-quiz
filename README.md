# Note Quiz

Note Quiz is a Next.js music training app for note reading and ear training. It currently includes:

- Sight-reading practice at `/game`
- Absolute pitch / ear-training practice at `/ear-training`
- Audio playback, score tracking, and customizable training settings
- Mobile-friendly UI with multilingual support

## Why This Exists

This project started as a focused practice tool for learning to recognize notes quickly from sheet music. It has grown into a broader training app with both visual note identification and listening-based drills.

## Current Features

### Sight Reading

- Treble, bass, alto, and tenor clefs
- Key signatures and accidentals
- Piano-key and solfege answer modes
- Adjustable staff range and time limits
- Session stats, score history, and results

### Ear Training

- Single-note listening practice
- Practice and timed modes
- Natural-only or chromatic note sets
- Piano or solfege input
- Replay current note
- Session summary and aggregate stats

### General

- Responsive layout for desktop and mobile
- 6 languages: English, Korean, Japanese, Spanish, German, French
- Google Analytics event tracking
- Google AdSense component support

## Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- Zustand
- Web Audio API
- React Icons

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Lint

```bash
npm run lint
```

## Routes

- `/` landing page
- `/game` sight-reading game
- `/ear-training` ear-training mode
- `/suggest` suggestion page

## Project Structure

```text
src/
├── app/
│   ├── ear-training/
│   ├── game/
│   ├── suggest/
│   └── page.tsx
├── components/
│   ├── analytics/
│   ├── ear-training/
│   ├── game/
│   ├── layouts/
│   ├── providers/
│   └── ui/
├── lib/
│   ├── analytics.ts
│   ├── i18n/
│   ├── metadata.ts
│   └── music/
├── store/
├── styles/
└── types/
```

## Analytics

Google Analytics is installed globally in the root layout and route changes are tracked for App Router navigation.

Current analytics coverage includes:

- page views
- game start
- answers
- ear-training session start
- ear-training answer submission
- ear-training completion
- ear-training replay
- ear-training settings changes

## Notes

- Google Analytics tracking ID is currently configured in code.
- Some UI text and branding are translation-driven.
- There are existing lint warnings in a couple of legacy hooks/components, but lint passes.

## License

MIT
