#!/usr/bin/env python3
"""디자이너 컬러 폴더(제품별 · 색상별 사진)를 사이트에 반영한다.

폴더 구조:  <카테고리 번호.이름>/<제품명>/<색상 이름>[(완)]/<색상>_<번호>.png|webp
- 제품: 폴더의 제품명을 products.csv의 이름으로 찾는다 (이름이 바뀐 제품은 RENAMED 표로). 폴더 이름이 새 제품명이 된다
- 색상: 색상 폴더가 그 제품의 색상 옵션이 된다. 기본 색(맨 앞)은 지금 사이트의 기본 색을 유지하고, 나머지는 폴더 순서
- 사진: 파일 이름의 번호 순서대로 960×1440 WebP로 바꿔 public/images/products/<코드>/<색 slug>/1..N.webp
  사진이 없는 색상 폴더는 옵션만 추가된다 (사진은 기본 사진으로 보임)
- 이 스크립트로 반영한 제품은 data/color-images.json에 기록 → AI 자동 동기화(import-ai-images.py)가 덮어쓰지 않는다

사용: python3 scripts/import-color-folder.py   (원본 폴더를 바꾸려면 COLOR_SRC 환경 변수)
"""
import csv, io, json, os, re, shutil, sys, unicodedata
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get('COLOR_SRC', os.path.expanduser('~/Desktop/신세계 컬러별 폴더'))
OUT = os.path.join(ROOT, 'public', 'images', 'products')
CSV = os.path.join(ROOT, 'data', 'products.csv')
MANIFEST = os.path.join(ROOT, 'data', 'color-images.json')
SIZE = (960, 1440)

# 색상 이름 → slug · 색 (같은 slug면 같은 사진 폴더)
COLORS = {
    '와인': ('wine', '#6E2236'), '네이비': ('navy', '#2F3B57'), '라이트 블루': ('light-blue', '#C5D6E8'),
    '화이트': ('white', '#F2F2EE'), '그레이': ('gray', '#A9AEB6'), '차콜': ('charcoal', '#45474C'),
    '핑크': ('pink', '#EBC8CF'), '연핑크': ('pink', '#EBC8CF'), '베이지': ('beige', '#DCCFB8'),
    '라이트 그린': ('light-green', '#CFDCCF'),
}
# 사이트에 보이는 색 이름 (컬러 엑셀 기준: 핑크 계열은 '연핑크')
LABEL = {'핑크': '연핑크'}
# 폴더 제품명 → 코드. 제품명은 업체 수정본(products.csv)을 유지하고 폴더 이름으로 덮어쓰지 않는다
FOLDER_CODES = {
    '스크럽 상하의 세트': 'A01', 'V넥 스크럽': 'A02', 'V넥 3색 배색 스크럽': 'A03', 'V넥 스크럽 (투톤 파이핑)': 'A04',
    'V넥 스크럽 (투톤 배색)': 'A04', '비대칭 여밈 튜닉': 'B01', '라운드넥 배색 튜닉': 'B02', '어깨단추 튜닉': 'B03',
    '요크 셔링 튜닉': 'B04', '요크 셔링 튜닉 임부복': 'B04', '노카라 원버튼 재킷': 'C01', '파이핑 테일러드 재킷': 'C02',
    '원버튼 재킷': 'C03', '투버튼 칠부소매 재킷': 'C03', '랩 여밈 재킷': 'C04', '롱 가운': 'D01', '테일러드 재킷': 'D02',
    '배색 라펠 재킷': 'D03', '2버튼 가운': 'D04', '랩형 로브': 'E01', '자카드 랩 로브': 'E02', '패턴 환자복': 'E03',
    '검진복 세트': 'E04', 'V넥 단추 가디건': 'F01', '노카라 오픈 니트': 'F02', 'V넥 배색 가디건': 'F04',
    # 같은 옷이라 F02에 합침 (2026-11-25). 같은 색이 겹치면 F02 폴더 사진을 쓴다
    '배색 테이프 노카라 오픈 니트': 'F02',
}

nfc = lambda s: unicodedata.normalize('NFC', s)
num = lambda f: int(m.group(1)) if (m := re.search(r'_(\d+)\.\w+$', f)) else 0


def main():
    if not os.path.isdir(SRC):
        sys.exit(f'컬러 폴더가 없습니다: {SRC}')
    raw = open(CSV, encoding='utf-8-sig').read()
    rows = list(csv.DictReader(io.StringIO(raw)))
    fields = list(rows[0].keys())
    by_name = {r['name']: r for r in rows}
    by_code = {r['code']: r for r in rows}
    # 지난번에 반영한 제품도 계속 보호한다 (폴더에서 빠졌다고 AI 자동 동기화가 덮어쓰지 않게)
    manifest = json.load(open(MANIFEST, encoding='utf-8')) if os.path.exists(MANIFEST) else {}
    log = []

    # 1단계: 전부 읽고 검사만 한다. 문제가 있으면 아무 파일도 바꾸지 않고 멈춘다
    plan = []
    for cat in sorted(os.listdir(SRC)):
        cdir = os.path.join(SRC, cat)
        if not os.path.isdir(cdir):
            continue
        for prod in sorted(os.listdir(cdir)):
            pdir = os.path.join(cdir, prod)
            if not os.path.isdir(pdir):
                continue
            name = re.sub(r'\s*\(완\)\s*$', '', nfc(prod)).strip()
            r = by_code.get(FOLDER_CODES.get(name, '')) or by_name.get(name)
            if not r:
                print(f'건너뜀: products.csv에서 찾지 못한 제품 "{name}"')
                continue
            code = r['code']
            # 색상 폴더 → [(이름, slug, hex, [사진 경로…])]
            found = []
            for col in sorted(os.listdir(pdir)):
                cpath = os.path.join(pdir, col)
                if not os.path.isdir(cpath):
                    continue
                cname = re.sub(r'\s*\(완\)\s*$', '', nfc(col)).strip()
                imgs = [nfc(f) for f in os.listdir(cpath) if re.search(r'\.(png|jpe?g|webp)$', f, re.I) and not f.startswith('.')]
                # 폴더 이름과 사진 파일 이름의 색이 다른 색이면(예: '핑크' 폴더 안 '라이트 블루_1.png') 파일 이름을 따른다
                pre = {re.sub(r'_\d+\.\w+$', '', f).replace('라이트블루', '라이트 블루') for f in imgs}
                if len(pre) == 1 and (p0 := pre.pop()) in COLORS and cname in COLORS and COLORS[p0][0] != COLORS[cname][0]:
                    print(f'  {code} {name}: "{cname}" 폴더 사진이 "{p0}"라서 {p0}(으)로 넣음')
                    cname = p0
                if cname not in COLORS:
                    sys.exit(f'{code} {name}: 모르는 색상 "{cname}" → COLORS 표에 추가하세요 (아무 파일도 바꾸지 않았습니다)')
                files = sorted((os.path.join(cpath, f) for f in os.listdir(cpath)
                                if re.search(r'\.(png|jpe?g|webp)$', f, re.I) and not f.startswith('.')), key=num)
                found.append((LABEL.get(cname, cname), *COLORS[cname], files))
            if not found:
                print(f'건너뜀: {code} {name}: 색상 폴더가 없습니다')
                continue
            slugs = [c[1] for c in found]
            dup = sorted({c[0] for c in found if slugs.count(c[1]) > 1})
            if dup:
                sys.exit(f'{code} {name}: 같은 색으로 취급되는 폴더가 함께 있습니다({", ".join(dup)}) → 하나로 합치세요 (아무 파일도 바꾸지 않았습니다)')
            # 기본 색은 지금 사이트의 기본 색 유지 (없으면 사진이 있는 첫 색)
            cur = r['colors'].split('|')[0].split(':')
            cur_default = cur[1] if len(cur) > 1 else ''
            found.sort(key=lambda c: (c[1] != cur_default, not c[3]))
            if found[0][1] != cur_default:
                found.sort(key=lambda c: not c[3])
            prev = next((x for x in plan if x[2] == code), None)
            if prev:  # 같은 제품으로 합치는 폴더: 없는 색만 더한다
                have = {c[1] for c in prev[3]}
                prev[3].extend(c for c in found if c[1] not in have)
                continue
            plan.append((r, name, code, found))

    # 2단계: 반영
    for r, name, code, found in plan:
        r['colors'] = '|'.join(f'{n}:{s}:{h}' for n, s, h, _ in found)
        # 사진: 색 폴더마다 통째로 교체, 목록에서 빠진 색의 사진 폴더는 지운다
        pout = os.path.join(OUT, code)
        keep = {s for _, s, _, _ in found}
        if os.path.isdir(pout):
            for d in os.listdir(pout):
                if os.path.isdir(os.path.join(pout, d)) and d not in keep:
                    shutil.rmtree(os.path.join(pout, d))
        for _, slug, _, files in found:
            dest = os.path.join(pout, slug)
            if os.path.isdir(dest):
                shutil.rmtree(dest)
            if not files:
                continue
            os.makedirs(dest)
            for i, f in enumerate(files, 1):
                im = ImageOps.exif_transpose(Image.open(f)).convert('RGB')
                w, h = im.size
                cw = min(w, round(h * 2 / 3)); ch = min(h, round(w * 3 / 2))  # 2:3 가운데 기준
                left, top = (w - cw) // 2, (h - ch) // 2
                im.crop((left, top, left + cw, top + ch)).resize(SIZE, Image.LANCZOS).save(
                    os.path.join(dest, f'{i}.webp'), 'WEBP', quality=80, method=6)
        manifest[code] = {n: len(fs) for n, _, _, fs in found}
        log.append(f"{code} {name}: " + ', '.join(f'{n} {len(fs)}장' for n, _, _, fs in found))

    out = io.StringIO()
    w = csv.DictWriter(out, fieldnames=fields, lineterminator='\r\n' if '\r\n' in raw else '\n')
    w.writeheader(); w.writerows(rows)
    open(CSV, 'w', encoding='utf-8-sig' if raw.startswith('﻿') else 'utf-8').write(out.getvalue())
    json.dump(manifest, open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\n'.join(log))


if __name__ == '__main__':
    main()
