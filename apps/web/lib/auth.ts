'use client';

/**
 * Shared auth utilities for the frontend.
 * Centralizes localStorage token access to avoid duplication.
 */

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('swarm_token');
}

export function getUserType(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('user_type');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function logout() {
  localStorage.removeItem('swarm_token');
  localStorage.removeItem('user_type');
  localStorage.removeItem('user_email');
}

/**
 * Shared SWR fetcher that injects the auth token.
 */
export async function authFetcher(url: string) {
  const token = getToken();
  const response = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const error = new Error('Request failed');
    (error as any).status = response.status;
    throw error;
  }

  const data = await response.json();
  return data.data ?? data;
}
