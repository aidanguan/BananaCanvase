import React, { useState, useEffect } from 'react';
import { AppSettings, ModelId, ModelProvider } from '../types';
import { MODELS, PROVIDERS } from '../constants';
import { Settings, RefreshCw, Layers } from './ui/Icons';

interface SettingsBarProps {
  settings: AppSettings;
  onUpdate: (newSettings: Partial<AppSettings>) => void;
}

const SettingsBar: React.FC<SettingsBarProps> = ({ settings, onUpdate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasWindowAuth, setHasWindowAuth] = useState(false);
  
  // Local state for the modal form
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

  useEffect(() => {
    setHasWindowAuth(!!window.aistudio);
  }, []);

  const openModal = () => {
    setLocalSettings(settings);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSave = () => {
    onUpdate(localSettings);
    closeModal();
  };

  const handleProviderChange = (provider: ModelProvider) => {
    setLocalSettings({ ...localSettings, provider });
  };

  const handleGoogleAuth = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        // Clear manual key to prefer the injected env var
        setLocalSettings(prev => ({ ...prev, apiKey: '' }));
      } catch (e) {
        console.error("Key selection failed", e);
      }
    }
  };

  return (
    <>
      <div className="w-full bg-dark-surface border-b border-dark-border p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md z-10">
        <div className="flex items-center gap-2 text-banana-400 font-bold text-xl">
          <Settings className="w-6 h-6" />
          <span>Banana Canvas AI</span>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
           {/* Quick Model Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 font-medium ml-1">Model</label>
            <select
              className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-banana-500 transition-colors"
              value={settings.modelId}
              onChange={(e) => onUpdate({ modelId: e.target.value as ModelId })}
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={openModal}
            className="flex items-center gap-2 bg-dark-bg hover:bg-dark-border border border-dark-border text-slate-200 px-4 py-2 rounded-lg transition-colors text-sm font-medium mt-auto h-[38px]"
          >
            <Settings className="w-4 h-4" />
            <span>Config</span>
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-dark-surface border border-dark-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-dark-border bg-dark-bg/50 flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-banana-400" />
                Connection Settings
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-white text-xl leading-none">&times;</button>
            </div>
            
            <div className="p-6 flex flex-col gap-5">
              
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-300">Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleProviderChange(p.id)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                        localSettings.provider === p.id
                          ? 'bg-banana-500/10 border-banana-500 text-banana-400'
                          : 'bg-dark-bg border-dark-border text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-300">API Key</label>
                <div className="flex gap-2">
                    <input
                      type="password"
                      value={localSettings.apiKey}
                      onChange={(e) => setLocalSettings({ ...localSettings, apiKey: e.target.value })}
                      placeholder={hasWindowAuth && !localSettings.apiKey ? "Using Google Account Key" : "Enter your API Key"}
                      className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:border-banana-500 outline-none flex-1"
                    />
                    {hasWindowAuth && localSettings.provider === ModelProvider.GOOGLE && (
                        <button 
                            onClick={handleGoogleAuth}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
                            title="Select Google Account Key"
                        >
                            Connect Google
                        </button>
                    )}
                </div>
                <p className="text-xs text-slate-500">
                    {hasWindowAuth && !localSettings.apiKey 
                        ? "Using key from selected Google Account." 
                        : "Enter manually or connect account."}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-300">Base URL <span className="text-slate-500 font-normal">(Optional)</span></label>
                <input
                  type="text"
                  value={localSettings.baseUrl}
                  onChange={(e) => setLocalSettings({ ...localSettings, baseUrl: e.target.value })}
                  placeholder="https://..."
                  className="bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-white focus:border-banana-500 outline-none"
                />
                 <p className="text-xs text-slate-500">Leave empty for default Google endpoints.</p>
              </div>

            </div>

            <div className="p-4 border-t border-dark-border bg-dark-bg/50 flex justify-end gap-3">
              <button 
                onClick={closeModal}
                className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-dark-border transition-colors text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="px-6 py-2 rounded-lg bg-banana-500 hover:bg-banana-600 text-white font-bold shadow-lg shadow-banana-500/20 transition-colors text-sm"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SettingsBar;