import { useEffect } from "react";
import { useAppStore } from "../store";
import { REPO_SLUG, selectReleaseForChannel, type GitHubRelease } from "../utils/release";

const POLL_INTERVAL_MS = 1000 * 60 * 60 * 6; // 6 hours

export function ReleaseStatusProvider() {
  const releaseChannel = useAppStore((s) => s.releaseChannel);
  const setLatestVersion = useAppStore((s) => s.setLatestVersion);
  const setLatestReleaseUrl = useAppStore((s) => s.setLatestReleaseUrl);

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
  }, [releaseChannel, setLatestReleaseUrl, setLatestVersion]);

  return null;
}
