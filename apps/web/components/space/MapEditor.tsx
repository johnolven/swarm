'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Tool = 'walk' | 'block' | 'zone' | 'spawn' | 'erase';

interface ZoneDef {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SpaceConfigData {
  map_cols: number;
  map_rows: number;
  tile_size: number;
  collision_grid: string | null;
  background_image: string | null;
  zones: ZoneDef[] | string;
  spawn_x: number;
  spawn_y: number;
}

interface MapEditorProps {
  teamId: string;
  initialConfig?: SpaceConfigData;
  onSave: (config: Partial<SpaceConfigData>) => Promise<void>;
}

const TILE_COLORS: Record<number, string> = {
  0: 'rgba(0, 200, 100, 0.35)', // walkable
  1: 'rgba(200, 50, 50, 0.35)', // blocked
};

const ZONE_COLORS = [
  '#6366f1', '#059669', '#d97706', '#dc2626', '#7c3aed',
  '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5',
];

const DEFAULT_COLS = 32;
const DEFAULT_ROWS = 34;
const EDITOR_TILE = 20; // pixel size of each tile in the editor canvas

export function MapEditor({ teamId, initialConfig, onSave }: MapEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('walk');
  const [cols, setCols] = useState(initialConfig?.map_cols || DEFAULT_COLS);
  const [rows, setRows] = useState(initialConfig?.map_rows || DEFAULT_ROWS);
  const [grid, setGrid] = useState<number[]>(() => {
    if (initialConfig?.collision_grid) {
      try {
        return JSON.parse(initialConfig.collision_grid);
      } catch { /* fallback */ }
    }
    return new Array(cols * rows).fill(1); // all blocked by default
  });
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [bgDataUrl, setBgDataUrl] = useState<string | null>(initialConfig?.background_image || null);
  const [zones, setZones] = useState<ZoneDef[]>(() => {
    if (initialConfig?.zones) {
      const z = typeof initialConfig.zones === 'string' ? JSON.parse(initialConfig.zones) : initialConfig.zones;
      return Array.isArray(z) ? z : [];
    }
    return [];
  });
  const [spawnX, setSpawnX] = useState(initialConfig?.spawn_x ?? 5);
  const [spawnY, setSpawnY] = useState(initialConfig?.spawn_y ?? 5);
  const [saving, setSaving] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [isPainting, setIsPainting] = useState(false);
  const [zoneStart, setZoneStart] = useState<{ x: number; y: number } | null>(null);
  const [zoneDraft, setZoneDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [zoneLabel, setZoneLabel] = useState('');
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [pendingZoneRect, setPendingZoneRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  const canvasW = cols * EDITOR_TILE;
  const canvasH = rows * EDITOR_TILE;

  // Load background image from data URL
  useEffect(() => {
    if (!bgDataUrl) { setBgImage(null); return; }
    const img = new Image();
    img.onload = () => setBgImage(img);
    img.src = bgDataUrl;
  }, [bgDataUrl]);

  // Draw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasW, canvasH);

    // Background image
    if (bgImage) {
      ctx.drawImage(bgImage, 0, 0, canvasW, canvasH);
    } else {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    // Draw collision grid overlay
    if (showGrid) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const val = grid[r * cols + c];
          ctx.fillStyle = TILE_COLORS[val] || TILE_COLORS[1];
          ctx.fillRect(c * EDITOR_TILE, r * EDITOR_TILE, EDITOR_TILE, EDITOR_TILE);
        }
      }

      // Grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.5;
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath();
        ctx.moveTo(c * EDITOR_TILE, 0);
        ctx.lineTo(c * EDITOR_TILE, canvasH);
        ctx.stroke();
      }
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * EDITOR_TILE);
        ctx.lineTo(canvasW, r * EDITOR_TILE);
        ctx.stroke();
      }
    }

    // Draw zones
    for (const z of zones) {
      const hex = z.color || '#6366f1';
      ctx.fillStyle = hex + '30';
      ctx.fillRect(z.x * EDITOR_TILE, z.y * EDITOR_TILE, z.w * EDITOR_TILE, z.h * EDITOR_TILE);
      ctx.strokeStyle = hex;
      ctx.lineWidth = selectedZone === z.id ? 3 : 1.5;
      ctx.strokeRect(z.x * EDITOR_TILE, z.y * EDITOR_TILE, z.w * EDITOR_TILE, z.h * EDITOR_TILE);
      ctx.fillStyle = hex;
      ctx.font = 'bold 11px monospace';
      ctx.fillText(z.label, z.x * EDITOR_TILE + 4, z.y * EDITOR_TILE + 14);
    }

    // Draw zone draft (while dragging)
    if (zoneDraft) {
      ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
      ctx.fillRect(zoneDraft.x * EDITOR_TILE, zoneDraft.y * EDITOR_TILE, zoneDraft.w * EDITOR_TILE, zoneDraft.h * EDITOR_TILE);
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(zoneDraft.x * EDITOR_TILE, zoneDraft.y * EDITOR_TILE, zoneDraft.w * EDITOR_TILE, zoneDraft.h * EDITOR_TILE);
      ctx.setLineDash([]);
    }

    // Draw spawn point
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(
      spawnX * EDITOR_TILE + EDITOR_TILE / 2,
      spawnY * EDITOR_TILE + EDITOR_TILE / 2,
      EDITOR_TILE / 2.5,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', spawnX * EDITOR_TILE + EDITOR_TILE / 2, spawnY * EDITOR_TILE + EDITOR_TILE / 2);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }, [canvasW, canvasH, bgImage, grid, rows, cols, showGrid, zones, zoneDraft, spawnX, spawnY, selectedZone]);

  useEffect(() => { draw(); }, [draw]);

  const getTile = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasW / rect.width;
    const scaleY = canvasH / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX / EDITOR_TILE);
    const y = Math.floor((e.clientY - rect.top) * scaleY / EDITOR_TILE);
    if (x < 0 || x >= cols || y < 0 || y >= rows) return null;
    return { x, y };
  };

  const paintTile = (x: number, y: number) => {
    if (tool === 'walk' || tool === 'block') {
      const val = tool === 'walk' ? 0 : 1;
      setGrid(prev => {
        const next = [...prev];
        next[y * cols + x] = val;
        return next;
      });
    } else if (tool === 'erase') {
      setGrid(prev => {
        const next = [...prev];
        next[y * cols + x] = 1;
        return next;
      });
    } else if (tool === 'spawn') {
      setSpawnX(x);
      setSpawnY(y);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const tile = getTile(e);
    if (!tile) return;

    if (tool === 'zone') {
      setZoneStart(tile);
      setZoneDraft({ x: tile.x, y: tile.y, w: 1, h: 1 });
    } else {
      setIsPainting(true);
      paintTile(tile.x, tile.y);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const tile = getTile(e);
    if (!tile) return;

    if (tool === 'zone' && zoneStart) {
      const x = Math.min(zoneStart.x, tile.x);
      const y = Math.min(zoneStart.y, tile.y);
      const w = Math.abs(tile.x - zoneStart.x) + 1;
      const h = Math.abs(tile.y - zoneStart.y) + 1;
      setZoneDraft({ x, y, w, h });
    } else if (isPainting) {
      paintTile(tile.x, tile.y);
    }
  };

  const handleMouseUp = () => {
    if (tool === 'zone' && zoneDraft && zoneDraft.w > 1 && zoneDraft.h > 1) {
      setPendingZoneRect(zoneDraft);
      setShowZoneModal(true);
    }
    setIsPainting(false);
    setZoneStart(null);
    setZoneDraft(null);
  };

  const confirmZone = () => {
    if (!pendingZoneRect || !zoneLabel.trim()) return;
    const id = `zone-${Date.now()}`;
    const color = ZONE_COLORS[zones.length % ZONE_COLORS.length];
    setZones(prev => [...prev, { id, label: zoneLabel.trim(), color, ...pendingZoneRect }]);
    setZoneLabel('');
    setShowZoneModal(false);
    setPendingZoneRect(null);
  };

  const deleteZone = (zoneId: string) => {
    setZones(prev => prev.filter(z => z.id !== zoneId));
    if (selectedZone === zoneId) setSelectedZone(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setBgDataUrl(dataUrl);
      // Auto-detect dimensions from image
      const img = new Image();
      img.onload = () => {
        // Calculate best tile grid from image dimensions
        const tileSize = initialConfig?.tile_size || 16;
        const newCols = Math.round(img.width / tileSize);
        const newRows = Math.round(img.height / tileSize);
        if (newCols > 0 && newRows > 0 && newCols <= 100 && newRows <= 100) {
          setCols(newCols);
          setRows(newRows);
          setGrid(new Array(newCols * newRows).fill(1));
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleResizeGrid = () => {
    const newGrid = new Array(cols * rows).fill(1);
    // Copy existing data
    const oldCols = grid.length > 0 ? Math.round(Math.sqrt(grid.length * (cols / rows))) : cols;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const oldIdx = r * oldCols + c;
        if (oldIdx < grid.length) {
          newGrid[r * cols + c] = grid[oldIdx];
        }
      }
    }
    setGrid(newGrid);
  };

  const fillAllWalkable = () => setGrid(new Array(cols * rows).fill(0));
  const fillAllBlocked = () => setGrid(new Array(cols * rows).fill(1));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        map_cols: cols,
        map_rows: rows,
        tile_size: initialConfig?.tile_size || 16,
        collision_grid: JSON.stringify(grid),
        background_image: bgDataUrl,
        zones: zones,
        spawn_x: spawnX,
        spawn_y: spawnY,
      });
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const tools: { id: Tool; label: string; icon: string; desc: string }[] = [
    { id: 'walk', label: 'Walkable', icon: '\u2705', desc: 'Paint walkable tiles' },
    { id: 'block', label: 'Blocked', icon: '\u26D4', desc: 'Paint blocked tiles' },
    { id: 'zone', label: 'Zone', icon: '\u{1F4CD}', desc: 'Draw chat zone (drag)' },
    { id: 'spawn', label: 'Spawn', icon: '\u2B50', desc: 'Set spawn point' },
    { id: 'erase', label: 'Erase', icon: '\u{1F5D1}', desc: 'Erase to blocked' },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
        {tools.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTool(t.id)}
            title={t.desc}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tool === t.id
                ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-400'
                : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}

        <div className="h-6 w-px bg-gray-200 dark:bg-gray-600 mx-1" />

        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={e => setShowGrid(e.target.checked)}
            className="rounded"
          />
          Grid
        </label>

        <div className="h-6 w-px bg-gray-200 dark:bg-gray-600 mx-1" />

        <button
          type="button"
          onClick={fillAllWalkable}
          className="px-2 py-1 text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-100 dark:hover:bg-green-900/50"
        >
          Fill Walkable
        </button>
        <button
          type="button"
          onClick={fillAllBlocked}
          className="px-2 py-1 text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-100 dark:hover:bg-red-900/50"
        >
          Fill Blocked
        </button>
      </div>

      <div className="flex gap-4">
        {/* Canvas */}
        <div className="flex-1 min-w-0">
          <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-900" style={{ maxHeight: '70vh' }}>
            <canvas
              ref={canvasRef}
              width={canvasW}
              height={canvasH}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="cursor-crosshair"
              style={{
                imageRendering: 'pixelated',
                width: canvasW * scale,
                height: canvasH * scale,
              }}
            />
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-gray-400">{cols}x{rows} tiles</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">-</button>
              <span className="text-xs text-gray-400 w-10 text-center">{Math.round(scale * 100)}%</span>
              <button type="button" onClick={() => setScale(s => Math.min(3, s + 0.25))} className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">+</button>
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div className="w-64 shrink-0 space-y-4">
          {/* Background */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Background</h3>
            <label className="block">
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Upload image (max 2MB)</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-indigo-50 file:text-indigo-600 dark:file:bg-indigo-900/30 dark:file:text-indigo-300 hover:file:bg-indigo-100"
              />
            </label>
            {bgDataUrl && (
              <button
                type="button"
                onClick={() => { setBgDataUrl(null); setBgImage(null); }}
                className="mt-2 text-xs text-red-500 hover:text-red-700"
              >
                Remove background
              </button>
            )}
          </div>

          {/* Grid Size */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Grid Size</h3>
            <div className="flex gap-2 mb-2">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Cols</label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={cols}
                  onChange={e => setCols(Math.min(100, Math.max(10, parseInt(e.target.value) || 10)))}
                  className="w-full mt-0.5 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Rows</label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={rows}
                  onChange={e => setRows(Math.min(100, Math.max(10, parseInt(e.target.value) || 10)))}
                  className="w-full mt-0.5 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleResizeGrid}
              className="w-full text-xs px-2 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Apply Size
            </button>
          </div>

          {/* Zones */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Chat Zones</h3>
            {zones.length === 0 ? (
              <p className="text-xs text-gray-400">Use Zone tool to draw zones on the map</p>
            ) : (
              <div className="space-y-1.5">
                {zones.map(z => (
                  <div
                    key={z.id}
                    className={`flex items-center justify-between text-xs p-1.5 rounded cursor-pointer ${
                      selectedZone === z.id ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => setSelectedZone(z.id === selectedZone ? null : z.id)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: z.color }} />
                      <span className="text-gray-700 dark:text-gray-300 truncate">{z.label}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deleteZone(z.id); }}
                      className="text-gray-400 hover:text-red-500 ml-1"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Spawn */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Spawn Point</h3>
            <p className="text-xs text-gray-400">
              ({spawnX}, {spawnY}) - Use Spawn tool to set
            </p>
          </div>

          {/* Save */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm"
          >
            {saving ? 'Saving...' : 'Save Map'}
          </button>

          {/* Legend */}
          <div className="text-xs text-gray-400 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(0, 200, 100, 0.6)' }} />
              Walkable
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(200, 50, 50, 0.6)' }} />
              Blocked
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#fbbf24' }} />
              Spawn
            </div>
          </div>
        </div>
      </div>

      {/* Zone name modal */}
      {showZoneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-5 w-80 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Name this zone</h3>
            <input
              type="text"
              value={zoneLabel}
              onChange={e => setZoneLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmZone()}
              placeholder="e.g. Meeting Room"
              autoFocus
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => { setShowZoneModal(false); setPendingZoneRect(null); setZoneLabel(''); }}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmZone}
                disabled={!zoneLabel.trim()}
                className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
