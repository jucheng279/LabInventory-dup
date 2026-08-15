import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Bell, BellRing, X, CalendarClock, Clock, Mail, Trash2, ToggleLeft, ToggleRight, ChevronDown, Send, Loader as Loader2, Check, CircleAlert as AlertCircle } from 'lucide-react';
import Toast from './Toast';
import { useExpirationSubscriptions } from '../hooks/useExpirationSubscriptions';
import { useExpirationNotificationPrefs } from '../hooks/useExpirationNotificationPrefs';
import { useColumnCount } from '../hooks/useColumnCount';
import { getDaysUntil, getUrgency, formatDaysLabel } from '../services/expirationService';

const DEFAULT_DIGEST_FREQUENCY = 'weekly' as const;
const DEFAULT_ALERT_DAYS_BEFORE = 30;
const DEFAULT_ALERT_REPEAT_INTERVAL = 1;
const DEFAULT_ALERT_REPEAT_UNIT = 'weeks' as const;

function getStatusInfo(expirationDate: string) {
  const days = getDaysUntil(expirationDate);
  const urgency = getUrgency(days);
  if (urgency === 'expired') return { label: 'Expired', color: 'text-red-600 bg-red-50 border-red-100', days };
  if (urgency === 'week') return { label: formatDaysLabel(days), color: 'text-orange-600 bg-orange-50 border-orange-100', days };
  if (urgency === 'month') return { label: formatDaysLabel(days), color: 'text-amber-600 bg-amber-50 border-amber-100', days };
  if (urgency === 'quarter') return { label: formatDaysLabel(days), color: 'text-yellow-700 bg-yellow-50 border-yellow-100', days };
  return { label: formatDaysLabel(days), color: 'text-emerald-600 bg-emerald-50 border-emerald-100', days };
}

function isValidPositiveInt(val: string): boolean {
  if (val.trim() === '') return false;
  const n = parseInt(val, 10);
  return !isNaN(n) && n > 0 && String(n) === val.trim();
}

const ExpirationSubscriptionsPanel: React.FC = () => {
  const { subscriptions, isLoading, removeSubscription } = useExpirationSubscriptions();
  const {
    preferences, updatePreferences, isSaving,
    sendDigestNow, isSendingDigest, sendDigestSuccess, sendDigestError, resetSendDigest,
  } = useExpirationNotificationPrefs();

  const [showDigestSettings, setShowDigestSettings] = useState(() => window.innerWidth >= 768);
  const [showAlertSettings, setShowAlertSettings] = useState(() => window.innerWidth >= 768);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (sendDigestSuccess) {
      setToast({ message: 'Expiration report sent to your email!', type: 'success' });
    }
  }, [sendDigestSuccess]);

  useEffect(() => {
    if (sendDigestError) {
      const detail = sendDigestError instanceof Error ? sendDigestError.message : 'Unknown error';
      setToast({ message: `Failed to send report: ${detail}`, type: 'error' });
    }
  }, [sendDigestError]);

  const containerRef = useRef<HTMLDivElement>(null);
  const colCount = useColumnCount(containerRef);

  const digestEnabled = preferences?.digest_enabled ?? false;
  const alertEnabled = preferences?.alert_enabled ?? false;

  const [draftDigestFrequency, setDraftDigestFrequency] = useState<'weekly' | 'monthly'>(
    preferences?.digest_frequency ?? DEFAULT_DIGEST_FREQUENCY
  );

  const [draftAlertDaysBefore, setDraftAlertDaysBefore] = useState<string>(
    String(preferences?.alert_days_before ?? DEFAULT_ALERT_DAYS_BEFORE)
  );
  const [draftAlertRepeatInterval, setDraftAlertRepeatInterval] = useState<string>(
    String(preferences?.alert_repeat_interval ?? DEFAULT_ALERT_REPEAT_INTERVAL)
  );
  const [draftAlertRepeatUnit, setDraftAlertRepeatUnit] = useState<'days' | 'weeks' | 'months'>(
    preferences?.alert_repeat_unit ?? DEFAULT_ALERT_REPEAT_UNIT
  );

  const [digestError, setDigestError] = useState(false);
  const [alertDaysError, setAlertDaysError] = useState(false);
  const [alertIntervalError, setAlertIntervalError] = useState(false);

  useEffect(() => {
    if (preferences) {
      setDraftDigestFrequency(preferences.digest_frequency ?? DEFAULT_DIGEST_FREQUENCY);
      setDraftAlertDaysBefore(String(preferences.alert_days_before ?? DEFAULT_ALERT_DAYS_BEFORE));
      setDraftAlertRepeatInterval(String(preferences.alert_repeat_interval ?? DEFAULT_ALERT_REPEAT_INTERVAL));
      setDraftAlertRepeatUnit(preferences.alert_repeat_unit ?? DEFAULT_ALERT_REPEAT_UNIT);
    }
  }, [preferences]);

  const handleDigestToggle = () => {
    if (digestEnabled) {
      updatePreferences({ digest_enabled: false });
      setDigestError(false);
    } else {
      updatePreferences({ digest_enabled: true, digest_frequency: draftDigestFrequency });
    }
  };

  const handleAlertToggle = () => {
    if (alertEnabled) {
      updatePreferences({ alert_enabled: false });
      setAlertDaysError(false);
      setAlertIntervalError(false);
    } else {
      const daysValid = isValidPositiveInt(draftAlertDaysBefore);
      const intervalValid = isValidPositiveInt(draftAlertRepeatInterval);
      setAlertDaysError(!daysValid);
      setAlertIntervalError(!intervalValid);
      if (!daysValid || !intervalValid) return;
      updatePreferences({
        alert_enabled: true,
        alert_days_before: parseInt(draftAlertDaysBefore, 10),
        alert_repeat_interval: parseInt(draftAlertRepeatInterval, 10),
        alert_repeat_unit: draftAlertRepeatUnit,
      });
    }
  };

  const columns = useMemo(() => {
    const cols: typeof subscriptions[] = Array.from({ length: colCount }, () => []);
    subscriptions.forEach((sub, i) => {
      cols[i % colCount].push(sub);
    });
    return cols;
  }, [subscriptions, colCount]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="animate-pulse text-gray-400 text-sm">Loading subscriptions...</div>
      </div>
    );
  }

  return (<>
    <div className="flex-1 overflow-y-auto" ref={containerRef} style={{ containerType: 'inline-size' }}>
      {/* Notification Options */}
      <div className="px-6 py-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Notification Settings</h2>

        <div className={`flex gap-3 ${colCount >= 2 ? 'flex-row' : 'flex-col'}`}>
        {/* Option 1: Digest Report */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden flex-1 min-w-0">
          <button
            onClick={() => setShowDigestSettings(!showDigestSettings)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Mail size={16} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">Digest Report</div>
              <div className="text-xs text-gray-500">One email with all your subscribed items</div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDigestToggle();
              }}
              disabled={isSaving}
              className="flex-shrink-0"
            >
              {digestEnabled ? (
                <ToggleRight size={28} className="text-teal-500" />
              ) : (
                <ToggleLeft size={28} className="text-gray-300" />
              )}
            </button>
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${showDigestSettings ? 'rotate-180' : ''}`} />
          </button>

          {showDigestSettings && (
            <div className="px-4 pb-3 pt-1 border-t border-gray-100">
              <div className="flex items-center gap-3 mt-2">
                <label className="text-xs text-gray-600">Frequency:</label>
                <select
                  value={draftDigestFrequency}
                  onChange={(e) => setDraftDigestFrequency(e.target.value as 'weekly' | 'monthly')}
                  disabled={digestEnabled || isSaving}
                  className={`text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                    digestEnabled ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed' : 'border-gray-200'
                  } ${digestError ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                >
                  <option value="weekly">Every week</option>
                  <option value="monthly">Every month</option>
                </select>
              </div>
              {digestEnabled && subscriptions.length > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => {
                      resetSendDigest();
                      sendDigestNow();
                    }}
                    disabled={isSendingDigest}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 active:bg-teal-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSendingDigest ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Send size={13} />
                    )}
                    {isSendingDigest ? 'Sending...' : 'Send Report Now'}
                  </button>
                  {sendDigestSuccess && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                      <Check size={13} /> Sent!
                    </span>
                  )}
                  {sendDigestError && (
                    <span className="inline-flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle size={13} /> Failed to send
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Option 2: Proximity Alert */}

        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden flex-1 min-w-0">
          <button
            onClick={() => setShowAlertSettings(!showAlertSettings)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Mail size={16} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">Proximity Alert</div>
              <div className="text-xs text-gray-500">Get notified when items are close to expiring</div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAlertToggle();
              }}
              disabled={isSaving}
              className="flex-shrink-0"
            >
              {alertEnabled ? (
                <ToggleRight size={28} className="text-teal-500" />
              ) : (
                <ToggleLeft size={28} className="text-gray-300" />
              )}
            </button>
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${showAlertSettings ? 'rotate-180' : ''}`} />
          </button>

          {showAlertSettings && (
            <div className="px-4 pb-3 pt-1 border-t border-gray-100 space-y-3">
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <label className="text-xs text-gray-600">Start alerting</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={draftAlertDaysBefore}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, '');
                    setDraftAlertDaysBefore(v);
                    if (alertDaysError && isValidPositiveInt(v)) setAlertDaysError(false);
                  }}
                  disabled={alertEnabled || isSaving}
                  className={`w-16 text-sm border rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                    alertEnabled ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed' : 'border-gray-200'
                  } ${alertDaysError ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                />
                <label className="text-xs text-gray-600">days before expiration</label>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-xs text-gray-600">Then repeat every</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={draftAlertRepeatInterval}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, '');
                    setDraftAlertRepeatInterval(v);
                    if (alertIntervalError && isValidPositiveInt(v)) setAlertIntervalError(false);
                  }}
                  disabled={alertEnabled || isSaving}
                  className={`w-14 text-sm border rounded-lg px-2 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                    alertEnabled ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed' : 'border-gray-200'
                  } ${alertIntervalError ? 'border-red-400 ring-1 ring-red-300' : ''}`}
                />
                <select
                  value={draftAlertRepeatUnit}
                  onChange={(e) => setDraftAlertRepeatUnit(e.target.value as 'days' | 'weeks' | 'months')}
                  disabled={alertEnabled || isSaving}
                  className={`text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-400 ${
                    alertEnabled ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed' : 'border-gray-200'
                  }`}
                >
                  <option value="days">days</option>
                  <option value="weeks">weeks</option>
                  <option value="months">months</option>
                </select>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Subscribed Items List */}
      <div className="px-6 pb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Subscribed Items ({subscriptions.length})
          </h2>
        </div>

        {subscriptions.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <Bell size={24} className="text-amber-600" />
            </div>
            <p className="text-sm text-gray-500 font-medium">No subscribed items</p>
            <p className="text-xs text-gray-400 mt-1">
              Subscribe to items from the Inventory list using the bell icon on expiration rows
            </p>
          </div>
        ) : (
          <div className="flex gap-2">
            {columns.map((col, ci) => (
              <div key={ci} className="flex-1 min-w-0 flex flex-col gap-2">
                {col.map((sub) => {
                  const status = getStatusInfo(sub.expiration_date);
                  return (
                    <div
                      key={sub.id}
                      className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition-colors"
                    >
                      <div className="flex-shrink-0">
                        <BellRing size={16} className="text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{sub.item_name}</div>
                        {sub.item_info && (
                          <div className="text-[11px] text-gray-400 truncate mt-0.5">{sub.item_info}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-xs text-gray-500 tabular-nums">
                            {sub.expiration_date}
                          </span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                        <button
                          onClick={() => removeSubscription(sub.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
                          title="Remove subscription"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    {toast && (
      <Toast
        message={toast.message}
        type={toast.type}
        duration={toast.type === 'error' ? 8000 : 3000}
        onClose={() => setToast(null)}
      />
    )}
  </>
  );
};

export default ExpirationSubscriptionsPanel;
