// Shared types for the participant view, mirroring the shapes
// ConferenceDetailClient already fetches (MyApplication, RoleConfig, the
// conference_allocations join) so the extracted components don't refetch.

import type { FeePhase } from '@/lib/finance';

export interface ParticipantApplication {
  id: string;
  role: string;
  status: string;
  payment_status: string;
  amount_paid: number;
  society_id: string | null;
  self_paid: boolean;
  pledge_type: 'delegation' | null;
  spots_pledged: number | null;
  pledge_confirmed_at: string | null;
}

export interface ParticipantRoleConfig {
  role: string;
  fee_amount: number | null;
  fee_currency: string | null;
  payment_timing: string;
  allow_partial_payments: boolean;
  fee_phases?: FeePhase[] | null;
}

export interface ParticipantAllocation {
  id: string;
  country_code: string;
  country_name: string;
  conference_committee_id: string;
  conference_committees: { name: string; position_paper_deadline: string | null } | null;
}

export interface ParticipantCommittee {
  id: string;
  name: string;
  abbreviation: string | null;
  topics: string[] | null;
  difficulty: string;
  committee_type: string;
  logo_url: string | null;
}
