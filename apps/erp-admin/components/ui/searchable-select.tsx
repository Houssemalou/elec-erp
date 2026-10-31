'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SearchableOption {
  value: string
  label: string
  keywords?: string
}

interface SearchableSelectProps {
  options: SearchableOption[]
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  name?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyLabel?: string
  required?: boolean
  disabled?: boolean
  className?: string
  ariaLabel?: string
}

interface DropdownPosition {
  left: number
  width: number
  maxHeight: number
  top?: number
  bottom?: number
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export function SearchableSelect({
  options,
  value,
  defaultValue,
  onChange,
  name,
  placeholder = 'Sélectionner…',
  searchPlaceholder = 'Rechercher…',
  emptyLabel,
  required = false,
  disabled = false,
  className,
  ariaLabel,
}: SearchableSelectProps) {
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = useState(defaultValue ?? '')
  const currentValue = isControlled ? value : internalValue

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState<DropdownPosition | null>(null)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const listId = useId()

  const allOptions = useMemo<SearchableOption[]>(() => {
    const base = options.map((option) => ({
      ...option,
      keywords: option.keywords ?? option.label,
    }))
    return emptyLabel !== undefined ? [{ value: '', label: emptyLabel, keywords: '' }, ...base] : base
  }, [options, emptyLabel])

  const filtered = useMemo(() => {
    const query = normalize(search.trim())
    if (!query) return allOptions
    return allOptions.filter(
      (option) =>
        option.value !== '' && normalize(`${option.label} ${option.keywords ?? ''}`).includes(query),
    )
  }, [allOptions, search])

  const selected = allOptions.find((option) => option.value === currentValue)

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const gap = 4
    const padding = 8
    const width = Math.max(rect.width, 260)
    const left = Math.min(
      Math.max(padding, rect.left),
      Math.max(padding, window.innerWidth - width - padding),
    )
    const spaceBelow = window.innerHeight - rect.bottom - gap - padding
    const spaceAbove = rect.top - gap - padding
    const openAbove = spaceBelow < 220 && spaceAbove > spaceBelow
    const maxHeight = Math.min(320, Math.max(120, openAbove ? spaceAbove : spaceBelow))

    setPosition(
      openAbove
        ? { left, width, maxHeight, bottom: window.innerHeight - rect.top + gap }
        : { left, width, maxHeight, top: rect.bottom + gap },
    )
  }, [])

  const openDropdown = () => {
    if (disabled) return
    updatePosition()
    setSearch('')
    const index = allOptions.findIndex((option) => option.value === currentValue)
    setActiveIndex(index >= 0 ? index : 0)
    setOpen(true)
  }

  const closeDropdown = () => {
    setOpen(false)
    setSearch('')
  }

  const commit = (next: string) => {
    if (!isControlled) setInternalValue(next)
    if (next !== currentValue) onChange?.(next)
    closeDropdown()
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return
      closeDropdown()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleReposition = () => updatePosition()
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [open, updatePosition])

  useEffect(() => {
    setActiveIndex(0)
  }, [search])

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  useEffect(() => {
    const form = triggerRef.current?.closest('form')
    if (!form) return
    const handleReset = () => {
      if (!isControlled) setInternalValue(defaultValue ?? '')
      setOpen(false)
      setSearch('')
    }
    form.addEventListener('reset', handleReset)
    return () => form.removeEventListener('reset', handleReset)
  }, [isControlled, defaultValue])

  useEffect(() => {
    if (!open) return
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open, filtered.length, search])

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openDropdown()
    } else if (event.key === 'Escape') {
      closeDropdown()
    }
  }

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (filtered.length ? (index + 1) % filtered.length : 0))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (filtered.length ? (index - 1 + filtered.length) % filtered.length : 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = filtered[activeIndex]
      if (option) commit(option.value)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      closeDropdown()
      triggerRef.current?.focus()
    } else if (event.key === 'Tab') {
      closeDropdown()
    }
  }

  return (
    <div className="relative">
      {name ? (
        <select
          name={name}
          value={currentValue}
          required={required}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          onChange={() => undefined}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        >
          {emptyLabel !== undefined ? <option value="">{emptyLabel}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? closeDropdown() : openDropdown())}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 text-left text-sm text-white transition-colors focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-400/20 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-white/40')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-white/40 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && position
        ? createPortal(
            <div
              ref={dropdownRef}
              style={{
                position: 'fixed',
                left: position.left,
                width: position.width,
                maxHeight: position.maxHeight,
                top: position.top,
                bottom: position.bottom,
                zIndex: 1000,
              }}
              className="flex flex-col overflow-hidden rounded-lg border border-[#2A2A2A] bg-[#151515] shadow-xl"
            >
              <div className="border-b border-[#2A2A2A] p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder={searchPlaceholder}
                    role="combobox"
                    aria-expanded="true"
                    aria-controls={listId}
                    aria-autocomplete="list"
                    className="h-9 w-full rounded-md border border-[#2A2A2A] bg-[#0B0B0B] pl-8 pr-2 text-sm text-white placeholder:text-white/40 focus:border-accent-400 focus:outline-none"
                  />
                </div>
              </div>

              <ul id={listId} role="listbox" className="overflow-y-auto p-1">
                {filtered.map((option, index) => {
                  const isSelected = option.value === currentValue
                  const isActive = index === activeIndex
                  return (
                    <li key={option.value || '__empty'} role="option" aria-selected={isSelected}>
                      <button
                        ref={(element) => {
                          optionRefs.current[index] = element
                        }}
                        type="button"
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => commit(option.value)}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                          isActive ? 'bg-white/10 text-white' : 'text-white/70',
                          isSelected && 'text-accent-400',
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                        {isSelected ? <Check className="h-4 w-4 shrink-0 text-accent-400" /> : null}
                      </button>
                    </li>
                  )
                })}
                {filtered.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-white/40">Aucun résultat</li>
                ) : null}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
