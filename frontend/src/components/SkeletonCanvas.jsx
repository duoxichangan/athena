import { useEffect, useRef } from 'react'
import { drawSkeleton } from '../skeleton.js'

export default function SkeletonCanvas({ keypoints, width = 320, height = 320 }) {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current && keypoints) {
      drawSkeleton(ref.current, keypoints)
    }
  }, [keypoints])

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
    />
  )
}
