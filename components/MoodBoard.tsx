import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ImageIcon, 
  Trash2, 
  Wand2, 
  PenTool, 
  Move, 
  Plus,
  RefreshCw,
  Download,
  Eraser,
  MousePointer,
  Settings,
  Layers,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from './ui/Icons';
import { AppSettings, CanvasImage, DrawPath, Point, ImageSize, AspectRatio } from '../types';
import { generateImageContent, enhancePrompt } from '../services/geminiService';
import { ASPECT_RATIOS, getAvailableImageSizes } from '../constants';

interface MoodBoardProps {
  settings: AppSettings;
  onAuthError?: () => void;
  onUpdateSettings?: (settings: Partial<AppSettings>) => void;
}

const MoodBoard: React.FC<MoodBoardProps> = ({ settings, onAuthError, onUpdateSettings }) => {
  // --- State ---
  const [images, setImages] = useState<CanvasImage[]>([]);
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [tool, setTool] = useState<'select' | 'move' | 'draw' | 'pan'>('move');
  
  // Viewport State (Zoom/Pan)
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  
  // Brush Settings
  const [brushColor, setBrushColor] = useState('#f59e0b');
  const [brushSize, setBrushSize] = useState(20); // Larger default for mask painting
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  
  // Sidebar State
  const [showLayers, setShowLayers] = useState(true);
  const [showGenerated, setShowGenerated] = useState(true);
  
  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Interaction State
  const isDrawing = useRef(false);
  const isDragging = useRef(false);
  const isPanning = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const lastPoint = useRef<Point | null>(null);
  const isSpacePressed = useRef(false);

  // 获取当前模型支持的分辨率选项
  const availableImageSizes = getAvailableImageSizes(settings.modelId);

  // 当模型变化时，检查当前分辨率是否支持，如果不支持则重置为 1K
  useEffect(() => {
    const isCurrentSizeSupported = availableImageSizes.some(size => size.id === settings.imageSize);
    if (!isCurrentSizeSupported && onUpdateSettings) {
      onUpdateSettings({ imageSize: '1K' });
    }
  }, [settings.modelId, settings.imageSize, availableImageSizes, onUpdateSettings]);

  // --- Constants ---
  const CANVAS_WIDTH = 2048;
  const CANVAS_HEIGHT = 2048;

  // --- Helpers ---
  
  const getColorName = (hex: string) => {
    switch(hex.toLowerCase()) {
        case '#f59e0b': return '橙色';
        case '#ef4444': return '红色';
        case '#22c55e': return '绿色';
        case '#3b82f6': return '蓝色';
        case '#ffffff': return '白色';
        default: return `Color(${hex})`;
    }
  };

  // Convert screen coordinates to canvas coordinates
  const getCanvasPos = (clientX: number, clientY: number): Point => {
    if (!containerRef.current || !canvasRef.current) return { x: 0, y: 0, pressure: 0.5 };
    
    // The container acts as the window. The content inside is transformed.
    // We need relative coordinates to the transformed origin.
    const rect = containerRef.current.getBoundingClientRect();
    
    const x = (clientX - rect.left - viewport.x) / viewport.scale;
    const y = (clientY - rect.top - viewport.y) / viewport.scale;

    return { x, y, pressure: 0.5 };
  };

  const getCenterOfPath = (points: Point[]) => {
    if (points.length === 0) return { x: 0, y: 0 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach(p => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  };

  // --- Rendering ---
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#1e293b'; // dark-surface background for the canvas area
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grid lines for reference (optional, helps with scale)
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let x=0; x<=CANVAS_WIDTH; x+=100) { ctx.moveTo(x,0); ctx.lineTo(x, CANVAS_HEIGHT); }
    for(let y=0; y<=CANVAS_HEIGHT; y+=100) { ctx.moveTo(0,y); ctx.lineTo(CANVAS_WIDTH, y); }
    ctx.stroke();

    // 1. Draw Images
    images.forEach(img => {
      if (img.visible === false) return;
      const imageEl = new Image();
      imageEl.src = img.src;
      
      if (imageEl.complete && imageEl.naturalWidth > 0) {
        ctx.save();
        ctx.translate(img.x + img.width / 2, img.y + img.height / 2);
        ctx.rotate(img.rotation * Math.PI / 180);
        ctx.drawImage(imageEl, -img.width / 2, -img.height / 2, img.width, img.height);
        
        // Selection highlight
        if (selectedId === img.id) {
          ctx.strokeStyle = '#f59e0b'; // banana-500
          ctx.lineWidth = 4;
          ctx.setLineDash([10, 10]);
          ctx.strokeRect(-img.width / 2, -img.height / 2, img.width, img.height);
          ctx.setLineDash([]);
        }
        ctx.restore();
      }
    });

    // 2. Draw Paths
    paths.forEach(path => {
      if (path.points.length < 2) return;
      
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // Render with 50% opacity to let user see what's underneath while drawing mask
      ctx.globalAlpha = 0.6; 
      ctx.strokeStyle = path.color;

      for (let i = 1; i < path.points.length; i++) {
        const p1 = path.points[i - 1];
        const p2 = path.points[i];
        
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        
        const pressure = p2.pressure > 0 ? p2.pressure : 0.5;
        ctx.lineWidth = path.width * (0.5 + pressure); 
        
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
    });
  }, [images, paths, selectedId]);

  // Render Loop
  useEffect(() => {
    let animationFrameId: number;
    const render = () => {
      drawCanvas();
      animationFrameId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [drawCanvas]);

  // Keyboard Listeners for shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressed.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressed.current = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // --- Event Handlers ---

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault(); // Prevent text selection etc
    const pos = getCanvasPos(e.clientX, e.clientY);
    
    // Check for Middle Click (button 1) or if tool is Pan or Space key is held
    if (e.button === 1 || tool === 'pan' || isSpacePressed.current) {
      isPanning.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
      containerRef.current?.setPointerCapture(e.pointerId);
      return;
    }

    if (tool === 'draw') {
      isDrawing.current = true;
      const newPath: DrawPath = {
        id: Date.now().toString(),
        points: [{ ...pos, pressure: e.pressure }],
        color: brushColor,
        width: brushSize,
        prompt: ''
      };
      setPaths(prev => [...prev, newPath]);
      lastPoint.current = pos;
      canvasRef.current?.setPointerCapture(e.pointerId);
    } else if (tool === 'move') {
      // Hit detection
      const hit = [...images].reverse().find(img => 
        pos.x >= img.x && pos.x <= img.x + img.width &&
        pos.y >= img.y && pos.y <= img.y + img.height
      );
      
      if (hit) {
        setSelectedId(hit.id);
        isDragging.current = true;
        lastPos.current = { x: pos.x, y: pos.y }; // Store initial click in canvas space for diffing
        canvasRef.current?.setPointerCapture(e.pointerId);
      } else {
        setSelectedId(null);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      lastPos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const pos = getCanvasPos(e.clientX, e.clientY);

    if (isDrawing.current && tool === 'draw') {
       setPaths(prev => {
         const lastPath = prev[prev.length - 1];
         if (lastPoint.current) {
            const dx = pos.x - lastPoint.current.x;
            const dy = pos.y - lastPoint.current.y;
            if (dx*dx + dy*dy < 2) return prev;
         }
         const updatedPath = { ...lastPath, points: [...lastPath.points, { ...pos, pressure: e.pressure }] };
         return [...prev.slice(0, -1), updatedPath];
       });
       lastPoint.current = pos;
       
    } else if (isDragging.current && selectedId && tool === 'move') {
      const dx = pos.x - lastPos.current.x;
      const dy = pos.y - lastPos.current.y;
      
      setImages(prev => prev.map(img => {
        if (img.id === selectedId) {
          return { ...img, x: img.x + dx, y: img.y + dy };
        }
        return img;
      }));
      lastPos.current = pos; // Update for next frame
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDrawing.current = false;
    isDragging.current = false;
    isPanning.current = false;
    lastPoint.current = null;
    canvasRef.current?.releasePointerCapture(e.pointerId);
    containerRef.current?.releasePointerCapture(e.pointerId);
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Zoom logic
    if (e.ctrlKey || e.metaKey || true) { // Always zoom on wheel for this type of app
        e.preventDefault();
        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
        const newScale = Math.min(Math.max(0.1, viewport.scale + delta), 5);
        
        // Zoom towards pointer
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Calculate how much the viewport position needs to change to keep mouse fixed
            const newX = mouseX - (mouseX - viewport.x) * (newScale / viewport.scale);
            const newY = mouseY - (mouseY - viewport.y) * (newScale / viewport.scale);
            
            setViewport({ x: newX, y: newY, scale: newScale });
        }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = e.target.files;
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const reader = new FileReader();
        reader.onload = (ev) => {
          const src = ev.target?.result as string;
          const img = new Image();
          img.src = src;
          img.onload = () => {
              let w = img.width;
              let h = img.height;
              const maxDim = 500;
              if (w > maxDim || h > maxDim) {
                  const ratio = Math.min(maxDim / w, maxDim / h);
                  w = w * ratio;
                  h = h * ratio;
              }
              const offset = index * 40;
              
              // 计算当前视口中心在画布上的位置
              const viewportCenterX = containerRef.current ? (-viewport.x + containerRef.current.offsetWidth/2) / viewport.scale : CANVAS_WIDTH / 2;
              const viewportCenterY = containerRef.current ? (-viewport.y + containerRef.current.offsetHeight/2) / viewport.scale : CANVAS_HEIGHT / 2;
              
              const newImg: CanvasImage = {
                id: Date.now().toString() + Math.random(),
                src,
                x: viewportCenterX - w/2 + offset,
                y: viewportCenterY - h/2 + offset,
                width: w,
                height: h,
                rotation: 0
              };
              setImages(prev => [...prev, newImg]);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleNewCanvas = () => {
    if (window.confirm('确定要新建画布吗？未保存的内容将丢失。')) {
      setImages([]);
      setPaths([]);
      setGeneratedImages([]);
      setViewport({ x: 0, y: 0, scale: 1 });
    }
  };

  const handleToggleVisibility = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, visible: img.visible === undefined ? false : !img.visible } : img
    ));
  };

  const handleDeleteSelected = () => {
    if (selectedId) {
      setImages(prev => prev.filter(img => img.id !== selectedId));
      setSelectedId(null);
    }
  };

  const updatePathPrompt = (id: string, text: string) => {
    setPaths(prev => prev.map(p => p.id === id ? { ...p, prompt: text } : p));
  };

  // --- Generation Logic ---

  const getContentBounds = () => {
    if (images.length === 0 && paths.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    images.forEach(img => {
      minX = Math.min(minX, img.x);
      minY = Math.min(minY, img.y);
      maxX = Math.max(maxX, img.x + img.width);
      maxY = Math.max(maxY, img.y + img.height);
    });

    paths.forEach(path => {
      path.points.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });
    });

    if (minX === Infinity) return null;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  };

  // Improved helper: now supports specific render modes
  const getCanvasContentAsBase64 = async (options: { mode: 'source' | 'mask' }): Promise<string> => {
    const bounds = getContentBounds();
    if (!bounds) throw new Error("Canvas is empty.");

    const margin = 20;
    const x = bounds.x - margin;
    const y = bounds.y - margin;
    const w = bounds.width + (margin * 2);
    const h = bounds.height + (margin * 2);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) throw new Error("Failed to create image context");

    // SETUP BACKGROUND
    if (options.mode === 'mask') {
        // Mask Mode: Black Background
        ctx.fillStyle = '#000000';
    } else {
        // Source Mode: White Background (neutral for AI)
        ctx.fillStyle = '#ffffff';
    }
    ctx.fillRect(0, 0, w, h);

    // Shift context
    ctx.translate(-x, -y);

    // 1. RENDER IMAGES (Only for Source Mode)
    if (options.mode === 'source') {
        const imagePromises = images.map(img => {
          return new Promise<void>((resolve) => {
            const imageEl = new Image();
            imageEl.onload = () => {
              ctx.save();
              ctx.translate(img.x + img.width / 2, img.y + img.height / 2);
              ctx.rotate(img.rotation * Math.PI / 180);
              ctx.drawImage(imageEl, -img.width / 2, -img.height / 2, img.width, img.height);
              ctx.restore();
              resolve();
            };
            imageEl.onerror = () => resolve(); 
            imageEl.src = img.src;
          });
        });
        await Promise.all(imagePromises);
    }

    // 2. RENDER PATHS (Only for Mask Mode)
    if (options.mode === 'mask') {
        paths.forEach(path => {
          if (path.points.length < 2) return;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          // Mask Mode: White strokes
          ctx.strokeStyle = '#ffffff';

          for (let i = 1; i < path.points.length; i++) {
            const p1 = path.points[i - 1];
            const p2 = path.points[i];
            
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            
            const pressure = p2.pressure > 0 ? p2.pressure : 0.5;
            // Draw slightly thicker in mask mode to ensure coverage
            ctx.lineWidth = Math.max(path.width * (0.5 + pressure), 5); 
            ctx.stroke();
          }
        });
    }

    return tempCanvas.toDataURL('image/png');
  };

  const handleGenerate = async () => {
    // 检查是否有内容可以生成
    const hasImages = images.length > 0;
    const hasUserPrompt = userPrompt && userPrompt.trim().length > 0;
    const hasPaths = paths.length > 0;
    
    // 如果没有任何内容，提示用户
    if (!hasImages && !hasUserPrompt && !hasPaths) {
      alert('请上传图片或输入调整意见后再生成');
      return;
    }
    
    // Collect comments from paths
    const activePaths = paths.filter(p => p.prompt && p.prompt.trim().length > 0);
    const hasAnnotations = paths.length > 0;

    let finalPrompt = "You are an expert image editor. ";
    
    // 添加用户输入的调整意见
    if (hasUserPrompt) {
      finalPrompt += `

USER REQUEST: ${userPrompt.trim()}

`;
    }
    
    // 如果没有图片，只有文字描述，则直接生成图片
    if (!hasImages) {
      if (!hasUserPrompt) {
        alert('请输入调整意见或上传图片');
        return;
      }
      
      // 纯文本生成模式
      finalPrompt = `Create a high-quality image based on the following description: ${userPrompt.trim()}`;
      
      setIsGenerating(true);
      try {
        const resultBase64 = await generateImageContent(finalPrompt, settings, []);
        setGeneratedImages(prev => [resultBase64, ...prev]);
      } catch (e: any) {
        console.error(e);
        const msg = e.message || '';
        if (onAuthError && (msg.includes('403') || msg.includes('permission'))) {
          onAuthError();
        }
        alert(`生成失败: ${msg}`);
      } finally {
        setIsGenerating(false);
      }
      return;
    }
    
    // 以下是有图片的情况
    if (hasAnnotations) {
        finalPrompt += "I have provided two images:\n";
        finalPrompt += "1. A Source Image containing the scene to edit.\n";
        finalPrompt += "2. A B&W Mask Image (Black background, White strokes) indicating EXACTLY where to apply changes.\n\n";
        finalPrompt += "TASK: Apply the following edits ONLY to the white masked areas on the Source Image. Keep the rest of the image unchanged.\n\n";
        
        finalPrompt += "EDIT INSTRUCTIONS:\n";
        if (activePaths.length > 0) {
            activePaths.forEach((p, idx) => {
                const colorName = getColorName(p.color);
                finalPrompt += `- Area ${idx + 1} (${colorName} on canvas): ${p.prompt}\n`;
            });
        } else {
            finalPrompt += "- Update the content in the masked area to fit the surrounding scene naturally.\n";
        }
        finalPrompt += "\nOutput ONLY the final edited image. Do NOT show the mask or the colored lines.";
    } else {
        finalPrompt += "The attached image is a composition layout. Refine it into a realistic, cohesive high-quality image. Blend the edges of the reference photos naturally.";
    }

    setIsGenerating(true);
    try {
      // 1. Get Clean Source (No drawings)
      const sourceImageBase64 = await getCanvasContentAsBase64({ mode: 'source' });
      
      const inputs = [sourceImageBase64];

      // 2. Get Mask (Drawings only, white on black)
      if (hasAnnotations) {
          const maskImageBase64 = await getCanvasContentAsBase64({ mode: 'mask' });
          inputs.push(maskImageBase64);
      }

      // 3. Send both to AI
      const resultBase64 = await generateImageContent(finalPrompt, settings, inputs);
      setGeneratedImages(prev => [resultBase64, ...prev]);

    } catch (e: any) {
      console.error(e);
      const msg = e.message || '';
      if (onAuthError && (msg.includes('403') || msg.includes('permission'))) {
          onAuthError();
      }
      alert(`Generation failed: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const addGeneratedToBoard = (src: string) => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
        const centerX = (-viewport.x + containerRef.current!.offsetWidth/2) / viewport.scale;
        const centerY = (-viewport.y + containerRef.current!.offsetHeight/2) / viewport.scale;
        
        const newImg: CanvasImage = {
            id: Date.now().toString(),
            src,
            x: centerX - img.width/2, 
            y: centerY - img.height/2,
            width: 400,
            height: 400 * (img.height/img.width),
            rotation: 0
        };
        setImages(prev => [...prev, newImg]);
    }
  };

  const handleDownload = (src: string) => {
    const link = document.createElement('a');
    link.href = src;
    link.download = `banana-canvas-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 优化prompt的函数
  const handleEnhancePrompt = async () => {
    if (!userPrompt.trim()) {
      alert('请先输入调整意见后再优化');
      return;
    }
    
    setIsEnhancing(true);
    try {
      const enhancedText = await enhancePrompt(userPrompt, settings);
      setUserPrompt(enhancedText);
    } catch (err: any) {
      const msg = err.message || '';
      if (onAuthError && (msg.includes('403') || msg.includes('permission'))) {
        onAuthError();
      }
      alert(`优化失败: ${msg}`);
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-dark-bg">
      {/* Toolbar */}
      <div className="bg-dark-surface p-2 border-b border-dark-border flex items-center justify-between z-20 shadow-md shrink-0">
        <div className="flex items-center gap-2">
            <div className="flex bg-dark-bg rounded-lg border border-dark-border p-1">
                <button 
                    onClick={() => setTool('move')} 
                    className={`p-2 rounded-md transition-colors ${tool === 'move' ? 'bg-banana-500 text-white' : 'text-slate-400 hover:text-white'}`}
                    title="移动图像 (V)"
                >
                    <Move className="w-5 h-5" />
                </button>
                <button 
                    onClick={() => setTool('pan')} 
                    className={`p-2 rounded-md transition-colors ${tool === 'pan' ? 'bg-banana-500 text-white' : 'text-slate-400 hover:text-white'}`}
                    title="平移视图 (Space+拖拽)"
                >
                    <MousePointer className="w-5 h-5" />
                </button>
                <button 
                    onClick={() => setTool('draw')} 
                    className={`p-2 rounded-md transition-colors ${tool === 'draw' ? 'bg-banana-500 text-white' : 'text-slate-400 hover:text-white'}`}
                    title="遮罩画笔 (P)"
                >
                    <PenTool className="w-5 h-5" />
                </button>
            </div>

            {tool === 'draw' && (
                <div className="flex items-center gap-3 px-3 border-l border-dark-border animate-in fade-in">
                    <input 
                        type="range" min="5" max="100" value={brushSize} 
                        onChange={(e) => setBrushSize(parseInt(e.target.value))}
                        className="w-24 accent-banana-500"
                        title="画笔大小" 
                    />
                    <div className="flex gap-1">
                        {/* Colors are visual only for the user, mask is always white for AI */}
                        {['#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#ffffff'].map(c => (
                            <button
                                key={c}
                                onClick={() => setBrushColor(c)}
                                className={`w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition-transform ${brushColor === c ? 'ring-2 ring-white scale-110' : ''}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                </div>
            )}

            <div className="w-px h-8 bg-dark-border mx-1"></div>

            <button onClick={() => fileInputRef.current?.click()} className="btn-icon" title="上传图像">
                <ImageIcon className="w-5 h-5 text-slate-400 hover:text-white" />
            </button>
            <input type="file" multiple ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
            
            <button onClick={handleDeleteSelected} disabled={!selectedId} className="btn-icon disabled:opacity-30" title="删除所选">
                <Trash2 className="w-5 h-5 text-red-400" />
            </button>
            
            <button onClick={() => setPaths([])} className="btn-icon" title="清除标注">
                <Eraser className="w-5 h-5 text-slate-400 hover:text-white" />
            </button>
        </div>
        
        <div className="flex items-center gap-4">
             {/* Info Hint - Removed */}
            
            {/* 分辨率和宽高比 */}
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">分辨率</label>
                <select
                  className="bg-dark-bg border border-dark-border rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-banana-500 transition-colors"
                  value={settings.imageSize}
                  onChange={(e) => onUpdateSettings?.({ imageSize: e.target.value as ImageSize })}
                  disabled={availableImageSizes.length === 1}
                  title={availableImageSizes.length === 1 ? '当前模型仅支持 1K' : ''}
                >
                  {availableImageSizes.map((size) => (
                    <option key={size.id} value={size.id}>{size.id}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">宽高比</label>
                <select
                  className="bg-dark-bg border border-dark-border rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-banana-500 transition-colors"
                  value={settings.aspectRatio}
                  onChange={(e) => onUpdateSettings?.({ aspectRatio: e.target.value as AspectRatio })}
                >
                  {ASPECT_RATIOS.map((ratio) => (
                    <option key={ratio.id} value={ratio.id}>{ratio.id}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* 提示：Google provider 不支持宽高比和分辨率 */}
            {settings.provider === 'Google' && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2">
                <p className="text-xs text-blue-200">
                  ⚠️ 当前使用 Google 官方 API，不支持自定义分辨率和宽高比参数。请在配置中切换到 <strong>AIHubMix</strong> 服务商以使用这些功能。
                </p>
              </div>
            )}
            
            <button 
                onClick={handleGenerate}
                disabled={isGenerating}
                className="bg-banana-500 hover:bg-banana-600 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg shadow-banana-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
                {isGenerating ? <RefreshCw className="animate-spin w-4 h-4"/> : <Wand2 className="w-4 h-4" />}
                生成
            </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar (Layers) - Moved to left */}
        {showLayers && (
            <div className="w-60 bg-dark-surface border-r border-dark-border flex flex-col shrink-0" style={{ justifyContent: 'flex-start', alignItems: 'flex-start' }}>
                <div className="p-3 border-b border-dark-border flex items-center justify-between w-full">
                    <span className="font-bold text-slate-300 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-banana-400" />
                        图层
                    </span>
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={handleNewCanvas}
                            className="p-1 text-slate-400 hover:text-white hover:bg-dark-bg rounded transition-colors"
                            title="新建画布"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                        <div className="w-px h-3 bg-dark-border mx-1"></div>
                        <span className="text-xs text-slate-500 mr-1">{images.length}</span>
                        <button 
                            onClick={() => setShowLayers(false)}
                            className="text-slate-500 hover:text-white p-1 hover:bg-dark-bg rounded transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Info Hint - Removed */}
                
                <div className="flex-1 overflow-y-auto p-2 space-y-1 w-full">
                    {images.length === 0 && (
                        <div className="text-center py-8 text-slate-500 text-xs">
                            暂无图层
                        </div>
                    )}
                    {[...images].reverse().map((img) => (
                    <div 
                        key={img.id}
                        onClick={() => setSelectedId(img.id)}
                        className={`p-2 rounded-lg cursor-pointer transition-all border flex items-center gap-2 ${
                            selectedId === img.id 
                            ? 'bg-banana-500/20 border-banana-500/50' 
                            : 'bg-dark-bg/30 border-transparent hover:bg-dark-bg/50'
                        }`}
                    >
                        <button 
                            onClick={(e) => handleToggleVisibility(img.id, e)}
                            className="p-1 rounded hover:bg-dark-bg/50 text-slate-400 hover:text-white"
                            title={img.visible === false ? "显示" : "隐藏"}
                        >
                            {img.visible === false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <div className="w-8 h-8 rounded overflow-hidden bg-dark-bg shrink-0">
                            <img src={img.src} className="w-full h-full object-cover" alt="" />
                        </div>
                        <div className="text-xs text-slate-300 truncate flex-1">
                            图层 {img.id.slice(-4)}
                        </div>
                    </div>
                    ))}
                </div>
            </div>
        )}

        {/* Infinite Canvas Container */}
        <div 
            ref={containerRef}
            className="flex-1 bg-[#0f172a] overflow-hidden relative touch-none cursor-crosshair"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onWheel={handleWheel}
        >
             {/* Floating Toggle Buttons */}
             {!showLayers && (
                <button 
                    onClick={() => setShowLayers(true)}
                    className="absolute left-4 top-4 z-50 p-2 bg-dark-surface border border-dark-border rounded-lg shadow-lg text-slate-400 hover:text-white hover:border-banana-500 transition-all"
                    title="显示图层"
                >
                    <Layers className="w-5 h-5" />
                </button>
             )}
             {!showGenerated && (
                <button 
                    onClick={() => setShowGenerated(true)}
                    className="absolute right-4 top-4 z-50 p-2 bg-dark-surface border border-dark-border rounded-lg shadow-lg text-slate-400 hover:text-white hover:border-banana-500 transition-all"
                    title="显示生成结果"
                >
                    <RefreshCw className="w-5 h-5" />
                </button>
             )}

             {/* Transformed Content Layer */}
            <div 
                style={{ 
                    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
                    transformOrigin: '0 0',
                    width: CANVAS_WIDTH,
                    height: CANVAS_HEIGHT,
                    position: 'absolute'
                }}
            >
                {/* 1. Canvas Layer */}
                <canvas 
                    ref={canvasRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    className="block bg-slate-900 shadow-2xl border border-dark-border"
                />

                {/* 2. UI Overlay Layer (Comment Bubbles) */}
                {paths.map(path => {
                    const center = getCenterOfPath(path.points);
                    return (
                        <div 
                            key={path.id}
                            style={{
                                position: 'absolute',
                                left: center.x,
                                top: center.y,
                                transform: 'translate(-50%, -50%)' 
                            }}
                            className="group z-10"
                        >
                            <div className="relative">
                                {/* Dot Indicator */}
                                <div 
                                    className="w-4 h-4 rounded-full border-2 border-white shadow-sm cursor-pointer hover:scale-125 transition-transform"
                                    style={{ backgroundColor: path.color }}
                                ></div>
                                
                                {/* Input Box - Only visible on hover or if has content */}
                                <div className={`absolute top-6 left-1/2 -translate-x-1/2 min-w-[200px] bg-dark-surface/90 backdrop-blur border border-dark-border p-2 rounded-lg shadow-xl transition-all ${path.prompt ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'}`}>
                                    <textarea 
                                        value={path.prompt || ''}
                                        onChange={(e) => updatePathPrompt(path.id, e.target.value)}
                                        placeholder="描述编辑..."
                                        className="w-full bg-transparent text-xs text-white placeholder-slate-500 outline-none resize-none h-16 pointer-events-auto"
                                        onPointerDown={(e) => e.stopPropagation()} 
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Helper Overlay when empty */}
            {images.length === 0 && paths.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-30 select-none">
                    <ImageIcon className="w-16 h-16 text-slate-500 mb-4" />
                    <p className="text-slate-400">拖放图像</p>
                </div>
            )}
            
            {/* Zoom Indicator */}
            <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur px-3 py-1 rounded text-xs text-slate-400 select-none pointer-events-none">
                {Math.round(viewport.scale * 100)}%
            </div>
            
            {/* 调整意见输入区域 */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[600px] bg-dark-surface/95 backdrop-blur border border-dark-border rounded-lg shadow-2xl p-3">
                <div className="flex items-start gap-2">
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-400">调整意见</span>
                            <button
                                onClick={handleEnhancePrompt}
                                disabled={isEnhancing || !userPrompt.trim()}
                                className="p-1 rounded-md text-banana-400 hover:text-banana-300 hover:bg-dark-bg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="使用AI优化描述"
                            >
                                {isEnhancing ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                    <Sparkles className="w-3 h-3" />
                                )}
                            </button>
                        </div>
                        <textarea
                            value={userPrompt}
                            onChange={(e) => setUserPrompt(e.target.value)}
                            placeholder="输入调整意见... 例如：让天空更蓝一些，增加暖色调，移除背景中的人物等"
                            className="w-full bg-dark-bg/50 border border-dark-border rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-banana-500 resize-none transition-colors"
                            rows={2}
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerMove={(e) => e.stopPropagation()}
                            onPointerUp={(e) => e.stopPropagation()}
                        />
                    </div>
                    {userPrompt.trim() && (
                        <button
                            onClick={() => setUserPrompt('')}
                            className="p-2 text-slate-400 hover:text-white hover:bg-dark-bg rounded transition-colors shrink-0 mt-5"
                            title="清空"
                        >
                            <Eraser className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                    💡 提示：描述您想要的修改效果，AI会根据您的意见调整图片
                </div>
            </div>
        </div>

        {/* Generated Sidebar (Right) */}
        {showGenerated && (
            <div className="w-60 bg-dark-surface border-l border-dark-border flex flex-col z-20 shadow-xl shrink-0">
                <div className="p-4 font-bold text-slate-300 border-b border-dark-border flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-banana-400" />
                        生成结果
                    </span>
                    <div className="flex items-center gap-2">
                         <span className="text-xs font-normal text-slate-500">{generatedImages.length}</span>
                         <button 
                            onClick={() => setShowGenerated(false)}
                            className="text-slate-500 hover:text-white p-1 hover:bg-dark-bg rounded transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
                    {generatedImages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-500 text-sm text-center opacity-50">
                            <Wand2 className="w-8 h-8 mb-2" />
                            <p>标注你的画板<br/>然后点击生成</p>
                        </div>
                    )}
                    {generatedImages.map((src, idx) => (
                        <div key={idx} className="group relative rounded-xl overflow-hidden border border-dark-border bg-black shadow-lg">
                            <img src={src} alt={`Result ${idx}`} className="w-full h-auto" />
                            <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => addGeneratedToBoard(src)}
                                        className="bg-banana-500 p-2 rounded-full text-white hover:bg-banana-400 hover:scale-110 transition-all shadow-lg"
                                        title="添加到画布"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                    <button 
                                        onClick={() => handleDownload(src)}
                                        className="bg-blue-600 p-2 rounded-full text-white hover:bg-blue-500 hover:scale-110 transition-all shadow-lg"
                                        title="下载图像"
                                    >
                                        <Download className="w-5 h-5" />
                                    </button>
                                </div>
                                <button 
                                    onClick={() => setGeneratedImages(prev => prev.filter((_, i) => i !== idx))}
                                    className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 mt-2 hover:underline"
                                >
                                    <Trash2 className="w-3 h-3" /> 移除
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default MoodBoard;
