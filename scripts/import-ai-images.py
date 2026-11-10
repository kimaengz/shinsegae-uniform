#!/usr/bin/env python3
"""GPT가 만든 제품 사진(신세계유니폼_AI_완성)을 사이트 사진으로 옮긴다.

- 작업목록.csv에서 상태가 '완료'인 것만 쓴다. 단 재생성에서 '검토 필요'로 보류된 컷은 재생성 신규 파일을 쓴다
- 제품 폴더 이름 앞의 코드(A01 등)로 products.csv의 제품을 찾고, 그 제품의 기본 색(맨 앞 색) 폴더에 넣는다
- 순서: 정면 → 뒷면 → 옆면 → 디테일 (같은 종류 안에서는 상의 먼저, '(바지)' 다음)
- 정사각형 원본을 가운데 기준 2:3으로 잘라 960×1440 WebP로 줄인다 (장당 수 MB → 수십 KB)
- 바뀐 제품만 다시 만든다 (data/ai-images.json에 원본 시각을 기록). 그 제품 기본 색의 기존 사진은 교체된다

사용: python3 scripts/import-ai-images.py   (원본 폴더를 바꾸려면 AI_SRC 환경 변수)
"""
import csv, json, os, re, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get('AI_SRC', '/Users/haremi/chat gpt/신세계유니폼_AI_완성')
OUT = os.path.join(ROOT, 'public', 'images', 'products')
MANIFEST = os.path.join(ROOT, 'data', 'ai-images.json')
SIZE = (960, 1440)
CUT_ORDER = {'front': 0, 'back': 1, 'side': 2, 'detail': 3}


def nfc(s):
    import unicodedata
    return unicodedata.normalize('NFC', s)


def default_colors():
    """products.csv: 코드 → 기본 색 slug (colors 칸의 맨 앞 '이름:slug:#hex')."""
    out = {}
    with open(os.path.join(ROOT, 'data', 'products.csv'), encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            first = (r.get('colors') or '').split('|')[0].split(':')
            if r.get('code') and len(first) >= 2:
                out[r['code'].strip()] = first[1].strip()
    return out


def sort_key(row):
    name = os.path.splitext(nfc(row['원본명']))[0]
    named = bool(re.match(r'[A-Z]\d{2}_', name))                    # A01_front … / 20261028_154057 같은 촬영 원본 이름
    stem = name.split('_', 1)[1] if named else name                 # A01_front(바지) → front(바지)
    cut = (row.get('컷유형') or stem.split('_')[0].split('(')[0]).strip().lower()
    num = int(m.group(1)) if (m := re.search(r'(\d+)', stem)) else 0  # side, side1, side2 …
    # 같은 종류 안에서: 코드로 이름 붙인 컷(상의) → '(바지)' · 날짜 이름 컷(하의 등 추가 컷)
    return (CUT_ORDER.get(cut, 9), not named or '(' in stem, re.sub(r'\d+', '', stem) if named else '', num if named else name)


def main():
    csv_path = os.path.join(SRC, '작업목록.csv')
    if not os.path.exists(csv_path):
        sys.exit(f'작업목록.csv가 없습니다: {csv_path}')
    # 재생성에서 '검토 필요'로 보류된 컷은 재생성 신규 파일을 쓴다 (사용자 확인 후 사용 결정, 2026-11-10)
    held = {}
    regen = os.path.join(SRC, '재생성_교체작업목록.csv')
    if os.path.exists(regen):
        with open(regen, encoding='utf-8-sig') as f:
            for r in csv.DictReader(f):
                if r.get('상태', '').strip() == '검토 필요' and os.path.exists(r.get('신규파일', '')):
                    held[nfc(r['상대경로'])] = r['신규파일']
    with open(csv_path, encoding='utf-8-sig') as f:
        rows = []
        for r in csv.DictReader(f):
            st = r.get('상태', '').strip()
            if st == '검토 필요' and nfc(r['상대경로']) in held:
                r['결과파일'] = held[nfc(r['상대경로'])]
            elif st != '완료':
                continue
            if os.path.exists(r.get('결과파일', '')):
                rows.append(r)

    colors = default_colors()
    groups = {}
    for r in rows:
        folder = nfc(r['상대경로']).split('/')[1]
        m = re.match(r'([A-Z]\d{2})', folder)
        if not m:
            continue
        groups.setdefault(m.group(1), []).append(r)

    manifest = json.load(open(MANIFEST, encoding='utf-8')) if os.path.exists(MANIFEST) else {}
    changed = []
    for code, items in sorted(groups.items()):
        slug = colors.get(code)
        if not slug:
            print(f'건너뜀 {code}: products.csv에 없는 제품')
            continue
        items.sort(key=sort_key)
        sig = [[nfc(os.path.basename(r['결과파일'])), int(os.path.getmtime(r['결과파일']))] for r in items]
        if manifest.get(code) == {'color': slug, 'files': sig}:
            continue
        dest = os.path.join(OUT, code, slug)
        os.makedirs(dest, exist_ok=True)
        for f in os.listdir(dest):                                  # 이 색의 예전 사진은 교체
            if re.fullmatch(r'\d+\.(jpe?g|png|webp)', f, re.I) or re.fullmatch(r'(front|back|neck|left|right)\.(jpe?g|png|webp)', f, re.I):
                os.remove(os.path.join(dest, f))
        for i, r in enumerate(items, 1):
            im = Image.open(r['결과파일']).convert('RGB')
            w, h = im.size
            cw = min(w, round(h * 2 / 3)); ch = min(h, round(w * 3 / 2))  # 가운데 기준 2:3
            left, top = (w - cw) // 2, (h - ch) // 2
            im.crop((left, top, left + cw, top + ch)).resize(SIZE, Image.LANCZOS).save(
                os.path.join(dest, f'{i}.webp'), 'WEBP', quality=80, method=6)
        manifest[code] = {'color': slug, 'files': sig}
        changed.append(f'{code}({slug}) {len(items)}장')

    with open(MANIFEST, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print('반영: ' + ', '.join(changed) if changed else '바뀐 사진 없음')


if __name__ == '__main__':
    main()
