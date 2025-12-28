import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ImageIcon, Wand2, RefreshCw, Sparkles } from './ui/Icons';
import { generateImageContent, enhancePrompt } from '../services/geminiService';
import { AppSettings, ImageSize, AspectRatio, ReferenceImage } from '../types';
import { ASPECT_RATIOS, getAvailableImageSizes, getMaxImageCount } from '../constants';

interface SimpleGeneratorProps {
  settings: AppSettings;
  onAuthError?: () => void;
  onUpdateSettings?: (settings: Partial<AppSettings>) => void;
}

const SimpleGenerator: React.FC<SimpleGeneratorProps> = ({ settings, onAuthError, onUpdateSettings }) => {
  const [prompt, setPrompt] = useState('');
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 获取当前模型支持的分辨率选项
  const availableImageSizes = getAvailableImageSizes(settings.modelId);
  
  // 获取当前模型支持的最大图片数
  const maxImageCount = getMaxImageCount(settings.modelId);

  // 当模型变化时，检查当前分辨率是否支持，如果不支持则重置为 1K
  useEffect(() => {
    const isCurrentSizeSupported = availableImageSizes.some(size => size.id === settings.imageSize);
    if (!isCurrentSizeSupported && onUpdateSettings) {
      onUpdateSettings({ imageSize: '1K' });
    }
  }, [settings.modelId, settings.imageSize, availableImageSizes, onUpdateSettings]);

  // 当模型变化时,检查图片数量是否超限
  useEffect(() => {
    if (referenceImages.length > maxImageCount) {
      setUploadError(`当前模型最多支持${maxImageCount}张图片,请删除多余图片或取消勾选`);
    } else {
      setUploadError(null);
    }
  }, [settings.modelId, maxImageCount, referenceImages.length]);

  // 计算已勾选的图片
  const selectedImages = useMemo(() => 
    referenceImages.filter(img => img.isSelected),
    [referenceImages]
  );

  // 检查是否超过模型限制
  const isOverLimit = referenceImages.length >= maxImageCount;

  // 多文件上传处理
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setUploadError(null);
    const files: File[] = Array.from(e.target.files) as File[];
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    
    const validFiles: File[] = [];
    const errors: string[] = [];
    
    // 验证文件
    files.forEach((file) => {
      if (!allowedTypes.includes(file.type)) {
        errors.push(`${file.name}: 仅支持PNG、JPG、WEBP格式图片`);
        return;
      }
      if (file.size > maxFileSize) {
        errors.push(`${file.name}: 图片大小不能超过10MB`);
        return;
      }
      if (referenceImages.length + validFiles.length >= maxImageCount) {
        if (errors.length === 0) {
          errors.push(`已达到当前模型上传限制(${maxImageCount}张)`);
        }
        return;
      }
      validFiles.push(file);
    });
    
    if (errors.length > 0) {
      setUploadError(errors.join('; '));
    }
    
    // 读取有效文件
    const newImages: ReferenceImage[] = [];
    for (const file of validFiles) {
      try {
        const reader = new FileReader();
        const result = await new Promise<string>((resolve, reject) => {
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        newImages.push({
          id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          src: result,
          comment: '',
          isSelected: true,
          uploadTime: Date.now(),
        });
      } catch (err) {
        console.error('Failed to read file:', file.name, err);
      }
    }
    
    if (newImages.length > 0) {
      setReferenceImages(prev => [...prev, ...newImages]);
    }
    
    // 重置文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [referenceImages.length, maxImageCount]);

  // 删除图片
  const handleDeleteImage = useCallback((id: string) => {
    setReferenceImages(prev => prev.filter(img => img.id !== id));
    setUploadError(null);
  }, []);

  // 切换图片选中状态
  const handleToggleImage = useCallback((id: string) => {
    setReferenceImages(prev => prev.map(img => 
      img.id === id ? { ...img, isSelected: !img.isSelected } : img
    ));
  }, []);

  // 更新图片comment
  const handleUpdateComment = useCallback((id: string, comment: string) => {
    setReferenceImages(prev => prev.map(img => 
      img.id === id ? { ...img, comment } : img
    ));
  }, []);

  // 构建合并后prompt
  const buildMergedPrompt = useCallback(() => {
    const parts: string[] = [];
    
    // 添加全局描述
    if (prompt.trim()) {
      parts.push(prompt.trim());
    }
    
    // 添加每张勾选图片的意见
    selectedImages.forEach((image, index) => {
      if (image.comment.trim()) {
        parts.push(`参考图片${index + 1}的说明: ${image.comment.trim()}`);
      }
    });
    
    return parts.join('\n\n');
  }, [prompt, selectedImages]);

  const handleGenerate = async () => {
    // 验证是否有有效输入
    const hasPrompt = prompt.trim().length > 0;
    const hasSelectedImages = selectedImages.length > 0;
    
    if (!hasPrompt && !hasSelectedImages) {
      setError('请至少填写描述或选择一张参考图片');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const mergedPrompt = buildMergedPrompt();
      const imageInputs = selectedImages.map(img => img.src);
      
      const result = await generateImageContent(
        mergedPrompt || '生成图像', // 如果没有文本prompt,提供默认值
        settings, 
        imageInputs.length > 0 ? imageInputs : undefined
      );
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

  // 优化prompt的函数
  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) {
      setError('请先输入描述后再优化');
      return;
    }
    
    setIsEnhancing(true);
    setError(null);
    try {
      const enhancedText = await enhancePrompt(prompt, settings);
      setPrompt(enhancedText);
    } catch (err: any) {
      const msg = err.message || '';
      if (onAuthError && (msg.includes('403') || msg.includes('permission'))) {
        onAuthError();
      }
      setError(`优化失败: ${msg}`);
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <div className="flex gap-4 p-6 max-w-[1920px] mx-auto h-full">
      {/* Input Section */}
      <div className="w-80 flex flex-col gap-4 bg-dark-surface p-6 rounded-xl border border-dark-border overflow-y-auto min-h-0">
        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-banana-400" />
          创建新图
        </h2>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-400">描述</label>
            <button
              onClick={handleEnhancePrompt}
              disabled={isEnhancing || !prompt.trim()}
              className="p-1 rounded-md text-banana-400 hover:text-banana-300 hover:bg-dark-bg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="使用AI优化描述"
            >
              {isEnhancing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
            </button>
          </div>
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
        
        {/* 提示：Google provider 不支持宽高比和分辨率 */}
        {settings.provider === 'Google' && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <p className="text-sm text-blue-200">
              ⚠️ 当前使用 Google 官方 API，不支持自定义分辨率和宽高比参数。
              请在配置中切换到 <strong>AIHubMix</strong> 服务商以使用这些功能。
            </p>
          </div>
        )}

        {/* 多图上传区 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-400">
              参考图像（可选）
            </label>
            <span className="text-xs text-slate-500">
              已上传: {referenceImages.length}/{maxImageCount}
            </span>
          </div>
          
          {/* 上传按钮 */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isOverLimit}
            className={`w-full py-3 px-4 rounded-lg border-2 border-dashed transition-colors flex items-center justify-center gap-2 ${
              isOverLimit
                ? 'border-dark-border text-slate-600 cursor-not-allowed'
                : 'border-dark-border text-slate-400 hover:border-banana-500 hover:text-banana-400 cursor-pointer'
            }`}
          >
            <ImageIcon className="w-5 h-5" />
            {isOverLimit ? `已达到当前模型上传限制(${maxImageCount}张)` : '+ 添加参考图片'}
          </button>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/png,image/jpeg,image/jpg,image/webp"
            multiple
            onChange={handleFileChange} 
          />
          
          {/* 上传错误提示 */}
          {uploadError && (
            <div className="mt-2 bg-red-500/10 border border-red-500/50 rounded-lg p-2">
              <p className="text-red-400 text-xs">{uploadError}</p>
            </div>
          )}
          
          {/* 图片卡片列表 */}
          {referenceImages.length > 0 && (
            <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
              {referenceImages.map((image) => (
                <div
                  key={image.id}
                  className="bg-dark-bg border border-dark-border rounded-lg p-3 flex gap-3"
                >
                  {/* 左侧: 勾选框和缩略图 */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-2">
                    <input
                      type="checkbox"
                      checked={image.isSelected}
                      onChange={() => handleToggleImage(image.id)}
                      className="w-4 h-4 rounded border-dark-border bg-dark-surface text-banana-500 focus:ring-banana-500 focus:ring-offset-0 cursor-pointer"
                    />
                    <div className="relative w-20 h-20 rounded overflow-hidden bg-dark-surface border border-dark-border">
                      <img
                        src={image.src}
                        alt="Reference"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                  
                  {/* 右侧: 意见输入框 */}
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">
                        参考意见
                      </span>
                      <button
                        onClick={() => handleDeleteImage(image.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                        title="删除图片"
                      >
                        ×
                      </button>
                    </div>
                    <textarea
                      value={image.comment}
                      onChange={(e) => handleUpdateComment(image.id, e.target.value)}
                      placeholder="描述如何参考这张图片..."
                      className="w-full h-16 bg-dark-surface border border-dark-border rounded px-2 py-1 text-sm text-white placeholder-slate-600 focus:border-banana-500 focus:outline-none resize-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || (!prompt.trim() && selectedImages.length === 0)}
          className={`mt-auto py-3 px-6 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
            loading || (!prompt.trim() && selectedImages.length === 0)
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

      {/* Output Section - Flexible */}
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