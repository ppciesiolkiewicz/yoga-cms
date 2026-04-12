# Dark Mode Design

**Date**: 2026-04-13
**Status**: Draft

## Overview

Add user-togglable dark mode to the Next.js 16 app using CSS variables and `next-themes`. User preference persists in localStorage with OS preference as fallback.

## Approach

CSS variables define semantic color tokens in `globals.css`. Light values in `:root`, dark overrides in `.dark`. `next-themes` manages the `.dark` class on `<html>`, handles localStorage persistence, OS detection, and SSR hydration flash prevention. All hardcoded Tailwind color classes in components are replaced with variable references.

## Theme Infrastructure

- Install `next-themes`
- Wrap app in `<ThemeProvider>` in root `src/app/layout.tsx`:
  - `attribute="class"` — toggles `.dark` on `<html>`
  - `defaultTheme="system"` — respects OS preference on first visit
  - `storageKey="theme"` — localStorage key
- Add `suppressHydrationWarning` to `<html>` tag (required by `next-themes` to prevent flash)

## CSS Variables

Define in `src/app/globals.css`:

| Token | Light | Dark |
|---|---|---|
| `--color-bg-primary` | `white` | `gray-950` (#030712) |
| `--color-bg-secondary` | `gray-50` (#f9fafb) | `gray-900` (#111827) |
| `--color-bg-tertiary` | `gray-100` (#f3f4f6) | `gray-800` (#1f2937) |
| `--color-text-primary` | `gray-900` (#111827) | `gray-100` (#f3f4f6) |
| `--color-text-secondary` | `gray-600` (#4b5563) | `gray-400` (#9ca3af) |
| `--color-border` | `gray-200` (#e5e7eb) | `gray-700` (#374151) |
| `--color-accent` | `blue-600` (#2563eb) | `blue-500` (#3b82f6) |
| `--color-accent-hover` | `blue-700` (#1d4ed8) | `blue-400` (#60a5fa) |

Light values in `:root`, dark overrides in `.dark` selector. Tailwind v4 references via `bg-(--color-bg-primary)` syntax.

## Component Refactor

All 12 UI components in `src/components/ui/` have hardcoded color classes replaced with CSS variable references:

- **Button.tsx**: `bg-blue-600` → `bg-(--color-accent)`, `border-gray-300` → `border-(--color-border)`, etc.
- **Card.tsx**: `bg-white` → `bg-(--color-bg-primary)`, `border-gray-200` → `border-(--color-border)`
- **Input.tsx**: `bg-white` → `bg-(--color-bg-primary)`, `border-gray-300` → `border-(--color-border)`
- **Textarea.tsx**: Same as Input
- **Select.tsx**: Same as Input, plus dropdown items
- **Modal.tsx**: `bg-white` → `bg-(--color-bg-primary)`, overlay stays `bg-black/40`
- **Checkbox.tsx**: `border-gray-300` → `border-(--color-border)`, checked state keeps accent
- **Chip.tsx**: `bg-gray-50` → `bg-(--color-bg-secondary)`, `border-gray-200` → `border-(--color-border)`
- **Carousel.tsx**: `bg-white` → `bg-(--color-bg-primary)`, `border-gray-200` → `border-(--color-border)`
- **Collapsible.tsx**: Uses parent className, no changes needed
- **CountrySelect.tsx**: Same pattern as Select

Page-level components (nav bar in `src/app/(main)/layout.tsx`, route pages) also get refactored to use tokens.

Root `<body>` in `src/app/layout.tsx`: `bg-gray-50` → `bg-(--color-bg-secondary)`, `text-gray-900` → `text-(--color-text-primary)`.

## Theme Toggle

New atom: `src/components/ui/ThemeToggle.tsx`

- Sun icon (light mode) / Moon icon (dark mode)
- Uses `useTheme()` from `next-themes` to read/set theme
- Cycles between light and dark
- Renders as an icon button (no text label)
- Exported from `src/components/ui/index.ts`

Placement: nav bar in `src/app/(main)/layout.tsx`, right-aligned.

## Dependencies

- `next-themes` — theme management, SSR-safe
- No icon library added; sun/moon rendered as inline SVGs

## Out of Scope

- System/auto as a third toggle option (only light/dark for now)
- Per-page theme overrides
- Custom color theme picker
- Animation/transition between themes
