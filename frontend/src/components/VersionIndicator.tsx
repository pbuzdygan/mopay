import { useEffect } from "react";
import { useAppStore } from "../store";
import { Api } from "../api";

const POLL_INTERVAL_MS = 1000 * 60 * 60 * 6; // 6 hours
const REPO_SLUG = import.meta.env.VITE_GITHUB_REPO || "pbuzdygan/mopay";

export function VersionIndicator() {
  const version = useAppStore((s) => s.appVersion);
  const latestVersion = useAppStore((s) => s.latestVersion);
  const updateAvailable = useAppStore((s) => s.updateAvailable);
  const setAppVersion = useAppStore((s) => s.setAppVersion);
  const setLatestVersion = useAppStore((s) => s.setLatestVersion);

  useEffect(() => {
    let cancelled = false;
    const loadMeta = async () => {
      try {
        const meta = await Api.meta();
        if (!cancelled) {
          setAppVersion(meta?.version ?? null);
        }
      } catch {
        // ignore – keep previous value
      }
    };
    loadMeta();
    return () => {
      cancelled = true;
    };
  }, [setAppVersion]);

  useEffect(() => {
    if (!REPO_SLUG) return;
    let cancelled = false;

    const fetchLatest = async () => {
      try {
        const res = await fetch(`https://api.github.com/repos/${REPO_SLUG}/releases/latest`, {
          headers: { Accept: "application/vnd.github+json" },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setLatestVersion(data?.tag_name ?? data?.name ?? null);
        }
      } catch {
        // ignore – will retry on next interval
      }
    };

    fetchLatest();
    const interval = window.setInterval(fetchLatest, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [setLatestVersion]);

  if (updateAvailable && latestVersion) {
    const href = REPO_SLUG ? `https://github.com/${REPO_SLUG}/releases/latest` : "#";
    return (
      <a
        href={href}
        className="version-indicator update"
        target="_blank"
        rel="noreferrer"
        title={`Update available (${latestVersion})`}
      >
        <span className="pulse-dot" aria-hidden="true" />
        Update available · {formatVersion(latestVersion)}
      </a>
    );
  }

  if (!version) {
    return <span className="version-indicator muted">dev build</span>;
  }

  return <span className="version-indicator muted">{formatVersion(version)}</span>;
}

function formatVersion(value: string) {
  return value.startsWith("v") ? value : `v${value}`;
}
