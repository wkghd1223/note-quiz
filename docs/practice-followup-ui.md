# Practice follow-up UI — worker report

기준: `9cfc846`, task `task_4bfa5ea0607b`, dispatch `ctx_657d6ead66f8`.

## 변경

- 활성 경로 `src/app/(site)/practice/*` → `PracticeClient` → note/ear/theory를 확인하고 해당 UI만 수정했다. 도메인·스토어·채점·문제 생성 규칙은 수정하지 않았다.
- 결과창은 점수·상세 피드백·오답 복습을 유지하고 다시하기/난이도 변경 버튼을 제거했다. 같은 설정 다시하기는 창을 최소화한 후 공통 finished controller의 **결과보기 → 다시하기** 순서로 이용한다. 난이도 변경은 기존 Settings에서 한다.
- `PracticeShell` 표시 API에 optional `onRestart`, `restartDisabled`, `description`을 추가했다. 결과/다시하기 컨트롤은 기존 `StablePracticeActions`로 idle부터 공간을 예약하고 최소 높이 44px를 유지한다. 게임별 기존 start 콜백과 audio 취소·중복 시작 방지 로직을 그대로 사용한다.
- 방향 답안은 **높다 · 같다 · 낮다** 3열 한 행이다. 방향 도움말의 열거 순서도 8개 언어 모두 맞췄다. 새 번역 키 없이 기존 번역 계약과 라벨을 사용했다.
- 듣기·다시 듣기·예시 듣기는 접근 가능한 이름(`aria-label`)과 native tooltip(`title`)이 있는 44×44px speaker 버튼이다. 결과 상세의 듣기도 동일하게 정리했다. 동시 재생/아르페지오의 구분 라벨은 유지한다.
- theory 도움말은 게임 제목 아래로 이동했다. 예시 select/재생 row는 64→44px, 설명 frame은 80/96→40px의 답안 상세 영역으로 줄였다. 내 답/정답/구성음 두 줄은 overflow 영역에 보존하고 idle/active/finished frame 크기는 일정하게 유지한다. progression의 중복 tonic 설명도 제목 아래로 옮겼다. 기존 판단 토스트는 prompt band 안에 유지한다.
- P8은 기존 `INTERVALS.P8`(12 semitones)와 interval option 도메인에서 지원한다. **beginner 예시 선택/예시 재생만** P1/M3/P5 → P8/M3/P5로 변경했다. 실제 beginner 문제 옵션은 기존 P1/M3/P5 그대로이며 테스트에서 이를 확인한다.
- root가 소유한 notation의 named export/optional placeholder 변경에 presentation mock을 맞췄다. handdrawn flat-sign 이미지 기대치는 제거하고 native score의 clef/keySignature(-2)/빈 note 검사는 유지한다.
- UI runner는 dialog 밖 다시하기, 44px speaker/select, 방향 답안 한 행/순서, 제목 옆 도움말, 결과 복원·focus trap 검사를 반영했다.

## 검증

수정 전 관련 3파일 **93 tests 통과**.

수정 후 아래 7파일 **194 tests 통과**:

```sh
npx vitest run src/components/practice/LearningResult.test.tsx src/components/practice/PracticePreview.test.tsx src/lib/i18n/translations.test.ts src/lib/music/theory.test.ts src/store/gameStore.test.ts src/store/earTrainingStore.test.ts src/store/theoryStore.test.ts
```

- `npx tsc --noEmit`: 통과.
- 수정한 13개 source/test/script 경로 `npx eslint ...`: 통과, 경고 없음.
- `npm run lint`: 통과, 기존 `src/components/ui/modal.tsx`의 isPage, `src/hooks/useComponentSize.tsx`의 handleResize hook 경고 2건.
- 두 CJS runner `node --check`, `git diff --check`: 통과.
- `npm test`: 당시 공유 작업 트리 기준 **1060 통과 / 7 실패 / 62파일**. 실패는 다른 audio worker가 수정 중인 `src/features/challenge/audio/worklet-pipeline.test.ts`의 low fundamental 3건, 44100Hz fast legato 1건, fast same-pitch 3건이다. 이 worker는 audio 파일을 수정하지 않았다.
- 서버 실행/정지, production build, 브라우저 QA는 수행하지 않았다. fresh production 및 390/1440 native UI QA는 root 담당이다. runner assertion은 준비했지만 실행 통과를 주장하지 않는다.

## Source freeze

아래 13파일을 이 보고서 시점으로 freeze했다. manifest: `/tmp/note-quiz-followup-ui-sourcefreeze.sha256`; 저장소 루트에서 `shasum -a 256 -c /tmp/note-quiz-followup-ui-sourcefreeze.sha256`로 재확인할 수 있다. 보고서 자체와 다른 작업자 파일은 manifest에서 제외했다.

```text
3c9c37d79dc8b8b2e4f596bbc6e902b33919720ce69ecb2821f31c62d1f01bbf  src/components/practice/EarPracticeMode.tsx
8b8cd734e2fb2bac5a8e99d580033048b613e2e3064577c3099805077b331307  src/components/practice/LearningResult.tsx
fd5801bc16e936328c3b253a0db6a57c012a1adf6abd5bc5e77d04d01dcdc57a  src/components/practice/LearningResult.test.tsx
ade050a46963cd575e7ece04ee340e3bc13ee8a5e3edfa6531d62d76cc9d7d0e  src/components/practice/NotePracticeMode.tsx
a693c73d86df1b6a91664f26dd4305d48eaeba0f56861bb6abab9297e6ec5bbb  src/components/practice/NoteSessionResult.tsx
9e0b54fdc5e7545a57e9e7cfac63f8c1aa5336a60fedc4f3da7dad4136bdea29  src/components/practice/PracticePreview.test.tsx
a273a59ec768447bc6462ce1dd66d6d08eb48cbc3da76df28ba3be6c9191f111  src/components/practice/PracticeShell.tsx
433a8e5297a5cddeb1553bc69ffcfde11bbf9af00d7cc498ff703ad10892e6fb  src/components/practice/TheoryPracticeMode.tsx
f58b21696b5d620248b03f644d1bee913d0743aff298b26b3fd6c6cb8c686693  src/lib/i18n/learning.ts
f0b9ce79ecebf63942c1b65b3a7a616c2d730e424c668d31f418cd1b9f10505b  src/lib/i18n/pt.ts
3a3a9a27e98ff0e70742f8ab37373b02ca03a456b16b5c198bab406ed808ac37  src/lib/i18n/zh.ts
dc0c43a5e7dbae9cf97a3d072a71a45404d67f45baf2fa7610d1afb0f4a6931c  scripts/verify-practice-layout.cjs
f76c7d0b22e1e40ef0f1d26db964b9967ee173f1466ad6f5860299ca47f5d64c  scripts/verify-practice-ui.cjs
```

남은 통합 검증: root의 fresh production build/native UI matrix 및 audio worker 완료 후 전체 suite 재실행. commit/push/deploy 없음.

Coordinator integration result: the later combined root run passed62files/1077tests, strict TypeScript, lint and isolated production build14uz98HkHb9bRAy2ruR3T. See `docs/practice-followup-plan.md` for fresh browser results and remaining physical-device/ad limitations; the earlier worker-stage failures or pending gates above are historical.
