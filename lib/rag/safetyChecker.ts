/**
 * 의학 정보 제공 관련 안전성 및 필터링 검사를 담당합니다.
 */
export function checkSafety(message: string): { isSafe: boolean; reason?: string } {
  const lowercaseMsg = message.toLowerCase().trim();

  // 1. 심각한 정신건강 응급 상황 관련 키워드 확인
  const emergencyKeywords = [
    '자살', '목매', '죽고 싶', '죽을 거', '상해', '살인'
  ];

  const hasEmergency = emergencyKeywords.some(kw => lowercaseMsg.includes(kw));
  if (hasEmergency) {
    return {
      isSafe: false,
      reason: '정신건강 응급상황 혹은 생명에 위협이 되는 발언이 감지되었습니다. 24시간 상담전화 109 또는 119로 즉시 연락하시어 도움을 받으시기 바랍니다.',
    };
  }

  // 2. 비과학적 극단적 치료법 권장 필터링 등
  const dangerousCures = [
    '신장 다 고쳤다', '기적의 약', '완치 보장', '의사 필요 없다', '처방 필요 없다'
  ];
  const hasDangerousCure = dangerousCures.some(kw => lowercaseMsg.includes(kw));
  if (hasDangerousCure) {
    return {
      isSafe: false,
      reason: '검증되지 않은 극단적인 치료 방식이나 완치 보장을 유도하는 질문은 지원하지 않습니다. 반드시 공인된 의료진과 상담해 주세요.',
    };
  }

  // 3. ⚠️ 의료 가드레일 적용 (진단 및 처방 작성 시도 금지)
  const rxKeywords = ['처방전', '처방서', '약 지어', '약 처방', '처방해', '진단서', '병명 판정', '확진해'];
  const hasRxRequest = rxKeywords.some(kw => lowercaseMsg.includes(kw));
  if (hasRxRequest) {
    return {
      isSafe: false,
      reason: '⚠️ 콩당콩당 AI는 의료 진단서나 처방전을 발급 및 작성할 수 없습니다. 정확한 의학적 판정은 반드시 의료기관에 직접 내원하시어 담당 전문의와 대면 상담해 주시기 바랍니다.',
    };
  }

  const doseKeywords = ['약 끊', '약 안 먹', '약 안먹', '약 중단', '복용량 늘', '용량 변경', '약물 변경', '약 조절'];
  const hasDoseChangeRequest = doseKeywords.some(kw => lowercaseMsg.includes(kw));
  if (hasDoseChangeRequest) {
    return {
      isSafe: false,
      reason: '⚠️ AI의 임의 가이드에 따라 복용 중인 전문 의약품의 용량을 조절하거나 복용을 중단하는 것은 대단히 위험합니다. 약물 복용 계획 변경은 반드시 주치의와 상의한 후 결정해야 합니다.',
    };
  }

  // 4. 🚫 Out-of-Scope 영역 정의 (만성 신장병, 당뇨병, 고혈압 이외의 주제 차단)
  // 타겟 질환 관련 핵심 키워드 목록
  const targetKeywords = [
    // 콩팥병(CKD) 관련
    '신장', '콩팥', '신부전', '투석', 'egfr', '크레아티닌', '단백뇨', '거품뇨', '부종', '사구체', 'ckd', '요독',
    // 당뇨병(DM) 관련
    '당뇨', '혈당', '인슐린', '췌장', '저혈당', '고혈당', '당화혈색소', 'dm', '바로잰', 'glucose',
    // 고혈압(HTN) 관련
    '혈압', '고혈압', '수축기', '이완기', '압력', 'htn', '맥박'
  ];

  // 아예 비의료 영역(날씨, 주식, 연예, 코딩 등) 및 타 질환(암, 감기, 코로나, 성형, 임플란트 등)을 필터링하기 위한 검사
  const hasTargetKeyword = targetKeywords.some(kw => lowercaseMsg.includes(kw));
  
  // 일반적인 건강/의료 기본 용어 허용 (단, 타겟 질환 맥락과 함께 쓰이는 경우를 위해 최소한으로)
  const generalMedicalKeywords = ['건강', '의사', '병원', '약물', '식단', '운동', '검사', '복지', '보험', '산정특례', '장애'];
  const hasGeneralMedical = generalMedicalKeywords.some(kw => lowercaseMsg.includes(kw));

  // 타겟 질환 관련 키워드가 없고 일반 의료 키워드도 없거나, 아예 엉뚱한 비타겟 질환이 메인인 경우 차단
  const nonTargetDiseases = ['감기', '독감', '코로나', '백신', '암', '성형', '임플란트', '치과', '피부과', '안과', '사랑니', '발치', '치아', '충치'];
  const hasNonTargetDisease = nonTargetDiseases.some(kw => lowercaseMsg.includes(kw));

  if (hasNonTargetDisease || (!hasTargetKeyword && !hasGeneralMedical)) {
    return {
      isSafe: false,
      reason: '저희 콩당콩당 서비스는 만성 신장병(CKD), 당뇨병(DM), 고혈압(HTN) 복합 질환의 관리 지침에 특화되어 있습니다. 다른 질환군이나 의료 이외의 일반 분야(날씨, 주식, 프로그래밍 등)에 대한 질문에는 답변을 드리지 못하는 점 양해 부탁드립니다.',
    };
  }

  return { isSafe: true };
}

