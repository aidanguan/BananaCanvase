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
      imageSize: '1K',
      aspectRatio: '1:1'
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
    const hasGeminiKey = !!(import.meta as any).env.VITE_GEMINI_API_KEY;
    const hasAIHubMixKey = !!(import.meta as any).env.VITE_AIHUBMIX_API_KEY;
    
    if (!hasGeminiKey && !hasAIHubMixKey) {
      setShowWelcome(true);
    } else {
      setShowWelcome(false);
    }
  }, [settings.provider]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const handleAuthError = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
      } catch (e) {
        console.error(e);
        setShowWelcome(true);
      }
    } else {
      setShowWelcome(true);
      alert("身份验证失败。请在 .env 文件中检查你的 API 密钥。");
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
                    <h1 className="text-3xl font-bold text-white mb-4">欢迎使用 Banana Canvas</h1>
                    <p className="text-slate-400 mb-8 leading-relaxed">
                        要开始生成图像，请在 <code className="bg-dark-bg px-2 py-1 rounded text-banana-400">.env</code> 文件中配置你的 API 设置。
                        添加 <strong>VITE_GEMINI_API_KEY</strong> 或 <strong>VITE_AIHUBMIX_API_KEY</strong> 以开始使用。
                    </p>
                    {window.aistudio && (
                         <button 
                            onClick={handleAuthError}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold mb-6 transition-transform hover:scale-105 shadow-lg"
                         >
                            连接 Google 账户
                         </button>
                    )}
                    <div className="p-4 bg-banana-500/5 border border-banana-500/20 rounded-lg text-sm text-banana-200">
                        支持 <strong>Google Gemini</strong> 和 <strong>AIHubMix</strong> 服务商。
                    </div>
                </div>
            </div>
        </div>
     )
  }

  return (
    <div className="h-screen bg-dark-bg text-slate-200 font-sans selection:bg-banana-500 selection:text-white flex flex-col overflow-hidden">
      <SettingsBar 
        settings={settings} 
        onUpdate={updateSettings} 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
      />
      
      <main className="relative flex-1 overflow-hidden h-full">
        {activeTab === 'simple' ? (
          <SimpleGenerator settings={settings} onAuthError={handleAuthError} onUpdateSettings={updateSettings} />
        ) : (
          <MoodBoard settings={settings} onAuthError={handleAuthError} onUpdateSettings={updateSettings} />
        )}
      </main>
    </div>
  );
};

export default App;