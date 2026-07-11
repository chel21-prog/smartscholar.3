import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./NotificationBell.module.css";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null); // { top, left, width }
  const boxRef = useRef();
  const bellRef = useRef();

  // Recompute where the dropdown should render, clamped to the viewport,
  // every time it opens and on resize/scroll while it's open. This is what
  // makes it immune to being clipped by an ancestor's overflow:hidden or
  // running off the edge of the screen — position:fixed + real coordinates
  // beats position:absolute here.
  const updatePosition = () => {
    const bell = bellRef.current;
    if (!bell) return;

    const rect = bell.getBoundingClientRect();
    const margin = 16;
    const width = Math.min(360, window.innerWidth - margin * 2);

    // Anchor to the bell's right edge, but never let the box's left edge
    // go past the screen edge.
    let left = rect.right - width;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));

    let top = rect.bottom + 8;
    const maxHeight = 420;
    // If there isn't room below, flip the dropdown above the bell instead.
    if (top + maxHeight > window.innerHeight - margin) {
      const spaceAbove = rect.top - margin;
      if (spaceAbove > window.innerHeight - top) {
        top = Math.max(margin, rect.top - 8 - Math.min(maxHeight, spaceAbove));
      }
    }

    setPos({ top, left, width });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();

    const onViewportChange = () => updatePosition();
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [open]);

  useEffect(() => {
    let channel;

    const initialize = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: dbUser } = await supabase
        .from("users")
        .select("user_id")
        .eq("auth_id", user.id)
        .single();

      if (!dbUser) return;

      await loadNotifications();

      channel = supabase
        .channel(`notifications-${dbUser.user_id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications" },
          (payload) => {
            if (payload.new.user_id === dbUser.user_id) {
              loadNotifications();
            }
          }
        )
        .subscribe();
    };

    initialize();

    const handleClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    window.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("click", handleClick);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const loadNotifications = async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) return;

    const { data: dbUser, error: userError } = await supabase
      .from("users")
      .select("user_id")
      .eq("auth_id", user.id)
      .single();

    if (userError || !dbUser) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", dbUser.user_id)
      .order("created_at", { ascending: false });

    if (error) return;

    setNotifications(data || []);
  };

  const unread = notifications.filter((n) => !n.is_read).length;

  const markRead = async (id) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("notification_id", id);

    setNotifications((prev) =>
      prev.map((n) =>
        n.notification_id === id ? { ...n, is_read: true } : n
      )
    );
  };

  return (
    <div ref={boxRef} className={styles.wrapper}>
      <button
        ref={bellRef}
        className={styles.bell}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        aria-expanded={open}
      >
        🔔
        {unread > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && pos && (
        <div
          className={styles.dropdown}
          role="region"
          aria-label="Notifications"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <h4 className={styles.dropdownTitle}>Notifications</h4>

          {notifications.length === 0 ? (
            <p className={styles.empty}>You're all caught up!</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.notification_id}
                className={`${styles.item} ${n.is_read ? "" : styles.itemUnread}`}
                onClick={() => markRead(n.notification_id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === "Enter" && markRead(n.notification_id)
                }
              >
                <strong className={styles.itemTitle}>{n.title}</strong>
                <p className={styles.itemMessage}>{n.message}</p>
                <small className={styles.itemTime}>
                  {new Date(n.created_at).toLocaleString()}
                </small>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}