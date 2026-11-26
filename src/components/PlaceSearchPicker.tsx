import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, MapPin, Search, X } from 'lucide-react';
import { POPULAR_LANDMARKS } from '../data/cucutaTransitData';
import { TripEndpoint } from '../types/transit';

interface PlaceSearchPickerProps {
  id: string;
  ariaLabel: string;
  endpoint: TripEndpoint | null;
  placeholder: string;
  emptyLabel?: string;
  onSelectLandmark: (landmarkIndex: number) => void;
}

export const PlaceSearchPicker: React.FC<PlaceSearchPickerProps> = ({
  id,
  ariaLabel,
  endpoint,
  placeholder,
  emptyLabel = 'Elige un lugar...',
  onSelectLandmark,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = POPULAR_LANDMARKS.map((lm, idx) => ({ ...lm, idx })).filter(
    (item) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.municipality.toLowerCase().includes(q)
      );
    }
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen((prev) => !prev);
          setTimeout(() => inputRef.current?.focus(), 40);
        }}
        className={`w-full bg-white border rounded-xl px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors ${
          isOpen
            ? 'border-neutral-900 ring-1 ring-neutral-900'
            : 'border-neutral-200 hover:border-neutral-300'
        }`}
      >
        <span
          className={`text-xs sm:text-sm font-medium truncate ${
            endpoint ? 'text-neutral-900' : 'text-neutral-400'
          }`}
        >
          {endpoint ? endpoint.name : emptyLabel}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-neutral-900' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-neutral-200 rounded-2xl shadow-xl overflow-hidden">
          {/* Inline Search Input */}
          <div className="p-2 border-b border-neutral-100 flex items-center gap-2 bg-neutral-50/70">
            <Search className="w-3.5 h-3.5 text-neutral-400 ml-1 shrink-0" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-transparent text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none py-1"
            />
            {query && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => setQuery('')}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded-md"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Clean Scrollable Options List (No native modal!) */}
          <ul
            role="listbox"
            aria-label={ariaLabel}
            className="max-h-56 overflow-y-auto divide-y divide-neutral-100"
          >
            {filtered.length === 0 ? (
              <li className="px-3.5 py-3 text-xs text-neutral-500 text-center">
                No se encontraron lugares. Usa «Mapa» para marcar cualquier punto.
              </li>
            ) : (
              filtered.map((item) => {
                const isSelected =
                  Boolean(endpoint) &&
                  !endpoint?.isCustomMapPoint &&
                  endpoint?.landmarkIndex === item.idx;
                return (
                  <li key={item.name}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onSelectLandmark(item.idx);
                        setIsOpen(false);
                        setQuery('');
                      }}
                      className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-2 transition-colors ${
                        isSelected
                          ? 'bg-neutral-100 text-neutral-900 font-semibold'
                          : 'hover:bg-neutral-50 text-neutral-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <MapPin
                          className="w-3.5 h-3.5 text-neutral-400 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="text-xs truncate">{item.name}</span>
                      </div>
                      <span className="text-[10px] font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-md shrink-0">
                        {item.municipality}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
