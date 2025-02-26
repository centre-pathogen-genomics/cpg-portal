import React, { useState, useRef } from "react";
import { Flex, Tag, TagCloseButton, Input } from "@chakra-ui/react";

interface InputTagProps {
  tags: string[];
  setTags: React.Dispatch<React.SetStateAction<string[]>>;
}

export default function InputTag({ tags, setTags }: InputTagProps) {
  const [sizeInput, setSizeInput] = useState<number>(1);
  const refInput = useRef<HTMLInputElement>(null);

  // Function to add a new tag from the input field
  const addTag = () => {
    if (!refInput.current) return;

    const newText = refInput.current.value.trim().replace(",", "");
    if (newText.length > 0) {
      setTags((prev) => [...prev, newText]);
      refInput.current.value = ""; // Reset input field
      setSizeInput(1);
    }
  };

  // Handle input changes and dynamically adjust input width
  const handleChangeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const value = e.target.value;
    setSizeInput(value.length > 0 ? value.length : 1);
  };

  // Handle key events for adding/removing tags
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!refInput.current) return;

    // Prevent Enter from submitting form
    if (event.key === "Enter") {
      event.preventDefault();
    }

    // Handle comma, space, or Enter to add a new tag
    if (event.key === "," || event.key === "Enter") {
      event.preventDefault();
      addTag();
    }

    // Handle Backspace to remove last tag when input is empty
    else if (event.key === "Backspace" && refInput.current.value.trim().length === 0 && tags.length > 0) {
      event.preventDefault();
      setTags((prev) => prev.slice(0, -1));
    }
  };

  // Remove a tag at a given index
  const handleDelItem = (index: number) => {
    setTags((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Flex
      w="100%"
      justify="end"
      onClick={() => refInput.current?.focus()} // Click wrapper to focus input
    >
      <Flex mr={0}>
        {tags.map((text, i) => (
          <Tag key={`${i}_${text}`} colorScheme="cyan" mr="4px" my={1}>
            {text}
            <TagCloseButton onClick={() => handleDelItem(i)} />
          </Tag>
        ))}
      </Flex>
      <Input
        maxW={{ base: "100%", md: "200px" }}
        ref={refInput}
        placeholder="Add tags to run"
        htmlSize={sizeInput}
        onChange={handleChangeInput}
        onKeyDown={handleKeyDown} // Attach key event handler here
        onBlur={addTag} // Add remaining input text as a tag on blur
      />
    </Flex>
  );
}
