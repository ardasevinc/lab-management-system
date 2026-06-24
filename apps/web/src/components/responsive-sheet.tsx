import { XIcon } from "lucide-react"
import type * as React from "react"
import { useEffect, useRef } from "react"
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
    return <Drawer autoFocus={false} direction="bottom" fixed repositionInputs {...props} />
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
  const mobileContentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!mobile) {
      return
    }

    const activeControlSelector = "input, textarea, select, [contenteditable='true']"
    const viewportBaselineHeight = window.visualViewport?.height ?? window.innerHeight
    let keyboardMonitorId: number | undefined
    const isKeyboardViewportRestored = () => {
      const currentHeight = window.visualViewport?.height ?? window.innerHeight
      return currentHeight >= viewportBaselineHeight - 8
    }
    const activeControlIsFocused = () => document.activeElement?.matches(activeControlSelector)
    const clearKeyboardHeight = () => {
      if (activeControlIsFocused() && !isKeyboardViewportRestored()) {
        return
      }

      const drawerContent =
        mobileContentRef.current ??
        document.querySelector<HTMLElement>("[data-slot='drawer-content'][data-vaul-drawer]")
      if (!drawerContent) {
        return
      }

      drawerContent.setAttribute("data-vaul-animate", "false")
      drawerContent.style.height = ""
      drawerContent.style.bottom = ""
      drawerContent.style.transform = ""
      window.setTimeout(() => {
        drawerContent.removeAttribute("data-vaul-animate")
      }, 120)
    }
    const stopKeyboardMonitor = () => {
      if (keyboardMonitorId === undefined) {
        return
      }

      window.clearInterval(keyboardMonitorId)
      keyboardMonitorId = undefined
    }
    const startKeyboardMonitor = () => {
      if (!activeControlIsFocused() || keyboardMonitorId !== undefined) {
        return
      }

      keyboardMonitorId = window.setInterval(() => {
        if (!activeControlIsFocused()) {
          stopKeyboardMonitor()
          return
        }

        if (isKeyboardViewportRestored()) {
          clearKeyboardHeight()
        }
      }, 80)
    }
    const scheduleClear = () => {
      window.requestAnimationFrame(clearKeyboardHeight)
      window.setTimeout(clearKeyboardHeight, 80)
      window.setTimeout(clearKeyboardHeight, 320)
      window.setTimeout(clearKeyboardHeight, 640)
    }

    document.addEventListener("focusin", startKeyboardMonitor, true)
    document.addEventListener("focusout", scheduleClear, true)
    window.addEventListener("resize", scheduleClear)
    window.visualViewport?.addEventListener("resize", scheduleClear)

    return () => {
      stopKeyboardMonitor()
      document.removeEventListener("focusin", startKeyboardMonitor, true)
      document.removeEventListener("focusout", scheduleClear, true)
      window.removeEventListener("resize", scheduleClear)
      window.visualViewport?.removeEventListener("resize", scheduleClear)
    }
  }, [mobile])

  if (mobile) {
    return (
      <DrawerContent
        ref={mobileContentRef}
        className={cn(
          "mobile-drawer-scroll flex max-h-[calc(100lvh-0.5rem)] overflow-hidden p-0",
          mobileClassName,
          className,
        )}
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
