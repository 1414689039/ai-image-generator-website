import { Image as ImageIcon } from 'lucide-react'

interface PreviewAreaProps {
  images: string[]
}

export default function PreviewArea({ images }: PreviewAreaProps) {
  if (images.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 border-2 border-dashed border-gray-300">
        <div className="text-center">
          <ImageIcon className="mx-auto h-16 w-16 text-gray-400" />
          <p className="mt-4 text-gray-600">生成的内容将显示在这里。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">预览区域</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {images.map((url, index) => (
          <div key={index} className="relative">
            <img
              src={url}
              alt={`生成图片 ${index + 1}`}
              className="w-full h-auto rounded-lg"
            />
            <a
              href={url}
              download
              className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-3 py-1 rounded text-sm hover:bg-opacity-70"
            >
              下载
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}

