import { useState, useRef, useCallback, useMemo, ReactNode, useEffect } from 'react';
import { useClickOutside } from '../hooks/useClickOutside';

export interface PixelSelectOption<T = unknown> {
  value: string;
  label: string;
  icon?: string;
  description?: string;
  group?: string;
  data?: T;
}

export interface PixelSelectProps<T = unknown> {
  options: PixelSelectOption<T>[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
  disabled?: boolean;
  maxHeight?: string;
  groupOrder?: string[];
  renderOption?: (option: PixelSelectOption<T>, isSelected: boolean) => ReactNode;
  renderSelected?: (option: PixelSelectOption<T>) => ReactNode;
}

export function PixelSelect<T = unknown>({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  searchable = true,
  allowClear = false,
  clearLabel = 'None',
  disabled = false,
  maxHeight = '16rem',
  groupOrder,
  renderOption,
  renderSelected,
}: PixelSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const lowerSearch = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(lowerSearch) ||
        opt.description?.toLowerCase().includes(lowerSearch) ||
        opt.value.toLowerCase().includes(lowerSearch)
    );
  }, [options, search]);

  // Group options if they have group property
  const groupedOptions = useMemo(() => {
    const hasGroups = filteredOptions.some((opt) => opt.group);
    if (!hasGroups) return null;

    const groups = new Map<string, PixelSelectOption<T>[]>();
    for (const opt of filteredOptions) {
      const group = opt.group || 'Other';
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(opt);
    }

    // Sort groups by groupOrder if provided
    if (groupOrder) {
      const sortedGroups = new Map<string, PixelSelectOption<T>[]>();
      for (const group of groupOrder) {
        if (groups.has(group)) {
          sortedGroups.set(group, groups.get(group)!);
        }
      }
      // Add any remaining groups not in groupOrder
      for (const [group, opts] of groups) {
        if (!sortedGroups.has(group)) {
          sortedGroups.set(group, opts);
        }
      }
      return sortedGroups;
    }

    return groups;
  }, [filteredOptions, groupOrder]);

  // Flat list for keyboard navigation
  const flatOptions = useMemo(() => {
    const result: PixelSelectOption<T>[] = [];
    if (allowClear) {
      result.push({ value: '', label: clearLabel });
    }
    if (groupedOptions) {
      for (const opts of groupedOptions.values()) {
        result.push(...opts);
      }
    } else {
      result.push(...filteredOptions);
    }
    return result;
  }, [filteredOptions, groupedOptions, allowClear, clearLabel]);

  // Close on click outside
  useClickOutside(containerRef, () => {
    setIsOpen(false);
    setSearch('');
  }, isOpen);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Reset highlighted index when options change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && optionsRef.current) {
      const highlighted = optionsRef.current.querySelector('[data-highlighted="true"]');
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleToggle = useCallback(() => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
    setSearch('');
    setHighlightedIndex(0);
  }, [disabled]);

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue === '' ? null : optionValue);
      setIsOpen(false);
      setSearch('');
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < flatOptions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatOptions[highlightedIndex]) {
            handleSelect(flatOptions[highlightedIndex].value);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setSearch('');
          break;
      }
    },
    [isOpen, flatOptions, highlightedIndex, handleSelect]
  );

  const renderOptionContent = (
    option: PixelSelectOption<T>,
    isSelected: boolean
  ) => {
    if (renderOption) {
      return renderOption(option, isSelected);
    }

    return (
      <span className="flex items-center gap-2">
        {option.icon && <span>{option.icon}</span>}
        <span>{option.label}</span>
        {option.description && (
          <span className="text-beige/50 text-xs ml-auto">{option.description}</span>
        )}
      </span>
    );
  };

  const renderSelectedContent = () => {
    if (!selectedOption) {
      return <span className="text-beige/50">{placeholder}</span>;
    }

    if (renderSelected) {
      return renderSelected(selectedOption);
    }

    return (
      <span className="flex items-center gap-2">
        {selectedOption.icon && <span>{selectedOption.icon}</span>}
        <span>{selectedOption.label}</span>
      </span>
    );
  };

  // Track current option index for highlighting
  let currentIndex = allowClear ? 1 : 0;

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          pixel-input w-full text-left flex items-center justify-between
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <span className="truncate">{renderSelectedContent()}</span>
        <span className="text-beige/50 ml-2">{isOpen ? '\u25B2' : '\u25BC'}</span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute z-20 mt-1 w-full bg-stone-panel border-2 border-border-gold shadow-pixel"
          style={{ maxHeight }}
        >
          {/* Search Input */}
          {searchable && (
            <div className="p-2 border-b border-border-gold/50">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="pixel-input w-full text-sm"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {/* Options List */}
          <div ref={optionsRef} className="overflow-y-auto" style={{ maxHeight: `calc(${maxHeight} - ${searchable ? '3.5rem' : '0px'})` }}>
            {/* Clear Option */}
            {allowClear && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                data-highlighted={highlightedIndex === 0}
                className={`
                  w-full px-3 py-2 text-left hover:bg-stone-secondary transition-colors
                  ${value === null ? 'bg-gold/20' : ''}
                  ${highlightedIndex === 0 ? 'bg-stone-secondary' : ''}
                `}
              >
                <span className="text-beige/70">{clearLabel}</span>
              </button>
            )}

            {/* Grouped Options */}
            {groupedOptions ? (
              Array.from(groupedOptions.entries()).map(([group, opts]) => (
                <div key={group}>
                  <div className="px-3 py-1 bg-gold/10 border-y border-border-gold/50">
                    <span className="font-pixel text-pixel-xs text-gold">{group}</span>
                  </div>
                  {opts.map((option) => {
                    const optionIndex = currentIndex++;
                    const isSelected = option.value === value;
                    const isHighlighted = highlightedIndex === optionIndex;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleSelect(option.value)}
                        data-highlighted={isHighlighted}
                        className={`
                          w-full px-3 py-2 text-left hover:bg-stone-secondary transition-colors
                          ${isSelected ? 'bg-gold/20' : ''}
                          ${isHighlighted ? 'bg-stone-secondary' : ''}
                        `}
                      >
                        {renderOptionContent(option, isSelected)}
                      </button>
                    );
                  })}
                </div>
              ))
            ) : (
              /* Flat Options */
              filteredOptions.map((option) => {
                const optionIndex = allowClear ? filteredOptions.indexOf(option) + 1 : filteredOptions.indexOf(option);
                const isSelected = option.value === value;
                const isHighlighted = highlightedIndex === optionIndex;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    data-highlighted={isHighlighted}
                    className={`
                      w-full px-3 py-2 text-left hover:bg-stone-secondary transition-colors
                      ${isSelected ? 'bg-gold/20' : ''}
                      ${isHighlighted ? 'bg-stone-secondary' : ''}
                    `}
                  >
                    {renderOptionContent(option, isSelected)}
                  </button>
                );
              })
            )}

            {/* No Results */}
            {filteredOptions.length === 0 && (
              <div className="px-3 py-2 text-beige/50 text-sm">
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
