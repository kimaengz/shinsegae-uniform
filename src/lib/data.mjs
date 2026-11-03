// 제품 데이터(data/*.csv)를 읽고 검사한다. 사이트 빌드와 scripts/check-data.mjs가 함께 쓴다.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'data');
const IMG = path.join(ROOT, 'public', 'images', 'products');
const IMG_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
// 색상별 사진 5칸: 파일 이름 1~5 (예전 이름 front·back·neck·left·right도 읽음)
export const VIEWS = [['1', '사진 1', 'front'], ['2', '사진 2', 'back'], ['3', '사진 3', 'neck'], ['4', '사진 4', 'left'], ['5', '사진 5', 'right']];
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

// 사진 크기(가로·세로)를 파일 머리에서 읽는다: 화면이 사진 자리를 미리 잡아 밀리지 않게 (png · jpg · webp)
export function imageSize(rel) {
  try {
    const b = fs.readFileSync(path.join(ROOT, 'public', rel));
    if (b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
      const t = b.toString('ascii', 12, 16);
      if (t === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
      if (t === 'VP8L') { const n = b.readUInt32LE(21); return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 }; }
      if (t === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    }
    if (b[0] === 0xff && b[1] === 0xd8) {
      for (let i = 2; i < b.length;) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1], len = b.readUInt16BE(i + 2);
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
        i += 2 + len;
      }
    }
  } catch { /* 크기를 모르면 비워 둔다 */ }
  return null;
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
    const raw = Object.fromEntries(colors.map((c) => [c.slug, VIEWS.map(([v, , old]) => findImage(path.join(code, c.slug), v) ?? findImage(path.join(code, c.slug), old))]));
    // 썸네일은 thumb 파일이 없어도 기본 색 1번 사진이 대신하므로, 둘 다 없을 때만 알림
    const missing = [!ownThumb && !raw[colors[0]?.slug]?.[0] && '썸네일'].concat(colors.filter((c) => raw[c.slug].some((s) => !s)).map((c) => `${c.name} 사진 ${raw[c.slug].filter(Boolean).length}/5`)).filter(Boolean);
    if (missing.length) warn(`${code}: 이미지 없음(${missing.join(', ')}). 기본 사진(placeholder)으로 보입니다.`);
    // 빈 자리 채우기: 썸네일은 기본 색 앞면 → 기본 사진, 기본 색 앞면은 썸네일 → 기본 사진, 나머지는 기본 사진
    const thumb = ownThumb ?? raw[colors[0]?.slug]?.[0] ?? PLACEHOLDER;
    const gallery = Object.fromEntries(colors.map((c, ci) => [c.slug, VIEWS.map(([v, label], vi) => ({
      view: v, label, src: raw[c.slug][vi] ?? ((ci === 0 && vi === 0 && ownThumb) || PLACEHOLDER)
    }))]));
    // 카드에서 옆으로 넘겨 볼 사진: 실제로 올린 사진만 (기본 색은 썸네일이 맨 앞), 하나도 없으면 썸네일 한 장
    const cardImages = Object.fromEntries(colors.map((c, ci) => {
      const list = [...new Set([ci === 0 && ownThumb, ...raw[c.slug]].filter(Boolean))];
      return [c.slug, list.length ? list : [ci === 0 ? thumb : gallery[c.slug][0].src].filter(Boolean)];
    }));

    return {
      code, slug: code.toLowerCase(), category: r.category, name: r.name, type: r.type, summary: r.summary,
      colors, sizes: split(r.sizes), prices, isPublic: isPublic && site.showPrices !== false, embroidery,
      isNew: r.is_new.toUpperCase() === 'Y', badge: (r.badge ?? '') || (r.is_new.toUpperCase() === 'Y' ? 'NEW' : ''), material: r.material, function: r.function, care: r.care,
      order: Number(r.order) || 999, thumb, gallery, cardImages, details: detailImages(code)
    };
  }).sort((a, b) => a.order - b.order);

  // code 칸에 상품 코드(A01)를 쓰면 그 제품, 카테고리 id(scrubs)를 쓰면 그 카테고리 전체의 기본 사이즈표
  const sizeRows = readCsv('sizes.csv');
  const own = {}, byCat = {};
  sizeRows.forEach((r) => {
    const key = r.code.trim();
    const isCat = catIds.has(key);
    if (!isCat && !seen.has(key.toUpperCase())) err('sizes.csv', r._line, `"${key}"는 products.csv의 상품 코드도, categories.csv의 id도 아닙니다.`);
    const t = isCat ? (byCat[key] ??= {}) : (own[key.toUpperCase()] ??= {});
    (t[r.part] ??= []).push({ measure: r.measure, values: Object.fromEntries(Object.entries(r).filter(([k]) => !['code', 'part', 'measure', '_line'].includes(k))) });
  });
  const sizeTables = Object.fromEntries(products.map((p) => [p.code, own[p.code] ?? byCat[p.category]]).filter(([, t]) => t));

  const references = readCsv('references.csv').sort((a, b) => Number(a.order) - Number(b.order));
  return { site, categories, products, sizeTables, references, errors, warnings };
}

let cache;
export function data() {
  // 미리보기(dev)에서는 CSV 수정이 바로 보이도록 매번 다시 읽는다
  if (import.meta.env?.DEV) return loadData();
  return (cache ??= loadData());
}
