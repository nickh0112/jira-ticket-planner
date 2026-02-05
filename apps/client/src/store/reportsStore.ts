import { create } from 'zustand';
import type { Report, ReportType } from '@jira-planner/shared';
import {
  getReports,
  getReport,
  generateReport as apiGenerateReport,
  deleteReport as apiDeleteReport,
} from '../utils/api';

interface ReportsState {
  // Data
  reports: Report[];
  currentReport: Report | null;

  // UI State
  isGenerating: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  generateReport: (reportType: ReportType, periodStart: string, periodEnd: string) => Promise<void>;
  fetchReports: () => Promise<void>;
  fetchReport: (id: string) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  setCurrentReport: (report: Report | null) => void;
  setError: (error: string | null) => void;
}

export const useReportsStore = create<ReportsState>((set) => ({
  reports: [],
  currentReport: null,
  isGenerating: false,
  isLoading: false,
  error: null,

  generateReport: async (reportType, periodStart, periodEnd) => {
    set({ isGenerating: true, error: null });
    try {
      const report = await apiGenerateReport({ reportType, periodStart, periodEnd });
      set((state) => ({
        reports: [report, ...state.reports],
        currentReport: report,
        isGenerating: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to generate report',
        isGenerating: false,
      });
    }
  },

  fetchReports: async () => {
    set({ isLoading: true, error: null });
    try {
      const reports = await getReports();
      set({ reports, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load reports',
        isLoading: false,
      });
    }
  },

  fetchReport: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const report = await getReport(id);
      set({ currentReport: report, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load report',
        isLoading: false,
      });
    }
  },

  deleteReport: async (id) => {
    try {
      await apiDeleteReport(id);
      set((state) => ({
        reports: state.reports.filter((r) => r.id !== id),
        currentReport: state.currentReport?.id === id ? null : state.currentReport,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete report' });
    }
  },

  setCurrentReport: (report) => set({ currentReport: report }),
  setError: (error) => set({ error }),
}));
