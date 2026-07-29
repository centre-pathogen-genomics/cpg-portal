import { Link } from "@tanstack/react-router"

import { cn } from "@/lib/utils"
import logo from "/assets/images/cpg-logo.png"
import icon from "/assets/images/cpg-logo-icon-transparent.png"

interface LogoProps {
  variant?: "full" | "icon" | "responsive"
  className?: string
  asLink?: boolean
}

export function Logo({
  variant = "full",
  className,
  asLink = true,
}: LogoProps) {
  const content =
    variant === "responsive" ? (
      <>
        <img
          src={logo}
          alt="CPG Bioinformatics Portal"
          className={cn(
            "h-10 max-w-[190px] w-auto group-data-[collapsible=icon]:hidden",
            className,
          )}
        />
        <img
          src={icon}
          alt="CPG Bioinformatics Portal"
          className={cn(
            "size-7 hidden group-data-[collapsible=icon]:block",
            className,
          )}
        />
      </>
    ) : (
      <img
        src={variant === "full" ? logo : icon}
        alt="CPG Bioinformatics Portal"
        className={cn(variant === "full" ? "h-12 w-auto" : "size-7", className)}
      />
    )

  if (!asLink) {
    return content
  }

  return <Link to="/">{content}</Link>
}
