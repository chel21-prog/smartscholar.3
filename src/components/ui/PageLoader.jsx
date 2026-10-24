import { SkeletonPage, SkeletonShell, SkeletonForm } from "./Skeleton";
import sk from "./Skeleton.module.css";

/**
 * Loading state for pages, guards and modals — rendered as a skeleton that
 * mirrors the real layout instead of a spinner. The `label` stays available
 * to screen readers.
 *
 * variant: "page" (default: title + 4 stat cards + table) | "cards" | "form"
 *          | "screen" (full app frame: sidebar + page, for session / guard checks)
 * size:    "md" (default, full page) | "sm" (inside modals / cards — compact form)
 */
export default function PageLoader({ label = "Loading…", size = "md", variant = "page" }) {
  let content;
  if (size === "sm" || variant === "form") {
    content = <div style={{ padding: "var(--space-4) 0" }}><SkeletonForm fields={size === "sm" ? 3 : 5} /></div>;
  } else if (variant === "screen") {
    content = <SkeletonShell />;
  } else if (variant === "cards") {
    content = <SkeletonPage variant="cards" stats={0} />;
  } else {
    content = <SkeletonPage variant="table" />;
  }

  return (
    <div role="status" aria-live="polite" aria-busy="true" style={{ width: "100%", display: "flex", flex: 1 }}>
      <span className={sk.srOnly}>{label}</span>
      {content}
    </div>
  );
}
