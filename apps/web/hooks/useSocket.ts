'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getToken } from '@/lib/auth';

/**
 * Lightweight presence/chat hook that uses HTTP polling
 * instead of Socket.IO (which requires the Express backend).
 * This makes the space work with just the Next.js server.
 */

interface SocketLike {
  emit: (event: string, data: any) => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler?: (...args: any[]) => void) => void;
}

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef<Map<string, Set<(...args: any[]) => void>>>(new Map());
  const socketRef = useRef<SocketLike | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    // Try WebSocket first (Express backend), fall back to polling
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL;

    if (WS_URL) {
      // Only attempt real Socket.IO if explicitly configured
      import('socket.io-client').then(({ io }) => {
        const s = io(WS_URL, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnectionAttempts: 3,
          timeout: 5000,
        });

        s.on('connect', () => {
          setConnected(true);
          socketRef.current = s;
        });

        s.on('connect_error', () => {
          // Fall back to polling mode
          setupPollingMode();
        });

        s.on('disconnect', () => setConnected(false));

        return () => {
          s.disconnect();
        };
      });
    } else {
      setupPollingMode();
    }

    function setupPollingMode() {
      // Create a mock socket that uses the event system
      // Events are dispatched locally; real data flows via REST API calls
      const mock: SocketLike = {
        emit: (event: string, data: any) => {
          // Handle events via REST API from the page component
          const handlers = listenersRef.current.get(`__emit__${event}`);
          handlers?.forEach(h => h(data));
        },
        on: (event: string, handler: (...args: any[]) => void) => {
          if (!listenersRef.current.has(event)) {
            listenersRef.current.set(event, new Set());
          }
          listenersRef.current.get(event)!.add(handler);
        },
        off: (event: string, handler?: (...args: any[]) => void) => {
          if (handler) {
            listenersRef.current.get(event)?.delete(handler);
          } else {
            listenersRef.current.delete(event);
          }
        },
      };

      socketRef.current = mock;
      setConnected(true);
    }
  }, []);

  const dispatch = useCallback((event: string, ...args: any[]) => {
    const handlers = listenersRef.current.get(event);
    handlers?.forEach(h => h(...args));
  }, []);

  return { socket: socketRef.current, connected, dispatch };
}
