import React, { useState } from 'react';

export const AppBar: React.FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h1 className="app-title" style={{ margin: 0 }}>arcis-wheel</h1>
      <div style={{ position: 'relative', textAlign: 'right' }}>
        <div
          className="game-hub-trigger"
          style={{ 
            fontWeight: 'bold', 
            fontSize: '1.1rem', 
            cursor: 'pointer', 
            userSelect: 'none',
            padding: '8px 16px',
            borderRadius: '10px',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            color: '#e0cfff'
          }}
          onClick={() => setOpen((v) => !v)}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          Game Hub
        </div>
        {open && (
          <div className="game-hub-dropdown animate-fade-slide">
            <div style={{ fontSize: '0.9rem', color: '#e0cfff', marginBottom: 12 }}>Coming Soon</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {/* Placeholder for future games */}
              <li style={{ color: '#d1b3ff', fontStyle: 'italic' }}>No games available yet</li>
            </ul>
          </div>
        )}
      </div>
    </header>
  );
};