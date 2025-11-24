import React, { useState, useRef } from 'react';
import { ImageIcon, Wand2, RefreshCw } from './ui/Icons';
import { generateImageContent } from '../services/geminiService';
import { AppSettings } from '../types';

interface SimpleGeneratorProps {
  settings: AppSettings;
  onAuthError?: () => void;
}

const SimpleGenerator: React.FC<SimpleGeneratorProps> = ({ settings, onAuthError }) => {
  const [prompt, setPrompt] = useState('');
  const [refImage, setRefImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        setRefImage(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await generateImageContent(prompt, settings, refImage || undefined);
      setGeneratedImage(result);
    } catch (err: any) {
      const msg = err.message || '';
      // Check for specific permission errors to trigger re-auth
      if (onAuthError && (
          msg.includes('403') || 
          msg.includes('permission') || 
          msg.includes('not found')
      )) {
          onAuthError();
      }
      setError(msg || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 max-w-7xl mx-auto h-full">
      {/* Input Section */}
      <div className="flex-1 flex flex-col gap-4 bg-dark-surface p-6 rounded-xl border border-dark-border overflow-y-auto min-h-0">
        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-banana-400" />
          Create New
        </h2>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Prompt</label>
          <textarea
            className="w-full h-32 bg-dark-bg border border-dark-border rounded-lg p-3 text-white focus:border-banana-500 focus:outline-none resize-none"
            placeholder="Describe what you want to see..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Reference Image (Optional)</label>
          <div 
            className="border-2 border-dashed border-dark-border rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-banana-500 transition-colors h-48 bg-dark-bg relative overflow-hidden shrink-0"
            onClick={() => fileInputRef.current?.click()}
          >
            {refImage ? (
              <img src={refImage} alt="Reference" className="w-full h-full object-contain" />
            ) : (
              <div className="text-center text-slate-500">
                <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                <p>Click to upload</p>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange} 
            />
            {refImage && (
              <button 
                onClick={(e) => { e.stopPropagation(); setRefImage(null); }}
                className="absolute top-2 right-2 bg-black/50 hover:bg-red-500 text-white p-1 rounded-full"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !prompt}
          className={`mt-auto py-3 px-6 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
            loading || !prompt 
              ? 'bg-dark-border text-slate-500 cursor-not-allowed' 
              : 'bg-banana-500 text-white hover:bg-banana-600 shadow-lg shadow-banana-500/20'
          }`}
        >
          {loading ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" /> Generating...
            </>
          ) : (
            <>
              <Wand2 className="w-5 h-5" /> Generate
            </>
          )}
        </button>
        {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 mt-2 shrink-0">
                <p className="text-red-400 text-sm">{error}</p>
                {(error.includes('403') || error.includes('permission')) && (
                    <p className="text-red-300 text-xs mt-1">Please check your API Key in Config.</p>
                )}
            </div>
        )}
      </div>

      {/* Output Section */}
      <div className="flex-1 bg-black rounded-xl border border-dark-border flex items-center justify-center relative overflow-hidden min-h-[400px]">
        {generatedImage ? (
          <img src={generatedImage} alt="Generated" className="max-w-full max-h-full object-contain shadow-2xl" />
        ) : (
          <div className="text-slate-600 text-center">
            <Wand2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p>Your masterpiece will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleGenerator;