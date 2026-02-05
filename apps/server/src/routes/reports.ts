import { Router, Request, Response } from 'express';
import type { ApiResponse, Report, GenerateReportInput } from '@jira-planner/shared';
import type { StorageService } from '../services/storageService.js';
import { generateReport } from '../services/reportService.js';

export function createReportsRouter(storage: StorageService): Router {
  const router = Router();

  // GET / - List reports
  router.get('/', (req: Request, res: Response) => {
    try {
      const type = req.query.type as string | undefined;
      const limit = parseInt(req.query.limit as string) || 20;
      const rows = storage.getReports({ type, limit });
      const reports: Report[] = rows.map(r => ({
        id: r.id,
        reportType: r.reportType as Report['reportType'],
        title: r.title,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        markdownContent: r.markdownContent,
        structuredData: r.structuredData,
        createdAt: r.createdAt,
      }));
      const response: ApiResponse<Report[]> = { success: true, data: reports };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list reports',
      });
    }
  });

  // GET /:id - Get report detail
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const row = storage.getReport(req.params.id);
      if (!row) {
        return res.status(404).json({ success: false, error: 'Report not found' });
      }
      const report: Report = {
        id: row.id,
        reportType: row.reportType as Report['reportType'],
        title: row.title,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        markdownContent: row.markdownContent,
        structuredData: row.structuredData,
        createdAt: row.createdAt,
      };
      const response: ApiResponse<Report> = { success: true, data: report };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get report',
      });
    }
  });

  // POST /generate - Generate a new report
  router.post('/generate', async (req: Request, res: Response) => {
    try {
      const input: GenerateReportInput = req.body;
      if (!input.reportType) {
        return res.status(400).json({ success: false, error: 'reportType is required' });
      }
      const report = await generateReport(input, { storage });
      const response: ApiResponse<Report> = { success: true, data: report };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate report',
      });
    }
  });

  // DELETE /:id - Delete a report
  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const deleted = storage.deleteReport(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Report not found' });
      }
      const response: ApiResponse<{ deleted: boolean }> = { success: true, data: { deleted: true } };
      res.json(response);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete report',
      });
    }
  });

  return router;
}
