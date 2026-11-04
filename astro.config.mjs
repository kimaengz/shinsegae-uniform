import { defineConfig, passthroughImageService } from 'astro/config';

// GitHub Pages 가안: https://kimaengz.github.io/shinsegae-uniform/
// 자체 도메인으로 옮기면 SITE를 바꾸고 BASE를 '/'로 둡니다.
const SITE = process.env.SITE_URL ?? 'https://kimaengz.github.io';
const BASE = process.env.BASE_PATH ?? '/shinsegae-uniform';

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'always',
  // CSS를 각 페이지 HTML 안에 넣는다. GitHub Pages는 HTML을 10분 캐시하는데, 배포하면 이름에 해시가 붙은
  // 예전 CSS 파일이 지워져서, 캐시된 옛 HTML로 이동하면 스타일 없는 화면이 뜬다. 안에 넣으면 그런 어긋남이 없다.
  build: { format: 'directory', inlineStylesheets: 'always' },
  image: { service: passthroughImageService() }
});
