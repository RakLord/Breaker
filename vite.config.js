import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  // Relative base avoids hardcoding the repo name (GitHub Pages serves at /<repo>/).
  base: command === 'build' ? './' : '/',
}))
