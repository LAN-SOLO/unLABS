## What

<!-- 1-2 sentences on the change. -->

## Why

<!-- Motivation. Link issues/tickets if relevant. -->

## How to verify

<!-- Steps a reviewer can run locally to see this working. -->

## Checklist

- [ ] `pnpm check` passes locally
- [ ] Migrations (if any) apply on a fresh `pnpm db:reset`
- [ ] `pnpm test:e2e` passes if UI or routing changed
- [ ] Screenshots attached for UI changes
