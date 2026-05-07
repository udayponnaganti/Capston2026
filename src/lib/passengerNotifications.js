/**
 * passengerNotifications.js
 * Shared utility: converts triggered incident AI suggestions → structured
 * passenger notifications stored in localStorage as 'railtwin_passenger_notifications'.
 */

const STORAGE_KEY = 'railtwin_passenger_notifications';
const MAX_STORED  = 30;

/** Parse an AI suggestion string + alert metadata into one or more passenger notifications */
export function parseAISuggestionToNotifications(alert, workflow) {
  const sug     = alert.ai_suggestion || '';
  const title   = alert.title        || 'Service Update';
  const train   = alert.train_number || '';
  const station = alert.station      || '';
  const ts      = new Date().toISOString();
  const id      = () => `pn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const notifications = [];

  // ── ETA / Delay notifications ──────────────────────────────────────────────
  if (/revised\s*eta|updated?\s*eta|expect.*eta|running.*late|delay/i.test(sug)) {
    const delayMatch = alert.description?.match(/(\d+)\s*min/);
    const delayMins  = delayMatch ? delayMatch[1] : null;
    notifications.push({
      id: id(), ts, type: 'eta', severity: alert.severity,
      title: '🕐 Revised ETA',
      message: delayMins
        ? `${train} is running approximately ${delayMins} minutes late${station ? ` arriving at ${station}` : ''}. Please check the display boards for updated times.`
        : `${train} has a revised ETA${station ? ` at ${station}` : ''}. Check display boards for updated arrival times.`,
      train, station, alert_title: title,
    });
  }

  // ── Platform change / Alternate platform notifications ─────────────────────
  if (/alternate\s*platform|reassign.*platform|platform\s*change|different\s*platform/i.test(sug)) {
    const platformMatch = sug.match(/platform\s*(\d+|[A-Z])/i) ||
                          alert.description?.match(/platform\s*(\d+|[A-Z])/i);
    const platformNum = platformMatch ? platformMatch[1] : null;
    notifications.push({
      id: id(), ts, type: 'platform', severity: alert.severity,
      title: '🚉 Platform Change',
      message: platformNum
        ? `${train} has been reassigned to Platform ${platformNum}${station ? ` at ${station}` : ''}. Please proceed to the new platform immediately.`
        : `${train} has been reassigned to an alternate platform${station ? ` at ${station}` : ''}. Check display boards for your new platform number.`,
      train, station, alert_title: title,
      platform: platformNum,
    });
  }

  // ── Next available service ─────────────────────────────────────────────────
  if (/next\s*available\s*service|alternative\s*service|consider\s*next|next\s*train|alternate\s*route/i.test(sug)) {
    notifications.push({
      id: id(), ts, type: 'service', severity: alert.severity,
      title: '🔄 Next Available Service',
      message: `Due to disruption on ${train}${station ? ` at ${station}` : ''}, please check the Journey Planner for the next available service on this route. Additional services may be arranged.`,
      train, station, alert_title: title,
    });
  }

  // ── Passenger/boarding advisory ────────────────────────────────────────────
  if (/announce.*passenger|notify.*passenger|passenger.*information|board.*restrict|overcrowd/i.test(sug)) {
    notifications.push({
      id: id(), ts, type: 'boarding', severity: 'warning',
      title: '👥 Boarding Advisory',
      message: `${train} is approaching ${station || 'the next station'} at high capacity. Boarding may be restricted. Please allow alighting passengers off first and consider the next service if boarding is full.`,
      train, station, alert_title: title,
    });
  }

  // ── Speed / Safety advisory ────────────────────────────────────────────────
  if (/speed\s*advisory|monitor.*segment|safety\s*check|speed\s*limit/i.test(sug)) {
    notifications.push({
      id: id(), ts, type: 'safety', severity: 'warning',
      title: '⚠️ Journey Advisory',
      message: `${train} is subject to a speed restriction between ${station || 'current location'} and the next station. Slight delays may occur. Your safety is our priority.`,
      train, station, alert_title: title,
    });
  }

  // ── Staff deployment ───────────────────────────────────────────────────────
  if (/deploy.*staff|staff.*platform|additional.*staff/i.test(sug)) {
    notifications.push({
      id: id(), ts, type: 'info', severity: 'info',
      title: '🧑‍✈️ Staff Assistance',
      message: `Additional staff have been deployed${station ? ` at ${station}` : ''} to assist with the current situation. Please follow their guidance.`,
      train, station, alert_title: title,
    });
  }

  // ── Generic fallback — always add at least one notification if AI suggestion exists ──
  if (notifications.length === 0 && sug.trim().length > 0) {
    notifications.push({
      id: id(), ts, type: 'general', severity: alert.severity || 'info',
      title: '📢 Service Update',
      message: sug,
      train, station, alert_title: title,
    });
  }

  return notifications;
}

/** Save notifications to localStorage */
export function savePassengerNotifications(newNotifications) {
  try {
    const existing = getPassengerNotifications();
    const merged   = [...newNotifications, ...existing].slice(0, MAX_STORED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    // Write a trigger timestamp — this fires the 'storage' event in OTHER tabs
    // and is also picked up by same-tab polling
    localStorage.setItem('railtwin_notif_trigger', Date.now().toString());
    // Also fire custom event for same-tab listeners
    window.dispatchEvent(new CustomEvent('railtwin_notifications', { detail: { count: newNotifications.length } }));
    return merged;
  } catch (_) {
    return newNotifications;
  }
}

/** Read notifications from localStorage */
export function getPassengerNotifications() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (_) {
    return [];
  }
}

/** Clear all notifications */
export function clearPassengerNotifications() {
  localStorage.removeItem(STORAGE_KEY);
}

/** Mark a notification as read */
export function markNotificationRead(notifId) {
  try {
    const all = getPassengerNotifications();
    const updated = all.map(n => n.id === notifId ? { ...n, read: true } : n);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (_) {
    return [];
  }
}
