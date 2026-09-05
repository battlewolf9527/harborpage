import { create } from 'zustand';
import type { PaletteHexMap, PaletteAliasMap } from '../types';
import { setupAutoPersist } from './persistence';
import { getServices } from '../services/serviceContainer';
import { isHexColor } from '../utils/noteColors';
import { STORAGE_KEYS } from '../constants';
import DataRepository from '../services/DataRepository';
import {
  canonicalSlotId,
  normalizeAliasMap,
  normalizeLightness,
  normalizePaletteMap,
} from '../utils/paletteColors';

interface PaletteState {
  /** 16 槽当前色：槽 id（palette-N）→ hex（始终含全部槽位，缺省用默认 16 色补齐） */
  slots: PaletteHexMap;
  /** 槽位别名：槽 id（palette-N）→ 用户自定义名称（仅含真正设置了别名的槽） */
  aliases: PaletteAliasMap;
  /** 显示层全局明暗度偏移（-50..50，0 = 原色）：不改任何已存 hex，
   *  仅在实际使用颜色的表面（图标/文件夹/便签）渲染时叠加到亮度通道 */
  lightness: number;
  /** 调色板实时预览开关（仅本机 UI 偏好，不入云）：开启时，设置区的调色板色块
   *  预览叠加 lightness 后的观感，便于拖动滑块直观看到效果；关闭则显示真实存储色 */
  previewEnabled: boolean;
  /** 修改某槽位颜色（全局生效，自动持久化到 KV） */
  setSlotColor: (slotId: string, hex: string) => void;
  /** 设置/清除某槽位别名：空串或纯空白 → 清除别名恢复「调色板 N」默认展示 */
  setSlotAlias: (slotId: string, alias: string) => void;
  /** 设置全局明暗度（自动持久化到 KV，云端同步） */
  setLightness: (value: number) => void;
  /** 切换调色板实时预览开关（本地持久化） */
  setPreviewEnabled: (enabled: boolean) => void;
  /** 从用户数据初始化（与默认色/空别名合并；自动兼容旧预设名 key 并归一化为 palette-N） */
  initialize: (palette?: PaletteHexMap, aliases?: PaletteAliasMap, lightness?: number) => void;
}

/** 调色板实时预览开关默认：开（拖动滑块即可在下方色块看到效果） */
const DEFAULT_PREVIEW_ENABLED = true;

const readPreviewEnabled = (): boolean => {
  try {
    const raw = DataRepository.loadConfigValue(STORAGE_KEYS.LIGHTNESS_PREVIEW_ENABLED);
    return raw === null ? DEFAULT_PREVIEW_ENABLED : raw === 'true';
  } catch {
    return DEFAULT_PREVIEW_ENABLED;
  }
};

const initialState: Omit<
  PaletteState,
  'setSlotColor' | 'setSlotAlias' | 'setLightness' | 'setPreviewEnabled' | 'initialize'
> = {
  slots: normalizePaletteMap(),
  aliases: {},
  lightness: 0,
  previewEnabled: readPreviewEnabled(),
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

  setLightness: (value) => {
    const lightness = normalizeLightness(value);
    set((state) => {
      if (state.lightness === lightness) return state;
      return { lightness };
    });
  },

  setPreviewEnabled: (enabled) => {
    const next = Boolean(enabled);
    set((state) => {
      if (state.previewEnabled === next) return state;
      return { previewEnabled: next };
    });
    // 仅本机 UI 偏好：本地持久化，不入云、不触发变更标记
    try {
      DataRepository.saveConfigValue(STORAGE_KEYS.LIGHTNESS_PREVIEW_ENABLED, JSON.stringify(next));
    } catch {
      // 忽略本地写入失败（不影响开关本次生效）
    }
  },

  initialize: (palette, aliases, lightness) => {
    set({
      slots: normalizePaletteMap(palette),
      aliases: normalizeAliasMap(aliases),
      lightness: normalizeLightness(lightness),
    });
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
  {
    key: 'lightness',
    persist: (value) => getServices().dataManager.updatePaletteLightness(value as number),
  },
]);
