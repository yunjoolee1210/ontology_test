// =========================================================
// Intent/Slot <-> Disease/Symptom 연결
// symptom_name 슬롯 추출값 -> Symptom 노드 매핑
// disease_stage 슬롯 추출값 -> Disease 노드 매핑
// =========================================================

// Slot이 참조할 수 있는 노드 종류를 명시 (REFERENCES 관계)
MATCH (slot:Slot {name: "symptom_name"})
MERGE (slot)-[:REFERENCES_NODE_TYPE]->(:NodeTypeRef {type: "Symptom", key_field: "hp_id"});

MATCH (slot:Slot {name: "disease_stage"})
MERGE (slot)-[:REFERENCES_NODE_TYPE]->(:NodeTypeRef {type: "Disease", key_field: "doid"});

// 조회 예시: SymptomInquiry 의도 처리 시
// 1) 사용자 발화에서 LLM이 증상 키워드 추출 (예: '소변에 거품')
// 2) 아래 쿼리로 Symptom 노드 라벨 매칭 -> hp_id 확보
// MATCH (s:Symptom) WHERE s.label_ko CONTAINS '단백뇨' RETURN s.hp_id, s.label_ko;

// 3) 확보된 hp_id로 관련 Disease 역추적 (HAS_SYMPTOM 역방향)
// MATCH (d:Disease)-[:HAS_SYMPTOM]->(s:Symptom {hp_id: $hpId})
// RETURN d.label_ko, d.doid;

// 4) disease_stage 슬롯 채움 시 Disease 노드와 직접 연결
// MATCH (d:Disease {doid: $doid}) RETURN d.label_ko, d.category;