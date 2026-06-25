import { XIcon } from "lucide-react"
import type * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

function ResponsiveSheet({
  mobile,
  ...props
}: React.ComponentProps<typeof Sheet> & {
  mobile: boolean
}) {
  if (mobile) {
    return <Drawer {...props} autoFocus={false} direction="bottom" repositionInputs={false} />
  }

  return <Sheet {...props} />
}

function ResponsiveSheetContent({
  mobile,
  side = "right",
  showCloseButton = true,
  className,
  mobileClassName,
  desktopClassName,
  children,
  ...props
}: Omit<React.ComponentProps<typeof SheetContent>, "side"> & {
  mobile: boolean
  side?: "top" | "right" | "bottom" | "left"
  mobileClassName?: string
  desktopClassName?: string
}) {
  if (mobile) {
    return (
      <DrawerContent
        className={cn("mobile-drawer-scroll flex overflow-hidden p-0", mobileClassName, className)}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DrawerClose data-slot="sheet-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-4 right-4 rounded-full text-muted-foreground hover:text-foreground"
              size="icon-sm"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </DrawerClose>
        ) : null}
      </DrawerContent>
    )
  }

  return (
    <SheetContent
      side={side}
      showCloseButton={showCloseButton}
      className={cn(desktopClassName, className)}
      {...props}
    >
      {children}
    </SheetContent>
  )
}

function ResponsiveSheetHeader({
  mobile,
  ...props
}: React.ComponentProps<typeof SheetHeader> & {
  mobile: boolean
}) {
  const Header = mobile ? DrawerHeader : SheetHeader
  return <Header {...props} />
}

function ResponsiveSheetFooter({
  mobile,
  ...props
}: React.ComponentProps<typeof SheetFooter> & {
  mobile: boolean
}) {
  const Footer = mobile ? DrawerFooter : SheetFooter
  return <Footer {...props} />
}

function ResponsiveSheetTitle({
  mobile,
  ...props
}: React.ComponentProps<typeof SheetTitle> & {
  mobile: boolean
}) {
  const Title = mobile ? DrawerTitle : SheetTitle
  return <Title {...props} />
}

function ResponsiveSheetDescription({
  mobile,
  ...props
}: React.ComponentProps<typeof SheetDescription> & {
  mobile: boolean
}) {
  const Description = mobile ? DrawerDescription : SheetDescription
  return <Description {...props} />
}

export {
  ResponsiveSheet,
  ResponsiveSheetContent,
  ResponsiveSheetDescription,
  ResponsiveSheetFooter,
  ResponsiveSheetHeader,
  ResponsiveSheetTitle,
}
