import { useTheme } from "@/context/ThemeContext";
import styles from "./ThemeToggle.module.css";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className={styles.btn}
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      <span className={styles.track} data-dark={isDark}>
        <span className={styles.thumb}>
          {isDark ? "🌙" : "☀️"}
        </span>
      </span>
    </button>
  );
}
