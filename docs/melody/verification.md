# 멜로디 연습 및 화면 정리 검증 — 2026-11-14

## 구현 결과

- 공개 흐름을 `/melody`의 **멜로디 연습**으로 변경했다. 기존 `/challenge`, 월드·스테이지 주소는 같은 언어의 새 화면으로 영구 리다이렉트한다. 홈·연습 진입 링크, canonical/hreflang, sitemap을 변경했다.
- 설정에서 음자리표·조표·최저/최고 음(C3–C6)·음표 길이(온/2분/4분/8분)를 선택한다. 시드 기반 생성기는 4/4박자 8마디, 선택된 조표의 음과 길이를 사용한다. 쉼표와 기본 템포(8분음표 사용 시60, 그 외72 BPM)는 자동이다. 반복/D.C./D.S. 표시는 생성하지 않는다.
- 입력은 목소리·마이크만 허용한다. 공개 화면에는 단계·해금·별점·건반·키보드 답안이나 마이크 거부 시 다른 입력으로 전환하는 기능이 없다. 같은 멜로디 재시도, 새 멜로디, 설정 저장, 마이크 오류 재시도, 일시정지·재개와 종료를 제공한다.
- alphaTab의 한 줄 악보와 고정 판정선을 사용한다. 조표, 8분음표, B#와 Cb의 실제 written octave를 보존한다. 정답/오답은 네이티브 음표에 초록/빨강으로 표시한다.
- 마이크 준비 후 AudioContext 시계로 네 박자를 세고, 첫 음의 기준시각부터 playing 상태로 전환한다. 이전의350ms 조기 전환을 없앴다. 명시적인 pre-roll 좌표로 첫 음이 선에 접근하며, 재개할 때도 현재 음을 기준으로 네 박자를 센다. 입력 지속 시간을 임의로 늘리지 않는다.
- 실제 공통 헤더·푸터와 설정 대화상자를 재사용했다. 기존7개 언어(en/ko/ja/es/de/fr/zh)로 새 문구를 제공한다.
- `/practice`의4개 모드를 native radio 기반 선택기로 정리했다. 적은 음자리표 선택지도 버튼형으로, 긴 조표·음역 목록은 select로 유지한다. 결과의 ‘연습 종류 변경’ 이후 선택된 radio로 포커스를 복원한다.
- Journey 본문 하단 여백150px와 내부 스크롤1106px가 겹쳐 외부 문서에44px 스크롤이 생기는 원인을 실제 배너가 표시된 이전 빌드에서 확인했다. 연습 화면의 스크롤 영역을 visual viewport에 고정하고, 광고의 관측된 영역을 제외한다. 광고 스크립트·DOM·iframe을 숨기거나 z-index로 덮지 않았다.
- 선택·버튼·홈 카드와 대화상자·결과에160–180ms easing/작은 모션을 적용했다. 악보 이동과 건반에는 CSS 지연을 두지 않고, prefers-reduced-motion에서 장식 모션과 smooth scrolling을 끈다.

## 실행한 검증

| 검증 | 결과 |
| --- | --- |
| 관련 generator/settings/store/timing/cursor/notation/locale/SEO/ad geometry Vitest | 통과 |
| 최종 `npm test` |43파일583테스트 통과 |
| `npx tsc --noEmit` | 통과 |
| `npm run lint` | 통과, 기존 modal.tsx/useComponentSize.tsx 훅 경고2개 |
| 격리된 소스 복사본의 `npm run build` | 통과 |
| 독립 리뷰 | 포커스 복귀와 기본 경로 제목 중복2건 확인 후 수정 |
| 최종 diff 및 whitespace | 확인, whitespace 오류 없음 |

최종 production build ID: `1UxlPIodL7IgGx4EQbaQn`. 소스·설정·public240파일 해시가 작업 디렉터리와 일치한다. 빌드 위치: `/var/folders/h8/233kjp516kjb3dzy0l_dynf00000gn/T/note-quiz-melody-build-vy2uh4vt`. 기존 검증용3013서버만 이 빌드로 교체했고 Ready233ms/HTTP200을 확인했다. 사용자3001서버(PID28754)는 변경하지 않았다.

### Chromium 실제 실행 및 자동 조작

390×844와1440×900에서 다음 검사를 통과했다. API 제출은 테스트 응답으로 대체하거나 차단했으며 운영 점수를 기록하지 않았다.

- 기존 practice7그룹: 모바일/데스크톱 홈과4개 모드의10문제→결과→복습→재시작, 설정·리더보드의 로딩/실패/재시도 및 접근성 조작, 크기 변경, 모의 광고 영역, 청음 시간 경계와 모드 전환.
- Melody6그룹: 두 화면 크기의 설정 적용·저장, native radio의 화살표 키와 URL 전환, 이전 주소 리다이렉트와 제목, 마이크 거부/재시도,7개 언어 경로/SEO, 실제 Chromium getUserMedia/AudioWorklet의 합성 WAV 입력, 광고 영역·대화상자 마지막 버튼·푸터 접근과 reduced-motion.
- 마이크 합성음원: 네 카운트인 클릭의 간격60/72초, 카운트인 중 악보의 오른쪽→왼쪽 이동,8마디 종료·결과, 같은 악보 재시도, 일시정지·재개·종료 시 트랙/AudioContext 해제, 새 멜로디를 확인했다. 정상 C4 fixture의29음표+3쉼표 판정이 모두 일치했고, 두 번째 음만 E4로 바꾼 fixture에서는 빨간 오답과 초록 정답을 함께 확인했다. 점수나 결과를 주입한 검사가 아니다.
- 초기 테스트 실패는 label 안의 option 텍스트를 포함하는 locator, 숨겨진 radio의 포인터 대상, 비동기 URL 전환 대기 문제였다. 접근성 역할/label 클릭과 실제 URL 완료 대기로 수정한 뒤 해당 검사를 재실행해 통과했다. 기대 결과를 완화하지 않았다.

Orca 실제 탭에서도390×844와 **실제 innerWidth1440/innerHeight900**을 확인했다. 설정 Enter 열기, Tab/화살표 선택, Escape 닫기·포커스 복귀, 독보 시작·건반 답안, 변경 전후 화면을 관찰했다. 긴 독일어 practice 선택기 텍스트도 각 버튼 경계 안에 있음을 측정했다. 브라우저 호스트의 일부 포인터 명령이 상태를 바꾸지 않는 경우 native keyboard로 조작하고, 결과를 DOM/스크린샷으로 확인했다.

### 근거 파일

- 종합: `/tmp/note-quiz-melody-completion.json`
- 전체 단위 검사: `/tmp/note-quiz-melody-final-unit.log`
- 최종 build manifest: `/tmp/note-quiz-melody-build-manifest.json`
- 기존 practice: `/tmp/note-quiz-melody-practice-final/report.json`
- 설정/경로/라디오: `/tmp/note-quiz-melody-settings-final/report.json`
- 권한/로케일/음성: `/tmp/note-quiz-melody-qa-final/report.json` (앞선 설정 locator 실패는 위 설정 보고서에서 해소)
- 정답·오답 합성음원/광고 영역/모션: `/tmp/note-quiz-melody-extra-final/report.json`
- 독립 리뷰: `/tmp/note-quiz-melody-review-report.json`
- 광고 원인과 CSS 진단: `/tmp/note-quiz-melody-overflow-report.json`
- 변경 전 화면: `/tmp/note-quiz-melody-qa/orca/practice-before-mobile.png`
- 최종 자동 캡처: `/tmp/note-quiz-melody-settings-final/`, `/tmp/note-quiz-melody-extra-final/`

## 확인하지 못한 범위

실제 Grow/Journey house 배너로 원인과 CSS 진단 결과를 확인했지만, 최종 전체 번들에서는 실제 배너가 다시 표시되지 않아 모의 하단·사이드 광고로 검증했다. 따라서 **모든 실제 Journey 배치나 유료 광고에서 해결됐다고 단정하지 않는다**.

실기기 iOS/Android, Safari/Firefox, 실제 사람의 목소리·마이크·스피커의 음향 지연과 정확도, 스크린리더는 미검증이다. 합성 WAV와 브라우저 에뮬레이션 결과를 실기기 검증으로 간주하지 않는다.

이 작업에서 API 계약·DB·리더보드 점수 공식·공유 채점 공식·기존 practice 상태/점수 로직·법적 문서 내용은 변경하지 않았다. 이전 검증 빌드와 보호 대상 소스 해시를 비교했다. 커밋·푸시·배포는 수행하지 않았다.
