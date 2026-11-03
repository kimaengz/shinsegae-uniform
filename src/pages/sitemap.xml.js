// 검색엔진용 사이트맵: 모든 페이지 주소 목록 (빌드할 때 제품 데이터로 만든다)
import { data } from '../lib/data.mjs';
import { u } from '../lib/url.mjs';

export function GET({ site }) {
  const { categories, products } = data();
  const paths = ['', 'new/', 'products/', 'references/', 'about/', 'quote/', 'privacy/',
    ...categories.map((c) => `products/${c.id}/`),
    ...products.map((p) => `products/${p.category}/${p.slug}/`)];
  const body = paths.map((p) => `  <url><loc>${new URL(u(p), site).href}</loc></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
