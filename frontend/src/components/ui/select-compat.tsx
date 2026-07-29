type Option = { label: string; value: string }
type Props = Record<string, any> & {
  isMulti?: boolean
  onChange?: (value: any) => void
  options?: Option[]
  value?: Option | Option[] | null
}

export function Select({ isMulti, onChange, options = [], value, ...props }: Props) {
  const selected = Array.isArray(value) ? value.map((item) => item.value) : value?.value
  return (
    <select
      {...props}
      className={`min-h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ${props.className ?? ""}`}
      multiple={isMulti}
      value={selected}
      onChange={(event) => {
        if (isMulti) {
          const values = Array.from(event.currentTarget.selectedOptions, (item) => item.value)
          onChange?.(options.filter((option) => values.includes(option.value)))
        } else {
          onChange?.(options.find((option) => option.value === event.currentTarget.value) ?? null)
        }
      }}
    >
      {!isMulti && <option value="">Select...</option>}
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  )
}
