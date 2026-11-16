# GA refresh 구현 결과 — 2026-11-16

상태: **승인 범위 구현 및 독립 snapshot 통합 QA 완료**. 최종 결과와 이관 조정자의 증거 대조·자원 정리는 [verification.md](./verification.md)의 마지막 절을 따른다. 아래 중간 실패·대기 기록은 당시 상태를 보존한 것이다.
기준: [승인 계획](./plan.md), task `GA-IMPLEMENT` / `task_1c38b7c8e662`.
실제 GA 계정, 배포, 수신 데이터에는 접근하거나 변경하지 않았다.

## 변경 내용

- 초기 태그 effect와 연습 helper가 같은 idempotent 초기화를 사용한다. 외부 JS를 요청하기 전에 표준 `dataLayer`/`gtag` 큐에 `js → config(send_page_view:false)`를 넣는다. 스크립트가 지연돼도 첫 페이지뷰·연습 이벤트가 큐에 남고, 반복 mount/준비 호출은 초기 config를 중복하지 않는다. 기존 `NEXT_PUBLIC_GA_MEASUREMENT_ID || G-RHJP137HQZ`와 production 전용 동작을 유지했다.
- pathname effect의 취소 가능한 한 번의 task에서 현재 제목을 읽고 수동 `page_view`를 보낸다. 문서 안의 마지막 측정 경로를 공유하므로 tracker remount·같은 경로·query/hash 변경은 추가 페이지가 아니다. 다른 경로를 거친 뒤 back/forward로 돌아오면 새 페이지다. stale pathname effect는 현재 경로로 잘못 보내지 않는다.
- 초기 config와 이후 config update/page*view에 정제한 title/path/location/referrer를 사용한다. query/hash와 URL 인증 정보는 보내지 않는다. 외부 referrer는 origin까지만, 같은 origin은 경로까지 유지한다. 랜딩 UTM 6종은 공식 `campaign*\*`config 필드로 제한하며 1–100자의 공개 라벨 문자만 허용한다.`update:true`와 campaign 필드는 [공식 config 문서](https://developers.google.com/analytics/devguides/collection/ga4/reference/config)에서 확인했다.
- 기존 기본 연습 `practice_*` payload와 `note_quiz_*`, `ear_training_*`, 기타 호환 helper를 유지했다. melody는 공통 funnel의 `entered/started/completed`와 별도의 `practice_preview_started`만 추가한다. 기존 note/ear 호환 계열을 melody에 중복 생성하지 않는다.
- melody 관측기는 `hydrated/exercise/session`을 읽는다. 시작은 실제 `playing` 또는 유효한 최종 aggregate result로 증명한다. 준비·권한 실패·count-in 취소는 시작/완료가 아니다. 같은 시도의 pause/resume은 한 시작이며, 결과·reset·retry·새 exercise/store 토큰·오류·실제 unmount를 메모리 안에서 중복 제거한다. StrictMode의 cleanup/setup은 한 microtask의 세대 검사로 실제 이탈과 구분한다.
- 최종 결과의 음 수/`passed` 수와 기존 store의 최종 clock만 집계한다. 중도 종료에는 `completed=false`와 가능한 마지막 관측 진행 시간(100ms 내림)만 보내고 부분 문제 수·정답 수·점수를 만들지 않는다. 내부 객체·토큰, seed, 음 이름·주파수·답안·녹음·장치 정보는 payload에 없다.

이벤트의 정확한 의미·생략 필드·보고서 필터·UTM/referrer 계약은 [학습 지표 문서](../learning-metrics.md)에 정리했다.

## 정확한 소유 파일

| 파일                                                          | 변경                                                                               |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/lib/analytics.ts`                                        | 공용 큐 사용, 기존 helper 보존, 선택적인 elapsed aggregate와 melody preview helper |
| `src/lib/analytics.test.ts`                                   | 기존 payload 전체 호환 및 private extra 필드 제외 검증 강화                        |
| `src/lib/analytics-runtime.ts` (신규)                         | production 초기화, 표준 큐, URL/UTM 정제, 경로 dedup·context update                |
| `src/lib/analytics-runtime.test.ts` (신규)                    | 지연 초기화·순서·back/forward·query·제목·referrer·campaign·개인정보 테스트         |
| `src/components/analytics/GoogleAnalytics.tsx`                | 큐 초기화 이후 외부 Script 렌더링                                                  |
| `src/components/analytics/GoogleAnalyticsRouteTracker.tsx`    | pathname만 관측하는 공용 scheduler 연결                                            |
| `src/components/analytics/GoogleAnalytics.test.tsx` (신규)    | Node effect fixture로 script 순서와 tracker wiring 검증                            |
| `src/features/melody/hooks/melody-analytics.ts` (신규)        | aggregate-only 순수 관측기                                                         |
| `src/features/melody/hooks/melody-analytics.test.ts` (신규)   | 시도 lifecycle·실패·stale snapshot·exactly-once 검증                               |
| `src/features/melody/hooks/useMelodyAnalytics.ts` (신규)      | 기존 결과에서 집계만 읽고 컴포넌트 lifecycle 연결                                  |
| `src/features/melody/hooks/useMelodyAnalytics.test.ts` (신규) | Node hook fixture로 StrictMode/이탈·집계·초기화/preview 구분 검증                  |
| `src/features/melody/components/MelodyPractice.tsx`           | 승인된 import 1개와 hook call 1개만 추가                                           |
| `scripts/verify-analytics.cjs` (신규)                         | 독립 QA용 controlled-tag 브라우저 회귀 runner                                      |
| `docs/learning-metrics.md`                                    | 이벤트·지표·privacy·GA Admin/DebugView·custom definitions 절차                     |
| `docs/analytics-refresh/implementation.md` (신규)             | 이 보고서                                                                          |

`MelodyPractice.tsx`는 시작부터 다른 작업의 큰 dirty diff가 있었다. 이 작업의 추가분은 아래 두 줄이며, 기존 UI/audio/notation/locale 변경은 보존했다.

```diff
+import { useMelodyAnalytics } from "../hooks/useMelodyAnalytics";
@@ const session = useChallengeSession(exercise, settings), s = session.state;
+  useMelodyAnalytics(hydrated, exercise, session);
```

`RootDocument`/layout, `useChallengeSession`, store/controller, scoring, audio, timer, translations, package/lockfile에는 이 작업의 변경이 없다. commit/push, 배포, DB·계정 설정 변경, 새 production dependency/설치, 새 localStorage/sessionStorage/cookie/사용자 식별자는 없다. root `.next`, user3001, 사용자 브라우저·탭을 사용하거나 변경하지 않았다.

## 실제 실행한 검증

최종 집중 실행:

```sh
npx vitest run --no-cache src/lib/analytics.test.ts src/lib/analytics-runtime.test.ts src/components/analytics/GoogleAnalytics.test.tsx src/features/melody/hooks/melody-analytics.test.ts src/features/melody/hooks/useMelodyAnalytics.test.ts
```

**5 files / 38 tests 통과**. 각 파일은 14 / 6 / 3 / 12 / 3 tests다. 마지막 실행 출력의 duration은 463ms였다. 앞선 개발 중 30개·33개 집중 실행도 통과했으며 최종 38개가 확장된 호환성 검증을 포함한다.

| 수용 기준                                | 실제 집중 증거                                                                                                                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| tag가 늦어도 첫 event/page_view 보존     | runtime test에서 외부 라이브러리 없이 `js/config/entered/config/page_view` 큐 순서를 검사하고 나중의 controlled consumer로 전달                                                          |
| 중복 초기화/readiness/mount 방지         | runtime 및 component fixture에서 초기화 반복·동일 경로 effect 재실행·cleanup 취소 검사                                                                                                   |
| pathname/locale/back-forward vs query    | runtime test의 note → ear → note(back) → ear(forward) → ko/ear와 query-only 변경 검사                                                                                                    |
| title/location/referrer/campaign/privacy | 커밋 task 전 제목 갱신, 이전 앱 페이지 referrer, 외부 origin만 보존, UTM 6종, overlong/email/URL/control/query 값 배제                                                                   |
| 기존 기본 이벤트 호환                    | 기본 4모드와 기존 note/ear 전체 payload, 기타 helper 이름·단일 호출, 알려지지 않은 private extra 제외                                                                                    |
| melody exactly-once                      | hydration, preview 준비/실패/실제 재생, 권한 실패, count-in 취소, playing·120 frame snapshots, pause/resume, result 중복, reset/retry/새 exercise, 오류, stale token/exercise, exit 검사 |
| 실제 결과·clock 집계 및 생략             | hook fixture의 결과 notes 4개/pass 2개와 canonical 20.125s를 정확히 4/2/20125ms로 관측; visual elapsed 999는 배제; 중도 종료 totals 없음                                                 |
| StrictMode vs 실제 unmount               | 같은 effect cleanup/setup 후 완료 0개, 실제 cleanup 후 interrupted 1개 검사                                                                                                              |

추가 실행:

```sh
npx eslint src/lib/analytics.ts src/lib/analytics.test.ts src/lib/analytics-runtime.ts src/lib/analytics-runtime.test.ts src/components/analytics/GoogleAnalytics.tsx src/components/analytics/GoogleAnalyticsRouteTracker.tsx src/components/analytics/GoogleAnalytics.test.tsx src/features/melody/hooks/melody-analytics.ts src/features/melody/hooks/melody-analytics.test.ts src/features/melody/hooks/useMelodyAnalytics.ts src/features/melody/hooks/useMelodyAnalytics.test.ts scripts/verify-analytics.cjs
node --check scripts/verify-analytics.cjs
env -u UI_BASE_URL node scripts/verify-analytics.cjs
git diff --check -- src/lib/analytics.ts src/lib/analytics.test.ts src/components/analytics src/features/melody/hooks docs/learning-metrics.md scripts/verify-analytics.cjs
```

- Focused ESLint와 script syntax: **통과**. 처음 lint에서 발견한 fixture 함수 이름, StrictMode 세대 ref 캡처와 표준 `IArguments` 사용의 한 줄 lint 예외를 수정한 뒤 error/warning 없이 통과했다.
- `UI_BASE_URL` 누락 실행: **예상한 exit 1**, `UI_BASE_URL is required`로 브라우저/module 로딩 전에 중단했다. 실제 브라우저 실행 성공으로 세지 않는다.
- Diff whitespace 검사: 통과. 최종 doc/script 확인은 아래 완료 기록에 덧붙인다.
- 허용 파일의 Prettier 정리를 수행했다. `MelodyPractice.tsx` 전체를 포맷하지 않았다.

프로젝트 tsconfig 옵션을 사용한 **범위 지정 TypeScript 진단 15 roots 통과**. `.next` 출력·tsbuildinfo를 만들지 않도록 emit을 호출하지 않고 incremental을 껐다. 실제 명령은 다음과 같다.

```sh
node <<'NODE'
const ts = require('typescript');
const configFile = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, process.cwd(), { incremental: false });
const files = [
  'src/lib/analytics.ts', 'src/lib/analytics.test.ts',
  'src/lib/analytics-runtime.ts', 'src/lib/analytics-runtime.test.ts',
  'src/components/analytics/GoogleAnalytics.tsx', 'src/components/analytics/GoogleAnalyticsRouteTracker.tsx',
  'src/components/analytics/GoogleAnalytics.test.tsx',
  'src/features/melody/hooks/melody-analytics.ts', 'src/features/melody/hooks/melody-analytics.test.ts',
  'src/features/melody/hooks/useMelodyAnalytics.ts', 'src/features/melody/hooks/useMelodyAnalytics.test.ts',
  'src/features/melody/components/MelodyPractice.tsx',
  ...config.fileNames.filter(name => name.endsWith('.d.ts') && !name.includes('/.next/')),
];
const program = ts.createProgram(files, config.options);
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) {
  console.log(ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCurrentDirectory: () => process.cwd(), getCanonicalFileName: name => name, getNewLine: () => '\n' }));
  process.exitCode = 1;
} else console.log(`Scoped TypeScript diagnostics: passed (${files.length} roots, no emit, incremental disabled).`);
NODE
```

## 독립 QA가 이어서 실행할 항목

이 worker는 root에서 full suite / `npx tsc --noEmit` / configured `npm run lint` / production build / server / 브라우저 검사를 실행하지 않았다. 다른 coordinator가 관리하는 **source-hashed isolated snapshot**에서 독립 QA가 수행한다. Focused ESLint 통과는 configured lint command의 통과를 뜻하지 않는다. Node effect/hook fixture는 실제 React DOM lifecycle과 별도의 증거다.

새 browser runner는 `UI_BASE_URL`을 필수로 요구하고 HTTP(S) loopback 주소만 허용하며 보호된 port3001을 거부한다. 기존 외부 Playwright/Chrome을 사용해 독립 Chromium context를 띄운다. 서버를 시작·재시작·프로세스에 attach하거나 사용자 탭을 쓰지 않는다. Google JS는 **controlled queue consumer stub**으로 fulfill하고 나머지 외부 요청과 모든 write를 차단한다. 합성 microphone의 결과이며 실제 Google collection/물리 microphone·가청 출력 검증이 아니다.

독립 QA가 준비한 서버·외부 모듈·Chrome 경로와 실제 build ID로 다음 형태로 실행한다. 여기의 변수는 QA 소유 값을 명시해야 하며 worker가 실행한 명령이 아니다.

```sh
UI_BASE_URL="$QA_SNAPSHOT_URL" PLAYWRIGHT_MODULE="$QA_PLAYWRIGHT_MODULE" BROWSER_PATH="$QA_CHROME_PATH" EXPECTED_BUILD_ID="$QA_BUILD_ID" UI_ARTIFACT_DIR="$QA_ARTIFACT_DIR" node scripts/verify-analytics.cjs
```

`UI_MOBILE=1`을 추가하면 390×844, 기본은 1440×900이다. 초기 지연 큐, 실제 모드/언어 이동·back/forward·query, 기본 note 호환 계열, melody preview/권한 실패/count-in 취소/playing/pause/resume/완료/reset/retry/이탈을 검사하고 `report.json`에 calls와 실패를 남긴다. 최종 passed/total은 화면의 결과와도 비교한다. 실제 브라우저에서의 준비 실패·새 seed·빠른 이동 등 추가 QA는 승인 계획 기준으로 보완한다. **이 worker는 이 runner의 브라우저 본 실행을 아직 하지 않았다.**

## 운영에서 남은 확인

- `send_page_view:false`는 Enhanced Measurement history page_view를 비활성화하지 않는다. 운영자가 **Admin → Data streams → Web → Enhanced measurement → Page views → Show advanced settings → Page changes based on browser history events 끄기**와 다른 태그의 자동 page-load 중복을 확인해야 한다. 계정 전체 dedup·계정 설정 변경을 완료했다고 주장하지 않는다. [공식 설명](https://developers.google.com/analytics/devguides/collection/ga4/views).
- 배포 이후 승인된 테스트 브라우저에서 DebugView의 이름/속성/개수, title/location/referrer와 UTM 귀속을 확인하고 필요한 event-scoped dimensions/metrics를 등록해야 한다. 절차와 정확한 parameter 이름은 학습 지표 문서에 있다. 실제 Google 수신·보고서 귀속은 미검증이다.
- hard close/프로세스 종료/네트워크 차단은 effect cleanup이나 큐 전달을 보장하지 않는다. 저장 큐·새 식별자를 추가하지 않았으므로 누락된 방문·개인별 여정을 복원하지 않는다. elapsed는 악보 진행 시간이며 중도 종료의 최종 몇 frame과 실제 총 체류 시간으로 해석하지 않는다.
- 호환 이벤트와 공통 funnel을 합산하지 않는다. `melody`의 `exercise/custom` 및 결과 없는 interrupted event를 기본 `ten` 완주·복습·재시작 지표와 섞지 않는다.

## 최종 완료 확인

마지막 script/doc 포맷 이후 `node --check scripts/verify-analytics.cjs`, `npx eslint scripts/verify-analytics.cjs`와 위 범위의 `git diff --check`를 다시 실행해 모두 exit 0을 확인했다. `UI_BASE_URL=http://localhost:3001 node scripts/verify-analytics.cjs`는 **예상한 exit 1**, `user3001 is protected`로 모듈/브라우저 로딩 전에 중단했다. 보호된 서버에 요청하지 않았다. 최종 working-tree 목록은 시작 때의 기존 UI/audio/notation/locale 변경에 위 소유 파일의 추가·수정이 더해진 상태이며, 전체 dirty diff를 이 worker의 변경으로 계산하지 않는다.

## 독립 QA 후 runner fixture 수정 — task_f5254ec16f27

독립 QA의 원본 `/tmp/note-quiz-ga-qa-run_917b0e85cedf/desktop/report.json`과 `mobile/report.json`을 읽어 두 폭 모두 basic-practice case가 `Start practice` 클릭 timeout으로 실패하고 melody case는 통과했음을 확인했다. QA가 `/tmp/note-quiz-ga-qa-run_917b0e85cedf/diagnose.json`으로 진단한 원인은 runner의 `/api/leaderboard` 응답 fixture가 현재 계약과 다른 `countries/totalParticipants/totalPoints/totalSessions`를 반환한 것이었다. UI에서 필요한 `entries/viewerCountry`가 없어 basic 연습 검사가 진행되지 못했다.

현재 `src/types/leaderboard.ts`의 `LeaderboardResponse`는 `viewerCountry: LeaderboardCountry`, `periodDate: string`, `entries: LeaderboardEntry[]`다. `LeaderboardCountry`의 세 string 필드는 `countryCode/countryName/flag`다. `src/lib/leaderboard/country.ts`와 해당 기존 테스트의 익명 fallback을 근거로 `XX / Unknown / 🏳`를 정적 fixture에 사용했다. 실제 국가 조회·사용자 정보가 아니다.

이 후속 작업은 runner의 아래 블록만 교체하고 이 기록을 append했다. 원본 파일을 보존해 비교했으며, 이 블록 이외의 runner bytes는 동일함을 확인했다. 기존 basic case·assertion·privacy guard는 모두 유지했고 production app/leaderboard/store/UI 파일은 수정하지 않았다.

```diff
@@ /api/leaderboard fixture
-          countries: [],
-          totalParticipants: 0,
-          totalPoints: 0,
-          totalSessions: 0,
+          viewerCountry: {
+            countryCode: "XX",
+            countryName: "Unknown",
+            flag: "🏳",
+          },
           periodDate: "2026-11-16",
+          entries: [],
```

직접 실행한 확인은 `node --check scripts/verify-analytics.cjs`와 `npx eslint scripts/verify-analytics.cjs`이며 **둘 다 exit 0**, lint error/warning 없이 통과했다. `shasum -a 256 scripts/verify-analytics.cjs` 결과는 아래와 같다.

```text
before: 808e9257b6f097acd3be2b6277887c5002ff5819c39a8245d47c39934f6605f5
after:  0a614fd3e31d6234e119e89f30975616e4cbd20a7d5a01fd37eed755b9ecd111
```

이 worker는 브라우저·서버·빌드를 실행하지 않았다. Coordinator가 전달한 독립 QA의 1218 unit tests / TypeScript / configured lint / build 통과 및 두 폭의 melody 통과는 이 후속 worker가 재실행한 결과와 구분한다. QA 소유 build `9kvqb1MJcXZauHnvjIIk3`에서 수정된 runner로 desktop/mobile basic case를 다시 확인하는 일이 남았다. 이전 실패 기록은 그대로 보존하며 수정 후 브라우저 통과로 덮어쓰지 않는다. 실제 GA 수신과 Admin 설정도 여전히 이 수정의 검증 범위 밖이다.

## Navigation fixture modal correction — task_b5bb06630a8d

Coordinator supplied `/tmp/note-quiz-ga-qa-run_917b0e85cedf/supplement-v2.log`, which records the actual failure: after `End Game`, the result dialog remains open and intercepts clicks on the parent practice-mode label. QA explicitly corrected its earlier hypothesis; hidden radio input size is not established as the cause.

The basic-practice runner now clicks the existing visible `[data-minimize-results]` control, waits for the actual role-dialog to detach, then clicks the visible associated label for the `ear` radio with normal Playwright interaction (no force). It asserts that the radio becomes checked. Existing page-view/referrer/title counts, navigation/back-forward checks, privacy assertions, result evidence, the corrected leaderboard fixture and all other basic/melody cases remain in place. No app code changed.

Checks run: `node --check scripts/verify-analytics.cjs` exit 0; `npx eslint scripts/verify-analytics.cjs` exit 0 with no diagnostics. No browser, server, or build was launched. Current SHA-256:

```text
scripts/verify-analytics.cjs  1a0a1d8fa6feac5fc229580e3f115dc185ea275cf00208942f389ca0251a819e
docs/analytics-refresh/implementation.md  654517b7292bc2924287f9623a63ef1303b35e4aa8db9eb044a176bf4e0efb96
```

QA still needs to rerun desktop and mobile basic cases against its isolated build `9kvqb1MJcXZauHnvjIIk3`.

## GA context-race continuation — ctx_6029fd14d703 / task_b5bb06630a8d

이 기록은 위의 이전 완료 상태와 오래된 build 재사용 안내를 대체한다. Coordinator의 `msg_1810d02a412f`와 [context-fix.md](./context-fix.md)에 따라 runner만의 수정에서 승인된 GA 문맥 경쟁 수정까지 범위를 이어받았다. 이전 worker의 부분 수정은 보존했고, 앱 source가 바뀌었으므로 독립 QA에는 **새 source snapshot/build**가 필요하다.

변경한 application 파일은 `src/lib/analytics-runtime.ts`, `src/lib/analytics.ts`, `src/features/melody/hooks/useMelodyAnalytics.ts`이며, 회귀 테스트는 `src/lib/analytics-runtime.test.ts`, `src/features/melody/hooks/useMelodyAnalytics.test.ts`다. 그 외 변경은 `scripts/verify-analytics.cjs`, 이 보고서와 plan/context 문서, `docs/learning-metrics.md`뿐이다. MelodyPractice의 기존 import/call, analytics components, 순수 observer, 게임 store/controller/audio/UI/translation의 기존 dirty 코드는 이번 continuation에서 수정하지 않았다.

- 이벤트 직전 pathname뿐 아니라 현재 title도 config에 동기화한다. 초기 config와 같은 문맥이면 추가 config를 만들지 않는다. 페이지뷰보다 먼저 진입한 경로도 referrer의 기준이 되며, 같은 경로의 metadata 갱신은 이전 referrer를 유지한다. 늦은 page_view는 그때의 갱신된 제목을 다시 읽는다.
- 멜로디 hook은 화면의 정제된 path/location/title/referrer만 메모리 ref에 보관하고 milestone에서 갱신한다. 지연 unmount 완료는 보관한 origin을 event scope에 넣으며 incoming config를 되돌리지 않는다. 기존 기본 연습 helper의 event 필드 계약은 유지한다. [Google tag의 config 상속과 event 우선순위](https://developers.google.com/tag-platform/gtagjs/reference#parameter_scope)를 공식 문서에서 확인했다.
- 잘못된 기존 테스트의 “outgoing note 완료가 incoming ear에 속한다”는 기대를 outgoing melody origin 보존 회귀로 교체했다. hook 회귀는 실제 runtime/helper를 사용해 cleanup 예약 → incoming 진입/config/page_view → microtask 완료의 순서를 검사하며 exactly-once, 이전 melody 제목/referrer, incoming 기본 문맥 유지, 개인정보 제외를 확인한다.
- runner는 raw calls를 증거로 보관하면서 최신 target config와 event override를 합친 유효 문맥을 검증한다. 기존 URL/page-view/referrer/title/count/privacy 및 모든 basic/melody case를 유지했다. ear 진입의 유효 title/path는 controlled consumer가 해당 이벤트를 받는 시점의 실제 document title/path와도 비교한다. melody 이탈 완료는 원래 melody origin, incoming note view는 새 화면 origin을 검사한다.
- 실제 `SegmentedControl`은 label 안에 radio와 보이는 span을 둔다. 기존 정상 parent-label 클릭과 체크 확인을 유지했다. 추가 DOM 대조에서 `PracticeDialog`가 close 후에도 mount된 채 남는 것을 확인해 결과 최소화 후 `detached` 대기를 `hidden` 대기로 고쳤다. 이 대기는 모달이 사라져 정상 클릭할 수 있는 상태를 증명하며, force·case 삭제·앱 변경을 사용하지 않았다. 결과 heading/aggregate, 언어 select, header 링크, phase 및 버튼 문자열은 현재 source에 대응함을 확인했다; 실제 클릭 성공은 QA가 확인해야 한다.

직접 실행한 최종 검증:

```sh
npx vitest run --no-cache src/lib/analytics.test.ts src/lib/analytics-runtime.test.ts src/components/analytics/GoogleAnalytics.test.tsx src/features/melody/hooks/melody-analytics.test.ts src/features/melody/hooks/useMelodyAnalytics.test.ts
npx eslint src/lib/analytics.ts src/lib/analytics.test.ts src/lib/analytics-runtime.ts src/lib/analytics-runtime.test.ts src/components/analytics/GoogleAnalytics.tsx src/components/analytics/GoogleAnalyticsRouteTracker.tsx src/components/analytics/GoogleAnalytics.test.tsx src/features/melody/hooks/melody-analytics.ts src/features/melody/hooks/melody-analytics.test.ts src/features/melody/hooks/useMelodyAnalytics.ts src/features/melody/hooks/useMelodyAnalytics.test.ts scripts/verify-analytics.cjs
node --check scripts/verify-analytics.cjs
git diff --check -- src/lib/analytics.ts src/lib/analytics.test.ts src/components/analytics src/features/melody/hooks docs/learning-metrics.md scripts/verify-analytics.cjs
env -u UI_BASE_URL node scripts/verify-analytics.cjs
env UI_BASE_URL=http://localhost:3001 node scripts/verify-analytics.cjs
```

Vitest는 **5 files / 43 tests 통과**, 파일별 14 / 10 / 3 / 12 / 4개이며 마지막 실행 duration은 481ms였다. 처음 인계받은 runtime 파일은 8개 중 4개가 실패했다; 초기 config의 불필요한 중복 기대와 event 안에 config 필드 복제를 요구하는 기대를 유효 문맥 검사로 바로잡고, metadata/referrer 및 outgoing 회귀를 추가했다. Scoped ESLint는 error/warning 없이 exit 0, syntax와 diff whitespace도 exit 0이었다. 위 보고서에 실린 동일한 TypeScript API 명령(15 roots, 프로젝트 옵션, incremental:false, no emit)을 다시 실행해 통과했다. 마지막 두 guard 실행은 각각 `UI_BASE_URL is required`, `user3001 is protected`로 **예상한 exit 1**이며, 모듈·브라우저·서버 요청 전에 중단했다.

이번 continuation 직전 source를 `/tmp/note-quiz-ga-context-6029-before/`에 보관해 현재 worker의 차이만 비교했다. 정확한 7개 파일(application 3, tests 2, runner, metrics contract)의 unified diff는 `/tmp/note-quiz-ga-context-6029.diff`이며 SHA-256은 `dccf10af91524bf8a6ed7e1ab78455e86fa7c821972da83b8f5d1de3354bfeec`다. 이 diff는 추가 기록용 implementation/plan/context 문서 자체를 제외하며, runner 차이는 **+60/-5 lines**다. 이전 기록의 runner hash가 아닌 실제 인계 시점과 현재 hash는 아래와 같다.

```text
before scripts/verify-analytics.cjs fe1980354ca2e8ddafaea548ad35178a1a27d7cb9675f23da31020a3cece00b2
after  scripts/verify-analytics.cjs 15ed9ad58c0c32c42c6f153d83ec6bd48908c720b7f595bb67375e085730a51b
src/lib/analytics-runtime.ts c62933105f2be696ace9d8a3cda889135a063546259670b19d61fc4dd1ada029
src/lib/analytics-runtime.test.ts c5f208de93ba4d52a0da6cd5927062494d50eadb2575f06ea381de7bc23685e5
src/lib/analytics.ts 4a2e3757512fe9f762c745d3d48acd18681bf726f51781a401dc78f3ef7db8f2
src/features/melody/hooks/useMelodyAnalytics.ts dc9b61e1b4327456fe445d3024746764b46b40a5fb5413343cf6c7d753f1996e
src/features/melody/hooks/useMelodyAnalytics.test.ts 2846b413b3cb45427072f469214e68e22159e04bde118e69a917cd03aaf8ce54
docs/learning-metrics.md 34a6e70048e0885f81c2773aa2f2ea6e80c9def31e3e5b9d614d4f1498d65529
```

현재 application source는 **독립 QA를 위해 동결**한다. 이번 worker는 full suite/전체 tsc/configured npm lint/production build/서버/브라우저를 실행하지 않았으며, 이전 QA의 1218 tests/build 결과를 이번 source의 통과로 간주하지 않는다. 독립 QA `ctx_4e81af7624b0`의 fresh snapshot에서 desktop/mobile의 실제 보이는 라벨 클릭과 전체 runner를 검증하는 일이 남았다. 실제 Google 수신, Admin 설정 및 배포 상태는 변경하거나 검증하지 않았다.

## Final runner result-dialog selector — task_7b455cbb0297 / ctx_3e7938002d77

`/tmp/note-quiz-ga-qa-run_917b0e85cedf/final/desktop.log`와 `mobile.log`에서 최소화 이후 기존 `[role="dialog"]` 대기가 nationality/history/result/settings의 mounted dialog 4개를 찾아 strict-mode violation으로 실패한 것을 확인했다. `PracticeResultSurface`의 최소화 버튼은 결과 dialog 안에 있고, `PracticeDialog`는 close 이후에도 mount되어 있다. 따라서 클릭 전에 그 버튼을 포함하는 결과 dialog를 지정하고 유일성을 검증한 뒤, 그 dialog 안의 실제 버튼을 정상 클릭하고 같은 locator의 hidden 상태를 기다린다.

정확한 runner 변경은 아래 단일 블록의 **+6/-2 lines**다. 역치환하여 변경 전 문자열과 완전히 일치함을 확인했으므로 이 블록 밖의 runner bytes는 보존했다. ear의 보이는 parent-label 클릭과 checked 검증, 모든 case/event/pageview/title/referrer/effective-context/privacy/lifecycle/write/external-GA/port guard는 그대로다.

```diff
-        await page.locator("[data-minimize-results]").click();
+        const resultDialog = page.locator(
+          '[role="dialog"]:has([data-minimize-results])',
+        );
+        assert.equal(await resultDialog.count(), 1);
+        await resultDialog.locator("[data-minimize-results]").click();
         // PracticeDialog stays mounted after close(); only its visibility and
         // native open/top-layer state change before the mode label is usable.
-        await page.locator('[role="dialog"]').waitFor({ state: "hidden" });
+        await resultDialog.waitFor({ state: "hidden" });
```

직접 실행한 검사는 아래 세 명령이며 모두 **exit 0**, ESLint diagnostics 없음이다. ESLint는 기존 로컬 실행 파일과 설정을 사용하고 cache를 끈다.

```sh
node --check scripts/verify-analytics.cjs
./node_modules/.bin/eslint --no-cache scripts/verify-analytics.cjs
git diff --check -- scripts/verify-analytics.cjs docs/analytics-refresh/implementation.md
```

Node `crypto.createHash('sha256')`로 기록한 runner SHA256:

```text
before 15ed9ad58c0c32c42c6f153d83ec6bd48908c720b7f595bb67375e085730a51b
after  7e7638fa72b25d47efe872323ea373a015209603496371b4e6694236d2431125
```

이 작업은 runner와 이 append 기록만 수정했으며 app/tests/deps/다른 문서 및 기존 dirty UI/audio/source는 수정하지 않았다. 브라우저/서버/build/install/commit/push/deploy/계정/DB 작업이나 root cache 쓰기는 하지 않았다. QA가 소유한 동일한 immutable app build `hloO5iS0hIiHecioXCufM`의 port3027/PID63151 서버에서 새 runner로 desktop/mobile을 재실행하는 일이 남았다; script-only 수정이므로 rebuild는 필요 없다. 전달받은 기존 full suite/tsc/configured lint/build/supplemental/React DOM 결과는 이 worker가 실행한 검사로 주장하지 않는다.


## Runner locale contracts — task_e38697f74c1f / ctx_9477dc9fa7b2

인계 runner `7e7638fa72b25d47efe872323ea373a015209603496371b4e6694236d2431125`와 실제 `src/lib/i18n/locale.ts:50–60`, `LanguageSelector.tsx:37–46`, `LanguageInitializer`, `useTranslation`, 두 root layout, locale ear page와 `PracticeClient`의 경로/진입 계약을 읽었다. 보존된 `final/desktop-rerun/report.json`, `final/mobile-rerun/report.json`은 두 폭 모두 실제 note→ear/back/forward와 결과 dialog 상호작용을 지난 뒤 잘못된 locale URL 대기로 실패하고 melody는 통과한 기록이다. `/tmp/note-quiz-ga-qa-run_917b0e85cedf/final/desktop-rerun`과 `mobile-rerun`의 원본 파일은 변경하거나 덮어쓰지 않았다.

앱 계약은 다음과 같다. 비접두사 `/practice/ear`의 선택기는 `languageSwitchHref === null`이므로 `setLanguage`만 호출한다. 기존 basic case는 ko를 정상 선택하고 select 값, `html.lang === ko`, 보이는 “연습 시작” 버튼으로 실제 언어 변경을 기다린 뒤 200ms의 제한된 중복 확인 구간을 둔다. 실제 전체 URL이 그대로이고 기존 4개 page_view가 내용까지 동일하며 이전 raw calls가 그대로 남는지 검사한다. 이때 페이지 제목 갱신은 새 페이지뷰를 뜻하지 않는다. 기존 delayed queue, early entered의 유효 context, note legacy events, query/privacy, back/forward, 유일한 결과 dialog 최소화 검사는 유지했다.

별도의 `context(browser)` case는 `/en/practice/ear?email=private-email#private-fragment`에서 시작해 보이는 실제 언어 선택기를 정상 조작하여 `/ko/practice/ear`로 이동한다. URL 계약에 따라 fixture query/hash도 그대로 유지하며 전송 payload에는 제거되는지 검사한다. 새 context에도 기존 controlled gtag와 모든 external/write interception을 그대로 적용한다. 실제 UI·URL·대상 event가 준비되기 전에는 sleep을 준비 증거로 사용하지 않으며, 마지막 200ms는 중복 부재 확인에만 사용한다. `router.push`와 root-layout 변경이 같은 문서 이동인지 전체 문서 이동인지는 `performance.timeOrigin`으로 관찰한다. 이동 전에 저장한 원본 raw baseline을 보존하고, 같은 문서이면 원본 prefix 일치를 검증하며, 새 문서이면 두 raw stream을 합쳐 정확히 총 2개(원본 1개, 대상 1개) page_view를 요구한다. 대상 raw/effective view와 현재 config의 title/path/location/referrer를 실제 제목·정제된 URL·이전 en 경로와 대조하고 `send_page_view:false` 및 전체 payload privacy를 검사한다. 언어만 바뀔 때 `PracticeClient`가 별도 entered를 발행한다고 가정하지 않는다; 기존 basic entered 검사는 유지된다. 새 locale case는 가짜 history 이동을 사용하지 않는다.

이번 worker의 변경은 아래 정확한 runner diff **+103/-15 lines**와 이 append 기록뿐이다. 원본 대비 locale 블록 앞의 모든 bytes와 melody case 시작부터 파일 끝의 모든 bytes가 동일함을 검사했다. 원본은 `/tmp/note-quiz-ga-runner-locale-task_e38697f74c1f.before.cjs`, 동일한 diff artifact는 `/tmp/note-quiz-ga-runner-locale-task_e38697f74c1f.diff`에 보관했다.

```diff
--- before/scripts/verify-analytics.cjs
+++ after/scripts/verify-analytics.cjs
@@ -362,27 +362,115 @@
         await count(page, "page_view", undefined, 4);
         const navigation = await calls(page);
         privacy(navigation);
+        // Unprefixed routes change the stored language in place, without a view.
+        const unprefixedUrl = page.url();
+        assert.equal(new URL(unprefixedUrl).pathname, "/practice/ear");
+        assert.equal((await events(page, "page_view")).length, 4);
         await page.locator(".language-selector select").selectOption("ko");
-        await page.waitForURL(/\/ko\/practice\/ear/);
+        await page.waitForFunction(() =>
+          document.documentElement.lang === "ko" &&
+          document.querySelector(".language-selector select")?.value === "ko",
+        );
+        await button(page, "연습 시작").waitFor();
+        // Readiness above is semantic; this bounded window only checks absence.
+        await page.waitForTimeout(200);
+        assert.equal(page.url(), unprefixedUrl);
+        const inPlaceLanguage = await calls(page);
+        assert.deepEqual(inPlaceLanguage.slice(0, navigation.length), navigation);
+        assert.deepEqual(
+          await events(page, "page_view"),
+          navigation.filter(([a, b]) => a === "event" && b === "page_view"),
+        );
+        privacy(inPlaceLanguage);
+        return { queuedBeforeStub: before, navigation, inPlaceLanguage };
+      } finally {
+        fixture.release();
+        await c.close();
+      }
+    });
+    await test("localized language selector navigation and exactly-once target view", async () => {
+      // A separate intercepted context keeps the unprefixed evidence intact.
+      const { c, page } = await context(browser);
+      try {
+        const source = "/en/practice/ear";
+        const target = "/ko/practice/ear";
+        const suffix = "?email=private-email#private-fragment";
+        await open(page, `${source}${suffix}`);
+        await ready(page);
+        await count(page, "practice_entered", "ear", 1);
+        await count(page, "page_view", undefined, 1);
+        const baseline = await calls(page);
+        const baselineView = (await events(page, "page_view"))[0][2];
+        assert.equal(baselineView.page_path, source);
+        assert.equal(baselineView.page_location, `${base.origin}${source}`);
+        assert.equal(baselineView.page_referrer, "");
+        assert.equal(baselineView.page_title, await page.title());
+        privacy(baseline);
+        const sourceTimeOrigin = await page.evaluate(
+          () => performance.timeOrigin,
+        );
+        const selector = page.locator(".language-selector select");
+        await selector.waitFor({ state: "visible" });
+        assert.equal(await selector.inputValue(), "en");
+        // Use the real router action, including any root-layout document reload.
+        await selector.selectOption("ko");
+        await page.waitForURL(`${base.origin}${target}${suffix}`);
+        await page.waitForFunction(() =>
+          document.documentElement.lang === "ko" &&
+          document.querySelector(".language-selector select")?.value === "ko",
+        );
+        await button(page, "연습 시작").waitFor();
         await page.waitForFunction(() =>
           (window.__analyticsControlledStub?.calls || []).some(
-            (entry) =>
-              entry[0] === "event" &&
-              entry[1] === "page_view" &&
-              entry[2].page_path === "/ko/practice/ear",
+            ([command, event, payload]) =>
+              command === "event" &&
+              event === "page_view" &&
+              payload.page_path === "/ko/practice/ear",
           ),
         );
-        const localized = await events(page, "page_view");
-        assert.equal(localized.at(-1)[2].page_title, await page.title());
-        assert.equal(
-          localized.filter((entry) => entry[2].page_path === "/ko/practice/ear")
-            .length,
-          1,
-        );
-        privacy(await calls(page));
-        return { queuedBeforeStub: before, navigation, localized };
+        const sameDocument = sourceTimeOrigin ===
+          (await page.evaluate(() => performance.timeOrigin));
+        await count(page, "page_view", undefined, sameDocument ? 2 : 1);
+        // Only duplicate absence uses stabilization, after UI and event readiness.
+        await page.waitForTimeout(200);
+        const destination = await calls(page);
+        if (sameDocument)
+          assert.deepEqual(destination.slice(0, baseline.length), baseline);
+        // A new document has a new queue: retain both raw streams, never replace
+        // the baseline with the destination and mistake a reset for deduplication.
+        const combined = sameDocument
+          ? destination
+          : [...baseline, ...destination];
+        const views = combined.filter(
+          ([a, b]) => a === "event" && b === "page_view",
+        );
+        assert.equal(views.length, 2);
+        assert.equal(views.filter(([, , p]) => p.page_path === source).length, 1);
+        assert.equal(views.filter(([, , p]) => p.page_path === target).length, 1);
+        const targetView = views.at(-1)[2];
+        const expected = {
+          page_path: target,
+          page_location: `${base.origin}${target}`,
+          page_referrer: `${base.origin}${source}`,
+          page_title: await page.title(),
+        };
+        for (const [key, value] of Object.entries(expected))
+          assert.equal(targetView[key], value, key);
+        const effectiveTarget = (
+          await effectiveEvents(page, "page_view")
+        ).filter(([, , p]) => p.page_path === target);
+        assert.equal(effectiveTarget.length, 1);
+        for (const [key, value] of Object.entries(expected))
+          assert.equal(effectiveTarget[0][2][key], value, `effective view ${key}`);
+        const currentConfig = destination
+          .filter(([a]) => a === "config").at(-1)[2];
+        for (const [key, value] of Object.entries(expected))
+          assert.equal(currentConfig[key], value, `current config ${key}`);
+        assert.equal(currentConfig.send_page_view, false);
+        assert.equal(page.url(), `${base.origin}${target}${suffix}`);
+        privacy(combined);
+        return { baseline, destination, views, sameDocument };
       } finally {
-        fixture.release();
         await c.close();
       }
     });
```

직접 실행한 검사는 다음과 같으며 모두 **exit 0**, ESLint diagnostics 없음이다.

```sh
node --check scripts/verify-analytics.cjs
./node_modules/.bin/eslint --no-cache scripts/verify-analytics.cjs
git diff --check -- scripts/verify-analytics.cjs docs/analytics-refresh/implementation.md
```

```text
before runner SHA256: 7e7638fa72b25d47efe872323ea373a015209603496371b4e6694236d2431125
current runner SHA256: 5ff56f478bb4683363ef965d6e0e35e0f2b814b99eddc8ba38fa8ef312a757ee
exact runner diff SHA256: fbabe934df887169f6269bcb07f50d7f6a627704a777deeda159943561e60e67
```

이 worker는 app/test/dependency/route/UI를 수정하거나 브라우저·서버·build·install·commit·push·deploy·DB·GA 계정 작업을 실행하지 않았다. 보호된 user3001/root `.next`/node_modules/사용자 탭과 QA port3027/PID63151을 건드리지 않았다. 전달받은 기존 full **1223 tests**, 전체 TypeScript/lint/build, 독립 P2/melody context 통과는 이번 worker의 실행 결과가 아니다. 앱은 immutable build `hloO5iS0hIiHecioXCufM` 그대로이며 script-only 수정이므로 rebuild는 필요 없다.

남은 정확한 QA 요구는 **위 current runner SHA**를 사용하여 QA 소유 `http://127.0.0.1:3027`, `EXPECTED_BUILD_ID=hloO5iS0hIiHecioXCufM`에서 전체 runner를 desktop **1440×900** 및 `UI_MOBILE=1` mobile **390×844**로 각각 실행하는 것이다. 새 basic in-place/별도 localized/기존 melody의 총 3개 case가 모두 통과하고 raw calls/effective context/실제 화면을 대조해야 한다. `PLAYWRIGHT_MODULE`/`BROWSER_PATH`는 기존 QA 소유 경로를 유지한다. 새 artifact 경로는 예를 들어 `final/desktop-locale-task_e38697f74c1f`, `final/mobile-locale-task_e38697f74c1f`처럼 미사용 경로를 써서 이전 실패 증거를 보존한다. 실제 실행과 QA 소유 서버 종료·최종 보고는 QA가 담당한다. 실제 Google 수신/Admin 설정/배포는 계속 미검증·미변경이다.
