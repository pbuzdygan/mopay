import { ModalBase } from './ModalBase';
import { useAppStore } from '../../store';
import { FormSection } from '../FormSection';
import { SoftButton } from '../SoftButton';

export function SettingsModal(){
  const { modals, closeModal, theme, setTheme } = useAppStore();
  const open = modals.settings;
  const nextTheme = theme === 'light' ? 'dark' : 'light';

  return (
    <ModalBase
      open={open}
      title="Settings"
      //subtitle="Tune MOPAY to your preferences."
      icon="⚙️"
      onClose={() => closeModal("settings")}
      size="md"
    >
      <div className="space-y-3 sm:space-y-4">
        <FormSection
          //label="Appearance"
          title="Theme mode"
          //description="Switch between light and dark."
        >
          <div className="flex flex-col gap-2">
            <p className="field-helper">
              Current: <span className="font-medium text-textPrim">{theme}</span>
            </p>
            <SoftButton
              block
              justify="between"
              onClick={()=> setTheme(nextTheme)}
            >
              Switch to {nextTheme}
              <span className="text-lg">{nextTheme === 'dark' ? '🌙' : '☀️'}</span>
            </SoftButton>
          </div>
        </FormSection>

        <FormSection
          //label="Session"
          title="Lock Your screen"
          //description="Clear PIN session and show lock screen."
        >
          <SoftButton
            block
            justify="between"
            onClick={() => {
              sessionStorage.removeItem('pin-ok');
              useAppStore.getState().setPinSession(false);
              closeModal('settings');
            }}
          >
            Lock application
            <span className="text-lg" role="img" aria-hidden="true">🔒</span>
          </SoftButton>
        </FormSection>

        <div className="modal-footer-premium flex justify-end">
          <SoftButton variant="ghost" onClick={()=>closeModal('settings')}>Close</SoftButton>
        </div>
      </div>
    </ModalBase>
  );
}
