-- =========================================================
-- 콩당콩당 - 온톨로지 전체 Supabase 통합 (v2: Required 기준 재정의)
-- 1) Intent/Slot  2) Disease/Symptom(DOID/HP)  3) Concept(옵시디언 그래프)
--
-- [v2에서 바뀐 것]
-- Required 판정 기준을 "있으면 좋다"가 아니라
-- "이게 없으면 의도에 맞는 정답 자체를 줄 수 없다"로 재정의함.
-- - SymptomInquiry.disease_stage: OPTIONAL -> REQUIRED
--   (같은 증상이라도 CKD/DM 병기에 따라 위험도·권고가 달라져, 모르고 답하면 오답 위험)
-- - HospitalInfo.dialysis_type: OPTIONAL -> REQUIRED
--   (혈액투석/복막투석/야간투석은 찾아야 할 시설이 완전히 다름 - 모르면 엉뚱한 병원을 추천하게 됨)
-- REQUIRED라고 매번 다시 묻는 것은 아님: 사용자 프로필에 값이 있으면 그걸로 바로 충족 처리하고,
-- 없을 때만 명시적으로 묻는다(fallback_strategy='profile_lookup_then_ask').
-- 단, location은 예외 - 개인정보 성격이 강하고 매 상황마다 달라질 수 있어
-- 프로필/IP 추론을 절대 허용하지 않고 항상 직접 질문한다(fallback_strategy='must_ask_explicitly').
-- =========================================================

-- ---------- 1. Intent / Slot ----------
CREATE TABLE IF NOT EXISTS intents (
  intent_name   TEXT PRIMARY KEY,
  label_ko      TEXT,
  response_type TEXT,
  description   TEXT
);

CREATE TABLE IF NOT EXISTS slots (
  slot_name         TEXT PRIMARY KEY,
  label_ko          TEXT,
  data_type         TEXT,
  source            TEXT,
  fallback_strategy TEXT,
  note              TEXT
);

CREATE TABLE IF NOT EXISTS intent_slots (
  intent_name     TEXT REFERENCES intents(intent_name),
  slot_name       TEXT REFERENCES slots(slot_name),
  requirement     TEXT CHECK (requirement IN ('REQUIRED','OPTIONAL')),
  priority        INT,
  required_reason TEXT,
  PRIMARY KEY (intent_name, slot_name)
);

INSERT INTO intents (intent_name, label_ko, response_type, description) VALUES
('SymptomInquiry','증상 문진','free_form','자유 발화 증상 설명 -> 임상 개념 매핑 및 대처 가이드'),
('HospitalInfo','병원 정보','structured_slot_filling','조건에 맞는 병원/투석 시설 슬롯필링 안내')
ON CONFLICT (intent_name) DO NOTHING;

INSERT INTO slots (slot_name, label_ko, data_type, source, fallback_strategy, note) VALUES
('symptom_name','증상명','string','user_utterance','llm_extract_then_ask',
  '증상명 자체가 없으면 무엇에 대해 답할지 정의되지 않아 의도 처리 불가능'),
('disease_stage','질환 단계(CKD/DM 병기)','string','user_profile_or_utterance','profile_lookup_then_ask',
  '같은 증상도 병기(예 CKD 3기 vs 5기)에 따라 위험도/응급도/권고가 달라짐 - 모르면 오답 위험. 프로필에 있으면 자동 충족'),
('duration','증상 지속기간','string','user_utterance','llm_infer_or_skip',
  '없어도 일반적 대처 가이드는 제공 가능 - 응급도 판단 보조지표일 뿐 필수 아님'),
('severity','증상 심각도','enum','user_utterance','llm_infer_or_skip',
  '없어도 일반적 대처 가이드는 제공 가능 - 보조지표일 뿐 필수 아님'),
('location','위치','geo','user_utterance_explicit','must_ask_explicitly',
  '위치 없이는 어떤 병원도 추천할 수 없어 의도 자체가 성립하지 않음. 프로필/IP 추론 절대 금지, 매번 명시적으로 질문'),
('dialysis_type','투석 종류(혈액투석/복막투석/야간투석)','enum','user_profile_or_utterance','profile_lookup_then_ask',
  '투석 종류별로 찾아야 할 시설이 완전히 다름 - 모르고 추천하면 환자에게 맞지 않는 병원을 추천하는 오답이 됨. 프로필에 있으면 자동 충족'),
('time_preference','방문 가능 시간대','string','user_utterance','llm_infer_or_skip',
  '없어도 병원 추천 자체는 가능 - 편의성 보조정보일 뿐 필수 아님'),
('insurance_type','건강보험 유형','string','user_profile','profile_lookup_then_ask',
  '없어도 병원 추천 자체는 가능 - 필수 아님')
ON CONFLICT (slot_name) DO NOTHING;

INSERT INTO intent_slots (intent_name, slot_name, requirement, priority, required_reason) VALUES
('SymptomInquiry','symptom_name','REQUIRED',1,'증상명이 없으면 처리 대상 자체가 정의되지 않음'),
('SymptomInquiry','disease_stage','REQUIRED',2,'병기에 따라 같은 증상도 위험도/권고가 달라져 모르면 오답 위험 - 프로필 자동충족 우선'),
('SymptomInquiry','duration','OPTIONAL',3,'없어도 일반 가이드 제공 가능'),
('SymptomInquiry','severity','OPTIONAL',4,'없어도 일반 가이드 제공 가능'),
('HospitalInfo','location','REQUIRED',1,'위치 없이는 추천 자체가 불가능, 프로필/IP 추론 절대 금지'),
('HospitalInfo','dialysis_type','REQUIRED',2,'투석종류별 시설이 달라 모르면 잘못된 병원을 추천하게 됨 - 프로필 자동충족 우선'),
('HospitalInfo','time_preference','OPTIONAL',3,'없어도 추천 가능, 편의성 보조정보'),
('HospitalInfo','insurance_type','OPTIONAL',4,'없어도 추천 가능')
ON CONFLICT (intent_name, slot_name) DO NOTHING;

-- ---------- 2. Disease(DOID) / Symptom(HP) ----------
CREATE TABLE IF NOT EXISTS diseases (
  doid       TEXT PRIMARY KEY,
  label_en   TEXT,
  label_ko   TEXT,
  category   TEXT
);

CREATE TABLE IF NOT EXISTS symptoms (
  hp_id      TEXT PRIMARY KEY,
  label_en   TEXT,
  label_ko   TEXT
);

CREATE TABLE IF NOT EXISTS disease_symptoms (
  doid       TEXT REFERENCES diseases(doid),
  hp_id      TEXT REFERENCES symptoms(hp_id),
  note       TEXT,
  PRIMARY KEY (doid, hp_id)
);

INSERT INTO diseases (doid, label_en, label_ko, category) VALUES
('DOID:1074', 'kidney failure', '신부전', 'CKD'),
('DOID:3021', 'acute kidney failure', '급성신손상', 'CKD'),
('DOID:783', 'end stage renal disease', '말기콩팥병(ESKD)', 'CKD'),
('DOID:784', 'chronic kidney disease', '만성콩팥병(CKD)', 'CKD'),
('DOID:13207', 'proliferative diabetic retinopathy', '증식성 당뇨망막병증', 'DM'),
('DOID:13208', 'background diabetic retinopathy', '비증식성 당뇨망막병증(배경형)', 'DM'),
('DOID:8946', 'severe nonproliferative diabetic retinopathy', '중증 비증식성 당뇨망막병증', 'DM'),
('DOID:8947', 'diabetic retinopathy', '당뇨망막병증', 'DM'),
('DOID:9352', 'type 2 diabetes mellitus', '제2형 당뇨병', 'DM'),
('DOID:9743', 'diabetic neuropathy', '당뇨신경병증', 'DM'),
('DOID:10823', 'malignant essential hypertension', '악성 본태성고혈압', 'HTN'),
('DOID:10825', 'essential hypertension', '본태성고혈압', 'HTN'),
('DOID:10913', 'benign essential hypertension', '양성 본태성고혈압', 'HTN')
ON CONFLICT (doid) DO NOTHING;

INSERT INTO symptoms (hp_id, label_en, label_ko) VALUES
('HP:0001953', 'Diabetic ketoacidosis', '당뇨병성 케톤산증'),
('HP:0001959', 'Polydipsia', '다음(물 많이 마심)'),
('HP:0003126', 'Low-molecular-weight proteinuria', '저분자단백뇨'),
('HP:0011998', 'Postprandial hyperglycemia', '식후 고혈당'),
('HP:0012213', 'Decreased glomerular filtration rate', '사구체여과율(GFR) 저하'),
('HP:0012398', 'Peripheral edema', '말초부종'),
('HP:0012593', 'Nephrotic range proteinuria', '신증후군 수준 단백뇨'),
('HP:0012594', 'Moderate albuminuria', '중등도 알부민뇨'),
('HP:0012595', 'Mild proteinuria', '경증 단백뇨'),
('HP:0012596', 'Moderate proteinuria', '중등도 단백뇨'),
('HP:0012597', 'Heavy proteinuria', '고도 단백뇨'),
('HP:0033065', 'Mild albuminuria', '경증 알부민뇨'),
('HP:0033066', 'Severe albuminuria', '중증 알부민뇨'),
('HP:4000058', 'Glomerular proteinuria', '사구체성 단백뇨'),
('HP:6000833', 'Hyperkalemia while symptomatic', '증상성 고칼륨혈증')
ON CONFLICT (hp_id) DO NOTHING;

INSERT INTO disease_symptoms (doid, hp_id, note) VALUES
('DOID:784', 'HP:0012213', 'GFR저하 -> CKD 핵심지표'),
('DOID:784', 'HP:0012398', '말초부종 -> CKD'),
('DOID:784', 'HP:0033065', '경증알부민뇨 -> CKD초기'),
('DOID:784', 'HP:0033066', '중증알부민뇨 -> CKD진행'),
('DOID:783', 'HP:6000833', '고칼륨혈증 -> 말기신부전 응급'),
('DOID:9352', 'HP:0011998', '식후고혈당 -> 제2형당뇨'),
('DOID:9352', 'HP:0001953', '당뇨케톤산증 -> 제2형당뇨 응급'),
('DOID:9743', 'HP:0012398', '말초부종 -> 당뇨신경병증 연관'),
('DOID:8947', 'HP:0011998', '고혈당 -> 당뇨망막병증 연관지표'),
('DOID:10825', 'HP:0012398', '말초부종 -> 고혈압성 부종')
ON CONFLICT (doid, hp_id) DO NOTHING;

-- ---------- 3. Concept Graph (옵시디언 캔버스 추출) ----------
CREATE TABLE IF NOT EXISTS concepts (
  concept_id  TEXT PRIMARY KEY,
  label       TEXT,
  domain      TEXT,
  node_kind   TEXT
);

CREATE TABLE IF NOT EXISTS concept_relations (
  id            SERIAL PRIMARY KEY,
  from_concept  TEXT REFERENCES concepts(concept_id),
  to_concept    TEXT REFERENCES concepts(concept_id),
  relation_type TEXT,
  original_label TEXT
);

INSERT INTO concepts (concept_id, label, domain, node_kind) VALUES
('콩팥병::ckd', '콩팥병(CKD)', '콩팥병', 'file'),
('콩팥병::super1', '만성질환', '콩팥병', 'text'),
('콩팥병::super2', '콩팥(신장) 질환', '콩팥병', 'text'),
('콩팥병::sub1', '말기콩팥병(ESKD)', '콩팥병', 'text'),
('콩팥병::sub2', '당뇨병성콩팥병(DKD)', '콩팥병', 'text'),
('콩팥병::sub3', '고혈압성신장병', '콩팥병', 'text'),
('콩팥병::part1', '사구체(glomerulus)', '콩팥병', 'text'),
('콩팥병::part2', '세뇨관', '콩팥병', 'text'),
('콩팥병::part3', 'eGFR(사구체여과율)', '콩팥병', 'text'),
('콩팥병::part4', '알부민-크레아티닌비(ACR)', '콩팥병', 'text'),
('콩팥병::rel1', '당뇨병(DM)', '콩팥병', 'file'),
('콩팥병::rel2', '고혈압(HTN)', '콩팥병', 'file'),
('콩팥병::rel3', '심혈관질환', '콩팥병', 'text'),
('콩팥병::contrast1', '급성신손상(AKI)', '콩팥병', 'text'),
('콩팥병::dep1', '사구체여과율(GFR) 측정', '콩팥병', 'text'),
('콩팥병::dep2', '알부민뇨(ACR) 측정', '콩팥병', 'text'),
('콩팥병::doid_ckd', '만성콩팥병(CKD) DOID:784', '콩팥병', 'text'),
('콩팥병::doid_eskd', '말기콩팥병(ESKD) DOID:783', '콩팥병', 'text'),
('콩팥병::doid_aki', '급성신손상 DOID:3021', '콩팥병', 'text'),
('콩팥병::doid_kf', '신부전 DOID:1074', '콩팥병', 'text'),
('콩팥병::hp_gfr', '사구체여과율(GFR) 저하 HP:0012213', '콩팥병', 'text'),
('콩팥병::hp_edema', '말초부종 HP:0012398', '콩팥병', 'text'),
('콩팥병::hp_alb_mild', '경증 알부민뇨 HP:0033065', '콩팥병', 'text'),
('콩팥병::hp_alb_severe', '중증 알부민뇨 HP:0033066', '콩팥병', 'text'),
('콩팥병::hp_hyperk', '증상성 고칼륨혈증 HP:6000833', '콩팥병', 'text'),
('당뇨병::dm', '당뇨병(DM)', '당뇨병', 'file'),
('당뇨병::super1', '대사질환', '당뇨병', 'text'),
('당뇨병::super2', '만성질환', '당뇨병', 'text'),
('당뇨병::sub1', '1형당뇨병', '당뇨병', 'text'),
('당뇨병::sub2', '2형당뇨병', '당뇨병', 'text'),
('당뇨병::sub3', '기타 당뇨병', '당뇨병', 'text'),
('당뇨병::sub4', '임신당뇨병', '당뇨병', 'text'),
('당뇨병::part1', '췌장 베타세포', '당뇨병', 'text'),
('당뇨병::part2', '인슐린', '당뇨병', 'text'),
('당뇨병::part3', '혈당 (공복혈당/식후혈당)', '당뇨병', 'text'),
('당뇨병::part4', '당화혈색소(HbA1c)', '당뇨병', 'text'),
('당뇨병::rel1', '고혈압(HTN)', '당뇨병', 'file'),
('당뇨병::rel2', '비만', '당뇨병', 'text'),
('당뇨병::rel3', '이상지질혈증', '당뇨병', 'text'),
('당뇨병::contrast1', '정상혈당', '당뇨병', 'text'),
('당뇨병::contrast2', '전당뇨 (공복혈당장애·내당능장애)', '당뇨병', 'text'),
('당뇨병::dep1', '콩팥병(CKD)', '당뇨병', 'file'),
('당뇨병::dep2', '당뇨병성망막병증', '당뇨병', 'text'),
('당뇨병::dep3', '당뇨병성신경병증', '당뇨병', 'text'),
('당뇨병::doid_t2dm', '제2형 당뇨병 DOID:9352', '당뇨병', 'text'),
('당뇨병::doid_dnp', '당뇨신경병증 DOID:9743', '당뇨병', 'text'),
('당뇨병::doid_dr', '당뇨망막병증 DOID:8947', '당뇨병', 'text'),
('당뇨병::doid_dr_prolif', '증식성 당뇨망막병증 DOID:13207', '당뇨병', 'text'),
('당뇨병::doid_dr_bg', '비증식성 당뇨망막병증 DOID:13208', '당뇨병', 'text'),
('당뇨병::hp_pphg', '식후 고혈당 HP:0011998', '당뇨병', 'text'),
('당뇨병::hp_dka', '당뇨병성 케톤산증 HP:0001953', '당뇨병', 'text'),
('당뇨병::hp_polydipsia', '다음(물 많이 마심) HP:0001959', '당뇨병', 'text'),
('고혈압::htn', '고혈압(HTN)', '고혈압', 'file'),
('고혈압::super1', '심혈관질환', '고혈압', 'text'),
('고혈압::super2', '만성질환', '고혈압', 'text'),
('고혈압::sub1', '1차성(본태성)고혈압', '고혈압', 'text'),
('고혈압::sub2', '2차성고혈압', '고혈압', 'text'),
('고혈압::sub3', '수축기단독고혈압(ISH)', '고혈압', 'text'),
('고혈압::sub4', '고혈압 위기 (hypertensive emergency)', '고혈압', 'text'),
('고혈압::part1', '수축기혈압(SBP)', '고혈압', 'text'),
('고혈압::part2', '확장기혈압(DBP)', '고혈압', 'text'),
('고혈압::rel1', '당뇨병(DM)', '고혈압', 'file'),
('고혈압::rel2', '심부전', '고혈압', 'text'),
('고혈압::rel3', '뇌졸중', '고혈압', 'text'),
('고혈압::rel4', '이상지질혈증', '고혈압', 'text'),
('고혈압::contrast1', '정상혈압(Normal BP)', '고혈압', 'text'),
('고혈압::contrast2', '주의혈압(Elevated BP)', '고혈압', 'text'),
('고혈압::dep1', '콩팥병(CKD)', '고혈압', 'file'),
('고혈압::dep2', '좌심실비대', '고혈압', 'text'),
('고혈압::dep3', '동맥경화', '고혈압', 'text'),
('고혈압::doid_essential', '본태성고혈압 DOID:10825', '고혈압', 'text'),
('고혈압::doid_malignant', '악성 본태성고혈압 DOID:10823', '고혈압', 'text'),
('고혈압::doid_benign', '양성 본태성고혈압 DOID:10913', '고혈압', 'text'),
('고혈압::hp_edema_htn', '말초부종 HP:0012398', '고혈압', 'text'),
('통합::dm', '당뇨병(DM)', '통합', 'file'),
('통합::htn', '고혈압(HTN)', '통합', 'file'),
('통합::ckd', '콩팥병(CKD)', '통합', 'file'),
('통합::loop', '관계_당뇨병_고혈압_콩팥병_악순환', '통합', 'file'),
('통합::rel_dm_ckd', '관계_당뇨병_콩팥병', '통합', 'file'),
('통합::rel_htn_ckd', '관계_고혈압_콩팥병', '통합', 'file'),
('통합::rel_dm_htn', '관계_당뇨병_고혈압', '통합', 'file'),
('통합::egfr', 'eGFR 계산(CKD-EPI 2021)', '통합', 'file'),
('통합::labtest', '임상지표(eGFR·ACR·HbA1c·혈압)', '통합', 'file'),
('통합::raas', 'RAAS억제제(ACEi·ARB)', '통합', 'file'),
('통합::sglt2', 'SGLT2억제제', '통합', 'file'),
('통합::welfare', '장애인등록 및 복지혜택', '통합', 'file')
ON CONFLICT (concept_id) DO NOTHING;

INSERT INTO concept_relations (from_concept, to_concept, relation_type, original_label) VALUES
('콩팥병::ckd', '콩팥병::super1', 'IS_A', 'is-a'),
('콩팥병::ckd', '콩팥병::super2', 'IS_A', 'is-a'),
('콩팥병::sub1', '콩팥병::ckd', 'IS_A', 'is-a'),
('콩팥병::sub2', '콩팥병::ckd', 'IS_A', 'is-a'),
('콩팥병::sub3', '콩팥병::ckd', 'IS_A', 'is-a'),
('콩팥병::ckd', '콩팥병::part1', 'PART_OF', 'part-of'),
('콩팥병::ckd', '콩팥병::part2', 'PART_OF', 'part-of'),
('콩팥병::ckd', '콩팥병::part3', 'PART_OF', 'part-of'),
('콩팥병::ckd', '콩팥병::part4', 'PART_OF', 'part-of'),
('콩팥병::ckd', '콩팥병::rel1', 'RELATED_TO', 'related-to'),
('콩팥병::ckd', '콩팥병::rel2', 'RELATED_TO', 'related-to'),
('콩팥병::ckd', '콩팥병::rel3', 'RELATED_TO', 'related-to'),
('콩팥병::ckd', '콩팥병::contrast1', 'CONTRASTS_WITH', 'contrasts-with'),
('콩팥병::ckd', '콩팥병::dep1', 'DEPENDS_ON', 'depends-on'),
('콩팥병::ckd', '콩팥병::dep2', 'DEPENDS_ON', 'depends-on'),
('콩팥병::ckd', '콩팥병::doid_ckd', 'RELATED_TO', '표준코드'),
('콩팥병::sub1', '콩팥병::doid_eskd', 'RELATED_TO', '표준코드'),
('콩팥병::doid_ckd', '콩팥병::doid_aki', 'CONTRASTS_WITH', 'contrasts-with'),
('콩팥병::doid_ckd', '콩팥병::doid_kf', 'IS_A', 'is-a'),
('콩팥병::doid_ckd', '콩팥병::hp_gfr', 'PART_OF', 'has-symptom'),
('콩팥병::doid_ckd', '콩팥병::hp_edema', 'PART_OF', 'has-symptom'),
('콩팥병::doid_ckd', '콩팥병::hp_alb_mild', 'PART_OF', 'has-symptom'),
('콩팥병::doid_ckd', '콩팥병::hp_alb_severe', 'PART_OF', 'has-symptom'),
('콩팥병::doid_eskd', '콩팥병::hp_hyperk', 'PART_OF', 'has-symptom'),
('당뇨병::dm', '당뇨병::super1', 'IS_A', 'is-a'),
('당뇨병::dm', '당뇨병::super2', 'IS_A', 'is-a'),
('당뇨병::sub1', '당뇨병::dm', 'IS_A', 'is-a'),
('당뇨병::sub2', '당뇨병::dm', 'IS_A', 'is-a'),
('당뇨병::sub3', '당뇨병::dm', 'IS_A', 'is-a'),
('당뇨병::sub4', '당뇨병::dm', 'IS_A', 'is-a'),
('당뇨병::dm', '당뇨병::part1', 'PART_OF', 'part-of'),
('당뇨병::dm', '당뇨병::part2', 'PART_OF', 'part-of'),
('당뇨병::dm', '당뇨병::part3', 'PART_OF', 'part-of'),
('당뇨병::dm', '당뇨병::part4', 'PART_OF', 'part-of'),
('당뇨병::dm', '당뇨병::rel1', 'RELATED_TO', 'related-to'),
('당뇨병::dm', '당뇨병::rel2', 'RELATED_TO', 'related-to'),
('당뇨병::dm', '당뇨병::rel3', 'RELATED_TO', 'related-to'),
('당뇨병::dm', '당뇨병::contrast1', 'CONTRASTS_WITH', 'contrasts-with'),
('당뇨병::dm', '당뇨병::contrast2', 'CONTRASTS_WITH', 'contrasts-with'),
('당뇨병::dm', '당뇨병::dep1', 'DEPENDS_ON', 'depends-on'),
('당뇨병::dm', '당뇨병::dep2', 'DEPENDS_ON', 'depends-on'),
('당뇨병::dm', '당뇨병::dep3', 'DEPENDS_ON', 'depends-on'),
('당뇨병::sub2', '당뇨병::doid_t2dm', 'RELATED_TO', '표준코드'),
('당뇨병::dep3', '당뇨병::doid_dnp', 'RELATED_TO', '표준코드'),
('당뇨병::dep2', '당뇨병::doid_dr', 'RELATED_TO', '표준코드'),
('당뇨병::doid_dr', '당뇨병::doid_dr_prolif', 'IS_A', 'is-a'),
('당뇨병::doid_dr', '당뇨병::doid_dr_bg', 'IS_A', 'is-a'),
('당뇨병::doid_t2dm', '당뇨병::hp_pphg', 'PART_OF', 'has-symptom'),
('당뇨병::doid_t2dm', '당뇨병::hp_dka', 'PART_OF', 'has-symptom'),
('당뇨병::doid_t2dm', '당뇨병::hp_polydipsia', 'PART_OF', 'has-symptom'),
('고혈압::htn', '고혈압::super1', 'IS_A', 'is-a'),
('고혈압::htn', '고혈압::super2', 'IS_A', 'is-a'),
('고혈압::sub1', '고혈압::htn', 'IS_A', 'is-a'),
('고혈압::sub2', '고혈압::htn', 'IS_A', 'is-a'),
('고혈압::sub3', '고혈압::htn', 'IS_A', 'is-a'),
('고혈압::sub4', '고혈압::htn', 'IS_A', 'is-a'),
('고혈압::htn', '고혈압::part1', 'PART_OF', 'part-of'),
('고혈압::htn', '고혈압::part2', 'PART_OF', 'part-of'),
('고혈압::htn', '고혈압::rel1', 'RELATED_TO', 'related-to'),
('고혈압::htn', '고혈압::rel2', 'RELATED_TO', 'related-to'),
('고혈압::htn', '고혈압::rel3', 'RELATED_TO', 'related-to'),
('고혈압::htn', '고혈압::rel4', 'RELATED_TO', 'related-to'),
('고혈압::htn', '고혈압::contrast1', 'CONTRASTS_WITH', 'contrasts-with'),
('고혈압::htn', '고혈압::contrast2', 'CONTRASTS_WITH', 'contrasts-with'),
('고혈압::htn', '고혈압::dep1', 'DEPENDS_ON', 'depends-on'),
('고혈압::htn', '고혈압::dep2', 'DEPENDS_ON', 'depends-on'),
('고혈압::htn', '고혈압::dep3', 'DEPENDS_ON', 'depends-on'),
('고혈압::sub1', '고혈압::doid_essential', 'RELATED_TO', '표준코드'),
('고혈압::doid_essential', '고혈압::doid_malignant', 'IS_A', 'is-a'),
('고혈압::doid_essential', '고혈압::doid_benign', 'IS_A', 'is-a'),
('고혈압::doid_essential', '고혈압::hp_edema_htn', 'PART_OF', 'has-symptom'),
('통합::dm', '통합::rel_dm_ckd', 'IS_A', 'causes/comorbid-with'),
('통합::ckd', '통합::rel_dm_ckd', 'IS_A', 'causes/comorbid-with'),
('통합::htn', '통합::rel_htn_ckd', 'IS_A', 'causes/comorbid-with'),
('통합::ckd', '통합::rel_htn_ckd', 'IS_A', 'causes/comorbid-with'),
('통합::dm', '통합::rel_dm_htn', 'IS_A', 'comorbid-with'),
('통합::htn', '통합::rel_dm_htn', 'IS_A', 'comorbid-with'),
('통합::dm', '통합::loop', 'IS_A', 'feedback-loop'),
('통합::htn', '통합::loop', 'IS_A', 'feedback-loop'),
('통합::ckd', '통합::loop', 'IS_A', 'feedback-loop'),
('통합::ckd', '통합::egfr', 'PART_OF', 'depends-on'),
('통합::dm', '통합::labtest', 'PART_OF', 'depends-on'),
('통합::htn', '통합::labtest', 'PART_OF', 'depends-on'),
('통합::ckd', '통합::labtest', 'PART_OF', 'depends-on'),
('통합::htn', '통합::raas', 'RELATED_TO', '공통치료축'),
('통합::ckd', '통합::raas', 'RELATED_TO', '공통치료축'),
('통합::loop', '통합::raas', 'RELATED_TO', '공통치료축'),
('통합::dm', '통합::sglt2', 'RELATED_TO', '공통치료축'),
('통합::ckd', '통합::sglt2', 'RELATED_TO', '공통치료축'),
('통합::loop', '통합::sglt2', 'RELATED_TO', '공통치료축'),
('통합::dm', '통합::welfare', 'RELATED_TO', 'related-to'),
('통합::htn', '통합::welfare', 'RELATED_TO', 'related-to'),
('통합::ckd', '통합::welfare', 'RELATED_TO', 'related-to');
