import { useState, useRef } from 'react'
import { Sparkles, Upload } from 'lucide-react'

interface GeneratePanelProps {
  selectedTab: 'image' | 'video'
  onTabChange: (tab: 'image' | 'video') => void
  onGenerate: (data: any) => void
}

export default function GeneratePanel({ selectedTab, onTabChange, onGenerate }: GeneratePanelProps) {
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('Nano Banana')
  const [referenceImage, setReferenceImage] = useState<string | null>(null)
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [resolution, setResolution] = useState('1024*1024')
  const [quantity, setQuantity] = useState(1)
  const [quality, setQuality] = useState('standard')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setReferenceImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleGenerate = () => {
    if (!prompt.trim()) {
      alert('请输入提示词')
      return
    }

    const [width, height] = resolution.split('*').map(Number)

    onGenerate({
      type: referenceImage ? 'image_to_image' : 'text_to_image',
      prompt,
      referenceImage,
      model,
      width,
      height,
      quality,
      quantity,
    })
  }

  const calculatePoints = () => {
    // 简化的积分计算（实际应该从API获取）
    const basePoints = quality === 'standard' ? 1 : quality === 'hd' ? 2 : 3
    return basePoints * quantity
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Generate</h2>

      {/* 标签切换 */}
      <div className="flex space-x-2 border-b">
        <button
          onClick={() => onTabChange('image')}
          className={`px-4 py-2 font-medium ${
            selectedTab === 'image'
              ? 'border-b-2 border-primary-600 text-primary-600'
              : 'text-gray-600'
          }`}
        >
          图片
        </button>
        <button
          onClick={() => onTabChange('video')}
          className={`px-4 py-2 font-medium ${
            selectedTab === 'video'
              ? 'border-b-2 border-primary-600 text-primary-600'
              : 'text-gray-600'
          }`}
        >
          视频
        </button>
      </div>

      {/* 模型选择 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">模型</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500"
        >
          <option>Nano Banana</option>
          <option>其他模型</option>
        </select>
      </div>

      {/* 上传参考图 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">上传参考图</label>
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-500"
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">点击上传参考图</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
        {referenceImage && (
          <div className="mt-2 relative">
            <img src={referenceImage} alt="参考图" className="w-full h-32 object-cover rounded" />
            <button
              onClick={() => setReferenceImage(null)}
              className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs"
            >
              删除
            </button>
          </div>
        )}
      </div>

      {/* 提示词输入 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">提示词</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="描述你想生成的内容..."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500"
        />
        <a href="#" className="text-sm text-primary-600 hover:text-primary-700 mt-1 flex items-center">
          <Sparkles size={14} className="mr-1" />
          提示词优化
        </a>
      </div>

      {/* 宽高比 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">宽高比</label>
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={aspectRatio === '1:1'}
              onChange={(e) => {
                if (e.target.checked) {
                  setAspectRatio('1:1')
                  setResolution('1024*1024')
                }
              }}
              className="mr-2"
            />
            1:1
          </label>
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500"
          >
            <option value="1024*1024">1024*1024</option>
            <option value="1024*768">1024*768</option>
            <option value="768*1024">768*1024</option>
            <option value="512*512">512*512</option>
          </select>
        </div>
      </div>

      {/* 画质 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">画质</label>
        <select
          value={quality}
          onChange={(e) => setQuality(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500"
        >
          <option value="standard">标准</option>
          <option value="hd">高清</option>
          <option value="ultra_hd">超高清</option>
        </select>
      </div>

      {/* 数量 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">数量</label>
        <div className="flex space-x-2">
          {[1, 2, 3, 4].map((num) => (
            <button
              key={num}
              onClick={() => setQuantity(num)}
              className={`flex-1 py-2 border rounded-md ${
                quantity === num
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'border-gray-300 text-gray-700 hover:border-primary-500'
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      {/* 生成按钮 */}
      <button
        onClick={handleGenerate}
        className="w-full py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium"
      >
        生成 ({calculatePoints().toFixed(2)} points)
      </button>
    </div>
  )
}

