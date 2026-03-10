'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('nexus-theme');
    const isDark = stored ? stored === 'dark' : true;
    setDark(isDark);
    if (!isDark) document.body.classList.add('light-mode');
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.body.classList.remove('light-mode');
    } else {
      document.body.classList.add('light-mode');
    }
    localStorage.setItem('nexus-theme', next ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      title={dark ? 'Mode clair' : 'Mode sombre'}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: 48,
        height: 26,
        borderRadius: 9999,
        padding: '3px',
        backgroundColor: dark ? '#1E2D4A' : '#c8d0dc',
        border: `1.5px solid ${dark ? '#2E4060' : '#b0bac8'}`,
        cursor: 'pointer',
        transition: 'background-color 0.3s ease, border-color 0.3s ease',
        flexShrink: 0,
      }}
    >
      {/* Sliding circle */}
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          height: 18,
          borderRadius: '50%',
          backgroundColor: dark ? '#7B94B0' : '#ffffff',
          boxShadow: dark ? 'none' : '0 1px 4px rgba(0,0,50,0.18)',
          transform: dark ? 'translateX(0)' : 'translateX(22px)',
          transition: 'transform 0.3s ease, background-color 0.3s ease',
          flexShrink: 0,
        }}
      >
        {dark ? (
          /* Moon icon */
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#1E2D4A" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        ) : (
          /* Sun icon */
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#4a5568" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1"  x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22"  x2="5.64"  y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1"  y1="12" x2="3"  y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36"/>
            <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"/>
          </svg>
        )}
      </span>
    </button>
  );
}
