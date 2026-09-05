import { create } from 'zustand';
import type { PaletteHexMap, PaletteAliasMap } from '../types';
import { setupAutoPersist } from './persistence';
import { getServices } from '../services/serviceContainer';
import { isHexColor } from '../utils/noteColors';
import { canonicalSlotId, normalizeAliasMap, normalizePaletteMap } from '../utils/paletteColors';

interface PaletteState {
  /** 16 槽当前色：槽 id（palette-N）→ hex（始终含全部槽位，缺省用默认 16 色补齐） */
  slots: PaletteHexMap;
  /** 槽位别名：槽 id（palette-N）→ 用户自定义名称（仅含真正设置了别名的槽） */
  aliases: PaletteAliasMap;
  /** 修改某槽位颜色（全局生效，自动持久化到 KV） */
  setSlotColor: (slotId: string, hex: string) => void;
  /** 设置/清除某槽位别名：空串或纯空白 → 清除别名恢复「调色板 N」默认展示 */
  setSlotAlias: (slotId: string, alias: string) => void;
  /** 从用户数据初始化（与默认色/空别名合并；自动兼容旧预设名 key 并归一化为 palette-N） */
  initialize: (palette?: PaletteHexMap, aliases?: PaletteAliasMap) => void;
}

const initialState: Omit<PaletteState, 'setSlotColor' | 'setSlotAlias' | 'initialize'> = {
  slots: normalizePaletteMap(),
  aliases: {},
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

  setSlotAlias: (slotId, alias) => {
    const id = canonicalSlotId(slotId);
    if (!id) return;
    const trimmed = (alias ?? '').trim();
    set((state) => {
      const next: PaletteAliasMap = { ...state.aliases };
      if (trimmed) {
        next[id] = trimmed;
      } else {
        delete next[id];
      }
      if (JSON.stringify(next) === JSON.stringify(state.aliases)) return state;
      return { aliases: next };
    });
  },

  initialize: (palette, aliases) => {
    set({ slots: normalizePaletteMap(palette), aliases: normalizeAliasMap(aliases) });
  },
}));

setupAutoPersist(usePaletteStore, [
  {
    key: 'slots',
    persist: (value) => getServices().dataManager.updatePalette(value as PaletteHexMap),
  },
  {
    key: 'aliases',
    persist: (value) => getServices().dataManager.updatePaletteAliases(value as PaletteAliasMap),
  },
]);
