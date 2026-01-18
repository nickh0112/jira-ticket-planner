import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { createStorageService } from '../services/storageService.js';
import type { CreateTeamMemberInput } from '@jira-planner/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, '../../../../.env') });

const DATABASE_PATH = process.env.DATABASE_PATH || join(__dirname, '../../../../data/database.sqlite');

const squadDIMembers: CreateTeamMemberInput[] = [
  { name: 'Nick Hensel', role: 'Team Member', skills: [], jiraUsername: 'Nick Hensel' },
  { name: 'Anas Khan', role: 'Team Member', skills: [], jiraUsername: 'Anas Khan' },
  { name: 'Aviral Kulshreshtha', role: 'Team Member', skills: [], jiraUsername: 'Aviral Kulshreshtha' },
  { name: 'Dani Del Castillo Llano', role: 'Senior Machine Learning Engineer', skills: [], jiraUsername: 'Dani Del Castillo Llano' },
  { name: 'Eduardo Martinez de Parada', role: 'Software Engineer', skills: [], jiraUsername: 'Eduardo Martinez de Parada' },
  { name: 'Eran Nussinovitch', role: 'Team Member', skills: [], jiraUsername: 'Eran Nussinovitch' },
  { name: 'Feliks Toomsoo', role: 'Team Member', skills: [], jiraUsername: 'Feliks Toomsoo' },
  { name: 'Fernando Santana', role: 'Project Manager', skills: [], jiraUsername: 'Fernando Santana' },
  { name: 'Gabriel Ortega', role: 'Software Engineer', skills: [], jiraUsername: 'Gabriel Ortega' },
  { name: 'Hendrik Bagger', role: 'Developer', skills: [], jiraUsername: 'Hendrik Bagger' },
  { name: 'Jeyhun Abbasov', role: 'Senior Backend Engineer', skills: [], jiraUsername: 'Jeyhun Abbasov' },
  { name: 'John Williams', role: 'Team Member', skills: [], jiraUsername: 'John Williams' },
  { name: 'Margus Birk', role: 'Software Engineer', skills: [], jiraUsername: 'Margus Birk' },
  { name: 'martin.kask', role: 'Senior Backend Engineer', skills: [], jiraUsername: 'martin.kask' },
  { name: 'Nawal Singh', role: 'MLE', skills: [], jiraUsername: 'Nawal Singh' },
  { name: 'Nikita Romanenko', role: 'Team Member', skills: [], jiraUsername: 'Nikita Romanenko' },
  { name: 'Sofía Ramos Antón', role: 'Team Member', skills: [], jiraUsername: 'Sofía Ramos Antón' },
  { name: 'Teba Gomez', role: 'Team Member', skills: [], jiraUsername: 'Teba Gomez' },
  { name: 'Trey Pierce', role: 'Team Member', skills: [], jiraUsername: 'Trey Pierce' },
];

console.log(`Using database: ${DATABASE_PATH}`);
console.log(`Seeding ${squadDIMembers.length} Squad DI team members...`);

const storage = createStorageService(DATABASE_PATH);
const members = storage.replaceTeamMembers(squadDIMembers);

console.log(`Successfully seeded ${members.length} Squad DI team members:`);
members.forEach((member) => {
  console.log(`  - ${member.name} (${member.role})`);
});

storage.close();
