export const ROLES = {
  STUDENT: 'STUDENT',
  FACULTY: 'FACULTY',
  MAINTENANCE: 'MAINTENANCE',
  ADMIN: 'ADMIN',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const COMPLAINT_STATUS = {
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  ON_HOLD: 'ON_HOLD',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  REJECTED: 'REJECTED',
  REOPENED: 'REOPENED',
} as const;

export type ComplaintStatus = (typeof COMPLAINT_STATUS)[keyof typeof COMPLAINT_STATUS];

export const PRIORITY_LEVELS = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;

export type PriorityLevel = (typeof PRIORITY_LEVELS)[keyof typeof PRIORITY_LEVELS];

export const SAFETY_RISK = {
  IMMEDIATE_DANGER: 'IMMEDIATE_DANGER',
  HAZARD: 'HAZARD',
  NONE: 'NONE',
} as const;

export type SafetyRiskLevel = (typeof SAFETY_RISK)[keyof typeof SAFETY_RISK];

export const SEVERITY = {
  CATASTROPHIC: 'CATASTROPHIC',
  MAJOR: 'MAJOR',
  MODERATE: 'MODERATE',
  MINOR: 'MINOR',
} as const;

export type SeverityLevel = (typeof SEVERITY)[keyof typeof SEVERITY];

export const AFFECTED_COUNT = {
  CAMPUS_WIDE: 'CAMPUS_WIDE',
  BUILDING_WIDE: 'BUILDING_WIDE',
  GROUP: 'GROUP',
  INDIVIDUAL: 'INDIVIDUAL',
} as const;

export type AffectedCountLevel = (typeof AFFECTED_COUNT)[keyof typeof AFFECTED_COUNT];

export interface JWTPayload {
  id: string;
  email: string;
  name: string;
  role: Role;
}
