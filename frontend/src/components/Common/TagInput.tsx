import { X } from "lucide-react"
import type React from "react"
import { useRef, useState } from "react"
import { Input } from "@/components/ui/input"

interface InputTagProps {
  tags: string[]
  setTags: React.Dispatch<React.SetStateAction<string[]>>
  isDisabled?: boolean // Optional prop to disable input
}

export default function InputTag({
  tags,
  setTags,
  isDisabled = false,
}: InputTagProps) {
  const [sizeInput, setSizeInput] = useState<number>(1)
  const refInput = useRef<HTMLInputElement>(null)

  // Function to add a new tag from the input field
  const addTag = () => {
    if (!refInput.current) return

    const newText = refInput.current.value.trim().replace(",", "")
    if (newText.length > 0) {
      setTags((prev) => [...prev, newText])
      refInput.current.value = "" // Reset input field
      setSizeInput(1)
    }
  }

  // Handle input changes and dynamically adjust input width
  const handleChangeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    const value = e.target.value
    setSizeInput(value.length > 0 ? value.length : 1)
  }

  // Handle key events for adding/removing tags
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!refInput.current) return

    // Prevent Enter from submitting form
    if (event.key === "Enter") {
      event.preventDefault()
    }

    // Handle comma, space, or Enter to add a new tag
    if (event.key === "," || event.key === "Enter") {
      event.preventDefault()
      addTag()
    }

    // Handle Backspace to remove last tag when input is empty
    else if (
      event.key === "Backspace" &&
      refInput.current.value.trim().length === 0 &&
      tags.length > 0
    ) {
      event.preventDefault()
      setTags((prev) => prev.slice(0, -1))
    }
  }

  // Remove a tag at a given index
  const handleDelItem = (index: number) => {
    setTags((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="flex w-full justify-end">
      <div className="flex">
        {tags.map((text, i) => (
          <span
            key={`${i}_${text}`}
            className="my-1 mr-1 inline-flex items-center rounded-md bg-cyan-100 px-2 py-1 text-sm text-cyan-800"
          >
            {text}
            <button
              type="button"
              aria-label={`Remove ${text}`}
              onClick={() => handleDelItem(i)}
            >
              <X className="ml-1 size-3" />
            </button>
          </span>
        ))}
      </div>
      <Input
        className="max-w-full md:max-w-[200px]"
        ref={refInput}
        placeholder="Add tags to run"
        size={sizeInput}
        onChange={handleChangeInput}
        onKeyDown={handleKeyDown} // Attach key event handler here
        onBlur={addTag} // Add remaining input text as a tag on blur
        disabled={isDisabled} // Disable input if prop is true
      />
    </div>
  )
}
