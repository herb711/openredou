import { type ComponentProps } from "solid-js"
import redouLogo from "../assets/images/redou-logo.png"

type LogoProps = Omit<ComponentProps<"img">, "src">

export const Mark = (props: LogoProps) => {
  return (
    <img
      {...props}
      data-component="logo-mark"
      class={["object-contain", props.class].filter(Boolean).join(" ")}
      src={redouLogo}
      alt={props.alt ?? ""}
      aria-hidden={props["aria-hidden"] ?? "true"}
      draggable={props.draggable ?? false}
    />
  )
}

export const Splash = (props: LogoProps) => {
  return (
    <img
      {...props}
      data-component="logo-splash"
      class={["object-contain", props.class].filter(Boolean).join(" ")}
      src={redouLogo}
      alt={props.alt ?? ""}
      aria-hidden={props["aria-hidden"] ?? "true"}
      draggable={props.draggable ?? false}
    />
  )
}

export const Logo = (props: LogoProps) => {
  return (
    <img
      {...props}
      data-component="logo"
      class={["object-contain", props.class].filter(Boolean).join(" ")}
      src={redouLogo}
      alt={props.alt ?? ""}
      aria-hidden={props["aria-hidden"] ?? "true"}
      draggable={props.draggable ?? false}
    />
  )
}
