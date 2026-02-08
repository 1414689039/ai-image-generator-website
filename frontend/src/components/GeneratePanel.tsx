import { useState, useRef, useEffect } from 'react'
import { Sparkles, Upload, X } from 'lucide-react'
import apiClient from '../api/client'

interface GeneratePanelProps {
  onGenerate: (data: any) => void
  initialData?: {
    prompt?: string
    model?: string
    aspectRatio?: string
    resolution?: string
  } | null
}

const ASPECT_RATIOS = [
  '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'
]

export default function GeneratePanel({ onGenerate, initialData }: GeneratePanelProps) {
  const [model, setModel] = useState('gemini-3-pro-image-preview')
  
  const [prompt, setPrompt] = useState('')
  const [referenceImages, setReferenceImages] = useState<string[]>([])
  
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [resolution, setResolution] = useState('1K')
  const [quantity, setQuantity] = useState(1)
  
  // 积分定价配置
  const [priceConfig, setPriceConfig] = useState<{
    price_1k: number
    price_2k: number
    price_4k: number
  }>({
    price_1k: 2,
    price_2k: 4,
    price_4k: 6
  })

  useEffect(() => {
    // 加载配置
    apiClient.get('/config').then(res => {
        if (res.data?.config) {
            // ... pricing config ...
            setPriceConfig({
                price_1k: parseFloat(res.data.config.price_1k) || 2,
                price_2k: parseFloat(res.data.config.price_2k) || 4,
                price_4k: parseFloat(res.data.config.price_4k) || 6
            })

            // 加载模型列表 (只取第一个模型作为默认值)
            if (res.data.config.provider_models) {
                try {
                    const parsedModels = JSON.parse(res.data.config.provider_models)
                    if (Array.isArray(parsedModels) && parsedModels.length > 0) {
                        setModel(parsedModels[0].id)
                    }
                } catch (e) {
                    console.error('Failed to parse provider models:', e)
                }
            }
        }
    }).catch(err => console.error('Failed to load config:', err))
    
    if (initialData) {
      if (initialData.prompt) setPrompt(initialData.prompt)
      if (initialData.model) setModel(initialData.model)
      if (initialData.aspectRatio) setAspectRatio(initialData.aspectRatio)
      if (initialData.resolution) setResolution(initialData.resolution)
    }
  }, [initialData])
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      Array.from(files).forEach(file => {
        const reader = new FileReader()
        reader.onloadend = () => {
          setReferenceImages(prev => [...prev, reader.result as string])
        }
        reader.readAsDataURL(file)
      })
    }
  }

  const removeImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleGenerate = () => {
    if (!prompt.trim()) {
      alert('请输入提示词')
      return
    }

    onGenerate({
      type: referenceImages.length > 0 ? 'image_to_image' : 'text_to_image',
      prompt,
      referenceImages, // 传递数组
      model,
      size: aspectRatio, 
      resolution,
      quantity,
    })
  }

  const calculatePoints = () => {
    // 根据分辨率计算基础积分
    let basePrice = priceConfig.price_1k
    if (resolution === '2K') basePrice = priceConfig.price_2k
    if (resolution === '4K') basePrice = priceConfig.price_4k
    
    return basePrice * quantity
  }

  return (
    <div className="flex flex-col h-full bg-transparent text-white p-4 overflow-y-auto scrollbar-hide">
      
      <div className="space-y-6 pr-2 mt-4">
        {/* 模型选择 (已隐藏) */}
        {/* <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400">模型</label>
            <div className="relative">
                <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    disabled
                    className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 appearance-none backdrop-blur-md cursor-not-allowed opacity-70 transition-all"
                >
                    <option value={model} className="bg-[#1e1e1e]">{model}</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
            </div>
        </div> */}

        {/* 上传参考图 */}
        <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400">上传参考图 (可多选)</label>
            <div className="grid grid-cols-3 gap-2">
                {referenceImages.map((img, idx) => (
                    <div key={idx} className="relative group aspect-square">
                        <img src={img} alt={`ref-${idx}`} className="w-full h-full object-cover rounded-lg border border-white/10" />
                        <button 
                            onClick={() => removeImage(idx)}
                            className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-sm"
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}
                
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square border border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-all bg-white/5 backdrop-blur-sm group"
                >
                    <div className="bg-white/10 p-2 rounded-full mb-2 group-hover:scale-110 transition-transform">
                        <Upload size={18} className="text-gray-400 group-hover:text-blue-400" />
                    </div>
                    <span className="text-[10px] text-gray-500 group-hover:text-gray-300">上传图片</span>
                </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" />
        </div>

        {/* 提示词 */}
        <div className="space-y-2 flex flex-col">
            <label className="text-xs font-medium text-gray-400">提示词</label>
            <div className="relative w-full">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="描述你想象中的画面... (例如：一只赛博朋克风格的猫，霓虹灯背景，高画质)"
                    className="w-full h-40 bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 resize-none backdrop-blur-md transition-all"
                />
                <button className="absolute bottom-3 right-3 text-xs text-blue-300 hover:text-white flex items-center bg-blue-500/10 hover:bg-blue-500/30 px-3 py-1.5 rounded-lg border border-blue-500/20 transition-all">
                    <Sparkles size={12} className="mr-1" /> 优化
                </button>
            </div>
        </div>
      </div>

      {/* 底部参数区 */}
      <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
        {/* 分辨率 */}
        <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">分辨率</span>
            <div className="flex bg-black/20 rounded p-0.5 border border-white/10">
                {['1K', '2K', '4K'].map(res => (
                    <button
                        key={res}
                        onClick={() => setResolution(res)}
                        className={`px-3 py-1 text-xs rounded transition-colors ${resolution === res ? 'bg-white/20 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        {res}
                    </button>
                ))}
            </div>
        </div>

        {/* 宽高比 */}
        <div className="flex flex-col space-y-2">
            <span className="text-xs font-medium text-gray-400">宽高比</span>
            <div className="grid grid-cols-5 gap-1.5">
                {ASPECT_RATIOS.map((ratio) => (
                    <button
                        key={ratio}
                        onClick={() => setAspectRatio(ratio)}
                        className={`py-1.5 text-[10px] rounded transition-colors ${
                            aspectRatio === ratio 
                                ? 'bg-white/20 text-white font-medium border border-white/30' 
                                : 'bg-black/20 text-gray-400 hover:text-gray-200 border border-transparent hover:border-white/10'
                        }`}
                    >
                        {ratio}
                    </button>
                ))}
            </div>
        </div>

        {/* 数量 */}
        <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">数量</span>
            <div className="flex bg-black/20 rounded p-0.5 space-x-0.5 border border-white/10">
                {[1, 2, 3, 4].map(num => (
                    <button
                        key={num}
                        onClick={() => setQuantity(num)}
                        className={`w-8 py-1 text-xs rounded transition-colors ${quantity === num ? 'bg-white text-black font-bold' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        {num}
                    </button>
                ))}
            </div>
        </div>

        {/* 生成按钮 */}
        <button
            onClick={handleGenerate}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 transition-all flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] border border-white/10 active:scale-[0.98]"
        >
            <Sparkles size={18} className="mr-2 animate-pulse" />
            <span className="text-base">立即生成</span>
            <span className="ml-2 text-xs font-normal opacity-80 bg-black/20 px-2 py-0.5 rounded-full">
                {calculatePoints().toFixed(1)} pts
            </span>
        </button>
      </div>
    </div>
  )
}

