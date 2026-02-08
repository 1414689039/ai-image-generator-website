import { getOptimizedImageSrc } from '../utils/image'

interface ZoomableImageProps {
  src: string
  alt: string
  className?: string
}

export default function ZoomableImage({ src, alt, className }: ZoomableImageProps) {
  const optimizedSrc = getOptimizedImageSrc(src)
  
  return (
    <div className={`relative overflow-hidden ${className}`}>
        <img 
        src={optimizedSrc} 
        alt={alt} 
        className="w-full h-full object-contain"
        />
    </div>
  )
}