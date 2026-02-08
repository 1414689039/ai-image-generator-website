import { AlertTriangle } from 'lucide-react'

export default function Maintenance() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0a0a0a] text-white p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
            <div className="w-24 h-24 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 animate-pulse">
                <AlertTriangle size={48} className="text-yellow-500" />
            </div>
        </div>
        
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">
          系统维护中
        </h1>
        
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
            <p className="text-gray-300 leading-relaxed">
              为了给您提供更好的服务，我们正在对系统进行升级维护。
              <br />
              请稍后再试，感谢您的理解与支持。
            </p>
        </div>

        <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-sm text-gray-400 transition-colors"
        >
            刷新页面
        </button>
      </div>
    </div>
  )
}
