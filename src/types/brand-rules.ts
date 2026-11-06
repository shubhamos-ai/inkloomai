// Brand rules types
export type RuleCategory =
  | 'logo'
  | 'typography'
  | 'colour_palette'
  | 'messaging'
  | 'advertising_claims'
  | 'restricted_content'
  | 'legal_compliance'
  | 'general';

export interface BrandRule {
  id: string;
  /** Backend rule code (e.g. BR001) — preferred key for updates. */
  code?: string;
  category: RuleCategory;
  title: string;
  description: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BrandBrain {
  id: string;
  companyId: string;
  version: string;
  totalRules: number;
  rulesText?: string;
  rules: BrandRule[];
  lastUpdatedAt: string;
  status: 'active' | 'processing' | 'draft';
}

export interface BrandBrainSetupPayload {
  companyName: string;
  industry?: string;
  website?: string;
  rulesText?: string;
  uploadedFiles?: {
    name: string;
    size: number;
    type: string;
    content?: string;
  }[];
}
