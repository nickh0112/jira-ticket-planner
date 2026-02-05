import { useState, useEffect } from 'react';
import { getBitbucketCommits, getBitbucketRepos } from '../../utils/api';
import type { BitbucketCommit, BitbucketRepo } from '@jira-planner/shared';

export function CommitFeed() {
  const [commits, setCommits] = useState<BitbucketCommit[]>([]);
  const [repos, setRepos] = useState<BitbucketRepo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<{ repo: string }>({ repo: '' });

  useEffect(() => {
    loadRepos();
  }, []);

  useEffect(() => {
    loadCommits();
  }, [filter]);

  const loadRepos = async () => {
    try {
      const data = await getBitbucketRepos(true);
      setRepos(data);
    } catch (error) {
      console.error('Failed to load repos:', error);
    }
  };

  const loadCommits = async () => {
    setIsLoading(true);
    try {
      const options: any = { limit: 100 };
      if (filter.repo) {
        options.repo = filter.repo;
      }
      const data = await getBitbucketCommits(options);
      setCommits(data);
    } catch (error) {
      console.error('Failed to load commits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Group commits by date
  const groupedCommits = commits.reduce((groups, commit) => {
    const date = new Date(commit.committedAt).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(commit);
    return groups;
  }, {} as Record<string, BitbucketCommit[]>);

  return (
    <div className="stone-panel p-4">
      {/* Filter */}
      <div className="flex items-center gap-4 mb-4">
        <select
          value={filter.repo}
          onChange={(e) => setFilter({ repo: e.target.value })}
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
          {commits.length} commits
        </span>
      </div>

      {/* Commit List */}
      {isLoading ? (
        <div className="text-center text-beige/60 py-8">Loading...</div>
      ) : commits.length === 0 ? (
        <div className="text-center text-beige/60 py-8">
          No commits found. Try syncing with Bitbucket.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedCommits).map(([date, dateCommits]) => (
            <div key={date}>
              <h4 className="text-beige/50 text-sm font-medium mb-2">{date}</h4>
              <div className="space-y-2 border-l-2 border-border-gold/30 pl-4">
                {dateCommits.map((commit) => (
                  <div
                    key={commit.hash}
                    className="relative"
                  >
                    {/* Timeline dot */}
                    <div className="absolute -left-[21px] top-2 w-2 h-2 rounded-full bg-gold" />

                    <div className="p-3 bg-stone-primary/50 rounded border border-border-gold/20">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-beige text-sm">{commit.message}</p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-beige/50">
                            <span className="font-mono text-beige/40">
                              {commit.hash.slice(0, 7)}
                            </span>
                            <span>•</span>
                            <span>{commit.authorDisplayName}</span>
                            <span>•</span>
                            <span>{commit.repoSlug}</span>
                            {commit.jiraKey && (
                              <>
                                <span>•</span>
                                <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded">
                                  {commit.jiraKey}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-beige/40">
                          {new Date(commit.committedAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
