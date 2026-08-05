import { useEffect, useRef } from 'react';
import { useIconsUIStore } from '../store/useIconsUIStore';

/**
 * 检查元素是否为文本输入框（包括 textarea 和 contenteditable）
 */
function isTextInputElement(element: Element | null): boolean {
  if (!element) return false;
  const tag = element.tagName.toLowerCase();
  if (tag === 'textarea') return true;
  if ((element as HTMLElement).isContentEditable) return true;
  if (tag === 'input') {
    const type = (element as HTMLInputElement).type.toLowerCase();
    const nonTextTypes = ['button', 'checkbox', 'radio', 'submit', 'file', 'hidden', 'image', 'reset', 'range', 'color'];
    return !nonTextTypes.includes(type);
  }
  return false;
}

/**
 * 检查字符串是否为网址
 */
function isUrlString(str: string): boolean {
  const trimmed = str.trim();
  if (!trimmed) return false;
  // 网址不应包含空白字符
  if (/\s/.test(trimmed)) return false;

  try {
    let url: URL;
    if (/^https?:\/\//i.test(trimmed)) {
      url = new URL(trimmed);
    } else {
      // 无协议的网址必须包含点号（域名特征）
      if (!trimmed.includes('.')) return false;
      url = new URL(`https://${trimmed}`);
    }
    const hostname = url.hostname;
    if (!hostname) return false;
    // 主机名必须包含点号+字母后缀，或是 IP 地址，或是 localhost
    return (
      hostname === 'localhost' ||
      /\.[a-zA-Z]{2,}/.test(hostname) ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
    );
  } catch {
    return false;
  }
}

interface UseAddWebsiteShortcutOptions {
  /** 是否启用快捷键 */
  enabled: boolean;
  /** 触发时的回调，url 为 undefined 表示不自动填入网址 */
  onTrigger: (url: string | undefined) => void;
}

/**
 * 监听 Ctrl+V 和 Insert 快捷键，快速唤起添加网站窗口。
 *
 * - Ctrl+V：通过 paste 事件读取剪贴板（无需权限），仅当内容是网址时弹出窗口并自动填入。
 * - Insert：通过 keydown 事件触发，无论剪贴板内容是什么都弹出窗口；
 *           是网址则自动填入，否则留空。使用 navigator.clipboard.readText() 读取剪贴板。
 *
 * 当光标处在文本输入框中时，两个快捷键保持原有功能。
 */
export function useAddWebsiteShortcut({ enabled, onTrigger }: UseAddWebsiteShortcutOptions) {
  const onTriggerRef = useRef(onTrigger);
  onTriggerRef.current = onTrigger;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    const isAnyDialogOpen = () => {
      const state = useIconsUIStore.getState();
      return (
        state.showAddIcon ||
        state.showEditIcon ||
        state.showSettings ||
        state.showFolderNameDialog ||
        state.showConfirmDialog
      );
    };

    /** 读取剪贴板，带超时防止挂起 */
    const readClipboard = async (timeoutMs = 3000): Promise<string> => {
      try {
        const text = await Promise.race([
          navigator.clipboard?.readText() ?? Promise.resolve(''),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), timeoutMs),
          ),
        ]);
        return text?.trim() ?? '';
      } catch {
        return '';
      }
    };

    // Ctrl+V：通过 paste 事件处理，可直接读取 clipboardData，无需权限
    const handlePaste = (e: ClipboardEvent) => {
      if (!enabledRef.current) return;
      if (isTextInputElement(document.activeElement)) return;
      if (isAnyDialogOpen()) return;

      const clipboardText = e.clipboardData?.getData('text') ?? '';
      if (!isUrlString(clipboardText)) return;

      e.preventDefault();
      onTriggerRef.current(clipboardText.trim());
    };

    // Insert 键：通过 keydown 事件处理，需异步读取剪贴板
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Insert') return;
      if (!enabledRef.current) return;
      if (isTextInputElement(document.activeElement)) return;
      if (isAnyDialogOpen()) return;

      e.preventDefault();

      const process = async () => {
        const clipboardText = await readClipboard();
        const isUrl = isUrlString(clipboardText);
        // Insert：无论剪贴板内容是什么都弹出窗口
        onTriggerRef.current(isUrl ? clipboardText : undefined);
      };
      process();
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
