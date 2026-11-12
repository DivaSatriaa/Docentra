import { forwardRef, type ButtonHTMLAttributes } from "react"

type Variant = "primary" | "secondary" | "ghost" | "danger"
type Size = "sm" | "md"

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-500 text-white shadow-[0_8px_24px_-6px_rgba(142,58,89,0.55)] hover:bg-brand-400 active:bg-brand-600",
  secondary:
    "border border-white/[0.09] bg-white/[0.03] text-white/75 hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-white",
  ghost: "text-white/55 hover:bg-white/[0.05] hover:text-white",
  danger:
    "bg-red-500/[0.14] text-red-200 hover:bg-red-500/[0.22] hover:text-red-100",
}

const sizes: Record<Size, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-[12px]",
  md: "h-10 gap-2 rounded-xl px-4 text-[13px]",
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className = "", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[
        "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition duration-150 disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        className,
      ].join(" ")}
      {...props}
    />
  )
})

export default Button

/** Square icon-only button. Always pass an aria-label. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { size?: "sm" | "md" }
>(function IconButton({ className = "", size = "md", type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      title={props.title ?? props["aria-label"]}
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-lg text-white/50 transition duration-150 hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:opacity-40",
        size === "sm" ? "h-7 w-7" : "h-9 w-9",
        className,
      ].join(" ")}
      {...props}
    />
  )
})
