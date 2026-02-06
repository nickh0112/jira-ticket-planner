import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import {
  getJiraConfig,
  updateJiraConfig,
  testJiraConnection,
  syncJiraData,
  getEpics,
  getTeamMembers,
  getProjectContext,
  updateProjectContext,
} from '../utils/api';
import type { JiraSyncResult, ProjectContextInput } from '@jira-planner/shared';

interface JiraFormData {
  baseUrl: string;
  projectKey: string;
  epicLinkField: string;
  teamName: string;
  defaultBoardId: string;
  designBoardId: string;
  workTypeFieldId: string;
  teamFieldId: string;
  teamValue: string;
}

const emptyForm: JiraFormData = {
  baseUrl: '',
  projectKey: '',
  epicLinkField: '',
  teamName: '',
  defaultBoardId: '',
  designBoardId: '',
  workTypeFieldId: '',
  teamFieldId: '',
  teamValue: '',
};

interface ProjectContextFormData {
  projectName: string;
  description: string;
  techStack: string;
  architecture: string;
  productAreas: string;
  conventions: string;
  additionalContext: string;
}

const emptyProjectContext: ProjectContextFormData = {
  projectName: '',
  description: '',
  techStack: '',
  architecture: '',
  productAreas: '',
  conventions: '',
  additionalContext: '',
};

export function JiraSettings() {
  const { showToast, setEpics, setTeamMembers } = useStore();

  const [formData, setFormData] = useState<JiraFormData>(emptyForm);
  const [projectContextData, setProjectContextData] = useState<ProjectContextFormData>(emptyProjectContext);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingContext, setIsSavingContext] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [syncResult, setSyncResult] = useState<JiraSyncResult | null>(null);

  useEffect(() => {
    loadConfig();
    loadProjectContext();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const { config } = await getJiraConfig();
      if (config) {
        setFormData({
          baseUrl: config.baseUrl,
          projectKey: config.projectKey,
          epicLinkField: config.epicLinkField || '',
          teamName: config.teamName || '',
          defaultBoardId: config.defaultBoardId?.toString() || '',
          designBoardId: config.designBoardId?.toString() || '',
          workTypeFieldId: config.workTypeFieldId || '',
          teamFieldId: config.teamFieldId || '',
          teamValue: config.teamValue || '',
        });
      }
    } catch (error) {
      showToast('Failed to load Jira configuration', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadProjectContext = async () => {
    try {
      const { context } = await getProjectContext();
      if (context) {
        setProjectContextData({
          projectName: context.projectName || '',
          description: context.description || '',
          techStack: context.techStack || '',
          architecture: context.architecture || '',
          productAreas: context.productAreas || '',
          conventions: context.conventions || '',
          additionalContext: context.additionalContext || '',
        });
      }
    } catch (error) {
      // Silently fail - project context is optional
      console.error('Failed to load project context:', error);
    }
  };

  const handleSaveProjectContext = async () => {
    setIsSavingContext(true);
    try {
      const input: ProjectContextInput = {
        projectName: projectContextData.projectName,
        description: projectContextData.description,
        techStack: projectContextData.techStack,
        architecture: projectContextData.architecture,
        productAreas: projectContextData.productAreas,
        conventions: projectContextData.conventions,
        additionalContext: projectContextData.additionalContext,
      };
      await updateProjectContext(input);
      showToast('Project context saved!', 'success');
    } catch (error) {
      showToast('Failed to save project context', 'error');
    } finally {
      setIsSavingContext(false);
    }
  };

  const handleSave = async () => {
    if (!formData.baseUrl.trim() || !formData.projectKey.trim()) {
      showToast('Base URL and project key are required', 'error');
      return;
    }

    // Ensure URL doesn't have trailing slash
    const baseUrl = formData.baseUrl.replace(/\/+$/, '');

    setIsSaving(true);
    try {
      await updateJiraConfig({
        baseUrl,
        projectKey: formData.projectKey.toUpperCase(),
        epicLinkField: formData.epicLinkField || undefined,
        teamName: formData.teamName || undefined,
        defaultBoardId: formData.defaultBoardId ? parseInt(formData.defaultBoardId, 10) : undefined,
        designBoardId: formData.designBoardId ? parseInt(formData.designBoardId, 10) : undefined,
        workTypeFieldId: formData.workTypeFieldId || undefined,
        teamFieldId: formData.teamFieldId || undefined,
        teamValue: formData.teamValue || undefined,
      });
      setFormData((prev) => ({
        ...prev,
        baseUrl,
        projectKey: formData.projectKey.toUpperCase(),
      }));
      showToast('Jira configuration saved!', 'success');
      setTestResult(null);
    } catch (error) {
      showToast('Failed to save configuration', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testJiraConnection();
      if (result.success) {
        setTestResult({
          success: true,
          message: `Connected to project: ${result.projectName}`,
        });
      } else {
        setTestResult({
          success: false,
          message: result.error || 'Connection failed',
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncJiraData();
      setSyncResult(result);

      // Refresh the store with the synced data
      const [epicsRes, teamRes] = await Promise.all([
        getEpics(),
        getTeamMembers(),
      ]);
      setEpics(epicsRes.epics);
      setTeamMembers(teamRes.members);

      showToast(
        `Synced ${result.users.synced} users and ${result.epics.synced} epics from Jira`,
        'success'
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to sync Jira data',
        'error'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="panel p-8 text-center">
        <div className="font-pixel text-pixel-xs text-beige/70">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">gear</span>
        <h2 className="font-pixel text-pixel-sm text-gold">SETTINGS</h2>
      </div>

      {/* Jira Configuration */}
      <div className="panel p-6 space-y-6">
        <div className="flex items-center gap-3">
          <span className="text-xl">link</span>
          <h3 className="font-pixel text-pixel-xs text-gold">JIRA INTEGRATION</h3>
        </div>
        <div className="pixel-divider" />

        {/* Environment Variables Notice */}
        <div className="p-4 bg-stone-primary border-2 border-beige/20 rounded">
          <p className="font-readable text-base text-beige/70 mb-2">
            <strong>Authentication:</strong> Set the following environment variables on the server:
          </p>
          <code className="block font-mono text-sm text-gold/80 bg-stone-secondary p-2 rounded">
            JIRA_EMAIL=your-email@company.com
            <br />
            JIRA_API_TOKEN=your-api-token
          </code>
          <p className="font-readable text-sm text-beige/50 mt-2">
            Generate an API token at:{' '}
            <a
              href="https://id.atlassian.com/manage-profile/security/api-tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-rarity-rare underline"
            >
              Atlassian API Tokens
            </a>
          </p>
        </div>

        {/* Configuration Form */}
        <div className="space-y-4">
          <div>
            <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
              Jira Base URL *
            </label>
            <input
              type="text"
              value={formData.baseUrl}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, baseUrl: e.target.value }))
              }
              className="pixel-input w-full"
              placeholder="https://your-company.atlassian.net"
            />
            <p className="font-readable text-sm text-beige/50 mt-1">
              Your Jira Cloud instance URL (without trailing slash)
            </p>
          </div>

          <div>
            <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
              Project Key *
            </label>
            <input
              type="text"
              value={formData.projectKey}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  projectKey: e.target.value.toUpperCase(),
                }))
              }
              className="pixel-input w-full max-w-[200px]"
              placeholder="FOAM"
            />
            <p className="font-readable text-sm text-beige/50 mt-1">
              The key of the Jira project where issues will be created
            </p>
          </div>

          <div>
            <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
              Epic Link Field (Optional)
            </label>
            <input
              type="text"
              value={formData.epicLinkField}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, epicLinkField: e.target.value }))
              }
              className="pixel-input w-full max-w-[300px]"
              placeholder="customfield_10014"
            />
            <p className="font-readable text-sm text-beige/50 mt-1">
              Custom field ID for linking issues to epics. Find this in Jira's field configuration.
            </p>
          </div>
        </div>

        <div className="pixel-divider" />

        {/* General Settings */}
        <div className="flex items-center gap-3">
          <span className="text-xl">team</span>
          <h3 className="font-pixel text-pixel-xs text-gold">TEAM & BOARD SETTINGS</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
              Team Name (Optional)
            </label>
            <input
              type="text"
              value={formData.teamName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, teamName: e.target.value }))
              }
              className="pixel-input w-full max-w-[300px]"
              placeholder="Squad - DI"
            />
            <p className="font-readable text-sm text-beige/50 mt-1">
              Display name for your team
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-[400px]">
            <div>
              <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
                Default Board ID
              </label>
              <input
                type="number"
                value={formData.defaultBoardId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, defaultBoardId: e.target.value }))
                }
                className="pixel-input w-full"
                placeholder="90"
              />
              <p className="font-readable text-sm text-beige/50 mt-1">
                Main board for tickets
              </p>
            </div>

            <div>
              <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
                Design Board ID
              </label>
              <input
                type="number"
                value={formData.designBoardId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, designBoardId: e.target.value }))
                }
                className="pixel-input w-full"
                placeholder="74"
              />
              <p className="font-readable text-sm text-beige/50 mt-1">
                Board for design tickets
              </p>
            </div>
          </div>

          <div>
            <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
              Work Type Field ID (Optional)
            </label>
            <input
              type="text"
              value={formData.workTypeFieldId}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, workTypeFieldId: e.target.value }))
              }
              className="pixel-input w-full max-w-[300px]"
              placeholder="customfield_10015"
            />
            <p className="font-readable text-sm text-beige/50 mt-1">
              Custom field ID for Work Type (determines board routing)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-[600px]">
            <div>
              <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
                Team Field ID (Optional)
              </label>
              <input
                type="text"
                value={formData.teamFieldId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, teamFieldId: e.target.value }))
                }
                className="pixel-input w-full"
                placeholder="customfield_10001"
              />
              <p className="font-readable text-sm text-beige/50 mt-1">
                Custom field ID for Team filter
              </p>
            </div>

            <div>
              <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
                Team ID (Optional)
              </label>
              <input
                type="text"
                value={formData.teamValue}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, teamValue: e.target.value }))
                }
                className="pixel-input w-full"
                placeholder="8cf2ff44-81d3-4f69-97b7-9aa098e07deb"
              />
              <p className="font-readable text-sm text-beige/50 mt-1">
                Team UUID to filter epics by (not display name)
              </p>
            </div>
          </div>
        </div>

        {/* Test Result */}
        {testResult && (
          <div
            className={`p-4 border-2 rounded ${
              testResult.success
                ? 'bg-quest-complete/10 border-quest-complete'
                : 'bg-quest-abandoned/10 border-quest-abandoned'
            }`}
          >
            <p
              className={`font-readable text-base ${
                testResult.success ? 'text-quest-complete' : 'text-quest-abandoned'
              }`}
            >
              {testResult.success ? 'check ' : 'error '}
              {testResult.message}
            </p>
          </div>
        )}

        {/* Sync Result */}
        {syncResult && (
          <div className="p-4 border-2 rounded bg-quest-complete/10 border-quest-complete">
            <p className="font-readable text-base text-quest-complete mb-2">
              Sync completed successfully!
            </p>
            <ul className="font-readable text-sm text-beige/70 space-y-1">
              <li>Users: created {syncResult.users.created} new, updated {syncResult.users.synced} existing ({syncResult.users.total} in Jira)</li>
              <li>Epics synced: {syncResult.epics.synced} / {syncResult.epics.total}</li>
              {syncResult.sprints && (
                <li>Sprints cached: {syncResult.sprints.synced}</li>
              )}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="pixel-btn pixel-btn-primary text-pixel-xs disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
          <button
            onClick={handleTest}
            disabled={isTesting || !formData.baseUrl || !formData.projectKey}
            className="pixel-btn text-pixel-xs disabled:opacity-50"
          >
            {isTesting ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            onClick={handleSync}
            disabled={isSyncing || !formData.baseUrl || !formData.projectKey}
            className="pixel-btn text-pixel-xs disabled:opacity-50"
            title="Sync team members and epics from Jira"
          >
            {isSyncing ? 'Syncing...' : 'Sync from Jira'}
          </button>
        </div>
      </div>

      {/* Project Context Section */}
      <div className="panel p-6 space-y-6">
        <div className="flex items-center gap-3">
          <span className="text-xl">brain</span>
          <h3 className="font-pixel text-pixel-xs text-gold">PROJECT CONTEXT (FOR AI)</h3>
        </div>
        <div className="pixel-divider" />

        <p className="font-readable text-base text-beige/70">
          Provide context about your project to help the Forge AI generate more relevant and tailored ideas, tickets, and PRDs.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={projectContextData.projectName}
              onChange={(e) =>
                setProjectContextData((prev) => ({ ...prev, projectName: e.target.value }))
              }
              className="pixel-input w-full max-w-[400px]"
              placeholder="Foam"
            />
          </div>

          <div>
            <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
              Description
            </label>
            <textarea
              value={projectContextData.description}
              onChange={(e) =>
                setProjectContextData((prev) => ({ ...prev, description: e.target.value }))
              }
              className="pixel-input w-full min-h-[80px]"
              placeholder="What does your product do? Who are your target users? What problems does it solve?"
            />
          </div>

          <div>
            <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
              Tech Stack
            </label>
            <textarea
              value={projectContextData.techStack}
              onChange={(e) =>
                setProjectContextData((prev) => ({ ...prev, techStack: e.target.value }))
              }
              className="pixel-input w-full min-h-[60px]"
              placeholder="React, TypeScript, Node.js, PostgreSQL, Redis, AWS..."
            />
          </div>

          <div>
            <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
              Architecture
            </label>
            <textarea
              value={projectContextData.architecture}
              onChange={(e) =>
                setProjectContextData((prev) => ({ ...prev, architecture: e.target.value }))
              }
              className="pixel-input w-full min-h-[60px]"
              placeholder="Monorepo structure, microservices, key patterns used..."
            />
          </div>

          <div>
            <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
              Product Areas / Features
            </label>
            <textarea
              value={projectContextData.productAreas}
              onChange={(e) =>
                setProjectContextData((prev) => ({ ...prev, productAreas: e.target.value }))
              }
              className="pixel-input w-full min-h-[60px]"
              placeholder="Key features, modules, or product areas (e.g., Authentication, Dashboard, Reporting...)"
            />
          </div>

          <div>
            <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
              Conventions
            </label>
            <textarea
              value={projectContextData.conventions}
              onChange={(e) =>
                setProjectContextData((prev) => ({ ...prev, conventions: e.target.value }))
              }
              className="pixel-input w-full min-h-[60px]"
              placeholder="Naming patterns, coding standards, ticket conventions..."
            />
          </div>

          <div>
            <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
              Additional Context
            </label>
            <textarea
              value={projectContextData.additionalContext}
              onChange={(e) =>
                setProjectContextData((prev) => ({ ...prev, additionalContext: e.target.value }))
              }
              className="pixel-input w-full min-h-[80px]"
              placeholder="Domain knowledge, business rules, important constraints, anything else relevant..."
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSaveProjectContext}
            disabled={isSavingContext}
            className="pixel-btn pixel-btn-primary text-pixel-xs disabled:opacity-50"
          >
            {isSavingContext ? 'Saving...' : 'Save Project Context'}
          </button>
        </div>
      </div>

      {/* Help Section */}
      <div className="panel p-6 space-y-4">
        <h3 className="font-pixel text-pixel-xs text-gold">HOW IT WORKS</h3>
        <div className="pixel-divider" />
        <div className="space-y-3 font-readable text-base text-beige/70">
          <p>
            <strong>1.</strong> Configure your Jira Cloud URL and project key above
          </p>
          <p>
            <strong>2.</strong> Set your JIRA_EMAIL and JIRA_API_TOKEN environment variables
          </p>
          <p>
            <strong>3.</strong> Test the connection to verify everything is working
          </p>
          <p>
            <strong>4.</strong> Fill in the Project Context to help Forge generate better ideas
          </p>
          <p>
            <strong>5.</strong> Approve quests in the Quests tab, then click "Complete" to create them in Jira
          </p>
        </div>
      </div>
    </div>
  );
}
