-- =========================================================
-- 콩당콩당 - 확장 온톨로지 (CKDO, HTN, DMTO)
-- 출처:
--   CKDO: http://clininf.eu/ckdo (CKD Ontology alpha v2, 2017-07-01)
--         BioPortal: https://bioportal.bioontology.org/ontologies/CKDO
--   HTN : https://github.com/aellenhicks/htn_owl (HTN_ 네임스페이스, ACC 2017 가이드라인 기반 혈압 병기)
--   DMTO: https://bioportal.bioontology.org/ontologies/DMTO (DMTO 1.0, DDO 서브셋 포함)
--
-- DOID/HP(01_ontology_intent_disease_concept.sql)와의 차이:
--   DOID/HP는 '진단명/표현형' 수준의 일반 표준 코드인 반면,
--   이 확장 온톨로지들은 실제 임상 실무(투석방식·접근로·이식·혈압병기·당뇨 응급/가족력)
--   수준의 더 세부적인 개념을 제공한다.
-- =========================================================

CREATE TABLE IF NOT EXISTS extended_concepts (
  concept_id   TEXT PRIMARY KEY,   -- 'CKDO:Haemodialysis' 형식 (소스 접두사 + 원본 클래스명)
  source       TEXT NOT NULL,      -- 'CKDO' | 'HTN' | 'DMTO'
  label_en     TEXT,
  label_ko     TEXT,
  parent_class TEXT,               -- 상위 클래스 (subClassOf, CKDO만 해당)
  category     TEXT                -- 'CKD' | 'HTN' | 'DM'
);

INSERT INTO extended_concepts (concept_id, source, label_en, label_ko, parent_class, category) VALUES
('CKDO:CKD-EPI_formula', 'CKDO', 'CKD-EPI formula', 'CKD-EPI 공식', 'CKDO:eGFR', 'CKD'),
('CKDO:Dialysis_adequacy_test', 'CKDO', 'Dialysis adequacy test', '투석 적정성 검사', 'CKDO:Laboratory_tests', 'CKD'),
('CKDO:Dialysis_recirculation_syndrome', 'CKDO', 'Dialysis recirculation syndrome', '투석 재순환 증후군', 'CKDO:Complications_associated_with_haemodialysis', 'CKD'),
('CKDO:Dialysis_related_amyloidosis', 'CKDO', 'Dialysis related amyloidosis', '투석 관련 아밀로이드증', 'CKDO:Complications_associated_with_haemodialysis', 'CKD'),
('CKDO:History_of_CKD', 'CKDO', 'History of CKD', 'CKD 과거력', 'CKDO:Past_medical_history', 'CKD'),
('CKDO:History_of_renal_transplantation', 'CKDO', 'History of renal transplantation', '신장이식 과거력', 'CKDO:Past_medical_history', 'CKD'),
('CKDO:Isotopic_eGFR', 'CKDO', 'Isotopic eGFR', '동위원소법 eGFR', 'CKDO:eGFR', 'CKD'),
('CKDO:Monitoring_of_CKD', 'CKDO', 'Monitoring of CKD', 'CKD 모니터링', 'CKDO:Process_of_care', 'CKD'),
('CKDO:Peritoneal_leak_in_peritoneal_dialysis', 'CKDO', 'Peritoneal leak in peritoneal dialysis', '복막투석 중 복막 누출', 'CKDO:Complications_associated_with_peritoneal_dialysis', 'CKD'),
('CKDO:Renal_transplant_procedure', 'CKDO', 'Renal transplant procedure', '신장이식 시술', 'CKDO:Procedures', 'CKD'),
('CKDO:Renal_transplantation', 'CKDO', 'Renal transplantation', '신장이식', 'CKDO:Procedures', 'CKD'),
('CKDO:eGFR', 'CKDO', 'eGFR', '사구체여과율 추정치(eGFR)', 'CKDO:Estimations_of_renal_function', 'CKD'),
('CKDO:Arteriovenous_fistula_for_haemodialysis', 'CKDO', 'Arteriovenous fistula for haemodialysis', '혈액투석용 동정맥누공(AVF)', 'CKDO:Dialysis_access', 'CKD'),
('CKDO:Arteriovenous_graft_for_haemodialysis', 'CKDO', 'Arteriovenous graft for haemodialysis', '혈액투석용 동정맥이식편(AVG)', 'CKDO:Dialysis_access', 'CKD'),
('CKDO:Assisted_peritoneal_dialysis', 'CKDO', 'Assisted peritoneal dialysis', '보조복막투석', 'CKDO:Peritoneal_dialysis', 'CKD'),
('CKDO:Automatic_peritoneal_dialysis', 'CKDO', 'Automatic peritoneal dialysis', '자동복막투석(APD)', 'CKDO:Peritoneal_dialysis', 'CKD'),
('CKDO:CKD_KDIGO_stages_1-5', 'CKDO', 'CKD KDIGO stages 1-5', 'CKD KDIGO 병기(1~5단계)', 'CKDO:CKD_defined_by_stage', 'CKD'),
('CKDO:CKD_defined_by_stage', 'CKDO', 'CKD defined by stage', '병기로 정의된 CKD', 'CKDO:CKD_of_unspecified_aetiology', 'CKD'),
('CKDO:Complications_associated_with_haemodialysis', 'CKDO', 'Complications associated with haemodialysis', '혈액투석 관련 합병증', 'CKDO:Complications_of_care', 'CKD'),
('CKDO:Complications_associated_with_peritoneal_dialysis', 'CKDO', 'Complications associated with peritoneal dialysis', '복막투석 관련 합병증', 'CKDO:Complications_of_care', 'CKD'),
('CKDO:Declining_renal_graft_function', 'CKDO', 'Declining renal graft function', '이식신 기능 저하', 'CKDO:Complications_associated_with_renal_transplant', 'CKD'),
('CKDO:Haemodialysis', 'CKDO', 'Haemodialysis', '혈액투석', 'CKDO:Dialysis', 'CKD'),
('CKDO:Peritoneal_dialysis', 'CKDO', 'Peritoneal dialysis', '복막투석', 'CKDO:Dialysis', 'CKD'),
('CKDO:Tunnelled_venous_catheter_for_haemodialysis', 'CKDO', 'Tunnelled venous catheter for haemodialysis', '혈액투석용 터널형 정맥카테터', 'CKDO:Dialysis_access', 'CKD'),
('CKDO:Peritoneal_dialysis_(Tenckhoff)_catheter', 'CKDO', 'Peritoneal dialysis (Tenckhoff) catheter', '복막투석용 텐코프 카테터', 'CKDO:Dialysis_access', 'CKD'),
('HTN:HTN_00000000', 'HTN', 'diastolic blood pressure measurement datum', '확장기혈압 측정값', NULL, 'HTN'),
('HTN:HTN_00000001', 'HTN', 'systolic blood pressure measurement datum', '수축기혈압 측정값', NULL, 'HTN'),
('HTN:HTN_00000014', 'HTN', 'elevated blood pressure phenotype', '혈압상승 표현형', NULL, 'HTN'),
('HTN:HTN_00000015', 'HTN', 'documented hypertensive phenotype', '진단된 고혈압 표현형', NULL, 'HTN'),
('HTN:HTN_00000003', 'HTN', 'stage 1 elevated adult systolic blood pressure meaurement datum per ACC 2017 guidelines', 'ACC 2017 기준 1단계 수축기혈압 상승', NULL, 'HTN'),
('HTN:HTN_00000044', 'HTN', 'stage 1 elevated adult diastolic blood pressure measurement datum per 2017 guidelines', '2017 가이드라인 기준 1단계 확장기혈압 상승', NULL, 'HTN'),
('HTN:HTN_00000040', 'HTN', 'stage 1 adult blood pressure measurement datum per 2017 guidelines', '2017 가이드라인 기준 1단계 혈압', NULL, 'HTN'),
('HTN:HTN_00000046', 'HTN', 'stage 2 adult blood pressure measurement datum per 2017 guidelines', '2017 가이드라인 기준 2단계 혈압', NULL, 'HTN'),
('DMTO:DDO_0000004', 'DMTO', 'diabetes diagnosis', '당뇨병 진단', NULL, 'DM'),
('DMTO:DDO_0000112', 'DMTO', 'diabetes complication', '당뇨병 합병증', NULL, 'DM'),
('DMTO:DDO_0000222', 'DMTO', 'diabetic ketoacidosis', '당뇨병성 케톤산증', NULL, 'DM'),
('DMTO:DDO_0000227', 'DMTO', 'hypoglycemic coma', '저혈당성 혼수', NULL, 'DM'),
('DMTO:DDO_0000228', 'DMTO', 'hypoglycemia', '저혈당', NULL, 'DM'),
('DMTO:DDO_0000233', 'DMTO', 'history of prediabetes', '전당뇨 과거력', NULL, 'DM'),
('DMTO:DDO_0000235', 'DMTO', 'history of gestational diabetes', '임신당뇨병 과거력', NULL, 'DM'),
('DMTO:DDO_0000242', 'DMTO', 'blood glucose test', '혈당 검사', NULL, 'DM'),
('DMTO:DDO_0000252', 'DMTO', 'Glycated haemoglobin - Hbg', '당화혈색소(HbA1c)', NULL, 'DM'),
('DMTO:DDO_0000362', 'DMTO', 'family history of type 1 diabetes mellitus', '제1형 당뇨병 가족력', NULL, 'DM'),
('DMTO:DDO_0000391', 'DMTO', 'family history of type 2 diabetes mellitus', '제2형 당뇨병 가족력', NULL, 'DM'),
('DMTO:DDO_0000392', 'DMTO', 'impaired glucose tolerance in pregnancy', '임신 중 내당능장애', NULL, 'DM'),
('DMTO:DDO_0000393', 'DMTO', 'impaired fasting glycaemia', '공복혈당장애', NULL, 'DM'),
('DMTO:DDO_0000428', 'DMTO', 'impaired glucose tolerance', '내당능장애', NULL, 'DM'),
('DMTO:DDO_0002292', 'DMTO', 'foot ulcer due to type 1 diabetes mellitus', '제1형 당뇨병으로 인한 족부궤양', NULL, 'DM'),
('DMTO:DDO_0003905', 'DMTO', 'type 2 diabetes mellitus', '제2형 당뇨병', NULL, 'DM'),
('DMTO:DD_0002293', 'DMTO', 'foot ulcer due to type 2 diabetes mellitus', '제2형 당뇨병으로 인한 족부궤양', NULL, 'DM'),
('DMTO:DDO_0010008', 'DMTO', 'gestational diabetes mellitus', '임신당뇨병', NULL, 'DM'),
('DMTO:DMTO_0001817', 'DMTO', 'diabetic ketoacidosis without coma', '혼수 없는 당뇨병성 케톤산증', NULL, 'DM'),
('DMTO:DMTO_0001818', 'DMTO', 'ketoacidosis in type 2 diabetes mellitus', '제2형 당뇨병의 케톤산증', NULL, 'DM')
ON CONFLICT (concept_id) DO NOTHING;
