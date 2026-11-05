// User types
export interface User {
  id: string;
  fullName: string;
  email?: string;
  createdAt: string;
}

export interface OnboardingState {
  step: number;
  fullName: string;
  companyName: string;
  industry?: string;
  website?: string;
  brandRulesText?: string;
  uploadedFiles?: UploadedFile[];
  rulesConfirmed?: boolean;
  completed: boolean;
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content?: string;
}
