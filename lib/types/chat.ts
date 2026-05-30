export type Intent = 'research' | 'welfare' | 'general';

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
}
