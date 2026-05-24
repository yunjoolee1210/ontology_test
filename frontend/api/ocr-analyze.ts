// Vercel 서버리스 함수 — 검진결과지 이미지 OCR 분석 (OpenAI 비전)
// 이미지(base64 dataURL)를 받아 검사 수치를 추출해 JSON으로 반환. OPENAI_API_KEY 사용.

const FIELDS = [
  'creatinine','bun','egfr','uric_acid','fasting_glucose','hba1c',
  'total_cholesterol','hdl_cholesterol','ldl_cholesterol','triglycerides',
  'sodium','potassium','phosphorus','calcium','hemoglobin','rbc','wbc','platelet',
  'ast','alt','ggt','albumin','total_protein','systolic_bp','diastolic_bp',
];

export const config = { maxDuration: 60 };

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(200).json({ success: false, error: '서버에 OPENAI_API_KEY가 설정되지 않았습니다.' });
    return;
  }
  try {
    const { image } = req.body || {};
    if (!image) { res.status(200).json({ success: false, error: '이미지가 없습니다.' }); return; }

    const sys = [
      '너는 한국 병원 건강검진 결과지 이미지에서 검사 수치를 추출하는 OCR 분석기다.',
      '아래 필드만 추출해 JSON으로만 응답한다(설명 금지). 필드: ' + FIELDS.join(', ') + '.',
      '형식: {"test_date":"YYYY-MM-DD"|null, "hospital_name": string|null, "lab_results": { "<field>": {"value": number, "unit": string} }}',
      '결과지에 없는 항목은 포함하지 마라. 값은 숫자만(추정/창작 금지). 단위는 결과지 표기를 따른다.',
    ].join('\n');

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1500,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: [
            { type: 'text', text: '이 검진결과지에서 검사 수치를 추출해줘.' },
            { type: 'image_url', image_url: { url: image } },
          ] },
        ],
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      res.status(200).json({ success: false, error: `분석 오류: ${data?.error?.message || r.status}` });
      return;
    }
    let parsed: any = {};
    try { parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}'); } catch {}
    res.status(200).json({
      success: true,
      temp_id: 'ocr_' + Date.now(),
      test_date: parsed.test_date || '',
      hospital_name: parsed.hospital_name || '',
      lab_results: parsed.lab_results || {},
      confidence: 0.9,
    });
  } catch (e: any) {
    res.status(200).json({ success: false, error: e?.message || 'unknown' });
  }
}
