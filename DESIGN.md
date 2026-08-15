---
name: "싹메일"
description: "필요한 소식을 깔끔하게 전하는 싹메일"
colors:
  primary: "#285c31"
  primary-deep: "#1f4a28"
  neutral-bg-web: "#f4f8f0"
  neutral-bg-mobile: "#e9f2e2"
  surface: "#ffffff"
  surface-raised: "rgba(255, 255, 255, 0.78)"
  surface-muted: "#f7faf5"
  surface-tint: "#f2f7ef"
  ink: "#18351f"
  ink-muted: "#55705a"
  ink-subtle: "#728175"
  line: "#dce7d7"
  line-strong: "#caddc5"
  brand-soft: "#dcefd5"
  status-ready: "#52a447"
  status-error: "#c44a42"
  status-neutral: "#9aab9c"
  danger-soft: "#fae5e3"
  danger: "#a8332b"
  candidate: "#fff0bf"
  on-primary: "#ffffff"
typography:
  display:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, \"Apple SD Gothic Neo\", \"Segoe UI\", Roboto, sans-serif"
    fontSize: "clamp(48px, 8vw, 104px)"
    fontWeight: 600
    lineHeight: "0.98"
    letterSpacing: "-0.065em"
  headline-mobile:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, \"Apple SD Gothic Neo\", \"Segoe UI\", Roboto, sans-serif"
    fontSize: "54px"
    fontWeight: 600
    lineHeight: "1.02"
    letterSpacing: "-0.06em"
  body:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, \"Apple SD Gothic Neo\", \"Segoe UI\", Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "1.4286"
  intro:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, \"Apple SD Gothic Neo\", \"Segoe UI\", Roboto, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: "1.7"
  label:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, \"Apple SD Gothic Neo\", \"Segoe UI\", Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: "1.2"
    letterSpacing: "0.16em"
rounded:
  sm: "10px"
  md: "18px"
  lg: "28px"
  pill: "999px"
spacing:
  page-web: "clamp(24px, 6vw, 96px)"
  page-mobile: "22px"
  control: "10px"
  section: "28px"
  shell: "48px"
components:
  nav-pill:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
    padding: "9px 10px 9px 20px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
    padding: "12px 16px"
  status-card:
    backgroundColor: "rgba(255, 255, 255, 0.65)"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "12px 16px"
  mail-shell:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  message-row:
    backgroundColor: "{colors.surface-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "14px"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "22px"
    padding: "28px"
---

# Design System: 싹메일

## Overview

**Creative North Star: "The Calm Sorting Desk"**

싹메일의 현재 시각 언어는 메일을 빠르게 훑고 안전하게 정리하는 조용한 작업대에 가깝다. 잎빛 녹색 배경, 짙은 녹색 잉크, 반투명한 흰색 표면, 얕은 그림자가 화면을 차분하게 만들고, 큰 한국어 헤드라인과 넉넉한 여백이 첫 행동을 분명하게 한다. Figtree 하나의 서체 가족을 제목·본문·컨트롤에 함께 사용해 브랜드와 작업 UI 사이의 간극을 줄인다.

웹과 모바일은 같은 팔레트를 공유하지만 공간의 밀도는 다르다. 웹은 넓은 히어로와 2열 메일 작업면을 사용하고, 모바일은 480px 안쪽의 단일 흐름과 메일 목록↔상세 전환을 사용한다. 둥근 캡슐 내비게이션과 카드, 1px 연녹색 경계선, 상태에 한정된 보조 색상이 반복되는 시각적 문법이다. 이 문서는 기존 구현을 기록한 것이며, 명시적인 리디자인 요청 없이는 다른 시각 세계로 바꾸지 않는다.

**Key Characteristics:**

- 잎빛 배경과 단일 녹색 액센트의 저채도 팔레트
- Figtree 기반의 큰 한국어 디스플레이 타입과 짧은 라벨
- 캡슐 내비게이션, 10–28px 카드 반경, 반투명 흰색 레이어
- 웹의 넓은 2열 메일 작업면과 모바일의 단일 열·상세 전환
- 자동화는 녹색 보조 표면으로, 위험한 삭제는 제한된 빨간색으로 구분

## Colors

팔레트는 따뜻한 흰색과 잎빛 녹색을 바탕으로 하며, `#285c31`을 상호작용·브랜드의 한 목소리로 사용한다. 상태와 위험 색상은 의미가 있을 때만 소량 사용한다.

### Primary

- **Forest Brand** (`#285c31`): 링크, 주요 버튼, 선택 상태, 로고 점, 롱프레스 진행 표시.
- **Deep Forest** (`#1f4a28`): 추천 요금제의 CTA처럼 기본 액센트보다 한 단계 강한 주요 행동.
- **Brand Soft** (`#dcefd5`): 선택된 필터, hover/focus 표면, 활성 상태.

### Neutral

- **Web Leaf Background** (`#f4f8f0`): 웹 루트 배경.
- **Mobile Leaf Background** (`#e9f2e2`): 모바일 바깥 배경.
- **Surface** (`#ffffff`): 메일 본문, 입력, 대화상자, 카드의 불투명 표면.
- **Raised Surface** (`rgba(255, 255, 255, 0.78)`): 웹 메일 셸과 유리 질감 내비게이션.
- **Muted Surface** (`#f7faf5`): 설정 패널과 추천 카드.
- **Surface Tint** (`#f2f7ef`): 메일 행의 기본 표면.
- **Forest Ink** (`#18351f`): 웹 기본 전경과 주요 텍스트.
- **Muted Ink** (`#55705a`): 설명, 보조 문장, 링크 기본 상태.
- **Subtle Ink** (`#728175`): 도메인, 주석, 낮은 우선순위 텍스트.
- **Line** (`#dce7d7`): 구분선과 얇은 경계.
- **Strong Line** (`#caddc5`): 카드·입력·상태 카드의 경계.

### Status and semantic colors

- **Ready Green** (`#52a447`)과 **Ready Halo** (`#d9efd4` 또는 모바일의 `#cae6c3`): 연결 준비 완료 상태.
- **Neutral Status** (`#9aab9c`): 확인 중인 상태.
- **Error Red** (`#c44a42`): 연결 오류 상태.
- **Danger** (`#a8332b`)과 **Danger Soft** (`#fae5e3`): 되돌릴 수 없는 삭제 행동과 hover 표면.
- **Candidate Yellow** (`#fff0bf`): 결제·분류 후보 배지처럼 검토가 필요한 메일.

### Named Rules

**The One Green Voice Rule.** 일반 상호작용과 선택 상태에는 Forest Brand 계열만 사용한다. 빨강·노랑은 오류·삭제·검토 필요처럼 의미가 있을 때만 사용하고 장식용으로 확장하지 않는다.

## Typography

**Display Font:** Figtree (with `-apple-system`, `BlinkMacSystemFont`, `Apple SD Gothic Neo`, `Segoe UI`, and `Roboto` fallbacks)

**Body Font:** Figtree (same fallback stack)

**Label/Mono Font:** 라벨도 Figtree를 사용하며, 코드가 필요한 경우 Astryx의 시스템 모노스페이스 토큰을 따른다.

**Character:** 한 가족의 둥글고 중립적인 산세리프가 한국어 카피와 메일 메타데이터를 연결한다. 제목은 좁은 자간과 큰 크기로 결정을 돕고, 본문은 1.65–1.75의 넉넉한 행간으로 긴 메일·정책 문서를 안정적으로 읽게 한다.

### Hierarchy

- **Display** (600, `clamp(48px, 8vw, 104px)`, `0.98`, `-0.065em`): 웹 홈 히어로의 두 줄 메시지.
- **Mobile headline** (600, `54px`, `1.02`, `-0.06em`): 모바일 홈의 두 줄 메시지.
- **Title** (600, `1.25rem`, `1.4`): 메일함·섹션·카드 제목.
- **Body** (400, `14px`, `1.4286`): 일반 UI 본문과 컨트롤 기본값.
- **Intro** (400, 웹 `19px/1.7`, 모바일 `16px/1.65`): 홈 설명과 제품 가치 제안.
- **Label** (700, `13px`, `1.2`, `0.16em`): 영문 eyebrow와 짧은 상태 라벨. 대문자 표기는 eyebrow·상태 표면에 한정한다.

### Named Rules

**The Single-Family Rule.** 새 화면도 Figtree와 현재 fallback 순서를 유지한다. 새 서체를 추가해 제품·메일·약관 표면을 분리하지 않는다.

## Layout

- **Web frame:** `main`은 최소 뷰포트 높이를 채우고 `28px clamp(24px, 6vw, 96px)` 패딩을 사용한다. 1440px 이상에서는 좌우 패딩을 `clamp(48px, 5vw, 96px)`로 조정한다.
- **Web home:** 히어로는 최대 `860px`, 상단 여백은 `clamp(110px, 18vh, 190px)`이다. 메일 셸은 최대 `1600px`, 히어로 뒤 `48px` 간격으로 배치한다.
- **Desktop mail:** 메일 콘텐츠는 `minmax(320px, 32%) minmax(0, 1fr)` 2열이며 최소 높이는 `clamp(520px, 62vh, 820px)`이다. 1440px 이상에서는 목록 폭이 `28%`로 줄고 내부 패딩이 커진다.
- **Web mobile breakpoint:** `640px` 이하에서 루트 패딩을 `22px`로 줄이고 메일 목록과 상세를 한 열로 바꾼다. 선택된 메일은 상세가 열릴 때 목록이 숨겨진다.
- **Mobile frame:** `main`은 `min(100%, 480px)` 폭, `22px` 패딩의 단일 열이다. `481px` 이상에서는 본문 바깥에 `28px` 상하 여백과 `34px` 페이지 반경을 둔다.
- **Mobile home:** `.phone-card`는 상단 `80px`, 내부 `34px 28px`, `30px` 반경의 단일 집중 영역이다. 메일 셸은 상단 `28px` 간격으로 이어진다.
- **Pricing:** 웹은 `minmax(260px, 1fr)` 자동 반응형 그리드, 모바일은 단일 열 스택이다. 정책 문서는 웹 최대 `800px`의 읽기 폭을 유지한다.
- **Rhythm:** 8–12px 컨트롤 간격, 14–24px 내부 패딩, 28–48px 섹션 간격이 반복된다. 그룹 외부 간격은 내부 항목 간격보다 커야 한다.

## Elevation & Depth

깊이는 강한 검은 그림자보다 반투명 흰색 레이어, 잎빛 배경과의 명도 차이, 저채도 녹색 그림자를 조합해 만든다. 기본 표면은 평평하고, sticky 내비게이션·메일 셸·추천 카드·대화상자처럼 작업 맥락을 분리해야 할 때만 그림자를 올린다. 유리 표면에는 `backdrop-filter: blur(14px)` 또는 컨텍스트 메뉴의 `blur(18px)`를 사용한다.

### Shadow Vocabulary

- **Ambient low** (`0 1px 2px rgba(24, 53, 31, 0.05)`): sticky 내비게이션.
- **Shell medium** (`0 10px 30px rgba(24, 53, 31, 0.08)`): 웹 메일 셸과 강조 요금제.
- **Mobile shell** (`0 14px 44px rgba(38, 70, 40, 0.12)`): 모바일 메일 셸.
- **Context menu** (`0 1px 2px rgba(24, 53, 31, 0.06)` + `0 18px 44px rgba(20, 45, 24, 0.16)`): 포인터·롱프레스 메뉴.
- **Dialog high** (`0 24px 80px rgba(20, 45, 24, 0.22)`): 삭제 확인 대화상자.

### Named Rules

**The Tinted Depth Rule.** 새 그림자는 검은색 단일 덩어리 대신 현재 녹색 계열의 낮은 불투명도와 작은 근접 그림자 + 넓은 확산 그림자의 조합을 따른다.

## Shapes

형태 언어는 둥글고 손에 잡히는 캡슐과 부드러운 카드다. `10px`은 입력·메일 행 같은 작은 요소, `17–18px`은 추천·중간 카드, `24–30px`은 모바일 셸·홈 카드, `28px`은 웹 대형 셸, `999px`은 내비게이션·버튼·배지에 사용한다. 카드와 셸은 `overflow: hidden`으로 내부 콘텐츠를 모서리에 맞추고, 경계선은 1px의 연녹색을 유지한다.

포커스는 `2px` Forest Brand outline과 `2px` offset으로 표시한다. 삭제 같은 위험한 행동은 둥근 모서리를 유지하되 위 항목과 얇은 구분선으로 분리하고, danger 색을 작은 영역에만 적용한다.

## Components

### Buttons

- **Shape:** Astryx `Button`의 primary/secondary/ghost 변형을 사용하며, 제품 CTA 링크도 `999px` 캡슐이다.
- **Primary:** Forest Brand 배경과 흰색 텍스트, 일반 CTA는 `12px 16px` 패딩. 강조 요금제 CTA는 Deep Forest를 사용한다.
- **Secondary / Ghost:** 흰색·연녹색 표면과 잉크 텍스트로 작업 맥락을 유지한다. 설정·로그아웃·필터처럼 보조 행동에 사용한다.
- **Hover / Focus:** hover는 Brand Soft 표면과 Forest Brand 텍스트로 전환하고, 키보드 포커스는 전역 `:focus-visible` 링을 유지한다.
- **Loading / Disabled:** 로딩은 Astryx의 상태 표현을 사용하고, 결제·저장 버튼은 `opacity: 0.6`과 진행 커서를 사용한다.

### Chips

- **Style:** 필터 버튼, 요금제 태그, 도메인 표시는 `999px` 캡슐과 짧은 내부 패딩을 사용한다.
- **State:** 선택된 필터는 Brand Soft, 후보 메일은 Candidate Yellow, 결제 후보는 Brand Soft로 구분한다. 칩마다 의미를 색상만으로 전달하지 않고 텍스트를 함께 둔다.

### Cards / Containers

- **Mail shell:** 웹은 `Raised Surface`, 모바일은 흰색 표면을 사용하며 24–28px 반경과 낮은 녹색 그림자를 갖는다.
- **Settings / recommendation:** Muted Surface와 Strong Line, 17–18px 반경, 16–20px 내부 여백을 사용한다.
- **Pricing:** 카드마다 1px Strong Line과 22–28px 내부 패딩을 사용하고, featured 카드만 medium shadow로 우선순위를 표시한다.
- **Legal:** 정책 문서는 흰색 반투명 카드 하나에 800px 읽기 폭과 `1.7–1.75` 행간을 사용한다.

### Inputs / Fields

- **Style:** IMAP 입력과 선택 상자는 Surface 배경, Strong Line 1px, `10px` 반경, `10px 12px` 패딩, `14px` 본문 크기다.
- **Focus:** 전역 Forest Brand outline을 사용한다. 입력 오류는 Error Red 텍스트로 설명하며 색상만으로 표시하지 않는다.
- **Grouping:** 호스트·포트는 `1fr 100px` 2열, 모바일에서도 같은 구조를 유지한다.

### Navigation

- **Style:** `.gnb`는 sticky 캡슐, 반투명 Surface, 1px Line, 14px blur다. 웹은 `top: 12px`, 모바일은 `top: 10px`이다.
- **Brand mark:** 싹메일 텍스트 옆에 8–9px Forest Brand 원형 점을 둔다.
- **Mobile treatment:** 도메인 보조 태그는 숨기고, `480px` 안쪽에서 터치 가능한 링크·메뉴 패딩을 유지한다.

### Mail Workspace

메일 작업면은 제품의 signature component다. 상단 toolbar에서 계정과 설정을 보여주고, 동의·자동정리 설정은 Muted Surface 패널에 progressive disclosure로 둔다. 목록은 색을 많이 쓰지 않는 Surface Tint 행과 텍스트 메타데이터로 스캔하게 하며, 선택 행은 Brand Soft와 왼쪽 inset bar로 표시한다. 데스크톱은 목록과 상세를 나란히, 모바일은 목록과 상세를 순차적으로 보여준다. 롱프레스 컨텍스트 메뉴와 삭제 확인 dialog는 위험한 동작을 분리하고, `prefers-reduced-motion`에서는 custom animation을 끈다.

## Do's and Don'ts

### Do:

- **Do** `--ssak-*` 토큰과 Astryx theme 토큰을 먼저 재사용하고, 새 값은 현재 녹색·반경·간격 체계 안에서 추가한다.
- **Do** Forest Brand를 일반 상호작용의 유일한 강조색으로 유지하고, 상태 색상에는 텍스트·아이콘·레이블을 함께 둔다.
- **Do** 웹 2열과 모바일 단일 열의 같은 메일 흐름을 보존한다.
- **Do** 목록은 카드 안의 행으로 유지하되, 각 메일 행을 별도 카드로 중첩하지 않는다.
- **Do** 로딩·빈 목록·오류·동의 불가·삭제 확인 상태를 명시적으로 설계한다.
- **Do** `prefers-reduced-motion: reduce`를 custom animation과 transition에 적용한다.

### Don't:

- **Don't** 새 화면마다 다른 녹색, 무지개 상태색, 이모지 아이콘, 순수 검정 텍스트를 추가하지 않는다.
- **Don't** 캡슐 내비게이션과 둥근 카드 언어를 날카로운 사각형·강한 검은 그림자와 섞지 않는다.
- **Don't** 자동정리·AI 추천을 영구 삭제처럼 표현하거나 사용자 확인 없이 위험한 행동을 실행하지 않는다.
- **Don't** 기존 반응형 전환을 깨뜨리거나 모바일에서 메일 상세를 목록과 동시에 좁게 압축하지 않는다.
- **Don't** 문서·UI에 확인되지 않은 고객 수치, 추천사, 가격·법률 준수 주장을 시각적 권위처럼 추가하지 않는다.
