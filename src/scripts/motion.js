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

// 카드(썸네일)는 움직이지 않는다
