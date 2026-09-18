import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import './SchemePicker.css';
import FolderNameDialog from './FolderNameDialog';
import ConfirmDialog from './ConfirmDialog';
import HintTip from './HintTip';
import { usePaletteStore } from '../../store/usePaletteStore';
import { allSchemes, describeSchemeName, resolveActiveScheme } from '../../utils/paletteColors';
import type { PaletteScheme } from '../../types';

/* ════════════════════════════════════════════════════════════════
   配色方案选择器（SchemePicker）
   - 下拉框列出内置 7 套 + 用户自建方案；选中即应用到调色板（改槽色 + 别名）
   - 选中项以 **方案 id** 识别（activeSchemeId），颜色内容只做校验：手工改过槽色后自动显示
     「自定义配色」；两套方案内容完全相同时（如把内置方案另存为自建方案）也能分别选中
   - 仅当选中的是自建方案时，右侧出现重命名 / 删除图标按钮
   （「保存为方案」按钮属于调色板语义，见 SaveSchemeButton，由调色板标题行承载）
   ════════════════════════════════════════════════════════════════ */

const SchemePicker: React.FC = () => {
  const { t } = useTranslation('settings');
  const { slots, aliases, schemes, activeSchemeId, applyScheme, renameScheme, deleteScheme } =
    usePaletteStore(
      useShallow((s) => ({
        slots: s.slots,
        aliases: s.aliases,
        schemes: s.schemes,
        activeSchemeId: s.activeSchemeId,
        applyScheme: s.applyScheme,
        renameScheme: s.renameScheme,
        deleteScheme: s.deleteScheme,
      })),
    );

  const [renameTarget, setRenameTarget] = useState<PaletteScheme | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaletteScheme | null>(null);

  const schemeList = allSchemes(schemes);
  const active = resolveActiveScheme(schemes, slots, aliases, activeSchemeId);
  // 仅自建方案可重命名 / 删除；无匹配（调色板被手工改动过）时视为自定义，不提供操作
  const editable = active && !active.builtin ? active : null;

  const handleRenameSubmit = (name?: string) => {
    if (name && renameTarget) renameScheme(renameTarget.id, name);
    setRenameTarget(null);
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) deleteScheme(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="scheme-picker">
      <div className="scheme-picker-head">
        <span className="scheme-picker-title">{t('palette.schemes.title')}</span>
        <HintTip text={t('palette.schemes.hint')} />
      </div>
      <div className="scheme-picker-row">
        <select
          className="scheme-select"
          value={active ? active.id : ''}
          onChange={(e) => applyScheme(e.target.value)}
          aria-label={t('palette.schemes.title')}
        >
          {/* 调色板与任何方案都不一致时（手工改过色）显示此项，选中它是空操作 */}
          {!active && <option value="">{t('palette.schemes.custom')}</option>}
          {schemeList.map((scheme) => (
            <option key={scheme.id} value={scheme.id}>
              {describeSchemeName(scheme)}
            </option>
          ))}
        </select>
        {editable && (
          <div className="scheme-picker-actions">
            <button
              type="button"
              className="scheme-icon-btn"
              onClick={() => setRenameTarget(editable)}
              title={t('palette.schemes.rename')}
              aria-label={t('palette.schemes.rename')}
            >
              ✎
            </button>
            <button
              type="button"
              className="scheme-icon-btn scheme-icon-btn-delete"
              onClick={() => setDeleteTarget(editable)}
              title={t('palette.schemes.delete')}
              aria-label={t('palette.schemes.delete')}
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* key 随目标变化触发重挂载，让输入框重读 defaultValue（重命名时为原方案名） */}
      <FolderNameDialog
        key={renameTarget ? renameTarget.id : 'closed'}
        isOpen={!!renameTarget}
        title={t('palette.schemes.renameTitle')}
        defaultValue={renameTarget?.name ?? ''}
        placeholder={t('palette.schemes.namePlaceholder')}
        confirmText={t('palette.schemes.confirm')}
        cancelText={t('palette.schemes.cancel')}
        onClose={handleRenameSubmit}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('palette.schemes.deleteTitle')}
        message={t('palette.schemes.deleteMessage', {
          name: deleteTarget ? describeSchemeName(deleteTarget) : '',
        })}
        confirmType="danger"
        confirmText={t('palette.schemes.delete')}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default SchemePicker;