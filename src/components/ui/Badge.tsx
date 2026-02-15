import { type HTMLAttributes, forwardRef } from "react";

type BadgeVariant = "default" | "gold" | "success" | "warning" | "error";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    "bg-[rgba(255,255,255,0.1)] text-[var(--mm-text-muted)] border-[rgba(255,255,255,0.2)]",
  gold: "bg-[rgba(212,175,55,0.1)] text-[var(--mm-gold)] border-[rgba(212,175,55,0.3)]",
  success:
    "bg-[rgba(34,197,94,0.1)] text-[var(--mm-healthy)] border-[rgba(34,197,94,0.3)]",
  warning:
    "bg-[rgba(234,179,8,0.1)] text-[var(--mm-degraded)] border-[rgba(234,179,8,0.3)]",
  error:
    "bg-[rgba(239,68,68,0.1)] text-[var(--mm-down)] border-[rgba(239,68,68,0.3)]",
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = "", variant = "default", children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`
          inline-flex items-center
          px-2.5 py-1
          text-xs font-medium
          border
          ${variantStyles[variant]}
          ${className}
        `}
        {...props}
      >
        {children}
      </span>
    );
  },
);

Badge.displayName = "Badge";

export default Badge;
