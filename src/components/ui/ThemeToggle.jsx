import Icon from "@/components/ui/Icon";
import { useTheme } from "@/context/ThemeContext";
import styles from "./ThemeToggle.module.css";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className={`${styles.btn} ${className}`.trim()}
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      <span className={styles.track} data-dark={isDark}>
        <span className={styles.thumb}>
          <Icon name={isDark ? "moon" : "sun"} size={14} />
        </span>
      </span>
    </button>
  );
}
