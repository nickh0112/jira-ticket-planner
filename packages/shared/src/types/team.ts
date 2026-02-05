export type MemberType = 'human' | 'ai';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  skills: string[];
  jiraUsername?: string;
  jiraAccountId?: string;
  bitbucketUsername?: string;
  memberType: MemberType;
  position?: { x: number; y: number };
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamMemberInput {
  name: string;
  role: string;
  skills: string[];
  jiraUsername?: string;
  jiraAccountId?: string;
  bitbucketUsername?: string;
}

export interface UpdateTeamMemberInput {
  name?: string;
  role?: string;
  skills?: string[];
  jiraUsername?: string;
  jiraAccountId?: string;
  bitbucketUsername?: string;
}
