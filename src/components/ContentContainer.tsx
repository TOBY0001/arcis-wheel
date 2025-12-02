import React, { ReactNode } from 'react';

export const ContentContainer: React.FC<{ children: ReactNode }> = ({ children }) => {
  return <main style={{ flex: 1, padding: '20px' }}>{children}</main>;
};