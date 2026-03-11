'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import { UserPresence, ChatMessage } from './types';

// Start downloading Phaser immediately when this module loads (before useEffect)
const phaserPromise = typeof window !== 'undefined' ? import('phaser') : null;
const officeScenePromise = typeof window !== 'undefined' ? import('./OfficeScene') : null;

interface SocketLike {
  emit: (event: string, data: any) => void;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler?: (...args: any[]) => void) => void;
}

interface PhaserGameProps {
  socket: SocketLike;
  teamId: string;
  userId: string;
  userName: string;
  userType: 'agent' | 'user';
  characterId?: number;
  spaceConfig?: any;
  onPresenceUpdate: (users: UserPresence[]) => void;
  onChatMessage: (msg: ChatMessage) => void;
  onZoneChange: (zone: { id: string; label: string } | null) => void;
}

export interface PhaserGameHandle {
  syncPresences: (users: UserPresence[]) => void;
}

export const PhaserGame = forwardRef<PhaserGameHandle, PhaserGameProps>(function PhaserGame(
  {
    socket,
    teamId,
    userId,
    userName,
    userType,
    characterId = 1,
    spaceConfig,
    onPresenceUpdate,
    onChatMessage,
    onZoneChange,
  },
  ref
) {
  const { t } = useLanguage();
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useImperativeHandle(ref, () => ({
    syncPresences: (users: UserPresence[]) => {
      sceneRef.current?.syncPresences?.(users);
    },
  }));

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    (async () => {
      const Phaser = await phaserPromise!;
      const { OfficeScene } = await officeScenePromise!;

      const scene = new OfficeScene();
      sceneRef.current = scene;
      scene.configure({
        socket,
        teamId,
        userId,
        userName,
        userType,
        characterId,
        spaceConfig,
        onPresenceUpdate,
        onChatMessage,
        onZoneChange,
        onReady: () => {
          setLoading(false);
          game.canvas.setAttribute('tabindex', '0');
          game.canvas.focus();
        },
      });

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        width: 1024,
        height: 800,
        parent: containerRef.current!,
        backgroundColor: '#1a1a2e',
        pixelArt: true,
        input: { keyboard: true },
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        scene: scene,
      });

      gameRef.current = game;
    })();

    return () => {
      if (gameRef.current) {
        const scene = gameRef.current.scene.getScene('OfficeScene') as any;
        scene?.shutdown?.();
        gameRef.current.destroy(true);
        gameRef.current = null;
        sceneRef.current = null;
      }
    };
  }, []);

  const simulateKey = (key: string, type: 'keydown' | 'keyup') => {
    window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
  };

  const handleDpadDown = (direction: string) => {
    const keyMap: Record<string, string> = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
    simulateKey(keyMap[direction], 'keydown');
  };

  const handleDpadUp = (direction: string) => {
    const keyMap: Record<string, string> = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
    simulateKey(keyMap[direction], 'keyup');
  };

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 rounded-lg z-10 gap-3">
          <div className="text-gray-400 text-sm">{t.space.loadingOffice}</div>
          <div className="w-48 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-gray-500 text-xs">{progress}%</div>
        </div>
      )}
      <div
        ref={containerRef}
        onClick={() => gameRef.current?.canvas.focus()}
        className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer"
        style={{ width: '100%', maxWidth: 1024, aspectRatio: '1024/800' }}
      />
      <div className="mt-1.5 flex flex-wrap gap-3 text-[10px] text-gray-400 hidden sm:flex">
        <span>{t.space.arrowKeysMove}</span>
        <span>{t.space.emotes}</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 inline-block rounded-full bg-purple-500" /> {t.space.agent}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 inline-block rounded-full bg-blue-500" /> {t.space.human}
        </span>
      </div>

      {/* Mobile D-pad */}
      <div className="sm:hidden flex justify-center mt-3">
        <div className="grid grid-cols-3 gap-1 w-36">
          {(['', 'up', '', 'left', '', 'right', '', 'down', ''] as const).map((dir, i) => {
            if (!dir) return <div key={i} className={i === 4 ? 'w-12 h-12 flex items-center justify-center' : ''}>
              {i === 4 && <span className="text-[10px] text-gray-400">Move</span>}
            </div>;
            const arrows: Record<string, string> = { up: '▲', down: '▼', left: '◀', right: '▶' };
            return (
              <button
                key={dir}
                onPointerDown={(e) => { e.preventDefault(); handleDpadDown(dir); }}
                onPointerUp={() => handleDpadUp(dir)}
                onPointerLeave={() => handleDpadUp(dir)}
                onPointerCancel={() => handleDpadUp(dir)}
                onContextMenu={(e) => e.preventDefault()}
                className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600 flex items-center justify-center text-xl select-none touch-none"
              >
                {arrows[dir]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
