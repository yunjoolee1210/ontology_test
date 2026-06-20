// =========================================================
// 콩당콩당 - 옵시디언 캔버스 온톨로지 -> Neo4j 변환
// 원본: 콩팥병/당뇨병/고혈압/통합 _온톨로지_관계도.canvas
// =========================================================

CREATE CONSTRAINT concept_id_unique IF NOT EXISTS
FOR (c:Concept) REQUIRE c.concept_id IS UNIQUE;

// -------------------------
// Concept 노드 (캔버스 노드 86개)
// -------------------------
MERGE (c:Concept {concept_id: "콩팥병::ckd"})
  SET c.label = "콩팥병(CKD)", c.domain = "콩팥병", c.canvas_node_type = "file";
MERGE (c:Concept {concept_id: "콩팥병::super1"})
  SET c.label = "만성질환", c.domain = "콩팥병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "콩팥병::super2"})
  SET c.label = "콩팥(신장) 질환", c.domain = "콩팥병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "콩팥병::sub1"})
  SET c.label = "말기콩팥병(ESKD)", c.domain = "콩팥병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "콩팥병::sub2"})
  SET c.label = "당뇨병성콩팥병(DKD)", c.domain = "콩팥병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "콩팥병::sub3"})
  SET c.label = "고혈압성신장병", c.domain = "콩팥병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "콩팥병::part1"})
  SET c.label = "사구체(glomerulus)", c.domain = "콩팥병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "콩팥병::part2"})
  SET c.label = "세뇨관", c.domain = "콩팥병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "콩팥병::part3"})
  SET c.label = "eGFR(사구체여과율)", c.domain = "콩팥병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "콩팥병::part4"})
  SET c.label = "알부민-크레아티닌비(ACR)", c.domain = "콩팥병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "콩팥병::rel1"})
  SET c.label = "당뇨병(DM)", c.domain = "콩팥병", c.canvas_node_type = "file";
MERGE (c:Concept {concept_id: "콩팥병::rel2"})
  SET c.label = "고혈압(HTN)", c.domain = "콩팥병", c.canvas_node_type = "file";
MERGE (c:Concept {concept_id: "콩팥병::rel3"})
  SET c.label = "심혈관질환", c.domain = "콩팥병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "콩팥병::contrast1"})
  SET c.label = "급성신손상(AKI)", c.domain = "콩팥병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "콩팥병::dep1"})
  SET c.label = "사구체여과율(GFR) 측정", c.domain = "콩팥병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "콩팥병::dep2"})
  SET c.label = "알부민뇨(ACR) 측정", c.domain = "콩팥병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "콩팥병::doid_ckd"})
  SET c.label = "만성콩팥병(CKD) DOID:784", c.domain = "콩팥병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "콩팥병::doid_eskd"})
  SET c.label = "말기콩팥병(ESKD) DOID:783", c.domain = "콩팥병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "콩팥병::doid_aki"})
  SET c.label = "급성신손상 DOID:3021", c.domain = "콩팥병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "콩팥병::doid_kf"})
  SET c.label = "신부전 DOID:1074", c.domain = "콩팥병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "콩팥병::hp_gfr"})
  SET c.label = "사구체여과율(GFR) 저하 HP:0012213", c.domain = "콩팥병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "콩팥병::hp_edema"})
  SET c.label = "말초부종 HP:0012398", c.domain = "콩팥병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "콩팥병::hp_alb_mild"})
  SET c.label = "경증 알부민뇨 HP:0033065", c.domain = "콩팥병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "콩팥병::hp_alb_severe"})
  SET c.label = "중증 알부민뇨 HP:0033066", c.domain = "콩팥병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "콩팥병::hp_hyperk"})
  SET c.label = "증상성 고칼륨혈증 HP:6000833", c.domain = "콩팥병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::dm"})
  SET c.label = "당뇨병(DM)", c.domain = "당뇨병", c.canvas_node_type = "file";
MERGE (c:Concept {concept_id: "당뇨병::super1"})
  SET c.label = "대사질환", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::super2"})
  SET c.label = "만성질환", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::sub1"})
  SET c.label = "1형당뇨병", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::sub2"})
  SET c.label = "2형당뇨병", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::sub3"})
  SET c.label = "기타 당뇨병", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::sub4"})
  SET c.label = "임신당뇨병", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::part1"})
  SET c.label = "췌장 베타세포", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::part2"})
  SET c.label = "인슐린", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::part3"})
  SET c.label = "혈당 (공복혈당/식후혈당)", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::part4"})
  SET c.label = "당화혈색소(HbA1c)", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::rel1"})
  SET c.label = "고혈압(HTN)", c.domain = "당뇨병", c.canvas_node_type = "file";
MERGE (c:Concept {concept_id: "당뇨병::rel2"})
  SET c.label = "비만", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::rel3"})
  SET c.label = "이상지질혈증", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::contrast1"})
  SET c.label = "정상혈당", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::contrast2"})
  SET c.label = "전당뇨 (공복혈당장애·내당능장애)", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::dep1"})
  SET c.label = "콩팥병(CKD)", c.domain = "당뇨병", c.canvas_node_type = "file";
MERGE (c:Concept {concept_id: "당뇨병::dep2"})
  SET c.label = "당뇨병성망막병증", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::dep3"})
  SET c.label = "당뇨병성신경병증", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::doid_t2dm"})
  SET c.label = "제2형 당뇨병 DOID:9352", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::doid_dnp"})
  SET c.label = "당뇨신경병증 DOID:9743", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::doid_dr"})
  SET c.label = "당뇨망막병증 DOID:8947", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::doid_dr_prolif"})
  SET c.label = "증식성 당뇨망막병증 DOID:13207", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::doid_dr_bg"})
  SET c.label = "비증식성 당뇨망막병증 DOID:13208", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::hp_pphg"})
  SET c.label = "식후 고혈당 HP:0011998", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::hp_dka"})
  SET c.label = "당뇨병성 케톤산증 HP:0001953", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "당뇨병::hp_polydipsia"})
  SET c.label = "다음(물 많이 마심) HP:0001959", c.domain = "당뇨병", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "고혈압::htn"})
  SET c.label = "고혈압(HTN)", c.domain = "고혈압", c.canvas_node_type = "file";
MERGE (c:Concept {concept_id: "고혈압::super1"})
  SET c.label = "심혈관질환", c.domain = "고혈압", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "고혈압::super2"})
  SET c.label = "만성질환", c.domain = "고혈압", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "고혈압::sub1"})
  SET c.label = "1차성(본태성)고혈압", c.domain = "고혈압", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "고혈압::sub2"})
  SET c.label = "2차성고혈압", c.domain = "고혈압", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "고혈압::sub3"})
  SET c.label = "수축기단독고혈압(ISH)", c.domain = "고혈압", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "고혈압::sub4"})
  SET c.label = "고혈압 위기 (hypertensive emergency)", c.domain = "고혈압", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "고혈압::part1"})
  SET c.label = "수축기혈압(SBP)", c.domain = "고혈압", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "고혈압::part2"})
  SET c.label = "확장기혈압(DBP)", c.domain = "고혈압", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "고혈압::rel1"})
  SET c.label = "당뇨병(DM)", c.domain = "고혈압", c.canvas_node_type = "file";
MERGE (c:Concept {concept_id: "고혈압::rel2"})
  SET c.label = "심부전", c.domain = "고혈압", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "고혈압::rel3"})
  SET c.label = "뇌졸중", c.domain = "고혈압", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "고혈압::rel4"})
  SET c.label = "이상지질혈증", c.domain = "고혈압", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "고혈압::contrast1"})
  SET c.label = "정상혈압(Normal BP)", c.domain = "고혈압", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "고혈압::contrast2"})
  SET c.label = "주의혈압(Elevated BP)", c.domain = "고혈압", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "고혈압::dep1"})
  SET c.label = "콩팥병(CKD)", c.domain = "고혈압", c.canvas_node_type = "file";
MERGE (c:Concept {concept_id: "고혈압::dep2"})
  SET c.label = "좌심실비대", c.domain = "고혈압", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "고혈압::dep3"})
  SET c.label = "동맥경화", c.domain = "고혈압", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "고혈압::doid_essential"})
  SET c.label = "본태성고혈압 DOID:10825", c.domain = "고혈압", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "고혈압::doid_malignant"})
  SET c.label = "악성 본태성고혈압 DOID:10823", c.domain = "고혈압", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "고혈압::doid_benign"})
  SET c.label = "양성 본태성고혈압 DOID:10913", c.domain = "고혈압", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "고혈압::hp_edema_htn"})
  SET c.label = "말초부종 HP:0012398", c.domain = "고혈압", c.canvas_node_type = "text";
MERGE (c:Concept {concept_id: "통합::dm"})
  SET c.label = "당뇨병(DM)", c.domain = "통합", c.canvas_node_type = "file";
MERGE (c:Concept {concept_id: "통합::htn"})
  SET c.label = "고혈압(HTN)", c.domain = "통합", c.canvas_node_type = "file";
MERGE (c:Concept {concept_id: "통합::ckd"})
  SET c.label = "콩팥병(CKD)", c.domain = "통합", c.canvas_node_type = "file";
MERGE (c:Concept {concept_id: "통합::loop"})
  SET c.label = "관계_당뇨병_고혈압_콩팥병_악순환", c.domain = "통합", c.canvas_node_type = "file";
MERGE (c:Concept {concept_id: "통합::rel_dm_ckd"})
  SET c.label = "관계_당뇨병_콩팥병", c.domain = "통합", c.canvas_node_type = "file";
MERGE (c:Concept {concept_id: "통합::rel_htn_ckd"})
  SET c.label = "관계_고혈압_콩팥병", c.domain = "통합", c.canvas_node_type = "file";
MERGE (c:Concept {concept_id: "통합::rel_dm_htn"})
  SET c.label = "관계_당뇨병_고혈압", c.domain = "통합", c.canvas_node_type = "file";
MERGE (c:Concept {concept_id: "통합::egfr"})
  SET c.label = "eGFR 계산(CKD-EPI 2021)", c.domain = "통합", c.canvas_node_type = "file";
MERGE (c:Concept {concept_id: "통합::labtest"})
  SET c.label = "임상지표(eGFR·ACR·HbA1c·혈압)", c.domain = "통합", c.canvas_node_type = "file";
MERGE (c:Concept {concept_id: "통합::raas"})
  SET c.label = "RAAS억제제(ACEi·ARB)", c.domain = "통합", c.canvas_node_type = "file";
MERGE (c:Concept {concept_id: "통합::sglt2"})
  SET c.label = "SGLT2억제제", c.domain = "통합", c.canvas_node_type = "file";
MERGE (c:Concept {concept_id: "통합::welfare"})
  SET c.label = "장애인등록 및 복지혜택", c.domain = "통합", c.canvas_node_type = "file";

// -------------------------
// Concept -> Concept 관계 (캔버스 엣지 93개, 관계유형: is-a/part-of/related-to/contrasts-with/depends-on)
// -------------------------
MATCH (a:Concept {concept_id: "콩팥병::ckd"}), (b:Concept {concept_id: "콩팥병::super1"})
MERGE (a)-[:IS_A {original_label: "is-a"}]->(b);
MATCH (a:Concept {concept_id: "콩팥병::ckd"}), (b:Concept {concept_id: "콩팥병::super2"})
MERGE (a)-[:IS_A {original_label: "is-a"}]->(b);
MATCH (a:Concept {concept_id: "콩팥병::sub1"}), (b:Concept {concept_id: "콩팥병::ckd"})
MERGE (a)-[:IS_A {original_label: "is-a"}]->(b);
MATCH (a:Concept {concept_id: "콩팥병::sub2"}), (b:Concept {concept_id: "콩팥병::ckd"})
MERGE (a)-[:IS_A {original_label: "is-a"}]->(b);
MATCH (a:Concept {concept_id: "콩팥병::sub3"}), (b:Concept {concept_id: "콩팥병::ckd"})
MERGE (a)-[:IS_A {original_label: "is-a"}]->(b);
MATCH (a:Concept {concept_id: "콩팥병::ckd"}), (b:Concept {concept_id: "콩팥병::part1"})
MERGE (a)-[:PART_OF {original_label: "part-of"}]->(b);
MATCH (a:Concept {concept_id: "콩팥병::ckd"}), (b:Concept {concept_id: "콩팥병::part2"})
MERGE (a)-[:PART_OF {original_label: "part-of"}]->(b);
MATCH (a:Concept {concept_id: "콩팥병::ckd"}), (b:Concept {concept_id: "콩팥병::part3"})
MERGE (a)-[:PART_OF {original_label: "part-of"}]->(b);
MATCH (a:Concept {concept_id: "콩팥병::ckd"}), (b:Concept {concept_id: "콩팥병::part4"})
MERGE (a)-[:PART_OF {original_label: "part-of"}]->(b);
MATCH (a:Concept {concept_id: "콩팥병::ckd"}), (b:Concept {concept_id: "콩팥병::rel1"})
MERGE (a)-[:RELATED_TO {original_label: "related-to"}]->(b);
MATCH (a:Concept {concept_id: "콩팥병::ckd"}), (b:Concept {concept_id: "콩팥병::rel2"})
MERGE (a)-[:RELATED_TO {original_label: "related-to"}]->(b);
MATCH (a:Concept {concept_id: "콩팥병::ckd"}), (b:Concept {concept_id: "콩팥병::rel3"})
MERGE (a)-[:RELATED_TO {original_label: "related-to"}]->(b);
MATCH (a:Concept {concept_id: "콩팥병::ckd"}), (b:Concept {concept_id: "콩팥병::contrast1"})
MERGE (a)-[:CONTRASTS_WITH {original_label: "contrasts-with"}]->(b);
MATCH (a:Concept {concept_id: "콩팥병::ckd"}), (b:Concept {concept_id: "콩팥병::dep1"})
MERGE (a)-[:DEPENDS_ON {original_label: "depends-on"}]->(b);
MATCH (a:Concept {concept_id: "콩팥병::ckd"}), (b:Concept {concept_id: "콩팥병::dep2"})
MERGE (a)-[:DEPENDS_ON {original_label: "depends-on"}]->(b);
MATCH (a:Concept {concept_id: "콩팥병::ckd"}), (b:Concept {concept_id: "콩팥병::doid_ckd"})
MERGE (a)-[:RELATED_TO {original_label: "표준코드"}]->(b);
MATCH (a:Concept {concept_id: "콩팥병::sub1"}), (b:Concept {concept_id: "콩팥병::doid_eskd"})
MERGE (a)-[:RELATED_TO {original_label: "표준코드"}]->(b);
MATCH (a:Concept {concept_id: "콩팥병::doid_ckd"}), (b:Concept {concept_id: "콩팥병::doid_aki"})
MERGE (a)-[:CONTRASTS_WITH {original_label: "contrasts-with"}]->(b);
MATCH (a:Concept {concept_id: "콩팥병::doid_ckd"}), (b:Concept {concept_id: "콩팥병::doid_kf"})
MERGE (a)-[:IS_A {original_label: "is-a"}]->(b);
MATCH (a:Concept {concept_id: "콩팥병::doid_ckd"}), (b:Concept {concept_id: "콩팥병::hp_gfr"})
MERGE (a)-[:PART_OF {original_label: "has-symptom"}]->(b);
MATCH (a:Concept {concept_id: "콩팥병::doid_ckd"}), (b:Concept {concept_id: "콩팥병::hp_edema"})
MERGE (a)-[:PART_OF {original_label: "has-symptom"}]->(b);
MATCH (a:Concept {concept_id: "콩팥병::doid_ckd"}), (b:Concept {concept_id: "콩팥병::hp_alb_mild"})
MERGE (a)-[:PART_OF {original_label: "has-symptom"}]->(b);
MATCH (a:Concept {concept_id: "콩팥병::doid_ckd"}), (b:Concept {concept_id: "콩팥병::hp_alb_severe"})
MERGE (a)-[:PART_OF {original_label: "has-symptom"}]->(b);
MATCH (a:Concept {concept_id: "콩팥병::doid_eskd"}), (b:Concept {concept_id: "콩팥병::hp_hyperk"})
MERGE (a)-[:PART_OF {original_label: "has-symptom"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::dm"}), (b:Concept {concept_id: "당뇨병::super1"})
MERGE (a)-[:IS_A {original_label: "is-a"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::dm"}), (b:Concept {concept_id: "당뇨병::super2"})
MERGE (a)-[:IS_A {original_label: "is-a"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::sub1"}), (b:Concept {concept_id: "당뇨병::dm"})
MERGE (a)-[:IS_A {original_label: "is-a"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::sub2"}), (b:Concept {concept_id: "당뇨병::dm"})
MERGE (a)-[:IS_A {original_label: "is-a"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::sub3"}), (b:Concept {concept_id: "당뇨병::dm"})
MERGE (a)-[:IS_A {original_label: "is-a"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::sub4"}), (b:Concept {concept_id: "당뇨병::dm"})
MERGE (a)-[:IS_A {original_label: "is-a"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::dm"}), (b:Concept {concept_id: "당뇨병::part1"})
MERGE (a)-[:PART_OF {original_label: "part-of"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::dm"}), (b:Concept {concept_id: "당뇨병::part2"})
MERGE (a)-[:PART_OF {original_label: "part-of"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::dm"}), (b:Concept {concept_id: "당뇨병::part3"})
MERGE (a)-[:PART_OF {original_label: "part-of"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::dm"}), (b:Concept {concept_id: "당뇨병::part4"})
MERGE (a)-[:PART_OF {original_label: "part-of"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::dm"}), (b:Concept {concept_id: "당뇨병::rel1"})
MERGE (a)-[:RELATED_TO {original_label: "related-to"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::dm"}), (b:Concept {concept_id: "당뇨병::rel2"})
MERGE (a)-[:RELATED_TO {original_label: "related-to"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::dm"}), (b:Concept {concept_id: "당뇨병::rel3"})
MERGE (a)-[:RELATED_TO {original_label: "related-to"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::dm"}), (b:Concept {concept_id: "당뇨병::contrast1"})
MERGE (a)-[:CONTRASTS_WITH {original_label: "contrasts-with"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::dm"}), (b:Concept {concept_id: "당뇨병::contrast2"})
MERGE (a)-[:CONTRASTS_WITH {original_label: "contrasts-with"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::dm"}), (b:Concept {concept_id: "당뇨병::dep1"})
MERGE (a)-[:DEPENDS_ON {original_label: "depends-on"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::dm"}), (b:Concept {concept_id: "당뇨병::dep2"})
MERGE (a)-[:DEPENDS_ON {original_label: "depends-on"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::dm"}), (b:Concept {concept_id: "당뇨병::dep3"})
MERGE (a)-[:DEPENDS_ON {original_label: "depends-on"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::sub2"}), (b:Concept {concept_id: "당뇨병::doid_t2dm"})
MERGE (a)-[:RELATED_TO {original_label: "표준코드"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::dep3"}), (b:Concept {concept_id: "당뇨병::doid_dnp"})
MERGE (a)-[:RELATED_TO {original_label: "표준코드"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::dep2"}), (b:Concept {concept_id: "당뇨병::doid_dr"})
MERGE (a)-[:RELATED_TO {original_label: "표준코드"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::doid_dr"}), (b:Concept {concept_id: "당뇨병::doid_dr_prolif"})
MERGE (a)-[:IS_A {original_label: "is-a"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::doid_dr"}), (b:Concept {concept_id: "당뇨병::doid_dr_bg"})
MERGE (a)-[:IS_A {original_label: "is-a"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::doid_t2dm"}), (b:Concept {concept_id: "당뇨병::hp_pphg"})
MERGE (a)-[:PART_OF {original_label: "has-symptom"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::doid_t2dm"}), (b:Concept {concept_id: "당뇨병::hp_dka"})
MERGE (a)-[:PART_OF {original_label: "has-symptom"}]->(b);
MATCH (a:Concept {concept_id: "당뇨병::doid_t2dm"}), (b:Concept {concept_id: "당뇨병::hp_polydipsia"})
MERGE (a)-[:PART_OF {original_label: "has-symptom"}]->(b);
MATCH (a:Concept {concept_id: "고혈압::htn"}), (b:Concept {concept_id: "고혈압::super1"})
MERGE (a)-[:IS_A {original_label: "is-a"}]->(b);
MATCH (a:Concept {concept_id: "고혈압::htn"}), (b:Concept {concept_id: "고혈압::super2"})
MERGE (a)-[:IS_A {original_label: "is-a"}]->(b);
MATCH (a:Concept {concept_id: "고혈압::sub1"}), (b:Concept {concept_id: "고혈압::htn"})
MERGE (a)-[:IS_A {original_label: "is-a"}]->(b);
MATCH (a:Concept {concept_id: "고혈압::sub2"}), (b:Concept {concept_id: "고혈압::htn"})
MERGE (a)-[:IS_A {original_label: "is-a"}]->(b);
MATCH (a:Concept {concept_id: "고혈압::sub3"}), (b:Concept {concept_id: "고혈압::htn"})
MERGE (a)-[:IS_A {original_label: "is-a"}]->(b);
MATCH (a:Concept {concept_id: "고혈압::sub4"}), (b:Concept {concept_id: "고혈압::htn"})
MERGE (a)-[:IS_A {original_label: "is-a"}]->(b);
MATCH (a:Concept {concept_id: "고혈압::htn"}), (b:Concept {concept_id: "고혈압::part1"})
MERGE (a)-[:PART_OF {original_label: "part-of"}]->(b);
MATCH (a:Concept {concept_id: "고혈압::htn"}), (b:Concept {concept_id: "고혈압::part2"})
MERGE (a)-[:PART_OF {original_label: "part-of"}]->(b);
MATCH (a:Concept {concept_id: "고혈압::htn"}), (b:Concept {concept_id: "고혈압::rel1"})
MERGE (a)-[:RELATED_TO {original_label: "related-to"}]->(b);
MATCH (a:Concept {concept_id: "고혈압::htn"}), (b:Concept {concept_id: "고혈압::rel2"})
MERGE (a)-[:RELATED_TO {original_label: "related-to"}]->(b);
MATCH (a:Concept {concept_id: "고혈압::htn"}), (b:Concept {concept_id: "고혈압::rel3"})
MERGE (a)-[:RELATED_TO {original_label: "related-to"}]->(b);
MATCH (a:Concept {concept_id: "고혈압::htn"}), (b:Concept {concept_id: "고혈압::rel4"})
MERGE (a)-[:RELATED_TO {original_label: "related-to"}]->(b);
MATCH (a:Concept {concept_id: "고혈압::htn"}), (b:Concept {concept_id: "고혈압::contrast1"})
MERGE (a)-[:CONTRASTS_WITH {original_label: "contrasts-with"}]->(b);
MATCH (a:Concept {concept_id: "고혈압::htn"}), (b:Concept {concept_id: "고혈압::contrast2"})
MERGE (a)-[:CONTRASTS_WITH {original_label: "contrasts-with"}]->(b);
MATCH (a:Concept {concept_id: "고혈압::htn"}), (b:Concept {concept_id: "고혈압::dep1"})
MERGE (a)-[:DEPENDS_ON {original_label: "depends-on"}]->(b);
MATCH (a:Concept {concept_id: "고혈압::htn"}), (b:Concept {concept_id: "고혈압::dep2"})
MERGE (a)-[:DEPENDS_ON {original_label: "depends-on"}]->(b);
MATCH (a:Concept {concept_id: "고혈압::htn"}), (b:Concept {concept_id: "고혈압::dep3"})
MERGE (a)-[:DEPENDS_ON {original_label: "depends-on"}]->(b);
MATCH (a:Concept {concept_id: "고혈압::sub1"}), (b:Concept {concept_id: "고혈압::doid_essential"})
MERGE (a)-[:RELATED_TO {original_label: "표준코드"}]->(b);
MATCH (a:Concept {concept_id: "고혈압::doid_essential"}), (b:Concept {concept_id: "고혈압::doid_malignant"})
MERGE (a)-[:IS_A {original_label: "is-a"}]->(b);
MATCH (a:Concept {concept_id: "고혈압::doid_essential"}), (b:Concept {concept_id: "고혈압::doid_benign"})
MERGE (a)-[:IS_A {original_label: "is-a"}]->(b);
MATCH (a:Concept {concept_id: "고혈압::doid_essential"}), (b:Concept {concept_id: "고혈압::hp_edema_htn"})
MERGE (a)-[:PART_OF {original_label: "has-symptom"}]->(b);
MATCH (a:Concept {concept_id: "통합::dm"}), (b:Concept {concept_id: "통합::rel_dm_ckd"})
MERGE (a)-[:IS_A {original_label: "causes/comorbid-with"}]->(b);
MATCH (a:Concept {concept_id: "통합::ckd"}), (b:Concept {concept_id: "통합::rel_dm_ckd"})
MERGE (a)-[:IS_A {original_label: "causes/comorbid-with"}]->(b);
MATCH (a:Concept {concept_id: "통합::htn"}), (b:Concept {concept_id: "통합::rel_htn_ckd"})
MERGE (a)-[:IS_A {original_label: "causes/comorbid-with"}]->(b);
MATCH (a:Concept {concept_id: "통합::ckd"}), (b:Concept {concept_id: "통합::rel_htn_ckd"})
MERGE (a)-[:IS_A {original_label: "causes/comorbid-with"}]->(b);
MATCH (a:Concept {concept_id: "통합::dm"}), (b:Concept {concept_id: "통합::rel_dm_htn"})
MERGE (a)-[:IS_A {original_label: "comorbid-with"}]->(b);
MATCH (a:Concept {concept_id: "통합::htn"}), (b:Concept {concept_id: "통합::rel_dm_htn"})
MERGE (a)-[:IS_A {original_label: "comorbid-with"}]->(b);
MATCH (a:Concept {concept_id: "통합::dm"}), (b:Concept {concept_id: "통합::loop"})
MERGE (a)-[:IS_A {original_label: "feedback-loop"}]->(b);
MATCH (a:Concept {concept_id: "통합::htn"}), (b:Concept {concept_id: "통합::loop"})
MERGE (a)-[:IS_A {original_label: "feedback-loop"}]->(b);
MATCH (a:Concept {concept_id: "통합::ckd"}), (b:Concept {concept_id: "통합::loop"})
MERGE (a)-[:IS_A {original_label: "feedback-loop"}]->(b);
MATCH (a:Concept {concept_id: "통합::ckd"}), (b:Concept {concept_id: "통합::egfr"})
MERGE (a)-[:PART_OF {original_label: "depends-on"}]->(b);
MATCH (a:Concept {concept_id: "통합::dm"}), (b:Concept {concept_id: "통합::labtest"})
MERGE (a)-[:PART_OF {original_label: "depends-on"}]->(b);
MATCH (a:Concept {concept_id: "통합::htn"}), (b:Concept {concept_id: "통합::labtest"})
MERGE (a)-[:PART_OF {original_label: "depends-on"}]->(b);
MATCH (a:Concept {concept_id: "통합::ckd"}), (b:Concept {concept_id: "통합::labtest"})
MERGE (a)-[:PART_OF {original_label: "depends-on"}]->(b);
MATCH (a:Concept {concept_id: "통합::htn"}), (b:Concept {concept_id: "통합::raas"})
MERGE (a)-[:RELATED_TO {original_label: "공통치료축"}]->(b);
MATCH (a:Concept {concept_id: "통합::ckd"}), (b:Concept {concept_id: "통합::raas"})
MERGE (a)-[:RELATED_TO {original_label: "공통치료축"}]->(b);
MATCH (a:Concept {concept_id: "통합::loop"}), (b:Concept {concept_id: "통합::raas"})
MERGE (a)-[:RELATED_TO {original_label: "공통치료축"}]->(b);
MATCH (a:Concept {concept_id: "통합::dm"}), (b:Concept {concept_id: "통합::sglt2"})
MERGE (a)-[:RELATED_TO {original_label: "공통치료축"}]->(b);
MATCH (a:Concept {concept_id: "통합::ckd"}), (b:Concept {concept_id: "통합::sglt2"})
MERGE (a)-[:RELATED_TO {original_label: "공통치료축"}]->(b);
MATCH (a:Concept {concept_id: "통합::loop"}), (b:Concept {concept_id: "통합::sglt2"})
MERGE (a)-[:RELATED_TO {original_label: "공통치료축"}]->(b);
MATCH (a:Concept {concept_id: "통합::dm"}), (b:Concept {concept_id: "통합::welfare"})
MERGE (a)-[:RELATED_TO {original_label: "related-to"}]->(b);
MATCH (a:Concept {concept_id: "통합::htn"}), (b:Concept {concept_id: "통합::welfare"})
MERGE (a)-[:RELATED_TO {original_label: "related-to"}]->(b);
MATCH (a:Concept {concept_id: "통합::ckd"}), (b:Concept {concept_id: "통합::welfare"})
MERGE (a)-[:RELATED_TO {original_label: "related-to"}]->(b);
