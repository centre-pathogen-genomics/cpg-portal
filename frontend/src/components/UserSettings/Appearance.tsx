import { useTheme } from "@/components/theme-provider"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

const Appearance = () => {
  const { theme, setTheme } = useTheme()

  return (
    <section className="w-full">
      <h2 className="py-4 text-sm font-semibold">Appearance</h2>
      <RadioGroup value={theme} onValueChange={setTheme} className="gap-3">
        {[
          ["light", "Light Mode"],
          ["dark", "Dark Mode"],
          ["system", "System Default"],
        ].map(([value, label]) => (
          <div className="flex items-center gap-2" key={value}>
            <RadioGroupItem value={value} id={`appearance-${value}`} />
            <Label htmlFor={`appearance-${value}`}>{label}</Label>
          </div>
        ))}
      </RadioGroup>
    </section>
  )
}

export default Appearance
