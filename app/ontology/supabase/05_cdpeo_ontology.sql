-- =========================================================
-- 콩당콩당 - CDPEO(Chronic Disease Patient Education Ontology) 적용
-- 출처: http://www.semanticweb.org/ontologies/chronic-diease-patient-education-ontology
-- 원본 파일: data/raw/ontology/CDPEO.owl
--
-- 다른 온톨로지(DOID/HP/CKDO/HTN/DMTO)와의 차이:
--   기존 것들은 '진단명/시술명' 수준의 코드 목록인 반면,
--   CDPEO는 환자 프로필(인구통계+생활습관+질환+생리지표+복약)을 수치 임계값으로
--   '위험도 벡터(vectorItem*)'로 환산하는 SWRL 규칙 80개를 포함한다.
--   즉 이것은 '무슨 병인가'가 아니라 '이 환자가 얼마나 위험한가'를 계산하는 로직이다.
-- =========================================================

CREATE TABLE IF NOT EXISTS cdpeo_concepts (
  concept_id   TEXT PRIMARY KEY,
  label_en     TEXT,
  label_ko     TEXT,
  parent_class TEXT
);

CREATE TABLE IF NOT EXISTS cdpeo_swrl_rules (
  rule_code        TEXT PRIMARY KEY,   -- 'A01'~'E05' (A=인구통계, B=질환, C=생활습관, D=생리지표, E=복약)
  description_en   TEXT,
  description_ko   TEXT,
  body_properties  TEXT[],             -- 규칙 조건부에 사용된 속성명
  body_operators   TEXT[],             -- 비교연산자(lessThan, greaterThanOrEqual 등)
  body_thresholds  TEXT[],             -- 조건에 사용된 수치 임계값
  head_property    TEXT,               -- 결론부 속성 (예: vectorItemBloodPressure)
  head_value       TEXT                -- 결론부 값 (위험도 등급, 0=정상 기준)
);

INSERT INTO cdpeo_concepts (concept_id, label_en, label_ko, parent_class) VALUES
('CDPEO:Age', 'Age', '연령', 'CDPEO:Demographic'),
('CDPEO:AntiHypetensiveDrug', 'AntiHypetensiveDrug', '항고혈압제', 'CDPEO:Medication'),
('CDPEO:BloodGlucose', 'BloodGlucose', '혈당', 'CDPEO:PhysiologicalIndex'),
('CDPEO:BloodPressure', 'BloodPressure', '혈압', 'CDPEO:PhysiologicalIndex'),
('CDPEO:BodyMassIndex', 'BodyMassIndex', '체질량지수(BMI)', 'CDPEO:Demographic'),
('CDPEO:ChronicDisease', 'ChronicDisease', '만성질환', 'CDPEO:Disease'),
('CDPEO:ChronicObstructivePulmonaryDisease', 'ChronicObstructivePulmonaryDisease', '만성폐쇄성폐질환(COPD)', 'CDPEO:ChronicDisease'),
('CDPEO:Complication', 'Complication', '합병증', 'CDPEO:Disease'),
('CDPEO:CoronaryHeartDisease', 'CoronaryHeartDisease', '관상동맥질환', 'CDPEO:ChronicDisease'),
('CDPEO:Demographic', 'Demographic', '인구통계학적 요인', NULL),
('CDPEO:Diabetes', 'Diabetes', '당뇨병', 'CDPEO:ChronicDisease'),
('CDPEO:Diet', 'Diet', '식이', 'CDPEO:Lifestyle'),
('CDPEO:Disease', 'Disease', '질환', NULL),
('CDPEO:Drinking', 'Drinking', '음주', 'CDPEO:Lifestyle'),
('CDPEO:Education', 'Education', '교육수준', 'CDPEO:Demographic'),
('CDPEO:Exercise', 'Exercise', '운동', 'CDPEO:Lifestyle'),
('CDPEO:EyeDisease', 'EyeDisease', '안과질환(합병증)', 'CDPEO:Complication'),
('CDPEO:Gender', 'Gender', '성별', 'CDPEO:Demographic'),
('CDPEO:Hyperlipidemia', 'Hyperlipidemia', '이상지질혈증', 'CDPEO:ChronicDisease'),
('CDPEO:Hypertension', 'Hypertension', '고혈압', 'CDPEO:ChronicDisease'),
('CDPEO:HypoglycemicDrug', 'HypoglycemicDrug', '혈당강하제', 'CDPEO:Medication'),
('CDPEO:HypolipidemicDrug', 'HypolipidemicDrug', '지질강하제', 'CDPEO:Medication'),
('CDPEO:KidneyDisease', 'KidneyDisease', '신장질환(합병증)', 'CDPEO:Complication'),
('CDPEO:Lifestyle', 'Lifestyle', '생활습관', NULL),
('CDPEO:Lipoprotein', 'Lipoprotein', '지단백(HDL/LDL)', 'CDPEO:PhysiologicalIndex'),
('CDPEO:LiverDisease', 'LiverDisease', '간질환(합병증)', 'CDPEO:Complication'),
('CDPEO:LungDisease', 'LungDisease', '폐질환(합병증)', 'CDPEO:Complication'),
('CDPEO:Medication', 'Medication', '복약', NULL),
('CDPEO:Mentality', 'Mentality', '정신건강(우울 등)', 'CDPEO:Lifestyle'),
('CDPEO:Occupation', 'Occupation', '직업', 'CDPEO:Demographic'),
('CDPEO:PatientProfile', 'PatientProfile', '환자 프로필', NULL),
('CDPEO:PhysiologicalIndex', 'PhysiologicalIndex', '생리지표', NULL),
('CDPEO:Pregnancy', 'Pregnancy', '임신', 'CDPEO:Demographic'),
('CDPEO:SkinDisease', 'SkinDisease', '피부질환(합병증)', 'CDPEO:Complication'),
('CDPEO:Smoking', 'Smoking', '흡연', 'CDPEO:Lifestyle'),
('CDPEO:StomachDisease', 'StomachDisease', '위장질환(합병증)', 'CDPEO:Complication'),
('CDPEO:Stroke', 'Stroke', '뇌졸중', 'CDPEO:ChronicDisease'),
('CDPEO:TotalCholesterol', 'TotalCholesterol', '총콜레스테롤', 'CDPEO:PhysiologicalIndex'),
('CDPEO:Triglyceride', 'Triglyceride', '중성지방', 'CDPEO:PhysiologicalIndex'),
('CDPEO:UricAcid', 'UricAcid', '요산', 'CDPEO:PhysiologicalIndex')
ON CONFLICT (concept_id) DO NOTHING;

INSERT INTO cdpeo_swrl_rules (rule_code, description_en, description_ko, body_properties, body_operators, body_thresholds, head_property, head_value) VALUES
('C03', 'Lifestyle rule 03-mentality', '정신건강(PHQ-9 우울척도)', ARRAY['vectorItemDepression','hasMentality','hasPHQ9Value'], ARRAY['lessThanOrEqual','greaterThanOrEqual'], ARRAY['14','10'], 'vectorItemDepression', '2'),
('C04', 'Lifestyle rule 04-mentality', '정신건강(PHQ-9 우울척도)', ARRAY['vectorItemDepression','hasMentality','hasPHQ9Value'], ARRAY['lessThanOrEqual','greaterThanOrEqual'], ARRAY['19','15'], 'vectorItemDepression', '3'),
('C05', 'Lifestyle rule 05-mentality', '정신건강(PHQ-9 우울척도)', ARRAY['vectorItemDepression','hasMentality','hasPHQ9Value'], ARRAY['lessThanOrEqual','greaterThanOrEqual'], ARRAY['27','20'], 'vectorItemDepression', '4'),
('C02', 'Lifestyle rule 02-mentality', '정신건강(PHQ-9 우울척도)', ARRAY['vectorItemDepression','hasMentality','hasPHQ9Value'], ARRAY['lessThanOrEqual','greaterThanOrEqual'], ARRAY['9','5'], 'vectorItemDepression', '1'),
('C01', 'Lifestyle rule 01-mentality', '정신건강(PHQ-9 우울척도)', ARRAY['vectorItemDepression','hasMentality','hasPHQ9Value'], ARRAY['lessThanOrEqual'], ARRAY['4'], 'vectorItemDepression', '0'),
('A06', 'demographic rule 06-pregnancy', '임신', ARRAY['vectorItemPregnant','hasPregnancy','hasPregnancyValue'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemPregnant', '0'),
('A05', 'demographic rule 05-pregnancy', '임신', ARRAY['vectorItemPregnant','hasPregnancy','hasPregnancyValue'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemPregnant', '1'),
('B17', 'Disease rule 17-skindisease', '피부질환 합병증', ARRAY['hasSkinDiseaseValue','vectorItemSkinDisease','hasSkinDisease'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemSkinDisease', '0'),
('B18', 'Disease rule 18-skindisease', '피부질환 합병증', ARRAY['hasSkinDiseaseValue','vectorItemSkinDisease','hasSkinDisease'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemSkinDisease', '1'),
('C09', 'Lifestyle rule 09-smoking', '흡연', ARRAY['vectorItemSmoking','hasDailyCigarettes','hasSmoking'], ARRAY['equal'], ARRAY['0'], 'vectorItemSmoking', '0'),
('C06', 'Lifestyle rule 06-smoking', '흡연', ARRAY['vectorItemSmoking','hasDailyCigarettes','hasSmoking'], ARRAY['lessThanOrEqual','greaterThan'], ARRAY['10','0'], 'vectorItemSmoking', '1'),
('C07', 'Lifestyle rule 07-smoking', '흡연', ARRAY['vectorItemSmoking','hasDailyCigarettes','hasSmoking'], ARRAY['lessThanOrEqual','greaterThanOrEqual'], ARRAY['20','11'], 'vectorItemSmoking', '2'),
('C08', 'Lifestyle rule 08-smoking', '흡연', ARRAY['vectorItemSmoking','hasDailyCigarettes','hasSmoking'], ARRAY['greaterThanOrEqual'], ARRAY['21'], 'vectorItemSmoking', '3'),
('B24', 'Disease rule 24-stomachdisease', '위장질환 합병증', ARRAY['hasStomachDisease','vectorItemStomachDisease','hasStomachDiseaseValue'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemStomachDisease', '0'),
('B23', 'Disease rule 23-stomachdisease', '위장질환 합병증', ARRAY['hasStomachDisease','vectorItemStomachDisease','hasStomachDiseaseValue'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemStomachDisease', '1'),
('B11', 'Disease rule 11-stroke', '뇌졸중', ARRAY['hasStrokeValue','hasStroke','vectorItemStroke'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemStroke', '0'),
('B12', 'Disease rule 12-stroke', '뇌졸중', ARRAY['hasStrokeValue','hasStroke','vectorItemStroke'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemStroke', '1'),
('D15', 'VitalSIgn rule 15-tc', '총콜레스테롤', ARRAY['hasTCValue','hasTC','vectorItemTotalCholesterol'], ARRAY['greaterThan'], ARRAY['5.2'], 'vectorItemTotalCholesterol', '1'),
('D14', 'VitalSIgn rule 14-tc', '총콜레스테롤', ARRAY['hasTCValue','hasTC','vectorItemTotalCholesterol'], ARRAY['lessThanOrEqual'], ARRAY['5.2'], 'vectorItemTotalCholesterol', '0'),
('D16', 'VitalSIgn rule 16-tg', '중성지방', ARRAY['hasTG','vectorItemTriglyceride','hasTGValue'], ARRAY['greaterThan'], ARRAY['1.7'], 'vectorItemTriglyceride', '1'),
('D17', 'VitalSIgn rule 17-tg', '중성지방', ARRAY['hasTG','vectorItemTriglyceride','hasTGValue'], ARRAY['lessThanOrEqual'], ARRAY['1.7'], 'vectorItemTriglyceride', '0'),
('D22', 'VitalSIgn rule 22-ua', '요산(성별·연령 보정)', ARRAY['vectorItemUricAcid','hasGenderValue','hasUA','hasGender','hasAgeValue','hasAge','hasUAValue'], ARRAY['lessThanOrEqual','greaterThan'], ARRAY['434','60'], 'vectorItemUricAcid', '0'),
('D21', 'VitalSIgn rule 21-ua', '요산(성별·연령 보정)', ARRAY['vectorItemUricAcid','hasGenderValue','hasUA','hasGender','hasAgeValue','hasAge','hasUAValue'], ARRAY['greaterThan','lessThanOrEqual'], ARRAY['357','60'], 'vectorItemUricAcid', '1'),
('D19', 'VitalSIgn rule 19-ua', '요산(성별·연령 보정)', ARRAY['vectorItemUricAcid','hasGenderValue','hasUA','hasGender','hasAgeValue','hasAge','hasUAValue'], ARRAY['lessThanOrEqual','lessThanOrEqual'], ARRAY['357','60'], 'vectorItemUricAcid', '0'),
('D24', 'VitalSIgn rule 24-ua', '요산(성별·연령 보정)', ARRAY['vectorItemUricAcid','hasGenderValue','hasUA','hasGender','hasAgeValue','hasAge','hasUAValue'], ARRAY['greaterThan','greaterThan'], ARRAY['476','60'], 'vectorItemUricAcid', '1'),
('D23', 'VitalSIgn rule 23-ua', '요산(성별·연령 보정)', ARRAY['vectorItemUricAcid','hasGenderValue','hasUA','hasGender','hasAgeValue','hasAge','hasUAValue'], ARRAY['lessThanOrEqual','greaterThan'], ARRAY['476','60'], 'vectorItemUricAcid', '0'),
('D20', 'VitalSIgn rule 20-ua', '요산(성별·연령 보정)', ARRAY['vectorItemUricAcid','hasGenderValue','hasUA','hasGender','hasAgeValue','hasAge','hasUAValue'], ARRAY['greaterThan','lessThanOrEqual'], ARRAY['416','60'], 'vectorItemUricAcid', '1'),
('D18', 'VitalSIgn rule 18-ua', '요산(성별·연령 보정)', ARRAY['vectorItemUricAcid','hasGenderValue','hasUA','hasGender','hasAgeValue','hasAge','hasUAValue'], ARRAY['lessThanOrEqual','lessThanOrEqual'], ARRAY['416','60'], 'vectorItemUricAcid', '0'),
('A03', 'demographic rule 02-age', '연령(고령 기준)', ARRAY['vectorItemYouth','hasAgeValue','hasAge','vectorItemOldAge'], ARRAY['greaterThanOrEqual'], ARRAY['60'], 'vectorItemYouth', '0'),
('A04', 'demographic rule 04-age', '연령(고령 기준)', ARRAY['vectorItemYouth','hasAgeValue','hasAge','vectorItemOldAge'], ARRAY['lessThanOrEqual'], ARRAY['60'], 'vectorItemYouth', '1'),
('E01', 'Medication rule 01-antihypertensivedrug', '항고혈압제 복용', ARRAY['vectorItemAntiHypertensiveDrug','hasAntiHypertensiveDrugValue','hasAntiHypertensiveDrug'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemAntiHypertensiveDrug', NULL),
('D09', 'VitalSIgn rule 09-bg', '혈당', ARRAY['hasBG','vectorItemBloodGlucose','hasBGValue'], ARRAY['lessThan','greaterThanOrEqual'], ARRAY['7','6.1'], 'vectorItemBloodGlucose', '1'),
('D10', 'VitalSIgn rule 10-bg', '혈당', ARRAY['hasBG','vectorItemBloodGlucose','hasBGValue'], ARRAY['greaterThanOrEqual'], ARRAY['7'], 'vectorItemBloodGlucose', '2'),
('D08', 'VitalSIgn rule 08-bg', '혈당', ARRAY['hasBG','vectorItemBloodGlucose','hasBGValue'], ARRAY['lessThan'], ARRAY['6.1'], 'vectorItemBloodGlucose', '0'),
('A07', 'demographic rule 07-bmi', '체질량지수', ARRAY['hasBMI','vectorItemOverWeight','hasBMIValue'], ARRAY['greaterThan'], ARRAY['24'], 'vectorItemOverWeight', '1'),
('A08', 'demographic rule 08-bmi', '체질량지수', ARRAY['hasBMI','vectorItemOverWeight','hasBMIValue'], ARRAY['lessThanOrEqual'], ARRAY['24'], 'vectorItemOverWeight', '0'),
('D07', 'VitalSIgn rule 07-bp', '혈압', ARRAY['hasBP','hasDBPValue','hasSBPValue','vectorItemBloodPressure'], ARRAY['lessThan','lessThan'], ARRAY['90','140'], 'vectorItemBloodPressure', '0'),
('D03', 'VitalSIgn rule 03-bp', '혈압', ARRAY['hasBP','hasDBPValue','vectorItemBloodPressure'], ARRAY['greaterThanOrEqual','lessThan'], ARRAY['100','110'], 'vectorItemBloodPressure', '2'),
('D02', 'VitalSIgn rule 02-bp', '혈압', ARRAY['hasBP','hasDBPValue','vectorItemBloodPressure'], ARRAY['greaterThanOrEqual'], ARRAY['110'], 'vectorItemBloodPressure', '3'),
('D06', 'VitalSIgn rule 06-bp', '혈압', ARRAY['hasBP','hasDBPValue','vectorItemBloodPressure'], ARRAY['greaterThanOrEqual','lessThan'], ARRAY['90','100'], 'vectorItemBloodPressure', '1'),
('D05', 'VitalSIgn rule 05-bp', '혈압', ARRAY['hasBP','hasSBPValue','vectorItemBloodPressure'], ARRAY['greaterThanOrEqual','lessThan'], ARRAY['140','160'], 'vectorItemBloodPressure', '1'),
('D04', 'VitalSIgn rule 04-bp', '혈압', ARRAY['hasBP','hasSBPValue','vectorItemBloodPressure'], ARRAY['greaterThanOrEqual','lessThan'], ARRAY['160','180'], 'vectorItemBloodPressure', '2'),
('D01', 'VitalSIgn rule 01-bp', '혈압', ARRAY['hasBP','hasSBPValue','vectorItemBloodPressure'], ARRAY['greaterThanOrEqual'], ARRAY['180'], 'vectorItemBloodPressure', '3'),
('B06', 'Disease rule 06-chd', '관상동맥질환', ARRAY['hasCHDValue','vectorItemCoronaryHeartDisease','hasCHD'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemCoronaryHeartDisease', '0'),
('B05', 'Disease rule 05-chd', '관상동맥질환', ARRAY['hasCHDValue','vectorItemCoronaryHeartDisease','hasCHD'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemCoronaryHeartDisease', '1'),
('B03', 'Disease rule 03-copd', '만성폐쇄성폐질환', ARRAY['vectorItemChronicObstructivePulmonaryDisease','hasCOPD','hasCOPDValue'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemChronicObstructivePulmonaryDisease', '0'),
('B04', 'Disease rule 04-copd', '만성폐쇄성폐질환', ARRAY['vectorItemChronicObstructivePulmonaryDisease','hasCOPD','hasCOPDValue'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemChronicObstructivePulmonaryDisease', '1'),
('B07', 'Disease rule 07-diabetes', '당뇨병 동반질환', ARRAY['vectorItemDiabetes','hasDiabetesValue','hasDiabetes'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemDiabetes', '0'),
('B08', 'Disease rule 08-diabetes', '당뇨병 동반질환', ARRAY['vectorItemDiabetes','hasDiabetesValue','hasDiabetes'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemDiabetes', '1'),
('C14', 'Lifestyle rule 14-diet', '식이', ARRAY['vectorItemDiet','hasDiet','hasDietLevel'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemDiet', '0'),
('C15', 'Lifestyle rule 15-diet', '식이', ARRAY['vectorItemDiet','hasDiet','hasDietLevel'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemDiet', '1'),
('C16', 'Lifestyle rule 16-diet', '식이', ARRAY['vectorItemDiet','hasDiet','hasDietLevel'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemDiet', '2'),
('C10', 'Lifestyle rule 10-drinking', '음주', ARRAY['hasDailyDrinking','vectorItemDrinking','hasDrinking'], ARRAY['equal'], ARRAY['0'], 'vectorItemDrinking', '0'),
('C11', 'Lifestyle rule 11-drinking', '음주', ARRAY['hasDailyDrinking','vectorItemDrinking','hasDrinking'], ARRAY['lessThanOrEqual','greaterThan'], ARRAY['1','0'], 'vectorItemDrinking', '1'),
('C12', 'Lifestyle rule 12-drinking', '음주', ARRAY['hasDailyDrinking','vectorItemDrinking','hasDrinking'], ARRAY['lessThan','greaterThan'], ARRAY['3','1'], 'vectorItemDrinking', '2'),
('C13', 'Lifestyle rule 13-drinking', '음주', ARRAY['hasDailyDrinking','vectorItemDrinking','hasDrinking'], ARRAY['greaterThanOrEqual'], ARRAY['3'], 'vectorItemDrinking', '3'),
('C17', 'Lifestyle rule 17-exercise', '운동(IPAQ)', ARRAY['hasExercise','hasIPAQLevel','vectorItemExercise'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemExercise', '0'),
('C19', 'Lifestyle rule 19-exercise', '운동(IPAQ)', ARRAY['hasExercise','hasIPAQLevel','vectorItemExercise'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemExercise', '2'),
('C18', 'Lifestyle rule 18-exercise', '운동(IPAQ)', ARRAY['hasExercise','hasIPAQLevel','vectorItemExercise'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemExercise', '1'),
('B13', 'Disease rule 13-eyedisease', '안과질환 합병증', ARRAY['hasEyeDisease','hasEyeDiseaseValue','vectorItemEyeDisease'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemEyeDisease', '0'),
('B14', 'Disease rule 14-eyedisease', '안과질환 합병증', ARRAY['hasEyeDisease','hasEyeDiseaseValue','vectorItemEyeDisease'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemEyeDisease', '1'),
('A01', 'demographic rule 01-gender', '성별', ARRAY['vectorItemMale','hasGender','vectorItemFemale','hasGenderValue'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemFemale', '1'),
('A02', 'demographic rule 02-gender', '성별', ARRAY['vectorItemMale','hasGender','vectorItemFemale','hasGenderValue'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemFemale', '0'),
('B10', 'Disease rule 10-hyperlipidemia', '이상지질혈증 동반질환', ARRAY['hasHyperlipidemia','hasHyperlipidemiaValue','vectorItemHyperlipidemia'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemHyperlipidemia', '0'),
('B09', 'Disease rule 09-hyperlipidemia', '이상지질혈증 동반질환', ARRAY['hasHyperlipidemia','hasHyperlipidemiaValue','vectorItemHyperlipidemia'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemHyperlipidemia', '1'),
('B02', 'Disease rule 02-hypertension', '고혈압 동반질환', ARRAY['hasHypertension','vectorItemHypertension','hasHypertensionValue'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemHypertension', '0'),
('B01', 'Disease rule 01-hypertension', '고혈압 동반질환', ARRAY['hasHypertension','vectorItemHypertension','hasHypertensionValue'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemHypertension', '1'),
('E02', 'Medication rule 02-hypoglycemicdrug', '혈당강하제 복용', ARRAY['hasHypoglycemicDrug','vectorItemHypoglycemicDrug','hasHypoglycemicDrugValue'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemHypoglycemicDrug', NULL),
('E05', 'Medication rule 05-insulin', '인슐린 사용', ARRAY['hasHypoglycemicDrug','vectorItemInsulin','hasInsulinValue'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemInsulin', '0'),
('E04', 'Medication rule 04-insulin', '인슐린 사용', ARRAY['hasHypoglycemicDrug','vectorItemInsulin','hasInsulinValue'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemInsulin', '1'),
('E03', 'Medication rule 03-hypolipidemicdrug', '지질강하제 복용', ARRAY['hasHypolipidemicDrug','hasHypolipidemicDrugValue','vectorItemHypolipidemicDrug'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemHypolipidemicDrug', NULL),
('B16', 'Disease rule 16-kidneydisease', '신장질환 합병증', ARRAY['vectorItemKidneyDisease','hasKidneyDisease','hasKidneyDiseaseValue'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemKidneyDisease', '0'),
('B15', 'Disease rule 15-kidneydisease', '신장질환 합병증', ARRAY['vectorItemKidneyDisease','hasKidneyDisease','hasKidneyDiseaseValue'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemKidneyDisease', '1'),
('D11', 'VitalSIgn rule 11-lipoprotein', '지단백(HDL/LDL)', ARRAY['hasHDLValue','vectorItemLipoprotein','hasLipoprotein'], ARRAY['lessThan'], ARRAY['1.2'], 'vectorItemLipoprotein', '1'),
('D13', 'VitalSIgn rule 13-lipoprotein', '지단백(HDL/LDL)', ARRAY['hasHDLValue','vectorItemLipoprotein','hasLDLValue','hasLipoprotein'], ARRAY['lessThanOrEqual','greaterThanOrEqual'], ARRAY['3.12','1.2'], 'vectorItemLipoprotein', '0'),
('D12', 'VitalSIgn rule 12-lipoprotein', '지단백(HDL/LDL)', ARRAY['vectorItemLipoprotein','hasLDLValue','hasLipoprotein'], ARRAY['greaterThan'], ARRAY['3.12'], 'vectorItemLipoprotein', '1'),
('B21', 'Disease rule 21-liverdisease', '간질환 합병증', ARRAY['vectorItemLiverDisease','hasLiverDisease','hasLiverDiseaseValue'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemLiverDisease', '0'),
('B22', 'Disease rule 22-liverdisease', '간질환 합병증', ARRAY['vectorItemLiverDisease','hasLiverDisease','hasLiverDiseaseValue'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemLiverDisease', '1'),
('B20', 'Disease rule 20-lungdisease', '폐질환 합병증', ARRAY['vectorItemLungDisease','hasLungDisease','hasLungDiseaseValue'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemLungDisease', '0'),
('B19', 'Disease rule 19-lungdisease', '폐질환 합병증', ARRAY['vectorItemLungDisease','hasLungDisease','hasLungDiseaseValue'], ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'vectorItemLungDisease', '1')
ON CONFLICT (rule_code) DO NOTHING;

-- -------------------------
-- 조회 예시
-- -------------------------
-- 혈압(D 카테고리) 위험도 단계 전체 조회:
-- SELECT * FROM cdpeo_swrl_rules WHERE rule_code LIKE 'D0%' AND description_en LIKE '%-bp';
--
-- 특정 수축기혈압 값으로 위험도 등급 매핑 (애플리케이션 레이어에서 body_thresholds 파싱 후 적용):
-- 예: SBP=145 -> D04(140<=SBP<160) 매칭 -> head_value='1'