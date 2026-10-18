import { PriorityLevel, SafetyRiskLevel, SeverityLevel, AffectedCountLevel } from '../types';

export interface PriorityEvaluationInput {
  safetyRisk: SafetyRiskLevel;
  severity: SeverityLevel;
  affectedCount: AffectedCountLevel;
  isLocationCritical: boolean;
  categorySlaHours?: number;
}

export interface PriorityEvaluationResult {
  priority: PriorityLevel;
  score: number;
  slaHours: number;
  slaDeadline: Date;
  breakdown: {
    safetyScore: number;
    severityScore: number;
    affectedScore: number;
    locationScore: number;
    reasoning: string;
  };
}

export const SLA_HOURS_MAP: Record<PriorityLevel, number> = {
  CRITICAL: 4,
  HIGH: 24,
  MEDIUM: 72,
  LOW: 168,
};

export function calculatePriority(input: PriorityEvaluationInput, submittedAt: Date = new Date()): PriorityEvaluationResult {
  let safetyScore = 0;
  if (input.safetyRisk === 'IMMEDIATE_DANGER') {
    safetyScore = 45;
  } else if (input.safetyRisk === 'HAZARD') {
    safetyScore = 25;
  }

  let severityScore = 5;
  switch (input.severity) {
    case 'CATASTROPHIC':
      severityScore = 35;
      break;
    case 'MAJOR':
      severityScore = 25;
      break;
    case 'MODERATE':
      severityScore = 15;
      break;
    case 'MINOR':
    default:
      severityScore = 5;
      break;
  }

  let affectedScore = 2;
  switch (input.affectedCount) {
    case 'CAMPUS_WIDE':
      affectedScore = 25;
      break;
    case 'BUILDING_WIDE':
      affectedScore = 18;
      break;
    case 'GROUP':
      affectedScore = 10;
      break;
    case 'INDIVIDUAL':
    default:
      affectedScore = 2;
      break;
  }

  const locationScore = input.isLocationCritical ? 15 : 0;
  const totalScore = safetyScore + severityScore + affectedScore + locationScore;

  let priority: PriorityLevel = 'LOW';
  let reasoning = '';

  // Rule 1: Immediate danger rule
  if (input.safetyRisk === 'IMMEDIATE_DANGER') {
    priority = 'CRITICAL';
    reasoning = 'Immediate safety hazard detected. Mandatory escalation to Critical priority with 4-hour SLA.';
  } else if (totalScore >= 75) {
    priority = 'CRITICAL';
    reasoning = `High impact composite score (${totalScore}/120) with high severity and broad campus footprint triggers Critical tier.`;
  } else if (totalScore >= 45) {
    priority = 'HIGH';
    reasoning = `Substantial impact composite score (${totalScore}/120) warrants rapid turnaround within 24 hours.`;
  } else if (totalScore >= 22) {
    priority = 'MEDIUM';
    reasoning = `Standard maintenance priority (${totalScore}/120). Assigned 72-hour operational SLA.`;
  } else {
    priority = 'LOW';
    reasoning = `Minor localized issue (${totalScore}/120). Assigned 7-day scheduled maintenance SLA.`;
  }

  // Calculate SLA deadline
  let slaHours = SLA_HOURS_MAP[priority];
  if (input.categorySlaHours && input.categorySlaHours < slaHours && priority !== 'CRITICAL') {
    slaHours = input.categorySlaHours;
  }

  const slaDeadline = new Date(submittedAt.getTime() + slaHours * 60 * 60 * 1000);

  return {
    priority,
    score: totalScore,
    slaHours,
    slaDeadline,
    breakdown: {
      safetyScore,
      severityScore,
      affectedScore,
      locationScore,
      reasoning,
    },
  };
}
