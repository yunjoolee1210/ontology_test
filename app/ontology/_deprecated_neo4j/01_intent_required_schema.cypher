// =========================================================
// 콩당콩당 - 의도별 Required/Optional 슬롯 온톨로지 (Neo4j)
// 대상 의도: 증상 문진(SymptomInquiry), 병원 정보(HospitalInfo)
// =========================================================

// -------------------------
// 0. 기존 데이터 초기화 (선택)
// -------------------------
// MATCH (n) DETACH DELETE n;

// -------------------------
// 1. 제약조건 (유니크 키)
// -------------------------
CREATE CONSTRAINT intent_name_unique IF NOT EXISTS
FOR (i:Intent) REQUIRE i.name IS UNIQUE;

CREATE CONSTRAINT slot_name_unique IF NOT EXISTS
FOR (s:Slot) REQUIRE s.name IS UNIQUE;

// -------------------------
// 2. Intent 노드 생성
// -------------------------
MERGE (symptom:Intent {name: "SymptomInquiry"})
  SET symptom.label_ko = "증상 문진",
      symptom.response_type = "free_form",
      symptom.description = "사용자의 자유 발화 증상 설명을 받아 임상 개념 매핑 및 대처 가이드 제공";

MERGE (hospital:Intent {name: "HospitalInfo"})
  SET hospital.label_ko = "병원 정보",
      hospital.response_type = "structured_slot_filling",
      hospital.description = "사용자 조건에 맞는 병원/투석 시설 정보를 슬롯필링으로 안내";

// -------------------------
// 3. Slot 노드 생성
// -------------------------

// --- SymptomInquiry 슬롯 ---
MERGE (s_symptom_name:Slot {name: "symptom_name"})
  SET s_symptom_name.label_ko = "증상명",
      s_symptom_name.data_type = "string",
      s_symptom_name.source = "user_utterance",
      s_symptom_name.fallback_strategy = "llm_extract_then_ask",
      s_symptom_name.colloquial_examples = ["발이 저려요", "소변에 거품이 많아요", "콩팥 4기예요"];

MERGE (s_duration:Slot {name: "duration"})
  SET s_duration.label_ko = "증상 지속기간",
      s_duration.data_type = "string",
      s_duration.source = "user_utterance",
      s_duration.fallback_strategy = "llm_infer_or_skip";

MERGE (s_severity:Slot {name: "severity"})
  SET s_severity.label_ko = "증상 심각도",
      s_severity.data_type = "enum",
      s_severity.allowed_values = ["mild", "moderate", "severe"],
      s_severity.source = "user_utterance",
      s_severity.fallback_strategy = "llm_infer_or_skip";

MERGE (s_disease_stage:Slot {name: "disease_stage"})
  SET s_disease_stage.label_ko = "질환 단계(CKD/DM 병기)",
      s_disease_stage.data_type = "string",
      s_disease_stage.source = "user_profile_or_utterance",
      s_disease_stage.fallback_strategy = "profile_lookup_then_ask";

// --- HospitalInfo 슬롯 ---
MERGE (s_location:Slot {name: "location"})
  SET s_location.label_ko = "위치",
      s_location.data_type = "geo",
      s_location.source = "user_utterance_explicit",
      s_location.fallback_strategy = "must_ask_explicitly",
      s_location.note = "프로필/IP 추론 금지 - 모든 조건(RAG/Ontology/LoRA)에서 동일하게 명시적 수집 필수";

MERGE (s_dialysis_type:Slot {name: "dialysis_type"})
  SET s_dialysis_type.label_ko = "투석 종류",
      s_dialysis_type.data_type = "enum",
      s_dialysis_type.allowed_values = ["혈액투석", "복막투석", "야간투석"],
      s_dialysis_type.source = "user_profile_or_utterance",
      s_dialysis_type.fallback_strategy = "profile_lookup_then_ask";

MERGE (s_time_pref:Slot {name: "time_preference"})
  SET s_time_pref.label_ko = "방문 가능 시간대",
      s_time_pref.data_type = "string",
      s_time_pref.source = "user_utterance",
      s_time_pref.fallback_strategy = "llm_infer_or_skip";

MERGE (s_insurance:Slot {name: "insurance_type"})
  SET s_insurance.label_ko = "건강보험 유형",
      s_insurance.data_type = "string",
      s_insurance.source = "user_profile",
      s_insurance.fallback_strategy = "profile_lookup_then_ask";

// -------------------------
// 4. Intent -> Slot 관계 (REQUIRES / OPTIONALLY_HAS)
// -------------------------

// SymptomInquiry: 최소 제약 (자유 대화형이므로 Required 최소화)
MATCH (i:Intent {name: "SymptomInquiry"}), (s:Slot {name: "symptom_name"})
MERGE (i)-[:REQUIRES {priority: 1}]->(s);

MATCH (i:Intent {name: "SymptomInquiry"}), (s:Slot {name: "disease_stage"})
MERGE (i)-[:OPTIONALLY_HAS {priority: 2}]->(s);

MATCH (i:Intent {name: "SymptomInquiry"}), (s:Slot {name: "duration"})
MERGE (i)-[:OPTIONALLY_HAS {priority: 3}]->(s);

MATCH (i:Intent {name: "SymptomInquiry"}), (s:Slot {name: "severity"})
MERGE (i)-[:OPTIONALLY_HAS {priority: 4}]->(s);

// HospitalInfo: 위치는 항상 REQUIRED, 나머지는 프로필 추론 가능하면 OPTIONAL
MATCH (i:Intent {name: "HospitalInfo"}), (s:Slot {name: "location"})
MERGE (i)-[:REQUIRES {priority: 1}]->(s);

MATCH (i:Intent {name: "HospitalInfo"}), (s:Slot {name: "dialysis_type"})
MERGE (i)-[:OPTIONALLY_HAS {priority: 2}]->(s);

MATCH (i:Intent {name: "HospitalInfo"}), (s:Slot {name: "time_preference"})
MERGE (i)-[:OPTIONALLY_HAS {priority: 3}]->(s);

MATCH (i:Intent {name: "HospitalInfo"}), (s:Slot {name: "insurance_type"})
MERGE (i)-[:OPTIONALLY_HAS {priority: 4}]->(s);


// =========================================================
// 5. 조회 쿼리 예시 (챗봇 백엔드에서 호출할 쿼리)
// =========================================================

// 5-1. 특정 의도의 REQUIRED 슬롯만 조회
// MATCH (i:Intent {name: $intentName})-[:REQUIRES]->(s:Slot)
// RETURN s.name AS slot_name, s.label_ko AS label, s.fallback_strategy AS fallback
// ORDER BY s.name;

// 5-2. 특정 의도의 전체 슬롯(REQUIRED + OPTIONAL) 우선순위 순 조회
// MATCH (i:Intent {name: $intentName})-[r:REQUIRES|OPTIONALLY_HAS]->(s:Slot)
// RETURN s.name AS slot_name, s.label_ko AS label, type(r) AS requirement_level, r.priority AS priority
// ORDER BY r.priority;

// 5-3. 위치(location)처럼 모든 의도에서 공통으로 강제되어야 하는 슬롯 검증
// MATCH (i:Intent {name: "HospitalInfo"})-[:REQUIRES]->(s:Slot {name: "location"})
// RETURN s.source, s.fallback_strategy;
