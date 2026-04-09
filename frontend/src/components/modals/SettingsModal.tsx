import { useEffect, useState } from 'react';
import { ModalBase } from './ModalBase';
import { useAppStore } from '../../store';
import { SoftButton } from '../SoftButton';
import { buildReleaseInfo } from '../../utils/release';
import { Api } from '../../api';

export function SettingsModal(){
  const { modals, closeModal, theme, setTheme } = useAppStore();
  const showGroupTotals = useAppStore((s) => s.showGroupTotals);
  const setShowGroupTotals = useAppStore((s) => s.setShowGroupTotals);
  const appVersion = useAppStore((s) => s.appVersion);
  const latestVersion = useAppStore((s) => s.latestVersion);
  const latestReleaseUrl = useAppStore((s) => s.latestReleaseUrl);
  const updateAvailable = useAppStore((s) => s.updateAvailable);
  const open = modals.settings;
  const nextTheme = theme === 'light' ? 'dark' : 'light';
  const [locking, setLocking] = useState(false);
  const themeModeIcon = theme === 'light' ? '/icons/ui/sun.svg' : '/icons/ui/moon-stars.svg';
  const releaseInfo = buildReleaseInfo({
    appVersion,
    latestVersion,
    latestReleaseUrl,
    updateAvailable,
  });

  useEffect(() => {
    if (!open) setLocking(false);
  }, [open]);

  useEffect(() => {
    if (!locking) return;
    const tm = setTimeout(() => {
      void Api.logoutPin().catch(() => {});
      sessionStorage.removeItem('pin-token');
      sessionStorage.removeItem('pin-ok');
      useAppStore.getState().setPinSession(false);
      closeModal('settings');
      setLocking(false);
    }, 160);
    return () => clearTimeout(tm);
  }, [locking, closeModal]);

  const handleReleaseClick = () => {
    if (!releaseInfo?.href) return;
    window.open(releaseInfo.href, "_blank", "noopener,noreferrer");
  };

  return (
    <ModalBase
      open={open}
      title="Settings"
      //subtitle="Tune MOPAY to your preferences."
      icon={<img src="/icons/ui/settings.svg" alt="" className="modal-header-icon-svg" aria-hidden="true" />}
      onClose={() => closeModal("settings")}
      size="md"
    >
      <div className="space-y-3 sm:space-y-4 modal-compact-mobile">
        <div className="settings-list">
          <div className="settings-row">
            <div className="settings-text">
              <div className="settings-title">
                <span className="settings-icon" aria-hidden="true">
                  <img src="/icons/ui/info-circle.svg" alt="" className="settings-icon-svg" />
                </span>
                About release
              </div>
            </div>
            <SoftButton
              type="button"
              className={`settings-release-button ${releaseInfo?.isUpdate ? 'settings-release-button-update' : ''}`}
              onClick={handleReleaseClick}
              disabled={!releaseInfo?.href}
            >
              {releaseInfo?.label ?? 'Release info'}
            </SoftButton>
          </div>

          <div className="settings-row">
            <div className="settings-text">
              <div className="settings-title">
                <span className="settings-icon" aria-hidden="true">
                  <img src="/icons/ui/sum.svg" alt="" className="settings-icon-svg" />
                </span>
                Group totals
              </div>
            </div>
            <button
              type="button"
              className={`settings-toggle ${showGroupTotals ? 'is-on' : ''}`}
              aria-pressed={showGroupTotals}
              onClick={() => setShowGroupTotals(!showGroupTotals)}
            >
              <span className="settings-toggle-track">
                <span className="settings-toggle-label settings-toggle-label-left">Off</span>
                <span className="settings-toggle-label settings-toggle-label-right">On</span>
              </span>
              <span className="settings-toggle-knob" aria-hidden="true" />
            </button>
          </div>

          <div className="settings-row">
            <div className="settings-text">
              <div className="settings-title">
                <span className="settings-icon" aria-hidden="true">
                  <img src={themeModeIcon} alt="" className="settings-icon-svg" />
                </span>
                Theme mode
              </div>
            </div>
            <button
              type="button"
              className={`settings-toggle ${theme === 'dark' ? 'is-on' : ''}`}
              aria-pressed={theme === 'dark'}
              onClick={() => setTheme(nextTheme)}
            >
              <span className="settings-toggle-track">
                <span className="settings-toggle-label settings-toggle-label-left" aria-hidden="true">
                  <img src="/icons/ui/sun.svg" alt="" className="settings-toggle-icon" />
                </span>
                <span className="settings-toggle-label settings-toggle-label-right" aria-hidden="true">
                  <img src="/icons/ui/moon-stars.svg" alt="" className="settings-toggle-icon" />
                </span>
              </span>
              <span className="settings-toggle-knob" aria-hidden="true" />
            </button>
          </div>

          <div className="settings-row">
            <div className="settings-text">
              <div className="settings-title">
                <span className="settings-icon" aria-hidden="true">
                  <img src="/icons/ui/lock.svg" alt="" className="settings-icon-svg" />
                </span>
                Screen Lock
              </div>
            </div>
            <button
              type="button"
              className={`settings-toggle settings-toggle-lock ${locking ? 'is-on' : ''}`}
              aria-pressed={locking}
              onClick={() => setLocking(true)}
            >
              <span className="settings-toggle-track">
                <span className="settings-toggle-label settings-toggle-label-left" aria-hidden="true">
                  <img src="/icons/ui/lock-open-2.svg" alt="" className="settings-toggle-icon" />
                </span>
                <span className="settings-toggle-label settings-toggle-label-right" aria-hidden="true">
                  <img src="/icons/ui/lock.svg" alt="" className="settings-toggle-icon" />
                </span>
              </span>
              <span className="settings-toggle-knob" aria-hidden="true" />
            </button>
          </div>

          <div className="settings-row">
            <div className="settings-text">
              <div className="settings-title">
                <span className="settings-icon" aria-hidden="true">
                  <img src="/icons/ui/language.svg" alt="" className="settings-icon-svg" />
                </span>
                Language
              </div>
            </div>
            <div className="settings-badge">In development</div>
          </div>
        </div>

        <div className="modal-footer-premium flex justify-end">
          <SoftButton variant="ghost" onClick={()=>closeModal('settings')}>Close</SoftButton>
        </div>
      </div>
    </ModalBase>
  );
}
