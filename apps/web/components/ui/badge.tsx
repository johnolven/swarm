import React from 'react';

export function Badge({
  children,
  variant = 'default',
  className = ''
}: {
  children: React.ReactNode;
  variant?: 'default' | 'secondary' | 'outline' | 'warning';
  className?: string;
}) {
  const variants = {
    default: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 dark:border dark:border-blue-700',
    secondary: 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200',
    outline: 'border border-gray-300 text-gray-700 dark:border-gray-500 dark:text-gray-200 dark:bg-gray-600',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 dark:border dark:border-yellow-700',
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
