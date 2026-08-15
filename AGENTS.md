# AGENTS.md

Project-specific guidance for AI coding agents.

<!-- ASTRYX:START -->
Astryx v0.2.0 · 154 components
CLI: run every command as `pnpm exec astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in your app entry e.g. main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";

WORKFLOW — discover, don't guess. Before writing UI:
1. `astryx build "<idea>"` — START HERE: returns a kit (closest [page] + [block]s + [component]s). No args = full playbook.
2. `astryx template <name> [--skeleton]` — scaffold the [page]/[block]s it named, or study their layout. Templates are reference code.
3. `astryx component <Name>` — props + examples for every component you use.

RULES:
- No <div> — components do all layout/spacing. Full page → AppShell; sidebar nav → SideNav.
- Frame first: pick the shell (AppShell / Layout+LayoutPanel) and budget regions in px BEFORE writing content (`astryx docs layout`).
- Dense data = rows (Table, List/Item) edge-to-edge — never Card-wrapped list items. Card = dashboard widgets, galleries, settings groups only.
- Status → StatusDot/Token; Badge only for counts and enumerated states, never decoration.
- Custom styling: component props first; else style/className with tokens — var(--color-*|--spacing-*|--radius-*). No raw hex/px. (No StyleX/Tailwind compiler here — don't use xstyle/utility classes.)
- Tokens for every value (`astryx docs tokens`). Brand/accent via `astryx theme` — never override --color-* in :root.
- SELF-CHECK before you finish: re-read the file and replace any raw <div>/<span> layout, imported .css/@apply, or hardcoded value (#hex, 16px) with the component or a token (var(--color-*|--spacing-*|…)). If unsure a component/prop exists, run `astryx component <Name>` / `astryx search "<thing>"`; don't hand-roll CSS.

MORE CLI:
  search "<query>"   find any component / hook / doc / template / block
  component --list   154 components by category
  template --list    page + block recipes
  docs <topic>       color, elevation, icons, illustrations, internationalization, layout, migration, motion, principles, shape, spacing, styling, theme, tokens, typography
  swizzle <Name>     eject component source for deep customization
  upgrade --apply    run after any @astryxdesign/core bump
<!-- ASTRYX:END -->

## UI/프론트엔드 디자인 workflow (필수)

- UI·프론트엔드 작업, 리뷰, 리디자인, 폴리시는 반드시 `StyleSeed`와 `Impeccable`을 함께 사용한다.
- 작업 시작 시 `$impeccable <command>`로 현재 제품·디자인 맥락과 해당 작업 playbook을 확인한다. 새 제품 맥락이 없으면 `$impeccable init`, 기존 시각 시스템을 기록할 때는 `$impeccable document`를 사용한다.
- 구현 전에는 `$styleseed-design-review`로 대상 파일 또는 UI 디렉터리를 근거 기반 검토하고, 점수·라인별 위반·우선순위 수정안을 기록한다. StyleSeed는 리뷰 전용이며 요청 없이 자동 수정하지 않는다.
- 구현 후에는 StyleSeed를 다시 실행해 **100/100점**을 품질 게이트로 확인하고, 발견된 모든 문제를 수정한 뒤 재검토한다. 100점 미만이면 완료로 처리하지 않는다. 상태·접근성·반응형·동작 관련 Impeccable 검토도 해당 명령(`audit`, `critique`, `polish`, `harden` 등)으로 완료한다.
- 두 도구를 사용할 수 없는 경우 임의로 생략하지 말고, 차단 사유와 대체 검증을 결과에 명시한다. 백엔드 전용 변경에는 이 workflow를 적용하지 않는다.

## 커밋 메시지 규칙

- Conventional Commits 형식인 `<type>(<scope>): <한국어 요약>`을 사용한다. `scope`는 생략할 수 있다.
- `type`은 `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `build`, `ci`, `perf`, `revert` 중에서 선택한다.
- 요약은 변경 결과를 한국어 명령형으로 간결하게 작성하고 마침표를 붙이지 않는다.
- 커밋 하나에는 하나의 논리적 변경만 담는다.
- 본문이 필요하면 빈 줄 뒤에 변경 이유와 영향을 한국어로 작성한다.
- 호환성을 깨는 변경은 본문 또는 푸터에 `BREAKING CHANGE:`를 명시한다.

예시:

```text
feat(ui): 동의 체크박스를 Astryx 컴포넌트로 교체
fix(auth): 만료된 세션 재사용 방지
docs: 커밋 메시지 규칙 추가
```
