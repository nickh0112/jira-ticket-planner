import { useState, useEffect } from 'react';
import { usePMStore } from '../../store/pmStore';

export function PMConfigModal() {
  const { config, loadConfig, updateConfig } = usePMStore();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    underutilizationDays: 2,
    inactivityDays: 2,
    checkIntervalHours: 1,
  });

  useEffect(() => {
    if (isOpen && !config) {
      loadConfig();
    }
  }, [isOpen, config, loadConfig]);

  useEffect(() => {
    if (config) {
      setFormData({
        underutilizationDays: config.underutilizationDays,
        inactivityDays: config.inactivityDays,
        checkIntervalHours: config.checkIntervalHours,
      });
    }
  }, [config]);

  const handleSave = async () => {
    await updateConfig(formData);
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="stone-button-secondary flex items-center gap-2"
      >
        <span>&#9881;</span>
        <span>Settings</span>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="stone-card p-6 w-full max-w-md">
          <h3 className="font-pixel text-pixel-md text-gold mb-6">
            PM Settings
          </h3>

          <div className="space-y-4">
            {/* Underutilization Days */}
            <div>
              <label className="block text-sm text-beige/80 mb-2">
                Underutilization Threshold (days)
              </label>
              <p className="text-xs text-beige/50 mb-2">
                Alert when an engineer has no new assignments for this many days.
              </p>
              <input
                type="number"
                min={1}
                max={30}
                value={formData.underutilizationDays}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    underutilizationDays: parseInt(e.target.value) || 2,
                  })
                }
                className="w-full px-3 py-2 bg-stone-primary border border-border-stone rounded text-beige focus:border-gold focus:outline-none"
              />
            </div>

            {/* Inactivity Days */}
            <div>
              <label className="block text-sm text-beige/80 mb-2">
                Inactivity Threshold (days)
              </label>
              <p className="text-xs text-beige/50 mb-2">
                Alert when an engineer has no activity for this many days.
              </p>
              <input
                type="number"
                min={1}
                max={30}
                value={formData.inactivityDays}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    inactivityDays: parseInt(e.target.value) || 2,
                  })
                }
                className="w-full px-3 py-2 bg-stone-primary border border-border-stone rounded text-beige focus:border-gold focus:outline-none"
              />
            </div>

            {/* Check Interval */}
            <div>
              <label className="block text-sm text-beige/80 mb-2">
                Check Interval (hours)
              </label>
              <p className="text-xs text-beige/50 mb-2">
                How often to automatically check for underutilized engineers.
              </p>
              <input
                type="number"
                min={1}
                max={24}
                value={formData.checkIntervalHours}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    checkIntervalHours: parseInt(e.target.value) || 1,
                  })
                }
                className="w-full px-3 py-2 bg-stone-primary border border-border-stone rounded text-beige focus:border-gold focus:outline-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-border-stone">
            <button
              onClick={handleSave}
              className="flex-1 stone-button"
            >
              Save Changes
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="stone-button-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
