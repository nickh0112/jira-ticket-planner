import { useState, useEffect } from 'react';
import type { Ticket, TicketType, TicketPriority } from '@jira-planner/shared';
import { useStore } from '../store/useStore';
import { updateTicket, deleteTicket, updateTicketSkillStatus } from '../utils/api';
import { SkillBadge } from './SkillBadge';
import { AssigneePicker } from './AssigneePicker';
import { PixelSelect } from './PixelSelect';

const ticketTypes: { value: TicketType; label: string; icon: string }[] = [
  { value: 'feature', label: 'Feature', icon: '⚔️' },
  { value: 'bug', label: 'Bug', icon: '🐛' },
  { value: 'improvement', label: 'Improvement', icon: '⬆️' },
  { value: 'task', label: 'Task', icon: '📋' },
];

const priorities: { value: TicketPriority; label: string; rarity: string }[] = [
  { value: 'highest', label: 'Legendary', rarity: 'text-rarity-legendary' },
  { value: 'high', label: 'Epic', rarity: 'text-rarity-epic' },
  { value: 'medium', label: 'Rare', rarity: 'text-rarity-rare' },
  { value: 'low', label: 'Common', rarity: 'text-rarity-common' },
  { value: 'lowest', label: 'Basic', rarity: 'text-rarity-basic' },
];

export function TicketEditor() {
  const {
    editingTicket,
    setEditingTicket,
    teamMembers,
    epics,
    updateTicket: updateTicketInStore,
    removeTicket,
    showToast,
  } = useStore();

  const [formData, setFormData] = useState<Partial<Ticket>>({});
  const [criteriaInput, setCriteriaInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [skillStatuses, setSkillStatuses] = useState<Record<string, 'pending' | 'accepted' | 'rejected'>>({});

  useEffect(() => {
    if (editingTicket) {
      setFormData({ ...editingTicket });
      // Initialize skill statuses (all pending by default for AI-inferred skills)
      const initialStatuses: Record<string, 'pending' | 'accepted' | 'rejected'> = {};
      editingTicket.requiredSkills?.forEach((skill) => {
        initialStatuses[skill] = 'pending';
      });
      setSkillStatuses(initialStatuses);
    }
  }, [editingTicket]);

  if (!editingTicket) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await updateTicket(editingTicket.id, {
        title: formData.title,
        description: formData.description,
        acceptanceCriteria: formData.acceptanceCriteria,
        ticketType: formData.ticketType,
        priority: formData.priority,
        epicId: formData.epicId,
        assigneeId: formData.assigneeId,
        labels: formData.labels,
      });
      updateTicketInStore(editingTicket.id, updated);
      setEditingTicket(null);
      showToast('Quest updated!', 'success');
    } catch (error) {
      showToast('Failed to update quest', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Abandon this quest permanently?')) return;
    try {
      await deleteTicket(editingTicket.id);
      removeTicket(editingTicket.id);
      setEditingTicket(null);
      showToast('Quest abandoned', 'success');
    } catch (error) {
      showToast('Failed to abandon quest', 'error');
    }
  };

  const addCriteria = () => {
    if (!criteriaInput.trim()) return;
    setFormData((prev) => ({
      ...prev,
      acceptanceCriteria: [...(prev.acceptanceCriteria || []), criteriaInput.trim()],
    }));
    setCriteriaInput('');
  };

  const removeCriteria = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      acceptanceCriteria: prev.acceptanceCriteria?.filter((_, i) => i !== index),
    }));
  };

  const addLabel = () => {
    if (!labelInput.trim()) return;
    const newLabel = labelInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (formData.labels?.includes(newLabel)) {
      setLabelInput('');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      labels: [...(prev.labels || []), newLabel],
    }));
    setLabelInput('');
  };

  const removeLabel = (label: string) => {
    setFormData((prev) => ({
      ...prev,
      labels: prev.labels?.filter((l) => l !== label),
    }));
  };

  const handleSkillAccept = async (skill: string) => {
    setSkillStatuses((prev) => ({ ...prev, [skill]: 'accepted' }));
    if (editingTicket) {
      try {
        await updateTicketSkillStatus(editingTicket.id, skill, 'accepted');
      } catch (error) {
        console.error('Failed to update skill status:', error);
      }
    }
  };

  const handleSkillReject = async (skill: string) => {
    setSkillStatuses((prev) => ({ ...prev, [skill]: 'rejected' }));
    // Remove rejected skill from requiredSkills
    setFormData((prev) => ({
      ...prev,
      requiredSkills: prev.requiredSkills?.filter((s) => s !== skill),
    }));
    if (editingTicket) {
      try {
        await updateTicketSkillStatus(editingTicket.id, skill, 'rejected');
      } catch (error) {
        console.error('Failed to update skill status:', error);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/70"
        onClick={() => setEditingTicket(null)}
      />

      {/* Side panel */}
      <div className="w-full max-w-xl bg-stone-secondary border-l-4 border-border-gold shadow-pixel flex flex-col animate-slide-up">
        {/* Header */}
        <div className="p-6 border-b-2 border-border-gold">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📜</span>
              <h2 className="font-pixel text-pixel-sm text-gold">QUEST DETAILS</h2>
            </div>
            <button
              onClick={() => setEditingTicket(null)}
              className="pixel-btn text-pixel-xs"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Title */}
          <div>
            <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
              Quest Name
            </label>
            <input
              type="text"
              value={formData.title || ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              className="pixel-input w-full"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
              Description
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={4}
              className="pixel-input w-full resize-none"
            />
          </div>

          {/* Type and Priority (Rarity) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
                Quest Type
              </label>
              <PixelSelect
                options={ticketTypes.map((type) => ({
                  value: type.value,
                  label: type.label,
                  icon: type.icon,
                }))}
                value={formData.ticketType || 'task'}
                onChange={(val) =>
                  setFormData((prev) => ({
                    ...prev,
                    ticketType: (val || 'task') as TicketType,
                  }))
                }
                searchable={false}
              />
            </div>

            <div>
              <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
                Rarity
              </label>
              <PixelSelect
                options={priorities.map((p) => ({
                  value: p.value,
                  label: p.label,
                  icon: '\u2605',
                }))}
                value={formData.priority || 'medium'}
                onChange={(val) =>
                  setFormData((prev) => ({
                    ...prev,
                    priority: (val || 'medium') as TicketPriority,
                  }))
                }
                searchable={false}
                renderOption={(option) => (
                  <span className={`flex items-center gap-2 ${priorities.find(p => p.value === option.value)?.rarity || ''}`}>
                    <span>{option.icon}</span>
                    <span>{option.label}</span>
                  </span>
                )}
                renderSelected={(option) => (
                  <span className={`flex items-center gap-2 ${priorities.find(p => p.value === option.value)?.rarity || ''}`}>
                    <span>{option.icon}</span>
                    <span>{option.label}</span>
                  </span>
                )}
              />
            </div>
          </div>

          {/* Campaign and Assignee */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
                Campaign
              </label>
              <PixelSelect
                options={epics.map((epic) => ({
                  value: epic.id,
                  label: `${epic.key} - ${epic.name}`,
                  icon: '\uD83C\uDFF0',
                }))}
                value={formData.epicId || null}
                onChange={(val) =>
                  setFormData((prev) => ({
                    ...prev,
                    epicId: val,
                  }))
                }
                allowClear
                clearLabel="No campaign"
                placeholder="Select campaign..."
                searchPlaceholder="Search campaigns..."
              />
            </div>

            <div>
              <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
                Assigned To
              </label>
              <AssigneePicker
                teamMembers={teamMembers}
                selectedId={formData.assigneeId || null}
                onSelect={(id) =>
                  setFormData((prev) => ({
                    ...prev,
                    assigneeId: id,
                  }))
                }
                ticketData={{
                  title: formData.title || '',
                  description: formData.description || '',
                  ticketType: formData.ticketType || 'task',
                  requiredSkills: formData.requiredSkills,
                }}
              />
            </div>
          </div>

          {/* Labels */}
          <div>
            <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
              Labels
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.labels?.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-stone-panel border-2 border-border-gold rounded text-sm text-beige"
                >
                  🏷️ {label}
                  <button
                    onClick={() => removeLabel(label)}
                    className="text-quest-abandoned hover:text-beige transition-colors ml-1"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLabel())}
                placeholder="Add label (e.g., backend, api)..."
                className="pixel-input flex-1"
              />
              <button onClick={addLabel} className="pixel-btn text-pixel-xs">
                + Add
              </button>
            </div>
          </div>

          {/* Required Skills (AI-Inferred) */}
          {formData.requiredSkills && formData.requiredSkills.length > 0 && (
            <div>
              <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
                <span className="mr-2">🤖</span>
                AI-Detected Skills
              </label>
              <div className="flex flex-wrap gap-2">
                {formData.requiredSkills.map((skill) => (
                  <SkillBadge
                    key={skill}
                    skill={skill}
                    isInferred={true}
                    confidence={0.85}
                    status={skillStatuses[skill] || 'pending'}
                    size="md"
                    onAccept={() => handleSkillAccept(skill)}
                    onReject={() => handleSkillReject(skill)}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-beige/50">
                Accept or reject AI-suggested skills for this quest
              </p>
            </div>
          )}

          {/* Objectives (Acceptance Criteria) */}
          <div>
            <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
              Quest Objectives
            </label>
            <div className="space-y-2">
              {formData.acceptanceCriteria?.map((criteria, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-stone-panel px-3 py-2 border-2 border-border-gold rounded"
                >
                  <span className="text-gold">✦</span>
                  <span className="flex-1 font-readable text-base text-beige">
                    {criteria}
                  </span>
                  <button
                    onClick={() => removeCriteria(index)}
                    className="text-quest-abandoned hover:text-beige transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={criteriaInput}
                  onChange={(e) => setCriteriaInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCriteria()}
                  placeholder="Add new objective..."
                  className="pixel-input flex-1"
                />
                <button onClick={addCriteria} className="pixel-btn text-pixel-xs">
                  + Add
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t-2 border-border-gold bg-stone-panel flex items-center justify-between">
          <button
            onClick={handleDelete}
            className="pixel-btn pixel-btn-danger text-pixel-xs"
          >
            Abandon Quest
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => setEditingTicket(null)}
              className="pixel-btn text-pixel-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="pixel-btn pixel-btn-primary text-pixel-xs disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Update Quest'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
