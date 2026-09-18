import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import FolderNameDialog from './FolderNameDialog';
import { usePaletteStore } from '../../store/usePaletteStore';

/* ════════════════════════════════════════════════════════════════
   保存为方案（SaveSchemeButton）
   语义：把「当前调色板」快照存为自建配色方案，故与调色板标题同排展示。
   名字为空则视为取消，不生成方案。
   ════════════════════════════════════════════════════════════════ */

const SaveSchemeButton: React.FC = () => {
  const { t } = useTranslation('settings');
  const saveScheme = usePaletteStore((s) => s.saveScheme);
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = (name?: string) => {
    if (name) saveScheme(name);
    setIsOpen(false);
  };

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        {t('palette.schemes.save')}
      </button>
      {/* key 随开合变化触发重挂载，保证每次打开输入框都是空的 */}
      <FolderNameDialog
        key={isOpen ? 'open' : 'closed'}
        isOpen={isOpen}
        title={t('palette.schemes.saveTitle')}
        defaultValue=""
        placeholder={t('palette.schemes.namePlaceholder')}
        confirmText={t('palette.schemes.confirm')}
        cancelText={t('palette.schemes.cancel')}
        onClose={handleSubmit}
      />
    </>
  );
};

export default SaveSchemeButton;