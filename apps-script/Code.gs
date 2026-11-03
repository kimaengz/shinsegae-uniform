/**
 * 신세계유니폼 견적 접수 (Google Apps Script)
 * 홈페이지 견적함 → 이 스크립트 → 구글 시트 한 줄 + 드라이브 첨부 저장 + 담당자·고객 메일
 * 설치 방법은 docs/견적접수-설치.md 참고.
 */

// 담당자 알림을 받을 메일 주소
const STAFF_EMAIL = '[담당자 이메일]';
const COMPANY = '신세계유니폼';
const STATUSES = ['접수', '상담 중', '샘플 발송', '계약', '보류'];
const HEADERS = ['접수일시', '접수번호', '상태', '병원·기관명', '담당자', '연락처', '이메일', '희망 납기',
  '품목', '총 수량', '예상 금액(참고)', '관심 카테고리', '예상 수량', '요청사항', '로고 파일', '메모'];

/** 처음 한 번 실행: 시트 머리줄, 상태 드롭다운, 첨부 저장 폴더를 만든다. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets()[0];
  sheet.setName('견적');
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#f7f2ec');
  sheet.setFrozenRows(1);
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build();
  sheet.getRange(2, 3, sheet.getMaxRows() - 1, 1).setDataValidation(rule);
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('FOLDER_ID')) {
    const folder = DriveApp.createFolder(`${COMPANY} 견적 첨부파일`);
    props.setProperty('FOLDER_ID', folder.getId());
  }
  props.setProperty('SHEET_ID', ss.getId());
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const q = JSON.parse(e.postData.contents);
    if (q.website) return text('ignored'); // 스팸 함정 칸이 채워진 요청
    const props = PropertiesService.getScriptProperties();
    const sheet = SpreadsheetApp.openById(props.getProperty('SHEET_ID')).getSheets()[0];
    const folder = DriveApp.getFolderById(props.getProperty('FOLDER_ID'));

    const sub = q.logo ? folder.createFolder(`${q.id} ${q.org}`) : null;
    const save = (f, label) => {
      if (!f || !f.data) return '';
      const blob = Utilities.newBlob(Utilities.base64Decode(f.data), f.type, `${label}_${f.name}`);
      return sub.createFile(blob).getUrl();
    };
    const logoUrl = save(q.logo, '로고');

    const items = (q.items || []).map((it) => {
      const sizes = Object.entries(it.qty).map(([s, n]) => `${s} ${n}`).join(', ');
      return `${it.code} ${it.name} / ${it.color} / ${sizes} (${it.total}벌) / 자수 ${it.embroidery}`;
    });
    const totalQty = (q.items || []).reduce((a, it) => a + it.total, 0);
    const estimate = (q.items || []).reduce((a, it) => a + (it.estimate || 0), 0);

    sheet.appendRow([new Date(), q.id, '접수', q.org, q.name, "'" + q.tel, q.email, q.due,
      items.join('\n'), totalQty || '', estimate || '', (q.interest || []).join(', '), q.expectedQty,
      q.message, logoUrl, '']);

    const summary = [
      `접수번호: ${q.id}`, `기관: ${q.org}`, `담당자: ${q.name}`, `연락처: ${q.tel}`, `이메일: ${q.email || '-'}`, `희망 납기: ${q.due || '-'}`, '',
      items.length ? '[품목]\n' + items.join('\n') : `[일반 문의] 관심: ${(q.interest || []).join(', ') || '-'} / 예상 수량: ${q.expectedQty || '-'}`,
      totalQty ? `총 ${totalQty}벌 · 예상 금액(참고) ${estimate.toLocaleString('ko-KR')}원` : '', '',
      `[요청사항]\n${q.message || '-'}`, '',
      logoUrl ? `로고: ${logoUrl}` : ''
    ].filter((l) => l !== null).join('\n');

    MailApp.sendEmail({
      to: STAFF_EMAIL,
      subject: `[견적 요청] ${q.org} · ${totalQty ? totalQty + '벌' : '일반 문의'}`,
      body: summary + `\n\n시트: ${SpreadsheetApp.openById(props.getProperty('SHEET_ID')).getUrl()}`,
      replyTo: q.email || STAFF_EMAIL
    });
    if (q.email) {
      MailApp.sendEmail({
        to: q.email,
        subject: `[${COMPANY}] 견적 요청이 접수되었습니다 (${q.id})`,
        body: `${q.name}님, 견적 요청을 받았습니다. 담당자가 확인 후 연락드리겠습니다.\n\n${summary}\n\n${COMPANY}`,
        name: COMPANY
      });
    }
    return text('ok');
  } catch (err) {
    console.error(err);
    return text('error');
  } finally {
    lock.releaseLock();
  }
}

function text(s) {
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT);
}
