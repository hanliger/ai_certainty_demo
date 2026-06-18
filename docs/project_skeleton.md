# Project Skeleton

```text
ai_certainty_download_demo_skeleton/
  index.html
  .nojekyll
  README.md
  css/style.css
  js/app.js
  js/state.js
  js/randomization.js
  js/timing.js
  js/validation.js
  js/export.js
  data/experiment.config.json
  data/personas.json
  data/scenarios.json
  data/questions.json
  data/response_schema.json
  data/response_fields.csv
  content/consent.json
  content/instructions.json
  docs/project_skeleton.md
  docs/vibe_coding_prompt.md
  scripts/merge_csv.py
```

## 핵심 설계

- `data/scenarios.json`: DOCX의 9개 시나리오, 후보 제품 비교표, AI 조건 문구.
- `data/questions.json`: trial 후 사후 평가, 전체 조작 점검, demographics.
- `js/timing.js`: `requestAnimationFrame()` 후 `performance.now()`로 RT 시작, 제품 선택 최초 클릭에서 RT 종료.
- `js/export.js`: JSON 원자료와 trial-level long CSV 다운로드.
- `js/randomization.js`: participant_id 기반으로 각 페르소나 내 N/C/H 균형 배정.

## 저장 방식

최종 JSON은 참가자 단위 원자료이고, CSV는 trial 단위 long format입니다. 완료 화면에서 `[실험 종료 및 응답 파일 저장]` 버튼을 누르면 JSON/CSV가 순차 다운로드됩니다.
