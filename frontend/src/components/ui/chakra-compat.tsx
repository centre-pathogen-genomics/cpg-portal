import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { toast } from "sonner"
import { useTheme } from "@/components/theme-provider"

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
  "14": "3.5rem",
  "16": "4rem",
  "20": "5rem",
  "24": "6rem",
  "32": "8rem",
  "40": "10rem",
  "48": "12rem",
  "64": "16rem",
  "80": "20rem",
}

const sizes: Record<string, string> = {
  full: "100%",
  min: "min-content",
  max: "max-content",
  fit: "fit-content",
  xs: "20rem",
  sm: "24rem",
  md: "28rem",
  lg: "32rem",
  xl: "36rem",
  "2xl": "42rem",
  "3xl": "48rem",
  "4xl": "56rem",
  "5xl": "64rem",
  "6xl": "72rem",
  "7xl": "80rem",
}

const fontSizes: Record<string, string> = {
  xs: "0.75rem",
  sm: "0.875rem",
  md: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.875rem",
  "4xl": "2.25rem",
  "5xl": "3rem",
  "6xl": "3.75rem",
}

const radii: Record<string, string> = {
  none: "0",
  sm: "0.125rem",
  base: "0.25rem",
  md: "0.375rem",
  lg: "0.5rem",
  xl: "0.75rem",
  "2xl": "1rem",
  full: "9999px",
}

const colors: Record<string, string> = {
  "ui.main": "#319795",
  "ui.secondary": "#edf2f7",
  "ui.dark": "#1a202c",
  "ui.light": "#f7fafc",
  "ui.darkSlate": "#2d3748",
  "ui.dim": "#718096",
  "ui.success": "#38a169",
  "ui.danger": "#e53e3e",
  "gray.50": "#f7fafc",
  "gray.100": "#edf2f7",
  "gray.200": "#e2e8f0",
  "gray.300": "#cbd5e0",
  "gray.400": "#a0aec0",
  "gray.500": "#718096",
  "gray.600": "#4a5568",
  "gray.700": "#2d3748",
  "gray.800": "#1a202c",
  "gray.900": "#171923",
  "blue.500": "#3182ce",
  "green.500": "#38a169",
  "purple.500": "#805ad5",
  "orange.500": "#dd6b20",
  "red.500": "#e53e3e",
}

function cssSize(value: unknown) {
  if (value === undefined) return undefined
  return (
    spacing[String(value)] ??
    sizes[String(value)] ??
    (typeof value === "number" ? `${value}px` : value)
  )
}

function cssColor(value: unknown) {
  if (value === undefined) return undefined
  return colors[String(value)] ?? value
}

function cssFontSize(value: unknown) {
  if (value === undefined) return undefined
  return fontSizes[String(value)] ?? cssSize(value)
}

function cssRadius(value: unknown) {
  if (value === undefined) return undefined
  return radii[String(value)] ?? cssSize(value)
}

const breakpoints = [
  ["base", 0],
  ["sm", 480],
  ["md", 768],
  ["lg", 992],
  ["xl", 1280],
  ["2xl", 1536],
] as const

function subscribeToViewport(callback: () => void) {
  window.addEventListener("resize", callback)
  return () => window.removeEventListener("resize", callback)
}

function getViewportWidth() {
  return window.innerWidth
}

function resolveResponsiveValue(value: unknown, viewportWidth: number) {
  if (
    !value ||
    typeof value !== "object" ||
    !breakpoints.some(([key]) => key in value)
  ) {
    return value
  }

  let resolved: unknown
  for (const [key, minWidth] of breakpoints) {
    if (viewportWidth >= minWidth && key in value) {
      resolved = (value as Record<string, unknown>)[key]
    }
  }
  return resolved
}

function useResponsiveProps(props: Props): Props {
  const viewportWidth = React.useSyncExternalStore(
    subscribeToViewport,
    getViewportWidth,
    () => 1280,
  )
  return Object.fromEntries(
    Object.entries(props).map(([key, value]) => [
      key,
      resolveResponsiveValue(value, viewportWidth),
    ]),
  ) as Props
}

function cleanProps(props: Props) {
  const {
    as,
    align,
    alignItems,
    alignSelf,
    bg,
    backgroundColor,
    borderBottom,
    borderBottomWidth,
    borderColor,
    borderRadius,
    borderStyle,
    borderWidth,
    boxShadow,
    boxSize,
    bottom,
    columns,
    color,
    colorScheme,
    cursor,
    direction,
    display,
    flex,
    flexBasis,
    flexDirection,
    flexGrow,
    flexShrink,
    fontFamily,
    fontSize,
    fontWeight,
    gap,
    gridColumn,
    gridRow,
    gridTemplateColumns,
    gridTemplateRows,
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
    opacity,
    overflow,
    overflowX,
    overflowY,
    p,
    padding,
    paddingBlock,
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
    transform,
    transition,
    variant,
    verticalAlign,
    whiteSpace,
    w,
    width,
    wrap,
    zIndex,
    isDisabled,
    isChecked,
    isInvalid,
    isLoading,
    isTruncated,
    noOfLines,
    _hover,
    _focus,
    _active,
    _dark,
    _groupHover,
    ...rest
  } = props

  const style: React.CSSProperties = {
    alignItems: alignItems ?? align,
    alignSelf,
    background: cssColor(backgroundColor ?? bg),
    borderBottom,
    borderBottomWidth: cssSize(borderBottomWidth),
    borderColor: cssColor(borderColor),
    borderRadius: cssRadius(borderRadius ?? rounded),
    borderStyle,
    borderWidth: cssSize(borderWidth),
    bottom: cssSize(bottom),
    boxShadow: boxShadow ?? shadow,
    color: cssColor(textColor ?? color),
    cursor,
    display,
    flex: flex as React.CSSProperties["flex"],
    flexBasis: cssSize(flexBasis),
    flexDirection: (flexDirection ?? direction) as React.CSSProperties["flexDirection"],
    flexGrow,
    flexShrink,
    flexWrap: wrap,
    fontFamily,
    fontSize: cssFontSize(fontSize),
    fontWeight,
    gap: cssSize(gap ?? _spacing),
    gridColumn,
    gridRow,
    gridTemplateColumns:
      gridTemplateColumns ??
      (columns ? `repeat(${columns}, minmax(0, 1fr))` : undefined),
    gridTemplateRows,
    height: cssSize(height ?? h ?? boxSize),
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
    opacity,
    overflow,
    overflowX,
    overflowY,
    padding: cssSize(padding ?? p),
    paddingBlock: cssSize(paddingBlock),
    paddingBottom: cssSize(pb ?? py),
    paddingLeft: cssSize(pl ?? px),
    paddingRight: cssSize(pr ?? px),
    paddingTop: cssSize(pt ?? py),
    position,
    right: cssSize(right),
    textAlign,
    top: cssSize(top),
    transform,
    transition,
    verticalAlign,
    whiteSpace,
    width: cssSize(width ?? w ?? boxSize),
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

  if (isChecked !== undefined) {
    rest.checked = isChecked
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
    const responsiveProps = useResponsiveProps(props)
    const { as, isDisabled, isInvalid, isLoading, rest, style } = cleanProps({
      ...defaultProps,
      ...responsiveProps,
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
export const Text = primitive("p")
export const Heading = React.forwardRef<any, Props>(function CompatHeading(
  props,
  ref,
) {
  const headingSizes: Record<string, string> = {
    xs: "0.75rem",
    sm: "0.875rem",
    md: "1.125rem",
    lg: "1.5rem",
    xl: "1.875rem",
    "2xl": "2.25rem",
  }
  return (
    <Box
      {...props}
      ref={ref}
      as={props.as ?? "h2"}
      fontSize={props.fontSize ?? headingSizes[String(props.size)]}
      fontWeight={props.fontWeight ?? 700}
    />
  )
})
export const Link = primitive("a", "text-primary underline-offset-4 hover:underline")
export const List = primitive("ul", "space-y-1")
export const ListItem = primitive("li", "flex items-start gap-2")
export const ListIcon = primitive("span", "mt-0.5 inline-flex")
export const Card = primitive("section", "rounded-md border bg-card text-card-foreground shadow-sm")
export const CardHeader = primitive("header", "space-y-1.5 p-5")
export const CardBody = primitive("div", "p-5 pt-0")
export const CardFooter = primitive("footer", "flex items-center p-5 pt-0")
const badgeSchemes: Record<string, Record<string, string>> = {
  gray: {
    outline: "border-slate-400 text-slate-600",
    solid: "border-transparent bg-slate-500 text-white",
    subtle: "border-transparent bg-slate-100 text-slate-700",
  },
  green: {
    outline: "border-emerald-500 text-emerald-600",
    solid: "border-transparent bg-emerald-500 text-white",
    subtle: "border-transparent bg-emerald-100 text-emerald-800",
  },
  red: {
    outline: "border-red-500 text-red-500",
    solid: "border-transparent bg-red-500 text-white",
    subtle: "border-transparent bg-red-100 text-red-700",
  },
  cyan: {
    outline: "border-teal-500 text-teal-600",
    solid: "border-transparent bg-teal-500 text-white",
    subtle: "border-transparent bg-teal-50 text-teal-600",
  },
  teal: {
    outline: "border-teal-500 text-teal-600",
    solid: "border-transparent bg-teal-500 text-white",
    subtle: "border-transparent bg-teal-50 text-teal-600",
  },
  blue: {
    outline: "border-blue-500 text-blue-600",
    solid: "border-transparent bg-blue-500 text-white",
    subtle: "border-transparent bg-blue-100 text-blue-700",
  },
  orange: {
    outline: "border-orange-500 text-orange-600",
    solid: "border-transparent bg-orange-500 text-white",
    subtle: "border-transparent bg-orange-100 text-orange-700",
  },
}

export const Badge = React.forwardRef<any, Props>(function CompatBadge(
  props,
  ref,
) {
  const responsiveProps = useResponsiveProps(props)
  const { colorScheme, rest, style, variant } = cleanProps(responsiveProps)
  const scheme = badgeSchemes[String(colorScheme ?? "gray")]
  const schemeClass =
    scheme?.[String(variant ?? "subtle")] ?? scheme?.subtle ?? ""
  return (
    <span
      {...rest}
      ref={ref}
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium leading-none ${schemeClass} ${props.className ?? ""}`}
      style={style}
    />
  )
})
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
export const TableContainer = primitive("div", "w-full overflow-x-auto")
export const Table = primitive("table", "w-full caption-bottom text-sm")
export const Thead = primitive("thead", "border-b")
export const Tbody = primitive("tbody", "divide-y")
export const Tr = primitive("tr", "transition-colors hover:bg-muted/40")
export const Th = primitive("th", "h-10 px-3 text-left align-middle text-xs font-medium text-muted-foreground")
export const Td = primitive("td", "p-3 align-middle")
export const Skeleton = primitive("div", "animate-pulse rounded-md bg-muted")
export const SkeletonText = primitive("div", "h-4 animate-pulse rounded bg-muted")
export const Fade = primitive("div", "animate-in fade-in")
export const Image = primitive("img", "block max-w-full")

const solidButtonSchemes: Record<string, string> = {
  blue: "bg-blue-500 text-white hover:bg-blue-600",
  cyan: "bg-teal-500 text-white hover:bg-teal-600",
  green: "bg-emerald-500 text-white hover:bg-emerald-600",
  orange: "bg-orange-500 text-white hover:bg-orange-600",
  red: "bg-red-500 text-white hover:bg-red-600",
  teal: "bg-teal-500 text-white hover:bg-teal-600",
}

const outlineButtonSchemes: Record<string, string> = {
  blue: "border-blue-500 text-blue-600 hover:bg-blue-50",
  cyan: "border-teal-500 text-teal-600 hover:bg-teal-50",
  green: "border-emerald-500 text-emerald-600 hover:bg-emerald-50",
  orange: "border-orange-500 text-orange-600 hover:bg-orange-50",
  red: "border-red-500 text-red-500 hover:bg-red-50",
  teal: "border-teal-500 text-teal-600 hover:bg-teal-50",
}

export const Button = React.forwardRef<any, Props>(function CompatButton(
  props,
  ref,
) {
  const {
    as,
    colorScheme,
    leftIcon,
    rightIcon,
    children,
    className,
    variant,
    ...buttonProps
  } = useResponsiveProps(props)
  const scheme = String(colorScheme ?? "")
  const variantClass =
    variant === "ghost"
      ? "bg-transparent text-foreground shadow-none hover:bg-accent"
      : variant === "outline"
        ? `border bg-background shadow-sm ${
            outlineButtonSchemes[scheme] ??
            "text-foreground hover:bg-accent"
          }`
        : variant === "link"
          ? "bg-transparent p-0 text-primary shadow-none hover:underline"
          : (solidButtonSchemes[scheme] ??
            "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90")
  const {
    isDisabled,
    isLoading,
    rest,
    style,
  } = cleanProps(buttonProps)
  const Component = as ?? "button"
  const isButton = Component === "button"
  return (
    <Component
      {...rest}
      ref={ref}
      type={isButton ? (rest.type ?? "button") : undefined}
      disabled={
        isButton ? isDisabled || isLoading || rest.disabled : undefined
      }
      aria-disabled={
        !isButton && (isDisabled || isLoading) ? true : undefined
      }
      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${variantClass} ${className ?? ""}`}
      style={style}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </Component>
  )
})
export const IconButton = React.forwardRef<any, Props>(
  function CompatIconButton(props, ref) {
    const {
      icon,
      children,
      className,
      isRound,
      variant,
      ...buttonProps
    } = useResponsiveProps(props)
    const variantClass =
      variant === "ghost"
        ? "border-transparent bg-transparent shadow-none hover:bg-accent"
        : "border bg-background shadow-sm hover:bg-accent"
    const {
      isDisabled,
      isLoading,
      rest,
      style,
    } = cleanProps(buttonProps)
    return (
      <button
        {...rest}
        ref={ref}
        type={rest.type ?? "button"}
        disabled={isDisabled || isLoading || rest.disabled}
        className={`inline-flex size-9 items-center justify-center text-foreground disabled:opacity-50 ${isRound ? "rounded-full" : "rounded-md"} ${variantClass} ${className ?? ""}`}
        style={style}
      >
        {icon ?? children}
      </button>
    )
  },
)
export const Icon = React.forwardRef<any, Props>(function CompatIcon({ as: Component, ...props }, ref) {
  if (!Component) return null
  return <Component ref={ref} {...cleanProps(props).rest} style={cleanProps(props).style} />
})

export function Progress({
  value = 0,
  max = 100,
  colorScheme,
  ...props
}: Props) {
  const percent = Math.max(0, Math.min(100, (Number(value) / Number(max)) * 100))
  const barClass =
    colorScheme === "blue"
      ? "bg-blue-500"
      : colorScheme === "green"
        ? "bg-emerald-500"
        : colorScheme === "red"
          ? "bg-red-500"
          : "bg-primary"
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" {...cleanProps(props).rest}>
      <div
        className={`h-full transition-[width] ${barClass}`}
        style={{ width: `${percent}%` }}
      />
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
