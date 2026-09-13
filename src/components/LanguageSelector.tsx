import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Globe, ChevronDown } from 'lucide-react';

export const LanguageSelector: React.FC = () => {
  const { language, setLanguage, currentLanguageOption, languages } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="language-selector-wrapper" ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="language-selector-btn"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          padding: '4px 8px',
          color: '#fff',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(225, 6, 0, 0.5)';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        }}
        title="Cambiar idioma / Switch language"
        aria-label="Language selector"
      >
        <Globe size={13} color="#00D7B6" />
        <span style={{ fontSize: '0.95rem', lineHeight: 1 }}>{currentLanguageOption.flag}</span>
        <span style={{ textTransform: 'uppercase' }}>{currentLanguageOption.code}</span>
        <ChevronDown 
          size={11} 
          color="var(--text-muted)" 
          style={{ 
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'none'
          }} 
        />
      </button>

      {isOpen && (
        <div 
          className="language-dropdown-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            background: 'rgba(10, 14, 22, 0.98)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: '10px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65)',
            zIndex: 1000,
            minWidth: '150px',
            overflow: 'hidden',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {languages.map((lang) => {
            const isSelected = lang.code === language;
            return (
              <button
                key={lang.code}
                onClick={() => {
                  setLanguage(lang.code);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  background: isSelected ? 'rgba(225, 6, 0, 0.15)' : 'transparent',
                  border: isSelected ? '1px solid rgba(225, 6, 0, 0.3)' : '1px solid transparent',
                  borderRadius: '6px',
                  color: isSelected ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontFamily: 'var(--font-sans)',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                    e.currentTarget.style.color = '#fff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <span style={{ fontSize: '1.15rem' }}>{lang.flag}</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: isSelected ? 800 : 500, fontSize: '0.82rem' }}>
                    {lang.nativeName}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {lang.name}
                  </span>
                </div>
                {isSelected && (
                  <span style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--f1-red)' }} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
