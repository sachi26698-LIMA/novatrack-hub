---
name: Tailwind CSS v4 Vite setup
description: How Tailwind v4 is configured in this TanStack Start project
---

# Tailwind CSS v4 Vite Setup

## Key facts
- Tailwind CSS v4 does NOT use `tailwind.config.js` or `postcss.config.js`
- It requires the `@tailwindcss/vite` package as a Vite plugin
- CSS entry is `src/styles.css` (imported in `src/routes/__root.tsx` as `appCss?url`)

## Configuration
```ts
// vite.config.ts
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [tailwindcss(), ...],
});
```

```css
/* src/styles.css */
@import "tailwindcss" source(none);
@import "tw-animate-css";
@source "../src";   /* scans src/ for class names */
```

**Why:** Without `@tailwindcss/vite`, Vite never processes the CSS — the stylesheet loads but Tailwind classes produce no output. This was the root cause of the "no styling" bug.

**How to apply:** If styles ever break again, first check that `@tailwindcss/vite` is in devDependencies and registered first in the plugins array.
