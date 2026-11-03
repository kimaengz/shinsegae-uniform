// 견적함: 브라우저에 저장. 한 줄 = 제품 + 색상.
const KEY = 'su-quote-cart-v1';

export function getCart() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function saveCart(cart) {
  try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch { /* 저장 불가(사생활 보호 모드 등)면 이 페이지 안에서만 유지 */ }
  renderCount();
}
export const lineTotal = (l) => Object.values(l.qty || {}).reduce((a, n) => a + (Number(n) || 0), 0);

// 같은 제품·같은 색이면 수량을 더하고 자수 옵션은 새 값으로 바꾼다. 합쳐졌으면 true
export function addLine(line) {
  const cart = getCart();
  const ex = cart.find((l) => l.code === line.code && l.color === line.color);
  if (ex) {
    for (const [k, v] of Object.entries(line.qty)) ex.qty[k] = (Number(ex.qty[k]) || 0) + (Number(v) || 0);
    ex.emb = line.emb;
  } else cart.push(line);
  saveCart(cart);
  return !!ex;
}

export function renderCount() {
  const n = getCart().length;
  document.querySelectorAll('[data-cart-count]').forEach((el) => {
    el.textContent = String(n);
    el.hidden = n === 0;
    el.setAttribute('aria-label', `담은 제품 ${n}개`);
  });
}

let timer;
export function toast(message, action) {
  const host = document.getElementById('toast-host');
  if (!host) return;
  clearTimeout(timer);
  host.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'su-toast';
  const msg = document.createElement('span');
  msg.textContent = message;
  box.append(msg);
  if (action) {
    const el = action.href ? document.createElement('a') : document.createElement('button');
    el.textContent = action.label;
    if (action.href) el.href = action.href; else { el.type = 'button'; el.onclick = () => { host.innerHTML = ''; action.onClick(); }; }
    box.append(el);
  }
  host.append(box);
  timer = setTimeout(() => { host.innerHTML = ''; }, 5000);
}

// 자수 요약: { logo: ['왼가슴'] | [] | null, name: ... } → "로고(왼가슴) · 이름(위치 상담)"
export function embText(e) {
  if (!e) return '없음';
  if ('type' in e) return e.type === '없음' ? '없음' : `${e.type} (${(e.pos || []).join(', ') || '위치 상담'})`; // 예전 형식
  const part = (label, pos) => (pos ? `${label}(${pos.join(', ') || '위치 상담'})` : '');
  return [part('로고', e.logo), part('이름', e.name)].filter(Boolean).join(' · ') || '없음';
}
