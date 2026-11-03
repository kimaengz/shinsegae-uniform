// 상호작용 · 모션: 리플, 헤더 그림자, 스크롤 등장, 사진 페이드인 (styles/motion.css와 짝)
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// 누른 자리에서 퍼지는 리플
const RIPPLE = '.su-btn, .su-chip, .icon-btn, .su-select-btn, .su-qty-ctrl button, .gal-arrow';
if (!reduce) {
  document.addEventListener('pointerdown', (e) => {
    const el = e.target instanceof Element ? e.target.closest(RIPPLE) : null;
    if (!el || el.disabled) return;
    const r = el.getBoundingClientRect();
    const size = Math.hypot(r.width, r.height) * 2;
    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    el.append(dot);
    dot.addEventListener('animationend', () => dot.remove());
  });
}

// 스크롤하면 헤더에 그림자
const hd = document.querySelector('.hd');
if (hd) {
  const onScroll = () => hd.classList.toggle('is-scrolled', scrollY > 4);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// 사진은 받은 뒤에 부드럽게 (이미 받은 사진은 그대로)
const fadeIn = (img) => {
  if (img.complete) return;
  img.classList.add('is-loading');
  const done = () => img.classList.remove('is-loading');
  img.addEventListener('load', done, { once: true });
  img.addEventListener('error', done, { once: true });
};
document.querySelectorAll('main img').forEach(fadeIn);

// 화면에 들어오면 아래에서 올라오며 나타남. 같은 줄의 카드는 조금씩 늦게
const REVEAL = [
  'main .sec-h', 'main .page-h', '.trust > div', '.su-card', '.cat-card', '.cards > *', '.ref-grid li',
  '.ref-group-h', '.history li', '.cta', '.detail-imgs img'
].join(',');
if (!reduce && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      io.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  const items = [...document.querySelectorAll(REVEAL)].filter((el) => !el.closest('.hero'));
  items.forEach((el) => {
    // 첫 화면에 이미 보이는 것은 그대로 둔다 (깜빡임 방지)
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight * 0.9) return;
    const sibs = el.parentElement ? [...el.parentElement.children] : [el];
    el.style.setProperty('--delay', `${Math.min(sibs.indexOf(el) % 4, 3) * 60}ms`);
    el.classList.add('reveal');
    io.observe(el);
  });
}
