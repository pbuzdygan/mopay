import { useState } from 'react';
import { useAppStore, type ThemeMode } from '../../store';
import { Dialog, Icon, Segmented } from '../ui';
import { SidebarVersion } from '../shell/Sidebar';
import { YearSwitch } from '../shell/YearSwitch';
import { SECTIONS, useShellActions, useYears } from '../shell/useShell';

// Bottom tab bar below 960 px (plan Phase 8): the four sections and More
// (Settings, working year, theme, lock and version).
export function MobileTabBar() {
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const { tab, goTo } = useShellActions();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav className="mtabs" aria-label="Primary">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            aria-current={!settingsOpen && tab === section.id ? 'page' : undefined}
            onClick={() => goTo(section.id)}
          >
            <Icon name={section.icon} />
            <span>{section.label}</span>
          </button>
        ))}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-current={settingsOpen ? 'page' : undefined}
          onClick={() => setMoreOpen(true)}
        >
          <Icon name="menu-2" />
          <span>More</span>
        </button>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const year = useAppStore((s) => s.year);
  const setYear = useAppStore((s) => s.setYear);
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const openSettings = useAppStore((s) => s.openSettings);
  const { lockSession } = useShellActions();
  const { years } = useYears();

  return (
    <Dialog open={open} title="More" size="sm" mobileAlign="bottom" onClose={onClose}>
      <ul className="more-list">
        <li>
          <button
            type="button"
            className="more-item"
            aria-labelledby="more-settings-label"
            aria-describedby="more-settings-hint"
            onClick={() => {
              onClose();
              openSettings();
            }}
          >
            <Icon name="settings" />
            <span id="more-settings-label">Settings</span>
            <small id="more-settings-hint">Years, import, export</small>
          </button>
        </li>
        <li className="more-row">
          <span className="more-label">Working year</span>
          <YearSwitch
            years={years}
            value={year}
            onChange={(next) => {
              setYear(next);
              onClose();
            }}
          />
        </li>
        <li className="more-row">
          <span className="more-label">Theme</span>
          <Segmented<ThemeMode>
            label="Theme"
            value={themeMode}
            onChange={setThemeMode}
            options={[
              { value: 'light', label: 'Light', icon: 'sun' },
              { value: 'dark', label: 'Dark', icon: 'moon-stars' },
              { value: 'system', label: 'System' },
            ]}
          />
        </li>
        <li>
          <button
            type="button"
            className="more-item"
            onClick={() => {
              onClose();
              lockSession();
            }}
          >
            <Icon name="lock" />
            <span>Lock session</span>
          </button>
        </li>
      </ul>
      <div className="more-version"><SidebarVersion /></div>
    </Dialog>
  );
}
