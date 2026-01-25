import { Clock } from 'lucide-react'

interface HistoryPanelProps {
  history: any[]
  onImageClick: (images: string[]) => void
}

export default function HistoryPanel({ history, onImageClick }: HistoryPanelProps) {
  if (history.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border-2 border-dashed border-gray-300">
        <p className="text-gray-600 text-center">暂无生成记录</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <Clock className="mr-2" size={20} />
          历史生成
        </h3>
        <a href="#" className="text-sm text-primary-600 hover:text-primary-700">
          查看全部
        </a>
      </div>
      <div className="space-y-4">
        {history.map((item) => (
          <div
            key={item.id}
            className="border border-gray-200 rounded-lg p-4 hover:border-primary-500 cursor-pointer"
            onClick={() => {
              if (item.result_urls && item.result_urls.length > 0) {
                onImageClick(item.result_urls)
              }
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-900 font-medium line-clamp-2">{item.prompt}</p>
                <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                  <span>{item.model}</span>
                  <span>{item.width}×{item.height}</span>
                  <span>{item.quality}</span>
                  <span>消耗 {item.points_cost} 积分</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(item.created_at).toLocaleString('zh-CN')}
                </p>
              </div>
              {item.result_urls && item.result_urls.length > 0 && (
                <img
                  src={item.result_urls[0]}
                  alt="预览"
                  className="w-20 h-20 object-cover rounded ml-4"
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

