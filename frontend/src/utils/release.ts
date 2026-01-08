import { compareVersions } from "../store";

export const REPO_SLUG = import.meta.env.VITE_GITHUB_REPO || "pbuzdygan/mopay";

export type GitHubRelease = {
  tag_name?: string | null;
  name?: string | null;
  target_commitish?: string | null;
  html_url?: string | null;
};

export type ReleaseInfo = {
  label: string;
  href?: string;
  isUpdate: boolean;
};

export function formatVersionLabel(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (/^v/i.test(trimmed)) return `v${trimmed.slice(1)}`;
  return `v${trimmed}`;
}

export function buildReleaseInfo({
  appVersion,
  latestVersion,
  latestReleaseUrl,
  updateAvailable,
}: {
  appVersion: string | null;
  latestVersion: string | null;
  latestReleaseUrl: string | null;
  updateAvailable: boolean;
}): ReleaseInfo | null {
  if (updateAvailable && latestVersion) {
    const href = latestReleaseUrl ?? (REPO_SLUG ? `https://github.com/${REPO_SLUG}/releases` : undefined);
    return {
      label: `Update available · ${formatVersionLabel(latestVersion)}`,
      href,
      isUpdate: true,
    };
  }

  if (!appVersion) {
    return { label: "Dev build", isUpdate: false };
  }

  const href = REPO_SLUG ? `https://github.com/${REPO_SLUG}/releases/tag/${appVersion.trim()}` : undefined;
  return {
    label: formatVersionLabel(appVersion),
    href,
    isUpdate: false,
  };
}

export function isDevRelease(release: GitHubRelease) {
  const tag = release.tag_name?.toLowerCase() ?? "";
  const name = release.name?.toLowerCase() ?? "";
  const branch = release.target_commitish?.toLowerCase() ?? "";
  return tag.startsWith("dev") || name.startsWith("dev") || branch === "dev";
}

export function selectReleaseForChannel(releases: GitHubRelease[], channel: string) {
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
