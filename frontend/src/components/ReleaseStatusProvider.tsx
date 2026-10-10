import { useEffect } from "react";
import { useAppStore } from "../store";
import { REPO_SLUG, selectReleaseForChannel, type GitHubRelease } from "../utils/release";

const POLL_INTERVAL_MS = 1000 * 60 * 60 * 6; // 6 hours

export function ReleaseStatusProvider() {
  const releaseChannel = useAppStore((s) => s.releaseChannel);
  const setLatestVersion = useAppStore((s) => s.setLatestVersion);
  const setLatestReleaseUrl = useAppStore((s) => s.setLatestReleaseUrl);
  // Settings → About can ask for another check ("Check again").
  const checkRequest = useAppStore((s) => s.releaseCheck.request);
  const setReleaseCheck = useAppStore((s) => s.setReleaseCheck);

  useEffect(() => {
    if (!REPO_SLUG || !releaseChannel) return;
    let cancelled = false;

    const fetchLatest = async () => {
      setReleaseCheck('checking');
      try {
        const res = await fetch(`https://api.github.com/repos/${REPO_SLUG}/releases?per_page=30`, {
          headers: { Accept: "application/vnd.github+json" },
        });
        if (!res.ok) throw new Error('Release check failed');
        const data = (await res.json()) as GitHubRelease[];
        if (!Array.isArray(data)) throw new Error('Unexpected release list');
        const release = selectReleaseForChannel(data, releaseChannel);
        if (!cancelled) {
          if (release) {
            setLatestVersion(release.tag_name ?? release.name ?? null);
            setLatestReleaseUrl(release.html_url ?? null);
          } else {
            setLatestVersion(null);
            setLatestReleaseUrl(null);
          }
          setReleaseCheck('done');
        }
      } catch {
        // Shown in Settings → About; the next interval retries.
        if (!cancelled) setReleaseCheck('failed');
      }
    };

    setLatestReleaseUrl(null);
    fetchLatest();
    const interval = window.setInterval(fetchLatest, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [releaseChannel, checkRequest, setLatestReleaseUrl, setLatestVersion, setReleaseCheck]);

  return null;
}
