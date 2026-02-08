// API Configuration
export const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// Helper function to construct API endpoints
export function apiUrl(path: string): string {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_URL}/${cleanPath}`;
}
