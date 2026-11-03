import { defineConfig, passthroughImageService } from 'astro/config';

// GitHub Pages 가안: https://kimaengz.github.io/shinsegae-uniform/
// 자체 도메인으로 옮기면 SITE를 바꾸고 BASE를 '/'로 둡니다.
const SITE = process.env.SITE_URL ?? 'https://kimaengz.github.io';
const BASE = process.env.BASE_PATH ?? '/shinsegae-uniform';

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'always',
  build: { format: 'directory' },
  image: { service: passthroughImageService() }
});
