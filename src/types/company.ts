// Company types
export interface Company {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalAnalyses: number;
  averageComplianceScore: number;
  needsAttention: number;
  fullyCompliant: number;
}
