import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer style={{ 
      padding: '16px 24px', 
      background: 'rgba(0, 0, 0, 0.3)', 
      backdropFilter: 'blur(20px) saturate(180%)',
      borderTop: '1px solid rgba(139, 92, 246, 0.2)',
      textAlign: 'center',
      marginTop: 'auto'
    }}>
      <p style={{ 
        margin: 0, 
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: '14px',
        letterSpacing: '0.5px'
      }}>
        Powered by <span style={{ color: '#8b5cf6', fontWeight: 600 }}>Solana</span> & <span style={{ color: '#8b5cf6', fontWeight: 600 }}>Arcium</span>
      </p>
    </footer>
  );
};