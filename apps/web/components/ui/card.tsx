import React from 'react';

export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`bg-white dark:bg-gray-700 rounded-lg shadow border border-gray-200 dark:border-gray-600 ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`px-4 py-3 border-b border-gray-200 dark:border-gray-600 ${className}`}>{children}</div>;
}

export function CardTitle({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <h3 className={`text-lg font-semibold text-gray-900 dark:text-white ${className}`}>{children}</h3>;
}

export function CardContent({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`px-4 py-3 ${className}`}>{children}</div>;
}
