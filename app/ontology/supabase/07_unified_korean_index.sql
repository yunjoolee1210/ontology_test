-- =========================================================
-- 콩당콩당 - 통합 한국어 검색 인덱스 (7개 온톨로지 소스 통합)
--
-- 이 파일이 해결하는 문제:
--   01~06번 SQL은 각각 DOID/HP, CKDO/HTN/DMTO, CDPEO, HTO를 독립된 테이블로 저장했고,
--   서로 다른 ID체계(DOID:784 vs CKDO:eGFR vs HTO:Renal_Failure vs 콩팥병::ckd)를 쓰고 있어
--   '콩팥병'이라는 하나의 한국어 발화로 전체를 한 번에 검색할 방법이 없었다.
--   이 파일은 그 7개 소스 전체를 한 레지스트리로 모으고(concept_registry),
--   동일 개념끼리 동치 연결(concept_same_as)하고,
--   실제 환자 구어체 표현 -> 표준 개념ID 매핑(korean_colloquial_index)을 제공한다.
-- =========================================================

CREATE TABLE IF NOT EXISTS concept_registry (
  id           SERIAL PRIMARY KEY,
  global_id    TEXT NOT NULL,      -- 예: 'DOID:784', 'CKDO:eGFR', 'HTO:Renal_Failure', '콩팥병::ckd'
  source       TEXT NOT NULL,      -- 'DOID'|'HP'|'CKDO'|'HTN'|'DMTO'|'CDPEO'|'HTO'|'ObsidianNote'
  label_en     TEXT,
  label_ko     TEXT,
  kind         TEXT,               -- 'disease'|'symptom'|'clinical_concept'|'risk_factor_class'|'htn_clinical_concept'|'note'
  category     TEXT,               -- 'CKD'|'DM'|'HTN'|NULL
  UNIQUE(global_id)
);
CREATE INDEX IF NOT EXISTS concept_registry_label_ko_idx ON concept_registry (label_ko);
CREATE INDEX IF NOT EXISTS concept_registry_source_idx ON concept_registry (source);

CREATE TABLE IF NOT EXISTS concept_same_as (
  id          SERIAL PRIMARY KEY,
  concept_a   TEXT NOT NULL,   -- concept_registry.global_id
  concept_b   TEXT NOT NULL,
  matched_by  TEXT,            -- 'exact_korean_label'|'manual_curation'
  label_ko    TEXT
);

CREATE TABLE IF NOT EXISTS korean_colloquial_index (
  id              SERIAL PRIMARY KEY,
  colloquial_term TEXT NOT NULL,   -- 사용자가 실제 쓰는 구어체 표현, 예: '콩팥 4기', '소변에 거품'
  mapped_ids      TEXT[],          -- 매핑되는 concept_registry.global_id 목록
  UNIQUE(colloquial_term)
);

INSERT INTO concept_registry (global_id, source, label_en, label_ko, kind, category) VALUES
('DOID:1074', 'DOID', 'kidney failure', '신부전', 'disease', 'CKD'),
('DOID:3021', 'DOID', 'acute kidney failure', '급성신손상', 'disease', 'CKD'),
('DOID:783', 'DOID', 'end stage renal disease', '말기콩팥병(ESKD)', 'disease', 'CKD'),
('DOID:784', 'DOID', 'chronic kidney disease', '만성콩팥병(CKD)', 'disease', 'CKD'),
('DOID:13207', 'DOID', 'proliferative diabetic retinopathy', '증식성 당뇨망막병증', 'disease', 'DM'),
('DOID:13208', 'DOID', 'background diabetic retinopathy', '비증식성 당뇨망막병증(배경형)', 'disease', 'DM'),
('DOID:8946', 'DOID', 'severe nonproliferative diabetic retinopathy', '중증 비증식성 당뇨망막병증', 'disease', 'DM'),
('DOID:8947', 'DOID', 'diabetic retinopathy', '당뇨망막병증', 'disease', 'DM'),
('DOID:9352', 'DOID', 'type 2 diabetes mellitus', '제2형 당뇨병', 'disease', 'DM'),
('DOID:9743', 'DOID', 'diabetic neuropathy', '당뇨신경병증', 'disease', 'DM'),
('DOID:10823', 'DOID', 'malignant essential hypertension', '악성 본태성고혈압', 'disease', 'HTN'),
('DOID:10825', 'DOID', 'essential hypertension', '본태성고혈압', 'disease', 'HTN'),
('DOID:10913', 'DOID', 'benign essential hypertension', '양성 본태성고혈압', 'disease', 'HTN'),
('HP:0001953', 'HP', 'Diabetic ketoacidosis', '당뇨병성 케톤산증', 'symptom', NULL),
('HP:0001959', 'HP', 'Polydipsia', '다음(물 많이 마심)', 'symptom', NULL),
('HP:0003126', 'HP', 'Low-molecular-weight proteinuria', '저분자단백뇨', 'symptom', NULL),
('HP:0011998', 'HP', 'Postprandial hyperglycemia', '식후 고혈당', 'symptom', NULL),
('HP:0012213', 'HP', 'Decreased glomerular filtration rate', '사구체여과율(GFR) 저하', 'symptom', NULL),
('HP:0012398', 'HP', 'Peripheral edema', '말초부종', 'symptom', NULL),
('HP:0012593', 'HP', 'Nephrotic range proteinuria', '신증후군 수준 단백뇨', 'symptom', NULL),
('HP:0012594', 'HP', 'Moderate albuminuria', '중등도 알부민뇨', 'symptom', NULL),
('HP:0012595', 'HP', 'Mild proteinuria', '경증 단백뇨', 'symptom', NULL),
('HP:0012596', 'HP', 'Moderate proteinuria', '중등도 단백뇨', 'symptom', NULL),
('HP:0012597', 'HP', 'Heavy proteinuria', '고도 단백뇨', 'symptom', NULL),
('HP:0033065', 'HP', 'Mild albuminuria', '경증 알부민뇨', 'symptom', NULL),
('HP:0033066', 'HP', 'Severe albuminuria', '중증 알부민뇨', 'symptom', NULL),
('HP:4000058', 'HP', 'Glomerular proteinuria', '사구체성 단백뇨', 'symptom', NULL),
('HP:6000833', 'HP', 'Hyperkalemia while symptomatic', '증상성 고칼륨혈증', 'symptom', NULL),
('CKDO:CKD-EPI_formula', 'CKDO', 'CKD-EPI formula', 'CKD-EPI 공식', 'clinical_concept', 'CKD'),
('CKDO:Dialysis_adequacy_test', 'CKDO', 'Dialysis adequacy test', '투석 적정성 검사', 'clinical_concept', 'CKD'),
('CKDO:Dialysis_recirculation_syndrome', 'CKDO', 'Dialysis recirculation syndrome', '투석 재순환 증후군', 'clinical_concept', 'CKD'),
('CKDO:Dialysis_related_amyloidosis', 'CKDO', 'Dialysis related amyloidosis', '투석 관련 아밀로이드증', 'clinical_concept', 'CKD'),
('CKDO:History_of_CKD', 'CKDO', 'History of CKD', 'CKD 과거력', 'clinical_concept', 'CKD'),
('CKDO:History_of_renal_transplantation', 'CKDO', 'History of renal transplantation', '신장이식 과거력', 'clinical_concept', 'CKD'),
('CKDO:Isotopic_eGFR', 'CKDO', 'Isotopic eGFR', '동위원소법 eGFR', 'clinical_concept', 'CKD'),
('CKDO:Monitoring_of_CKD', 'CKDO', 'Monitoring of CKD', 'CKD 모니터링', 'clinical_concept', 'CKD'),
('CKDO:Peritoneal_leak_in_peritoneal_dialysis', 'CKDO', 'Peritoneal leak in peritoneal dialysis', '복막투석 중 복막 누출', 'clinical_concept', 'CKD'),
('CKDO:Renal_transplant_procedure', 'CKDO', 'Renal transplant procedure', '신장이식 시술', 'clinical_concept', 'CKD'),
('CKDO:Renal_transplantation', 'CKDO', 'Renal transplantation', '신장이식', 'clinical_concept', 'CKD'),
('CKDO:eGFR', 'CKDO', 'eGFR', '사구체여과율 추정치(eGFR)', 'clinical_concept', 'CKD'),
('CKDO:Arteriovenous_fistula_for_haemodialysis', 'CKDO', 'Arteriovenous fistula for haemodialysis', '혈액투석용 동정맥누공(AVF)', 'clinical_concept', 'CKD'),
('CKDO:Arteriovenous_graft_for_haemodialysis', 'CKDO', 'Arteriovenous graft for haemodialysis', '혈액투석용 동정맥이식편(AVG)', 'clinical_concept', 'CKD'),
('CKDO:Assisted_peritoneal_dialysis', 'CKDO', 'Assisted peritoneal dialysis', '보조복막투석', 'clinical_concept', 'CKD'),
('CKDO:Automatic_peritoneal_dialysis', 'CKDO', 'Automatic peritoneal dialysis', '자동복막투석(APD)', 'clinical_concept', 'CKD'),
('CKDO:CKD_KDIGO_stages_1-5', 'CKDO', 'CKD KDIGO stages 1-5', 'CKD KDIGO 병기(1~5단계)', 'clinical_concept', 'CKD'),
('CKDO:CKD_defined_by_stage', 'CKDO', 'CKD defined by stage', '병기로 정의된 CKD', 'clinical_concept', 'CKD'),
('CKDO:Complications_associated_with_haemodialysis', 'CKDO', 'Complications associated with haemodialysis', '혈액투석 관련 합병증', 'clinical_concept', 'CKD'),
('CKDO:Complications_associated_with_peritoneal_dialysis', 'CKDO', 'Complications associated with peritoneal dialysis', '복막투석 관련 합병증', 'clinical_concept', 'CKD'),
('CKDO:Declining_renal_graft_function', 'CKDO', 'Declining renal graft function', '이식신 기능 저하', 'clinical_concept', 'CKD'),
('CKDO:Haemodialysis', 'CKDO', 'Haemodialysis', '혈액투석', 'clinical_concept', 'CKD'),
('CKDO:Peritoneal_dialysis', 'CKDO', 'Peritoneal dialysis', '복막투석', 'clinical_concept', 'CKD'),
('CKDO:Tunnelled_venous_catheter_for_haemodialysis', 'CKDO', 'Tunnelled venous catheter for haemodialysis', '혈액투석용 터널형 정맥카테터', 'clinical_concept', 'CKD'),
('CKDO:Peritoneal_dialysis_(Tenckhoff)_catheter', 'CKDO', 'Peritoneal dialysis (Tenckhoff) catheter', '복막투석용 텐코프 카테터', 'clinical_concept', 'CKD'),
('HTN:HTN_00000000', 'HTN', 'diastolic blood pressure measurement datum', '확장기혈압 측정값', 'clinical_concept', 'HTN'),
('HTN:HTN_00000001', 'HTN', 'systolic blood pressure measurement datum', '수축기혈압 측정값', 'clinical_concept', 'HTN'),
('HTN:HTN_00000014', 'HTN', 'elevated blood pressure phenotype', '혈압상승 표현형', 'clinical_concept', 'HTN'),
('HTN:HTN_00000015', 'HTN', 'documented hypertensive phenotype', '진단된 고혈압 표현형', 'clinical_concept', 'HTN'),
('HTN:HTN_00000003', 'HTN', 'stage 1 elevated adult systolic blood pressure meaurement datum per ACC 2017 guidelines', 'ACC 2017 기준 1단계 수축기혈압 상승', 'clinical_concept', 'HTN'),
('HTN:HTN_00000044', 'HTN', 'stage 1 elevated adult diastolic blood pressure measurement datum per 2017 guidelines', '2017 가이드라인 기준 1단계 확장기혈압 상승', 'clinical_concept', 'HTN'),
('HTN:HTN_00000040', 'HTN', 'stage 1 adult blood pressure measurement datum per 2017 guidelines', '2017 가이드라인 기준 1단계 혈압', 'clinical_concept', 'HTN'),
('HTN:HTN_00000046', 'HTN', 'stage 2 adult blood pressure measurement datum per 2017 guidelines', '2017 가이드라인 기준 2단계 혈압', 'clinical_concept', 'HTN'),
('DMTO:DDO_0000004', 'DMTO', 'diabetes diagnosis', '당뇨병 진단', 'clinical_concept', 'DM'),
('DMTO:DDO_0000112', 'DMTO', 'diabetes complication', '당뇨병 합병증', 'clinical_concept', 'DM'),
('DMTO:DDO_0000222', 'DMTO', 'diabetic ketoacidosis', '당뇨병성 케톤산증', 'clinical_concept', 'DM'),
('DMTO:DDO_0000227', 'DMTO', 'hypoglycemic coma', '저혈당성 혼수', 'clinical_concept', 'DM'),
('DMTO:DDO_0000228', 'DMTO', 'hypoglycemia', '저혈당', 'clinical_concept', 'DM'),
('DMTO:DDO_0000233', 'DMTO', 'history of prediabetes', '전당뇨 과거력', 'clinical_concept', 'DM'),
('DMTO:DDO_0000235', 'DMTO', 'history of gestational diabetes', '임신당뇨병 과거력', 'clinical_concept', 'DM'),
('DMTO:DDO_0000242', 'DMTO', 'blood glucose test', '혈당 검사', 'clinical_concept', 'DM'),
('DMTO:DDO_0000252', 'DMTO', 'Glycated haemoglobin - Hbg', '당화혈색소(HbA1c)', 'clinical_concept', 'DM'),
('DMTO:DDO_0000362', 'DMTO', 'family history of type 1 diabetes mellitus', '제1형 당뇨병 가족력', 'clinical_concept', 'DM'),
('DMTO:DDO_0000391', 'DMTO', 'family history of type 2 diabetes mellitus', '제2형 당뇨병 가족력', 'clinical_concept', 'DM'),
('DMTO:DDO_0000392', 'DMTO', 'impaired glucose tolerance in pregnancy', '임신 중 내당능장애', 'clinical_concept', 'DM'),
('DMTO:DDO_0000393', 'DMTO', 'impaired fasting glycaemia', '공복혈당장애', 'clinical_concept', 'DM'),
('DMTO:DDO_0000428', 'DMTO', 'impaired glucose tolerance', '내당능장애', 'clinical_concept', 'DM'),
('DMTO:DDO_0002292', 'DMTO', 'foot ulcer due to type 1 diabetes mellitus', '제1형 당뇨병으로 인한 족부궤양', 'clinical_concept', 'DM'),
('DMTO:DDO_0003905', 'DMTO', 'type 2 diabetes mellitus', '제2형 당뇨병', 'clinical_concept', 'DM'),
('DMTO:DD_0002293', 'DMTO', 'foot ulcer due to type 2 diabetes mellitus', '제2형 당뇨병으로 인한 족부궤양', 'clinical_concept', 'DM'),
('DMTO:DDO_0010008', 'DMTO', 'gestational diabetes mellitus', '임신당뇨병', 'clinical_concept', 'DM'),
('DMTO:DMTO_0001817', 'DMTO', 'diabetic ketoacidosis without coma', '혼수 없는 당뇨병성 케톤산증', 'clinical_concept', 'DM'),
('DMTO:DMTO_0001818', 'DMTO', 'ketoacidosis in type 2 diabetes mellitus', '제2형 당뇨병의 케톤산증', 'clinical_concept', 'DM'),
('CDPEO:Age', 'CDPEO', 'Age', '연령', 'risk_factor_class', NULL),
('CDPEO:AntiHypetensiveDrug', 'CDPEO', 'AntiHypetensiveDrug', '항고혈압제', 'risk_factor_class', NULL),
('CDPEO:BloodGlucose', 'CDPEO', 'BloodGlucose', '혈당', 'risk_factor_class', NULL),
('CDPEO:BloodPressure', 'CDPEO', 'BloodPressure', '혈압', 'risk_factor_class', NULL),
('CDPEO:BodyMassIndex', 'CDPEO', 'BodyMassIndex', '체질량지수(BMI)', 'risk_factor_class', NULL),
('CDPEO:ChronicDisease', 'CDPEO', 'ChronicDisease', '만성질환', 'risk_factor_class', NULL),
('CDPEO:ChronicObstructivePulmonaryDisease', 'CDPEO', 'ChronicObstructivePulmonaryDisease', '만성폐쇄성폐질환(COPD)', 'risk_factor_class', NULL),
('CDPEO:Complication', 'CDPEO', 'Complication', '합병증', 'risk_factor_class', NULL),
('CDPEO:CoronaryHeartDisease', 'CDPEO', 'CoronaryHeartDisease', '관상동맥질환', 'risk_factor_class', NULL),
('CDPEO:Demographic', 'CDPEO', 'Demographic', '인구통계학적 요인', 'risk_factor_class', NULL),
('CDPEO:Diabetes', 'CDPEO', 'Diabetes', '당뇨병', 'risk_factor_class', NULL),
('CDPEO:Diet', 'CDPEO', 'Diet', '식이', 'risk_factor_class', NULL),
('CDPEO:Disease', 'CDPEO', 'Disease', '질환', 'risk_factor_class', NULL),
('CDPEO:Drinking', 'CDPEO', 'Drinking', '음주', 'risk_factor_class', NULL),
('CDPEO:Education', 'CDPEO', 'Education', '교육수준', 'risk_factor_class', NULL),
('CDPEO:Exercise', 'CDPEO', 'Exercise', '운동', 'risk_factor_class', NULL),
('CDPEO:EyeDisease', 'CDPEO', 'EyeDisease', '안과질환(합병증)', 'risk_factor_class', NULL),
('CDPEO:Gender', 'CDPEO', 'Gender', '성별', 'risk_factor_class', NULL),
('CDPEO:Hyperlipidemia', 'CDPEO', 'Hyperlipidemia', '이상지질혈증', 'risk_factor_class', NULL)
ON CONFLICT (global_id) DO NOTHING;

INSERT INTO concept_registry (global_id, source, label_en, label_ko, kind, category) VALUES
('CDPEO:Hypertension', 'CDPEO', 'Hypertension', '고혈압', 'risk_factor_class', NULL),
('CDPEO:HypoglycemicDrug', 'CDPEO', 'HypoglycemicDrug', '혈당강하제', 'risk_factor_class', NULL),
('CDPEO:HypolipidemicDrug', 'CDPEO', 'HypolipidemicDrug', '지질강하제', 'risk_factor_class', NULL),
('CDPEO:KidneyDisease', 'CDPEO', 'KidneyDisease', '신장질환(합병증)', 'risk_factor_class', NULL),
('CDPEO:Lifestyle', 'CDPEO', 'Lifestyle', '생활습관', 'risk_factor_class', NULL),
('CDPEO:Lipoprotein', 'CDPEO', 'Lipoprotein', '지단백(HDL/LDL)', 'risk_factor_class', NULL),
('CDPEO:LiverDisease', 'CDPEO', 'LiverDisease', '간질환(합병증)', 'risk_factor_class', NULL),
('CDPEO:LungDisease', 'CDPEO', 'LungDisease', '폐질환(합병증)', 'risk_factor_class', NULL),
('CDPEO:Medication', 'CDPEO', 'Medication', '복약', 'risk_factor_class', NULL),
('CDPEO:Mentality', 'CDPEO', 'Mentality', '정신건강(우울 등)', 'risk_factor_class', NULL),
('CDPEO:Occupation', 'CDPEO', 'Occupation', '직업', 'risk_factor_class', NULL),
('CDPEO:PatientProfile', 'CDPEO', 'PatientProfile', '환자 프로필', 'risk_factor_class', NULL),
('CDPEO:PhysiologicalIndex', 'CDPEO', 'PhysiologicalIndex', '생리지표', 'risk_factor_class', NULL),
('CDPEO:Pregnancy', 'CDPEO', 'Pregnancy', '임신', 'risk_factor_class', NULL),
('CDPEO:SkinDisease', 'CDPEO', 'SkinDisease', '피부질환(합병증)', 'risk_factor_class', NULL),
('CDPEO:Smoking', 'CDPEO', 'Smoking', '흡연', 'risk_factor_class', NULL),
('CDPEO:StomachDisease', 'CDPEO', 'StomachDisease', '위장질환(합병증)', 'risk_factor_class', NULL),
('CDPEO:Stroke', 'CDPEO', 'Stroke', '뇌졸중', 'risk_factor_class', NULL),
('CDPEO:TotalCholesterol', 'CDPEO', 'TotalCholesterol', '총콜레스테롤', 'risk_factor_class', NULL),
('CDPEO:Triglyceride', 'CDPEO', 'Triglyceride', '중성지방', 'risk_factor_class', NULL),
('CDPEO:UricAcid', 'CDPEO', 'UricAcid', '요산', 'risk_factor_class', NULL),
('HTO:Anticonvulsant_Medications', 'HTO', 'Anticonvulsant Medications', '항경련제', 'htn_clinical_concept', 'HTN'),
('HTO:Arterial_Complications', 'HTO', 'Arterial Complications', '동맥 합병증', 'htn_clinical_concept', 'HTN'),
('HTO:Benign_Essential_Hypertension', 'HTO', 'Benign Essential Hypertension', '양성 본태성고혈압', 'htn_clinical_concept', 'HTN'),
('HTO:Benign_Hypertensive_Renal_Disease', 'HTO', 'Benign Hypertensive Renal Disease', '양성 고혈압성 신장질환', 'htn_clinical_concept', 'HTN'),
('HTO:Benign_Renovascular_Hypertension', 'HTO', 'Benign Renovascular Hypertension', '양성 신혈관성고혈압', 'htn_clinical_concept', 'HTN'),
('HTO:Benign_Secondary_Hypertension', 'HTO', 'Benign Secondary Hypertension', '양성 이차성고혈압', 'htn_clinical_concept', 'HTN'),
('HTO:Blood_Pressure-related_Symptoms', 'HTO', 'Blood Pressure-related Symptoms', '혈압 관련 증상', 'htn_clinical_concept', 'HTN'),
('HTO:Blood_Vessel_Complications', 'HTO', 'Blood Vessel Complications', '혈관 합병증', 'htn_clinical_concept', 'HTN'),
('HTO:Cardiovascular_Assesment', 'HTO', 'Cardiovascular Assesment', '심혈관 평가', 'htn_clinical_concept', 'HTN'),
('HTO:Cardiovascular_Complications', 'HTO', 'Cardiovascular Complications', '심혈관 합병증', 'htn_clinical_concept', 'HTN'),
('HTO:Cardiovascular_Conditions', 'HTO', 'Cardiovascular Conditions', '심혈관 상태', 'htn_clinical_concept', 'HTN'),
('HTO:Cardiovascular_Symptoms', 'HTO', 'Cardiovascular Symptoms', '심혈관 증상', 'htn_clinical_concept', 'HTN'),
('HTO:Cardiovascular_support', 'HTO', 'Cardiovascular support', '심혈관 지지요법', 'htn_clinical_concept', 'HTN'),
('HTO:Cerebrovascular_Complications', 'HTO', 'Cerebrovascular Complications', '뇌혈관 합병증', 'htn_clinical_concept', 'HTN'),
('HTO:Chest-related_Symptoms', 'HTO', 'Chest-related Symptoms', '가슴 관련 증상', 'htn_clinical_concept', 'HTN'),
('HTO:Circulation-related_Symptoms', 'HTO', 'Circulation-related Symptoms', '순환 관련 증상', 'htn_clinical_concept', 'HTN'),
('HTO:Circulatory_Symptoms', 'HTO', 'Circulatory Symptoms', '순환계 증상', 'htn_clinical_concept', 'HTN'),
('HTO:Cognitive-and_Mental_Symptoms', 'HTO', 'Cognitive-and Mental Symptoms', '인지·정신 증상', 'htn_clinical_concept', 'HTN'),
('HTO:Coronary_Artery-related_Complications', 'HTO', 'Coronary Artery-related Complications', '관상동맥 관련 합병증', 'htn_clinical_concept', 'HTN'),
('HTO:Corticosteriods_Medications', 'HTO', 'Corticosteriods Medications', '코르티코스테로이드제', 'htn_clinical_concept', 'HTN'),
('HTO:Diabetes', 'HTO', 'Diabetes', '당뇨병', 'htn_clinical_concept', 'HTN'),
('HTO:Diabetes_Screening_and_Monitoring', 'HTO', 'Diabetes Screening and Monitoring', '당뇨병 선별·모니터링', 'htn_clinical_concept', 'HTN'),
('HTO:Diagnostic_Imaging', 'HTO', 'Diagnostic Imaging', '영상진단', 'htn_clinical_concept', 'HTN'),
('HTO:Diagnostic_Procedure', 'HTO', 'Diagnostic Procedure', '진단 시술', 'htn_clinical_concept', 'HTN'),
('HTO:Eclampsia', 'HTO', 'Eclampsia', '자간증', 'htn_clinical_concept', 'HTN'),
('HTO:Edema_and_Swelling', 'HTO', 'Edema and Swelling', '부종', 'htn_clinical_concept', 'HTN'),
('HTO:Endocrine_Factors', 'HTO', 'Endocrine Factors', '내분비 요인', 'htn_clinical_concept', 'HTN'),
('HTO:Enviromental_Pollution_Factors', 'HTO', 'Enviromental Pollution Factors', '환경오염 요인', 'htn_clinical_concept', 'HTN'),
('HTO:Environmental_and_Occupational_Factors', 'HTO', 'Environmental and Occupational Factors', '환경·직업 요인', 'htn_clinical_concept', 'HTN'),
('HTO:Essential_Hypertension', 'HTO', 'Essential Hypertension', '본태성고혈압', 'htn_clinical_concept', 'HTN'),
('HTO:Exposure_to_Toxins', 'HTO', 'Exposure to Toxins', '독성물질 노출', 'htn_clinical_concept', 'HTN'),
('HTO:Eye_Examinations', 'HTO', 'Eye Examinations', '안과 검사', 'htn_clinical_concept', 'HTN'),
('HTO:Functional_Assesment', 'HTO', 'Functional Assesment', '기능 평가', 'htn_clinical_concept', 'HTN'),
('HTO:Gastrointestinal_Symptoms', 'HTO', 'Gastrointestinal Symptoms', '위장관 증상', 'htn_clinical_concept', 'HTN'),
('HTO:General_Medical_Care', 'HTO', 'General Medical Care', '일반 의료처치', 'htn_clinical_concept', 'HTN'),
('HTO:General_Symptoms', 'HTO', 'General Symptoms', '전신 증상', 'htn_clinical_concept', 'HTN'),
('HTO:Genetic_and_Family_History', 'HTO', 'Genetic and Family History', '유전·가족력', 'htn_clinical_concept', 'HTN'),
('HTO:Heart-related_Symptoms', 'HTO', 'Heart-related Symptoms', '심장 관련 증상', 'htn_clinical_concept', 'HTN'),
('HTO:Hospital-based_Treatments', 'HTO', 'Hospital-based Treatments', '병원 치료', 'htn_clinical_concept', 'HTN'),
('HTO:Hypertension_Causes', 'HTO', 'Hypertension Causes', '고혈압 원인', 'htn_clinical_concept', 'HTN'),
('HTO:Hypertension_Complcations', 'HTO', 'Hypertension Complcations', '고혈압 합병증', 'htn_clinical_concept', 'HTN'),
('HTO:Hypertension_Detection', 'HTO', 'Hypertension Detection', '고혈압 진단/검출', 'htn_clinical_concept', 'HTN'),
('HTO:Hypertension_Medications', 'HTO', 'Hypertension Medications', '고혈압 약물', 'htn_clinical_concept', 'HTN'),
('HTO:Hypertension_Symptoms', 'HTO', 'Hypertension Symptoms', '고혈압 증상', 'htn_clinical_concept', 'HTN'),
('HTO:Hypertension_Treatment', 'HTO', 'Hypertension Treatment', '고혈압 치료', 'htn_clinical_concept', 'HTN'),
('HTO:Hypertension_Types', 'HTO', 'Hypertension Types', '고혈압 유형', 'htn_clinical_concept', 'HTN'),
('HTO:Imaging', 'HTO', 'Imaging', '영상검사', 'htn_clinical_concept', 'HTN'),
('HTO:Infectious_Disease', 'HTO', 'Infectious Disease', '감염질환', 'htn_clinical_concept', 'HTN'),
('HTO:Inflammatory_and_Autoimmune_Factors', 'HTO', 'Inflammatory and Autoimmune Factors', '염증·자가면역 요인', 'htn_clinical_concept', 'HTN'),
('HTO:Insulin_Therapy', 'HTO', 'Insulin Therapy', '인슐린 치료', 'htn_clinical_concept', 'HTN'),
('HTO:Intravenous_Medications', 'HTO', 'Intravenous Medications', '정맥주사 약물', 'htn_clinical_concept', 'HTN'),
('HTO:Kidney_Damage', 'HTO', 'Kidney Damage', '신장 손상', 'htn_clinical_concept', 'HTN'),
('HTO:Kidney_Function', 'HTO', 'Kidney Function', '신장 기능', 'htn_clinical_concept', 'HTN'),
('HTO:Kidney_Related_Factors', 'HTO', 'Kidney Related Factors', '신장 관련 요인', 'htn_clinical_concept', 'HTN'),
('HTO:Laboratory_Test', 'HTO', 'Laboratory Test', '검사실 검사', 'htn_clinical_concept', 'HTN'),
('HTO:Lifestyle_Factors', 'HTO', 'Lifestyle Factors', '생활습관 요인', 'htn_clinical_concept', 'HTN'),
('HTO:Lifestyle_Modifications', 'HTO', 'Lifestyle Modifications', '생활습관 교정', 'htn_clinical_concept', 'HTN'),
('HTO:Liver_Related_Factors', 'HTO', 'Liver Related Factors', '간 관련 요인', 'htn_clinical_concept', 'HTN'),
('HTO:Malignant_Essential_Hypertension', 'HTO', 'Malignant Essential Hypertension', '악성 본태성고혈압', 'htn_clinical_concept', 'HTN'),
('HTO:Malignant_Hypertensive_Renal_Disease', 'HTO', 'Malignant Hypertensive Renal Disease', '악성 고혈압성 신장질환', 'htn_clinical_concept', 'HTN'),
('HTO:Malignant_Renovascular_Hypertension', 'HTO', 'Malignant Renovascular Hypertension', '악성 신혈관성고혈압', 'htn_clinical_concept', 'HTN'),
('HTO:Malignant_Secondary_Hypertension', 'HTO', 'Malignant Secondary Hypertension', '악성 이차성고혈압', 'htn_clinical_concept', 'HTN'),
('HTO:Medical_Conditions', 'HTO', 'Medical Conditions', '의학적 상태', 'htn_clinical_concept', 'HTN'),
('HTO:Medical_Treatments_Factors', 'HTO', 'Medical Treatments Factors', '의료처치 요인', 'htn_clinical_concept', 'HTN'),
('HTO:Medication', 'HTO', 'Medication', '약물(상위)', 'htn_clinical_concept', 'HTN'),
('HTO:Medications', 'HTO', 'Medications', '약물', 'htn_clinical_concept', 'HTN'),
('HTO:Metabolic_Changes', 'HTO', 'Metabolic Changes', '대사 변화', 'htn_clinical_concept', 'HTN'),
('HTO:Metabolic_Factors', 'HTO', 'Metabolic Factors', '대사 요인', 'htn_clinical_concept', 'HTN'),
('HTO:Mild_Pre-Eclampsia', 'HTO', 'Mild Pre-Eclampsia', '경증 전자간증', 'htn_clinical_concept', 'HTN'),
('HTO:Monitoring_and_Follow-up', 'HTO', 'Monitoring and Follow-up', '모니터링·추적관찰', 'htn_clinical_concept', 'HTN'),
('HTO:Mortality_and_Serious_Complications', 'HTO', 'Mortality and Serious Complications', '사망·중증합병증', 'htn_clinical_concept', 'HTN'),
('HTO:Motor_Symptoms', 'HTO', 'Motor Symptoms', '운동 증상', 'htn_clinical_concept', 'HTN'),
('HTO:Nephrosclerosis', 'HTO', 'Nephrosclerosis', '신장경화증', 'htn_clinical_concept', 'HTN'),
('HTO:Nephrotrophic_Syndrome', 'HTO', 'Nephrotrophic Syndrome', '신증후군성 증후군', 'htn_clinical_concept', 'HTN'),
('HTO:Neurological_Factors', 'HTO', 'Neurological Factors', '신경학적 요인', 'htn_clinical_concept', 'HTN'),
('HTO:Neurological_Symptoms', 'HTO', 'Neurological Symptoms', '신경학적 증상', 'htn_clinical_concept', 'HTN'),
('HTO:Neuropathic_Complications', 'HTO', 'Neuropathic Complications', '신경병증성 합병증', 'htn_clinical_concept', 'HTN'),
('HTO:Obstetric_Care', 'HTO', 'Obstetric Care', '산과 케어', 'htn_clinical_concept', 'HTN'),
('HTO:Occupational_Factors', 'HTO', 'Occupational Factors', '직업적 요인', 'htn_clinical_concept', 'HTN')
ON CONFLICT (global_id) DO NOTHING;

INSERT INTO concept_registry (global_id, source, label_en, label_ko, kind, category) VALUES
('HTO:Ophthalmic_Complications', 'HTO', 'Ophthalmic Complications', '안과 합병증', 'htn_clinical_concept', 'HTN'),
('HTO:Organ-specific_Complications', 'HTO', 'Organ-specific Complications', '장기특이적 합병증', 'htn_clinical_concept', 'HTN'),
('HTO:Other_Complication', 'HTO', 'Other Complication', '기타 합병증(단수)', 'htn_clinical_concept', 'HTN'),
('HTO:Other_Complications', 'HTO', 'Other Complications', '기타 합병증', 'htn_clinical_concept', 'HTN'),
('HTO:Other_Factors', 'HTO', 'Other Factors', '기타 요인', 'htn_clinical_concept', 'HTN'),
('HTO:Other_Symptoms', 'HTO', 'Other Symptoms', '기타 증상', 'htn_clinical_concept', 'HTN'),
('HTO:Pancreatic_Factors', 'HTO', 'Pancreatic Factors', '췌장 요인', 'htn_clinical_concept', 'HTN'),
('HTO:Perinatal_Factors', 'HTO', 'Perinatal Factors', '주산기 요인', 'htn_clinical_concept', 'HTN'),
('HTO:Persistent_Fetal_Circulation_Syndrome', 'HTO', 'Persistent Fetal Circulation Syndrome', '지속성 태아순환증후군', 'htn_clinical_concept', 'HTN'),
('HTO:Pre-Eclampsia', 'HTO', 'Pre-Eclampsia', '전자간증', 'htn_clinical_concept', 'HTN'),
('HTO:Pregnancy_Related_Factors', 'HTO', 'Pregnancy Related Factors', '임신 관련 요인', 'htn_clinical_concept', 'HTN'),
('HTO:Pregnancy_and_Birth-related-complications', 'HTO', 'Pregnancy and Birth-related-complications', '임신·출산 관련 합병증', 'htn_clinical_concept', 'HTN'),
('HTO:Proteinuria', 'HTO', 'Proteinuria', '단백뇨', 'htn_clinical_concept', 'HTN'),
('HTO:Pulmonary_Complications', 'HTO', 'Pulmonary Complications', '폐 합병증', 'htn_clinical_concept', 'HTN'),
('HTO:Pulmonary_Hypertension', 'HTO', 'Pulmonary Hypertension', '폐고혈압', 'htn_clinical_concept', 'HTN'),
('HTO:Pulmonary_Venoocclusive_Disease', 'HTO', 'Pulmonary Venoocclusive Disease', '폐정맥폐쇄병', 'htn_clinical_concept', 'HTN'),
('HTO:Reanl_Symptoms', 'HTO', 'Reanl Symptoms', '신장 증상', 'htn_clinical_concept', 'HTN'),
('HTO:Renal_Assesment', 'HTO', 'Renal Assesment', '신장 평가', 'htn_clinical_concept', 'HTN'),
('HTO:Renal_Care', 'HTO', 'Renal Care', '신장 관리', 'htn_clinical_concept', 'HTN'),
('HTO:Renal_Complicaion', 'HTO', 'Renal Complicaion', '신장 합병증', 'htn_clinical_concept', 'HTN'),
('HTO:Renal_Failure', 'HTO', 'Renal Failure', '신부전', 'htn_clinical_concept', 'HTN'),
('HTO:Renal_Hypertension', 'HTO', 'Renal Hypertension', '신성고혈압', 'htn_clinical_concept', 'HTN'),
('HTO:Renal_Related_Factors', 'HTO', 'Renal Related Factors', '신장 관련 요인', 'htn_clinical_concept', 'HTN'),
('HTO:Renovascular_Hypertension', 'HTO', 'Renovascular Hypertension', '신혈관성고혈압', 'htn_clinical_concept', 'HTN'),
('HTO:Respiratory_Factors', 'HTO', 'Respiratory Factors', '호흡기 요인', 'htn_clinical_concept', 'HTN'),
('HTO:Respiratory_Support', 'HTO', 'Respiratory Support', '호흡 지지요법', 'htn_clinical_concept', 'HTN'),
('HTO:Respiratory_Symptoms', 'HTO', 'Respiratory Symptoms', '호흡기 증상', 'htn_clinical_concept', 'HTN'),
('HTO:Retinal_Complications', 'HTO', 'Retinal Complications', '망막 합병증', 'htn_clinical_concept', 'HTN'),
('HTO:Secondary_Hypertension', 'HTO', 'Secondary Hypertension', '이차성고혈압', 'htn_clinical_concept', 'HTN'),
('HTO:Sensory_Symptoms', 'HTO', 'Sensory Symptoms', '감각 증상', 'htn_clinical_concept', 'HTN'),
('HTO:Severe_Pre-Eclampsia', 'HTO', 'Severe Pre-Eclampsia', '중증 전자간증', 'htn_clinical_concept', 'HTN'),
('HTO:Surgical_Interventions', 'HTO', 'Surgical Interventions', '수술적 치료', 'htn_clinical_concept', 'HTN'),
('HTO:Urinary_Changes', 'HTO', 'Urinary Changes', '소변 변화', 'htn_clinical_concept', 'HTN'),
('HTO:Vascular_Factors', 'HTO', 'Vascular Factors', '혈관 요인', 'htn_clinical_concept', 'HTN'),
('HTO:Visual_Symptoms', 'HTO', 'Visual Symptoms', '시각 증상', 'htn_clinical_concept', 'HTN'),
('콩팥병::ckd', 'ObsidianNote', NULL, '콩팥병(CKD)', 'note', '콩팥병'),
('콩팥병::rel1', 'ObsidianNote', NULL, '당뇨병(DM)', 'note', '콩팥병'),
('콩팥병::rel2', 'ObsidianNote', NULL, '고혈압(HTN)', 'note', '콩팥병'),
('콩팥병::hospital_capability', 'ObsidianNote', NULL, '병원역량(HospitalCapability)', 'note', '콩팥병'),
('당뇨병::dm', 'ObsidianNote', NULL, '당뇨병(DM)', 'note', '당뇨병'),
('당뇨병::rel1', 'ObsidianNote', NULL, '고혈압(HTN)', 'note', '당뇨병'),
('당뇨병::dep1', 'ObsidianNote', NULL, '콩팥병(CKD)', 'note', '당뇨병'),
('고혈압::htn', 'ObsidianNote', NULL, '고혈압(HTN)', 'note', '고혈압'),
('고혈압::rel1', 'ObsidianNote', NULL, '당뇨병(DM)', 'note', '고혈압'),
('고혈압::dep1', 'ObsidianNote', NULL, '콩팥병(CKD)', 'note', '고혈압'),
('통합::dm', 'ObsidianNote', NULL, '당뇨병(DM)', 'note', '통합'),
('통합::htn', 'ObsidianNote', NULL, '고혈압(HTN)', 'note', '통합'),
('통합::ckd', 'ObsidianNote', NULL, '콩팥병(CKD)', 'note', '통합'),
('통합::loop', 'ObsidianNote', NULL, '관계_당뇨병_고혈압_콩팥병_악순환', 'note', '통합'),
('통합::rel_dm_ckd', 'ObsidianNote', NULL, '관계_당뇨병_콩팥병', 'note', '통합'),
('통합::rel_htn_ckd', 'ObsidianNote', NULL, '관계_고혈압_콩팥병', 'note', '통합'),
('통합::rel_dm_htn', 'ObsidianNote', NULL, '관계_당뇨병_고혈압', 'note', '통합'),
('통합::egfr', 'ObsidianNote', NULL, 'eGFR 계산(CKD-EPI 2021)', 'note', '통합'),
('통합::labtest', 'ObsidianNote', NULL, '임상지표(eGFR·ACR·HbA1c·혈압)', 'note', '통합'),
('통합::raas', 'ObsidianNote', NULL, 'RAAS억제제(ACEi·ARB)', 'note', '통합'),
('통합::sglt2', 'ObsidianNote', NULL, 'SGLT2억제제', 'note', '통합'),
('통합::welfare', 'ObsidianNote', NULL, '장애인등록 및 복지혜택', 'note', '통합')
ON CONFLICT (global_id) DO NOTHING;

INSERT INTO concept_same_as (concept_a, concept_b, matched_by, label_ko) VALUES
('DOID:1074', 'HTO:Renal_Failure', 'exact_korean_label', '신부전'),
('DOID:9352', 'DMTO:DDO_0003905', 'exact_korean_label', '제2형 당뇨병'),
('DOID:10823', 'HTO:Malignant_Essential_Hypertension', 'exact_korean_label', '악성 본태성고혈압'),
('DOID:10825', 'HTO:Essential_Hypertension', 'exact_korean_label', '본태성고혈압'),
('DOID:10913', 'HTO:Benign_Essential_Hypertension', 'exact_korean_label', '양성 본태성고혈압'),
('HP:0001953', 'DMTO:DDO_0000222', 'exact_korean_label', '당뇨병성 케톤산증'),
('CDPEO:Diabetes', 'HTO:Diabetes', 'exact_korean_label', '당뇨병'),
('HTO:Kidney_Related_Factors', 'HTO:Renal_Related_Factors', 'exact_korean_label', '신장 관련 요인'),
('콩팥병::ckd', '당뇨병::dep1', 'exact_korean_label', '콩팥병(CKD)'),
('콩팥병::ckd', '고혈압::dep1', 'exact_korean_label', '콩팥병(CKD)'),
('콩팥병::ckd', '통합::ckd', 'exact_korean_label', '콩팥병(CKD)'),
('당뇨병::dep1', '고혈압::dep1', 'exact_korean_label', '콩팥병(CKD)'),
('당뇨병::dep1', '통합::ckd', 'exact_korean_label', '콩팥병(CKD)'),
('고혈압::dep1', '통합::ckd', 'exact_korean_label', '콩팥병(CKD)'),
('콩팥병::rel1', '당뇨병::dm', 'exact_korean_label', '당뇨병(DM)'),
('콩팥병::rel1', '고혈압::rel1', 'exact_korean_label', '당뇨병(DM)'),
('콩팥병::rel1', '통합::dm', 'exact_korean_label', '당뇨병(DM)'),
('당뇨병::dm', '고혈압::rel1', 'exact_korean_label', '당뇨병(DM)'),
('당뇨병::dm', '통합::dm', 'exact_korean_label', '당뇨병(DM)'),
('고혈압::rel1', '통합::dm', 'exact_korean_label', '당뇨병(DM)'),
('콩팥병::rel2', '당뇨병::rel1', 'exact_korean_label', '고혈압(HTN)'),
('콩팥병::rel2', '고혈압::htn', 'exact_korean_label', '고혈압(HTN)'),
('콩팥병::rel2', '통합::htn', 'exact_korean_label', '고혈압(HTN)'),
('당뇨병::rel1', '고혈압::htn', 'exact_korean_label', '고혈압(HTN)'),
('당뇨병::rel1', '통합::htn', 'exact_korean_label', '고혈압(HTN)'),
('고혈압::htn', '통합::htn', 'exact_korean_label', '고혈압(HTN)'),
('콩팥병::ckd', 'DOID:784', 'manual_curation', '콩팥병(CKD) = 만성콩팥병'),
('당뇨병::dm', 'DOID:9352', 'manual_curation', '당뇨병(DM) 노트 = 제2형 당뇨병 대표코드'),
('고혈압::htn', 'DOID:10825', 'manual_curation', '고혈압(HTN) 노트 = 본태성고혈압 대표코드'),
('콩팥병::ckd', 'HTO:Renal_Failure', 'manual_curation', '콩팥병 진행 시 신부전과 연관');

INSERT INTO korean_colloquial_index (colloquial_term, mapped_ids) VALUES
('콩팥병', ARRAY['DOID:784','콩팥병::ckd','CKDO:CKD_KDIGO_stages_1-5']),
('콩팥 4기', ARRAY['CKDO:CKD_KDIGO_stages_1-5','DOID:784']),
('신장병', ARRAY['DOID:784','콩팥병::ckd']),
('투석', ARRAY['CKDO:Haemodialysis','CKDO:Peritoneal_dialysis','HTO:Dialysis']),
('혈액투석', ARRAY['CKDO:Haemodialysis']),
('복막투석', ARRAY['CKDO:Peritoneal_dialysis']),
('야간투석', ARRAY['CKDO:Haemodialysis']),
('소변에 거품', ARRAY['HP:0033066','HP:0012593','HTO:Protine_in_the_Urine']),
('단백뇨', ARRAY['HP:0033066','HP:0012593','HTO:Protine_in_the_Urine']),
('당뇨', ARRAY['DOID:9352','DMTO:DDO_0003905','당뇨병::dm','CDPEO:Diabetes','HTO:Diabetes']),
('당뇨병', ARRAY['DOID:9352','DMTO:DDO_0003905','당뇨병::dm','CDPEO:Diabetes','HTO:Diabetes']),
('혈당 높다', ARRAY['HP:0011998','DDO_0000242','D08','D09','D10']),
('저혈당', ARRAY['DMTO:DDO_0000228','DMTO:DDO_0000227']),
('당화혈색소', ARRAY['DMTO:DDO_0000252','HTO:Hemoglobin_A1C']),
('고혈압', ARRAY['DOID:10825','고혈압::htn','CDPEO:Hypertension','HTO:Essential_Hypertension']),
('혈압 높다', ARRAY['HTN:HTN_00000014','HTO:High_Blood_Pressure','D01','D02','D03']),
('발 저림', ARRAY['DOID:9743','HP:0012398']),
('발이 부어요', ARRAY['HP:0012398','HTO:Edema_and_Swelling']),
('우울', ARRAY['CDPEO:Mentality','C01','C02','C03','C04','C05']),
('족부궤양', ARRAY['DMTO:DDO_0002292','DD_0002293','HTO:Foot_Ulcers']),
('케톤산증', ARRAY['DOID:1953','DMTO:DDO_0000222','DMTO:DMTO_0001817']),
('임신당뇨', ARRAY['DDO_0010008','DDO_0000235']),
('신장이식', ARRAY['CKDO:Renal_transplantation','HTO:Kidney_Transplant'])
ON CONFLICT (colloquial_term) DO NOTHING;

-- =========================================================
-- 통합 검색 RPC: 한국어 발화 한 번으로 7개 소스 전체 검색
-- =========================================================

CREATE OR REPLACE FUNCTION search_korean_concept(query_text TEXT)
RETURNS TABLE(global_id TEXT, source TEXT, label_ko TEXT, kind TEXT, matched_via TEXT)
LANGUAGE SQL AS $$
  -- 1) 구어체 동의어 사전 우선 매칭
  SELECT cr.global_id, cr.source, cr.label_ko, cr.kind, 'colloquial'::TEXT AS matched_via
  FROM korean_colloquial_index kci
  JOIN concept_registry cr ON cr.global_id = ANY(kci.mapped_ids)
  WHERE kci.colloquial_term = query_text

  UNION

  -- 2) 표준 한글라벨 직접/부분 매칭
  SELECT cr.global_id, cr.source, cr.label_ko, cr.kind, 'direct_label'::TEXT AS matched_via
  FROM concept_registry cr
  WHERE cr.label_ko ILIKE '%' || query_text || '%'

  UNION

  -- 3) same_as로 연결된 동치 개념까지 확장
  SELECT cr2.global_id, cr2.source, cr2.label_ko, cr2.kind, 'same_as_expansion'::TEXT AS matched_via
  FROM concept_registry cr1
  JOIN concept_same_as sa ON sa.concept_a = cr1.global_id OR sa.concept_b = cr1.global_id
  JOIN concept_registry cr2 ON cr2.global_id = (CASE WHEN sa.concept_a = cr1.global_id THEN sa.concept_b ELSE sa.concept_a END)
  WHERE cr1.label_ko ILIKE '%' || query_text || '%';
$$;

-- 조회 예시: 사용자가 '콩팥병'이라고 발화 -> 7개 소스 전체에서 관련 개념 한 번에 검색
-- SELECT * FROM search_korean_concept('콩팥병');