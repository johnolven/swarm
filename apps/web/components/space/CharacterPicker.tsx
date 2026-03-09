'use client';

import { useState } from 'react';

const TOTAL_CHARACTERS = 41;
const FRAME_W = 24;
const FRAME_H = 24;
const SHEET_W = 384;
const SHEET_H = 96;
const PREVIEW_SCALE = 4;

interface CharacterPickerProps {
  currentCharId: number;
  onSelect: (charId: number) => void;
  onClose: () => void;
}

export function CharacterPicker({ currentCharId, onSelect, onClose }: CharacterPickerProps) {
  const [selected, setSelected] = useState(currentCharId);

  const handleConfirm = () => {
    onSelect(selected);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            Choose your character
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-6 gap-3">
            {Array.from({ length: TOTAL_CHARACTERS }, (_, i) => {
              const charId = i + 1;
              const padded = String(charId).padStart(3, '0');
              const isSelected = charId === selected;

              return (
                <button
                  key={charId}
                  type="button"
                  onClick={() => setSelected(charId)}
                  className={`relative flex items-center justify-center rounded-lg p-1 transition-all ${
                    isSelected
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 ring-2 ring-indigo-500'
                      : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  <div
                    style={{
                      width: FRAME_W * PREVIEW_SCALE,
                      height: FRAME_H * PREVIEW_SCALE,
                      backgroundImage: `url(/space/sprites/characters/Character_${padded}.png)`,
                      backgroundPosition: `0px 0px`,
                      backgroundSize: `${SHEET_W * PREVIEW_SCALE}px ${SHEET_H * PREVIEW_SCALE}px`,
                      imageRendering: 'pixelated',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Select
          </button>
        </div>
      </div>
    </div>
  );
}
