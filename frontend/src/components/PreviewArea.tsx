import { Image as ImageIcon, Download, ChevronLeft, ChevronRight, Trash2, AlertCircle, Share2, Sparkles, Copy, Check } from 'lucide-react'
import { useState, useEffect } from 'react'
import ZoomableImage from './ZoomableImage'

interface PreviewAreaProps {
  images: string[]
  onDelete?: () => void
  onShare?: () => void
  status?: string
  error?: string
  prompt?: string
}

export default function PreviewArea({ images, onDelete, onShare, status, error, prompt }: PreviewAreaProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setCurrentIndex(0)
  }, [images])

  const handleCopyPrompt = () => {
      if (prompt) {
          navigator.clipboard.writeText(prompt)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
      }
  }

  if (status === 'failed') {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-transparent overflow-hidden p-4">
         <div className="relative w-full max-w-[1200px] h-full md:h-auto md:aspect-[21/9] flex items-center justify-center border-2 border-dashed border-red-500/30 rounded-xl bg-red-900/20 backdrop-blur-sm">
            <div className="text-center">
            <AlertCircle className="mx-auto h-16 w-16 text-red-500" />
            <p className="mt-4 text-red-400 text-lg font-medium">生成失败</p>
            <p className="mt-2 text-red-300/70 text-sm max-w-md mx-auto px-4">{error || '未知错误'}</p>
            
            {onDelete && (
                <button
                    onClick={onDelete}
                    className="mt-6 flex items-center space-x-2 bg-red-600 text-white px-6 py-2 rounded-full hover:bg-red-700 transition-all mx-auto"
                >
                    <Trash2 size={18} />
                    <span>删除记录</span>
                </button>
            )}
            </div>
        </div>
      </div>
    )
  }

  if (images.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-transparent overflow-hidden p-4">
         <div className="relative w-full max-w-[800px] aspect-video flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-white/5 backdrop-blur-sm group hover:bg-white/10 transition-colors">
            <div className="bg-gradient-to-tr from-blue-500/20 to-purple-500/20 p-6 rounded-full mb-6 animate-pulse">
                <ImageIcon className="h-16 w-16 text-white/50" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">准备开始创作</h3>
            <p className="text-gray-400 text-sm max-w-sm text-center">
                在左侧输入提示词，选择模型参数，点击“立即生成”开始您的 AI 艺术之旅
            </p>
        </div>
      </div>
    )
  }

  const currentImage = images[currentIndex]

  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-transparent overflow-hidden p-4 pb-24 md:pb-4 relative">
      {/* 顶部提示词展示 */}
      {prompt && (
          <div className="absolute top-0 left-0 right-0 z-40 p-4 pointer-events-none">
              <div className="max-w-[800px] mx-auto bg-black/60 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-lg pointer-events-auto transition-opacity duration-300 hover:opacity-100 opacity-80 group">
                  <div className="flex items-start gap-3">
                      <Sparkles size={16} className="text-purple-400 shrink-0 mt-1" />
                      <p className="flex-1 text-sm text-gray-200 leading-relaxed line-clamp-2 hover:line-clamp-none transition-all cursor-text select-text">
                          {prompt}
                      </p>
                      <button
                        onClick={handleCopyPrompt}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors shrink-0"
                        title="复制提示词"
                      >
                        {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* 画框容器 - 移动端撑满高度，桌面端固定比例 */}
      <div className="relative w-full max-w-[1200px] h-full md:h-auto md:aspect-[21/9] flex items-center justify-center border-2 border-dashed border-white/20 rounded-xl bg-black/20 backdrop-blur-sm overflow-hidden shadow-2xl">
        
        {/* 图片展示 - 使用 ZoomableImage */}
        <ZoomableImage 
            src={currentImage} 
            alt={`Preview ${currentIndex + 1}`}
            className="w-full h-full object-contain"
        />
        
        {/* 底部操作栏 - 悬浮在画框底部 */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center space-x-3 z-30">
             {/* 分享按钮 */}
             {onShare && (
                <button
                    onClick={onShare}
                    className="flex items-center space-x-2 bg-blue-600/80 text-white px-4 py-2 rounded-full hover:bg-blue-700/90 transition-all backdrop-blur-md border border-white/10"
                    title="分享到灵感社区"
                >
                    <Share2 size={18} />
                    <span className="text-sm font-medium">分享</span>
                </button>
             )}

            {/* 下载按钮 - 使用 fetch blob 触发直接下载 */}
            <button
              onClick={async (e) => {
                e.preventDefault();
                try {
                  const response = await fetch(currentImage);
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  // 从 URL 中提取文件名，如果没有则生成一个
                  const fileName = currentImage.split('/').pop()?.split('?')[0] || `image-${Date.now()}.png`;
                  a.download = fileName;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                } catch (err) {
                  console.error('Download failed:', err);
                  // 降级处理：如果 fetch 失败，尝试直接打开
                  window.open(currentImage, '_blank');
                }
              }}
              className="flex items-center space-x-2 bg-black/60 text-white px-4 py-2 rounded-full hover:bg-black/80 transition-all backdrop-blur-md border border-white/10"
              title="下载原图"
            >
              <Download size={18} />
              <span className="text-sm font-medium">下载</span>
            </button>

            {/* 删除按钮 */}
            {onDelete && (
                <button
                    onClick={onDelete}
                    className="flex items-center space-x-2 bg-red-500/80 text-white px-4 py-2 rounded-full hover:bg-red-600/90 transition-all backdrop-blur-md border border-white/10"
                    title="删除记录"
                >
                    <Trash2 size={18} />
                    <span className="text-sm font-medium">删除</span>
                </button>
            )}
        </div>

        {/* 切换按钮 */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => setCurrentIndex(prev => (prev - 1 + images.length) % images.length)}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors backdrop-blur-sm z-30"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={() => setCurrentIndex(prev => (prev + 1) % images.length)}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors backdrop-blur-sm z-30"
            >
              <ChevronRight size={24} />
            </button>
            
            {/* 底部指示器 - 稍微上移以避开按钮 */}
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex space-x-2 bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm pointer-events-none z-20">
                {images.map((_, idx) => (
                    <div 
                        key={idx}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === currentIndex ? 'bg-white' : 'bg-white/30'}`}
                    />
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

