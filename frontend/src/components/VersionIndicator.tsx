import { useEffect } from "react";
import { useAppStore } from "../store";
import { Api } from "../api";

const POLL_INTERVAL_MS = 1000 * 60 * 60 * 6; // 6 hours
const REPO_SLUG = import.meta.env.VITE_GITHUB_REPO || "pbuzdygan/mopay";

type VersionIndicatorProps = {
  compact?: boolean;
};

export function VersionIndicator({ compact = false }: VersionIndicatorProps) {
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

  const baseClass = ["version-indicator", compact ? "compact" : ""].filter(Boolean).join(" ");

  if (updateAvailable && latestVersion) {
    const href = REPO_SLUG ? `https://github.com/${REPO_SLUG}/releases/latest` : "#";
    return (
      <a
        href={href}
        className={`${baseClass} update link`}
        target="_blank"
        rel="noreferrer"
        title={`Update available (${latestVersion})`}
      >
        <span className="pulse-dot" aria-hidden="true" />
        Update {formatVersion(latestVersion)}
      </a>
    );
  }

  if (!version) {
    return (
      <span className={baseClass}>
        <span className="status-dot" aria-hidden="true" />
        Dev build
      </span>
    );
  }

  const href = REPO_SLUG ? `https://github.com/${REPO_SLUG}/releases/tag/${formatVersion(version)}` : undefined;

  const body = (
    <>
      <span className="status-dot" aria-hidden="true" />
      Version {formatVersion(version)}
    </>
  );

  return href ? (
    <a className={`${baseClass} link`} href={href} target="_blank" rel="noreferrer" title={`Release ${version}`}>
      {body}
    </a>
  ) : (
    <span className={baseClass}>{body}</span>
  );
}

function formatVersion(value: string) {
  return value.startsWith("v") ? value : `v${value}`;
}
