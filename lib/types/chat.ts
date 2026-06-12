export type Intent = 'medical' | 'nutrition' | 'welfare' | 'research' | 'drug' | 'lifestyle' | 'hospital' | 'general';

export interface UserProfile {
  ckd_stage?: string;       // "1기" | "2기" | "3a" | "3b" | "4기" | "5기(투석전)" | "투석중"
  dialysis_type?: string;   // "해당없음" | "혈액투석" | "복막투석" | "신장이식 후"
  diabetes_type?: string;   // "없음" | "1형" | "2형"
  medication?: string;      // "경구약" | "인슐린" | "경구약+인슐린" | "식이조절만"
  other_conditions?: string[]; // ["고혈압"]
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

