import React, { useState } from 'react';

export const AppBar: React.FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(139, 92, 246, 0.1)' }}>
      <h1 className="app-title" style={{ margin: 0 }}>gMPC</h1>
      <div style={{ position: 'relative', textAlign: 'right' }}>
        <div
          style={{ fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setOpen((v) => !v)}
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