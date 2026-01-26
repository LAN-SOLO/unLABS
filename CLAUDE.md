# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**UnstableLabs** - A retro cyberpunk idle laboratory game with blockchain integration. Players manage NFT crystals (_unITM) composed of 30 slices (_unSLC) through a terminal-style UI, earning _unSC tokens through gameplay.

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Build for production
npm run lint     # Run ESLint
```

## Tech Stack

- **Next.js 16** with App Router and React 19 (Server Components by default)
- **TypeScript** with strict mode
- **Tailwind CSS v4** with PostCSS
- **Supabase** for auth, database, and real-time subscriptions
- **shadcn/ui** (new-york style) with Radix UI primitives

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth routes (login, register)
│   ├── (game)/            # Protected game routes (terminal, lab)
│   └── api/               # API routes
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── terminal/          # Terminal UI components
│   └── game/              # Game-specific components
├── lib/
│   ├── supabase/          # Supabase client utilities
│   │   ├── client.ts      # Browser client
│   │   ├── server.ts      # Server client
│   │   └── middleware.ts  # Auth session helper
│   └── utils.ts           # cn() and utilities
├── types/
│   ├── database.ts        # Supabase generated types
│   └── index.ts           # Type exports and constants
├── supabase/
│   └── migrations/        # SQL migration files
└── middleware.ts          # Next.js auth middleware
```

## Database Schema

### Core Tables
| Table | Description |
|-------|-------------|
| `profiles` | User profiles (extends auth.users) |
| `crystals` | NFT items (_unITM) with traits |
| `slices` | Crystal components (_unSLC), 30 per crystal |
| `tech_trees` | 12 research trees |
| `research_progress` | User progression per tree |
| `balances` | _unSC token balances |
| `transactions` | Token transaction history |
| `command_history` | Terminal command logs |
| `volatility_snapshots` | Blockchain TPS data |

### Crystal Traits
- **Color**: infrared, red, orange, yellow, green, blue, indigo, violet, gamma
- **Volatility**: Tier 1-5 (based on blockchain TPS)
- **Rotation**: CW (clockwise) / CCW (counter-clockwise)
- **State**: stable / volatile / hybrid
- **Era**: 8-bit / 16-bit / 32-bit / 64-bit

## Code Conventions

### Components
- Server Components by default; use `'use client'` only when needed
- Use Server Actions for mutations
- Terminal aesthetic: monospace fonts, dark theme, CRT effects

### File Naming
| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `Terminal.tsx` |
| Hooks | camelCase with 'use' | `useTerminal.ts` |
| Utilities | camelCase | `parseCommand.ts` |
| Types | PascalCase | `Crystal.ts` |

### Supabase Usage
```typescript
// Server Component / Server Action
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()

// Client Component
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
```

### Type Imports
```typescript
import type { Crystal, Profile, Balance } from '@/types'
import { CRYSTAL_COLORS, SLICES_PER_CRYSTAL } from '@/types'
```

## Terminal UI Requirements

- Monospace font (system or custom)
- Dark background with green/amber text
- CRT scanline effect (subtle CSS)
- Typing animation for output
- Command history (up/down arrows)
- ASCII art support

## Adding shadcn/ui Components

```bash
npx shadcn@latest add [component-name]
```

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
