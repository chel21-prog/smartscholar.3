import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/context/SessionContext";
import styles from "./NotificationBell.module.css";

// Where clicking a notification should take you, by notification_type.
// Types not listed here (General/Reminder/Other announcements, etc.) just
// mark themselves read — there's nowhere more specific to send you for a
// plain FYI announcement, so navigating would just be confusing.
const ROUTE_FOR_TYPE = {
  "Application":   "/student/applications",
  "Approval":      "/student/applications",
  "Compliance":    "/student/compliance",
  "Fund Release":  "/student/dashboard",
  "Finance":       "/student/dashboard",
};

export default function NotificationBell() {
  const { profile } = useSession();
  const navigate = useNavigate();
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
    if (!profile) return;

    let channel;

    const initialize = async () => {
      await loadNotifications();

      channel = supabase
        .channel(`notifications-${profile.user_id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications" },
          (payload) => {
            if (payload.new.user_id === profile.user_id) {
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
  }, [profile]);

  const loadNotifications = async () => {
    if (!profile) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", profile.user_id)
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

  const deleteNotification = async (id, e) => {
    e.stopPropagation(); // don't also trigger the row's click-to-open behavior
    setNotifications((prev) => prev.filter((n) => n.notification_id !== id));
    const { error } = await supabase.from("notifications").delete().eq("notification_id", id);
    if (error) {
      // Put it back if the delete didn't actually go through server-side.
      loadNotifications();
    }
  };

  const clearAll = async () => {
    const ids = notifications.map((n) => n.notification_id);
    if (ids.length === 0) return;
    setNotifications([]);
    const { error } = await supabase.from("notifications").delete().in("notification_id", ids);
    if (error) loadNotifications();
  };

  const openNotification = (n) => {
    if (!n.is_read) markRead(n.notification_id);
    const route = ROUTE_FOR_TYPE[n.notification_type];
    if (route) {
      setOpen(false);
      navigate(route);
    }
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
          <div className={styles.dropdownHead}>
            <h4 className={styles.dropdownTitle}>Notifications</h4>
            {notifications.length > 0 && (
              <button className={styles.clearAllBtn} onClick={clearAll}>Clear all</button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className={styles.empty}>You're all caught up!</p>
          ) : (
            notifications.map((n) => {
              const goesSomewhere = !!ROUTE_FOR_TYPE[n.notification_type];
              return (
                <div
                  key={n.notification_id}
                  className={`${styles.item} ${n.is_read ? "" : styles.itemUnread}`}
                  onClick={() => openNotification(n)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) =>
                    e.key === "Enter" && openNotification(n)
                  }
                >
                  <div className={styles.itemTopRow}>
                    <strong className={styles.itemTitle}>{n.title}</strong>
                    <button
                      className={styles.deleteBtn}
                      onClick={(e) => deleteNotification(n.notification_id, e)}
                      aria-label="Delete notification"
                      title="Delete notification"
                    >
                      ✕
                    </button>
                  </div>
                  <p className={styles.itemMessage}>{n.message}</p>
                  <div className={styles.itemFooterRow}>
                    <small className={styles.itemTime}>
                      {new Date(n.created_at).toLocaleString()}
                    </small>
                    {goesSomewhere && (
                      <small className={styles.itemGoTo}>View →</small>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}