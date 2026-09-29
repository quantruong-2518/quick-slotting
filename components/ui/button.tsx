import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong",
  secondary: "bg-control text-ink hover:bg-control-hover",
};
const sizes: Record<Size, string> = {
  md: "h-10 px-4 text-body",
  lg: "h-12 px-7 text-base",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
}
