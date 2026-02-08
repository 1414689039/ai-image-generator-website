interface ZoomableImageProps {
  src: string
  alt: string
  className?: string
}

export default function ZoomableImage({ src, alt, className }: ZoomableImageProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
        <img 
        src={src} 
        alt={alt} 
        className="w-full h-full object-contain"
        />
    </div>
  )
}