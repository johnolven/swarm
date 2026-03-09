'use client';

import { use, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken } from '@/lib/auth';
import { PhaserGame, PhaserGameHandle } from '@/components/space/PhaserGame';
import { ChatPanel } from '@/components/space/ChatPanel';
import { PresenceList } from '@/components/space/PresenceList';
import { CharacterPicker } from '@/components/space/CharacterPicker';
import { UserPresence, ChatMessage } from '@/components/space/types';
import { ThemeToggle } from '@/components/ThemeToggle';

function parseJwt(token: string) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

interface ZoneInfo {
  id: string;
  label: string;
}

interface RoomInfo {
  id: string;
  name: string;
  type?: string;
  zone_id?: string;
}

export default function SpacePage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params);
  const router = useRouter();
  const [presences, setPresences] = useState<UserPresence[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [teamName, setTeamName] = useState('Space');
  const [currentZone, setCurrentZone] = useState<ZoneInfo | null>(null);
  const [currentRoom, setCurrentRoom] = useState<RoomInfo | null>(null);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [ready, setReady] = useState(false);
  const [showCharPicker, setShowCharPicker] = useState(false);
  const [characterId, setCharacterId] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('swarm_character_id');
      return saved ? parseInt(saved, 10) : 1;
    }
    return 1;
  });
  const [userInfo, setUserInfo] = useState<{
    id: string;
    name: string;
    type: 'agent' | 'user';
  } | null>(null);
  const phaserRef = useRef<PhaserGameHandle>(null);

  // Socket-like interface for Phaser (local events only)
  const listenersRef = useRef<Map<string, Set<(...args: any[]) => void>>>(new Map());
  const socketLike = useRef({
    emit: (event: string, data: any) => {
      // Handle outgoing events
      const handlers = listenersRef.current.get(`__emit__${event}`);
      handlers?.forEach(h => h(data));
    },
    on: (event: string, handler: (...args: any[]) => void) => {
      if (!listenersRef.current.has(event)) {
        listenersRef.current.set(event, new Set());
      }
      listenersRef.current.get(event)!.add(handler);
    },
    off: (event: string) => {
      listenersRef.current.delete(event);
    },
  });

  // Dispatch an event to all listeners
  const dispatch = useCallback((event: string, ...args: any[]) => {
    const handlers = listenersRef.current.get(event);
    handlers?.forEach(h => h(...args));
  }, []);

  // Parse user from JWT
  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    const payload = parseJwt(token);
    if (!payload) { router.push('/login'); return; }
    if (payload.type === 'human') {
      setUserInfo({ id: payload.user_id, name: payload.name, type: 'user' });
    } else if (payload.agent_id) {
      setUserInfo({ id: payload.agent_id, name: payload.name, type: 'agent' });
    }
  }, [router]);

  // Fetch team name and rooms, then create general room if needed
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`/api/teams/${teamId}`, { headers }).then(r => r.ok ? r.json() : null),
      fetch(`/api/teams/${teamId}/rooms`, { headers }).then(r => r.ok ? r.json() : null),
    ]).then(async ([teamData, roomsData]) => {
      if (teamData?.data) setTeamName(teamData.data.name);

      let roomList = roomsData?.data || [];

      // Create General room if none exists
      if (roomList.length === 0) {
        try {
          const res = await fetch(`/api/teams/${teamId}/rooms`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'General', type: 'general' }),
          });
          if (res.ok) {
            const d = await res.json();
            roomList = [d.data];
          }
        } catch { /* ignore */ }
      }

      setRooms(roomList);
      const general = roomList.find((r: RoomInfo) => r.type === 'general' || r.name === 'General');
      if (general) {
        setCurrentRoom(general);
        loadRoomMessages(general.id);
      }
      setReady(true);
    }).catch(() => setReady(true));
  }, [teamId]);

  // Listen for space:join from Phaser and respond with presence sync
  useEffect(() => {
    if (!userInfo || !ready) return;

    // When Phaser emits space:join, we create a local presence and respond
    const handleJoin = () => {
      const myPresence: UserPresence = {
        id: userInfo.id,
        type: userInfo.type,
        name: userInfo.name,
        x: 17,
        y: 28,
        direction: 'down',
        state: 'idle',
        current_zone: null,
        current_task_id: null,
        connected_at: Date.now(),
        last_move_at: Date.now(),
        socket_id: 'local',
        avatar: {
          sprite: userInfo.type === 'agent' ? 'agent-default' : 'human-default',
          color: userInfo.type === 'agent' ? '#8b5cf6' : '#3b82f6',
        },
      };
      setPresences([myPresence]);
      // Send presence sync back to Phaser
      dispatch('space:presence:sync', { users: [myPresence] });
    };

    // Handle move events from Phaser
    const handleMove = (data: any) => {
      setPresences(prev => prev.map(p =>
        p.id === userInfo.id ? { ...p, x: data.x, y: data.y, direction: data.direction } : p
      ));
    };

    // Handle zone enter/exit
    const handleZoneEnter = (data: any) => {
      setPresences(prev => prev.map(p =>
        p.id === userInfo.id ? { ...p, current_zone: data.zoneId } : p
      ));
    };

    const handleZoneExit = () => {
      setPresences(prev => prev.map(p =>
        p.id === userInfo.id ? { ...p, current_zone: null } : p
      ));
    };

    // Handle chat from Phaser
    const handleChat = async (data: any) => {
      const token = getToken();
      const msg: ChatMessage = {
        sender_id: userInfo.id,
        sender_type: userInfo.type,
        sender_name: userInfo.name,
        content: data.content,
        room_id: data.roomId || currentRoom?.id || null,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, msg]);

      // Persist to DB
      if (data.roomId || currentRoom?.id) {
        try {
          await fetch(`/api/rooms/${data.roomId || currentRoom?.id}/messages`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content: data.content }),
          });
        } catch { /* ignore */ }
      }

      // Echo back to Phaser
      dispatch('space:chat:message', { message: msg });
    };

    // Handle emote
    const handleEmote = (data: any) => {
      dispatch('space:emote', { userId: userInfo.id, emote: data.emote });
    };

    const emitKeys = [
      '__emit__space:join',
      '__emit__space:move',
      '__emit__space:zone:enter',
      '__emit__space:zone:exit',
      '__emit__space:chat',
      '__emit__space:emote',
      '__emit__space:leave',
      '__emit__space:state',
    ];
    listenersRef.current.set('__emit__space:join', new Set([handleJoin]));
    listenersRef.current.set('__emit__space:move', new Set([handleMove]));
    listenersRef.current.set('__emit__space:zone:enter', new Set([handleZoneEnter]));
    listenersRef.current.set('__emit__space:zone:exit', new Set([handleZoneExit]));
    listenersRef.current.set('__emit__space:chat', new Set([handleChat]));
    listenersRef.current.set('__emit__space:emote', new Set([handleEmote]));
    listenersRef.current.set('__emit__space:leave', new Set([() => {}]));
    listenersRef.current.set('__emit__space:state', new Set([() => {}]));

    return () => {
      // Only remove our __emit__ handlers, preserve Phaser's socket.on() listeners
      for (const key of emitKeys) {
        listenersRef.current.delete(key);
      }
    };
  }, [userInfo, ready, currentRoom, dispatch]);

  // Send chat message from ChatPanel
  const handleSendChat = useCallback(async (content: string) => {
    if (!userInfo || !content.trim()) return;
    const token = getToken();
    const roomId = currentRoom?.id;

    const msg: ChatMessage = {
      sender_id: userInfo.id,
      sender_type: userInfo.type,
      sender_name: userInfo.name,
      content: content.trim(),
      room_id: roomId || null,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, msg]);

    if (roomId) {
      try {
        await fetch(`/api/rooms/${roomId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: content.trim() }),
        });
      } catch { /* ignore */ }
    }
  }, [userInfo, currentRoom]);

  // Zone change handler
  const handleZoneChange = useCallback(async (zone: ZoneInfo | null) => {
    setCurrentZone(zone);
    const token = getToken();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    if (!zone) {
      const general = rooms.find(r => r.type === 'general' || r.name === 'General');
      if (general) {
        setCurrentRoom(general);
        loadRoomMessages(general.id);
      }
      return;
    }

    let room = rooms.find(r => r.zone_id === zone.id);
    if (room) {
      setCurrentRoom(room);
      loadRoomMessages(room.id);
      return;
    }

    try {
      const res = await fetch(`/api/teams/${teamId}/rooms`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: zone.label, type: 'zone', zone_id: zone.id }),
      });
      if (res.ok) {
        const data = await res.json();
        room = data.data;
        setRooms(prev => [...prev, room!]);
        setCurrentRoom(room!);
      }
    } catch { /* ignore */ }
  }, [rooms, teamId]);

  const loadRoomMessages = async (roomId: string) => {
    try {
      const token = getToken();
      const res = await fetch(`/api/rooms/${roomId}/messages?limit=30`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const msgs = (data.data || []).reverse().map((m: any) => ({
          sender_id: m.sender_id,
          sender_type: m.sender_type,
          sender_name: m.sender_name,
          content: m.content,
          room_id: m.room_id,
          created_at: m.created_at,
        }));
        setMessages(msgs);
      }
    } catch { /* ignore */ }
  };

  const handleChatMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  // Poll for new messages every 3 seconds (picks up agent messages sent via API)
  useEffect(() => {
    if (!currentRoom?.id) return;
    const roomId = currentRoom.id;

    const poll = async () => {
      try {
        const token = getToken();
        const res = await fetch(`/api/rooms/${roomId}/messages?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const fetched: ChatMessage[] = (data.data || []).reverse().map((m: any) => ({
            sender_id: m.sender_id,
            sender_type: m.sender_type,
            sender_name: m.sender_name,
            content: m.content,
            room_id: m.room_id,
            created_at: m.created_at,
          }));
          // Replace messages with server truth to avoid duplicates
          setMessages(fetched);
        }
      } catch { /* ignore */ }
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [currentRoom?.id]);

  // Poll backend for real presence data (agents connected via REST API)
  useEffect(() => {
    if (!ready || !userInfo) return;
    const token = getToken();
    if (!token) return;

    const pollPresence = async () => {
      try {
        const res = await fetch(`/api/teams/${teamId}/space/presence`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const users: UserPresence[] = data.data || [];
          if (users.length > 0) {
            phaserRef.current?.syncPresences(users);
            setPresences(prev => {
              // Merge: keep local player, add remote users
              const localPlayer = prev.find(p => p.id === userInfo!.id);
              const remoteUsers = users.filter(u => u.id !== userInfo!.id);
              return localPlayer ? [localPlayer, ...remoteUsers] : users;
            });
          }
        }
      } catch (e) { console.error('[space] presence poll error:', e); }
    };

    const interval = setInterval(pollPresence, 2000);
    // Initial poll
    pollPresence();
    return () => clearInterval(interval);
  }, [ready, userInfo, teamId]);

  const handleCharacterSelect = useCallback((charId: number) => {
    setCharacterId(charId);
    localStorage.setItem('swarm_character_id', String(charId));
    // Reload page to reinitialize Phaser with new character
    window.location.reload();
  }, []);

  if (!userInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard/board/${teamId}`}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              &larr; Board
            </Link>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <h1 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {teamName} &mdash; Virtual Office
            </h1>
            {currentZone && (
              <>
                <span className="text-gray-300 dark:text-gray-600">&#x2022;</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium">
                  {currentZone.label}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCharPicker(true)}
              className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Change Character
            </button>
            <span className="flex items-center gap-1 text-xs text-green-600">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Connected
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex gap-4">
          {/* Game area */}
          <div className="flex-1 min-w-0">
            {ready ? (
              <PhaserGame
                ref={phaserRef}
                socket={socketLike.current as any}
                teamId={teamId}
                userId={userInfo.id}
                userName={userInfo.name}
                userType={userInfo.type}
                characterId={characterId}
                onPresenceUpdate={setPresences}
                onChatMessage={handleChatMessage}
                onZoneChange={handleZoneChange}
              />
            ) : (
              <div
                className="rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center bg-gray-100 dark:bg-gray-800"
                style={{ width: '100%', maxWidth: 1024, aspectRatio: '1024/800' }}
              >
                <div className="text-gray-400 text-sm">Loading office...</div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-72 shrink-0 space-y-4">
            <PresenceList users={presences} />
            <ChatPanel
              teamId={teamId}
              messages={messages}
              currentRoomId={currentRoom?.id}
              roomName={currentRoom?.name || 'General'}
              onSendMessage={handleSendChat}
            />
          </div>
        </div>
      </div>

      {showCharPicker && (
        <CharacterPicker
          currentCharId={characterId}
          onSelect={handleCharacterSelect}
          onClose={() => setShowCharPicker(false)}
        />
      )}
    </div>
  );
}
