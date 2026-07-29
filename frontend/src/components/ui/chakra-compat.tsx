import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

type Props = Record<string, any> & { children?: React.ReactNode }

const spacing: Record<string, string> = {
  "0": "0",
  "0.5": "0.125rem",
  "1": "0.25rem",
  "2": "0.5rem",
  "3": "0.75rem",
  "4": "1rem",
  "5": "1.25rem",
  "6": "1.5rem",
  "8": "2rem",
  "10": "2.5rem",
  "12": "3rem",
}

function cssSize(value: unknown) {
  if (value === undefined) return undefined
  return spacing[String(value)] ?? (typeof value === "number" ? `${value}px` : value)
}

function cleanProps(props: Props) {
  const {
    as,
    align,
    alignItems,
    bg,
    borderColor,
    borderRadius,
    borderWidth,
    bottom,
    colorScheme,
    direction,
    display,
    flex,
    flexDirection,
    flexGrow,
    fontFamily,
    fontSize,
    fontWeight,
    gap,
    height,
    h,
    justify,
    justifyContent,
    left,
    lineHeight,
    m,
    margin,
    mb,
    ml,
    mr,
    mt,
    mx,
    my,
    maxH,
    maxW,
    minH,
    minW,
    objectFit,
    overflow,
    overflowX,
    overflowY,
    p,
    padding,
    pb,
    pl,
    position,
    pr,
    pt,
    px,
    py,
    right,
    rounded,
    shadow,
    size,
    spacing: _spacing,
    textAlign,
    textColor,
    top,
    variant,
    verticalAlign,
    w,
    width,
    wrap,
    zIndex,
    isDisabled,
    isInvalid,
    isLoading,
    isTruncated,
    noOfLines,
    _hover,
    _focus,
    _active,
    _dark,
    ...rest
  } = props

  const style: React.CSSProperties = {
    alignItems: alignItems ?? align,
    background: bg,
    borderColor,
    borderRadius: cssSize(borderRadius ?? rounded),
    borderWidth: cssSize(borderWidth),
    bottom: cssSize(bottom),
    color: textColor,
    display,
    flex: flex as React.CSSProperties["flex"],
    flexDirection: (flexDirection ?? direction) as React.CSSProperties["flexDirection"],
    flexGrow,
    flexWrap: wrap,
    fontFamily,
    fontSize: cssSize(fontSize),
    fontWeight,
    gap: cssSize(gap ?? _spacing),
    height: cssSize(height ?? h ?? size),
    justifyContent: justifyContent ?? justify,
    left: cssSize(left),
    lineHeight,
    margin: cssSize(margin ?? m),
    marginBottom: cssSize(mb ?? my),
    marginLeft: cssSize(ml ?? mx),
    marginRight: cssSize(mr ?? mx),
    marginTop: cssSize(mt ?? my),
    maxHeight: cssSize(maxH),
    maxWidth: cssSize(maxW),
    minHeight: cssSize(minH),
    minWidth: cssSize(minW),
    objectFit,
    overflow,
    overflowX,
    overflowY,
    padding: cssSize(padding ?? p),
    paddingBottom: cssSize(pb ?? py),
    paddingLeft: cssSize(pl ?? px),
    paddingRight: cssSize(pr ?? px),
    paddingTop: cssSize(pt ?? py),
    position,
    right: cssSize(right),
    textAlign,
    top: cssSize(top),
    verticalAlign,
    width: cssSize(width ?? w ?? size),
    zIndex,
    ...(props.style ?? {}),
  }

  if (isTruncated || noOfLines) {
    style.overflow = "hidden"
    style.textOverflow = "ellipsis"
    if (noOfLines) {
      Object.assign(style, {
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: noOfLines,
        display: "-webkit-box",
      })
    } else {
      style.whiteSpace = "nowrap"
    }
  }

  return {
    as,
    colorScheme,
    isDisabled,
    isInvalid,
    isLoading,
    rest,
    style,
    variant,
  }
}

function primitive(
  tag: React.ElementType,
  baseClass = "",
  defaultProps: Record<string, unknown> = {},
) {
  return React.forwardRef<any, Props>(function CompatPrimitive(props, ref) {
    const { as, isDisabled, isInvalid, isLoading, rest, style } = cleanProps({
      ...defaultProps,
      ...props,
    })
    const Component = as ?? tag
    return (
      <Component
        {...rest}
        ref={ref}
        aria-busy={isLoading || undefined}
        aria-invalid={isInvalid || undefined}
        className={`${baseClass} ${props.className ?? ""}`.trim()}
        disabled={isDisabled || isLoading || rest.disabled}
        style={style}
      />
    )
  })
}

export const Box = primitive("div")
export const Container = primitive("div", "mx-auto w-full max-w-7xl px-4 sm:px-6")
export const Flex = primitive("div", "flex")
export const HStack = primitive("div", "flex items-center")
export const VStack = primitive("div", "flex flex-col")
export const Stack = primitive("div", "flex flex-col")
export const SimpleGrid = primitive("div", "grid")
export const ButtonGroup = primitive("div", "inline-flex items-center")
export const Text = primitive("p", "text-sm")
export const Heading = primitive("h2", "font-semibold tracking-normal")
export const Link = primitive("a", "text-primary underline-offset-4 hover:underline")
export const List = primitive("ul", "space-y-1")
export const ListItem = primitive("li", "flex items-start gap-2")
export const ListIcon = primitive("span", "mt-0.5 inline-flex")
export const Card = primitive("section", "rounded-lg border bg-card text-card-foreground shadow-sm")
export const CardHeader = primitive("header", "space-y-1.5 p-5")
export const CardBody = primitive("div", "p-5 pt-0")
export const CardFooter = primitive("footer", "flex items-center p-5 pt-0")
export const Badge = primitive("span", "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium")
export const Tag = primitive("span", "inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-1 text-xs")
export const TagLabel = primitive("span")
export const TagLeftIcon = primitive("span", "inline-flex")
export const TagCloseButton = primitive("button", "ml-1 text-muted-foreground hover:text-foreground", { type: "button" })
export const FormControl = primitive("div", "space-y-2")
export const FormLabel = primitive("label", "text-sm font-medium leading-none")
export const FormErrorMessage = primitive("p", "text-sm text-destructive")
export const InputGroup = primitive("div", "relative")
export const InputLeftElement = primitive("span", "pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground")
export const Input = primitive("input", "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50")
export const Select = primitive("select", "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring")
export const Checkbox = primitive("input", "h-4 w-4 rounded border-input accent-primary", { type: "checkbox" })
export const Switch = primitive("input", "h-4 w-8 accent-primary", { type: "checkbox", role: "switch" })
export const Radio = primitive("input", "h-4 w-4 accent-primary", { type: "radio" })
export const TableContainer = primitive("div", "w-full overflow-x-auto rounded-md border")
export const Table = primitive("table", "w-full caption-bottom text-sm")
export const Thead = primitive("thead", "border-b bg-muted/50")
export const Tbody = primitive("tbody", "divide-y")
export const Tr = primitive("tr", "transition-colors hover:bg-muted/40")
export const Th = primitive("th", "h-10 px-3 text-left align-middle text-xs font-medium text-muted-foreground")
export const Td = primitive("td", "p-3 align-middle")
export const Skeleton = primitive("div", "animate-pulse rounded-md bg-muted")
export const SkeletonText = primitive("div", "h-4 animate-pulse rounded bg-muted")
export const Fade = primitive("div", "animate-in fade-in")
export const Image = primitive("img", "block max-w-full")

export const Button = primitive(
  "button",
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50",
  { type: "button" },
)
export const IconButton = primitive(
  "button",
  "inline-flex size-9 items-center justify-center rounded-md border bg-background text-foreground shadow-sm hover:bg-accent disabled:opacity-50",
  { type: "button" },
)
export const Icon = React.forwardRef<any, Props>(function CompatIcon({ as: Component, ...props }, ref) {
  if (!Component) return null
  return <Component ref={ref} {...cleanProps(props).rest} style={cleanProps(props).style} />
})

export function Progress({ value = 0, max = 100, ...props }: Props) {
  const percent = Math.max(0, Math.min(100, (Number(value) / Number(max)) * 100))
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" {...cleanProps(props).rest}>
      <div className="h-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
    </div>
  )
}

export function Spinner(props: Props) {
  return <span {...cleanProps(props).rest} className="inline-block size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
}

export function Tooltip({ children, label, ...props }: Props) {
  return <span title={typeof label === "string" ? label : undefined} {...cleanProps(props).rest}>{children}</span>
}

export function useDisclosure(defaultIsOpen = false) {
  const [isOpen, setIsOpen] = React.useState(defaultIsOpen)
  return {
    isOpen,
    onClose: React.useCallback(() => setIsOpen(false), []),
    onOpen: React.useCallback(() => setIsOpen(true), []),
    onToggle: React.useCallback(() => setIsOpen((value) => !value), []),
  }
}

function OverlayRoot({ children, isOpen, onClose, className = "" }: Props) {
  if (!isOpen) return null
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${className}`} role="presentation">
      <button aria-label="Close dialog" className="absolute inset-0 bg-black/55" onClick={onClose} type="button" />
      {children}
    </div>
  )
}

export const Modal = OverlayRoot
export const AlertDialog = OverlayRoot
export const Drawer = ({ children, isOpen, onClose }: Props) => (
  <OverlayRoot isOpen={isOpen} onClose={onClose} className="justify-end p-0">{children}</OverlayRoot>
)
export const ModalOverlay = (_props: Props) => null
export const AlertDialogOverlay = (_props: Props) => null
export const DrawerOverlay = (_props: Props) => null
export const ModalContent = primitive("div", "relative z-10 max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg border bg-background shadow-xl")
export const AlertDialogContent = ModalContent
export const DrawerContent = primitive("aside", "relative z-10 h-full w-full max-w-sm overflow-auto border-l bg-background shadow-xl")
export const ModalHeader = primitive("header", "border-b px-5 py-4 text-lg font-semibold")
export const AlertDialogHeader = ModalHeader
export const ModalBody = primitive("div", "px-5 py-4")
export const AlertDialogBody = ModalBody
export const DrawerBody = primitive("div", "p-5")
export const ModalFooter = primitive("footer", "flex justify-end gap-2 border-t px-5 py-4")
export const AlertDialogFooter = ModalFooter
export const ModalCloseButton = primitive("button", "absolute right-3 top-3 size-8 rounded-md text-xl text-muted-foreground hover:bg-accent", { children: "×", type: "button" })
export const DrawerCloseButton = ModalCloseButton

export const Menu = primitive("details", "relative")
export const MenuButton = primitive("summary", "list-none")
export const MenuList = primitive("div", "absolute right-0 z-40 mt-1 min-w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-md")
export const MenuItem = primitive("button", "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent", { type: "button" })

export const Accordion = primitive("div", "divide-y rounded-md border")
export const AccordionItem = primitive("details", "group")
export const AccordionButton = primitive("summary", "flex w-full cursor-pointer items-center justify-between px-4 py-3 font-medium")
export const AccordionPanel = primitive("div", "px-4 pb-4")
export const AccordionIcon = () => <span aria-hidden="true">⌄</span>

const TabsContext = React.createContext<{ value: number; setValue: (value: number) => void }>({ value: 0, setValue: () => undefined })
export function Tabs({ children, defaultIndex = 0, ...props }: Props) {
  const [value, setValue] = React.useState(defaultIndex)
  return <TabsContext.Provider value={{ value, setValue }}><div {...cleanProps(props).rest}>{children}</div></TabsContext.Provider>
}
export const TabList = primitive("div", "inline-flex rounded-md bg-muted p-1")
export function Tab({ children, index, ...props }: Props) {
  const context = React.useContext(TabsContext)
  const fallbackIndex = Number(index ?? 0)
  return <button className="rounded-sm px-3 py-1.5 text-sm data-[active=true]:bg-background data-[active=true]:shadow-sm" data-active={context.value === fallbackIndex} onClick={() => context.setValue(fallbackIndex)} type="button" {...cleanProps(props).rest}>{children}</button>
}
export const TabPanels = primitive("div", "mt-4")
export const TabPanel = primitive("div")

export function RadioGroup({ children, onChange, value, ...props }: Props) {
  return <div role="radiogroup" onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange?.(event.target.value)} {...cleanProps(props).rest}>{React.Children.map(children, (child) => React.isValidElement<Props>(child) ? React.cloneElement(child, { checked: child.props.value === value }) : child)}</div>
}

export const Editable = primitive("div", "group")
export const EditablePreview = primitive("span", "inline-block")
export const EditableInput = Input

export const Avatar = primitive("img", "size-9 rounded-full border object-cover")
export const VersionBadge = Badge

export function useToast() {
  return React.useCallback(({ status, title, description }: Props) => {
    const message = description ?? title ?? ""
    if (status === "error") toast.error(message)
    else if (status === "warning") toast.warning(message)
    else toast.success(message)
  }, [])
}

export function useColorModeValue<T>(light: T, dark: T): T {
  const { resolvedTheme } = useTheme()
  return resolvedTheme === "dark" ? dark : light
}

export function useColorMode() {
  const { resolvedTheme, setTheme } = useTheme()
  return {
    colorMode: resolvedTheme === "dark" ? "dark" : "light",
    toggleColorMode: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    Icon: resolvedTheme === "dark" ? Sun : Moon,
  }
}
