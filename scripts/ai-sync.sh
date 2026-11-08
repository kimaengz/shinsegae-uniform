#!/bin/zsh
# GPT 결과 폴더의 '완료' 사진을 사이트에 반영하고, 바뀐 게 있으면 빌드 확인 후 GitHub에 올린다(→ 자동 배포).
# launchd(~/Library/LaunchAgents/com.haremi.shinsegae-ai-sync.plist)가 30분마다 실행한다.
# 끄기: launchctl unload ~/Library/LaunchAgents/com.haremi.shinsegae-ai-sync.plist
set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd "${0:A:h}/.."

echo "── $(date '+%Y-%m-%d %H:%M') ──"
/usr/bin/python3 scripts/import-ai-images.py

if [[ -z "$(git status --porcelain -- public/images/products data/ai-images.json)" ]]; then
  exit 0
fi

npm run build > /dev/null            # 데이터 · 빌드가 깨지면 여기서 멈추고 올리지 않는다
git add -- public/images/products data/ai-images.json
git commit -q -m "AI 제품 사진 자동 반영" -- public/images/products data/ai-images.json
git push -q
echo "배포 요청 완료"
