// =========================================================
// 콩당콩당 - DOID/HP 온톨로지 보강 v2 (한글 라벨 포함)
// 대상: CKD/DM/HTN 핵심 질환(Disease) + 핵심 증상/표현형(Symptom)
// =========================================================

CREATE CONSTRAINT disease_doid_unique IF NOT EXISTS
FOR (d:Disease) REQUIRE d.doid IS UNIQUE;

CREATE CONSTRAINT symptom_hpid_unique IF NOT EXISTS
FOR (s:Symptom) REQUIRE s.hp_id IS UNIQUE;

// Disease 노드 (한글 라벨 포함)
MERGE (d:Disease {doid: "DOID:1074"})
  SET d.label_en = "kidney failure", d.label_ko = "신부전", d.category = "CKD";
MERGE (d:Disease {doid: "DOID:3021"})
  SET d.label_en = "acute kidney failure", d.label_ko = "급성신손상", d.category = "CKD";
MERGE (d:Disease {doid: "DOID:783"})
  SET d.label_en = "end stage renal disease", d.label_ko = "말기콩팥병(ESKD)", d.category = "CKD";
MERGE (d:Disease {doid: "DOID:784"})
  SET d.label_en = "chronic kidney disease", d.label_ko = "만성콩팥병(CKD)", d.category = "CKD";
MERGE (d:Disease {doid: "DOID:13207"})
  SET d.label_en = "proliferative diabetic retinopathy", d.label_ko = "증식성 당뇨망막병증", d.category = "DM";
MERGE (d:Disease {doid: "DOID:13208"})
  SET d.label_en = "background diabetic retinopathy", d.label_ko = "비증식성 당뇨망막병증(배경형)", d.category = "DM";
MERGE (d:Disease {doid: "DOID:8946"})
  SET d.label_en = "severe nonproliferative diabetic retinopathy", d.label_ko = "중증 비증식성 당뇨망막병증", d.category = "DM";
MERGE (d:Disease {doid: "DOID:8947"})
  SET d.label_en = "diabetic retinopathy", d.label_ko = "당뇨망막병증", d.category = "DM";
MERGE (d:Disease {doid: "DOID:9352"})
  SET d.label_en = "type 2 diabetes mellitus", d.label_ko = "제2형 당뇨병", d.category = "DM";
MERGE (d:Disease {doid: "DOID:9743"})
  SET d.label_en = "diabetic neuropathy", d.label_ko = "당뇨신경병증", d.category = "DM";
MERGE (d:Disease {doid: "DOID:10823"})
  SET d.label_en = "malignant essential hypertension", d.label_ko = "악성 본태성고혈압", d.category = "HTN";
MERGE (d:Disease {doid: "DOID:10825"})
  SET d.label_en = "essential hypertension", d.label_ko = "본태성고혈압", d.category = "HTN";
MERGE (d:Disease {doid: "DOID:10913"})
  SET d.label_en = "benign essential hypertension", d.label_ko = "양성 본태성고혈압", d.category = "HTN";

// Symptom 노드 (한글 라벨 포함)
MERGE (s:Symptom {hp_id: "HP:0001953"})
  SET s.label_en = "Diabetic ketoacidosis", s.label_ko = "당뇨병성 케톤산증";
MERGE (s:Symptom {hp_id: "HP:0001959"})
  SET s.label_en = "Polydipsia", s.label_ko = "다음(물 많이 마심)";
MERGE (s:Symptom {hp_id: "HP:0003126"})
  SET s.label_en = "Low-molecular-weight proteinuria", s.label_ko = "저분자단백뇨";
MERGE (s:Symptom {hp_id: "HP:0011998"})
  SET s.label_en = "Postprandial hyperglycemia", s.label_ko = "식후 고혈당";
MERGE (s:Symptom {hp_id: "HP:0012213"})
  SET s.label_en = "Decreased glomerular filtration rate", s.label_ko = "사구체여과율(GFR) 저하";
MERGE (s:Symptom {hp_id: "HP:0012398"})
  SET s.label_en = "Peripheral edema", s.label_ko = "말초부종";
MERGE (s:Symptom {hp_id: "HP:0012593"})
  SET s.label_en = "Nephrotic range proteinuria", s.label_ko = "신증후군 수준 단백뇨";
MERGE (s:Symptom {hp_id: "HP:0012594"})
  SET s.label_en = "Moderate albuminuria", s.label_ko = "중등도 알부민뇨";
MERGE (s:Symptom {hp_id: "HP:0012595"})
  SET s.label_en = "Mild proteinuria", s.label_ko = "경증 단백뇨";
MERGE (s:Symptom {hp_id: "HP:0012596"})
  SET s.label_en = "Moderate proteinuria", s.label_ko = "중등도 단백뇨";
MERGE (s:Symptom {hp_id: "HP:0012597"})
  SET s.label_en = "Heavy proteinuria", s.label_ko = "고도 단백뇨";
MERGE (s:Symptom {hp_id: "HP:0033065"})
  SET s.label_en = "Mild albuminuria", s.label_ko = "경증 알부민뇨";
MERGE (s:Symptom {hp_id: "HP:0033066"})
  SET s.label_en = "Severe albuminuria", s.label_ko = "중증 알부민뇨";
MERGE (s:Symptom {hp_id: "HP:4000058"})
  SET s.label_en = "Glomerular proteinuria", s.label_ko = "사구체성 단백뇨";
MERGE (s:Symptom {hp_id: "HP:6000833"})
  SET s.label_en = "Hyperkalemia while symptomatic", s.label_ko = "증상성 고칼륨혈증";

// Disease -> Symptom 관계 (HAS_SYMPTOM)
MATCH (d:Disease {doid: "DOID:784"}), (s:Symptom {hp_id: "HP:0012213"})
MERGE (d)-[:HAS_SYMPTOM {note: "GFR저하 -> CKD 핵심지표"}]->(s);
MATCH (d:Disease {doid: "DOID:784"}), (s:Symptom {hp_id: "HP:0012398"})
MERGE (d)-[:HAS_SYMPTOM {note: "말초부종 -> CKD"}]->(s);
MATCH (d:Disease {doid: "DOID:784"}), (s:Symptom {hp_id: "HP:0033065"})
MERGE (d)-[:HAS_SYMPTOM {note: "경증알부민뇨 -> CKD초기"}]->(s);
MATCH (d:Disease {doid: "DOID:784"}), (s:Symptom {hp_id: "HP:0033066"})
MERGE (d)-[:HAS_SYMPTOM {note: "중증알부민뇨 -> CKD진행"}]->(s);
MATCH (d:Disease {doid: "DOID:783"}), (s:Symptom {hp_id: "HP:6000833"})
MERGE (d)-[:HAS_SYMPTOM {note: "고칼륨혈증 -> 말기신부전 응급"}]->(s);
MATCH (d:Disease {doid: "DOID:9352"}), (s:Symptom {hp_id: "HP:0011998"})
MERGE (d)-[:HAS_SYMPTOM {note: "식후고혈당 -> 제2형당뇨"}]->(s);
MATCH (d:Disease {doid: "DOID:9352"}), (s:Symptom {hp_id: "HP:0001953"})
MERGE (d)-[:HAS_SYMPTOM {note: "당뇨케톤산증 -> 제2형당뇨 응급"}]->(s);
MATCH (d:Disease {doid: "DOID:9743"}), (s:Symptom {hp_id: "HP:0012398"})
MERGE (d)-[:HAS_SYMPTOM {note: "말초부종 -> 당뇨신경병증 연관"}]->(s);
MATCH (d:Disease {doid: "DOID:8947"}), (s:Symptom {hp_id: "HP:0011998"})
MERGE (d)-[:HAS_SYMPTOM {note: "고혈당 -> 당뇨망막병증 연관지표"}]->(s);
MATCH (d:Disease {doid: "DOID:10825"}), (s:Symptom {hp_id: "HP:0012398"})
MERGE (d)-[:HAS_SYMPTOM {note: "말초부종 -> 고혈압성 부종"}]->(s);
