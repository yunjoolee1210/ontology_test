import { supabase } from '../lib/supabase';

export interface DialysisLog {
  id: string;
  userId: string;
  treatmentDate: string;
  fluidRemovalL: number | null;
  weightBefore: number | null;
  weightAfter: number | null;
  bpBefore: string;
  bpAfter: string;
  symptoms: string;
  createdAt: string;
}

export type NewDialysisLog = Omit<DialysisLog, 'id' | 'userId' | 'createdAt'>;

const rowToLog = (r: any): DialysisLog => ({
  id: r.id,
  userId: r.user_id,
  treatmentDate: r.treatment_date,
  fluidRemovalL: r.fluid_removal_l ?? null,
  weightBefore: r.weight_before ?? null,
  weightAfter: r.weight_after ?? null,
  bpBefore: r.bp_before ?? '',
  bpAfter: r.bp_after ?? '',
  symptoms: r.symptoms ?? '',
  createdAt: r.created_at,
});

export const listDialysisLogs = async (): Promise<DialysisLog[]> => {
  const { data, error } = await supabase
    .from('dialysis_logs')
    .select('*')
    .order('treatment_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(rowToLog);
};

export const addDialysisLog = async (log: NewDialysisLog): Promise<DialysisLog> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인 필요');
  const { data, error } = await supabase
    .from('dialysis_logs')
    .insert({
      user_id: user.id,
      treatment_date: log.treatmentDate,
      fluid_removal_l: log.fluidRemovalL,
      weight_before: log.weightBefore,
      weight_after: log.weightAfter,
      bp_before: log.bpBefore || null,
      bp_after: log.bpAfter || null,
      symptoms: log.symptoms || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToLog(data);
};

export const deleteDialysisLog = async (id: string): Promise<void> => {
  const { error } = await supabase.from('dialysis_logs').delete().eq('id', id);
  if (error) throw new Error(error.message);
};
