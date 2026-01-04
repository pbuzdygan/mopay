import { useEffect, useState } from 'react';
import { ModalBase } from './ModalBase';
import { useAppStore } from '../../store';
import { FormSection } from '../FormSection';
import { SoftButton } from '../SoftButton';

export function SettingsModal(){
  const { modals, closeModal, theme, setTheme } = useAppStore();
  const open = modals.settings;
  const nextTheme = theme === 'light' ? 'dark' : 'light';
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    if (!open) setLocking(false);
  }, [open]);

  useEffect(() => {
    if (!locking) return;
    const tm = setTimeout(() => {
      sessionStorage.removeItem('pin-ok');
      useAppStore.getState().setPinSession(false);
      closeModal('settings');
      setLocking(false);
    }, 160);
    return () => clearTimeout(tm);
  }, [locking, closeModal]);

  return (
    <ModalBase
      open={open}
      title="Settings"
      //subtitle="Tune MOPAY to your preferences."
      icon="⚙️"
      onClose={() => closeModal("settings")}
      size="md"
    >
      <div className="space-y-3 sm:space-y-4 modal-compact-mobile">
        <FormSection title="Preferences">
          <div className="settings-list">
            <div className="settings-row">
              <div className="settings-text">
                <div className="settings-title">Theme mode</div>
                <div className="settings-subtitle">Light or dark appearance.</div>
              </div>
              <button
                type="button"
                className={`settings-toggle ${theme === 'dark' ? 'is-on' : ''}`}
                aria-pressed={theme === 'dark'}
                onClick={() => setTheme(nextTheme)}
              >
                <span className="settings-toggle-track">
                  <span className="settings-toggle-label settings-toggle-label-left">Light</span>
                  <span className="settings-toggle-label settings-toggle-label-right">Dark</span>
                </span>
                <span className="settings-toggle-knob" aria-hidden="true" />
              </button>
            </div>

            <div className="settings-row">
              <div className="settings-text">
                <div className="settings-title">Lock your screen</div>
                <div className="settings-subtitle">Require PIN to continue.</div>
              </div>
              <button
                type="button"
                className={`settings-toggle settings-toggle-lock ${locking ? 'is-on' : ''}`}
                aria-pressed={locking}
                onClick={() => setLocking(true)}
              >
                <span className="settings-toggle-track">
                  <span className="settings-toggle-label settings-toggle-label-left">Lock</span>
                  <span className="settings-toggle-label settings-toggle-label-right">Locked</span>
                </span>
                <span className="settings-toggle-knob" aria-hidden="true" />
              </button>
            </div>

            <div className="settings-row">
              <div className="settings-text">
                <div className="settings-title">Language</div>
                <div className="settings-subtitle">Choose UI language.</div>
              </div>
              <div className="settings-badge">In development</div>
            </div>
          </div>
        </FormSection>

        <div className="modal-footer-premium flex justify-end">
          <SoftButton variant="ghost" onClick={()=>closeModal('settings')}>Close</SoftButton>
        </div>
      </div>
    </ModalBase>
  );
}
