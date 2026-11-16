# 멜로디 마이크 입력 후속 수정

기준 커밋: `9cfc846`. 사용자 증상은 “음파는 감지되지만 음정은 계속 기다리는 중”이다. 사용자 마이크의 원시 음성을 녹음하거나 저장·업로드하지 않았다. 아래 원인은 합성 입력으로 재현한 코드 결함이며, 사용자의 물리 장치에서 동일한 원인이었는지는 아직 확인하지 않았다.

## 현재 입력 경로와 원인

`/[locale]/melody` → `MelodyPractice` → `useChallengeSession` → `ChallengeAudioSession` → `public/audio/challenge-capture.js` → `estimatePitch` → `NoteEventDetector` → 세션 이벤트/기존 채점 경로를 추적했다.

- 마이크의 RMS/스펙트럼 표시는 음정 검출 성공과 별개이다. 기존 YIN 검색 및 반환 범위가 110Hz 아래를 제외해, 충분한 RMS의 낮은 목소리도 `detectedHz: null`로 남았다. E2(82.4Hz) 등은 목표 C4와 다르게 부른 입력이어도 실제 음정을 보여야 하므로, 목표 음역에 맞춰 옥타브를 바꾸는 방식은 사용하지 않았다.
- 기존 2048샘플 창은 96kHz에서 21.33ms여서 낮은 음의 여러 주기를 확보하기 어렵다. 음정 검색 하한만 내리는 것으로 모든 지원 샘플레이트의 저음 처리가 해결되지 않는다.
- 순간 끊김의 첫 부분만 포함된 hop이 `dipSince`를 만들고, 진짜 무음 이후에도 남은 후보가 다시 커진 소리를 재발음으로 오인했다. 48kHz의 30ms 끊김을 3ms 이동한 입력에서 한 음이 둘로 쪼개졌다.
- 반대로 44.1kHz에서 75ms의 실제 무음도 에너지 hop의 양쪽 경계 때문에 관측 간격이 약58ms가 되어 반복음을 합쳤다.
- `maxMelodyBpm`의 500ms 기준은 이전 합성 fixture의 확인 범위를 모든 설정에 강제한 정책이었다. 검출기 자체의 필수 최소 간격이나 모든 악기에서 검증된 경계가 아니었다.

## 수정

실제 음정 분석의 반환 범위는 **65–1100Hz**다. 아래 범위의 불완전한 trough를 65Hz로 잘못 끌어올리지 않도록 YIN 검색은 50Hz까지 수행하고 실제 결과에서 범위를 검사한다. 44.1/48kHz는 2048샘플을 유지하고, 96kHz는 4096샘플(42.67ms)을 사용한다. 512샘플 hop과 에너지 중심 시각은 그대로이며, 음정 중심 시각은 실제 창 길이에 맞춰 계산한다. 96kHz의 음정 창 중심 지연은 이전보다 약10.67ms 증가한다.

분리기는 진짜 무음에 진입하면 이전 dip 후보를 지운다. 연속 에너지가 최소60ms 있었고 다시 충분한 에너지가 들어온 경우에는 관측 무음50ms부터 새 발음을 확인한다. 단순 release와 불규칙한 짧은 에너지에는 기존60ms hysteresis를 유지한다. 음높이 변화의60ms 안정화, 최소 이벤트 길이, 피치 신뢰도, 점수·매칭 공식은 느슨하게 바꾸지 않았다.

템포 안내를 여덟 언어에서 삭제하고 `maxMelodyBpm` 및 `tooFastForMicrophone` 검증을 제거했다. 설정은 **40–180 BPM**와 유효한 리듬/박자/음역 검증을 유지한다. 생성 가능한 음역 **C3–C6(MIDI48–84)**과 실제 마이크 분석 범위는 서로 다른 개념이다. 낮은 E2를 부르면 실제 E2로 기록하며 C4로 보정하지 않는다.

음이 유지되는 동안의 즉시 피치 표시와 음이 끝난 뒤의 완성 이벤트는 다르다. 이벤트는 release·안정된 legato 변화·종료 flush에서 완료된다. 기존 capture 기준 시각, count-in 경계의 대기 이벤트, 일회 매칭과 세션 종료 규칙은 유지했다. 늦게 전달된 E2 이벤트의 onset/offset을 전달 시각으로 바꾸거나 목표 음정으로 전조하지 않는 회귀를 추가했다.

## 검증 근거

- 수정 전 기존 오디오/훅/설정 5파일134테스트 통과. 기존 Chromium fake-WAV 통합도 `http://localhost:3001`에서 통과했다. 이는 수정 전 기준 검증이며 새 후보의 브라우저 검증으로 대체하지 않는다. 보고서: `/tmp/note-quiz-input-baseline/report.json`.
- 수정 후 `npm test`: **62파일1077테스트 통과**. `npx tsc --noEmit` 통과. `npm run lint` 통과(기존 `modal.tsx`, `useComponentSize.tsx`의 hook 의존성 경고2개). `git diff --check` 통과.
- 실제 worklet 소스를 Node VM에서 실행해44.1/48/96kHz의 PCM→YIN→이벤트를 검사했다. 저음 C2/E2/G2/A2/B2, 65.4/82.4/98/110Hz 경계, 강한2·3배음, 범위 밖40/50/60/63Hz, 무성 잡음, 진동·호흡성·자음 시작, 박자 소리 혼합을 포함한다.
- 180 BPM의 triplet(약111ms)·8분음표(약167ms)·250ms legato 음정 변화,25ms 잡음 자음이 있는 음절 변화,75ms 무음으로 구분되는 반복음, hop 위상을 바꾼30ms 끊김 보존을 검사했다. 원음정/실측 시각을 검증하며 legato를 물리 재발음으로 간주하지 않는다.
- 합성 음성 계열 측정 보고서: `/tmp/note-quiz-input-final-voice.json`. 로컬 Node V8 CPU 비교: `/tmp/note-quiz-input-cpu.json`. 저음/C4 각각500회 기준 새 처리 평균은44.1/48kHz 약0.17–0.20ms,96kHz 약0.18ms였다(기존96kHz 약0.05ms). 측정 p95는0.18–0.25ms로 hop 간격5.33–11.61ms 이내였다. 이 수치는 이 컴퓨터의 Node 실험이며 휴대기기나 실제 브라우저 처리 여유를 보증하지 않는다.
- `scripts/verify-melody-timing.cjs`에 `TIMING_INPUT_MIDI=40`을 추가했다. 악보와 무관한 E2 합성 스트림을 넣고 실제 검출 음정·완료 이벤트를 수집하며 기존 clock/glyph 판정과 함께 확인한다. 새 후보3013에서 실행할 브라우저 검증은 코디네이터가 담당한다. worker는 서버 실행/정지/교체, commit/push를 하지 않았다.

## 남은 한계

동일 음정의 매끈한 연속음에는 마이크가 재발음을 구별할 근거가 없을 수 있다. 조사 중45ms 무음 반복과180 BPM의16분음표(약83ms)에서 합쳐지는 사례를 재현했다. 짧은 안정화 시간을 일괄 적용하면 vibrato와 순간 끊김을 오인했으므로 모든 짧은 음을 인식한다고 주장하지 않는다. 빠른 설정을 허용하는 것과 모든 악기·음절을 정확히 구분하는 것은 다르다.

물리 마이크/목소리/실제 스피커의 음향 지연, 모바일 CPU, Safari/Firefox는 미검증이다. 두 사람이 동시에 내는 소리·화음은 단선율 분석의 검증 범위가 아니다. 새 빌드의 브라우저 검증과 독립 검토 결과는 코디네이터의 최종 보고를 확인한다.

Coordinator integration result: the later combined root run passed62files/1077tests, strict TypeScript, lint and isolated production build14uz98HkHb9bRAy2ruR3T. See `docs/practice-followup-plan.md` for fresh browser results and remaining physical-device/ad limitations; the earlier worker-stage failures or pending gates above are historical.
