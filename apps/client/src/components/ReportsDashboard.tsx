import { useEffect, useState } from 'react';
import { useReportsStore } from '../store/reportsStore';
import type { ReportType, Report } from '@jira-planner/shared';

const REPORT_TYPES: { value: ReportType; label: string; description: string }[] = [
  { value: 'daily_standup', label: 'Daily Standup', description: 'Summary of today\'s progress and blockers' },
  { value: 'weekly_leadership', label: 'Weekly Leadership', description: 'High-level weekly status for leadership' },
  { value: 'sprint_report', label: 'Sprint Report', description: 'Full sprint retrospective and metrics' },
];

const REPORT_TYPE_STYLES: Record<ReportType, { bg: string; text: string }> = {
  daily_standup: { bg: 'bg-blue-900/40', text: 'text-blue-400' },
  weekly_leadership: { bg: 'bg-purple-900/40', text: 'text-purple-400' },
  sprint_report: { bg: 'bg-green-900/40', text: 'text-green-400' },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ReportTypeBadge({ type }: { type: ReportType }) {
  const style = REPORT_TYPE_STYLES[type];
  const label = REPORT_TYPES.find((t) => t.value === type)?.label ?? type;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-pixel ${style.bg} ${style.text}`}>
      {label}
    </span>
  );
}

/** Basic markdown renderer - handles headers, bold, lists, and paragraphs */
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headers
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={i} className="font-pixel text-sm text-gold mt-4 mb-2">
          {renderInline(line.slice(4))}
        </h4>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h3 key={i} className="font-pixel text-pixel-md text-gold mt-5 mb-2">
          {renderInline(line.slice(3))}
        </h3>
      );
    } else if (line.startsWith('# ')) {
      elements.push(
        <h2 key={i} className="font-pixel text-pixel-lg text-gold mt-6 mb-3">
          {renderInline(line.slice(2))}
        </h2>
      );
    }
    // Unordered list items
    else if (line.match(/^\s*[-*]\s/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\s*[-*]\s/)) {
        items.push(lines[i].replace(/^\s*[-*]\s/, ''));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc list-inside space-y-1 my-2 text-text-primary font-readable">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }
    // Ordered list items
    else if (line.match(/^\s*\d+\.\s/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\s*\d+\.\s/)) {
        items.push(lines[i].replace(/^\s*\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal list-inside space-y-1 my-2 text-text-primary font-readable">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }
    // Horizontal rule
    else if (line.match(/^---+$/)) {
      elements.push(<hr key={i} className="border-border-gold/30 my-4" />);
    }
    // Empty line
    else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    }
    // Regular paragraph
    else {
      elements.push(
        <p key={i} className="text-text-primary font-readable leading-relaxed my-1">
          {renderInline(line)}
        </p>
      );
    }
    i++;
  }

  return <div>{elements}</div>;
}

/** Render inline markdown: bold, italic, code */
function renderInline(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  let remaining = text;
  let keyCounter = 0;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(remaining.slice(0, boldMatch.index));
      }
      parts.push(
        <strong key={`b-${keyCounter++}`} className="font-medium text-gold">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }

    // Inline code
    const codeMatch = remaining.match(/`(.+?)`/);
    if (codeMatch && codeMatch.index !== undefined) {
      if (codeMatch.index > 0) {
        parts.push(remaining.slice(0, codeMatch.index));
      }
      parts.push(
        <code key={`c-${keyCounter++}`} className="px-1 py-0.5 bg-stone-primary rounded text-sm text-cyan-400">
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch.index + codeMatch[0].length);
      continue;
    }

    // No more matches, push rest
    parts.push(remaining);
    break;
  }

  return parts;
}

function ReportViewer({ report }: { report: Report }) {
  const [copied, setCopied] = useState(false);
  const { deleteReport } = useReportsStore();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(report.markdownContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = report.markdownContent;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-stone-secondary border-2 border-border-gold rounded-lg shadow-pixel overflow-hidden">
      <div className="px-4 py-3 border-b border-border-gold/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ReportTypeBadge type={report.reportType} />
          <h3 className="font-pixel text-pixel-md text-gold">{report.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className={`px-3 py-1 rounded text-xs font-pixel transition-colors border ${
              copied
                ? 'bg-green-900/40 text-green-400 border-green-700/40'
                : 'bg-stone-primary text-text-secondary border-border-gold/40 hover:text-text-primary'
            }`}
          >
            {copied ? 'Copied!' : 'Copy Markdown'}
          </button>
          <button
            onClick={() => deleteReport(report.id)}
            className="px-3 py-1 bg-red-900/40 text-red-400 rounded text-xs font-pixel hover:bg-red-900/60 transition-colors border border-red-700/40"
          >
            Delete
          </button>
        </div>
      </div>
      <div className="px-4 py-2 border-b border-border-gold/10 flex items-center gap-4 text-xs text-text-secondary font-readable">
        <span>Period: {formatDate(report.periodStart)} - {formatDate(report.periodEnd)}</span>
        <span>Generated: {formatTime(report.createdAt)}</span>
      </div>
      <div className="p-6">
        <MarkdownContent content={report.markdownContent} />
      </div>
    </div>
  );
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function getWeekAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

export function ReportsDashboard() {
  const {
    reports,
    currentReport,
    isGenerating,
    isLoading,
    error,
    generateReport,
    fetchReports,
    setCurrentReport,
    setError,
  } = useReportsStore();

  const [reportType, setReportType] = useState<ReportType>('daily_standup');
  const [periodStart, setPeriodStart] = useState(getWeekAgoStr());
  const [periodEnd, setPeriodEnd] = useState(getTodayStr());
  const [showGenerator, setShowGenerator] = useState(false);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleGenerate = async () => {
    await generateReport(reportType, periodStart, periodEnd);
    setShowGenerator(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-pixel text-pixel-lg text-gold">Reports Dashboard</h2>
          <p className="font-readable text-beige/60">
            Generate and view team reports
          </p>
        </div>
        <button
          onClick={() => setShowGenerator(!showGenerator)}
          className="stone-button flex items-center gap-2"
        >
          <span>&#43;</span>
          <span>Generate Report</span>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="stone-card bg-red-900/30 border-red-500/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-red-400 font-readable">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
              &#10005;
            </button>
          </div>
        </div>
      )}

      {/* Generator Form */}
      {showGenerator && (
        <div className="bg-stone-secondary border-2 border-border-gold rounded-lg shadow-pixel overflow-hidden">
          <div className="px-4 py-3 border-b border-border-gold/30">
            <h3 className="font-pixel text-pixel-md text-gold">Generate New Report</h3>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-text-secondary text-sm font-readable mb-2">Report Type</label>
              <div className="grid grid-cols-3 gap-3">
                {REPORT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setReportType(t.value)}
                    className={`p-3 rounded border text-left transition-colors ${
                      reportType === t.value
                        ? 'border-gold bg-gold/10'
                        : 'border-border-gold/30 bg-stone-primary/40 hover:border-border-gold/60'
                    }`}
                  >
                    <p className={`font-pixel text-sm ${reportType === t.value ? 'text-gold' : 'text-text-primary'}`}>
                      {t.label}
                    </p>
                    <p className="font-readable text-text-secondary text-xs mt-1">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-text-secondary text-sm font-readable mb-1">Period Start</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-primary border border-border-gold/40 rounded text-text-primary font-readable text-sm focus:outline-none focus:border-gold"
                />
              </div>
              <div className="flex-1">
                <label className="block text-text-secondary text-sm font-readable mb-1">Period End</label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-primary border border-border-gold/40 rounded text-text-primary font-readable text-sm focus:outline-none focus:border-gold"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowGenerator(false)}
                className="px-4 py-2 text-text-secondary font-readable text-sm hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="stone-button px-6 flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin">&#8635;</span>
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <span>&#9881;</span>
                    <span>Generate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Current Report Viewer */}
      {currentReport && (
        <div>
          <button
            onClick={() => setCurrentReport(null)}
            className="text-text-secondary hover:text-text-primary font-readable text-sm mb-3 inline-block"
          >
            &#8592; Back to report list
          </button>
          <ReportViewer report={currentReport} />
        </div>
      )}

      {/* Report List */}
      {!currentReport && (
        <div className="bg-stone-secondary border-2 border-border-gold rounded-lg shadow-pixel overflow-hidden">
          <div className="px-4 py-3 border-b border-border-gold/30 flex items-center justify-between">
            <h3 className="font-pixel text-pixel-md text-gold">Report History</h3>
            <span className="text-text-secondary text-sm font-readable">
              {reports.length} reports
            </span>
          </div>
          {isLoading ? (
            <div className="text-text-secondary text-center py-12 font-readable">Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className="text-text-secondary text-center py-12 font-readable">
              No reports generated yet. Click "Generate Report" to get started.
            </div>
          ) : (
            <div className="divide-y divide-border-gold/10">
              {reports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => setCurrentReport(report)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-primary/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <ReportTypeBadge type={report.reportType} />
                    <span className="font-readable text-text-primary">{report.title}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm font-readable text-text-secondary">
                    <span>{formatDate(report.periodStart)} - {formatDate(report.periodEnd)}</span>
                    <span>{formatTime(report.createdAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
