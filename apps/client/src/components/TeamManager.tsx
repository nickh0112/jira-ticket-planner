import { useState } from 'react';
import type { TeamMember } from '@jira-planner/shared';
import { useStore } from '../store/useStore';
import {
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
} from '../utils/api';

interface TeamMemberFormData {
  name: string;
  role: string;
  skills: string;
  jiraUsername: string;
}

const emptyForm: TeamMemberFormData = {
  name: '',
  role: '',
  skills: '',
  jiraUsername: '',
};

// Class icons based on role keywords
const getClassIcon = (role: string): string => {
  const lowerRole = role.toLowerCase();
  if (lowerRole.includes('frontend') || lowerRole.includes('ui')) return '🧙';
  if (lowerRole.includes('backend') || lowerRole.includes('server')) return '🛡️';
  if (lowerRole.includes('full')) return '⚔️';
  if (lowerRole.includes('devops') || lowerRole.includes('infra')) return '🏰';
  if (lowerRole.includes('qa') || lowerRole.includes('test')) return '🔍';
  if (lowerRole.includes('design')) return '🎨';
  if (lowerRole.includes('lead') || lowerRole.includes('manager')) return '👑';
  return '⚔️';
};

const getClassName = (role: string): string => {
  const lowerRole = role.toLowerCase();
  if (lowerRole.includes('frontend') || lowerRole.includes('ui')) return 'Wizard';
  if (lowerRole.includes('backend') || lowerRole.includes('server')) return 'Knight';
  if (lowerRole.includes('full')) return 'Paladin';
  if (lowerRole.includes('devops') || lowerRole.includes('infra')) return 'Engineer';
  if (lowerRole.includes('qa') || lowerRole.includes('test')) return 'Scout';
  if (lowerRole.includes('design')) return 'Artisan';
  if (lowerRole.includes('lead') || lowerRole.includes('manager')) return 'Commander';
  return 'Warrior';
};

export function TeamManager() {
  const {
    teamMembers,
    tickets,
    addTeamMember,
    updateTeamMember: updateMemberInStore,
    removeTeamMember,
    showToast,
  } = useStore();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TeamMemberFormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const getActiveQuestCount = (memberId: string) => {
    return tickets.filter(
      (t) => t.assigneeId === memberId && t.status !== 'created' && t.status !== 'denied'
    ).length;
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setIsAdding(false);
    setEditingId(null);
  };

  const startEditing = (member: TeamMember) => {
    setEditingId(member.id);
    setFormData({
      name: member.name,
      role: member.role,
      skills: member.skills.join(', '),
      jiraUsername: member.jiraUsername || '',
    });
    setIsAdding(false);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.role.trim()) {
      showToast('Name and role are required', 'error');
      return;
    }

    setIsSaving(true);
    const skills = formData.skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      if (editingId) {
        const updated = await updateTeamMember(editingId, {
          name: formData.name,
          role: formData.role,
          skills,
          jiraUsername: formData.jiraUsername || undefined,
        });
        updateMemberInStore(editingId, updated);
        showToast('Squad member updated!', 'success');
      } else {
        const created = await createTeamMember({
          name: formData.name,
          role: formData.role,
          skills,
          jiraUsername: formData.jiraUsername || undefined,
        });
        addTeamMember(created);
        showToast('New recruit joined the squad!', 'success');
      }
      resetForm();
    } catch (error) {
      showToast('Failed to save squad member', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this member from the squad?')) return;
    try {
      await deleteTeamMember(id);
      removeTeamMember(id);
      showToast('Squad member dismissed', 'success');
    } catch (error) {
      showToast('Failed to remove squad member', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚔️</span>
          <h2 className="font-pixel text-pixel-sm text-gold">SQUAD ROSTER</h2>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={() => setIsAdding(true)}
            className="pixel-btn pixel-btn-primary text-pixel-xs"
          >
            + Recruit New Member
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <div className="panel p-4 space-y-4">
          <h3 className="font-pixel text-pixel-xs text-beige">
            {editingId ? 'Edit Squad Member' : 'Recruit New Member'}
          </h3>
          <div className="pixel-divider" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                className="pixel-input w-full"
                placeholder="Sir Lancelot"
              />
            </div>
            <div>
              <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
                Class / Role *
              </label>
              <input
                type="text"
                value={formData.role}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, role: e.target.value }))
                }
                className="pixel-input w-full"
                placeholder="Frontend Developer"
              />
            </div>
            <div>
              <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
                Skills (comma-separated)
              </label>
              <input
                type="text"
                value={formData.skills}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, skills: e.target.value }))
                }
                className="pixel-input w-full"
                placeholder="React, TypeScript, CSS"
              />
            </div>
            <div>
              <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
                JIRA Username
              </label>
              <input
                type="text"
                value={formData.jiraUsername}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    jiraUsername: e.target.value,
                  }))
                }
                className="pixel-input w-full"
                placeholder="@knight_dev"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={resetForm} className="pixel-btn text-pixel-xs">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="pixel-btn pixel-btn-primary text-pixel-xs disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : editingId ? 'Update' : 'Recruit'}
            </button>
          </div>
        </div>
      )}

      {/* Squad List */}
      {teamMembers.length === 0 ? (
        <div className="panel p-8 text-center">
          <div className="text-4xl mb-4">⚔️</div>
          <p className="font-readable text-xl text-beige/70">
            No squad members yet. Recruit allies to assign quests.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teamMembers.map((member) => {
            const activeQuests = getActiveQuestCount(member.id);
            const classIcon = getClassIcon(member.role);
            const className = getClassName(member.role);

            return (
              <div key={member.id} className="panel p-4">
                <div className="flex items-start gap-4">
                  {/* Class Icon */}
                  <div className="w-16 h-16 bg-stone-panel border-2 border-border-gold rounded flex items-center justify-center text-3xl">
                    {classIcon}
                  </div>

                  {/* Member Info */}
                  <div className="flex-1">
                    <h4 className="font-pixel text-pixel-xs text-gold uppercase">
                      {member.name}
                    </h4>
                    <p className="font-readable text-lg text-beige/70">
                      {className} ({member.role})
                    </p>

                    {member.skills.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {member.skills.map((skill, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-stone-panel border border-border-gold text-beige/60 text-xs font-readable rounded"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-4">
                      {member.jiraUsername && (
                        <span className="font-readable text-sm text-beige/50">
                          @{member.jiraUsername}
                        </span>
                      )}
                      <span className="font-readable text-sm text-quest-active">
                        Active Quests: {activeQuests}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => startEditing(member)}
                      className="pixel-btn text-pixel-xs"
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDelete(member.id)}
                      className="pixel-btn pixel-btn-danger text-pixel-xs"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
