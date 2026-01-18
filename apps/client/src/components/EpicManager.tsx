import { useState } from 'react';
import type { Epic } from '@jira-planner/shared';
import { useStore } from '../store/useStore';
import { createEpic, updateEpicApi, deleteEpic } from '../utils/api';

interface EpicFormData {
  name: string;
  key: string;
  description: string;
}

const emptyForm: EpicFormData = {
  name: '',
  key: '',
  description: '',
};

export function EpicManager() {
  const {
    epics,
    tickets,
    addEpic,
    updateEpic: updateEpicInStore,
    removeEpic,
    showToast,
  } = useStore();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<EpicFormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const getCampaignStats = (epicId: string) => {
    const campaignQuests = tickets.filter((t) => t.epicId === epicId);
    const active = campaignQuests.filter(
      (t) => t.status === 'pending' || t.status === 'approved'
    ).length;
    const complete = campaignQuests.filter((t) => t.createdInJira).length;
    const total = campaignQuests.length;
    const progress = total > 0 ? Math.round((complete / total) * 100) : 0;
    return { active, complete, total, progress };
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setIsAdding(false);
    setEditingId(null);
  };

  const startEditing = (epic: Epic) => {
    setEditingId(epic.id);
    setFormData({
      name: epic.name,
      key: epic.key,
      description: epic.description,
    });
    setIsAdding(false);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.key.trim()) {
      showToast('Name and key are required', 'error');
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        const updated = await updateEpicApi(editingId, {
          name: formData.name,
          key: formData.key,
          description: formData.description,
        });
        updateEpicInStore(editingId, updated);
        showToast('Campaign updated!', 'success');
      } else {
        const created = await createEpic({
          name: formData.name,
          key: formData.key,
          description: formData.description,
        });
        addEpic(created);
        showToast('New campaign launched!', 'success');
      }
      resetForm();
    } catch (error) {
      showToast('Failed to save campaign', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('End this campaign permanently?')) return;
    try {
      await deleteEpic(id);
      removeEpic(id);
      showToast('Campaign ended', 'success');
    } catch (error) {
      showToast('Failed to end campaign', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏰</span>
          <h2 className="font-pixel text-pixel-sm text-gold">CAMPAIGNS</h2>
        </div>
        {!isAdding && !editingId && (
          <button
            onClick={() => setIsAdding(true)}
            className="pixel-btn pixel-btn-primary text-pixel-xs"
          >
            + Launch New Campaign
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <div className="panel p-4 space-y-4">
          <h3 className="font-pixel text-pixel-xs text-beige">
            {editingId ? 'Edit Campaign' : 'Launch New Campaign'}
          </h3>
          <div className="pixel-divider" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
                Campaign Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                className="pixel-input w-full"
                placeholder="Authentication Crusade"
              />
            </div>
            <div>
              <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
                JIRA Key *
              </label>
              <input
                type="text"
                value={formData.key}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    key: e.target.value.toUpperCase(),
                  }))
                }
                className="pixel-input w-full"
                placeholder="FOAM-123"
              />
            </div>
          </div>
          <div>
            <label className="block font-pixel text-pixel-xs text-beige/70 mb-2">
              Campaign Briefing
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={3}
              className="pixel-input w-full resize-none"
              placeholder="Describe the campaign objectives..."
            />
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
              {isSaving ? 'Saving...' : editingId ? 'Update' : 'Launch'}
            </button>
          </div>
        </div>
      )}

      {/* Campaigns List */}
      {epics.length === 0 ? (
        <div className="panel p-8 text-center">
          <div className="text-4xl mb-4">🏰</div>
          <p className="font-readable text-xl text-beige/70">
            No campaigns yet. Launch a campaign to organize your quests.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {epics.map((epic) => {
            const stats = getCampaignStats(epic.id);

            return (
              <div key={epic.id} className="panel p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2 py-1 bg-rarity-epic/20 border-2 border-rarity-epic font-pixel text-pixel-xs text-rarity-epic rounded">
                        {epic.key}
                      </span>
                      <h4 className="font-pixel text-pixel-xs text-gold">
                        {epic.name}
                      </h4>
                    </div>

                    {/* Description */}
                    {epic.description && (
                      <p className="font-readable text-lg text-beige/60 italic mb-3">
                        "{epic.description}"
                      </p>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-6 mb-3">
                      <span className="font-readable text-base text-beige/70">
                        Quests:{' '}
                        <span className="text-quest-active">{stats.active}</span> active,{' '}
                        <span className="text-quest-complete">{stats.complete}</span> complete
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-3">
                      <span className="font-readable text-sm text-beige/50">Progress:</span>
                      <div className="flex-1 max-w-[300px] xp-bar h-4">
                        <div
                          className="xp-bar-fill h-full"
                          style={{ width: `${stats.progress}%` }}
                        />
                      </div>
                      <span className="font-pixel text-pixel-xs text-quest-complete">
                        {stats.progress}%
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditing(epic)}
                      className="pixel-btn text-pixel-xs"
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDelete(epic.id)}
                      className="pixel-btn pixel-btn-danger text-pixel-xs"
                      title="End Campaign"
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
