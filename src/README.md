# src Structure

This folder contains the actual application code for Note Quiz.

## Top Level

```text
src/
├── app/              # Next.js App Router pages and layouts
├── components/       # UI and feature components
├── hooks/            # Custom React hooks
├── lib/              # Shared utilities, i18n, analytics, music logic
├── services/         # Service-layer helpers
├── store/            # Zustand stores
├── styles/           # Global styles
└── types/            # TypeScript types
```

## app

```text
app/
├── layout.tsx        # Root layout
├── page.tsx          # Landing page
├── ear-training/     # Ear-training route
├── game/             # Sight-reading game route
├── suggest/          # Suggestion page
└── @modals/          # Modal route segment
```

## components

```text
components/
├── adsense/          # Google AdSense integration
├── analytics/        # Google Analytics components
├── ear-training/     # Ear-training UI
├── game/             # Main game UI
├── layouts/          # Shared layout components
├── providers/        # App-level providers/initializers
├── suggest/          # Suggest page components
└── ui/               # Generic reusable UI
```

## lib

```text
lib/
├── analytics.ts      # Analytics event helpers
├── metadata.ts       # SEO metadata
├── i18n/             # Translation resources
└── music/            # Music/audio/question logic
```

## store

```text
store/
├── gameStore.ts          # Sight-reading game state
├── earTrainingStore.ts   # Ear-training state
└── languageStore.ts      # Language selection state
```

## Notes

- `app/game` is the visual note-reading mode.
- `app/ear-training` is the listening-based training mode.
- `lib/music` contains the core domain logic that both modes rely on.
- `components/game` and `components/ear-training` are intentionally separated to keep mode-specific UI isolated.
