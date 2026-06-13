export type Intent = 'medical' | 'nutrition' | 'welfare' | 'research' | 'drug' | 'lifestyle' | 'hospital' | 'general';

export interface UserProfile {
  ckd_stage?: string;       // "1기" | "2기" | "3a" | "3b" | "4기" | "5기(투석전)" | "투석중"
  dialysis_type?: string;   // "해당없음" | "혈액투석" | "복막투석" | "신장이식 후"
  diabetes_type?: string;   // "없음" | "1형" | "2형"
  medication?: string;      // "경구약" | "인슐린" | "경구약+인슐린" | "식이조절만"
  other_conditions?: string[]; // ["고혈압"]
  gender?: string;          // "남성" | "여성"
  age?: number;             // 나이
  height?: number;          // 키 (cm)
  target_weight?: number;   // 건체중 = 목표 체중 (kg)
  creatinine?: number;      // 최근 혈액검사 크레아티닌 (mg/dL)
  egfr?: number;            // 사구체여과율 (ml/min/1.73m²)
  limit_sugar?: number;      // 제한섭취량: 당 (g)
  limit_sodium?: number;     // 제한섭취량: 나트륨 (mg)
  limit_potassium?: number;  // 제한섭취량: 칼륨 (mg)
  limit_phosphorus?: number; // 제한섭취량: 인 (mg)
  role?: string;             // "patient" | "caregiver" | "researcher"
}

export interface Entity {
  diseaseType?: 'CKD' | 'DM' | 'BOTH';
  ckdStage?: number;        // 1~5
  keywords: string[];
  welfareType?: string;
}

export interface AgentResponse {
  answer: string;
  agentType: Intent;
  sources: Array<{
    title: string;
    url?: string;
    doi?: string;
    org?: string;
  }>;
  riskLevel?: 'normal' | 'caution' | 'danger' | 'emergency';
}

