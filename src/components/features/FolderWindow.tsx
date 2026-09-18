import React, { useState, useRef, useEffect, useMemo, memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import './FolderWindow.css';
import IconGrid from '../common/IconGrid';
import { Palette } from '../common/PalettePicker';
import type { Website } from '../../types';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { useClickOutside } from '../../hooks/useClickOutside';
import { usePaletteStore } from '../../store/usePaletteStore';
import { defaultMaterialHex, resolveColorHex, type ColorSelection } from '../../utils/paletteColors';
import { adjustHexLightness, hexToHsl } from '../../utils/colorUtils';
import { isTouchDevice } from '../../utils/deviceUtils';
import { isPointerOutsideRect } from '../../utils/dropGeometry';
import type { DragHit, DragPoint } from '../../hooks/usePointerDrag';

interface FolderWindowProps {
  folderName: string;
  /** 文件夹水晶材质色快照/静态色（未设置时为空串，展示用缺省色） */
  folderColor?: string;
  /** 绑定的全局调色板槽 id（跟随槽位当前色；旧数据无此字段） */
  folderColorSlot?: string;
  icons: Website[];
  isOpen: boolean;
  onClose: () => void;
  iconColumns: number;
  onIconDragOut: (icon: Website) => void;
  onIconsChange: (icons: Website[]) => void;
  onFolderNameChange: (newName: string) => void;
  /** 修改文件夹水晶材质色：空选择（{}）= 恢复缺省色 */
  onFolderColorChange?: (sel: ColorSelection) => void;
  onEditIcon?: (icon: Website) => void;
  onDeleteIcon?: (iconId: string) => void;
  /** 空白区域右键：唤出「添加网站」（新增图标将插入当前文件夹） */
  onAddSite?: () => void;
  onDisbandFolder?: () => void;
  onDeleteFolder?: () => void;
  onMoveToPage?: (icon: Website) => void;
  disableClickOutside?: boolean;
}

interface FolderHeaderProps {
  folderName: string;
  showEditButton: boolean;
  onEditStart: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClose: () => void;
  /** 关闭按钮左侧的可选控件（如颜色选择） */
  headerActions?: React.ReactNode;
}

const FolderHeader: React.FC<FolderHeaderProps> = memo(({
  folderName,
  showEditButton,
  onEditStart,
  onMouseEnter,
  onMouseLeave,
  onClose,
  headerActions,
}) => {
  const { t } = useTranslation('folder');

  return (
    <div className="folder-header">
      <div className="folder-name-container">
        <div
          className="folder-name-display"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          <h3 className="folder-title">{folderName}</h3>
          {showEditButton && (
            <button
              className="folder-edit-btn"
              onClick={onEditStart}
              aria-label={t('header.editNameAria')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="folder-header-actions">
        {headerActions}
        <button className="folder-close-btn" onClick={onClose}>
          ✕
        </button>
      </div>
    </div>
  );
});

FolderHeader.displayName = 'FolderHeader';

/* ── 文件夹水晶材质色 ──
   取色走共享 Palette（选择模式，4×4 自动换行）：点槽选中；再点已选槽或「自定义颜色」弹取色器；
   未手动设色时展示缺省材质色（调色板 1 号槽当前色，见 paletteColors.defaultMaterialHex） */

interface FolderColorControlProps {
  /** 颜色球展示色：未设置时由调用方传入缺省色 */
  displayColor: string;
  /** 当前颜色选择（color=快照/静态 hex，colorSlot=绑定槽 id） */
  value: ColorSelection;
  open: boolean;
  onToggle: () => void;
  onChange: (sel: ColorSelection) => void;
}

const FolderColorControl: React.FC<FolderColorControlProps> = memo(({ displayColor, value, open, onToggle, onChange }) => {
  const { t } = useTranslation('folder');
  const controlRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    if (open) onToggle();
  }, [open, onToggle]);

  useClickOutside(controlRef, {
    handler: handleClose,
    enabled: open,
  });

  return (
    <div ref={controlRef} className={`folder-color-control ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="folder-color-btn"
        onClick={onToggle}
        aria-label={t('color.setAria')}
        aria-expanded={open}
        title={t('color.title')}
      >
        <span className="folder-color-ball" style={{ background: displayColor }} />
      </button>
      {open && (
        <div className="folder-color-popover" role="dialog" aria-label={t('color.pickerAria')}>
          <p className="folder-color-popover-title">{t('color.title')}</p>
          <Palette value={value} onChange={onChange} />
          <div className="folder-color-popover-footer">
            <button
              type="button"
              className="folder-color-reset-btn"
              title={t('color.resetTitle')}
              onClick={() => onChange({})}
            >
              {t('color.reset')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

FolderColorControl.displayName = 'FolderColorControl';

interface FolderActionsProps {
  iconsCount: number;
  onDisband: () => void;
  onDelete: () => void;
}

const FolderActions: React.FC<FolderActionsProps> = memo(({
  iconsCount,
  onDisband,
  onDelete,
}) => {
  const { t } = useTranslation('folder');

  return (
    <div className="folder-actions">
      {iconsCount > 0 && (
        <button
          className="folder-action-btn disband-btn"
          onClick={onDisband}
          title={t('actions.disbandTitle')}
        >
          📂 {t('actions.disband')}
        </button>
      )}
      <button
        className="folder-action-btn delete-btn"
        onClick={onDelete}
        title={t('actions.deleteTitle')}
      >
        🗑️ {t('actions.delete')}
      </button>
    </div>
  );
});

FolderActions.displayName = 'FolderActions';

interface FolderConfirmDialogProps {
  confirmAction: 'disband' | 'delete' | null;
  iconsCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  onOverlayClick: (e: React.MouseEvent) => void;
}

const FolderConfirmDialog = memo(React.forwardRef<HTMLDivElement, FolderConfirmDialogProps>(({
  confirmAction,
  iconsCount,
  onConfirm,
  onCancel,
  onOverlayClick,
}, ref) => {
  const { t } = useTranslation('folder');

  return (
    <div
      ref={ref}
      className="confirm-dialog-overlay"
      onClick={onOverlayClick}
    >
      <div className="confirm-dialog">
        <h4>
          {confirmAction === 'disband' ? t('dialogs.confirm.disbandTitle') : t('dialogs.confirm.deleteTitle')}
        </h4>
        <p>
          {confirmAction === 'disband'
            ? t('dialogs.confirm.disbandMessage', { count: iconsCount })
            : t('dialogs.confirm.deleteMessage', { count: iconsCount })}
        </p>
        <div className="confirm-dialog-buttons">
          <button
            className={`confirm-btn ${confirmAction === 'delete' ? 'danger' : ''}`}
            onClick={onConfirm}
          >
            {t('dialogs.confirm.confirm')}
          </button>
          <button
            className="cancel-btn"
            onClick={onCancel}
          >
            {t('dialogs.confirm.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}));
FolderConfirmDialog.displayName = 'FolderConfirmDialog';

interface FolderRenameDialogProps {
  editingName: string;
  onEditingNameChange: (name: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSave: () => void;
  onCancel: () => void;
  onOverlayClick: (e: React.MouseEvent) => void;
}

const FolderRenameDialog = memo(React.forwardRef<HTMLDivElement, FolderRenameDialogProps>(({
  editingName,
  onEditingNameChange,
  onKeyDown,
  onSave,
  onCancel,
  onOverlayClick,
}, ref) => {
  const { t } = useTranslation('folder');

  return (
    <div
      ref={ref}
      className="confirm-dialog-overlay"
      onClick={onOverlayClick}
    >
      <div className="confirm-dialog">
        <h4>{t('dialogs.rename.title')}</h4>
        <div className="rename-input-container">
          <input
            type="text"
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus
            maxLength={20}
            className="rename-input"
            placeholder={t('dialogs.rename.placeholder')}
          />
        </div>
        <div className="confirm-dialog-buttons">
          <button
            className="confirm-btn"
            onClick={onSave}
          >
            {t('dialogs.rename.save')}
          </button>
          <button
            className="cancel-btn"
            onClick={onCancel}
          >
            {t('dialogs.rename.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}));
FolderRenameDialog.displayName = 'FolderRenameDialog';

const FolderWindow: React.FC<FolderWindowProps> = memo(({
  folderName,
  folderColor = '',
  folderColorSlot,
  icons,
  isOpen,
  onClose,
  iconColumns,
  onIconDragOut,
  onIconsChange,
  onFolderNameChange,
  onFolderColorChange,
  onEditIcon,
  onDeleteIcon,
  onAddSite,
  onDisbandFolder,
  onDeleteFolder,
  onMoveToPage,
  disableClickOutside = false,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const renameDialogRef = useRef<HTMLDivElement>(null);
  const confirmDialogRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isDraggingOut, setIsDraggingOut] = useState(false);
  /* 重命名按钮：桌面端靠 hover 显隐；触屏没有 hover，直接常显 */
  const [showEditButton, setShowEditButton] = useState(() => isTouchDevice());
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [editingName, setEditingName] = useState(folderName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'disband' | 'delete' | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setEditingName(folderName);
  }, [folderName]);

  const effectiveFolderName = useMemo(() => {
    if (isEditingName) return editingName;
    return folderName;
  }, [folderName, editingName, isEditingName]);

  const slots = usePaletteStore((s) => s.slots);
  const lightness = usePaletteStore((s) => s.lightness);

  // 当前颜色选择：绑定槽 + 快照（跟随槽位当前色），否则静态色；均无 = 未设置
  const folderSelection: ColorSelection = useMemo(() => {
    const sel: ColorSelection = {};
    if (folderColor) sel.color = folderColor;
    if (folderColorSlot) sel.colorSlot = folderColorSlot;
    return sel;
  }, [folderColor, folderColorSlot]);

  // 颜色球展示的有效色：绑定槽→槽当前色；静态→解析快照；未设置（空串）→缺省材质色（1 号槽）
  const effectiveFolderColor = resolveColorHex(folderSelection, slots) || defaultMaterialHex(slots);

  // 全局明暗度：不改存储色，仅叠加到文件夹窗口实际使用的表面颜色（主题 HSL 亮度 + 头部颜色球）
  const surfaceFolderColor = adjustHexLightness(effectiveFolderColor, lightness);

  // 文件夹窗口主题：把有效色换算为 --fc-hue/--fc-sat/--fc-lit，
  // 注入 .folder-window 供 CSS 派生半透明色系分层（棱线/光晕/受光带/色晕）；lit 叠加全局明暗度。
  // 另注入两个「材质气质档位」（无单位数值 0~1，CSS 里直接当 alpha / 强度系数用）：
  //   frost → 亮色文件夹走「霜化水晶」：高光强、含乳白霜纱、外光晕柔亮
  //   depth → 暗且无彩（黑 / 灰）走「黑曜石」：内壁暗角深、几乎不外发光
  // 纯白与纯黑没有色相可染，只能靠这两档气质区分，而不是靠刷明暗硬碰。
  const folderHsl = hexToHsl(effectiveFolderColor);
  const folderLit = folderHsl ? Math.min(100, Math.max(0, folderHsl.l + lightness)) : 0;
  const folderSat = folderHsl ? folderHsl.s : 0;
  // 亮度 42% 以下不霜化、97% 以上满霜化；暗色档由「暗度」乘上「无彩度」得到，
  // 彩色深色文件夹被色度抵消（不触发暗角），避免重演「深色文件夹把窗口压沉」
  const folderFrost = Math.min(1, Math.max(0, (folderLit - 42) / 55));
  const folderDepth =
    Math.min(1, Math.max(0, (50 - folderLit) / 50)) * (1 - Math.min(1, folderSat / 25));
  // 色浓度：0 = 无彩色（白/灰/黑，身体薄染维持原强度，观感不变）；1 = 高饱和彩色。
  // 彩色文件夹的「身体薄染」按它衰减，使窗口是深色玻璃里透出一点材质色，而不是整窗被染满；
  // 材质色的辨识度交给棱线（0.52）、顶部内高光、外圈光晕这三支光去承担。
  const folderChroma = Math.min(1, folderSat / 45);
  const folderThemeStyle = folderHsl
    ? ({
        '--fc-hue': String(Math.round(folderHsl.h)),
        '--fc-sat': `${Math.round(folderHsl.s)}%`,
        '--fc-lit': `${Math.round(folderLit)}%`,
        '--fc-frost': folderFrost.toFixed(3),
        '--fc-depth': folderDepth.toFixed(3),
        '--fc-chroma': folderChroma.toFixed(3),
      } as React.CSSProperties)
    : undefined;

  const handleColorChange = useCallback((sel: ColorSelection) => {
    onFolderColorChange?.(sel);
  }, [onFolderColorChange]);

  // 内容区空白右键 → 唤出「添加网站」（空文件夹无图标可点时尤为重要）。
  // 图标（data-icon-id）与按钮/输入等交互控件上的右键不拦截，保持原有行为。
  const handleContentContextMenu = useCallback((e: React.MouseEvent) => {
    if (!onAddSite) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-icon-id], button, a, input, textarea, select')) return;
    e.preventDefault();
    e.stopPropagation();
    onAddSite();
  }, [onAddSite]);

  const handleToggleColorMenu = useCallback(() => {
    setShowColorMenu((prev) => !prev);
  }, []);

  /** 拖拽中指针移动：实时判断指针是否已越出文件夹窗口，供「拖出即移出文件夹」的视觉提示使用。
   *  迁移前靠 .folder-overlay 上的 dragover 事件，现在直接拿指针坐标与窗口矩形比对。 */
  const handleDragMovePoint = useCallback((point: DragPoint) => {
    const windowRect = windowRef.current?.getBoundingClientRect();
    if (!windowRect) return;
    setIsDraggingOut(isPointerOutsideRect(windowRect, point.x, point.y));
  }, []);

  /** 拖拽收尾（内部排序 / 入夹逻辑已执行完）：指针下方没有任何图标 = 拖出了文件夹窗口。
   *  此时把图标交还宿主（App），由它写回主网格。 */
  const handleDragEndOutside = useCallback(
    (icon: Website, _point: DragPoint, hit: DragHit | null) => {
      if (!hit && isDraggingOut && onIconDragOut) {
        onIconDragOut(icon);
      }
      setIsDraggingOut(false);
    },
    [isDraggingOut, onIconDragOut],
  );

  /** 拖拽被 Esc / pointercancel 中断：这条路径不会有落库，但同样要复位「拖出窗口」的视觉状态 */
  const handleDragCancelOutside = useCallback(() => {
    setIsDraggingOut(false);
  }, []);

  const {
    dragOverPosition,
    longPressInfo,
    clearLongPress,
    getDragHandleProps,
    isDragging,
    isDragOverIcon,
  } = useDragAndDrop({
    icons,
    onIconsChange,
    allowFolderCreation: false,
    onDragMovePoint: handleDragMovePoint,
    onDragEndPoint: handleDragEndOutside,
    onDragCancel: handleDragCancelOutside,
  });

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setShowRenameDialog(false);
    setIsEditingName(false);
    setShowConfirmDialog(false);
    setConfirmAction(null);
    closeTimerRef.current = setTimeout(() => {
      onClose();
      setIsClosing(false);
      closeTimerRef.current = null;
    }, 300);
  }, [isClosing, onClose]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.confirm-dialog-overlay') || target.closest('.confirm-dialog')) {
      return;
    }
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }, [handleClose]);

  useClickOutside(overlayRef, {
    handler: (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('.confirm-dialog-overlay') || target.closest('.confirm-dialog')) return;
      handleClose();
    },
    enabled: isOpen && !disableClickOutside,
  });

  useEffect(() => {
    const stopPropagation = (e: MouseEvent) => {
      e.stopPropagation();
    };

    const renameEl = renameDialogRef.current;
    const confirmEl = confirmDialogRef.current;

    if (showRenameDialog && renameEl) {
      renameEl.addEventListener('mousedown', stopPropagation);
    }
    if (showConfirmDialog && confirmEl) {
      confirmEl.addEventListener('mousedown', stopPropagation);
    }

    return () => {
      if (renameEl) renameEl.removeEventListener('mousedown', stopPropagation);
      if (confirmEl) confirmEl.removeEventListener('mousedown', stopPropagation);
    };
  }, [showRenameDialog, showConfirmDialog]);

  const handleEditFolderName = useCallback(() => {
    setEditingName(folderName);
    setIsEditingName(true);
    setShowRenameDialog(true);
  }, [folderName]);

  const handleSaveFolderName = useCallback(() => {
    if (editingName.trim() && onFolderNameChange) {
      onFolderNameChange(editingName.trim());
    }
    setIsEditingName(false);
    setShowRenameDialog(false);
  }, [editingName, onFolderNameChange]);

  const handleCancelEdit = useCallback(() => {
    setIsEditingName(false);
    setShowRenameDialog(false);
  }, []);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveFolderName();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  }, [handleSaveFolderName, handleCancelEdit]);

  const handleDisbandClick = useCallback(() => {
    setConfirmAction('disband');
    setShowConfirmDialog(true);
  }, []);

  const handleDeleteClick = useCallback(() => {
    setConfirmAction('delete');
    setShowConfirmDialog(true);
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmAction === 'delete' && onDeleteFolder) {
      onDeleteFolder();
    } else if (confirmAction === 'disband' && onDisbandFolder) {
      onDisbandFolder();
    }
    setShowConfirmDialog(false);
    setConfirmAction(null);
  }, [confirmAction, onDeleteFolder, onDisbandFolder]);

  const handleCancelConfirm = useCallback(() => {
    setShowConfirmDialog(false);
    setConfirmAction(null);
  }, []);

  const handleConfirmOverlayClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.target === e.currentTarget) {
      setShowConfirmDialog(false);
      setConfirmAction(null);
    }
  }, []);

  const handleRenameOverlayClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.target === e.currentTarget) {
      setShowRenameDialog(false);
    }
  }, []);

  if (!isOpen && !isClosing) return null;

  return (
    <div
      className={`folder-overlay ${isClosing ? 'closing' : ''}`}
      ref={overlayRef}
      onClick={handleOverlayClick}
    >
      <div className="folder-window" ref={windowRef} style={folderThemeStyle}>
        <FolderHeader
          folderName={effectiveFolderName}
          showEditButton={showEditButton}
          onEditStart={handleEditFolderName}
          onMouseEnter={() => setShowEditButton(true)}
          onMouseLeave={() => {
            /* 触屏上点击别处会补一次 mouseleave，不能因此把按钮收起来 */
            if (!isTouchDevice()) setShowEditButton(false);
          }}
          onClose={handleClose}
          headerActions={
            <FolderColorControl
              displayColor={surfaceFolderColor}
              value={folderSelection}
              open={showColorMenu}
              onToggle={handleToggleColorMenu}
              onChange={handleColorChange}
            />
          }
        />
        <div className="folder-content" onContextMenu={handleContentContextMenu}>
          <div
            className={`folder-icons-grid ${isDraggingOut ? 'dragging-out' : ''}`}
          >
            <IconGrid
              icons={icons}
              iconColumns={iconColumns}
              onEditIcon={onEditIcon}
              onDeleteIcon={onDeleteIcon}
              onMoveToPage={onMoveToPage}
              getDragHandleProps={getDragHandleProps}
              longPressInfo={longPressInfo}
              clearLongPress={clearLongPress}
              isDragging={isDragging}
              isDragOverIcon={isDragOverIcon}
              dragOverPosition={dragOverPosition}
              allowFolders={false}
            />
          </div>
        </div>
        <FolderActions
          iconsCount={icons.length}
          onDisband={handleDisbandClick}
          onDelete={handleDeleteClick}
        />
      </div>

      {showConfirmDialog && (
        <FolderConfirmDialog
          ref={confirmDialogRef}
          confirmAction={confirmAction}
          iconsCount={icons.length}
          onConfirm={handleConfirm}
          onCancel={handleCancelConfirm}
          onOverlayClick={handleConfirmOverlayClick}
        />
      )}

      {showRenameDialog && (
        <FolderRenameDialog
          ref={renameDialogRef}
          editingName={editingName}
          onEditingNameChange={setEditingName}
          onKeyDown={handleKeyPress}
          onSave={handleSaveFolderName}
          onCancel={handleCancelEdit}
          onOverlayClick={handleRenameOverlayClick}
        />
      )}
    </div>
  );
});

FolderWindow.displayName = 'FolderWindow';

export default FolderWindow;
