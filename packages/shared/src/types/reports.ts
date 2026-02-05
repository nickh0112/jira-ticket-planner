// Reports Types

export type ReportType = 'daily_standup' | 'weekly_leadership' | 'sprint_report';

export interface Report {
  id: string;
  reportType: ReportType;
  title: string;
  periodStart: string;
  periodEnd: string;
  markdownContent: string;
  structuredData: Record<string, any> | null;
  createdAt: string;
}

export interface ReportTemplate {
  id: string;
  reportType: ReportType;
  sections: ReportSection[];
  customInstructions: string | null;
  updatedAt: string;
}

export interface ReportSection {
  key: string;
  title: string;
  enabled: boolean;
}

export interface GenerateReportInput {
  reportType: ReportType;
  periodStart?: string;
  periodEnd?: string;
  customInstructions?: string;
}
