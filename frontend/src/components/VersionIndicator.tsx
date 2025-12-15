import { useEffect, useState } from "react";
import { useAppStore, compareVersions } from "../store";
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
  const releaseChannel = useAppStore((s) => s.releaseChannel);
  const setAppVersion = useAppStore((s) => s.setAppVersion);
  const setLatestVersion = useAppStore((s) => s.setLatestVersion);
  const setReleaseChannel = useAppStore((s) => s.setReleaseChannel);
  const [latestReleaseUrl, setLatestReleaseUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadMeta = async () => {
      try {
        const meta = await Api.meta();
        if (!cancelled) {
          setAppVersion(meta?.version ?? null);
          setReleaseChannel(meta?.channel ?? "main");
        }
      } catch {
        // ignore – keep previous value
      }
    };
    loadMeta();
    return () => {
      cancelled = true;
    };
  }, [setAppVersion, setReleaseChannel]);

  useEffect(() => {
    if (!REPO_SLUG || !releaseChannel) return;
    let cancelled = false;

    const fetchLatest = async () => {
      try {
        const res = await fetch(`https://api.github.com/repos/${REPO_SLUG}/releases?per_page=30`, {
          headers: { Accept: "application/vnd.github+json" },
        });
        if (!res.ok) return;
        const data = (await res.json()) as GitHubRelease[];
        if (!Array.isArray(data)) return;
        const release = selectReleaseForChannel(data, releaseChannel);
        if (!cancelled) {
          if (release) {
            setLatestVersion(release.tag_name ?? release.name ?? null);
            setLatestReleaseUrl(release.html_url ?? null);
          } else {
            setLatestVersion(null);
            setLatestReleaseUrl(null);
          }
        }
      } catch {
        // ignore – will retry on next interval
      }
    };

    setLatestReleaseUrl(null);
    fetchLatest();
    const interval = window.setInterval(fetchLatest, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [releaseChannel, setLatestVersion]);

  const baseClass = ["version-indicator", compact ? "compact" : ""].filter(Boolean).join(" ");

  if (updateAvailable && latestVersion) {
    const href = latestReleaseUrl ?? (REPO_SLUG ? `https://github.com/${REPO_SLUG}/releases` : "#");
    return (
      <a
        href={href}
        className={`${baseClass} update`}
        target="_blank"
        rel="noreferrer"
      >
        <span className="pulse-dot" aria-hidden="true" />
        Update available · {formatVersion(latestVersion)}
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
      Build {formatVersion(version)}
    </>
  );

  return href ? (
    <a className={baseClass} href={href} target="_blank" rel="noreferrer">
      {body}
    </a>
  ) : (
    <span className={baseClass}>{body}</span>
  );
}

function formatVersion(value: string) {
  return value;
}

type GitHubRelease = {
  tag_name?: string | null;
  name?: string | null;
  target_commitish?: string | null;
  html_url?: string | null;
};

function isDevRelease(release: GitHubRelease) {
  const tag = release.tag_name?.toLowerCase() ?? "";
  const name = release.name?.toLowerCase() ?? "";
  const branch = release.target_commitish?.toLowerCase() ?? "";
  return tag.startsWith("dev") || name.startsWith("dev") || branch === "dev";
}

function selectReleaseForChannel(releases: GitHubRelease[], channel: string) {
  if (!releases.length) return null;
  const normalized = (channel || "main").toLowerCase();
  const predicate =
    normalized === "dev"
      ? (release: GitHubRelease) => isDevRelease(release)
      : (release: GitHubRelease) => !isDevRelease(release);
  const candidates = releases.filter(predicate);
  if (!candidates.length) {
    return releases[0];
  }
  candidates.sort((a, b) => compareVersions(releaseVersion(b), releaseVersion(a)));
  return candidates[0];
}

function releaseVersion(release: GitHubRelease) {
  return release.tag_name ?? release.name ?? null;
}
