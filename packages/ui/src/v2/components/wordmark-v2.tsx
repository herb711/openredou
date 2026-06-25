import { createUniqueId, type ComponentProps } from "solid-js"

const wordmark = ["o", "p", "e", "n", "r", "e", "d", "o", "u"] as const
const wordmarkAdvance = 92.3125
const wordmarkWidth = 812.3462
const wordmarkHeight = 129.001
const glyphs = {
  d: [
    "M55.3846 36.8571H18.4615V92.1429H55.3846V36.8571Z",
    "M73.8462 110.571H0V18.4286H55.3846V0H73.8462V110.571Z",
  ],
  e: [
    "M73.8462 73.7154H18.4615V92.144H73.8462V110.573H0V18.4297H73.8462V73.7154ZM18.4615 55.2868H55.3846V36.8583H18.4615V55.2868Z",
  ],
  n: [
    "M55.3846 36.8583H18.4615V110.573H0V18.4297H55.3846V36.8583Z",
    "M73.8462 110.573H55.3846V36.8583H73.8462V110.573Z",
  ],
  o: [
    "M55.3846 36.8583H18.4615V92.144H55.3846V36.8583ZM73.8462 110.573H0V18.4297H73.8462V110.573Z",
  ],
  p: [
    "M18.4615 92.144H55.3846V36.8583H18.4615V92.144Z",
    "M73.8462 110.573H18.4615V129.001H0V18.4297H73.8462V110.573Z",
  ],
  r: [
    "M18.4615 110.573H0V18.4297H55.3846V36.8583H18.4615V110.573Z",
    "M73.8462 55.2868H55.3846V36.8583H73.8462V55.2868Z",
  ],
  u: ["M73.8462 110.573H0V18.4297H18.4615V92.144H55.3846V18.4297H73.8462V110.573Z"],
} as const

export function WordmarkV2(props: Pick<ComponentProps<"svg">, "class">) {
  const filter = createUniqueId()
  const mask = createUniqueId()
  const maskGradient = createUniqueId()

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${wordmarkWidth} ${wordmarkHeight}`}
      fill="none"
      preserveAspectRatio="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <g opacity="0.16" filter={`url(#${filter})`} mask={`url(#${mask})`}>
        {wordmark.map((item, index) => (
          <g transform={`translate(${index * wordmarkAdvance} 0)`}>
            {glyphs[item].map((d) => (
              <path opacity="0.7" d={d} fill="currentColor" />
            ))}
          </g>
        ))}
      </g>
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width={wordmarkWidth} height={wordmarkHeight}>
          <rect width={wordmarkWidth} height={wordmarkHeight} fill={`url(#${maskGradient})`} />
        </mask>
        <linearGradient
          id={maskGradient}
          x1={wordmarkWidth / 2}
          y1="0"
          x2={wordmarkWidth / 2}
          y2="112"
          gradientUnits="userSpaceOnUse"
        >
          <stop stop-color="white" stop-opacity="0.7" />
          <stop offset="1" stop-color="white" stop-opacity="0" />
        </linearGradient>
        <filter
          id={filter}
          x="0"
          y="0"
          width={wordmarkWidth}
          height={wordmarkHeight + 1}
          filterUnits="userSpaceOnUse"
          color-interpolation-filters="sRGB"
        >
          <feFlood flood-opacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="1" />
          <feGaussianBlur stdDeviation="1" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" />
          <feBlend mode="normal" in2="shape" result="effect1_innerShadow_4938_16028" />
        </filter>
      </defs>
    </svg>
  )
}
