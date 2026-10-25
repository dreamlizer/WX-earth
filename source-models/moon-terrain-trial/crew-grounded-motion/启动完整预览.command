#!/bin/zsh
cd -- "${0:A:h}" || exit 1

preview_url='http://127.0.0.1:8977/moon-terrain-trial/crew-grounded-motion/index.html'
preview_label='local.wx-earth.crew-grounded-motion-preview'
preview_log="${TMPDIR:-/tmp/}wx-earth-crew-grounded-motion-8977.log"
preview_node="$(command -v node)"
if [[ ! -x "$preview_node" ]]; then
  preview_node='/Users/a1234/.local/bin/node'
fi
if [[ ! -x "$preview_node" ]]; then
  print '没有找到 Node.js，无法启动本地预览。'
  exit 1
fi

preview_page="$(/usr/bin/curl --silent --fail --max-time 2 "$preview_url")"
if [[ "$preview_page" != *'三人同望'* ]]; then
  if /usr/sbin/lsof -nP -iTCP:8977 -sTCP:LISTEN >/dev/null 2>&1; then
    print '8977 端口正被其他服务使用，未关闭任何现有服务。'
    exit 1
  fi
  if /bin/launchctl list "$preview_label" >/dev/null 2>&1; then
    /bin/launchctl start "$preview_label" || exit 1
  else
    /bin/launchctl submit -l "$preview_label" -o "$preview_log" -e "$preview_log" -- "$preview_node" "$PWD/server.cjs" || exit 1
  fi
  for preview_attempt in {1..20}; do
    preview_page="$(/usr/bin/curl --silent --fail --max-time 1 "$preview_url")"
    [[ "$preview_page" == *'三人同望'* ]] && break
    /bin/sleep 0.25
  done
fi
if [[ "$preview_page" != *'三人同望'* ]]; then
  print "启动失败，日志：$preview_log"
  exit 1
fi
print "完整预览已启动：$preview_url"
print '预览服务由 macOS 后台托管；重启或注销后，再双击本文件即可。'
if [[ "${1:-}" != '--no-open' ]]; then
  /usr/bin/open "$preview_url"
fi
