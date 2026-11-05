// Analysis types
export type AnalysisStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type ViolationSeverity = 'critical' | 'major' | 'minor' | 'passed';
export type ComplianceLevel = 'excellent' | 'needs_minor_improvements' | 'needs_revision' | 'non_compliant';

export interface Violation {
  id: string;
  title: string;
  severity: ViolationSeverity;
  explanation: string;
  relevantRule: string;
  ruleId: string;
  evidence: string;
  suggestedCorrection: string;
  boundingBox?: BoundingBox;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export interface AIRecommendation {
  id: string;
  what: string;
  why: string;
  how: string;
  priority: 'high' | 'medium' | 'low';
}

export interface AnalysisResult {
  id: string;
  advertisementName: string;
  imageUrl: string;
  companyName: string;
  complianceScore: number;
  complianceLevel: ComplianceLevel;
  status: AnalysisStatus;
  analysedAt: string;
  violations: Violation[];
  recommendations: AIRecommendation[];
  passedChecks: string[];
  summary: string;
}

export interface AnalysisHistoryItem {
  id: string;
  advertisementName: string;
  thumbnailUrl: string;
  analysedAt: string;
  complianceScore: number;
  complianceLevel: ComplianceLevel;
  status: AnalysisStatus;
  violationsCount: number;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
}

export interface AnalysisJobStatus {
  jobId: string;
  status: AnalysisStatus;
  progress: number;
  currentStage?: string;
  result?: AnalysisResult;
  error?: string;
}
