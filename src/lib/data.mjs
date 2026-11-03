// 제품 데이터(data/*.csv)를 읽고 검사한다. 사이트 빌드와 scripts/check-data.mjs가 함께 쓴다.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'data');
const IMG = path.join(ROOT, 'public', 'images', 'products');
const IMG_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
export const VIEWS = [['front', '앞면'], ['back', '뒷면'], ['neck', '목뒤'], ['left', '왼팔'], ['right', '오른팔']];
const EMBROIDERY = ['왼가슴', '오른가슴', '소매', '등'];
// 제품 사진이 아직 없는 자리에 보여줄 기본 사진 (720×1080)
const PLACEHOLDER = fs.existsSync(path.join(ROOT, 'public', 'images', 'placeholder.png')) ? 'images/placeholder.png' : null;

// 따옴표·쉼표·줄바꿈이 든 칸까지 읽는 CSV 파서
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  // BOM 제거, Mac에서 입력한 분리형 한글(NFD)을 완성형(NFC)으로 통일
  text = text.replace(/^﻿/, '').normalize('NFC');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ''));
  return body.map((r, i) => Object.fromEntries(head.map((h, j) => [h.trim(), (r[j] ?? '').trim()]).concat([['_line', i + 2]])));
}

const readCsv = (name) => parseCsv(fs.readFileSync(path.join(DATA, name), 'utf8'));
const split = (v) => (v ? v.split('|').map((s) => s.trim()).filter(Boolean) : []);

function findImage(dir, base) {
  for (const ext of IMG_EXT) {
    const rel = path.join(dir, base + ext);
    if (fs.existsSync(path.join(IMG, rel))) return 'images/products/' + rel.split(path.sep).join('/');
  }
  return null;
}

// 사이트 사진(홈 상단, 카테고리 등): public/images/<base>.jpg|png|webp가 있으면 그 사진, 없으면 기본 사진
export function siteImage(base) {
  for (const ext of IMG_EXT) {
    if (fs.existsSync(path.join(ROOT, 'public', 'images', base + ext))) return `images/${base}${ext}`;
  }
  return PLACEHOLDER;
}

function detailImages(code) {
  const dir = path.join(IMG, code);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => /^detail-\d+\.(jpe?g|png|webp)$/i.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10))
    .map((f) => `images/products/${code}/${f}`);
}

export function loadData() {
  const errors = [], warnings = [];
  const err = (file, line, msg) => errors.push(`${file} ${line}번째 줄: ${msg}`);
  const warn = (msg) => warnings.push(msg);

  const site = JSON.parse(fs.readFileSync(path.join(DATA, 'site.json'), 'utf8'));
  const categories = readCsv('categories.csv').sort((a, b) => Number(a.order) - Number(b.order))
    .map((c) => ({ ...c, image: siteImage(`categories/${c.id}`) }));
  const catIds = new Set(categories.map((c) => c.id));
  categories.forEach((c) => { if (!/^[a-z0-9-]+$/.test(c.id)) err('categories.csv', c._line, `id "${c.id}"는 영문 소문자·숫자·-만 쓸 수 있습니다.`); });

  const seen = new Set();
  const products = readCsv('products.csv').map((r) => {
    const F = 'products.csv', L = r._line;
    const code = r.code.toUpperCase();
    if (!/^[A-Z][0-9]{2,3}$/.test(code)) err(F, L, `상품 코드 "${r.code}" 형식이 틀렸습니다. 예: A01`);
    if (seen.has(code)) err(F, L, `상품 코드 ${code}가 두 번 있습니다.`);
    seen.add(code);
    if (!catIds.has(r.category)) err(F, L, `카테고리 "${r.category}"가 categories.csv에 없습니다.`);
    if (!r.name) err(F, L, '제품명(name)이 비어 있습니다.');

    const colors = split(r.colors).map((c) => {
      const [name, slug, hex] = c.split(':').map((s) => (s ?? '').trim());
      if (!name || !/^[a-z0-9-]+$/.test(slug ?? '') || !/^#[0-9A-Fa-f]{6}$/.test(hex ?? '')) err(F, L, `색상 "${c}" 형식이 틀렸습니다. 예: 와인:wine:#6E2236`);
      return { name, slug, hex };
    });
    if (!colors.length) err(F, L, '색상(colors)이 하나 이상 있어야 합니다.');

    const isPublic = r.price_public.toUpperCase() === 'Y';
    const prices = [r.price_10, r.price_50, r.price_100].map((v) => (v === '' ? null : Number(v.replace(/,/g, ''))));
    if (isPublic && prices.some((v) => v === null || !Number.isFinite(v) || v <= 0)) err(F, L, '단가 공개(Y)인데 price_10·price_50·price_100 중 숫자가 아닌 칸이 있습니다.');
    if (!['Y', 'N'].includes(r.price_public.toUpperCase())) err(F, L, 'price_public은 Y 또는 N만 쓸 수 있습니다.');
    if (!['Y', 'N'].includes(r.is_new.toUpperCase())) err(F, L, 'is_new는 Y 또는 N만 쓸 수 있습니다.');

    const embroidery = split(r.embroidery);
    embroidery.forEach((e) => { if (!EMBROIDERY.includes(e)) err(F, L, `자수 위치 "${e}"는 쓸 수 없습니다. (${EMBROIDERY.join(', ')})`); });

    const ownThumb = findImage(code, 'thumb');
    const raw = Object.fromEntries(colors.map((c) => [c.slug, VIEWS.map(([v]) => findImage(path.join(code, c.slug), v))]));
    const missing = [!ownThumb && '썸네일'].concat(colors.filter((c) => raw[c.slug].some((s) => !s)).map((c) => `${c.name} 멀티뷰`)).filter(Boolean);
    if (missing.length) warn(`${code}: 이미지 없음(${missing.join(', ')}). 기본 사진(placeholder)으로 보입니다.`);
    // 빈 자리 채우기: 썸네일은 기본 색 앞면 → 기본 사진, 기본 색 앞면은 썸네일 → 기본 사진, 나머지는 기본 사진
    const thumb = ownThumb ?? raw[colors[0]?.slug]?.[0] ?? PLACEHOLDER;
    const gallery = Object.fromEntries(colors.map((c, ci) => [c.slug, VIEWS.map(([v, label], vi) => ({
      view: v, label, src: raw[c.slug][vi] ?? ((ci === 0 && vi === 0 && ownThumb) || PLACEHOLDER)
    }))]));

    return {
      code, slug: code.toLowerCase(), category: r.category, name: r.name, type: r.type, summary: r.summary,
      colors, sizes: split(r.sizes), prices, isPublic: isPublic && site.showPrices !== false, embroidery,
      isNew: r.is_new.toUpperCase() === 'Y', badge: (r.badge ?? '') || (r.is_new.toUpperCase() === 'Y' ? 'NEW' : ''), material: r.material, function: r.function, care: r.care,
      order: Number(r.order) || 999, thumb, gallery, details: detailImages(code)
    };
  }).sort((a, b) => a.order - b.order);

  const sizeRows = readCsv('sizes.csv');
  const sizeTables = {};
  sizeRows.forEach((r) => {
    const code = r.code.toUpperCase();
    if (!seen.has(code)) err('sizes.csv', r._line, `상품 코드 ${code}가 products.csv에 없습니다.`);
    const t = (sizeTables[code] ??= {});
    (t[r.part] ??= []).push({ measure: r.measure, values: Object.fromEntries(Object.entries(r).filter(([k]) => !['code', 'part', 'measure', '_line'].includes(k))) });
  });

  const references = readCsv('references.csv').sort((a, b) => Number(a.order) - Number(b.order));
  return { site, categories, products, sizeTables, references, errors, warnings };
}

let cache;
export function data() {
  // 미리보기(dev)에서는 CSV 수정이 바로 보이도록 매번 다시 읽는다
  if (import.meta.env?.DEV) return loadData();
  return (cache ??= loadData());
}
