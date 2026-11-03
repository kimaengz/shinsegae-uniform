// 검색엔진 안내: 모두 허용, 사이트맵 위치 (자체 도메인으로 옮기면 그 도메인 기준으로 자동으로 바뀜)
import { u } from '../lib/url.mjs';

export function GET({ site }) {
  return new Response(`User-agent: *\nAllow: /\nDisallow: ${u('quote/complete/')}\n\nSitemap: ${new URL(u('sitemap.xml'), site).href}\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
