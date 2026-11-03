# 신세계유니폼 홈페이지

병원·기관 단체 견적을 받는 B2B 메디컬 유니폼 사이트입니다. Astro로 만든 정적 사이트이고, GitHub Pages에 자동 배포됩니다.

- 담당자용 수정 방법: [docs/제품-수정-안내.md](docs/제품-수정-안내.md)
- 견적 접수(구글 시트·메일) 연결: [docs/견적접수-설치.md](docs/견적접수-설치.md)

## 구조

| 경로 | 내용 |
| --- | --- |
| `data/` | 제품·카테고리·사이즈·납품 실적 CSV, 회사 정보 `site.json` |
| `public/images/products/` | 제품 이미지 (상품 코드별 폴더) |
| `src/pages/` | 페이지 |
| `src/styles/` | 디자인 시스템 토큰과 컴포넌트 스타일 |
| `scripts/check-data.mjs` | 배포 전 데이터 검사 |
| `apps-script/Code.gs` | 견적 접수 구글 Apps Script |

## 개발

```bash
npm install
npm run dev
```

`npm run build`는 데이터 검사를 먼저 하고, 오류가 있으면 빌드를 멈춥니다. 자체 도메인으로 옮길 때는 `astro.config.mjs`의 `SITE`와 `BASE`를 바꿉니다.

서체는 [Pretendard](https://github.com/orioncactus/pretendard) (SIL Open Font License 1.1)를 `public/fonts/pretendard/`에 두고 씁니다.
