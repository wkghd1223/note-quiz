# 학습 흐름 지표와 확인 방법

## 측정 범위

이 문서는 Note Quiz의 `연습 진입 → 시작 → 완료 → 복습 또는 재시작` 흐름을 확인하기 위한 이벤트 정의다. 현재 사용량 감소 원인은 **미확인**이며, 운영 분석 자료에 접근하거나 변경 후 효과를 측정하지 않았다. 기능 부족이 감소 원인이라고 가정하지 않는다.

`practice_*` 이벤트는 독보·단음 청음·음정·화음·멜로디의 흐름을 보는 세션 단위 이벤트다. 기존 독보·단음 청음의 시작·완료 이벤트는 기존 대시보드 호환을 위해 유지한다. 두 계열을 합산하면 중복되므로 아래 지표는 `practice_*`만 사용한다. 멜로디는 실제 발성 연습과 예시 재생을 구분하며, 세션 길이와 완료 의미가 다른 기본 연습과 완주율을 따로 본다.

| 이벤트                      | 발생 시점                                                                                | 확인할 속성                                                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `practice_entered`          | 기본 연습은 기존 설정 진입 시점, 멜로디는 설정 복원 후 화면에 한 번 진입했을 때          | `training_mode`, `difficulty`, `presentation`, `session_type`                                                                  |
| `practice_started`          | 기본 연습은 기존 세션 생성 시점, 멜로디는 실제 `playing`을 관측했을 때                   | 위 속성, `session_kind`, `entry_start`                                                                                         |
| `practice_completed`        | 기본 연습은 기존 결과 생성 시점, 멜로디는 최종 결과 또는 실제 시작 뒤 중도 종료 시 한 번 | 위 속성, `completed`, 최종 결과가 있으면 `total_questions`, `correct_answers`, `had_mistakes`; 멜로디의 경우 `elapsed_time_ms` |
| `practice_review_started`   | 결과에서 오답 복습을 시작했을 때                                                         | 연습 종류·난이도·방식, `session_kind=review`                                                                                   |
| `practice_result_restarted` | 결과에서 같은 설정의 새 일반 연습을 시작했을 때                                          | 연습 종류·난이도·방식                                                                                                          |
| `practice_preview_started`  | 멜로디의 샘플 준비가 성공하고 예시 재생이 예약됐을 때                                    | `training_mode=melody`, `difficulty=custom`, `presentation=visual`, `session_type=exercise`                                    |

기본 연습의 `training_mode`는 `note`, `ear`, `interval`, `chord`다. `session_type`은 `ten`, `free`, `timed`이며, `session_kind`는 `practice`, `review`, `daily`다. `entry_start`는 해당 시작 화면 진입 후 첫 시작인지를 나타내는 메모리 안의 불리언이다. 식별자나 저장된 방문자 토큰을 만들지 않는다. 기본 연습에서 `completed=false`인 결과는 중도 종료이며, `had_mistakes=true`인 결과만 오답 복습의 대상이다.

### 멜로디의 시작·완료 기준

- 고정 속성은 `training_mode=melody`, `difficulty=custom`, `presentation=visual`, `session_type=exercise`, `session_kind=practice`다. `custom`은 사용자가 고른 범위·리듬·속도이며 실력 등급이 아니다. `exercise`는 생성된 한 악보를 끝까지 수행하는 단위이며 10문제 세션과 다르다.
- 시작 버튼, 마이크 요청, `countIn`만으로 `practice_started`를 보내지 않는다. 실제 `playing` 또는 유효한 최종 결과가 시작의 근거다. React가 중간 상태를 한 번에 처리해 `playing` 관측을 건너뛴 경우 최종 결과에서 시작·완료를 순서대로 한 번 보낸다.
- 예시의 준비·다운로드 실패는 `practice_preview_started`가 아니다. 준비를 마치고 재생을 예약한 경우에만 별도로 센다. 이 이벤트가 물리 스피커의 가청 출력까지 증명하지는 않는다. 예시나 연습 전 권한 실패는 시작률·완주율의 시작 수에 들어가지 않는다.
- 같은 시도의 일시정지·재개·재개 전 카운트인은 시작을 늘리지 않는다. 결과 재열기와 StrictMode의 effect 재실행도 이벤트를 늘리지 않는다. 재시도는 다시 실제 연습에 도달하면 새 시작이다. 새 악보는 내부 객체와 새 store의 토큰으로 구분한다. 이 키들은 메모리에만 있고 전송되지 않는다.
- 최종 `completed=true`는 연습 구간이 끝나 유효한 결과가 생성됐다는 뜻이다. 모든 음을 통과했다는 뜻은 아니다. `total_questions`는 결과의 `notes.length`이며 쉼표를 제외한다. `correct_answers`는 그중 `status=passed`의 개수다. 개별 음·답·판정 사유·점수 배열은 보내지 않는다.
- 실제 시작 뒤 정지/reset, 새 시도·악보로 교체, 오류 또는 컴포넌트 이탈은 `completed=false`를 최대 한 번 보낸다. 결과가 없으면 문제 수·정답 수·오답 여부를 **생략**한다. 현재 화면의 임시 점수나 악보의 음 수를 부분 결과로 만들지 않는다. 실제 연습 전 취소·권한 실패에는 가짜 시작·완료 쌍이 없다.
- 최종 `elapsed_time_ms`는 기존 store의 최종 `elapsedSec`를 ms로 반올림한 악보 진행 시간이다. 중도 종료는 마지막으로 관측한 기존 진행 시간을 100ms 단위로 내림하며, 관측하지 못했다면 생략한다. 일시정지 때 음 경계로 되감길 수 있고, 카운트인·휴식·벽시계 총 체류 시간은 포함하지 않는다. 기존 독보의 `time_spent_ms`와 같은 지표로 합산하지 않는다.
- 멜로디는 현재 관측 지점에서 `practice_review_started`, `practice_result_restarted`를 보내지 않는다. 결과 뒤 반복은 다음 실제 `practice_started`로 센다. 멜로디를 기본 연습의 복습·결과 재시작 클릭 비율에 섞지 않는다.

## 지표 정의

같은 UTC 날짜 범위와 연습 종류를 선택해 비교한다. 시작률은 진입 뒤 설정을 바꿀 수 있으므로 난이도·방식·세션 길이·일반/복습/일일 필터 없이 집계한다. 다른 세션 지표는 난이도·보고/듣기 방식·세션 종류를 맞춰 비교한다. 운영 보고서의 시간대가 UTC와 다르면 날짜 경계를 맞춰 조회한다. 여러 난이도나 출제 범위의 정답률을 합쳐서 실력이 향상됐다고 해석하지 않는다.

| 지표                     | 분자                                                                                        | 분모                                                                | 해석과 주의점                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 연습 진입 대비 시작률    | `practice_started` 중 `entry_start=true` 수                                                 | `practice_entered` 수                                               | 같은 진입에서 여러 번 재시작한 세션을 분자에서 제외한다. 방문자별 전환율이 아니라 기록된 시작 화면 진입의 전환율이다. 상세 설정에서 길이를 바꿔도 같은 진입으로 보므로 세션 종류/길이별 시작률로 분해하지 않는다. |
| 시작 대비 10문제 완주율  | `practice_completed` 중 `session_type=ten`, `completed=true`, `total_questions=10` 수       | `practice_started` 중 `session_type=ten` 수                         | 일반 연습·일일 과제·복습은 각각 따로 본다. 10개 미만 오답을 다 풀어 끝낸 복습을 10문제 완주로 세지 않는다.                                                                                                        |
| 결과에서 재시작하는 비율 | `practice_result_restarted` 수                                                              | `practice_completed` 수                                             | 세션이 끝난 날짜와 재시작 날짜가 다를 수 있어 짧은 날짜 구간에서 오차가 생길 수 있다.                                                                                                                             |
| 오답 복습 이용률         | `practice_review_started` 수                                                                | `practice_completed` 중 `had_mistakes=true`, `total_questions>0` 수 | 오답 없는 결과와 답변 없는 결과를 분모에서 제외한다. 복습에서 다시 복습한 사용은 원래 일반 연습과 별도 집계한다.                                                                                                  |
| 멜로디 한 악보 완주율    | `training_mode=melody`, `session_type=exercise`, `completed=true`인 `practice_completed` 수 | 같은 모드·종류의 `practice_started` 수                              | 음별 통과율·실력 향상과 다르다. 중도 종료에는 부분 문제 수가 없으므로 음별 정답률의 분모에 넣지 않는다.                                                                                                           |
| 게임별 이용 비중         | 각 `training_mode`의 `practice_started` 수                                                  | 다섯 종류 전체의 `practice_started` 수                              | 원래 진입 수와 세션 길이도 함께 본다. 복습·일일 과제는 필터로 분리한다. 기존 네 종류와 시계열 비교 시 `melody` 포함 여부를 고정한다.                                                                              |

이벤트만으로 개인별 여정을 연결하거나 전송되지 않은 방문을 복원하지 않는다. 분석 차단, 동의 상태, 네트워크 실패, 날짜 경계, 여러 탭과 새로고침은 집계에 영향을 준다. 각 이벤트 수가 적으면 비율 변화를 확정적인 개선으로 해석하지 않는다. 실제 소리 재생 성공이나 학습 효과는 이벤트 발생만으로 증명되지 않는다.

## 페이지뷰와 유입 정보

애플리케이션은 production에서만 수동 `page_view`를 보낸다. 최초 문서와 실제 pathname 이동을 한 번씩 세고, 종류·언어 경로 변경과 뒤로/앞으로 이동을 포함한다. 리다이렉트는 도착 경로를 센다. 설정·공유·결과·기록의 query/hash만 바뀌면 페이지뷰를 추가하지 않는다. 공용 메모리에서 같은 경로의 tracker 재마운트와 중복 준비 호출을 막는다. 다음 경로를 거쳐 다시 돌아온 경우는 새 페이지뷰다.

초기화는 외부 태그 요청보다 먼저 표준 `dataLayer`/`gtag` 큐와 `js → config`를 만든다. 연습 이벤트가 더 일찍 발생해도 같은 초기화 함수를 거쳐 큐에 남는다. 별도 polling은 없으며 경로 effect는 취소 가능한 한 번의 task 뒤 현재 제목을 읽는다. 외부 스크립트 차단·네트워크 실패·탭 강제 종료까지 전달을 보장하는 저장 큐는 아니다.

연습 이벤트를 큐에 넣기 전에 현재 경로와 제목을 정제해 config 문맥을 동기화한다. 따라서 진입 effect가 수동 페이지뷰보다 먼저 실행되어도 새 경로를 상속한다. 이어지는 페이지뷰는 갱신된 `document.title`을 다시 읽고, 같은 경로의 제목 갱신은 이전 화면 referrer를 유지한다. 제목은 해당 전송 시점의 문서 값이며, 이후 메타데이터가 바뀌어도 이미 큐에 들어간 이벤트를 다시 보내지는 않는다.

멜로디 관측기는 정제된 화면 문맥만 메모리에 보관한다. 실제 이탈의 완료 이벤트는 새 화면이 먼저 config를 갱신했더라도 떠난 멜로디의 path/location/title/referrer를 event 필드로 사용한다. 새 화면의 기본 config는 되돌리지 않는다. 기존 기본 연습 payload는 유지하며, 검증에서는 최신 config와 개별 event 필드를 합친 유효 문맥을 본다. 이 우선순위는 [Google tag의 parameter scope/precedence](https://developers.google.com/tag-platform/gtagjs/reference#parameter_scope)를 따른다.

| 필드            | 계약                                                                                                                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page_path`     | pathname만. `?`를 추가하지 않으며 query/hash를 제외한다.                                                                                                                                                   |
| `page_location` | 현재 origin + pathname. query/hash·URL의 사용자명/암호를 제외한다. 초기 config와 경로별 context 갱신에도 적용한다.                                                                                         |
| `page_title`    | 커밋된 화면의 `document.title`, 최대 300자.                                                                                                                                                                |
| `page_referrer` | 첫 문서는 정제한 `document.referrer`, 이후는 직전에 측정 문맥을 확정한 앱 경로(페이지뷰보다 진입 이벤트가 먼저인 경우 포함). 같은 origin은 경로까지, 외부 유입은 origin까지만 남기며 query/hash·인증 정보는 제외한다. 직접 유입·유효하지 않은 값은 빈 문자열이다. |

랜딩 문서의 표준 UTM은 URL 전체를 넘기는 대신 아래 **공식 config 필드**로 보존한다. 같은 문서에서는 초기 campaign 설정을 유지하고 query만 바뀌어도 유입을 다시 설정하지 않는다.

| 입력 query     | config 필드        |
| -------------- | ------------------ |
| `utm_id`       | `campaign_id`      |
| `utm_source`   | `campaign_source`  |
| `utm_medium`   | `campaign_medium`  |
| `utm_campaign` | `campaign_name`    |
| `utm_term`     | `campaign_term`    |
| `utm_content`  | `campaign_content` |

각 값은 공백을 정리한 1–100자의 공개 캠페인 라벨만 허용한다. 문자·숫자·공백·`.`·`_`·`+`·`~`·`-` 이외의 기호가 있거나 너무 길면 버린다. 이메일·URL·제어문자·query 구분자는 허용하지 않는다. 알 수 없는 query, 공유 설정 원문, seed, session/user ID, `gclid`·`fbclid` 같은 기타 파라미터를 전달하지 않는다. 이 계약은 표준 UTM의 명시적 보존에 한정하며 광고 click ID에 의존한 귀속까지 검증한 것은 아니다. 캠페인 라벨에도 개인정보를 넣지 않아야 한다. 지원 필드와 우선순위는 [Google config 레퍼런스](https://developers.google.com/analytics/devguides/collection/ga4/reference/config)를 확인했다.

### 수동 페이지뷰에 필요한 GA 설정

**`send_page_view:false`만으로 Enhanced Measurement의 history 페이지뷰가 꺼지지 않는다.** [Google 페이지뷰 문서](https://developers.google.com/analytics/devguides/collection/ga4/views)에 따라 GA 운영자가 **Admin → Data streams → Web → 해당 스트림 → Enhanced measurement 설정 → Page views → Show advanced settings → Page changes based on browser history events 끄기 → Save**를 확인해야 한다. 코드에는 이를 대신하는 비공식 JS 옵션을 넣지 않았다. 수동 초기 페이지뷰와 다른 태그의 자동 page-load 이벤트가 중복되는지도 함께 확인한다.

이 작업은 애플리케이션이 직접 보내는 중복만 방지한다. GA 계정 설정이나 다른 태그를 확인·변경하지 않았으므로 property 전체의 페이지뷰 중복 해소를 선언하지 않는다.

## 운영 확인 절차 (수행 전)

1. 위 Enhanced Measurement 설정과 다른 설치 태그의 중복 수집을 확인한다. 이 작업에서는 계정·배포 상태를 변경하지 않았다.
2. 승인된 배포 후 운영자가 통제하는 테스트 브라우저에서 Tag Assistant/Analytics Debugger로 debug mode를 켜고 GA **Admin → Data display → DebugView**에서 확인한다. 제품에 모든 방문자를 위한 `debug_mode`를 추가하거나 개인 식별 파라미터를 만들지 않는다. [Google SPA 확인 절차](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications), [DebugView 안내](https://support.google.com/analytics/answer/7201382)를 따른다.
3. 직접 `/practice/note`와 리다이렉트 URL로 열기, 종류·언어 이동, 뒤로/앞으로 이동에는 화면당 `page_view` 하나가 오는지 확인한다. 설정·기록·결과 query/hash 변경에는 추가되지 않아야 한다. 직전 페이지와 비교해 title/location/referrer 및 공개 UTM 귀속을 확인하고 원본 query/hash가 없는지 검사한다.
4. 기본 연습의 `practice_*`와 호환 이벤트가 기존 속성으로 수신되는지 확인한다. 멜로디는 예시 성공/실패, 권한 거부, 카운트인 취소, 실제 시작, 일시정지/재개, 자동 결과, 정지, 재시도, 새 악보, 화면 이탈에서 위 개수·생략 필드를 확인한다. 중도 종료의 빈 문제 수를 0점 결과로 변환하지 않는다.
5. 보고서에서 쓸 속성은 **Admin → Data display → Custom definitions → Create custom dimension**에서 Event scope와 정확한 event parameter 이름으로 등록한다. 대상은 `training_mode`, `difficulty`, `presentation`, `session_type`, `session_kind`, `completed`, `entry_start`, `had_mistakes`다. 필요할 때 `total_questions`, `correct_answers`, `elapsed_time_ms`를 event-scoped custom metric으로 등록하고 단위를 각각 Standard(개수)·Time/Milliseconds로 구분한다. [Google custom metric 등록 안내](https://support.google.com/analytics/answer/14239619)를 따른다. ID·seed·원본 설정을 측정기준으로 만들지 않는다. 등록·적용 이후 보고서를 별도로 확인하며 이 작업에서 등록했다는 뜻은 아니다.
6. 출시 전후 같은 길이·요일의 기간과 같은 보고서 시간대를 맞춰 진입 수·시작 수·비율을 비교한다. 유입 자체의 변화와 연습 진입 뒤 이탈을 나누고, 유입 경로·기기·언어·난이도·출제 범위·세션 길이의 차이도 확인한다. 충분한 통제 자료 없이 업데이트 효과로 단정하지 않는다. 운영 수신·광고 환경의 이탈·실제 성과 수치는 현재 **미확인/미측정**이다.

기존 호환 이름은 `note_quiz_session_started/completed` (`training_mode=note_quiz`), `ear_training_session_started/completed` (`training_mode=ear_training`)다. 공통 funnel의 `note`/`ear`와 한 세션을 이중으로 센다. 명시적 예시 재생 버튼의 기존 `ear_training_note_replayed`와 기타 설정/리더보드 이벤트도 유지하며, 개별 답변 이벤트를 새로 만들지 않는다. 이전 `page_view_custom` helper는 실제 경로 tracker가 아니며 페이지 수에 합산하지 않는다.

## 로컬 검증과 데이터 최소화

집중 테스트는 production 환경과 태그를 대체해 지연된 초기화 순서, 중복 방지, 경로·referrer·UTM 정제, 기존 payload 호환, 멜로디 관측 상태 전이를 확인한다. Node hook fixture는 실제 React DOM/음향 장치 검증과 구분한다. `scripts/verify-analytics.cjs`는 별도로 준비된 로컬 production snapshot에만 연결하고 GA JS를 **controlled stub**으로 대체하며 외부 수집/쓰기 요청을 차단한다. 명시적 `UI_BASE_URL`이 필수이며 서버를 시작·재시작하거나 사용자 브라우저에 연결하지 않는다. 실행 여부와 실제 결과는 `docs/analytics-refresh/implementation.md` 및 독립 QA 보고서를 확인한다. 이 증거는 실제 Google 수신이나 GA 대시보드 집계가 아니다.

- 개별 정답, 입력 음, 원본 답안, 오디오, 세션 식별자와 장기 사용자 식별자는 전송하지 않는다.
- 정답 수·문제 수·완료 여부 같은 세션 집계만 전송한다. 기존 답안 단위 이벤트는 제거했다.
- 이번 관측 코드에는 localStorage/sessionStorage/cookie 저장이나 새 사용자·세션 식별자가 없다. 메모리 안의 객체·시도 토큰은 중복 방지에만 쓰고 전송하지 않는다. 기존 Google 태그의 저장·동의 정책을 새로 구현하거나 변경한 작업은 아니다.
- 약점 후보는 같은 설정의 일반 연습에서 해당 유형의 답변이 5개 이상이고 정답률이 80% 미만인 경우에만 최대 3개 보여준다. 이는 다음 연습을 고르는 단서이며, 적은 표본을 바탕으로 숙련도나 성장의 확정 진단을 하지 않는다.
- 브라우저 학습 기록은 최대 최근 60세션·30일의 요약만 저장하며, 기록 초기화가 가능하다. 이 기록은 다른 기기와 동기화되지 않으며 분석 서버에 원본으로 보내지 않는다.
- 일일 과제 생성에는 UTC 날짜·연습 종류·난이도·허용된 설정만 사용한다. 개인 식별자를 seed나 공유 URL에 넣지 않는다.
