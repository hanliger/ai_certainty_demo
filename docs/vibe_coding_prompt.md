# Vibe Coding Prompt

당신은 행동실험/온라인 설문 웹앱을 구현하는 senior frontend engineer입니다. 아래 조건을 만족하는 GitHub Pages/로컬 실행용 정적 웹 실험 데모를 완성해 주세요. 빌드 과정 없이 `index.html`을 열거나 `python3 -m http.server 8000`으로 실행 가능한 Vanilla HTML/CSS/JavaScript 프로젝트를 목표로 합니다.

## 연구/실험 개요

프로젝트명은 `AI 응답의 확신 표현이 구매 의사결정에 미치는 영향`입니다. 참가자는 총 3개의 역할을 맡고, 각 역할별로 3개의 제품 구매 결정을 수행합니다. 각 decision trial에서는 제품 비교표와 추가 정보가 제공되며, 일부 trial에서는 AI Assistant 의견이 함께 제시됩니다.

페르소나와 시나리오는 다음과 같습니다.

- P1 재활의학과 개원의
  - P1_S1 체외충격파 치료기 구매
  - P1_S2 근골격계 초음파 장비 구매
  - P1_S3 고출력 레이저 치료기 구매
- P2 제조기업 구매팀 과장
  - P2_S1 조립·체결 공정용 협동 로봇 구매
  - P2_S2 용접 보조용 협동 로봇 구매
  - P2_S3 물류·팔레타이징용 협동 로봇 구매
- P3 카페·베이커리 예비 창업자
  - P3_S1 에스프레소 머신 구매
  - P3_S2 데크 오븐 구매
  - P3_S3 냉장·냉동 쇼케이스 구매

AI 조건은 세 가지입니다.

- N: 중립형, AI Assistant 의견 없음
- C: 확신형, 단정적 추천과 명확한 결론
- H: 유보형, 조건부 판단과 불확실성 강조

## 구현 요구사항

1. 정적 웹앱으로 구현합니다.
   - GitHub Pages 배포 가능.
   - 별도 백엔드, DB, Node build step 없음.
   - `fetch()`로 `data/*.json`, `content/*.json`을 읽음.
   - 로컬 실행은 `python3 -m http.server 8000` 기준.

2. 참가자 식별
   - 첫 화면에서 `participant_id` 필수 입력.
   - `session_id`는 UUID로 자동 생성.
   - JSON/CSV에 둘 다 저장.

3. Flow
   - 동의/안내 → participant_id 입력 → 9개 trial → manipulation check → demographics → completion/download.
   - 각 trial은 persona 안내, scenario 배경, 후보 제품 비교표, AI 의견, 제품 선택, 선택 이유, 사후 문항 순서.

4. 조건 배정
   - 기본값은 `within_subject_balanced_by_persona`.
   - 각 페르소나 안에서 N/C/H가 정확히 한 번씩 등장.
   - participant_id를 seed처럼 사용해 참가자별 조건 순서를 달리함.
   - 최종 응답에는 `assignment_mode`, `assignment_seed`, `condition_by_scenario`, `trial_order` 저장.

5. Response Time
   - 변수명: `decision_response_time_ms`.
   - 구간: trial decision page가 완전히 렌더링된 직후부터 A/B/C 제품 선택 버튼 최초 클릭까지.
   - `requestAnimationFrame()` 후 `performance.now()`로 시작.
   - 최초 클릭에서 `performance.now()`를 다시 읽고 차이를 ms 단위로 저장.
   - 함께 저장: `trial_page_rendered_at_iso`, `decision_clicked_at_iso`, `decision_response_time_ms`.

6. Trial 저장 필드
   - `trial_index`, `persona_id`, `scenario_id`, `condition`, `condition_label`, `stimulus_id`
   - `ai_shown`, `ai_recommended_option`
   - `selected_option`, `selected_product_label`, `choice_reason`
   - `trial_page_rendered_at_iso`, `decision_clicked_at_iso`, `decision_response_time_ms`
   - `post_answers`

7. 사후 문항 표시 규칙
   - 모든 조건: `decision_confidence`, `perceived_uncertainty`.
   - C/H 조건만: `trust_ai`, `helpfulness_ai`, `expertise_ai`, `objectivity_ai`, `ai_influence`.
   - N 조건에서는 AI 관련 문항을 숨기고 JSON에는 `null`, CSV에는 빈 값으로 저장.

8. 조작 점검
   - 전체 9개 trial 종료 후 표시.
   - `perceived_ai_certainty`, `conclusion_clarity`를 1~5 Likert로 저장.

9. Demographics
   - `age_group`, `gender`, `gender_other`, `education`, `ai_use_frequency`, `purchase_decision_experience`, `medical_device_knowledge`, `robotics_knowledge`, `cafe_equipment_knowledge`.
   - 원하지 않는 항목에는 “응답하지 않음” 선택지를 제공.

10. Autosave
   - 모든 주요 단계 전환마다 `localStorage`에 state 저장.
   - 새로고침 후 이어하기 제공.
   - 저장 key는 `data/experiment.config.json`의 `autosave.local_storage_key` 사용.

11. 최종 다운로드
   - completion page 버튼: `실험 종료 및 응답 파일 저장`.
   - 버튼 클릭 시 JSON 원자료와 CSV 분석용 파일을 Blob으로 생성해 순차 다운로드.
   - 파일명:
     - `AIcertainty_{participant_id}_{session_id8}_{timestamp}.json`
     - `AIcertainty_{participant_id}_{session_id8}_{timestamp}.csv`
   - 백업 버튼 제공: `JSON 다시 다운로드`, `CSV 다시 다운로드`.
   - CSV에는 UTF-8 BOM을 붙여 Excel에서 한글이 깨지지 않게 함.

12. 검수 체크리스트
   - participant_id 없이는 시작 불가.
   - 9개 trial 표시.
   - 각 persona 안에서 N/C/H 한 번씩 등장.
   - N 조건에서 AI 의견 및 AI 관련 사후 문항 숨김.
   - C/H 조건에서 AI 문구 표시.
   - 제품 선택 최초 클릭 시 RT 저장.
   - completion page에서 JSON/CSV 다운로드.
   - 새로고침 후 이어하기 가능.
