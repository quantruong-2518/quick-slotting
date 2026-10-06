import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-control transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const variants: Record<Variant, string> = {
  primary: "bg-brand font-semibold text-white hover:bg-brand-strong",
  secondary: "bg-control font-semibold text-ink hover:bg-control-hover",
  // Nút chữ: thao tác lặp lại ở từng dòng bảng, không tranh chỗ với nút chính.
  ghost: "font-medium text-brand-ink hover:bg-control",
};
const sizes: Record<Size, string> = {
  md: "h-10 px-4 text-body",
  lg: "h-12 px-6 text-body",
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
