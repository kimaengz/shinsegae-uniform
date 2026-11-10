// 상호작용 · 모션: 헤더 선, 사진 카드 등장, 사진 페이드인 (styles/motion.css와 짝)
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
// 상세 정보 사진은 길게 이어 보는 사진이라 모션 없이 바로 보인다
document.querySelectorAll('main img:not(.detail-imgs img)').forEach(fadeIn);

// 화면에 들어오면 아래에서 올라오며 나타남. 같은 줄의 카드는 조금씩 늦게
// 글 · 숫자 · 표는 읽을 대상이라 움직이지 않는다. 사진 카드에만
const REVEAL = '.su-card, .cat-card';
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
    el.style.setProperty('--delay', `${Math.min(sibs.indexOf(el) % 4, 3) * 50}ms`);
    el.classList.add('reveal');
    io.observe(el);
  });
}
