export interface TeamMember {
  id: string;
  name: string;
  role: string;
  skills: string[];
  jiraUsername?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamMemberInput {
  name: string;
  role: string;
  skills: string[];
  jiraUsername?: string;
}

export interface UpdateTeamMemberInput {
  name?: string;
  role?: string;
  skills?: string[];
  jiraUsername?: string;
}
