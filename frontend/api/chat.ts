// Vercel 서버리스 함수 — 기본 AI 챗봇 (OpenAI)
// CareKidney 신장병 케어 챗봇. OPENAI_API_KEY(Vercel 환경변수, 서버 전용)로 OpenAI 호출.
// 배포 경로: /api/chat  (frontend/api/chat.ts → Vercel Functions)

const AREA: Record<string, string> = {
  medical: '의료복지',
  nutrition: '식이영양',
  research: '연구·논문',
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(200).json({
      success: false,
      message: '서버에 OPENAI_API_KEY가 설정되지 않았습니다. Vercel 환경변수를 확인해 주세요.',
    });
    return;
  }

  try {
    const { message, agent_type = 'nutrition', history = [], user_profile } = req.body || {};
    const area = AREA[agent_type] || '신장병 케어';

    const system = [
      '당신은 만성콩팥병(CKD) 환자를 돕는 한국어 건강 어시스턴트 "케어가이드"입니다.',
      `현재 상담 분야: ${area}.`,
      '신장병 환자에게 도움이 되는 정확하고 따뜻한 정보를 제공하세요.',
      '확정적인 의학 진단/처방은 하지 말고, 필요하면 의료진 상담을 권하세요.',
      '한국어로 간결하고 이해하기 쉽게, 마크다운을 적절히 사용해 답변하세요.',
      user_profile ? `참고용 사용자 프로필: ${JSON.stringify(user_profile)}` : '',
    ].filter(Boolean).join('\n');

    // 이전 대화 → OpenAI messages (선두 assistant 제거: user로 시작하도록)
    let prior = (Array.isArray(history) ? history : [])
      .filter((m: any) => m && m.content)
      .map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: String(m.content),
      }));
    while (prior.length && prior[0].role !== 'user') prior.shift();

    const messages = [
      { role: 'system', content: system },
      ...prior.slice(-8),
      { role: 'user', content: String(message || '') },
    ];

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 1024,
        temperature: 0.5,
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      res.status(200).json({
        success: false,
        message: `AI 오류: ${data?.error?.message || r.status}`,
      });
      return;
    }

    const reply = data?.choices?.[0]?.message?.content || '죄송합니다, 답변을 생성하지 못했어요.';
    res.status(200).json({ success: true, message: reply, agent_type });
  } catch (e: any) {
    res.status(200).json({ success: false, message: `오류: ${e?.message || 'unknown'}` });
  }
}
