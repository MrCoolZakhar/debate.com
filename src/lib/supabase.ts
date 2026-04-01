import { createClient } from '@supabase/supabase-js';
 
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
 
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
 
// ── TypeScript types that match our database tables ──────────────────────────
// These mirror the types.ts file Peter wrote, but shaped for the DB schema.
 
export type DbCommittee = {
  id: string;
  code: string;
  name: string;
  topic: string;
  chair_names: string[];
  phase: string;
  speaker_time_limit: number;
  caucus: DbCaucus | null;
  created_at: string;
  expires_at: string | null;
};
 
export type DbDelegate = {
  id: string;
  committee_id: string;
  country: string;
  status: 'absent' | 'present' | 'present-voting';
};
 
export type DbSpeakersListEntry = {
  id: string;
  committee_id: string;
  delegate_id: string;
  country: string;
  position: number;
};
 
export type DbCurrentSpeaker = {
  committee_id: string;
  delegate_id: string | null;
  country: string | null;
  time_remaining: number;
};
 
export type DbMotion = {
  id: string;
  committee_id: string;
  type: string;
  proposed_by: string;
  total_time: number;
  speaking_time: number;
  topic: string;
  status: 'pending' | 'passed' | 'failed';
  disruptiveness: number;
  created_at: string;
};
 
export type DbDocument = {
  id: string;
  committee_id: string;
  title: string;
  type: 'working-paper' | 'draft-resolution';
  uploader_country: string;
  file_url: string | null;
  content: string | null;
  status: 'submitted' | 'approved' | 'rejected' | 'passed' | 'failed';
  created_at: string;
};
 
export type DbMessage = {
  id: string;
  committee_id: string;
  sender: string;
  content: string;
  is_private: boolean;
  created_at: string;
};
 
export type DbFeedback = {
  id: string;
  committee_id: string;
  country: string;
  chair_name: string;
  content: string;
  created_at: string;
};
 
export type DbCaucus = {
  active: boolean;
  type: 'moderated' | 'unmoderated';
  totalTime: number;
  remainingTime: number;
  speakingTime: number;
  speakerTimeRemaining: number;
  purpose: string;
  currentSpeaker: string | null;
  proposedBy: string;
  proposerPosition: 'first' | 'last' | null;
  spokenCountries: string[];
};