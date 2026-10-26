<div align="center">

# Herdr DB

**코딩 에이전트가 MongoDB에서 무엇을 읽고 무엇을 바꿨는지 그대로 보여줍니다.**

**Claude Code**나 **Codex**가 MongoDB MCP 도구를 호출할 때마다 쿼리, 돌려받은 문서, 쓰기 전후 diff를
MongoDB Compass처럼 보여주는 [herdr](https://herdr.dev) 플러그인입니다.

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
![herdr plugin](https://img.shields.io/badge/herdr-plugin-0b3b2c)
![Claude Code](https://img.shields.io/badge/Claude%20Code-supported-d97757)
![Codex](https://img.shields.io/badge/Codex-supported-111111)
![macOS](https://img.shields.io/badge/macOS-native%20window-lightgrey)

[English](README.md) · [한국어](README.ko.md)

<img src="docs/screenshots/update.png" alt="update-many 호출을 문서별 before/after diff로 보여주는 화면" width="900">

</div>

## 왜 만들었나

에이전트는 [MongoDB MCP 서버](https://github.com/mongodb-js/mongodb-mcp-server)로 DB를 잘 뒤져 보지만,
무엇을 했는지는 잘 알려주지 않습니다. 대화 기록에는 JSON 덩어리가 남을 뿐이고, `update-many`나
`delete-many`는 개수만 돌려줍니다. *어떤* 문서가 바뀌었는지, 바뀌기 전에는 어땠는지 알 수가 없습니다.

Herdr DB는 에이전트를 느리게 만들지 않고 이 질문에 답합니다. MongoDB 도구가 호출될 때마다 터미널 옆에
작은 네이티브 창이 뜨고, MongoDB Compass가 보여주는 방식 그대로 내용을 정리해 줍니다.

## 기능

- **Compass식 읽기 화면** — `find`, `aggregate`, `count`, `export`는 Filter / Project / Sort / Limit
  바나 파이프라인 스테이지를 보여주고, 돌려받은 문서를 BSON 타입(`ObjectId`, `Date`, `Decimal128`,
  `Long` …)과 함께 펼치고 접을 수 있게 보여줍니다. List / JSON 전환도 됩니다.
- **쓰기는 실제 diff로** — `update-many`는 문서별로 바뀐 필드·추가된 필드·지워진 필드를 diff로
  보여줍니다(배열 원소도 맞춰서 비교). `delete-many`는 지워진 문서를, `insert-many`는 추가된 문서를
  보여줍니다.
- **Claude Code와 Codex 모두 지원** — 두 에이전트의 호출을 한 뷰어에서 봅니다. 호출마다 어떤
  에이전트가, 어느 프로젝트에서, herdr 안이라면 어느 워크스페이스·pane에서 했는지 남습니다.
- **실패한 호출도 기록** — MCP 서버가 돌려준 오류 메시지까지 남깁니다.
- **방해하지 않음** — 훅은 아무것도 출력하지 않고 항상 exit 0으로 끝나므로 도구 호출을 막거나,
  늦추거나, 바꾸지 않습니다. 창은 키보드 포커스를 빼앗지 않고 앞으로만 나옵니다.
- **네이티브 창 또는 브라우저** — Dock 아이콘 없는 작은 메뉴바 앱이나 로컬 포트의 브라우저 탭 중에서
  고를 수 있고, 설정 화면에서 언제든 바꿀 수 있습니다.
- **라이트·다크 모드** — 시스템 설정을 따릅니다.

<table>
  <tr>
    <td><img src="docs/screenshots/find.png" alt="filter, projection, sort, limit이 있는 find"></td>
    <td><img src="docs/screenshots/aggregate.png" alt="스테이지별로 보이는 aggregate 파이프라인"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/delete.png" alt="삭제된 문서를 보여주는 delete-many"></td>
    <td><img src="docs/screenshots/update-dark.png" alt="다크 모드의 update-many diff"></td>
  </tr>
</table>

## 요구 사항

| | |
| --- | --- |
| herdr | 0.7.5 이상 |
| Node.js | 22 이상, 설치할 때 `PATH`에 있어야 함 |
| 에이전트 | Claude Code와/또는 Codex, MCP 서버로 [`mongodb-mcp-server`](https://github.com/mongodb-js/mongodb-mcp-server)가 설정되어 있어야 함 |
| 네이티브 창 | Xcode Command Line Tools(`swiftc`)가 있는 macOS. 없거나 Linux라면 브라우저로 엽니다 |

## 설치

```bash
herdr plugin install speardragon/herdr-db
```

설치하면서 뷰어와 macOS 앱을 빌드하고, 이 맥에서 찾은 에이전트마다 훅을 등록합니다
(`~/.claude`가 있으면 Claude Code, `~/.codex`가 있으면 Codex). 기존 설정 파일은 먼저 백업하고,
herdr-db 항목만 건드립니다.

그다음 에이전트별로 마무리합니다.

- **Claude Code** — 실행 중인 세션을 다시 시작합니다.
- **Codex** — Codex에서 `/hooks`를 한 번 열어 herdr-db 훅을 신뢰한 뒤 세션을 다시 시작합니다.
  나중에 훅 명령이 바뀌면(Node.js 경로나 플러그인 위치가 바뀐 경우) Codex가 다시 물어봅니다.

이제 에이전트가 MongoDB 도구를 호출하면 창이 뜹니다.

<details>
<summary>로컬 체크아웃으로 설치하기</summary>

`herdr plugin link`는 빌드 단계를 실행하지 않으므로 빌드와 훅 등록을 직접 합니다.

```bash
git clone https://github.com/speardragon/herdr-db && cd herdr-db
npm ci && npm --prefix ui ci && npm run build
herdr plugin link "$PWD"
node bin/install-hooks.mjs            # 또는 --agent=claude / --agent=codex
```

</details>

## 사용법

따로 할 일은 없습니다. 평소처럼 에이전트와 작업하면 Herdr DB가 MongoDB 호출을 모두 기록하고, 호출이
들어올 때 뷰어를 앞으로 가져옵니다.

- 사이드바에는 최신 호출이 위에 옵니다. 컬렉션·서버·프로젝트·에이전트로 거르거나 읽기/쓰기만 볼 수
  있습니다.
- 보고 있는 호출에 머물고 싶다면 필터 아래의 "새 호출이 오면 자동으로 보기"를 끄세요.
- 메뉴바의 🍃 아이콘으로 창을 다시 열거나, 설정을 열거나, 브라우저에서 열 수 있습니다. 창을 닫아도
  기록은 계속됩니다.

### herdr 액션

| 액션 | 설명 |
| --- | --- |
| `ray.herdr-db.open` | 뷰어 열기 |
| `ray.herdr-db.settings` | 설정 화면 열기 |
| `ray.herdr-db.install-hooks` | 훅 설치·복구 (Node.js를 업그레이드한 뒤 등) |
| `ray.herdr-db.uninstall-hooks` | herdr-db 훅만 제거 |

`~/.config/herdr/config.toml`에서 키에 묶을 수 있습니다.

```toml
[[keys.command]]
key = "prefix+m"
type = "plugin_action"
command = "ray.herdr-db.open"
description = "MongoDB 호출 보기"
```

## 동작 방식

```
Claude Code ─┐  PreToolUse / PostToolUse 훅               ~/.herdr-db/events/*.json (0600)
             ├──────────────────────────────▶ bin/hook.mjs ─────────────┐
Codex ───────┘  (mcp__<server>__find, …)                                 ▼
                                                    bin/server.mjs  127.0.0.1:47917 (SSE)
                                                                         │
                                              Herdr DB.app(메뉴바) 또는 브라우저 탭
```

herdr 플러그인 이벤트로는 MCP 도구 호출을 볼 수 없어서, 캡처는 **에이전트 훅**이 맡습니다. herdr
플러그인은 훅을 설치·복구하고 뷰어를 엽니다.

- **읽기는 추가 비용이 없습니다.** 훅은 에이전트가 이미 받은 값(`tool_input`, `tool_response`)만
  읽습니다. 읽기 호출 때문에 DB를 다시 조회하지 않습니다.
- **쓰기는 스냅샷을 뜹니다.** `update-many`와 `delete-many`는 개수만 돌려주므로, 호출 직전에 필터와
  일치하는 문서를 최대 `snapshotLimit`개 읽어 두고, 호출이 끝나면 같은 `_id`로 다시 읽어 비교합니다.
- **연결 문자열은 찾아 쓰고 저장하지 않습니다.** 스냅샷이 필요할 때마다 에이전트와 같은 방식으로 MCP
  서버의 연결 문자열을 찾습니다.
  - Claude Code: `~/.claude.json`(프로젝트·사용자 범위)과 `.mcp.json`
  - Codex: 프로젝트의 `.codex/config.toml`, 그다음 `~/.codex/config.toml`

  다른 곳에 있다면 에이전트 환경 변수에 `HERDR_DB_URI_<SERVER_NAME>`을 지정하세요
  (예: 서버 이름이 `shop-db`면 `HERDR_DB_URI_SHOP_DB`). 찾지 못해도 쓰기 호출은 기록되고, diff만
  빠집니다.

### 캡처하는 도구

| 종류 | 도구 |
| --- | --- |
| 읽기 | `find`, `aggregate`, `aggregate-db`, `count`, `export` |
| 쓰기 | `insert-many`, `update-many`, `delete-many`, `$out` / `$merge`가 있는 `aggregate` |
| 관리 | `create-index`, `drop-index`, `create-collection`, `drop-collection`, `drop-database`, `rename-collection` |
| 메타데이터 | `list-databases`, `list-collections`, `collection-schema`, `collection-indexes`, `collection-storage-size`, `db-stats`, `explain` |

Codex는 도구 이름의 `-`를 `_`로 바꿔 보내지만(`update_many`) 똑같이 처리합니다.

## 설정

사이드바의 ⚙ 버튼, 메뉴바 아이콘, 또는 `ray.herdr-db.settings` 액션으로 설정 화면을 엽니다. 바꾼
값은 바로 `~/.herdr-db/config.json`에 저장되고 적용됩니다. 같은 화면에서 에이전트별 훅 상태, 연결된
뷰어 수, 저장된 호출 수도 볼 수 있습니다.

| 설정 | 기본값 | |
| --- | --- | --- |
| `viewer` | `app` | `app`(네이티브 창) 또는 `browser`(로컬 포트의 브라우저 탭) |
| `autoOpen` | `always` | `always`, `writes`(쓰기 호출일 때만 띄움), `never`(띄우지 않고 기록만) |
| `snapshotLimit` | `50` | `update-many` / `delete-many` 직전에 읽어 두는 문서 수 |
| `maxEvents` | `500` | 이 개수를 넘으면 오래된 호출부터 지움 |
| `maxAgeDays` | `14` | 이 일수가 지나면 지움 |
| `port` | `47917` | 파일에서만 변경. 바꾼 뒤 서버와 앱을 종료하세요 |

플러그인 디렉터리에서 `node bin/status.mjs`를 실행하면 터미널에서도 같은 상태를 볼 수 있습니다.

## 개인정보와 보안

캡처된 호출에는 실제 DB 데이터가 들어 있으므로, Herdr DB는 이를 로컬에만 짧게 보관합니다.

- 모든 데이터는 이 맥에만 남습니다. `~/.herdr-db`는 `0700`, 이벤트 파일은 `0600`으로 만들고,
  `maxEvents` / `maxAgeDays`를 넘은 호출은 지웁니다. 휴지통 버튼으로 한 번에 지울 수도 있습니다.
- 뷰어 서버는 `127.0.0.1`에서만 듣고, 다른 `Host` 헤더로 온 요청은 거부합니다. 설정 API는 JSON만
  받으므로 브라우저가 preflight 없이 다른 출처에서 보낼 수 없습니다.
- 연결 문자열은 스냅샷을 뜰 때 메모리에서만 쓰고 어디에도 저장하지 않습니다.
- 스냅샷은 짧은 타임아웃을 건 읽기 조회일 뿐입니다. Herdr DB는 DB에 절대 쓰지 않습니다.

## 제거

플러그인을 지우기 **전에** 훅부터 제거하세요. herdr에는 제거 단계가 없어서, 남은 훅이 지워진
스크립트를 계속 가리키게 됩니다.

```bash
herdr plugin action invoke uninstall-hooks --plugin ray.herdr-db
herdr plugin uninstall ray.herdr-db
rm -rf ~/.herdr-db        # 캡처된 호출과 설정
```

## 문제 해결

<details>
<summary>창이 뜨지 않아요</summary>

1. 플러그인 디렉터리에서 `node bin/status.mjs`를 실행해 에이전트의 훅 상태를 확인합니다.
2. 에이전트 세션을 다시 시작합니다. 훅은 세션이 시작될 때 읽힙니다.
3. Codex라면 `/hooks`에서 herdr-db 훅이 신뢰되어 있는지 확인합니다.
4. `autoOpen`이 `never`가 아닌지 확인하고 `~/.herdr-db/hook.log`를 봅니다.

</details>

<details>
<summary>쓰기 호출에 스냅샷이 없다고 나와요</summary>

그 MCP 서버의 연결 문자열을 찾지 못했거나([동작 방식](#동작-방식) 참고), 에이전트가 `connect` 도구로
실행 중에 연 연결을 썼기 때문입니다. 후자는 훅에서 볼 수 없습니다. 전자는
`HERDR_DB_URI_<SERVER_NAME>`으로 해결할 수 있습니다.

</details>

<details>
<summary>Node.js를 업그레이드한 뒤 훅이 동작하지 않아요</summary>

훅은 설치할 때 쓴 `node` 경로를 고정해 둡니다. 버전 관리자가 그 버전을 지웠다면
`ray.herdr-db.install-hooks` 액션을 다시 실행하세요(Codex라면 훅을 다시 신뢰해야 합니다).

</details>

## 개발

```bash
npm ci && npm --prefix ui ci
npm test                       # 훅, 서버, 스토어, 설정 (node:test)
npm --prefix ui test           # BSON 표시, diff, mongosh 포맷터 (vitest)
npm --prefix ui run dev        # UI 개발 서버, /api는 127.0.0.1:47917로 프록시
npm run build                  # UI 번들 + macOS 앱

# 버려도 되는 로컬 MongoDB로 스냅샷 통합 테스트 (herdr_db_test DB 사용)
HERDR_DB_TEST_URI='mongodb://localhost:27017/?directConnection=true' npm test
```

순수 Node.js ESM(`src/`, `bin/`), React + Vite 뷰어(`ui/`), `WKWebView`를 감싼 190줄 남짓의 Swift
앱(`mac/`)으로 이루어져 있습니다.

## 감사의 말

뷰어의 모양은 [MongoDB Compass](https://github.com/mongodb-js/compass)와
[LeafyGreen](https://github.com/mongodb/leafygreen-ui) 팔레트를 따랐습니다. Compass는 SSPL 라이선스라
코드를 가져오지 않고 화면을 처음부터 새로 만들었습니다. Herdr DB는 MongoDB, Inc.와 관련이 없으며 보증을
받지 않았습니다.

## 라이선스

[MIT](LICENSE) © speardragon
