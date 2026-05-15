"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface LocaleSelectProps {
  value: string
  onChange: (value: string) => void
  options: { code: string; name: string }[]
  disabled?: boolean
}

export function LocaleSelect({
  value,
  onChange,
  options,
  disabled,
}: LocaleSelectProps) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6">
      <h3 className="text-sm font-medium text-[var(--color-content)] mb-4">
        Source Language
      </h3>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select source language" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.code} value={option.code}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-[var(--color-content-muted)] mt-2">
        The language your current app metadata is written in
      </p>
    </div>
  )
}
