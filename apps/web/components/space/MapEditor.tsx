'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/components/LanguageProvider';

type Tool = 'walk' | 'block' | 'zone' | 'spawn' | 'erase' | 'select';

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
const DEFAULT_BG_URL = '/space/maps/office-map.png';

// Default office collision grid (matches OfficeScene hardcoded walkable/blocked)
function buildDefaultGrid(): number[] {
  const grid = new Array(DEFAULT_COLS * DEFAULT_ROWS).fill(1);
  const walkable = [
    [1, 3, 30, 4], [1, 7, 30, 8], [1, 11, 30, 12], [1, 15, 30, 16],
    [1, 1, 3, 18], [28, 1, 30, 18], [14, 1, 17, 19],
    [4, 3, 13, 4], [18, 3, 27, 4],
    [1, 17, 30, 20],
    [1, 21, 12, 33], [13, 21, 22, 33],
    [23, 21, 30, 25], [23, 26, 30, 29], [23, 30, 30, 33],
    [12, 24, 14, 26], [21, 24, 24, 26], [12, 29, 14, 31], [21, 29, 24, 31],
  ];
  for (const [sc, sr, ec, er] of walkable) {
    for (let r = sr; r <= er && r < DEFAULT_ROWS; r++)
      for (let c = sc; c <= ec && c < DEFAULT_COLS; c++)
        grid[r * DEFAULT_COLS + c] = 0;
  }
  const blocked = [
    [5, 27, 6, 28], [9, 23, 10, 24],
    [17, 24, 18, 25],
    [26, 22, 27, 23], [26, 27, 27, 28], [26, 31, 27, 32],
  ];
  for (const [sc, sr, ec, er] of blocked) {
    for (let r = sr; r <= er && r < DEFAULT_ROWS; r++)
      for (let c = sc; c <= ec && c < DEFAULT_COLS; c++)
        grid[r * DEFAULT_COLS + c] = 1;
  }
  return grid;
}

const DEFAULT_ZONES: ZoneDef[] = [
  { id: 'open-office', label: 'Open Office', color: '#6366f1', x: 1, y: 1, w: 30, h: 18 },
  { id: 'meeting-room', label: 'Meeting Room', color: '#059669', x: 1, y: 21, w: 12, h: 13 },
  { id: 'lobby', label: 'Lobby', color: '#d97706', x: 13, y: 21, w: 10, h: 13 },
  { id: 'private-office-1', label: 'Office A', color: '#dc2626', x: 23, y: 21, w: 8, h: 6 },
  { id: 'private-office-2', label: 'Office B', color: '#7c3aed', x: 23, y: 27, w: 8, h: 7 },
];

export function MapEditor({ teamId, initialConfig, onSave }: MapEditorProps) {
  const { t } = useLanguage();
  const te = t.space.editor;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('walk');
  const [cols, setCols] = useState(initialConfig?.map_cols || DEFAULT_COLS);
  const [rows, setRows] = useState(initialConfig?.map_rows || DEFAULT_ROWS);
  const hasCustomBg = !!initialConfig?.background_image;
  const [grid, setGrid] = useState<number[]>(() => {
    if (initialConfig?.collision_grid) {
      try {
        return JSON.parse(initialConfig.collision_grid);
      } catch { /* fallback */ }
    }
    return buildDefaultGrid();
  });
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [bgDataUrl, setBgDataUrl] = useState<string | null>(
    hasCustomBg ? initialConfig.background_image! : DEFAULT_BG_URL
  );
  const [isDefaultBg, setIsDefaultBg] = useState(!hasCustomBg);
  const [zones, setZones] = useState<ZoneDef[]>(() => {
    if (initialConfig?.zones) {
      const z = typeof initialConfig.zones === 'string' ? JSON.parse(initialConfig.zones) : initialConfig.zones;
      if (Array.isArray(z) && z.length > 0) return z;
    }
    return [...DEFAULT_ZONES];
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
  // Zone drag state (move / resize)
  const [zoneDragMode, setZoneDragMode] = useState<'move' | 'resize-br' | null>(null);
  const [zoneDragOffset, setZoneDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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
      const isSelected = selectedZone === z.id;
      ctx.fillStyle = hex + (isSelected ? '40' : '30');
      ctx.fillRect(z.x * EDITOR_TILE, z.y * EDITOR_TILE, z.w * EDITOR_TILE, z.h * EDITOR_TILE);
      ctx.strokeStyle = hex;
      ctx.lineWidth = isSelected ? 3 : 1.5;
      if (isSelected) {
        ctx.setLineDash([6, 3]);
      }
      ctx.strokeRect(z.x * EDITOR_TILE, z.y * EDITOR_TILE, z.w * EDITOR_TILE, z.h * EDITOR_TILE);
      ctx.setLineDash([]);
      ctx.fillStyle = hex;
      ctx.font = 'bold 11px monospace';
      ctx.fillText(z.label, z.x * EDITOR_TILE + 4, z.y * EDITOR_TILE + 14);
      // Resize handle on selected zone (bottom-right corner)
      if (isSelected) {
        const hx = (z.x + z.w) * EDITOR_TILE - 8;
        const hy = (z.y + z.h) * EDITOR_TILE - 8;
        ctx.fillStyle = hex;
        ctx.fillRect(hx, hy, 8, 8);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(hx, hy, 8, 8);
      }
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

  // Find zone at a tile position
  const findZoneAt = (tx: number, ty: number): ZoneDef | null => {
    // Search in reverse so topmost zones are found first
    for (let i = zones.length - 1; i >= 0; i--) {
      const z = zones[i];
      if (tx >= z.x && tx < z.x + z.w && ty >= z.y && ty < z.y + z.h) return z;
    }
    return null;
  };

  // Check if tile is near bottom-right corner of a zone (for resize)
  const isNearResizeHandle = (z: ZoneDef, tx: number, ty: number): boolean => {
    return tx >= z.x + z.w - 2 && tx < z.x + z.w && ty >= z.y + z.h - 2 && ty < z.y + z.h;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const tile = getTile(e);
    if (!tile) return;

    if (tool === 'select') {
      // Check if clicking on a zone
      const zone = findZoneAt(tile.x, tile.y);
      if (zone) {
        setSelectedZone(zone.id);
        if (isNearResizeHandle(zone, tile.x, tile.y)) {
          setZoneDragMode('resize-br');
          setZoneDragOffset({ x: tile.x, y: tile.y });
        } else {
          setZoneDragMode('move');
          setZoneDragOffset({ x: tile.x - zone.x, y: tile.y - zone.y });
        }
      } else {
        setSelectedZone(null);
      }
    } else if (tool === 'zone') {
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

    if (tool === 'select' && zoneDragMode && selectedZone) {
      setZones(prev => prev.map(z => {
        if (z.id !== selectedZone) return z;
        if (zoneDragMode === 'move') {
          const nx = Math.max(0, Math.min(cols - z.w, tile.x - zoneDragOffset.x));
          const ny = Math.max(0, Math.min(rows - z.h, tile.y - zoneDragOffset.y));
          return { ...z, x: nx, y: ny };
        } else if (zoneDragMode === 'resize-br') {
          const nw = Math.max(2, tile.x - z.x + 1);
          const nh = Math.max(2, tile.y - z.y + 1);
          return { ...z, w: Math.min(nw, cols - z.x), h: Math.min(nh, rows - z.y) };
        }
        return z;
      }));
    } else if (tool === 'zone' && zoneStart) {
      const x = Math.min(zoneStart.x, tile.x);
      const y = Math.min(zoneStart.y, tile.y);
      const w = Math.abs(tile.x - zoneStart.x) + 1;
      const h = Math.abs(tile.y - zoneStart.y) + 1;
      setZoneDraft({ x, y, w, h });
    } else if (isPainting) {
      paintTile(tile.x, tile.y);
    }

    // Update cursor for resize handle
    if (tool === 'select' && !zoneDragMode) {
      const canvas = canvasRef.current;
      if (canvas) {
        const zone = findZoneAt(tile.x, tile.y);
        canvas.style.cursor = zone && isNearResizeHandle(zone, tile.x, tile.y)
          ? 'nwse-resize'
          : zone ? 'grab' : 'default';
      }
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
    setZoneDragMode(null);
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
      alert(te.imageTooLarge);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setBgDataUrl(dataUrl);
      setIsDefaultBg(false);
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
        // Don't store the default bg URL - OfficeScene loads it automatically
        background_image: isDefaultBg ? null : bgDataUrl,
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

  const handleExport = () => {
    const mapData = {
      version: 1,
      map_cols: cols,
      map_rows: rows,
      tile_size: initialConfig?.tile_size || 16,
      collision_grid: grid,
      zones: zones,
      spawn_x: spawnX,
      spawn_y: spawnY,
      background_image: isDefaultBg ? null : bgDataUrl,
    };
    const json = JSON.stringify(mapData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swarmmind-map-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.map_cols || !data.map_rows || !Array.isArray(data.collision_grid)) {
          alert('Invalid map file');
          return;
        }
        setCols(data.map_cols);
        setRows(data.map_rows);
        setGrid(data.collision_grid);
        setZones(Array.isArray(data.zones) ? data.zones : []);
        setSpawnX(data.spawn_x ?? 5);
        setSpawnY(data.spawn_y ?? 5);
        if (data.background_image) {
          setBgDataUrl(data.background_image);
          setIsDefaultBg(false);
        } else {
          setBgDataUrl(DEFAULT_BG_URL);
          setIsDefaultBg(true);
        }
      } catch {
        alert('Invalid map file');
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-imported
    e.target.value = '';
  };

  const importRef = useRef<HTMLInputElement>(null);

  const tools: { id: Tool; label: string; icon: string; desc: string }[] = [
    { id: 'select', label: te.selectTool, icon: '\u{1F446}', desc: te.selectDesc },
    { id: 'walk', label: te.walkable, icon: '\u2705', desc: te.paintWalkable },
    { id: 'block', label: te.blocked, icon: '\u26D4', desc: te.paintBlocked },
    { id: 'zone', label: te.zone, icon: '\u{1F4CD}', desc: te.drawZone },
    { id: 'spawn', label: te.spawn, icon: '\u2B50', desc: te.setSpawn },
    { id: 'erase', label: te.erase, icon: '\u{1F5D1}', desc: te.eraseToBlocked },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
        {tools.map(tl => (
          <button
            key={tl.id}
            type="button"
            onClick={() => setTool(tl.id)}
            title={tl.desc}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tool === tl.id
                ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-400'
                : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
            }`}
          >
            <span>{tl.icon}</span>
            <span>{tl.label}</span>
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
          {te.grid}
        </label>

        <div className="h-6 w-px bg-gray-200 dark:bg-gray-600 mx-1" />

        <button
          type="button"
          onClick={fillAllWalkable}
          className="px-2 py-1 text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-100 dark:hover:bg-green-900/50"
        >
          {te.fillWalkable}
        </button>
        <button
          type="button"
          onClick={fillAllBlocked}
          className="px-2 py-1 text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-100 dark:hover:bg-red-900/50"
        >
          {te.fillBlocked}
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
              className={tool === 'select' ? '' : 'cursor-crosshair'}
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
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{te.background}</h3>
            {isDefaultBg && (
              <p className="text-xs text-green-600 dark:text-green-400 mb-2">{te.usingDefault}</p>
            )}
            <div className="space-y-2">
              {!isDefaultBg && (
                <button
                  type="button"
                  onClick={() => {
                    setBgDataUrl(DEFAULT_BG_URL);
                    setBgImage(null);
                    setIsDefaultBg(true);
                    setCols(DEFAULT_COLS);
                    setRows(DEFAULT_ROWS);
                    setGrid(buildDefaultGrid());
                    setZones([...DEFAULT_ZONES]);
                    setSpawnX(5);
                    setSpawnY(5);
                  }}
                  className="w-full text-xs px-2 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                >
                  {te.restoreDefault}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setBgDataUrl(null);
                  setBgImage(null);
                  setIsDefaultBg(false);
                  setCols(DEFAULT_COLS);
                  setRows(DEFAULT_ROWS);
                  setGrid(new Array(DEFAULT_COLS * DEFAULT_ROWS).fill(1));
                  setZones([]);
                  setSpawnX(5);
                  setSpawnY(5);
                }}
                className="w-full text-xs px-2 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {te.newBlankMap}
              </button>
              <label className="block">
                <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{te.uploadImage}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-indigo-50 file:text-indigo-600 dark:file:bg-indigo-900/30 dark:file:text-indigo-300 hover:file:bg-indigo-100"
                />
              </label>
            </div>
          </div>

          {/* Grid Size */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{te.gridSize}</h3>
            <div className="flex gap-2 mb-2">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">{te.cols}</label>
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
                <label className="text-xs text-gray-500 dark:text-gray-400">{te.rows}</label>
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
              {te.applySize}
            </button>
          </div>

          {/* Zones */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{te.chatZones}</h3>
            {zones.length === 0 ? (
              <p className="text-xs text-gray-400">{te.useZoneTool}</p>
            ) : (
              <div className="space-y-1.5">
                {zones.map(z => (
                  <div
                    key={z.id}
                    className={`flex items-center justify-between text-xs p-1.5 rounded cursor-pointer ${
                      selectedZone === z.id ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => { setSelectedZone(z.id === selectedZone ? null : z.id); setTool('select'); }}
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

            {/* Edit selected zone */}
            {selectedZone && (() => {
              const sz = zones.find(z => z.id === selectedZone);
              if (!sz) return null;
              return (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">{te.zoneName}</label>
                    <input
                      type="text"
                      value={sz.label}
                      onChange={e => setZones(prev => prev.map(z => z.id === selectedZone ? { ...z, label: e.target.value } : z))}
                      className="w-full mt-0.5 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">{te.zoneColor}</label>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {ZONE_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setZones(prev => prev.map(z => z.id === selectedZone ? { ...z, color: c } : z))}
                          className={`w-5 h-5 rounded-sm border-2 ${sz.color === c ? 'border-white ring-1 ring-gray-400' : 'border-transparent'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400">{te.zoneMoveHint}</p>
                </div>
              );
            })()}
          </div>

          {/* Spawn */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">{te.spawnPoint}</h3>
            <p className="text-xs text-gray-400">
              ({spawnX}, {spawnY}) - {te.useSpawnTool}
            </p>
          </div>

          {/* Save */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm"
          >
            {saving ? te.saving : te.saveMap}
          </button>

          {/* Export / Import */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="flex-1 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {te.exportMap}
            </button>
            <button
              type="button"
              onClick={() => importRef.current?.click()}
              className="flex-1 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {te.importMap}
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </div>

          {/* Legend */}
          <div className="text-xs text-gray-400 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(0, 200, 100, 0.6)' }} />
              {te.walkable}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(200, 50, 50, 0.6)' }} />
              {te.blocked}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#fbbf24' }} />
              {te.spawn}
            </div>
          </div>
        </div>
      </div>

      {/* Zone name modal */}
      {showZoneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-5 w-80 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">{te.nameZone}</h3>
            <input
              type="text"
              value={zoneLabel}
              onChange={e => setZoneLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmZone()}
              placeholder={te.zoneNamePlaceholder}
              autoFocus
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => { setShowZoneModal(false); setPendingZoneRect(null); setZoneLabel(''); }}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {t.space.cancel}
              </button>
              <button
                type="button"
                onClick={confirmZone}
                disabled={!zoneLabel.trim()}
                className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {te.create}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
