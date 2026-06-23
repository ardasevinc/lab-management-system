import { labConfig } from "@lab/config"
import { cn } from "@/lib/utils"

type BrandMarkProps = {
  className?: string
  imageClassName?: string
}

export function BrandMark({ className, imageClassName }: BrandMarkProps) {
  return (
    <div
      data-slot="brand-mark"
      className={cn("grid place-items-center overflow-hidden rounded-lg bg-primary", className)}
    >
      <img
        className={cn("size-full object-cover", imageClassName)}
        src={labConfig.logoPath}
        alt=""
        aria-hidden="true"
      />
    </div>
  )
}
