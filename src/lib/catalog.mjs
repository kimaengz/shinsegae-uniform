// 제품 소개서(PDF)에 쓰는 도우미. 페이지는 src/pages/catalog/, PDF는 scripts/make-pdfs.mjs가 만든다
import QRCode from 'qrcode';

// [원단명 · 혼용률] 같은 자리표시는 아직 정보가 없다는 뜻 → 소개서에서는 그 줄을 숨긴다
export const isReal = (v) => Boolean(v && String(v).trim() && !/^\[.*\]$/.test(String(v).trim()));

// 소개서에 넣을 사진: 기본 색의 실제 사진 앞 4장 (기본 사진 placeholder는 뺀다)
export const sheetPhotos = (p) => p.gallery[p.colors[0].slug].map((g) => g.src).filter((s) => s && !s.includes('placeholder')).slice(0, 4);

export const qrSvg = (url) => QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#2b2725', light: '#0000' } });

// PDF 파일 경로 (public이 아니라 빌드 결과 dist/catalog/pdf/에 생긴다)
export const pdfPath = (key) => `catalog/pdf/${key}.pdf`;

export const issued = () => {
  const d = new Date(Date.now() + 9 * 3600e3); // 한국 시간
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월`;
};

// 페이지 안에서 실행: 크롬은 WebP를 PDF에 무압축으로 넣어 파일이 커진다 → 찍기 전에 제품 사진만 화면 크기 2배의 JPEG로 바꿔 둔다
// (로고 PNG는 투명 배경이라 JPEG로 바꾸면 검게 되므로 제외)
// (scripts/make-pdfs.mjs가 window.__ready를 기다린 뒤 PDF로 찍는다)
export const TO_JPEG = `
    window.__ready = Promise.all([...document.querySelectorAll('.p-photos img, .cover-img img')].map((img) => img.decode().then(() => {
      const r = img.getBoundingClientRect(), k = Math.min(2, img.naturalWidth / r.width);
      const c = document.createElement('canvas');
      c.width = Math.round(r.width * k); c.height = Math.round(r.height * k);
      const s = Math.max(c.width / img.naturalWidth, c.height / img.naturalHeight); // object-fit: cover, 위쪽 기준
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      c.getContext('2d').drawImage(img, (c.width - w) / 2, 0, w, h);
      img.src = c.toDataURL('image/jpeg', 0.82);
      return img.decode();
    })));
`;
