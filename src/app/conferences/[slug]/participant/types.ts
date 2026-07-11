// Shared types for the participant view, mirroring the shapes
// ConferenceDetailClient already fetches (MyApplication, RoleConfig, the
// conference_allocations join) so the extracted components don't refetch.

export interface ParticipantApplication {
  id: string;
  role: string;
  status: string;
  payment_status: string;
  amount_paid: number;
}

export interface ParticipantRoleConfig {
  role: string;
  fee_amount: number | null;
  fee_currency: string | null;
  payment_timing: string;
  allow_partial_payments: boolean;
}

export interface ParticipantAllocation {
  id: string;
  country_code: string;
  country_name: string;
  conference_committee_id: string;
  conference_committees: { name: string; position_paper_deadline: string | null } | null;
}
