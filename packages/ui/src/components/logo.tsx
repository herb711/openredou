import { type ComponentProps } from "solid-js"

const logoWordmark = ["o", "p", "e", "n", "r", "e", "d", "o", "u"] as const
const logoGlyphAdvance = 30
const logoGlyphs = {
  d: [
    { d: "M18 30H6V18H18V30Z", weak: true },
    { d: "M18 12H6V30H18V12ZM24 36H0V6H18V0H24V36Z" },
  ],
  e: [{ d: "M24 24H6V30H24V36H0V6H24V24ZM6 18H18V12H6V18Z" }],
  n: [{ d: "M18 12H6V36H0V6H18V12ZM24 36H18V12H24V36Z" }],
  o: [
    { d: "M18 30H6V18H18V30Z", weak: true },
    { d: "M18 12H6V30H18V12ZM24 36H0V6H24V36Z" },
  ],
  p: [
    { d: "M18 30H6V18H18V30Z", weak: true },
    { d: "M6 30H18V12H6V30ZM24 36H6V42H0V6H24V36Z" },
  ],
  r: [{ d: "M6 36H0V6H18V12H6V36ZM24 18H18V12H24V18Z" }],
  u: [{ d: "M24 36H0V6H6V30H18V6H24V36Z" }],
} as const

export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 16 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path data-slot="logo-logo-mark-shadow" d="M12 16H4V8H12V16Z" fill="var(--icon-weak-base)" />
      <path data-slot="logo-logo-mark-o" d="M12 4H4V16H12V4ZM16 20H0V0H16V20Z" fill="var(--icon-strong-base)" />
    </svg>
  )
}

export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => {
  return (
    <svg
      ref={props.ref}
      data-component="logo-splash"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 80 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M60 80H20V40H60V80Z" fill="var(--icon-base)" />
      <path d="M60 20H20V80H60V20ZM80 100H0V0H80V100Z" fill="var(--icon-strong-base)" />
    </svg>
  )
}

export const Logo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 264 42"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <g>
        {logoWordmark.map((item, index) => (
          <g transform={`translate(${index * logoGlyphAdvance} 0)`}>
            {logoGlyphs[item].map((path) => (
              <path
                d={path.d}
                fill={
                  "weak" in path ? "var(--icon-weak-base)" : index < 4 ? "var(--icon-base)" : "var(--icon-strong-base)"
                }
              />
            ))}
          </g>
        ))}
      </g>
    </svg>
  )
}
