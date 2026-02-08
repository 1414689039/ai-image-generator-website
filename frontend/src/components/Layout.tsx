import { ReactNode } from 'react'
import Header from './Header'

interface LayoutProps {
  children: ReactNode
  showBackground?: boolean
}

export default function Layout({ children, showBackground = true }: LayoutProps) {
  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col bg-black">
      {/* 统一背景 */}
      {showBackground && (
        <>
          {/* 基础渐变底色 */}
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 via-black to-black z-0" />
          
          {/* 顶部光晕 */}
          <div className="absolute top-[-20%] left-[20%] w-[60%] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none z-0 mix-blend-screen" />
          <div className="absolute top-[-10%] right-[20%] w-[40%] h-[400px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none z-0 mix-blend-screen" />

          {/* 背景图片 (降低不透明度，仅作为纹理) */}
          <div 
            className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-20"
            style={{ 
              backgroundImage: 'url("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop")',
              filter: 'blur(100px)',
              transform: 'scale(1.1)'
            }}
          />
        </>
      )}

      {/* 内容区域 */}
      <div className="relative z-10 flex-1 flex flex-col h-full min-h-0">
        <Header />
        <main className="flex-1 flex flex-col min-h-0 relative">
          {children}
        </main>
      </div>
    </div>
  )
}
