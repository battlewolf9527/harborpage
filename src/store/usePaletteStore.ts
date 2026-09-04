import { create } from 'zustand';
import type { PaletteHexMap } from '../types';
import { setupAutoPersist } from './persistence';
import { getServices } from '../services/serviceContainer';
import { isHexColor } from '../utils/noteColors';
import { canonicalSlotId, normalizePaletteMap } from '../utils/paletteColors';

interface PaletteState {
  /** 16 槽当前色：槽 id（palette-N）→ hex（始终含全部槽位，缺省用默认 16 色补齐） */
  slots: PaletteHexMap;
  /** 修改某槽位颜色（全局生效，自动持久化到 KV） */
  setSlotColor: (slotId: string, hex: string) => void;
  /** 从用户数据初始化（与默认色合并；自动兼容旧预设名 key 并归一化为 palette-N） */
  initialize: (palette?: PaletteHexMap) => void;
}

const initialState: Omit<PaletteState, 'setSlotColor' | 'initialize'> = {
  slots: normalizePaletteMap(),
};

export const usePaletteStore = create<PaletteState>((set) => ({
  ...initialState,

  setSlotColor: (slotId, hex) => {
    const id = canonicalSlotId(slotId);
    if (!id || !isHexColor(hex)) return;
    const normalized = hex.toLowerCase();
    set((state) => {
      if (state.slots[id] === normalized) return state;
      return { slots: { ...state.slots, [id]: normalized } };
    });
  },

  initialize: (palette) => {
    set({ slots: normalizePaletteMap(palette) });
  },
}));

setupAutoPersist(usePaletteStore, [
  {
    key: 'slots',
    persist: (value) => getServices().dataManager.updatePalette(value as PaletteHexMap),
  },
]);
