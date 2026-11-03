// 사이트 안 주소에 배포 경로(base)를 붙인다. u('products/') → /shinsegae-uniform/products/
const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');
export const u = (p = '') => BASE + String(p).replace(/^\//, '');
export const won = (n) => Number(n).toLocaleString('ko-KR') + '원';
