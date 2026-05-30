/**
 * 의학 정보 제공 관련 안전성 및 필터링 검사를 담당합니다.
 */
export function checkSafety(message: string): { isSafe: boolean; reason?: string } {
  const lowercaseMsg = message.toLowerCase();

  // 1. 심각한 응급 상황 관련 키워드 확인
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

  return { isSafe: true };
}
