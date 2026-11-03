// 배포 전 제품 데이터 검사. 오류가 있으면 배포를 멈추고 어느 줄인지 알려 준다.
import { loadData } from '../src/lib/data.mjs';

const { products, errors, warnings } = loadData();

if (warnings.length) {
  console.log(`\n참고 (${warnings.length}건, 배포는 계속됩니다)`);
  warnings.forEach((w) => console.log('  - ' + w));
}
if (errors.length) {
  console.error(`\n데이터 오류 ${errors.length}건. 아래 줄을 고친 뒤 다시 저장해 주세요.`);
  errors.forEach((e) => console.error('  ✗ ' + e));
  process.exit(1);
}
console.log(`\n제품 ${products.length}건 검사 완료. 오류 없음.`);
