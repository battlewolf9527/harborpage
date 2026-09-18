import { create } from 'zustand';
import type { PaletteHexMap, PaletteAliasMap, PaletteScheme } from '../types';
import { setupAutoPersist } from './persistence';
import { getServices } from '../services/serviceContainer';
import { isHexColor } from '../utils/noteColors';
import { STORAGE_KEYS } from '../constants';
import DataRepository from '../services/DataRepository';
import {
  canonicalSlotId,
  findScheme,
  normalizeAliasMap,
  normalizeLightness,
  normalizePaletteMap,
  normalizeSchemeList,
  resolveActiveScheme,
  schemeFromPalette,
  schemeHexMap,
} from '../utils/paletteColors';

interface PaletteState {
  /** 16 槽当前色：槽 id（palette-N）→ hex（始终含全部槽位，缺省用默认 16 色补齐） */
  slots: PaletteHexMap;
  /** 槽位别名：槽 id（palette-N）→ 用户自定义名称（仅含真正设置了别名的槽） */
  aliases: PaletteAliasMap;
  /** 自建配色方案（内置 7 套由代码常量提供，不在此列）；方案只读，不会被调色板修改回写 */
  schemes: PaletteScheme[];
  /** 最后一次应用的方案 id（内置为 builtin-*，自建为 custom-*）；null = 从未应用或调色板已被手工改动。
   *  用于下拉框「选中项」的识别：多套方案内容完全相同时（如把内置方案另存为自建方案），
   *  靠 id 区分谁被选中，而不是靠颜色比对。仅本机持久化，不入云 */
  activeSchemeId: string | null;
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
  /**
   * 应用配色方案：把方案的 16 色与自带别名一次性写入调色板（方案内容不变）。
   * 一次 set 同时更新 slots/aliases，避免中间态触发多次持久化。
   */
  applyScheme: (schemeId: string) => void;
  /** 以当前调色板（色 + 别名）快照保存为自建方案；名字为空则不保存 */
  saveScheme: (name: string) => void;
  /** 重命名自建方案（内置方案不可改；空名忽略） */
  renameScheme: (schemeId: string, name: string) => void;
  /** 删除自建方案（内置方案不可删；调色板内容保持不变） */
  deleteScheme: (schemeId: string) => void;
  /** 设置全局明暗度（自动持久化到 KV，云端同步） */
  setLightness: (value: number) => void;
  /** 切换调色板实时预览开关（本地持久化） */
  setPreviewEnabled: (enabled: boolean) => void;
  /** 从用户数据初始化（与默认色/空别名合并；自动兼容旧预设名 key 并归一化为 palette-N） */
  initialize: (
    palette?: PaletteHexMap,
    aliases?: PaletteAliasMap,
    lightness?: number,
    schemes?: PaletteScheme[],
  ) => void;
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

/** 读取本机记录的最后一次应用的方案 id（空/读取失败 → null） */
const readActiveSchemeId = (): string | null => {
  try {
    return DataRepository.loadConfigValue(STORAGE_KEYS.ACTIVE_SCHEME_ID) || null;
  } catch {
    return null;
  }
};

/** 写入本机方案 id（仅本机 UI 偏好，不入云、不触发变更标记；失败静默忽略） */
const persistActiveSchemeId = (id: string | null): void => {
  try {
    DataRepository.saveConfigValue(STORAGE_KEYS.ACTIVE_SCHEME_ID, id ?? '');
  } catch {
    // 忽略本地写入失败（不影响本次选择生效）
  }
};

const initialState: Omit<
  PaletteState,
  | 'setSlotColor'
  | 'setSlotAlias'
  | 'applyScheme'
  | 'saveScheme'
  | 'renameScheme'
  | 'deleteScheme'
  | 'setLightness'
  | 'setPreviewEnabled'
  | 'initialize'
> = {
  slots: normalizePaletteMap(),
  aliases: {},
  schemes: [],
  activeSchemeId: readActiveSchemeId(),
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

  applyScheme: (schemeId) => {
    set((state) => {
      const scheme = findScheme(schemeId, state.schemes);
      if (!scheme) return state;
      return {
        slots: schemeHexMap(scheme),
        aliases: normalizeAliasMap(scheme.aliases),
        // 以 id 记录选中项：即使另有一套方案内容完全相同，也能各自被选中
        activeSchemeId: scheme.id,
      };
    });
    persistActiveSchemeId(schemeId);
  },

  saveScheme: (name) => {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return;
    const { slots, aliases } = usePaletteStore.getState();
    const scheme = schemeFromPalette(trimmed, slots, aliases);
    // 刚保存的方案内容 = 当前调色板，直接把选中项切到它
    set((state) => ({ schemes: [...state.schemes, scheme], activeSchemeId: scheme.id }));
    persistActiveSchemeId(scheme.id);
  },

  renameScheme: (schemeId, name) => {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return;
    set((state) => ({
      schemes: state.schemes.map((scheme) =>
        scheme.id === schemeId ? { ...scheme, name: trimmed } : scheme,
      ),
    }));
  },

  deleteScheme: (schemeId) => {
    const wasActive = usePaletteStore.getState().activeSchemeId === schemeId;
    set((state) => ({
      schemes: state.schemes.filter((scheme) => scheme.id !== schemeId),
      activeSchemeId: wasActive ? null : state.activeSchemeId,
    }));
    if (wasActive) persistActiveSchemeId(null);
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

  initialize: (palette, aliases, lightness, schemes) => {
    const slots = normalizePaletteMap(palette);
    const aliasMap = normalizeAliasMap(aliases);
    const customSchemes = normalizeSchemeList(schemes);
    // 选中项优先用本机记录的方案 id（多套方案内容相同时靠 id 区分），
    // 该方案已删除 / 内容与调色板不再一致 / 本机无记录时，回落内容匹配
    const active = resolveActiveScheme(customSchemes, slots, aliasMap, readActiveSchemeId());
    set({
      slots,
      aliases: aliasMap,
      schemes: customSchemes,
      activeSchemeId: active?.id ?? null,
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
    key: 'schemes',
    persist: (value) => getServices().dataManager.updatePaletteSchemes(value as PaletteScheme[]),
  },
  {
    key: 'lightness',
    persist: (value) => getServices().dataManager.updatePaletteLightness(value as number),
  },
]);
