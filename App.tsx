import React, { useState, useEffect } from 'react';
import SettingsBar from './components/SettingsBar';
import SimpleGenerator from './components/SimpleGenerator';
import MoodBoard from './components/MoodBoard';
import { AppSettings, ModelId, ModelProvider } from './types';
import { Layers, ImageIcon, Wand2 } from './components/ui/Icons';

const App: React.FC = () => {
  // Initialize settings from localStorage if available
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('banana_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
    return {
      provider: ModelProvider.GOOGLE,
      modelId: ModelId.NANO_BANANA,
      apiKey: '',
      baseUrl: ''
    };
  });

  const [activeTab, setActiveTab] = useState<'simple' | 'moodboard'>('simple');
  const [showWelcome, setShowWelcome] = useState(false);

  // Save settings on change
  useEffect(() => {
    localStorage.setItem('banana_settings', JSON.stringify(settings));
  }, [settings]);

  // Check if setup is needed
  useEffect(() => {
    if (!settings.apiKey && !process.env.API_KEY) {
      setShowWelcome(true);
    } else {
        setShowWelcome(false);
    }
  }, [settings.apiKey]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const handleAuthError = async () => {
    if (window.aistudio) {
        try {
            await window.aistudio.openSelectKey();
            // If user selects a key, it should fix the issue.
            // We can clear the local key to ensure it uses the injected one if applicable.
            setSettings(prev => ({...prev, apiKey: ''}));
        } catch (e) {
            console.error(e);
            setShowWelcome(true);
        }
    } else {
        setShowWelcome(true);
        alert("Authentication failed. Please check your API Key in Settings.");
    }
  };

  if (showWelcome) {
     return (
        <div className="h-screen bg-dark-bg text-slate-200 font-sans flex flex-col overflow-hidden">
            <SettingsBar settings={settings} onUpdate={updateSettings} />
            <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto">
                <div className="bg-dark-surface p-8 rounded-2xl border border-dark-border max-w-lg w-full shadow-2xl text-center">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-banana-500/10 rounded-full">
                        <Wand2 className="w-12 h-12 text-banana-500" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-4">Welcome to Banana Canvas</h1>
                    <p className="text-slate-400 mb-8 leading-relaxed">
                        To start generating images, please configure your API settings. 
                        Click the <strong>Config</strong> button in the top bar to enter your API Key.
                    </p>
                    {window.aistudio && (
                         <button 
                            onClick={handleAuthError}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold mb-6 transition-transform hover:scale-105 shadow-lg"
                         >
                            Connect Google Account
                         </button>
                    )}
                    <div className="p-4 bg-banana-500/5 border border-banana-500/20 rounded-lg text-sm text-banana-200">
                        Supports <strong>Google Gemini</strong> and <strong>AIHubMix</strong> providers.
                    </div>
                </div>
            </div>
        </div>
     )
  }

  return (
    <div className="h-screen bg-dark-bg text-slate-200 font-sans selection:bg-banana-500 selection:text-white flex flex-col overflow-hidden">
      <SettingsBar settings={settings} onUpdate={updateSettings} />
      
      {/* Navigation Tabs */}
      <div className="flex justify-center border-b border-dark-border bg-dark-surface/50 backdrop-blur-sm z-10 shrink-0">
        <button
          onClick={() => setActiveTab('simple')}
          className={`px-6 py-4 flex items-center gap-2 font-medium transition-colors border-b-2 ${
            activeTab === 'simple' 
              ? 'border-banana-500 text-banana-400' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          Simple Generator
        </button>
        <button
          onClick={() => setActiveTab('moodboard')}
          className={`px-6 py-4 flex items-center gap-2 font-medium transition-colors border-b-2 ${
            activeTab === 'moodboard' 
              ? 'border-banana-500 text-banana-400' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Mood Board & Edit
        </button>
      </div>

      <main className="relative flex-1 overflow-hidden h-full">
        {activeTab === 'simple' ? (
          <SimpleGenerator settings={settings} onAuthError={handleAuthError} />
        ) : (
          <MoodBoard settings={settings} onAuthError={handleAuthError} />
        )}
      </main>
    </div>
  );
};

export default App;