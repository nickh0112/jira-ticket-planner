import { useState, useEffect } from 'react';
import {
  getBitbucketConfig,
  saveBitbucketConfig,
  testBitbucketConnection,
  mapTeamMemberToBitbucket,
  getBitbucketRepos,
  discoverBitbucketRepos,
  toggleBitbucketRepo,
  getBitbucketSyncStatus,
  updateBitbucketSyncConfig,
  getTeamMembers,
} from '../../utils/api';
import type { TeamMember, BitbucketRepo } from '@jira-planner/shared';

interface BitbucketSettingsProps {
  onConfigured?: () => void;
}

export function BitbucketSettings({ onConfigured }: BitbucketSettingsProps) {
  const [workspace, setWorkspace] = useState('');
  const [email, setEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [activeSection, setActiveSection] = useState<'config' | 'mapping' | 'repos' | 'sync'>('config');

  // Team mapping state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Repos state
  const [repos, setRepos] = useState<BitbucketRepo[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);

  // Sync state
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncInterval, setSyncInterval] = useState(300000);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { config } = await getBitbucketConfig();
      if (config) {
        setWorkspace(config.workspace);
        setEmail(config.email);
        setIsConfigured(true);

        // Load sync status
        const status = await getBitbucketSyncStatus();
        setSyncEnabled(status.syncState.syncEnabled);
        setSyncInterval(status.syncState.syncIntervalMs);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const handleSave = async () => {
    if (!workspace || !email || !appPassword) {
      setTestResult({ success: false, message: 'All fields are required' });
      return;
    }

    setIsSaving(true);
    try {
      await saveBitbucketConfig({ workspace, email, appPassword });
      setTestResult({ success: true, message: 'Configuration saved!' });
      setIsConfigured(true);
      onConfigured?.();
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!workspace || !email || !appPassword) {
      setTestResult({ success: false, message: 'All fields are required' });
      return;
    }

    // Save first, then test
    setIsTesting(true);
    try {
      await saveBitbucketConfig({ workspace, email, appPassword });
      const result = await testBitbucketConnection();
      if (result.success) {
        setTestResult({
          success: true,
          message: `Connected to ${result.workspaceName} as ${result.username}`,
        });
        setIsConfigured(true);
      } else {
        setTestResult({
          success: false,
          message: result.error || 'Connection failed',
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const loadTeamMapping = async () => {
    setIsLoadingMembers(true);
    try {
      const membersRes = await getTeamMembers();
      setTeamMembers(membersRes.members);
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleMapMember = async (memberId: string, bitbucketUsername: string) => {
    try {
      const updated = await mapTeamMemberToBitbucket(memberId, bitbucketUsername);
      setTeamMembers(members =>
        members.map(m => (m.id === memberId ? updated : m))
      );
    } catch (error) {
      console.error('Failed to map member:', error);
    }
  };

  const loadRepos = async () => {
    try {
      const data = await getBitbucketRepos();
      setRepos(data);
    } catch (error) {
      console.error('Failed to load repos:', error);
    }
  };

  const handleDiscover = async () => {
    setIsDiscovering(true);
    try {
      const result = await discoverBitbucketRepos();
      setRepos(result.repos);
    } catch (error) {
      console.error('Discovery failed:', error);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleToggleRepo = async (slug: string, isActive: boolean) => {
    try {
      const updated = await toggleBitbucketRepo(slug, isActive);
      setRepos(repos => repos.map(r => (r.slug === slug ? updated : r)));
    } catch (error) {
      console.error('Failed to toggle repo:', error);
    }
  };

  const handleSyncConfigSave = async () => {
    try {
      await updateBitbucketSyncConfig({
        syncEnabled,
        syncIntervalMs: syncInterval,
      });
    } catch (error) {
      console.error('Failed to save sync config:', error);
    }
  };

  useEffect(() => {
    if (activeSection === 'mapping' && isConfigured) {
      loadTeamMapping();
    } else if (activeSection === 'repos' && isConfigured) {
      loadRepos();
    }
  }, [activeSection, isConfigured]);

  const sections = [
    { key: 'config' as const, label: 'Connection' },
    { key: 'mapping' as const, label: 'Team Mapping', disabled: !isConfigured },
    { key: 'repos' as const, label: 'Repositories', disabled: !isConfigured },
    { key: 'sync' as const, label: 'Auto-Sync', disabled: !isConfigured },
  ];

  return (
    <div className="space-y-4">
      {/* Section Tabs */}
      <div className="flex gap-2 flex-wrap">
        {sections.map((section) => (
          <button
            key={section.key}
            onClick={() => !section.disabled && setActiveSection(section.key)}
            disabled={section.disabled}
            className={`stone-tab ${
              activeSection === section.key ? 'stone-tab-active' : ''
            } ${section.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {section.label}
          </button>
        ))}
      </div>

      {/* Connection Config */}
      {activeSection === 'config' && (
        <div className="stone-panel p-4 space-y-4">
          <h3 className="font-pixel text-pixel-md text-gold">Bitbucket Connection</h3>

          <div>
            <label className="block text-beige/70 text-sm mb-1">Workspace</label>
            <input
              type="text"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              placeholder="your-workspace"
              className="stone-input w-full"
            />
            <p className="text-xs text-beige/40 mt-1">
              The workspace slug from your Bitbucket URL
            </p>
          </div>

          <div>
            <label className="block text-beige/70 text-sm mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="stone-input w-full"
            />
            <p className="text-xs text-beige/40 mt-1">
              Your Atlassian account email address
            </p>
          </div>

          <div>
            <label className="block text-beige/70 text-sm mb-1">API Token</label>
            <input
              type="password"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              placeholder="••••••••"
              className="stone-input w-full"
            />
            <p className="text-xs text-beige/40 mt-1">
              Create an API token with scopes in Atlassian Account Settings (Security {'>'} API tokens {'>'} Create API token with scopes {'>'} Select Bitbucket)
            </p>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded ${
                testResult.success
                  ? 'bg-green-500/20 text-green-300'
                  : 'bg-red-500/20 text-red-300'
              }`}
            >
              {testResult.message}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleTest}
              disabled={isTesting || isSaving}
              className="stone-button"
            >
              {isTesting ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              onClick={handleSave}
              disabled={isTesting || isSaving}
              className="stone-button stone-button-primary"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Team Mapping */}
      {activeSection === 'mapping' && (
        <div className="stone-panel p-4">
          <h3 className="font-pixel text-pixel-md text-gold mb-4">Team Member Mapping</h3>
          <p className="text-beige/60 text-sm mb-4">
            Link your team members to their Bitbucket usernames to track their activity.
          </p>

          {isLoadingMembers ? (
            <div className="text-center text-beige/60 py-8">Loading...</div>
          ) : (
            <div className="space-y-3">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-4 p-3 bg-stone-primary/50 rounded"
                >
                  <div className="flex-1">
                    <div className="font-medium text-beige">{member.name}</div>
                    <div className="text-xs text-beige/50">{member.role}</div>
                  </div>
                  <input
                    type="text"
                    value={member.bitbucketUsername || ''}
                    onChange={(e) => handleMapMember(member.id, e.target.value)}
                    placeholder="Bitbucket username"
                    className="stone-input px-3 py-1.5 text-sm min-w-[200px]"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Repositories */}
      {activeSection === 'repos' && (
        <div className="stone-panel p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-pixel text-pixel-md text-gold">Tracked Repositories</h3>
            <button
              onClick={handleDiscover}
              disabled={isDiscovering}
              className="stone-button stone-button-sm"
            >
              {isDiscovering ? 'Discovering...' : 'Auto-Discover'}
            </button>
          </div>

          <p className="text-beige/60 text-sm mb-4">
            Select which repositories to track. Auto-discover finds repos based on team activity.
          </p>

          {repos.length === 0 ? (
            <div className="text-center text-beige/60 py-8">
              No repositories discovered yet. Click Auto-Discover to find repos your team uses.
            </div>
          ) : (
            <div className="space-y-2">
              {repos.map((repo) => (
                <div
                  key={repo.slug}
                  className="flex items-center justify-between p-3 bg-stone-primary/50 rounded"
                >
                  <div>
                    <div className="font-medium text-beige">{repo.name}</div>
                    <div className="text-xs text-beige/50">{repo.slug}</div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={repo.isActive}
                      onChange={(e) => handleToggleRepo(repo.slug, e.target.checked)}
                      className="form-checkbox"
                    />
                    <span className="text-sm text-beige/70">Track</span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sync Settings */}
      {activeSection === 'sync' && (
        <div className="stone-panel p-4 space-y-4">
          <h3 className="font-pixel text-pixel-md text-gold">Auto-Sync Settings</h3>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={syncEnabled}
              onChange={(e) => setSyncEnabled(e.target.checked)}
              className="form-checkbox"
            />
            <span className="text-beige">Enable automatic sync</span>
          </label>

          <div>
            <label className="block text-beige/70 text-sm mb-1">Sync Interval</label>
            <select
              value={syncInterval}
              onChange={(e) => setSyncInterval(Number(e.target.value))}
              className="stone-input"
              disabled={!syncEnabled}
            >
              <option value={60000}>1 minute</option>
              <option value={300000}>5 minutes</option>
              <option value={600000}>10 minutes</option>
              <option value={1800000}>30 minutes</option>
              <option value={3600000}>1 hour</option>
            </select>
          </div>

          <button
            onClick={handleSyncConfigSave}
            className="stone-button stone-button-primary"
          >
            Save Sync Settings
          </button>
        </div>
      )}
    </div>
  );
}
