# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` - Start development server (http://localhost:3000)
- `npm run build` - Build for production
- `npm run lint` - Run ESLint

## Architecture

This is a Next.js 16 application using the App Router with:

- **React 19** with React Server Components (RSC enabled)
- **TypeScript** with strict mode
- **Tailwind CSS v4** with PostCSS
- **Supabase** for backend services (@supabase/ssr for SSR-compatible auth)
- **shadcn/ui** (new-york style) for UI components with Radix UI primitives

### Path Aliases

- `@/*` maps to the project root (e.g., `@/components`, `@/lib`)

### Component Organization

- `components/ui/` - shadcn/ui components (button, card, input, dialog, sheet, dropdown-menu, avatar, label)
- `lib/utils.ts` - Contains `cn()` helper for merging Tailwind classes

### Adding shadcn/ui Components

Use the shadcn CLI to add new components:
```bash
npx shadcn@latest add [component-name]
```
