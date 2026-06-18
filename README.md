# AI 확신 표현 구매 의사결정 웹 실험 데모

`AI 응답의 확신 표현이 구매 의사결정에 미치는 영향`을 측정하는 정적 웹 실험입니다.
빌드 과정 없이 **순수 HTML / CSS / Vanilla JavaScript(ES modules)** 로 동작하며, GitHub Pages에 그대로 배포할 수 있습니다.

참가자는 3개 페르소나(역할) × 각 3개 시나리오 = **총 9개 구매 의사결정**을 수행하고, 각 결정마다 제품 선택, 응답 시간(RT), 사후 문항에 응답합니다. 결과는 JSON / CSV로 다운로드하거나(기본), 설정된 경우 원격 서버로 제출합니다.

---

## 1. 로컬 실행

`file://`로 직접 열면 ES module / fetch 보안 정책 때문에 동작하지 않습니다. 정적 서버로 실행하세요.

```bash
cd ai_certainty_demo
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

또는 Node가 있다면:

```bash
npx serve .
```

---

## 2. GitHub Pages 배포

1. 이 폴더 전체(루트의 `index.html`, `.nojekyll`, `css/`, `js/`, `data/`, `content/`)를 GitHub repository에 push 합니다.
2. GitHub repository → **Settings → Pages**.
3. **Source** 를 `Deploy from a branch`, **Branch** 를 `main`(또는 배포 브랜치) / `/ (root)` 로 설정합니다.
4. 잠시 후 `https://<사용자명>.github.io/<repo>/` 에서 접속됩니다.

> 모든 경로는 상대 경로(`data/...`, `js/...`)라서 프로젝트 페이지(하위 경로) 배포에서도 정상 동작합니다.
> `.nojekyll` 파일이 있어야 Jekyll이 `js/`·`data/` 등을 건드리지 않습니다. 삭제하지 마세요.

백엔드 저장소가 없으면 참가자는 완료 화면에서 JSON/CSV 파일을 내려받아 연구자에게 제출합니다.

---

## 3. 데이터 파일 수정

콘텐츠는 코드에 하드코딩되어 있지 않고 아래 JSON 파일에서 읽어 렌더링됩니다. 텍스트/제품/문항을 바꾸려면 JSON만 수정하면 됩니다.

| 파일 | 내용 |
|------|------|
| `data/experiment.config.json` | 실험 ID·제목, 조건 배정 모드, 조건 순서표, 시나리오 순서, 다운로드/자동저장/원격 설정 |
| `data/personas.json` | 3개 페르소나(역할) 안내문 |
| `data/scenarios.json` | 9개 시나리오: 배경, 비교표, 옵션 A/B/C, 조건별(N/C/H) AI 메시지 |
| `data/questions.json` | 사후 문항(`post_trial`), 조작 점검(`manipulation_check`), 인구통계(`demographics`) |
| `data/response_schema.json` | 결과 JSON의 JSON Schema (참고용) |
| `content/consent.json` | 동의 화면 본문 + 체크박스 문구 |
| `content/instructions.json` | 응답 방식 안내 화면 |

수정 시 주의:

- **시나리오 추가/삭제** 시 `experiment.config.json` 의 `scenario_order` 와 `data/scenarios.json` 의 `id`(`P{n}_S{m}`)를 일치시키세요. 각 시나리오는 `ai_messages.N / .C / .H` 세 조건을 모두 가져야 합니다.
- **조건 배정**: `condition_sequences` 의 각 항목은 `N/C/H`가 한 번씩 들어간 순열이어야 합니다. 페르소나별로 한 순열이 배정되어 각 역할 안에서 N/C/H가 정확히 1회씩 나타납니다.
- **사후 문항의 표시 조건**: `show_when`이 `"always"`면 항상 표시, 그 외(예: `condition != 'N'`)는 N 조건에서 숨겨지고 결과에 `null`로 저장됩니다.

---

## 4. Response Time(RT) 정의

- **`decision_response_time_ms`** = 시나리오 결정 페이지가 **화면에 실제로 렌더링(paint)된 시점** 부터 **A/B/C 제품 버튼을 최초로 클릭한 시점** 까지의 시간(ms).
- 렌더 시점은 `requestAnimationFrame` 더블 콜백 후 `performance.now()`로 측정합니다(페인트 직후).
- 제품을 이미 선택한 뒤 다시 클릭해도 RT는 갱신되지 않습니다(최초 클릭 기준, 선택 후 버튼 잠금).
- **선택 이유 작성 시간과 사후 문항 응답 시간은 RT에 포함되지 않습니다.**
- 참고용 절대 시각(`trial_page_rendered_at_iso`, `decision_clicked_at_iso`)과 전체 trial 소요 시간(`total_trial_time_ms`: 렌더~사후문항 제출)도 함께 저장됩니다.

---

## 5. 결과 데이터 구조

### 5.1 JSON (원자료, 1인 1파일)

`data/response_schema.json`을 따릅니다. 주요 구조:

```jsonc
{
  "experiment_id": "ai_certainty_purchase_decision_0617",
  "participant_id": "S001",
  "session_id": "uuid",
  "started_at_iso": "...",
  "consented_at_iso": "...",
  "completed_at_iso": "...",
  "exported_at_iso": "...",
  "user_agent": "...",
  "assignment": {
    "assignment_mode": "within_subject_balanced_by_persona",
    "assignment_seed": "S001",
    "condition_by_scenario": { "P1_S1": "N", "P1_S2": "C", ... },
    "trial_order": ["P1_S1", "P1_S2", ...]
  },
  "trials": [
    {
      "trial_index": 1, "persona_id": "P1", "scenario_id": "P1_S1",
      "condition": "C", "stimulus_id": "P1_S1_C",
      "trial_page_rendered_at_iso": "...", "decision_clicked_at_iso": "...",
      "decision_response_time_ms": 12345.6,
      "selected_option": "A", "selected_product_label": "A사 (...)",
      "choice_reason": "...",
      "post_answers": { "decision_confidence": 4, "trust_ai": 4, ... },
      "post_started_at_iso": "...", "trial_completed_at_iso": "...",
      "total_trial_time_ms": 55555.1,
      "event_log": [ { "event": "trial_rendered", "iso": "...", "t": 1000.1 }, ... ]
    }
  ],
  "manipulation_check": { "perceived_ai_certainty": 4, "conclusion_clarity": 5 },
  "demographics": { "age_group": "30대", "gender": "여성", "gender_other": null, ... }
}
```

- N 조건에서 AI 관련 사후 문항(`trust_ai`, `helpfulness_ai`, `expertise_ai`, `objectivity_ai`, `ai_influence`)은 `null`로 저장됩니다.

### 5.2 CSV (trial-level long format)

한 행 = 한 trial. 한 참가자는 **9행**을 가집니다. 분석 편의를 위해 인구통계·조작점검 값이 모든 행에 반복됩니다. 한글 깨짐 방지를 위해 UTF-8 BOM이 포함됩니다.

주요 컬럼: `participant_id, session_id, trial_index, persona_id, scenario_id, condition, stimulus_id, selected_option, selected_product_label, decision_response_time_ms, choice_reason, decision_confidence, trust_ai, helpfulness_ai, expertise_ai, objectivity_ai, perceived_uncertainty, ai_influence, trial_page_rendered_at_iso, decision_clicked_at_iso, total_trial_time_ms, ...`

여러 참가자의 CSV를 합칠 때:

```bash
python3 scripts/merge_csv.py <csv가_있는_폴더> merged.csv
```

---

## 6. 원격 저장 endpoint 설정 (선택)

기본값은 파일 다운로드입니다. 원격 수집 서버가 있다면 `data/experiment.config.json` 의 `remote` 를 설정하세요.

```json
"remote": { "submit_url": "https://your-endpoint.example.com/collect", "method": "POST" }
```

- `submit_url`이 설정되면 완료 화면에 **"서버로 제출"** 버튼이 나타납니다.
- 제출은 결과 JSON 본문을 `Content-Type: application/json` 으로 `POST` 합니다.
- 제출이 실패하면 자동으로 JSON/CSV 다운로드로 **fallback** 하므로 데이터 유실이 없습니다.
- 서버는 CORS(`Access-Control-Allow-Origin`)를 허용해야 합니다.
- `submit_url`이 `null`이면(기본) 원격 제출 버튼은 표시되지 않고 다운로드만 제공됩니다.

---

## 7. 파일 구조

```text
index.html              # 진입점 (#app 컨테이너 + 라이브 영역)
.nojekyll               # GitHub Pages Jekyll 비활성화
css/style.css           # 반응형 스타일
js/app.js               # 라우팅 + 화면 렌더링
js/state.js             # 상태 생성 / localStorage 자동저장·복구
js/randomization.js     # 결정적 해시 기반 조건 배정
js/timing.js            # trial 타이머 (RT 측정)
js/export.js            # JSON/CSV 다운로드, 원격 POST
js/validation.js        # 필수 응답 검증
data/*.json             # 실험 데이터
content/*.json          # 동의/안내 콘텐츠
scripts/merge_csv.py    # 참가자별 CSV 병합 유틸
```

---

## 8. 동작 요약 (화면 흐름)

`Landing → 참가자 ID → 동의 → 안내 → (역할 소개 → 9개 시나리오 결정 → 사후 문항) → 조작 점검 → 인구통계 → 결과 저장`

- 새로고침 시 `localStorage`에서 진행 상태가 복구됩니다.
- 참가자 ID 미입력 / 동의 미체크 시 다음 단계로 진행할 수 없습니다.
- 완료 화면에서 저장 데이터 삭제(localStorage 비우기)가 가능합니다.
