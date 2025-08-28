import React, { useState, useMemo, useRef } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  options,
  placeholder,
  searchable = false,
  className = '',
  id,
  value,
  onChange,
  name,
  ...props
}) => {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

  // Searchable state
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedLabel = useMemo(() => {
    const found = options.find(o => String(o.value) === String(value));
    return found ? found.label : '';
  }, [options, value]);

  const filtered = useMemo(() => {
    if (!searchTerm) return options;
    const q = searchTerm.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, searchTerm]);

  // When clicking an option, emulate a native change event for consumers
  const selectValue = (val: string, labelText?: string) => {
    // set search input to chosen label
    setSearchTerm(labelText ?? '');
    setOpen(false);
    // call original onChange with a synthetic event that contains target.value
    onChange?.({ target: { value: val } } as any);
  };

  if (!searchable) {
    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
          </label>
        )}

        <select
          id={selectId}
          className={`block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-sky-500 focus:ring-sky-500 sm:text-sm px-3 py-2 ${
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
          } ${className}`}
          value={value}
          onChange={onChange}
          name={name}
          {...(props as any)}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }

  // Searchable rendering
  return (
    <div className="space-y-1 relative" ref={containerRef}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
        </label>
      )}

      <div className={`relative ${className}`}>
        <input
          id={selectId}
          name={undefined}
          type="text"
          value={searchTerm || selectedLabel}
          placeholder={placeholder}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className={`block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-sky-500 focus:ring-sky-500 sm:text-sm px-3 py-2 ${
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
          }`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filtered.length > 0) {
              e.preventDefault();
              selectValue(filtered[0].value, filtered[0].label);
            }
          }}
        />

        {/* Hidden input to carry actual value for form submissions */}
        <input type="hidden" name={name} value={value as any ?? ''} />

        {open && (
          <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-lg">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500">No results</li>
            ) : (
              filtered.map(opt => (
                <li
                  key={opt.value}
                  onMouseDown={(e) => { e.preventDefault(); /* prevent blur */ }}
                  onClick={() => selectValue(opt.value, opt.label)}
                  className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  {opt.label}
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
};