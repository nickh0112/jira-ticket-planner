import { useState, useEffect } from 'react';
import { getBitbucketPRs, getBitbucketRepos } from '../../utils/api';
import type { BitbucketPullRequest, BitbucketRepo } from '@jira-planner/shared';

export function PRList() {
  const [prs, setPRs] = useState<BitbucketPullRequest[]>([]);
  const [repos, setRepos] = useState<BitbucketRepo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<{
    state: 'ALL' | 'OPEN' | 'MERGED' | 'DECLINED';
    repo: string;
  }>({
    state: 'ALL',
    repo: '',
  });

  useEffect(() => {
    loadRepos();
  }, []);

  useEffect(() => {
    loadPRs();
  }, [filter]);

  const loadRepos = async () => {
    try {
      const data = await getBitbucketRepos(true);
      setRepos(data);
    } catch (error) {
      console.error('Failed to load repos:', error);
    }
  };

  const loadPRs = async () => {
    setIsLoading(true);
    try {
      const options: any = { limit: 50 };
      if (filter.state !== 'ALL') {
        options.state = filter.state;
      }
      if (filter.repo) {
        options.repo = filter.repo;
      }
      const data = await getBitbucketPRs(options);
      setPRs(data);
    } catch (error) {
      console.error('Failed to load PRs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'OPEN': return 'bg-green-500/20 text-green-300';
      case 'MERGED': return 'bg-purple-500/20 text-purple-300';
      case 'DECLINED': return 'bg-red-500/20 text-red-300';
      default: return 'bg-gray-500/20 text-gray-300';
    }
  };

  return (
    <div className="stone-panel p-4">
      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <select
          value={filter.state}
          onChange={(e) => setFilter({ ...filter, state: e.target.value as any })}
          className="stone-input px-3 py-1.5 text-sm"
        >
          <option value="ALL">All States</option>
          <option value="OPEN">Open</option>
          <option value="MERGED">Merged</option>
          <option value="DECLINED">Declined</option>
        </select>

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

        <span className="text-beige/50 text-sm ml-auto">
          {prs.length} PRs
        </span>
      </div>

      {/* PR List */}
      {isLoading ? (
        <div className="text-center text-beige/60 py-8">Loading...</div>
      ) : prs.length === 0 ? (
        <div className="text-center text-beige/60 py-8">
          No pull requests found. Try adjusting your filters or sync with Bitbucket.
        </div>
      ) : (
        <div className="space-y-2">
          {prs.map((pr) => (
            <div
              key={`${pr.repoSlug}-${pr.prNumber}`}
              className="p-3 bg-stone-primary/50 rounded border border-border-gold/20 hover:border-border-gold/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded ${getStateColor(pr.state)}`}>
                      {pr.state}
                    </span>
                    <span className="text-beige/50 text-xs">#{pr.prNumber}</span>
                    {pr.jiraKey && (
                      <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded">
                        {pr.jiraKey}
                      </span>
                    )}
                  </div>
                  <h4 className="font-medium text-beige mt-1 truncate">{pr.title}</h4>
                  <div className="flex items-center gap-2 mt-1 text-xs text-beige/50">
                    <span>{pr.authorDisplayName}</span>
                    <span>•</span>
                    <span>{pr.repoSlug}</span>
                    <span>•</span>
                    <span>{pr.sourceBranch} → {pr.destinationBranch}</span>
                  </div>
                </div>
                <div className="text-right text-xs text-beige/40">
                  <div>{new Date(pr.updatedAt).toLocaleDateString()}</div>
                  {pr.reviewers.length > 0 && (
                    <div className="mt-1">
                      {pr.reviewers.filter(r => r.status === 'APPROVED').length}/{pr.reviewers.length} approved
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
