// 사이트 안 주소에 배포 경로(base)를 붙인다. u('products/') → /shinsegae-uniform/products/
// 이미지는 내용 해시를 ?v= 로 붙인다. 같은 파일 이름으로 사진을 바꿔도 브라우저가 옛 사진을 보여주지 않게.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');
const PUBLIC = path.resolve('public');
const IMG = /\.(webp|png|jpe?g|svg|avif|gif)$/i;
const memo = new Map();
const ver = (p) => {
  if (!memo.has(p)) {
    let v = '';
    try { v = crypto.createHash('md5').update(fs.readFileSync(path.join(PUBLIC, p))).digest('hex').slice(0, 8); } catch {}
    memo.set(p, v);
  }
  return memo.get(p);
};
export const u = (p = '') => {
  const clean = String(p).replace(/^\//, '');
  const v = IMG.test(clean) ? ver(clean) : '';
  return BASE + clean + (v ? `?v=${v}` : '');
};
export const won = (n) => Number(n).toLocaleString('ko-KR') + '원';
