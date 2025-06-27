# 프로젝트구조

```
nextjs15/
├── public/                     # Static assets (images, icons, etc.)
├── src/                        # Main source code
│   ├── app/                    # App Router
│   │   ├── layout.tsx          # Root layout (global UI structure)
│   │   ├── page.tsx            # Home page
│   │   ├── api/                # API routes (Server Actions)
│   │   │   ├── auth/           #
│   │   │   ├── users/          #
│   │   │   └── route.ts        # Default API handler
│   │   └── dashboard/          # Example of a nested page
│   │       ├── page.tsx        #
│   │       ├── layout.tsx      #
│   │       └── components.tsx  # Settings UI components
│   ├── components/             # Reusable UI components
│   │   ├── ui/                 # UI elements (buttons, inputs, modals)
│   │   ├── layouts/            # Common layouts (headers, footers)
│   │   ├── forms/              # Reusable form components
│   │   └── modals/             #
│   ├── hooks/                  # Custom hooks (useAuth, useTheme)
│   │   ├── useAuth.ts
│   │   ├── useTheme.ts
│   │   └── useFetch.ts
│   ├── lib/                    # Utility functions, helpers, third-party integrations
│   │   ├── auth.ts              # Authentication helpers
│   │   ├── api.ts               # API client utilities
│   │   ├── logger.ts            # Logging utility
│   │   ├── formatDate.ts        # Date formatting helper
│   │   ├── validateForm.ts      # Form validation logic
│   │   └── constants.ts         # Global constants
│   ├── providers/               # Context providers (Theme, Auth, Global State)
│   │   ├── ThemeProvider.tsx
│   │   ├── AuthProvider.tsx
│   │   ├── UIProvider.tsx
│   ├── services/                # External API services (fetch, CRUD logic)
│   │   ├── authService.ts       # Auth service (login, register, logout)
│   │   ├── userService.ts       # User data fetching
│   │   ├── postService.ts       # Post data fetching
│   ├── store/                   # State management (Zustand, Redux, Jotai, etc.)
│   │   ├── useAuthStore.ts
│   │   ├── useThemeStore.ts
│   │   └── useUserStore.ts
│   ├── styles/                  # Global styles
│   │   ├── globals.css          # Global styles
│   │   ├── variables.css        # CSS variables
│   │   ├── tailwind.css         # Tailwind styles
│   ├── types/                   # TypeScript types & interfaces
│   │   ├── auth.ts              # Auth-related types
│   │   ├── user.ts              # User-related types
│   │   ├── post.ts              # Post-related types
│   │   ├── api.ts               # API response types
│   │   └── common.ts            # General utility types
│   ├── middleware.ts            # Middleware (e.g., auth, logging)
│   └── error.tsx                # Global error handling page
├── .env                         # Environment variables
├── .gitignore                   # Git ignore file
├── next.config.js               # Next.js configuration
├── tailwind.config.js           # Tailwind CSS config
├── tsconfig.json                # TypeScript config
└── package.json                 # Dependencies and scripts

```
