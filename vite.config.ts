import { defineConfig } from 'vite'

// base musí odpovídat názvu repozitáře na GitHub Pages:
// projekt je servírovaný z https://mrklas69.github.io/TrainsLab/
// V dev režimu (vite) zůstává base '/', při buildu se použije '/TrainsLab/'.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/TrainsLab/' : '/',
}))
