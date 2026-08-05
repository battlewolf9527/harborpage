import React, { useState, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import './Search.css'
import { useSearchSelector } from '../../store/selectors'
import { IconType } from '../../services/IconManager'
import type { SearchEngine } from '../../types'
import { useClickOutside } from '../../hooks/useClickOutside'
import { renderSearchEngineIcon } from '../../services/iconUtils'
import { getServices } from '../../services/serviceContainer'

interface SearchProps {
  onSearch: (query: string, engine: SearchEngine) => void
}

const Search: React.FC<SearchProps> = ({ onSearch }) => {
  const { iconManager } = getServices();
  const { searchEngines, defaultSearchEngineId, setDefaultSearchEngineId } = useSearchSelector();
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number, left: number }>({ top: 0, left: 0 })
  const [isFocused, setIsFocused] = useState<boolean>(false)
  const [query, setQuery] = useState<string>('')
  const searchEngineButtonRef = useRef<HTMLButtonElement>(null)

  const effectiveSearchEngine = useMemo(() => {
    if (searchEngines.length === 0) return null;
    
    let engine = searchEngines.find(e => e.id === defaultSearchEngineId);
    if (!engine) {
      engine = searchEngines[0];
    }
    
    return engine;
  }, [searchEngines, defaultSearchEngineId]);

  const handleSearchEngineClick = useCallback(() => {
    if (searchEngineButtonRef.current) {
      const rect = searchEngineButtonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX
      })
      setShowSearchDropdown(!showSearchDropdown)
    }
  }, [showSearchDropdown])

  const handleEngineSelect = useCallback((engine: SearchEngine) => {
    setDefaultSearchEngineId(engine.id);
    setShowSearchDropdown(false);
  }, [setDefaultSearchEngineId]);

  const handleSearchSubmit = useCallback(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery && effectiveSearchEngine) {
      onSearch(trimmedQuery, effectiveSearchEngine);
    }
  }, [query, effectiveSearchEngine, onSearch])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchSubmit();
    }
  }, [handleSearchSubmit])

  useClickOutside(searchEngineButtonRef, {
    handler: () => {
      if (showSearchDropdown) {
        setShowSearchDropdown(false);
      }
    },
    enabled: showSearchDropdown,
  });

  return (
    <div className={`search-container ${isFocused ? 'focused' : ''}`}>
      <div className="search-wrapper">
        <div className="search-engine-dropdown">
          <button 
              className="search-engine-button"
              onClick={handleSearchEngineClick}
              ref={searchEngineButtonRef}
            >
              {effectiveSearchEngine ? (
                renderSearchEngineIcon(
                  effectiveSearchEngine,
                  iconManager.getIconUrlSync(IconType.SEARCH, effectiveSearchEngine),
                  'search-engine-favicon',
                  'search-engine-icon'
                )
              ) : (
                <span className="search-engine-icon">🔍</span>
              )}
            </button>
            {createPortal(
              <div 
                className={`search-engine-list ${showSearchDropdown ? 'visible' : ''}`}
                style={{
                  position: 'fixed',
                  top: `${dropdownPosition.top}px`,
                  left: `${dropdownPosition.left}px`,
                  width: '120px',
                  opacity: showSearchDropdown ? 1 : 0,
                  visibility: showSearchDropdown ? 'visible' : 'hidden',
                  pointerEvents: showSearchDropdown ? 'auto' : 'none',
                  transition: 'opacity 0.2s ease, visibility 0.2s ease',
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {searchEngines.map((engine) => {
                  const iconUrl = iconManager.getIconUrlSync(IconType.SEARCH, engine);
                  
                  return (
                    <button 
                      key={engine.id}
                      className={`search-engine-option ${engine.id === defaultSearchEngineId ? 'selected' : ''}`}
                      onClick={() => handleEngineSelect(engine)}
                    >
                      {renderSearchEngineIcon(engine, iconUrl, 'search-engine-favicon', 'search-engine-icon')} {engine.name}
                    </button>
                  );
                })}
              </div>,
              document.body
            )}
        </div>
        <input 
          type="text" 
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={effectiveSearchEngine ? `用${effectiveSearchEngine.name}搜索` : '搜索...'}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <button 
          className="search-submit-button"
          onClick={handleSearchSubmit}
        >
          搜索
        </button>
      </div>
    </div>
  )
}

export default Search