import { Badge } from "./shadcn/badge"
import { type ButtonHTMLAttributes } from "react"

export function Chip({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Badge
      variant="outline"
      asChild
    >
      <button className={className} {...props} />
    </Badge>
  )
}
