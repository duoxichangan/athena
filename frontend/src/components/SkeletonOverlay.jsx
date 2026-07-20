const KP_CONFIDENCE_THRESHOLD = 0.35

// COCO 17-keypoint skeleton connections
const BONES = [
  [0, 1], [0, 2], [1, 3], [2, 4],                         // face
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],                // arms
  [5, 11], [6, 12], [11, 12],                              // torso
  [11, 13], [13, 15], [12, 14], [14, 16],                  // legs
]

const PLAYER_COLORS = ['#ff6b35', '#35d6ff', '#d968ff', '#ffe45e', '#66f28f', '#ff78a8']

export default function SkeletonOverlay({ players = [] }) {
  if (!players.length) return null

  return (
    <svg
      className="skeleton-overlay"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {players.map((player, playerIndex) => {
        const keypoints = player.keypoints
        if (!keypoints || keypoints.length === 0) return null

        const color = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length]

        // Build a lookup: keypoint index → {x, y} in viewBox % (0-100)
        const points = keypoints.map((kp) => ({
          x: kp.x * 100,
          y: kp.y * 100,
          conf: kp.confidence,
        }))

        const boneLines = []
        BONES.forEach(([a, b]) => {
          const pa = points[a]
          const pb = points[b]
          if (pa && pb && pa.conf > KP_CONFIDENCE_THRESHOLD && pb.conf > KP_CONFIDENCE_THRESHOLD) {
            boneLines.push(
              <line
                key={`bone-${player.track_id}-${a}-${b}`}
                x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                stroke={color}
                strokeWidth="0.55"
                strokeLinecap="round"
                opacity="0.7"
              />,
            )
          }
        })

        const dots = points.map((kp, i) => {
          if (kp.conf <= KP_CONFIDENCE_THRESHOLD) return null
          return (
            <circle
              key={`kp-${player.track_id}-${i}`}
              cx={kp.x} cy={kp.y} r="1.2"
              fill={color}
              stroke="#fff"
              strokeWidth="0.4"
              opacity={Math.max(0.5, kp.conf)}
            />
          )
        })

        return (
          <g key={`skeleton-${player.track_id}`}>
            {boneLines}
            {dots}
          </g>
        )
      })}
    </svg>
  )
}
