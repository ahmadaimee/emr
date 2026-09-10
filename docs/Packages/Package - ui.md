---
tags: [packages]
---

# @grove/ui

`packages/ui` — Grove design tokens and shared primitives.

Tokens are defined once so light and dark themes stay consistent across every surface.

tokens.css defines the palette against both the data-theme attribute and .light/.dark classes, so either mechanism drives it; tokens.ts exposes the same values to TypeScript. Consumed by the [[Web Operator UI]].

---

Related: [[Packages Index]] · [[Architecture Overview]]
