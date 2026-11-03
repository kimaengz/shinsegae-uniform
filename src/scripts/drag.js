// PC에서 마우스로 끌어서 옆으로 넘기기 (터치·트랙패드는 브라우저 기본 스크롤 그대로)
export function dragScroll(track) {
  let startX = 0, startLeft = 0, startIndex = 0, dx = 0, down = false, moved = false;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || track.children.length < 2) return;
    e.preventDefault();
    down = true; moved = false; dx = 0;
    startX = e.clientX; startLeft = track.scrollLeft;
    startIndex = Math.round(startLeft / (track.clientWidth || 1));
    track.style.scrollSnapType = 'none';
    track.style.cursor = 'grabbing';
  });
  window.addEventListener('pointermove', (e) => {
    if (!down) return;
    dx = e.clientX - startX;
    if (Math.abs(dx) > 5) moved = true;
    track.scrollLeft = startLeft - dx;
  });
  window.addEventListener('pointerup', () => {
    if (!down) return;
    down = false;
    track.style.cursor = '';
    const w = track.clientWidth || 1;
    const i = Math.max(0, Math.min(track.children.length - 1, startIndex + (dx < -40 ? 1 : dx > 40 ? -1 : 0)));
    track.style.scrollSnapType = '';
    track.scrollTo({ left: i * w, behavior: 'smooth' });
  });
  // 끌었으면 손을 뗄 때의 클릭(카드 링크 이동 등)은 무시
  track.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
}
