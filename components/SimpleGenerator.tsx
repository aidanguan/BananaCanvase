import React, { useState, useRef, useEffect } from 'react';
import { ImageIcon, Wand2, RefreshCw } from './ui/Icons';
import { generateImageContent } from '../services/geminiService';
import { AppSettings, ImageSize, AspectRatio } from '../types';
import { ASPECT_RATIOS, getAvailableImageSizes } from '../constants';

interface SimpleGeneratorProps {
  settings: AppSettings;
  onAuthError?: () => void;
  onUpdateSettings?: (settings: Partial<AppSettings>) => void;
}

const SimpleGenerator: React.FC<SimpleGeneratorProps> = ({ settings, onAuthError, onUpdateSettings }) => {
  const [prompt, setPrompt] = useState('');
  const [refImage, setRefImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 获取当前模型支持的分辨率选项
  const availableImageSizes = getAvailableImageSizes(settings.modelId);

  // 当模型变化时，检查当前分辨率是否支持，如果不支持则重置为 1K
  useEffect(() => {
    const isCurrentSizeSupported = availableImageSizes.some(size => size.id === settings.imageSize);
    if (!isCurrentSizeSupported && onUpdateSettings) {
      onUpdateSettings({ imageSize: '1K' });
    }
  }, [settings.modelId, settings.imageSize, availableImageSizes, onUpdateSettings]);

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
          创建新图
        </h2>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">描述</label>
          <textarea
            className="w-full h-32 bg-dark-bg border border-dark-border rounded-lg p-3 text-white focus:border-banana-500 focus:outline-none resize-none"
            placeholder="描述你想生成的图像..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        {/* 分辨率和宽高比选择 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">分辨率</label>
            <select
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-banana-500 transition-colors"
              value={settings.imageSize}
              onChange={(e) => onUpdateSettings?.({ imageSize: e.target.value as ImageSize })}
              disabled={availableImageSizes.length === 1}
            >
              {availableImageSizes.map((size) => (
                <option key={size.id} value={size.id}>{size.name}</option>
              ))}
            </select>
            {availableImageSizes.length === 1 && (
              <p className="text-xs text-slate-500 mt-1">当前模型仅支持 1K 分辨率</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">宽高比</label>
            <select
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-banana-500 transition-colors"
              value={settings.aspectRatio}
              onChange={(e) => onUpdateSettings?.({ aspectRatio: e.target.value as AspectRatio })}
            >
              {ASPECT_RATIOS.map((ratio) => (
                <option key={ratio.id} value={ratio.id}>{ratio.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">参考图像（可选）</label>
          <div 
            className="border-2 border-dashed border-dark-border rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-banana-500 transition-colors h-48 bg-dark-bg relative overflow-hidden shrink-0"
            onClick={() => fileInputRef.current?.click()}
          >
            {refImage ? (
              <img src={refImage} alt="Reference" className="w-full h-full object-contain" />
            ) : (
              <div className="text-center text-slate-500">
                <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                <p>点击上传</p>
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
              <RefreshCw className="w-5 h-5 animate-spin" /> 生成中...
            </>
          ) : (
            <>
              <Wand2 className="w-5 h-5" /> 生成
            </>
          )}
        </button>
        {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 mt-2 shrink-0">
                <p className="text-red-400 text-sm">{error}</p>
                {(error.includes('403') || error.includes('permission')) && (
                    <p className="text-red-300 text-xs mt-1">请在配置中检查你的 API 密钥。</p>
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
            <p>你的作品将显示在这里</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleGenerator;