import React from 'react';
import { useTranslation } from 'react-i18next';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import './OfflineBadge.css';

/**
 * 离线模式徽标：断网时常驻左下角，恢复联网后自动消失。
 * 让用户明确知道「界面仍可用，但改动尚未上云」，避免误以为已经保存成功。
 */
const OfflineBadge: React.FC = () => {
  const { t } = useTranslation('common');
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="offline-badge" role="status">
      <span className="offline-badge-dot" aria-hidden="true" />
      {t('offlineBadge')}
    </div>
  );
};

export default OfflineBadge;