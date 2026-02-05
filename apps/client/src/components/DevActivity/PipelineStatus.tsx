import { useState, useEffect } from 'react';
import { getBitbucketPipelines, getBitbucketRepos } from '../../utils/api';
import type { BitbucketPipeline, BitbucketRepo } from '@jira-planner/shared';

export function PipelineStatus() {
  const [pipelines, setPipelines] = useState<BitbucketPipeline[]>([]);
  const [repos, setRepos] = useState<BitbucketRepo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<{ repo: string; state: string }>({
    repo: '',
    state: '',
  });

  useEffect(() => {
    loadRepos();
  }, []);

  useEffect(() => {
    loadPipelines();
  }, [filter]);

  const loadRepos = async () => {
    try {
      const data = await getBitbucketRepos(true);
      setRepos(data);
    } catch (error) {
      console.error('Failed to load repos:', error);
    }
  };

  const loadPipelines = async () => {
    setIsLoading(true);
    try {
      const options: any = { limit: 50 };
      if (filter.repo) options.repo = filter.repo;
      if (filter.state) options.state = filter.state;
      const data = await getBitbucketPipelines(options);
      setPipelines(data);
    } catch (error) {
      console.error('Failed to load pipelines:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'SUCCESSFUL': return '✅';
      case 'FAILED': return '❌';
      case 'IN_PROGRESS': return '🔄';
      case 'PENDING': return '⏳';
      case 'STOPPED': return '⏹️';
      default: return '❓';
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'SUCCESSFUL': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'FAILED': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'IN_PROGRESS': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'PENDING': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'STOPPED': return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="stone-panel p-4">
      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <select
          value={filter.repo}
          onChange={(e) => setFilter({ ...filter, repo: e.target.value })}
          className="stone-input px-3 py-1.5 text-sm"
        >
          <option value="">All Repos</option>
          {repos.map((repo) => (
            <option key={repo.slug} value={repo.slug}>
              {repo.name}
            </option>
          ))}
        </select>

        <select
          value={filter.state}
          onChange={(e) => setFilter({ ...filter, state: e.target.value })}
          className="stone-input px-3 py-1.5 text-sm"
        >
          <option value="">All States</option>
          <option value="SUCCESSFUL">Successful</option>
          <option value="FAILED">Failed</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="PENDING">Pending</option>
        </select>

        <span className="text-beige/50 text-sm ml-auto">
          {pipelines.length} pipelines
        </span>
      </div>

      {/* Pipeline List */}
      {isLoading ? (
        <div className="text-center text-beige/60 py-8">Loading...</div>
      ) : pipelines.length === 0 ? (
        <div className="text-center text-beige/60 py-8">
          No pipelines found. Try adjusting your filters or sync with Bitbucket.
        </div>
      ) : (
        <div className="space-y-2">
          {pipelines.map((pipeline) => (
            <div
              key={pipeline.uuid}
              className={`p-3 rounded border ${getStateColor(pipeline.state)}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{getStateIcon(pipeline.state)}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-beige">
                        #{pipeline.buildNumber}
                      </span>
                      <span className="text-beige/50 text-sm">
                        {pipeline.repoSlug}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-beige/50 mt-1">
                      <span>{pipeline.branch}</span>
                      <span>•</span>
                      <span className="font-mono">{pipeline.commitHash.slice(0, 7)}</span>
                      <span>•</span>
                      <span>{pipeline.triggerType}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right text-xs text-beige/50">
                  <div>{formatDuration(pipeline.durationSeconds)}</div>
                  <div className="mt-1">
                    {new Date(pipeline.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
