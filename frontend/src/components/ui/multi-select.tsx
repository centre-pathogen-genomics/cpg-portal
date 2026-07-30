import { Check, ChevronsUpDown, X } from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface MultiSelectOption {
  label: string
  value: string
}

interface MultiSelectProps {
  id?: string
  options: MultiSelectOption[]
  value: string[]
  onValueChange: (value: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  loading?: boolean
  "aria-label"?: string
}

function MultiSelect({
  id,
  options,
  value,
  onValueChange,
  placeholder = "Select options",
  searchPlaceholder = "Search...",
  emptyMessage = "No options found.",
  disabled = false,
  loading = false,
  "aria-label": ariaLabel,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const selectedOptions = options.filter((option) =>
    value.includes(option.value),
  )

  const toggleValue = (optionValue: string) => {
    onValueChange(
      value.includes(optionValue)
        ? value.filter((selectedValue) => selectedValue !== optionValue)
        : [...value, optionValue],
    )
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-label={ariaLabel}
            variant="outline"
            disabled={disabled || loading}
            className="w-full justify-between font-normal"
          >
            <span
              className={cn(
                "truncate",
                value.length === 0 && "text-muted-foreground",
              )}
            >
              {loading
                ? "Loading files..."
                : value.length === 0
                  ? placeholder
                  : `${value.length} ${value.length === 1 ? "file" : "files"} selected`}
            </span>
            <ChevronsUpDown className="text-muted-foreground opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const selected = value.includes(option.value)
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      keywords={[option.label]}
                      aria-checked={selected}
                      onSelect={() => toggleValue(option.value)}
                    >
                      <Check
                        className={cn(
                          "text-primary",
                          selected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{option.label}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
            {value.length > 0 && (
              <div className="flex items-center justify-between border-t px-2 py-1.5">
                <span className="text-xs text-muted-foreground">
                  {value.length} selected
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => onValueChange([])}
                >
                  Clear all
                </Button>
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>

      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Selected files">
          {selectedOptions.map((option) => (
            <Badge
              key={option.value}
              variant="secondary"
              className="max-w-full gap-1 pl-2 pr-1"
            >
              <span className="truncate">{option.label}</span>
              <button
                type="button"
                aria-label={`Remove ${option.label}`}
                disabled={disabled}
                className="rounded-full p-0.5 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
                onClick={() => toggleValue(option.value)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export { MultiSelect }
