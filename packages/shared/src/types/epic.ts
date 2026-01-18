export interface Epic {
  id: string;
  name: string;
  key: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEpicInput {
  name: string;
  key: string;
  description: string;
}

export interface UpdateEpicInput {
  name?: string;
  key?: string;
  description?: string;
}
