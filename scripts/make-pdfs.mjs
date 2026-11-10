// 빌드 뒤에 제품 소개서 PDF와 링크 미리보기 사진을 만든다 (astro build 다음에 실행)
//   dist/catalog/pdf/<CODE>.pdf        제품 한 장
//   dist/catalog/pdf/cover-<id>.pdf     표지 (all · selection · 카테고리)
//   dist/catalog/pdf/category-<id>.pdf  카테고리 카탈로그 = 표지 + 그 카테고리 제품
//   dist/catalog/pdf/all.pdf            전체 카탈로그 = 표지 + 모든 제품
// 견적함의 '담은 제품 소개서'는 브라우저가 cover-selection + 제품 PDF를 이어 붙여 만든다.
// 컴퓨터에 설치된 Chrome으로 찍는다 (GitHub Actions의 ubuntu에도 Chrome이 기본으로 있음).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright-core';
import { PDFDocument } from 'pdf-lib';
import { data } from '../src/lib/data.mjs';

const DIST = path.resolve('dist');
const BASE = (process.env.BASE_PATH ?? '/shinsegae-uniform').replace(/\/$/, '');
const OUT = path.join(DIST, 'catalog', 'pdf');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

// dist를 배포 경로(/shinsegae-uniform/) 그대로 띄우는 작은 서버
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!p.startsWith(BASE + '/')) { res.writeHead(404).end(); return; }
  p = path.join(DIST, p.slice(BASE.length));
  if (p.endsWith(path.sep) || (fs.existsSync(p) && fs.statSync(p).isDirectory())) p = path.join(p, 'index.html');
  if (!p.startsWith(DIST) || !fs.existsSync(p)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] ?? 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}${BASE}`;

const { products, categories } = data();
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const shoot = async (route, file) => {
  await page.goto(`${origin}/${route}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => Promise.all([document.fonts.ready, window.__ready]));
  await page.pdf({ path: path.join(OUT, file), preferCSSPageSize: true, printBackground: true });
};

try {
  for (const p of products) await shoot(`catalog/${p.slug}/`, `${p.code}.pdf`);
  for (const id of ['all', 'selection', ...categories.map((c) => c.id)]) await shoot(`catalog/cover/${id}/`, `cover-${id}.pdf`);
  // 링크 미리보기 사진(og:image): src/pages/og/ → dist/og/<key>.jpg
  const OG = path.join(DIST, 'og');
  await page.setViewportSize({ width: 1200, height: 630 });
  const keys = fs.readdirSync(OG).filter((f) => fs.statSync(path.join(OG, f)).isDirectory());
  for (const key of keys) {
    await page.goto(`${origin}/og/${key}/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
    await page.screenshot({ path: path.join(OG, `${key}.jpg`), type: 'jpeg', quality: 85 });
    fs.rmSync(path.join(OG, key), { recursive: true });
  }
  console.log(`미리보기 사진 ${keys.length}개 → dist/og/`);
} finally {
  await browser.close();
  server.close();
}

// 표지 + 제품들을 한 파일로
const merge = async (file, parts) => {
  const doc = await PDFDocument.create();
  doc.setTitle(file.replace('.pdf', ''));
  for (const part of parts) {
    const src = await PDFDocument.load(fs.readFileSync(path.join(OUT, part)));
    (await doc.copyPages(src, src.getPageIndices())).forEach((pg) => doc.addPage(pg));
  }
  fs.writeFileSync(path.join(OUT, file), await doc.save());
};
for (const c of categories) await merge(`category-${c.id}.pdf`, [`cover-${c.id}.pdf`, ...products.filter((p) => p.category === c.id).map((p) => `${p.code}.pdf`)]);
await merge('all.pdf', ['cover-all.pdf', ...products.map((p) => `${p.code}.pdf`)]);

// 소개서용 HTML은 PDF를 만들 때만 필요하다. 배포본에서는 지워 검색 · 직접 접속에 노출되지 않게
fs.readdirSync(path.join(DIST, 'catalog')).filter((f) => f !== 'pdf').forEach((f) => fs.rmSync(path.join(DIST, 'catalog', f), { recursive: true }));

const size = fs.readdirSync(OUT).reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`소개서 PDF ${fs.readdirSync(OUT).length}개 (${(size / 1024 / 1024).toFixed(1)}MB) → dist/catalog/pdf/`);
