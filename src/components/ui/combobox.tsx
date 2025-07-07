// src/components/ui/combobox.tsx (or a similar path)

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils"; // Your utility for class names
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList, // Import CommandList
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange: (value: string | undefined) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyStateMessage?: string;
  className?: string;
  popoverClassName?: string;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search option...",
  emptyStateMessage = "No option found.",
  className,
  popoverClassName,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)} // Ensure full width by default
        >
          {value
            ? options.find((option) => option.value === value)?.label
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("w-full p-0", popoverClassName)}
        style={{ minWidth: "var(--radix-popover-trigger-width)" }}
      >
        {" "}
        {/* Use trigger width */}
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            {" "}
            {/* Wrap CommandEmpty and CommandGroup in CommandList */}
            <CommandEmpty>{emptyStateMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label} // cmdk searches against this value. For value, use onSelect.
                  onSelect={(currentLabel) => {
                    // currentLabel is what user selected or typed
                    // Find the option that matches the selected label
                    const selectedOption = options.find(
                      (opt) =>
                        opt.label.toLowerCase() === currentLabel.toLowerCase()
                    );
                    onValueChange(
                      selectedOption ? selectedOption.value : undefined
                    );
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
