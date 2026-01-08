import { useAppStore } from "../store";
import { buildReleaseInfo } from "../utils/release";

type VersionIndicatorProps = {
  compact?: boolean;
};

export function VersionIndicator({ compact = false }: VersionIndicatorProps) {
  const version = useAppStore((s) => s.appVersion);
  const latestVersion = useAppStore((s) => s.latestVersion);
  const latestReleaseUrl = useAppStore((s) => s.latestReleaseUrl);
  const updateAvailable = useAppStore((s) => s.updateAvailable);

  const baseClass = ["version-indicator", compact ? "compact" : ""].filter(Boolean).join(" ");
  const releaseInfo = buildReleaseInfo({
    appVersion: version,
    latestVersion,
    latestReleaseUrl,
    updateAvailable,
  });

  if (!releaseInfo?.isUpdate) {
    return null;
  }

  const body = (
    <>
      <span className="pulse-dot" aria-hidden="true" />
      {releaseInfo.label}
    </>
  );

  return releaseInfo.href ? (
    <a className={`${baseClass} update`} href={releaseInfo.href} target="_blank" rel="noreferrer">
      {body}
    </a>
  ) : (
    <span className={`${baseClass} update`}>{body}</span>
  );
}
