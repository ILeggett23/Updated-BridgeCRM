import { createBridgeFrontendFoundation } from "./ui-foundation.js?v=1.3.24";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const { archiveInactiveContacts, hasConversationInRange, latestConversationTime, matchesVisibilityFilter, normalizePipelineStages, resolveCurrentPipelineStage, restoreContact, setFilteredOut, sortContacts } = globalThis.BridgeLogic;
const { dailyGoalMetrics, dayKey, definitions: ACHIEVEMENTS, dueReminderEvents, evaluateAchievements, normalizeExcludedDates, normalizeRestRules, todaySwipeDecision } = globalThis.BridgeEngagement;
const { analyticsRange, buildInsightsModel, inAnalyticsRange, uniquePhoneCaptures } = globalThis.BridgeAnalytics;
const { canonicalPhone, phoneIdentity, telHref, smsHref } = globalThis.BridgeCommunication;
const { createSnapshot, scorecardSummary } = globalThis.BridgeScorecard || {};
const { APP_RELEASE, markReleaseSeen } = globalThis.BridgeRelease;
const {
  DEFAULT_CADENCE_PRESETS,
  FORMULA_VERSION: HEALTH_FORMULA_VERSION,
  calendarDaysBetween,
  normalizeAnalyticsState,
  normalizeCadencePresets,
  recordHealthEvents,
  scoreContact,
  scoreContacts,
  summarizeHealth
} = globalThis.BridgeRelationshipHealth;
const { buildNetworkModel } = globalThis.BridgeNetwork;
const bridgeStyles = $$('link[data-bridge-styles]');
if (bridgeStyles.length > 1) {
  const styleVersion = link => String(new URL(link.href).searchParams.get("v") || "").replace(/^v/, "").split(".").map(value => Number(value) || 0);
  const compareVersions = (left, right) => {
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      if ((left[index] || 0) !== (right[index] || 0)) return (left[index] || 0) - (right[index] || 0);
    }
    return 0;
  };
  const currentStyle = bridgeStyles.reduce((latest, link) => compareVersions(styleVersion(link), styleVersion(latest)) > 0 ? link : latest);
  bridgeStyles.forEach(link => { if (link !== currentStyle) link.remove(); });
}
const uid = () => globalThis.crypto?.randomUUID?.() || `bridge-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const nowISO = () => new Date().toISOString();
const todayInput = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const escapeHTML = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const initials = name => (name || "?").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
const localCache = {
  get() { try { return window.localStorage.getItem("bridge-crm-cache"); } catch { return null; } },
  set(value) { try { window.localStorage.setItem("bridge-crm-cache", value); } catch {} }
};
const durableCache = {
  open() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("IndexedDB unavailable"));
      const request = indexedDB.open("bridge-crm", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("state");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  async get() {
    try {
      const database = await this.open();
      return await new Promise((resolve, reject) => {
        const request = database.transaction("state", "readonly").objectStore("state").get("primary");
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch { return null; }
  },
  async set(value) {
    try {
      const database = await this.open();
      await new Promise((resolve, reject) => {
        const transaction = database.transaction("state", "readwrite");
        transaction.objectStore("state").put(value, "primary");
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
    } catch {}
  }
};

const PIPELINES = {
  Prospect: ["PQI", "QI/P", "FUP", "LA"],
  Customer: ["CNA", "Proposal", "Follow-Up", "Order Placed", "Active Customer"],
  Team: []
};
const PROSPECT_STAGE_DESCRIPTIONS = {
  PQI: "Prospect qualified interest",
  "QI/P": "Qualified interest / presentation",
  FUP: "Follow-up in progress",
  LA: "Launch"
};
const CUSTOMER_STAGE_DESCRIPTIONS = {
  CNA: "Customer needs assessment",
  Proposal: "Proposal shared",
  "Follow-Up": "Decision follow-up",
  "Order Placed": "Order placed",
  "Active Customer": "Active customer"
};
const PIPELINE_STALL_DAYS = 21;
const LEGACY_PIPELINE_ALIASES = {
  Customer: {
    Recommendation: "Proposal",
    "Decision / Follow-Up": "Follow-Up",
    "Customer Onboarding": "Active Customer",
    "Reorder / Retention": "Active Customer"
  }
};
const LEGACY_PIPELINE_STAGES = Object.values(LEGACY_PIPELINE_ALIASES).flatMap(aliases => Object.keys(aliases));
const PIPELINE_STAGES = [...new Set([...PIPELINES.Prospect, ...PIPELINES.Customer])];
const ALL_STAGES = ["MSA", "DTM", ...new Set([...PIPELINE_STAGES, ...LEGACY_PIPELINE_STAGES])];
const CONVERSATION_TYPES = ["Prospecting", "Product Discussion", "Sampling", "Team-Check In", "Follow-Up", "Other"];
const INTERESTS = ["Unsure", "Low", "Medium", "High"];
const CALL_OUTCOMES = ["Connected", "No answer", "Left voicemail", "Busy", "Wrong number", "Follow-up needed"];
const TEXT_OUTCOMES = ["Text sent", "Response received", "No response", "Follow-up needed", "Other"];
const COMMUNICATION_DIRECTIONS = ["Outgoing", "Incoming"];

const icon = (content, options = "") => `<svg class="app-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${options}>${content}</svg>`;
const icons = {
  home: icon('<path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/>'),
  people: icon('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>'),
  plus: icon('<path d="M12 5v14M5 12h14"/>'),
  bell: icon('<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>'),
  chart: icon('<line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>'),
  gear: icon('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'),
  search: icon('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>'),
  calendar: icon('<path d="M8 2v4M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>'),
  calendarCheck: icon('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>'),
  calendarPlus: icon('<path d="M16 19h6"/><path d="M16 2v4"/><path d="M19 16v6"/><path d="M21 12.598V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8.5"/><path d="M3 10h18"/><path d="M8 2v4"/>'),
  check: icon('<path d="M20 6 9 17l-5-5"/>'),
  circleCheck: icon('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'),
  userPlus: icon('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>'),
  contactCard: icon('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2.5"/><path d="M5.5 16a3.5 3.5 0 0 1 7 0M15 8h3M15 12h3M15 16h2"/>'),
  flag: icon('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>'),
  fire: icon('<path d="M12 22c4.4 0 8-3.6 8-8 0-3-1.5-5.4-4.5-7.5.2 3-1.5 4.5-3 5-1-4-3.5-7-6-8.5.5 4-2.5 6-2.5 10.5C4 18.2 7.6 22 12 22Z"/>'),
  warning: icon('<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>'),
  clock: icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  download: icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
  close: icon('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  trash: icon('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/>'),
  pencil: icon('<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>'),
  penLine: icon('<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>'),
  pencilLine: icon('<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/><path d="m15 5 3 3"/>'),
  location: icon('<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'),
  star: icon('<path d="m12 2.7 2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.51l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.94Z"/>', 'fill="currentColor"'),
  award: icon('<circle cx="12" cy="8" r="6"/><path d="M15.48 12.64 17 22l-5-3-5 3 1.52-9.36"/>'),
  target: icon('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
  chat: icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  messages: icon('<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>'),
  phone: icon('<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>'),
  phoneCall: icon('<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>'),
  mail: icon('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'),
  bridge: icon('<path d="M3 18c2-7 5-10 9-10s7 3 9 10M3 18h18M6 18v3M18 18v3M8.5 10.5V18M15.5 10.5V18"/>'),
  sort: icon('<path d="m3 8 4-4 4 4M7 4v16M21 16l-4 4-4-4M17 20V4"/>'),
  tags: icon('<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414L10 20l10-10Z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/><path d="m13.5 6.5 4 4"/>'),
  archive: icon('<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>'),
  link: icon('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
  share: icon('<path d="M12 16V3"/><path d="m7 8 5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'),
  network: icon('<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>'),
  trophy: icon('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/>'),
  sparkles: icon('<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>'),
  rocket: icon('<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.7 12.7 0 0 1 22 2c0 2.72-.78 7.5-6.05 11a22 22 0 0 1-3.95 2Z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/><circle cx="16" cy="8" r="1"/>'),
  handshake: icon('<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>'),
  chevronDown: icon('<path d="m6 9 6 6 6-6"/>'),
  chevronLeft: icon('<path d="m15 18-6-6 6-6"/>'),
  chevronRight: icon('<path d="m9 18 6-6-6-6"/>'),
  note: icon('<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/><path d="m15 5 3 3"/>'),
  arrowUpRight: icon('<path d="M7 7h10v10"/><path d="M7 17 17 7"/>'),
  package: icon('<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m7.5 4.27 9 5.15"/>'),
  pulse: icon('<path d="M3 12h4l2-5 4 10 2-5h6"/>'),
  arrowUp: icon('<path d="m6 15 6-6 6 6"/>'),
  arrowDown: icon('<path d="m6 9 6 6 6-6"/>'),
  sliders: icon('<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="13" cy="18" r="2"/>')
};

const defaultState = () => ({
  contacts: [],
  places: [],
  settings: {
    name: "",
    firstName: "",
    lastName: "",
    businessName: "",
    dailyGoal: 5,
    weeklyGoal: 25,
    monthlyGoal: 100,
    defaultFollowUpDays: 2,
    weekStart: 0,
    showConversionPercentages: true,
    autoArchiveInactive: false,
    notificationsEnabled: false,
    followUpNotifications: true,
    dailyReminderEnabled: true,
    dailyReminderTime: "09:00",
    streakExcludedDates: [],
    streakRestRules: [],
    healthScoresVisible: true,
    healthNotificationsEnabled: false,
    healthFallbackCadenceDays: 14,
    healthCadencePresets: normalizeCadencePresets(DEFAULT_CADENCE_PRESETS)
  },
  analytics: normalizeAnalyticsState(null),
  meta: { version: 6, updatedAt: nowISO(), achievements: {}, dailyReminderSentDate: null }
});

let state = defaultState();
let ui = {
  page: "dashboard",
  contactMode: "list",
  peopleQuick: "All",
  peopleFiltersOpen: false,
  pipelineRole: "Prospect",
  pipelineExpandedStages: new Set(),
  pipelineExpandedInitialized: false,
  pipelineStageDetail: null,
  pipelineContactId: null,
  customerPipelineExpandedStages: new Set(),
  customerPipelineExpandedInitialized: false,
  customerPipelineStageDetail: null,
  customerPipelineContactId: null,
  placeDetailId: null,
  networkEntityFilter: "all",
  networkSelectedNodeId: "you",
  search: "",
  roleFilter: "All Roles",
  visibilityFilter: "Active",
  healthBandFilter: "All",
  healthTrendFilter: "All",
  actionCoverageFilter: "All",
  recencyFilter: "All",
  pipelineStageFilter: "All",
  interestFilter: "All",
  judgementFilter: "All",
  placeFilter: "All",
  followUpFilter: "All",
  conversationFrom: "",
  conversationTo: "",
  sort: "recentContact",
  analyticsRange: "week",
  analyticsAnchor: todayInput(),
  analyticsCustomStart: todayInput(),
  analyticsCustomEnd: todayInput(),
  detailId: null,
  contactDetailTab: "overview",
  contactEditing: false,
  contactEditDirty: false,
  personalInfoDirty: false,
  communicationContactId: null,
  communicationType: "Call",
  communicationStartedAt: null,
  communicationLogId: null,
  activityHistoryContactId: null,
  activityFilter: "All",
  expandedLogIds: new Set(),
  actionView: "open",
  actionEditId: null,
  conversationStep: 0,
  settingsOpen: false,
  settingsExcludedDatesDraft: null,
  settingsRestRulesDraft: null,
  settingsRestFrequencyDraft: "once",
  achievementsOpen: false,
  quickCreateOpen: false,
  quickCreateMode: null,
  quickCreateContactId: "",
  scorecardShareOpen: false,
  scorecardIncludeContacts: false,
  scorecardShareBusy: false,
  scorecardCreated: null,
  releaseNotesOpen: false,
  releaseNotesReturnToSettings: false,
  sharedScorecard: null,
  sharedScorecardLoading: false,
  sharedScorecardError: "",
  sharedScorecardContactsOpen: false,
  accountMigrationOpen: false,
  accountAction: null,
  accountBusy: false,
  accountBackups: [],
  accountSessions: [],
  accountPanelError: "",
  accountPanelLoaded: false,
  confirmation: null,
  routedScreen: null,
  routedSection: "",
  routedError: "",
  routeDirection: "forward",
  routeEntryMotion: "",
  saveTimer: null
};
const {
  AppShell, ScreenHeader, PresentationScreen, navSelectionIndex,
  Button, SurfaceCard, IconButton, StatusBadge, ProgressBar, SegmentedControl,
  Avatar, ListRow, SettingsRow, ToggleRow, Chip, Menu, MetricCard, MetricGrid, SectionHeader, Tabs,
  InformationRow, SearchField, FilterControl, DateNavigator, EmptyState,
  FeedbackState, LoadingSkeleton, MobileSheet, ConfirmDialog, ChartCard
} = createBridgeFrontendFoundation({ escapeHTML, initials, icons, getRouteState: () => ui });
let lastRenderedNavSelection = null;
let lastRenderedPresentationKey = "";
let searchRenderTimer = null;
const todayActionLocks = new Set();
let releaseFocusReturn = null;
let scorecardFocusReturn = null;
let quickCreateFocusReturn = null;
let settingsFocusReturn = null;
let accountActionFocusReturn = null;
let accountActionFocusSelector = "";
let profileHeaderScrollCleanup = null;
let profileHeaderScrollSync = null;
let conversationDraft = null;
let conversationDraftDirty = false;
const launchParams = new URLSearchParams(location.search);
const launchPageAliases = { actions: "followups", insights: "analytics" };
const requestedLaunchPage = launchPageAliases[launchParams.get("page")] || launchParams.get("page");
if (requestedLaunchPage === "add") {
  ui.page = "dashboard";
  ui.quickCreateOpen = true;
} else if (["dashboard", "contacts", "followups", "analytics"].includes(requestedLaunchPage)) ui.page = requestedLaunchPage;
if (["list", "pipeline", "places", "network"].includes(launchParams.get("mode"))) ui.contactMode = launchParams.get("mode");
if (["Prospect", "Customer"].includes(launchParams.get("role"))) ui.pipelineRole = launchParams.get("role");
if (launchParams.get("contact")) ui.detailId = launchParams.get("contact");
const sharedScorecardToken = String(launchParams.get("shared") || "").trim();
let stateHydrated = false;
let pendingNotificationNavigationURL = "";
const cloudStateAvailable = document.querySelector('meta[name="bridge-cloud-state"]')?.content === "enabled";
const apiBase = String(globalThis.BridgeConfig?.apiBase || "").replace(/\/+$/, "");
const apiURL = path => apiBase ? `${apiBase}${path.startsWith("/") ? path : `/${path}`}` : path;
const apiFetch = (path, options) => fetch(apiURL(path), options);
const accountClient = globalThis.BridgeAccount || null;
let accountContext = {
  mode: "loading",
  authenticated: false,
  user: null,
  config: null,
  status: { state: "loading", message: "Opening Bridge…", pending: 0, conflicts: 0 }
};
let anonymousSnapshot = null;
let accountUnsubscribe = null;
let presentationHistoryIndex = Number.isInteger(history.state?.bridgeIndex) ? history.state.bridgeIndex : 0;
let scrollStateTimer = 0;
let suppressPeopleSearchRouteOnce = false;
let lockedDocumentScrollY = null;
const tabIndicatorMetrics = new Map();

const REFERENCE_MOTION = Object.freeze({
  sheet: Object.freeze({ stiffness:420, damping:40, settleMs:460 }),
  tab: Object.freeze({ stiffness:500, damping:40, settleMs:420 })
});

const PRESENTATION_QUERY_KEYS = ["screen", "person", "place", "stage", "section"];
const SETTINGS_SECTIONS = ["root", "profile", "goals", "notifications", "preferences", "health", "archive", "data", "account", "sessions", "backup", "privacy", "about"];
const PRESENTATION_SCREENS = ["people-search", "person", "person-timeline", "person-edit", "pipeline-stage", "stage-transition", "place", "analytics-detail", "goals", "achievements", "scorecard", "settings"];

function presentationPath(url = location.href) {
  const value = new URL(url, location.href);
  return `${value.pathname}${value.search}${value.hash}`;
}

function presentationURL({ page = ui.page, mode = ui.contactMode, role = ui.pipelineRole, screen = "", person = "", place = "", stage = "", section = "" } = {}) {
  const next = new URL(location.href);
  ["page", "mode", "role", "contact", ...PRESENTATION_QUERY_KEYS].forEach(key => next.searchParams.delete(key));
  if (page) next.searchParams.set("page", page);
  if (page === "contacts" && mode && mode !== "list") next.searchParams.set("mode", mode);
  if (page === "contacts" && mode === "pipeline" && ["Prospect", "Customer"].includes(role)) next.searchParams.set("role", role);
  if (screen) next.searchParams.set("screen", screen);
  if (person) next.searchParams.set("person", String(person));
  if (place) next.searchParams.set("place", String(place));
  if (stage) next.searchParams.set("stage", String(stage));
  if (section) next.searchParams.set("section", String(section));
  return next;
}

function routeFocusSelector(element) {
  if (!(element instanceof Element)) return "";
  if (element.id) return `#${CSS.escape(element.id)}`;
  const keys = ["contactId", "placeDetailId", "prospectStageOpen", "customerStageOpen", "prospectPipelineContact", "customerPipelineContact", "insightsPlaceId", "settingsSectionOpen"];
  for (const key of keys) {
    if (element.dataset[key] !== undefined) return `[data-${key.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)}="${CSS.escape(element.dataset[key])}"]`;
  }
  return "";
}

function currentDocumentScrollY() { return lockedDocumentScrollY ?? window.scrollY; }
function writeCurrentHistoryState(extra = {}) {
  history.replaceState({ ...(history.state || {}), bridgeIndex:presentationHistoryIndex, bridgeScrollY:currentDocumentScrollY(), ...extra }, "", presentationPath());
}
function cancelPendingScrollState() { if(scrollStateTimer){clearTimeout(scrollStateTimer);scrollStateTimer=0;} }
function flushScrollHistoryState() { cancelPendingScrollState();writeCurrentHistoryState(); }

function clearPresentationState() {
  ui.routedScreen = null;
  ui.routedSection = "";
  ui.routedError = "";
  ui.detailId = null;
  ui.activityHistoryContactId = null;
  ui.contactEditing = false;
  ui.contactEditDirty = false;
  ui.personalInfoDirty = false;
  ui.pipelineStageDetail = null;
  ui.pipelineContactId = null;
  ui.customerPipelineStageDetail = null;
  ui.customerPipelineContactId = null;
  ui.placeDetailId = null;
  ui.settingsOpen = false;
  ui.achievementsOpen = false;
  ui.scorecardShareOpen = false;
  ui.contactDetailTab = "overview";
  ui.activityFilter = "All";
  ui.expandedLogIds.clear();
}

function focusPresentationEntry() {
  const target = ui.routedScreen === "people-search" ? $("#contactSearch") : $("#presentationTitle");
  target?.focus({ preventScroll:true });
}

function updatePresentationView(update, onReady = null) {
  update();
  if (onReady) requestAnimationFrame(onReady);
}

function presentationParentURL(screen = ui.routedScreen) {
  const contactId = ui.detailId || ui.activityHistoryContactId || ui.pipelineContactId || ui.customerPipelineContactId;
  if (["person-timeline", "person-edit", "stage-transition"].includes(screen) && contactId) return presentationURL({ page:"contacts", mode:"list", screen:"person", person:contactId });
  if (screen === "pipeline-stage") return presentationURL({ page:"contacts", mode:"pipeline", role:ui.pipelineRole });
  if (screen === "place") return presentationURL({ page:"contacts", mode:"places" });
  if (screen === "analytics-detail" || screen === "scorecard") return presentationURL({ page:"analytics", mode:"list" });
  if (screen === "settings" && ui.routedSection && ui.routedSection !== "root") return presentationURL({ page:"dashboard", mode:"list", screen:"settings", section:"root" });
  if (["people-search", "person"].includes(screen)) return presentationURL({ page:"contacts", mode:"list" });
  return presentationURL({ page:"dashboard", mode:"list" });
}

function applyPresentationRoute(url = location.href, { renderNow = false, direction = "forward" } = {}) {
  if (sharedScorecardToken) return false;
  const target = new URL(url, location.href);
  const requestedPage = launchPageAliases[target.searchParams.get("page")] || target.searchParams.get("page");
  clearPresentationState();
  ui.page = requestedPage === "add" ? "dashboard" : ["dashboard", "contacts", "followups", "analytics"].includes(requestedPage) ? requestedPage : "dashboard";
  ui.contactMode = ["list", "pipeline", "places", "network"].includes(target.searchParams.get("mode")) ? target.searchParams.get("mode") : ui.page === "contacts" ? "list" : ui.contactMode;
  ui.pipelineRole = ["Prospect", "Customer"].includes(target.searchParams.get("role")) ? target.searchParams.get("role") : ui.pipelineRole;
  ui.routeDirection = direction;
  const legacyContact = String(target.searchParams.get("contact") || "");
  const requestedScreen = String(target.searchParams.get("screen") || (legacyContact ? "person" : ""));
  if (!PRESENTATION_SCREENS.includes(requestedScreen)) {
    if (requestedPage === "add") { ui.quickCreateOpen = true; ui.quickCreateMode = null; ui.quickCreateContactId = ""; }
    if (renderNow) render();
    return false;
  }
  ui.routedScreen = requestedScreen;
  if (requestedScreen === "people-search") { ui.page = "contacts"; ui.contactMode = "list"; }
  if (["person", "person-timeline", "person-edit", "stage-transition"].includes(requestedScreen)) {
    const personId = String(target.searchParams.get("person") || legacyContact || "");
    const contact = state.contacts.find(item => String(item.id) === personId);
    ui.page = "contacts";
    ui.contactMode = requestedScreen === "stage-transition" ? "pipeline" : "list";
    if (!contact) ui.routedError = personId ? "This person no longer exists." : "Choose a person to open this screen.";
    else if (requestedScreen === "person-timeline") { ui.activityHistoryContactId = contact.id; ui.activityFilter = "All"; }
    else if (requestedScreen === "stage-transition") {
      ui.pipelineRole = contact.role;
      if (contact.role === "Prospect") ui.pipelineContactId = contact.id;
      else if (contact.role === "Customer") ui.customerPipelineContactId = contact.id;
      else ui.routedError = "Team relationships do not use a pipeline stage.";
    } else { ui.detailId = contact.id; ui.contactDetailTab = "overview"; ui.contactEditing = requestedScreen === "person-edit"; }
  } else if (requestedScreen === "pipeline-stage") {
    const role = target.searchParams.get("role");
    const stage = String(target.searchParams.get("stage") || "");
    ui.page = "contacts"; ui.contactMode = "pipeline";
    if (!["Prospect", "Customer"].includes(role) || !(PIPELINES[role] || []).includes(stage)) ui.routedError = "That pipeline stage is not available.";
    else { ui.pipelineRole = role; if (role === "Prospect") ui.pipelineStageDetail = stage; else ui.customerPipelineStageDetail = stage; }
  } else if (requestedScreen === "place") {
    const placeId = String(target.searchParams.get("place") || "");
    ui.page = "contacts"; ui.contactMode = "places";
    if (!state.places.some(item => String(item.id) === placeId)) ui.routedError = placeId ? "This place no longer exists." : "Choose a place to open this screen.";
    else ui.placeDetailId = placeId;
  } else if (requestedScreen === "analytics-detail") ui.page = "analytics";
  else if (requestedScreen === "goals") ui.page = "dashboard";
  else if (requestedScreen === "achievements") { ui.page = "dashboard"; ui.achievementsOpen = true; }
  else if (requestedScreen === "scorecard") { ui.page = "analytics"; ui.scorecardShareOpen = true; }
  else if (requestedScreen === "settings") {
    const section = String(target.searchParams.get("section") || "root");
    ui.page = "dashboard"; ui.settingsOpen = true; ui.routedSection = SETTINGS_SECTIONS.includes(section) ? section : "root";
    if(!Array.isArray(ui.settingsExcludedDatesDraft))ui.settingsExcludedDatesDraft=[...normalizeExcludedDates(state.settings.streakExcludedDates)];
    if(!Array.isArray(ui.settingsRestRulesDraft))ui.settingsRestRulesDraft=normalizeRestRules(state.settings.streakRestRules);
    if (!SETTINGS_SECTIONS.includes(section)) ui.routedError = "That Settings section is not available.";
  }
  if (renderNow) render();
  return true;
}

function navigatePresentation(screen, values = {}, { replace = false, opener = document.activeElement } = {}) {
  if(ui.personalInfoDirty){discardPersonalInfoDraft(()=>navigatePresentation(screen,values,{replace,opener}));return false;}
  if(conversationDraftDirty){discardConversationDraft(()=>navigatePresentation(screen,values,{replace,opener}));return false;}
  const routeDefaults = screen === "pipeline-stage" || screen === "stage-transition" ? { page:"contacts", mode:"pipeline" }
    : screen === "place" ? { page:"contacts", mode:"places" }
    : screen === "analytics-detail" || screen === "scorecard" ? { page:"analytics", mode:"list" }
    : screen === "settings" || screen === "goals" || screen === "achievements" ? { page:"dashboard", mode:"list" }
    : { page:"contacts", mode:"list" };
  const next = presentationURL({ ...routeDefaults, role:values.role || ui.pipelineRole, screen, ...values });
  const focusSelector = routeFocusSelector(opener);
  flushScrollHistoryState();
  writeCurrentHistoryState(focusSelector ? { bridgeFocusSelector:focusSelector } : {});
  const nextIndex = replace ? presentationHistoryIndex : presentationHistoryIndex + 1;
  const nextState = { ...(history.state || {}), bridgeIndex:nextIndex, bridgeScrollY:0, bridgeParentURL:presentationPath(presentationParentURL(screen)) };
  if (replace) history.replaceState(nextState, "", presentationPath(next));
  else history.pushState(nextState, "", presentationPath(next));
  presentationHistoryIndex = nextIndex;
  updatePresentationView(() => {
    applyPresentationRoute(next, { renderNow:true, direction:"forward" });
    window.scrollTo({ top:0, left:0, behavior:"auto" });
    profileHeaderScrollSync?.();
  }, focusPresentationEntry);
  return true;
}

function navigateMain(page, { mode = page === "contacts" ? "list" : ui.contactMode, role = ui.pipelineRole, replace = false, opener = document.activeElement } = {}) {
  if(ui.personalInfoDirty){discardPersonalInfoDraft(()=>navigateMain(page,{mode,role,replace,opener}));return false;}
  if(ui.contactEditing&&ui.contactEditDirty){discardContactEdit(()=>navigateMain(page,{mode,role,replace,opener}));return false;}
  if(conversationDraftDirty){discardConversationDraft(()=>navigateMain(page,{mode,role,replace,opener}));return false;}
  const next = presentationURL({ page, mode, role });
  if (presentationPath(next) === presentationPath()) return false;
  flushScrollHistoryState();
  writeCurrentHistoryState({ bridgeFocusSelector:routeFocusSelector(opener) });
  const nextIndex = replace ? presentationHistoryIndex : presentationHistoryIndex + 1;
  const nextState = { ...(history.state || {}), bridgeIndex:nextIndex, bridgeScrollY:0 };
  if (replace) history.replaceState(nextState, "", presentationPath(next));
  else history.pushState(nextState, "", presentationPath(next));
  presentationHistoryIndex = nextIndex;
  updatePresentationView(() => {
    applyPresentationRoute(next, { renderNow:true, direction:"forward" });
    window.scrollTo({ top:0, left:0, behavior:"auto" });
    profileHeaderScrollSync?.();
  });
  return true;
}

function presentationBack() {
  if(ui.personalInfoDirty){discardPersonalInfoDraft(presentationBack);return;}
  if(ui.contactEditing&&ui.contactEditDirty){discardContactEdit(presentationBack);return;}
  if(conversationDraftDirty){discardConversationDraft(presentationBack);return;}
  const parent = presentationParentURL();
  flushScrollHistoryState();
  const stateParent = String(history.state?.bridgeParentURL || "");
  if (stateParent && history.state?.bridgeIndex > 0) { history.back(); return; }
  const nextIndex = presentationHistoryIndex;
  history.replaceState({ ...(history.state || {}), bridgeIndex:nextIndex, bridgeScrollY:0 }, "", presentationPath(parent));
  updatePresentationView(() => {
    applyPresentationRoute(parent, { renderNow:true, direction:"back" });
    window.scrollTo({ top:0, left:0, behavior:"auto" });
    profileHeaderScrollSync?.();
  }, focusPresentationEntry);
}

function initializePresentationHistory() {
  if (!Number.isInteger(history.state?.bridgeIndex)) history.replaceState({ ...(history.state || {}), bridgeIndex:presentationHistoryIndex, bridgeScrollY:window.scrollY }, "", presentationPath());
  window.addEventListener("popstate", event => {
    cancelPendingScrollState();
    const nextIndex = Number.isInteger(event.state?.bridgeIndex) ? event.state.bridgeIndex : presentationHistoryIndex - 1;
    const direction = nextIndex < presentationHistoryIndex ? "back" : "forward";
    presentationHistoryIndex = nextIndex;
    updatePresentationView(() => {
      applyPresentationRoute(location.href, { renderNow:true, direction });
      window.scrollTo({ top:Number(event.state?.bridgeScrollY) || 0, left:0, behavior:"auto" });
      profileHeaderScrollSync?.();
    }, () => {
      const selector = String(event.state?.bridgeFocusSelector || "");
      if (selector) {
        if (selector === "#contactSearch") suppressPeopleSearchRouteOnce = true;
        try { document.querySelector(selector)?.focus({ preventScroll:true }); } catch {}
      }
      else if (ui.routedScreen) focusPresentationEntry();
    });
  });
  window.addEventListener("scroll", () => {
    if(lockedDocumentScrollY!==null)return;
    if(scrollStateTimer)clearTimeout(scrollStateTimer);
    scrollStateTimer=setTimeout(()=>{scrollStateTimer=0;writeCurrentHistoryState();},120);
  }, { passive:true });
  window.addEventListener("pagehide",flushScrollHistoryState);
}

initializePresentationHistory();

function clearNotificationRoute(url) {
  try {
    const next = new URL(url, location.href);
    ["notification", "page", "contact", "followUp"].forEach(key => next.searchParams.delete(key));
    history.replaceState(history.state, "", `${next.pathname}${next.search}${next.hash}`);
  } catch {}
}

function consumeNotificationNavigation(url, { renderNow = true } = {}) {
  let target;
  try { target = new URL(url, location.href); }
  catch { return false; }
  if (target.searchParams.get("notification") !== "1") return false;

  const requestedPage = target.searchParams.get("page");
  if (requestedPage === "add") {
    ui.page = "dashboard";
    ui.quickCreateOpen = true;
    ui.quickCreateMode = null;
    ui.quickCreateContactId = "";
  } else {
    ui.page = ["dashboard", "contacts", "followups", "analytics"].includes(requestedPage) ? requestedPage : "followups";
  }
  ui.detailId = null;
  let openedContactId = "";
  let notice = "";

  if (ui.page === "followups") {
    const contactId = String(target.searchParams.get("contact") || "");
    const followUpId = String(target.searchParams.get("followUp") || "");
    if (contactId) {
      const contact = state.contacts.find(item => String(item.id) === contactId);
      const followUp = contact?.followUps?.find(item => String(item.id) === followUpId);
      const unavailable = !contact || contact.archivedAt || contact.isFilteredOut || (followUpId && (!followUp || !isScheduledFollowUp(followUp)));
      if (unavailable) notice = "That follow-up is no longer active.";
      else { ui.detailId = contact.id; openedContactId = contact.id; }
    }
  }

  clearNotificationRoute(target.href);
  const destination = openedContactId
    ? presentationURL({ page:"contacts", mode:"list", screen:"person", person:openedContactId })
    : presentationURL({ page:ui.page, mode:ui.contactMode, role:ui.pipelineRole });
  history.replaceState({ ...(history.state || {}), bridgeIndex:presentationHistoryIndex, bridgeScrollY:0 }, "", presentationPath(destination));
  applyPresentationRoute(destination, { renderNow:false, direction:"forward" });
  if (renderNow) {
    render();
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  if (notice) setTimeout(() => showToast(notice), 0);
  return true;
}

function deferNotificationNavigation(url) {
  pendingNotificationNavigationURL = String(url || "");
  showToast("Reminder queued. Finish or close this dialog to open it.");
}

function resumePendingNotificationNavigation() {
  if (!stateHydrated || !pendingNotificationNavigationURL || blockingModalOpen()) return false;
  const url = pendingNotificationNavigationURL;
  pendingNotificationNavigationURL = "";
  return consumeNotificationNavigation(url);
}

function normalizeState(raw) {
  const base = defaultState();
  const next = { ...base, ...(raw || {}), settings: { ...base.settings, ...(raw?.settings || {}) }, analytics: normalizeAnalyticsState(raw?.analytics), meta: { ...base.meta, ...(raw?.meta || {}) } };
  delete next.settings.theme;
  delete next.settings.accent;
  delete next.settings.compact;
  const legacyName = String(next.settings.name || "").trim();
  if (!String(next.settings.firstName || "").trim() && legacyName) {
    const [firstName = "", ...lastNameParts] = legacyName.split(/\s+/);
    next.settings.firstName = firstName;
    next.settings.lastName = String(next.settings.lastName || "").trim() || lastNameParts.join(" ");
  }
  next.settings.firstName = String(next.settings.firstName || "").trim();
  next.settings.lastName = String(next.settings.lastName || "").trim();
  next.settings.name = [next.settings.firstName, next.settings.lastName].filter(Boolean).join(" ");
  next.settings.streakExcludedDates = normalizeExcludedDates(next.settings.streakExcludedDates);
  next.settings.streakRestRules = normalizeRestRules(next.settings.streakRestRules);
  next.settings.healthScoresVisible = next.settings.healthScoresVisible !== false;
  next.settings.healthNotificationsEnabled = Boolean(next.settings.healthNotificationsEnabled);
  next.settings.healthFallbackCadenceDays = Math.min(365, Math.max(1, Math.round(Number(next.settings.healthFallbackCadenceDays) || 14)));
  next.settings.healthCadencePresets = normalizeCadencePresets(next.settings.healthCadencePresets);
  next.contacts = Array.isArray(next.contacts) ? next.contacts.map(contact => {
    const filteredOutAt = contact.filteredOutAt || contact.explicitFilteredOutAt || null;
    const stageDates = { ...(contact.stageDates || {}) };
    const stageEvents = Array.isArray(contact.stageEvents) ? contact.stageEvents.map(event => ({ ...event, id: event.id || uid(), occurredAt: event.occurredAt || event.date || contact.updatedAt || contact.createdAt || nowISO() })) : ALL_STAGES.filter(stage => Boolean(contact.stages?.[stage]?.isComplete ?? contact.stages?.[stage])).map(stage => ({ id: uid(), stage, occurredAt: stageDates[stage] || contact.updatedAt || contact.createdAt || nowISO() }));
    const conversations = Array.isArray(contact.conversations) ? contact.conversations.map(log => {
      const communicationType = log.communicationType || (log.type === "Call" ? "Call" : ["Text", "Text Message"].includes(log.type) ? "Text" : null);
      return { ...log, id: log.id || uid(), createdAt: log.createdAt || log.conversationDate || contact.updatedAt || contact.createdAt || nowISO(), conversationDate: log.conversationDate || log.createdAt || contact.updatedAt || contact.createdAt || nowISO(), isCountedConversation: Boolean(log.isCountedConversation), communicationType, direction: communicationType ? (log.direction || "Outgoing") : null, followUpCreated: Boolean(log.followUpCreated) };
    }) : [];
    const firstCountedConversation = conversations.filter(log => log.isCountedConversation).sort((a, b) => dateOnly(a.conversationDate || a.createdAt) - dateOnly(b.conversationDate || b.createdAt))[0];
    const inferredCapturedPhone = String(contact.capturedPhoneNumber || contact.phoneNumber || "").trim();
    const phoneCapturedAt = contact.phoneCapturedAt || (inferredCapturedPhone && firstCountedConversation ? (firstCountedConversation.conversationDate || firstCountedConversation.createdAt) : null);
    const role = ["Prospect", "Customer", "Team"].includes(contact.role) ? contact.role : "Prospect";
    const stageAliases = LEGACY_PIPELINE_ALIASES[role] || {};
    const migratedStageValues = { ...(contact.stages || {}) };
    Object.entries(stageAliases).forEach(([legacyStage, currentStage]) => {
      if (Boolean(contact.stages?.[legacyStage]?.isComplete ?? contact.stages?.[legacyStage])) migratedStageValues[currentStage] = true;
      const legacyDate = stageDates[legacyStage];
      if (legacyDate && (!stageDates[currentStage] || new Date(legacyDate) > new Date(stageDates[currentStage]))) stageDates[currentStage] = legacyDate;
    });
    const validCurrentStages = new Set(["MSA", "DTM", ...(PIPELINES[role] || [])]);
    const stages = Object.fromEntries(ALL_STAGES.map(stage => [stage, validCurrentStages.has(stage) && Boolean(migratedStageValues?.[stage]?.isComplete ?? migratedStageValues?.[stage])]));
    const currentStageEvents = stageEvents.map(event => {
      const legacyStage = event.stage || event.toStage || "";
      const stage = stageAliases[legacyStage] || legacyStage;
      const fromStage = stageAliases[event.fromStage] || event.fromStage || null;
      const toStage = stageAliases[event.toStage] || event.toStage || (stage || null);
      return {
        ...event,
        stage,
        ...(event.fromStage !== undefined || event.toStage !== undefined ? { fromStage, toStage } : {}),
        ...(event.source ? { source: event.source } : {})
      };
    });
    normalizePipelineStages({ stages, stageDates, stageEvents: currentStageEvents }, PIPELINES[role]);
    const currentStageDates = Object.fromEntries(Object.entries(stageDates).filter(([stage]) => ALL_STAGES.includes(stage)));
    const healthCadenceDays = Number(contact.healthCadenceDays);
    const followUps = Array.isArray(contact.followUps) ? contact.followUps.map(item => {
      const completedAt = item.completedAt || null;
      const canceledAt = item.canceledAt || null;
      const deletedAt = item.deletedAt || null;
      const status = ["scheduled", "completed", "canceled", "deleted"].includes(item.status)
        ? item.status
        : completedAt ? "completed" : deletedAt ? "deleted" : canceledAt ? "canceled" : "scheduled";
      return {
        ...item,
        id: item.id || uid(),
        dueDate: item.dueDate || item.createdAt || contact.updatedAt || contact.createdAt || nowISO(),
        status,
        completedAt,
        canceledAt,
        deletedAt,
        createdAt: item.createdAt || contact.updatedAt || contact.createdAt || nowISO(),
        updatedAt: item.updatedAt || completedAt || canceledAt || deletedAt || item.createdAt || contact.updatedAt || contact.createdAt || nowISO(),
        rescheduleHistory: Array.isArray(item.rescheduleHistory) ? item.rescheduleHistory : []
      };
    }) : [];
    return {
      id: contact.id || uid(), fullName: contact.fullName || "Unnamed Contact", phoneNumber: contact.phoneNumber || "", email: String(contact.email || "").trim(), role,
      capturedPhoneNumber: phoneCapturedAt ? inferredCapturedPhone : "", phoneCapturedAt,
      judgement: ["Good Fit", "Not Good Fit"].includes(contact.judgement || contact.category) ? (contact.judgement || contact.category) : "Good Fit",
      interestLevel: INTERESTS.includes(contact.interestLevel) ? contact.interestLevel : "Unsure", conversationType: CONVERSATION_TYPES.includes(contact.conversationType) ? contact.conversationType : "Prospecting",
      placeId: contact.placeId || contact.placeID || null, placeName: contact.placeName || "", dateFirstMet: contact.dateFirstMet || contact.createdAt || nowISO(), personalInfo: contact.personalInfo || "",
      healthCadenceDays: Number.isFinite(healthCadenceDays) && healthCadenceDays >= 1 && healthCadenceDays <= 365 ? Math.round(healthCadenceDays) : null,
      isFilteredOut: role === "Team" ? false : Boolean(contact.isFilteredOut && filteredOutAt), filteredOutAt: role === "Team" ? null : filteredOutAt, checkBackDate: contact.checkBackDate || null,
      archivedAt: contact.archivedAt || null, archiveReason: contact.archiveReason || null,
      stages, stageDates: currentStageDates, stageEvents: currentStageEvents, followUps, notes: Array.isArray(contact.notes) ? contact.notes : [], conversations,
      createdAt: contact.createdAt || nowISO(), updatedAt: contact.updatedAt || contact.createdAt || nowISO()
    };
  }) : [];
  archiveInactiveContacts(next.contacts, next.settings.autoArchiveInactive);
  next.places = Array.isArray(next.places) ? next.places.map(place => ({ id: place.id || uid(), name: place.name || "Unnamed Place", isFavorite: Boolean(place.isFavorite), createdAt: place.createdAt || nowISO() })) : [];
  next.analytics = normalizeAnalyticsState(next.analytics);
  next.meta.achievements = next.meta.achievements && typeof next.meta.achievements === "object" ? next.meta.achievements : {};
  return next;
}

function syncAchievements(announce = true) {
  const result = evaluateAchievements(state, state.meta.achievements || {});
  if (!result.newlyUnlocked.length) return result;
  const newlyUnlocked = [...result.newlyUnlocked];
  const unlockedAt = nowISO();
  newlyUnlocked.forEach(id => { state.meta.achievements[id] = unlockedAt; });
  if (announce) {
    const achievement = ACHIEVEMENTS.find(item => item.id === newlyUnlocked[0]);
    if (achievement) showToast(`Achievement unlocked: ${achievement.name}`);
  }
  return { ...evaluateAchievements(state, state.meta.achievements), newlyUnlocked };
}

function hasMeaningfulBridgeData(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value.contacts) && value.contacts.length) return true;
  if (Array.isArray(value.places) && value.places.length) return true;
  if (Object.keys(value.meta?.achievements || {}).length) return true;
  const settings = value.settings || {};
  return Boolean(
    String(settings.firstName || settings.lastName || settings.name || settings.businessName || "").trim() ||
    Number(settings.dailyGoal || 5) !== 5 ||
    Number(settings.weeklyGoal || 25) !== 25 ||
    Number(settings.monthlyGoal || 100) !== 100 ||
    (Array.isArray(settings.streakExcludedDates) && settings.streakExcludedDates.length) ||
    (Array.isArray(settings.streakRestRules) && settings.streakRestRules.length)
  );
}

async function readAnonymousState() {
  const cached = localCache.get() || await durableCache.get();
  if (!cached) return defaultState();
  try { return normalizeState(JSON.parse(cached)); }
  catch { return defaultState(); }
}

function finishStateHydration() {
  syncAchievements(false);
  applyFixedAppearance();
  stateHydrated = true;
  const pendingURL = pendingNotificationNavigationURL;
  let consumedNotification = false;
  if (!pendingURL || !blockingModalOpen()) {
    pendingNotificationNavigationURL = "";
    consumedNotification = consumeNotificationNavigation(pendingURL || location.href, { renderNow: false });
  }
  if (!consumedNotification) applyPresentationRoute(location.href, { renderNow:false, direction:"forward" });
  render();
  if(ui.routedScreen)requestAnimationFrame(focusPresentationEntry);
  refreshPushSubscriptionState().catch(() => {});
  startReminderChecks();
}

function accountSyncLabel() {
  if (accountContext.mode !== "account" || !accountContext.authenticated) {
    return cloudStateAvailable ? "Cloud synced" : "Saved on this device";
  }
  return accountContext.status?.message || "Up to date";
}

function renderSessionLoading() {
  document.body.classList.remove("modal-open");
  const app = $("#app");
  app.innerHTML = `<main class="session-loading"><span class="session-brand-symbol" aria-hidden="true">${icons.bridge}</span><strong>Opening Bridge</strong><span>Checking your private workspace…</span></main>`;
}

function cleanAccountURLParameter(name) {
  const next = new URL(location.href);
  next.searchParams.delete(name);
  history.replaceState(history.state, "", `${next.pathname}${next.search}${next.hash}`);
}

function handleAccountStatus(status) {
  accountContext.status = { ...accountContext.status, ...(status || {}) };
  if (status?.authRequired) {
    accountContext.authenticated = false;
    stateHydrated = false;
    accountClient?.renderAuthScreen({ message: "Sign in again to sync the changes saved on this device." });
    return;
  }
  if (status?.stateData && accountContext.authenticated) {
    state = normalizeState(status.stateData);
    syncAchievements(false);
    applyFixedAppearance();
    if (stateHydrated) render();
    return;
  }
  const syncNode = $(".sync-status");
  if (syncNode) syncNode.textContent = accountSyncLabel();
}

async function loadAccountState() {
  anonymousSnapshot = await readAnonymousState();
  const cachedAccountState = await accountClient.loadState();
  state = normalizeState(cachedAccountState || defaultState());
  finishStateHydration();

  const migration = await accountClient.migrationStatus();
  if (!migration.completed && hasMeaningfulBridgeData(anonymousSnapshot)) {
    ui.accountMigrationOpen = true;
    render();
  }
}

async function startBridge() {
  if (sharedScorecardToken) {
    await loadSharedScorecard(sharedScorecardToken);
    return;
  }
  if (!accountClient) {
    accountContext = {
      ...accountContext,
      mode: "local",
      authenticated: false,
      status: { state: "local", message: "Saved on this device", pending: 0, conflicts: 0 }
    };
    await loadState();
    return;
  }

  renderSessionLoading();
  accountUnsubscribe?.();
  accountUnsubscribe = accountClient.subscribe(handleAccountStatus);
  const boot = await accountClient.bootstrap(apiBase);
  accountContext = {
    ...accountContext,
    ...boot,
    config: boot.config || accountClient.config(),
    status: accountClient.status()
  };

  if (boot.mode !== "account") {
    await loadState();
    return;
  }

  const verificationToken = String(launchParams.get("verifyEmail") || "");
  if (verificationToken) {
    try {
      await accountClient.verifyEmail(verificationToken);
      cleanAccountURLParameter("verifyEmail");
      accountClient.renderAuthScreen({ message: "Email verified. Sign in to open Bridge." });
    } catch (error) {
      cleanAccountURLParameter("verifyEmail");
      accountClient.renderAuthScreen({ error: error.message });
    }
    return;
  }

  if (!boot.authenticated) {
    accountClient.renderAuthScreen();
    return;
  }

  accountContext.authenticated = true;
  accountContext.user = boot.user || accountClient.session()?.user || null;
  await loadAccountState();
}

async function loadState() {
  if (!cloudStateAvailable) {
    state = await readAnonymousState();
    const snapshot = JSON.stringify(state);
    localCache.set(snapshot);
    durableCache.set(snapshot);
    finishStateHydration();
    return;
  }
  try {
    const response = await fetch("/api/state", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Cloud state unavailable");
    state = normalizeState(await response.json());
    const snapshot = JSON.stringify(state);
    localCache.set(snapshot);
    durableCache.set(snapshot);
  } catch {
    const cached = localCache.get() || await durableCache.get();
    try { state = normalizeState(cached ? JSON.parse(cached) : null); }
    catch { state = defaultState(); }
    $(".sync-status")?.replaceChildren(document.createTextNode("Local mode"));
  }
  finishStateHydration();
}

async function loadSharedScorecard(token) {
  ui.sharedScorecardLoading = true;
  render();
  try {
    const response = await apiFetch(`/api/scorecards/${encodeURIComponent(token)}`, { headers: { Accept: "application/json" } });
    const contentType = response.headers.get("content-type") || "";
    const result = contentType.includes("application/json") ? await response.json().catch(() => ({})) : {};
    if (!response.ok || !result.scorecard) throw new Error(result.error || "This scorecard link has expired or is no longer available.");
    ui.sharedScorecard = result.scorecard;
    document.title = `${ui.sharedScorecard.ownerName || "Bridge"}'s Scorecard`;
  } catch (error) {
    ui.sharedScorecardError = error?.message || "This scorecard link has expired or is no longer available.";
  } finally {
    ui.sharedScorecardLoading = false;
    render();
  }
}

function queueSave(message = "Saved") {
  const achievementResult = syncAchievements(false);
  if (achievementResult.newlyUnlocked.length) {
    const achievement = ACHIEVEMENTS.find(item => item.id === achievementResult.newlyUnlocked[0]);
    if (achievement) message = `Achievement unlocked: ${achievement.name}`;
  }
  refreshAnalyticsHistory(new Date());
  state.meta.updatedAt = nowISO();
  const snapshot = JSON.stringify(state);
  clearTimeout(ui.saveTimer);

  if (accountContext.mode === "account" && accountContext.authenticated && accountClient) {
    const accountSnapshot = JSON.parse(snapshot);
    accountClient.queueState(accountSnapshot).catch(() => {
      showToast("Saved offline; Bridge will retry after you sign in or reconnect");
    });
    ui.saveTimer = setTimeout(async () => {
      if (pushSubscriptionState === "active") {
        await syncHostedReminderSchedule().catch(() => {});
      }
      showToast(message,{tone:"success"});
    }, 220);
    return;
  }

  localCache.set(snapshot);
  durableCache.set(snapshot);
  ui.saveTimer = setTimeout(async () => {
    if (pushSubscriptionState === "active") {
      await syncHostedReminderSchedule().catch(() => {});
    }
    if (!cloudStateAvailable) {
      showToast(message,{tone:"success"});
      return;
    }
    try {
      const response = await fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state) });
      if (!response.ok) throw new Error();
      showToast(message,{tone:"success"});
    } catch { showToast("Saved on this device; cloud sync will retry later"); }
  }, 220);
}

async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persisted && await navigator.storage.persisted()) return;
    await navigator.storage?.persist?.();
  } catch {}
}

const notificationsSupported = () => "Notification" in window && "serviceWorker" in navigator;
const notificationPermission = () => notificationsSupported() ? Notification.permission : "unsupported";
const hostedPushAvailable = document.querySelector('meta[name="bridge-hosted-push"]')?.content === "enabled";
const backgroundPushSupported = () => notificationsSupported() && "PushManager" in window && hostedPushAvailable;
const isStandaloneWebApp = () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
const PUSH_DEVICE_TOKEN_KEY = "bridge-hosted-push-device-token-v1";
let reminderTimer = null;
let pushSubscriptionState = "checking";

function urlBase64ToBytes(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob((value + padding).replace(/-/g, "+").replace(/_/g, "/")), character => character.charCodeAt(0));
}

async function currentPushSubscription() {
  if (!backgroundPushSupported()) return null;
  try { return await (await navigator.serviceWorker.ready).pushManager.getSubscription(); }
  catch { return null; }
}

function pushDeviceToken() {
  try { return localStorage.getItem(PUSH_DEVICE_TOKEN_KEY) || ""; }
  catch { return ""; }
}

function setPushDeviceToken(value) {
  try {
    if (value) localStorage.setItem(PUSH_DEVICE_TOKEN_KEY, value);
    else localStorage.removeItem(PUSH_DEVICE_TOKEN_KEY);
  } catch {}
}

function hostedReminderSchedule() {
  const recentCutoff = Date.now() - 45 * 86_400_000;
  const conversationDates = state.contacts.flatMap(contact => (contact.conversations || [])
    .filter(item => item.isCountedConversation && new Date(item.conversationDate || item.createdAt).getTime() >= recentCutoff)
    .map(item => item.conversationDate || item.createdAt));
  const followUps = state.contacts
    .filter(contact => !contact.archivedAt && !contact.isFilteredOut)
    .flatMap(contact => (contact.followUps || [])
      .filter(item => isScheduledFollowUp(item) && Number.isFinite(new Date(item.dueDate).getTime()))
      .map(item => ({
        id: String(item.id),
        contactId: String(contact.id),
        dueDate: item.dueDate,
        contactName: String(contact.fullName || "your contact").slice(0, 100),
        note: String(item.note || "Your scheduled follow-up").slice(0, 180)
      })));
  return {
    notificationsEnabled: Boolean(state.settings.notificationsEnabled),
    followUpNotifications: Boolean(state.settings.followUpNotifications),
    dailyReminderEnabled: Boolean(state.settings.dailyReminderEnabled),
    dailyReminderTime: String(state.settings.dailyReminderTime || "09:00"),
    dailyGoal: Math.max(1, Number(state.settings.dailyGoal) || 5),
    conversationDates,
    followUps,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
}

async function registerHostedSubscription(subscription) {
  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
  };
  if (accountModeActive()) {
    const result = await accountClient.request("/api/push/subscribe", options);
    if (!result?.deviceToken) throw new Error(result?.error || "Bridge could not register this device.");
    setPushDeviceToken(result.deviceToken);
    return result.deviceToken;
  }
  const response = await apiFetch("/api/push/subscribe", options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.deviceToken) throw new Error(result.error || "Bridge could not register this device.");
  setPushDeviceToken(result.deviceToken);
  return result.deviceToken;
}

async function syncHostedReminderSchedule() {
  const subscription = await currentPushSubscription();
  let token = pushDeviceToken();
  if (!subscription) return false;
  const schedule = hostedReminderSchedule();
  // A first launch may not yet have a controller. Persist the schedule with
  // whichever active worker is ready so a later subscription refresh keeps it.
  navigator.serviceWorker?.ready
    .then(registration => (registration.active || navigator.serviceWorker.controller)?.postMessage({ type: "bridge-reminder-schedule", schedule }))
    .catch(() => {});
  if (!token) token = await registerHostedSubscription(subscription);
  const response = await apiFetch("/api/push/schedule", {
    method: "PUT",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint, schedule })
  });
  if (response.status === 401) {
    setPushDeviceToken("");
    token = await registerHostedSubscription(subscription);
    return syncHostedReminderSchedule();
  }
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Bridge could not update hosted reminders.");
  return true;
}

async function refreshPushSubscriptionState() {
  if (!backgroundPushSupported()) { pushSubscriptionState = "unsupported"; return null; }
  const subscription = await currentPushSubscription();
  const permission = notificationPermission();
  if (permission === "denied") { pushSubscriptionState = "blocked"; return subscription; }
  pushSubscriptionState = subscription && permission === "granted" ? "active" : "inactive";
  if (pushSubscriptionState === "active") {
    syncHostedReminderSchedule().catch(() => {});
  }
  return subscription;
}

async function enableBackgroundPush() {
  if (!backgroundPushSupported()) throw new Error("Background reminders require the hosted Bridge web app.");
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !isStandaloneWebApp()) throw new Error("Add Bridge to your iPhone Home Screen before enabling background reminders.");
  if (notificationPermission() === "denied") throw new Error("Notifications are blocked in your browser or device settings.");
  const permission = notificationPermission() === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not enabled.");
  const registration = await navigator.serviceWorker.ready;
  const configResponse = await apiFetch("/api/push/config", { headers: { Accept: "application/json" } });
  const config = await configResponse.json();
  if (!configResponse.ok || !config.publicKey) throw new Error(config.error || "Bridge push service is not configured yet.");
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(config.publicKey) });
  await registerHostedSubscription(subscription);
  pushSubscriptionState = "active";
  state.settings.notificationsEnabled = true;
  state.settings.followUpNotifications = true;
  await syncHostedReminderSchedule();
  return subscription;
}

async function disableBackgroundPush() {
  const subscription = await currentPushSubscription();
  if (subscription) {
    const token = pushDeviceToken();
    await apiFetch("/api/push/subscribe", { method: "DELETE", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) }).catch(() => {});
    await subscription.unsubscribe().catch(() => false);
  }
  setPushDeviceToken("");
  pushSubscriptionState = "inactive";
}

async function persistStateSilently() {
  refreshAnalyticsHistory(new Date());
  state.meta.updatedAt = nowISO();
  const snapshot = JSON.stringify(state);
  if (accountModeActive()) {
    await accountClient.queueState(JSON.parse(snapshot)).catch(() => {});
    if (pushSubscriptionState === "active") syncHostedReminderSchedule().catch(() => {});
    return;
  }
  localCache.set(snapshot);
  durableCache.set(snapshot);
  if (pushSubscriptionState === "active") syncHostedReminderSchedule().catch(() => {});
  if (!cloudStateAvailable) return;
  try { await fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: snapshot }); } catch {}
}

async function sendBridgeNotification(title, options) {
  if (notificationPermission() !== "granted") return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, { icon: `./bridge-icon-192.png?v=${APP_RELEASE.version}`, badge: `./bridge-icon-192.png?v=${APP_RELEASE.version}`, ...options });
    return true;
  } catch { return false; }
}

async function checkReminders() {
  if (document.visibilityState === "hidden" || notificationPermission() !== "granted") return;
  const events = dueReminderEvents(state, new Date());
  if (!events.length) return;
  let changed = false;
  for (const event of events) {
    if (event.type === "followup") {
      if (pushSubscriptionState === "active") continue;
      const sent = await sendBridgeNotification(`Follow up with ${event.contact.fullName}`, {
        body: `${event.followUp.note || "Your scheduled follow-up"} is ready now.`,
        tag: `bridge-followup-${event.followUp.id}`,
        data: { url: `./?page=followups&contact=${encodeURIComponent(event.contact.id)}&followUp=${encodeURIComponent(event.followUp.id)}&notification=1` }
      });
      if (sent) { event.followUp.notificationSentAt = nowISO(); changed = true; }
    } else {
      const sent = await sendBridgeNotification("Ready to build your pipeline?", {
        body: `${event.remaining} conversation${event.remaining === 1 ? "" : "s"} left to reach today’s goal.`,
        tag: `bridge-daily-${event.date}`,
        data: { url: "./?page=add" }
      });
      if (sent) { state.meta.dailyReminderSentDate = event.date; changed = true; }
    }
  }
  if (changed) persistStateSilently();
}

function startReminderChecks() {
  clearInterval(reminderTimer);
  checkReminders();
  reminderTimer = setInterval(checkReminders, 60_000);
}

function notificationDeliveryState() {
  const permission=notificationPermission();
  if(!notificationsSupported()||!backgroundPushSupported())return {kind:"unsupported",title:"Background reminders unavailable",detail:"This browser or install mode cannot receive scheduled reminders."};
  if(permission==="denied"||pushSubscriptionState==="blocked")return {kind:"blocked",title:"Notifications blocked",detail:"Allow notifications for Bridge in your browser or device settings, then return here."};
  if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&!isStandaloneWebApp())return {kind:"install",title:"Add Bridge to your Home Screen",detail:"Open the installed Bridge app to turn on scheduled reminders."};
  if(pushSubscriptionState==="checking")return {kind:"checking",title:"Checking reminders",detail:"Bridge is checking whether this device is ready."};
  if(permission==="granted"&&pushSubscriptionState==="active")return {kind:"active",title:"Reminders ready",detail:"Bridge can send the reminder choices below on this device."};
  if(permission==="granted")return {kind:"granted",title:"Finish turning on reminders",detail:"Notification access is allowed. Finish setup to receive scheduled reminders."};
  return {kind:"default",title:"Turn on reminders",detail:"Bridge asks your device for permission only after you choose Enable."};
}

window.addEventListener("pointerdown", requestPersistentStorage, { once: true, passive: true });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { checkReminders(); offerPendingCommunication(); } });
window.addEventListener("focus", () => setTimeout(offerPendingCommunication, 120));
window.addEventListener("beforeunload", event => {
  if (!conversationDraftDirty) return;
  event.preventDefault();
  event.returnValue = "";
});
window.addEventListener("pagehide", () => {
  if (sharedScorecardToken || !stateHydrated) return;
  if (accountModeActive()) return;
  refreshAnalyticsHistory(new Date());
  const snapshot = JSON.stringify(state);
  localCache.set(snapshot);
  durableCache.set(snapshot);
});

function showToast(message, { tone="info" }={}) {
  const toast = $("#toast");
  const toastIcon=document.createElement("span");
  toastIcon.className="toast-icon";
  toastIcon.setAttribute("aria-hidden","true");
  toastIcon.innerHTML=icons.check;
  const toastMessage=document.createElement("span");
  toastMessage.className="toast-message";
  toastMessage.textContent=String(message||"");
  toast.replaceChildren(toastIcon,toastMessage);
  toast.dataset.tone=tone;
  toast.classList.remove("show","is-leaving");
  void toast.offsetWidth;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  clearTimeout(showToast.exitTimer);
  showToast.timer = setTimeout(() => {
    toast.classList.add("is-leaving");
    const delay=matchMedia('(prefers-reduced-motion: reduce)').matches?0:180;
    showToast.exitTimer=setTimeout(()=>toast.classList.remove("show","is-leaving"),delay);
  }, 2200);
}

function applyFixedAppearance() {
  const root = document.documentElement;
  root.removeAttribute("data-theme");
  root.style.removeProperty("--accent");
  root.style.removeProperty("--accent-rgb");
  root.style.removeProperty("--radius");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#f5f2ec");
}

function dateOnly(value) { return new Date(String(value).length === 10 ? `${value}T12:00:00` : value); }
function fmtDate(value, options = { month: "short", day: "numeric" }) { return value ? new Intl.DateTimeFormat(undefined, options).format(dateOnly(value)) : ""; }
function fmtDateTime(value) { return value ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : ""; }
function startOfDay(date) { const copy = new Date(date); copy.setHours(0,0,0,0); return copy; }
function addDays(date, amount) { const copy = new Date(date); copy.setDate(copy.getDate() + amount); return copy; }
function rangeForAnalytics() { return analyticsRange({ mode: ui.analyticsRange, anchor: ui.analyticsAnchor, customStart: ui.analyticsCustomStart, customEnd: ui.analyticsCustomEnd, weekStart: state.settings.weekStart }); }
function inRange(value, range) { return inAnalyticsRange(value, range); }
function countedConversations(range = null) { return state.contacts.flatMap(contact => contact.conversations.map(log => ({ ...log, contact }))).filter(log => log.isCountedConversation && (!range || inRange(log.conversationDate || log.createdAt, range))); }
function analyticsMetricsForRange(range) {
  const conversations = countedConversations(range);
  const newContacts = state.contacts.filter(contact => inRange(contact.dateFirstMet, range));
  return {
    range,
    conversations,
    newContacts,
    metrics: {
      conversations: conversations.length,
      contacts: uniquePhoneCaptures(state.contacts, range).length,
      prospects: newContacts.filter(contact => contact.role === "Prospect").length,
      prospectiveCustomers: newContacts.filter(contact => contact.role === "Customer").length
    }
  };
}
function analyticsScorecardData() { return analyticsMetricsForRange(rangeForAnalytics()); }
function adjacentAnalyticsRange(range, direction = -1) {
  const dayCount = Math.max(1, Math.round((startOfDay(range.end) - startOfDay(range.start)) / 86400000) + 1);
  const start = addDays(startOfDay(range.start), direction < 0 ? -dayCount : dayCount);
  const end = new Date(addDays(start, dayCount - 1));
  end.setHours(23, 59, 59, 999);
  return { start, end, label: "" };
}
function previousAnalyticsRange(range = rangeForAnalytics()) {
  if (ui.analyticsRange === "custom") return adjacentAnalyticsRange(range, -1);
  const anchor = dateOnly(ui.analyticsAnchor);
  if (ui.analyticsRange === "month") anchor.setMonth(anchor.getMonth() - 1, 1);
  else anchor.setDate(anchor.getDate() - (ui.analyticsRange === "week" ? 7 : 1));
  return analyticsRange({ mode: ui.analyticsRange, anchor: analyticsInputDate(anchor), weekStart: state.settings.weekStart });
}
function analyticsInputDate(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function shiftAnalyticsPeriod(direction) {
  if (ui.analyticsRange === "custom") {
    const range = rangeForAnalytics();
    const shifted = adjacentAnalyticsRange(range, direction);
    ui.analyticsCustomStart = analyticsInputDate(shifted.start);
    ui.analyticsCustomEnd = analyticsInputDate(shifted.end);
    return;
  }
  const anchor = dateOnly(ui.analyticsAnchor);
  if (ui.analyticsRange === "month") anchor.setMonth(anchor.getMonth() + direction, 1);
  else anchor.setDate(anchor.getDate() + direction * (ui.analyticsRange === "week" ? 7 : 1));
  ui.analyticsAnchor = analyticsInputDate(anchor);
}
function followUpStatus(item) {
  if (["scheduled", "completed", "canceled", "deleted"].includes(item?.status)) return item.status;
  if (item?.completedAt) return "completed";
  if (item?.deletedAt) return "deleted";
  if (item?.canceledAt) return "canceled";
  return "scheduled";
}
function isScheduledFollowUp(item) { return followUpStatus(item) === "scheduled"; }
function activeFollowUps() {
  return state.contacts
    .filter(contact => !contact.archivedAt && !contact.isFilteredOut)
    .flatMap(contact => contact.followUps.filter(isScheduledFollowUp).map(item => ({ ...item, contact })))
    .sort((left, right) => new Date(left.dueDate) - new Date(right.dueDate));
}
function findFollowUpRecord(contactId, followUpId) {
  const contact = state.contacts.find(item => String(item.id) === String(contactId));
  const followUp = contact?.followUps?.find(item => String(item.id) === String(followUpId));
  return contact && followUp ? { contact, followUp } : null;
}
function createFollowUp(contact, dueDate, note = "Follow up", extra = {}) {
  const createdAt = nowISO();
  const followUp = {
    id: uid(),
    dueDate: new Date(dueDate).toISOString(),
    note,
    status: "scheduled",
    completedAt: null,
    canceledAt: null,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
    rescheduleHistory: [],
    ...extra
  };
  contact.followUps = Array.isArray(contact.followUps) ? contact.followUps : [];
  contact.followUps.push(followUp);
  return followUp;
}
function transitionFollowUp(item, status, at = nowISO()) {
  if (!["scheduled", "completed", "canceled", "deleted"].includes(status)) return false;
  if (followUpStatus(item) === status) return false;
  item.status = status;
  item.updatedAt = at;
  if (status === "completed") item.completedAt = at;
  if (status === "canceled") item.canceledAt = at;
  if (status === "deleted") item.deletedAt = at;
  if (status === "scheduled") {
    item.completedAt = null;
    item.canceledAt = null;
    item.deletedAt = null;
  }
  return true;
}
function rescheduleFollowUp(item, dueDate, at = nowISO()) {
  const nextDueDate = new Date(dueDate).toISOString();
  if (nextDueDate === item.dueDate) return false;
  item.rescheduleHistory = Array.isArray(item.rescheduleHistory) ? item.rescheduleHistory : [];
  item.rescheduleHistory.push({ id: uid(), fromDueDate: item.dueDate, toDueDate: nextDueDate, changedAt: at });
  item.dueDate = nextDueDate;
  item.notificationSentAt = null;
  transitionFollowUp(item, "scheduled", at);
  item.updatedAt = at;
  return true;
}
function replaceScheduledFollowUp(contact, dueDate, note = "Follow up", extra = {}) {
  const changedAt = nowISO();
  (contact.followUps || []).filter(isScheduledFollowUp).forEach(item => transitionFollowUp(item, "canceled", changedAt));
  return createFollowUp(contact, dueDate, note, extra);
}
function relationshipScores(now = new Date()) {
  return scoreContacts(state.contacts, { settings: state.settings, analytics: state.analytics, now });
}
function relationshipScoreMap(now = new Date()) {
  return new Map(relationshipScores(now).map(score => [String(score.contactId), score]));
}
function refreshAnalyticsHistory(now = new Date()) {
  const calculatedAt = now instanceof Date ? now : new Date(now);
  const scores = relationshipScores(calculatedAt);
  state.analytics = recordHealthEvents(state.analytics, scores);
  const date = dayKey(calculatedAt);
  const actions = state.contacts.flatMap(contact => (contact.followUps || []).map(item => ({ ...item, contactId: contact.id })));
  const snapshot = {
    date,
    calculatedAt: calculatedAt.toISOString(),
    formulaVersion: HEALTH_FORMULA_VERSION,
    metrics: {
      conversations: countedConversations().filter(item => dayKey(item.conversationDate || item.createdAt) === date).length,
      activeContacts: state.contacts.filter(contact => !contact.archivedAt && !contact.isFilteredOut).length,
      actions: {
        scheduled: actions.filter(item => followUpStatus(item) === "scheduled").length,
        completed: actions.filter(item => followUpStatus(item) === "completed" && dayKey(item.completedAt) === date).length,
        overdue: actions.filter(item => followUpStatus(item) === "scheduled" && new Date(item.dueDate) < calculatedAt).length
      },
      pipeline: Object.fromEntries(PIPELINE_STAGES.map(stage => [stage, state.contacts.filter(contact => currentPipelineStage(contact) === stage && !contact.archivedAt && !contact.isFilteredOut).length])),
      health: summarizeHealth(scores)
    }
  };
  const snapshots = Array.isArray(state.analytics.dailySnapshots) ? state.analytics.dailySnapshots : [];
  const existingIndex = snapshots.findIndex(item => item.date === date && item.formulaVersion === HEALTH_FORMULA_VERSION);
  if (existingIndex >= 0) snapshots[existingIndex] = snapshot;
  else snapshots.push(snapshot);
  state.analytics.dailySnapshots = snapshots.sort((left, right) => String(left.date).localeCompare(String(right.date)));
  return scores;
}
function stageFor(contact) { return currentPipelineStage(contact) || "No stage"; }
function stageInputName(stage) { return `stage_${stage.replaceAll(/[^a-zA-Z0-9]/g, "")}`; }
function stageLabel(stage) { return stage; }
function normalizedPhone(value) { return phoneIdentity(value); }
function isCallablePhone(value) { return Boolean(canonicalPhone(value)); }
function phoneHref(value) { return telHref(value) || "#"; }
function messageHref(value) { return smsHref(value) || "#"; }
function isValidEmail(value) {
  const email=String(value||"").trim();
  return !email || (email.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}
function emailHref(value) {
  const email=String(value||"").trim();
  return email&&isValidEmail(email)?`mailto:${encodeURIComponent(email)}`:"#";
}
function dateTimeLocalValue(value = new Date()) { const date = value instanceof Date ? value : new Date(value); const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16); }
function currentPipelineStage(contact) { return resolveCurrentPipelineStage(contact, PIPELINES[contact.role] || []); }
function setPipelineStage(contact, nextStage, occurredAt = nowISO(), source = "user") {
  const valid = PIPELINES[contact.role] || [];
  if (nextStage && !valid.includes(nextStage)) return false;
  const previous = currentPipelineStage(contact);
  if (previous === nextStage) return false;
  valid.forEach(stage => { contact.stages[stage] = stage === nextStage; });
  if (nextStage) contact.stageDates[nextStage] = occurredAt;
  contact.stageEvents = Array.isArray(contact.stageEvents) ? contact.stageEvents : [];
  contact.stageEvents.push({ id: uid(), stage: nextStage || "", fromStage: previous || null, toStage: nextStage || null, occurredAt, source });
  return true;
}
const pendingCommunicationKey = "bridge-pending-communication";
function readPendingCommunication() { try { return JSON.parse(sessionStorage.getItem(pendingCommunicationKey) || "null"); } catch { return null; } }
function clearPendingCommunication() { try { sessionStorage.removeItem(pendingCommunicationKey); sessionStorage.removeItem("bridge-pending-call"); } catch {} }
function startCommunication(contactId, type) {
  const pending=readPendingCommunication();
  if(pending&&pending.contactId===contactId&&pending.type===type&&Date.now()-new Date(pending.startedAt).getTime()<2000)return false;
  try { sessionStorage.setItem(pendingCommunicationKey, JSON.stringify({ id:uid(), contactId, type, startedAt:nowISO(), offered:false })); } catch {}
  return true;
}
function openCommunicationLog(contactId, type = "Call", startedAt = nowISO(), logId = null) { ui.communicationContactId=contactId; ui.communicationType=type; ui.communicationStartedAt=startedAt; ui.communicationLogId=logId; render(); }
function offerPendingCommunication() {
  const pending=readPendingCommunication();
  if(!pending||pending.offered||ui.communicationContactId||!state.contacts.some(contact=>contact.id===pending.contactId))return;
  pending.offered=true;
  try { sessionStorage.setItem(pendingCommunicationKey,JSON.stringify(pending)); } catch {}
  openCommunicationLog(pending.contactId,pending.type||"Call",pending.startedAt);
}

function accountMigrationSummary() {
  const source = anonymousSnapshot || defaultState();
  const contacts = Array.isArray(source.contacts) ? source.contacts.length : 0;
  const places = Array.isArray(source.places) ? source.places.length : 0;
  const conversations = (source.contacts || []).reduce((total, contact) => total + (Array.isArray(contact.conversations) ? contact.conversations.length : 0), 0);
  return { contacts, places, conversations };
}

function accountMigrationModal() {
  const summary = accountMigrationSummary();
  const busy = ui.accountBusy ? "disabled" : "";
  return `<div class="modal-backdrop account-migration-backdrop"><section class="modal account-migration-modal hn-account-modal" role="dialog" aria-modal="true" aria-labelledby="accountMigrationTitle" aria-describedby="accountMigrationDescription">
    <header class="account-migration-header">
      <span class="session-brand-symbol" aria-hidden="true">${icons.bridge}</span>
      <span class="eyebrow">Private workspace</span>
      <h2 id="accountMigrationTitle">Keep your existing Bridge data?</h2>
      <p id="accountMigrationDescription">Bridge found information saved only in this browser. Choose whether to copy it into this account or begin with an empty account.</p>
    </header>
    <div class="migration-summary hn-account-metrics" aria-label="Local data found">
      <div><strong>${summary.contacts}</strong><span>Contact${summary.contacts === 1 ? "" : "s"}</span></div>
      <div><strong>${summary.conversations}</strong><span>Log${summary.conversations === 1 ? "" : "s"}</span></div>
      <div><strong>${summary.places}</strong><span>Place${summary.places === 1 ? "" : "s"}</span></div>
    </div>
    <p class="migration-safety-note">Copying merges records by their existing IDs and flags conflicts for review. Your original browser-only data is not deleted either way.</p>
    <div class="migration-actions hn-account-actions">
      <button class="button primary" id="copyLocalBridgeData" type="button" ${busy}>${icons.download}<span>${ui.accountBusy ? "Copying…" : "Copy local data to this account"}</span></button>
      <button class="button subtle" id="startWithEmptyAccount" type="button" ${busy}>Start with an empty account</button>
    </div>
  </section></div>`;
}

function bindAccountMigrationEvents() {
  $("#copyLocalBridgeData")?.addEventListener("click", async () => {
    if (ui.accountBusy) return;
    ui.accountBusy = true;
    render();
    try {
      const result = await accountClient.importLocalState(anonymousSnapshot || defaultState());
      state = normalizeState(result.state || state);
      ui.accountMigrationOpen = false;
      ui.accountBusy = false;
      syncAchievements(false);
      applyFixedAppearance();
      render();
      showToast(result.conflicts ? `Data copied with ${result.conflicts} item${result.conflicts === 1 ? "" : "s"} to review` : "Local data copied to your account");
    } catch (error) {
      ui.accountBusy = false;
      render();
      showToast(error?.message || "Bridge could not copy the local data");
    }
  });

  $("#startWithEmptyAccount")?.addEventListener("click", async () => {
    if (ui.accountBusy) return;
    requestConfirmation({
      title:"Start with an empty account?",
      message:"The data already saved in this browser will not be copied. The browser-only copy remains available if account mode is later disabled.",
      confirmLabel:"Start empty",
      onConfirm:async()=>{
        ui.accountBusy = true;
        render();
        try {
          await accountClient.skipLocalMigration(anonymousSnapshot || defaultState());
          ui.accountMigrationOpen = false;
          ui.accountBusy = false;
          render();
          showToast("Account started without copying browser-only data");
        } catch (error) {
          ui.accountBusy = false;
          render();
          showToast(error?.message || "Bridge could not save that migration choice");
        }
      }
    });
  });
}

function accountActionModal() {
  const action = ui.accountAction;
  if (!action) return "";
  const busy = ui.accountBusy ? "disabled" : "";
  const close = `<button class="ui-icon-button close-account-action" type="button" aria-label="Close" ${busy}>${icons.close}</button>`;

  if (action.type === "restore-backup") {
    const contacts = Number(action.counts?.contacts || 0);
    const places = Number(action.counts?.places || 0);
    return `<div class="modal-backdrop account-action-backdrop" id="accountActionBackdrop"><section class="modal account-action-modal hn-account-modal" role="dialog" aria-modal="true" aria-labelledby="accountActionTitle" aria-describedby="accountActionDescription">
      <header class="modal-head hn-account-modal-head"><div><span class="eyebrow">Cloud backup</span><h2 id="accountActionTitle">Restore this backup?</h2></div>${close}</header>
      <div class="modal-body"><p id="accountActionDescription" class="account-action-copy">Bridge will create a safety backup first, then replace this account's current cloud records with the selected backup.</p>
        <div class="migration-summary account-action-summary" aria-label="Backup contents"><div><strong>${contacts}</strong><span>Contact${contacts === 1 ? "" : "s"}</span></div><div><strong>${places}</strong><span>Place${places === 1 ? "" : "s"}</span></div></div>
        <form id="accountActionForm" class="account-action-form" data-account-action="restore-backup">
          ${field("Bridge password", `<input name="password" type="password" autocomplete="current-password" required ${busy}>`, "full")}
          ${field("Type RESTORE to confirm", `<input name="confirmation" autocomplete="off" autocapitalize="characters" spellcheck="false" required ${busy}>`, "full")}
          <div class="form-actions"><button class="button close-account-action" type="button" ${busy}>Cancel</button><button class="button destructive" type="submit" ${busy}>${ui.accountBusy ? "Restoring…" : "Restore backup"}</button></div>
        </form>
      </div>
    </section></div>`;
  }

  if (action.type === "delete-account") {
    return `<div class="modal-backdrop account-action-backdrop" id="accountActionBackdrop"><section class="modal account-action-modal hn-account-modal" role="dialog" aria-modal="true" aria-labelledby="accountActionTitle" aria-describedby="accountActionDescription">
      <header class="modal-head hn-account-modal-head"><div><span class="eyebrow">Account security</span><h2 id="accountActionTitle">Delete Bridge account?</h2></div>${close}</header>
      <div class="modal-body"><p id="accountActionDescription" class="account-action-copy">This permanently deletes this account's private cloud CRM records and signs out every device. Browser-only data is not silently erased.</p>
        <form id="accountActionForm" class="account-action-form" data-account-action="delete-account">
          ${field("Bridge password", `<input name="password" type="password" autocomplete="current-password" required ${busy}>`, "full")}
          ${field("Type DELETE to confirm", `<input name="confirmation" autocomplete="off" autocapitalize="characters" spellcheck="false" required ${busy}>`, "full")}
          <div class="form-actions"><button class="button close-account-action" type="button" ${busy}>Cancel</button><button class="button destructive" type="submit" ${busy}>${ui.accountBusy ? "Deleting…" : "Delete account"}</button></div>
        </form>
      </div>
    </section></div>`;
  }

  return `<div class="modal-backdrop account-action-backdrop" id="accountActionBackdrop"><section class="modal account-action-modal hn-account-modal" role="dialog" aria-modal="true" aria-labelledby="accountActionTitle" aria-describedby="accountActionDescription">
    <header class="modal-head hn-account-modal-head"><div><span class="eyebrow">Account security</span><h2 id="accountActionTitle">Change password</h2></div>${close}</header>
    <div class="modal-body"><p id="accountActionDescription" class="account-action-copy">Use at least 12 characters. Other signed-in devices will be signed out after this change.</p>
      <form id="accountActionForm" class="account-action-form" data-account-action="change-password">
        ${field("Current password", `<input name="currentPassword" type="password" autocomplete="current-password" required ${busy}>`, "full")}
        ${field("New password", `<input name="newPassword" type="password" autocomplete="new-password" minlength="12" required ${busy}>`, "full")}
        ${field("Confirm new password", `<input name="confirmPassword" type="password" autocomplete="new-password" minlength="12" required ${busy}>`, "full")}
        <div class="form-actions"><button class="button close-account-action" type="button" ${busy}>Cancel</button><button class="button primary" type="submit" ${busy}>${ui.accountBusy ? "Changing…" : "Change password"}</button></div>
      </form>
    </div>
  </section></div>`;
}

function closeAccountAction() {
  if (ui.accountBusy) return;
  ui.accountAction = null;
  render();
  requestAnimationFrame(() => {
    let restored = false;
    if (accountActionFocusSelector) {
      try { const target=document.querySelector(accountActionFocusSelector);if(target){target.focus();restored=true;} } catch {}
    }
    if (!restored) {
      if (accountActionFocusReturn?.isConnected) accountActionFocusReturn.focus();
    }
    accountActionFocusReturn = null;
    accountActionFocusSelector = "";
  });
}

function bindAccountActionEvents() {
  $$(".close-account-action").forEach(button => button.addEventListener("click", closeAccountAction));
  $("#accountActionBackdrop")?.addEventListener("click", event => {
    if (event.target === event.currentTarget) closeAccountAction();
  });
  $("#accountActionForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    if (ui.accountBusy || !ui.accountAction) return;
    const action = ui.accountAction;
    const form = new FormData(event.currentTarget);

    if (action.type === "change-password") {
      const currentPassword = String(form.get("currentPassword") || "");
      const newPassword = String(form.get("newPassword") || "");
      const confirmPassword = String(form.get("confirmPassword") || "");
      if (newPassword.length < 12) { showToast("Use a password of at least 12 characters"); return; }
      if (newPassword !== confirmPassword) { showToast("The new passwords do not match"); return; }
      ui.accountBusy = true;
      render();
      try {
        await accountClient.changePassword(currentPassword, newPassword);
        ui.accountBusy = false;
        ui.accountAction = null;
        ui.accountPanelLoaded = false;
        render();
        refreshAccountPanelData().catch(() => {});
        showToast("Password changed. Other devices were signed out.");
      } catch (error) {
        ui.accountBusy = false;
        render();
        showToast(error?.message || "Bridge could not change the password");
      }
      return;
    }

    const password = String(form.get("password") || "");
    const confirmation = String(form.get("confirmation") || "").trim().toUpperCase();
    if (action.type === "restore-backup") {
      if (confirmation !== "RESTORE") { showToast("Type RESTORE to continue"); return; }
      ui.accountBusy = true;
      render();
      try {
        const restored = await accountClient.restoreBackup(action.backupId, password, confirmation);
        if (restored?.state) state = normalizeState(restored.state);
        ui.accountBusy = false;
        ui.accountAction = null;
        ui.settingsOpen = false;
        applyFixedAppearance();
        render();
        showToast("Cloud backup restored");
      } catch (error) {
        ui.accountBusy = false;
        render();
        showToast(error?.message || "Bridge could not restore that backup");
      }
      return;
    }

    if (confirmation !== "DELETE") { showToast("Type DELETE to continue"); return; }
    ui.accountBusy = true;
    render();
    try {
      await accountClient.deleteAccount(password, confirmation);
      ui.accountAction = null;
      showSignedOutAccount("Your Bridge account was deleted.");
    } catch (error) {
      ui.accountBusy = false;
      render();
      showToast(error?.message || "Bridge could not delete this account");
    }
  });
  requestAnimationFrame(() => $("#accountActionForm input")?.focus());
}

function render() {
  const app = $("#app");
  profileHeaderScrollCleanup?.();
  profileHeaderScrollCleanup=null;
  profileHeaderScrollSync=null;
  if (ui.sharedScorecard || ui.sharedScorecardLoading || ui.sharedScorecardError) {
    syncDocumentScrollLock(false);
    app.innerHTML = renderSharedScorecard();
    bindSharedScorecardEvents();
    return;
  }
  const previousNavSelection=lastRenderedNavSelection;
  const nextNavSelection=navSelectionIndex();
  const nextPresentationKey=ui.routedScreen?presentationPath():"";
  ui.routeEntryMotion=nextPresentationKey&&nextPresentationKey!==lastRenderedPresentationKey?ui.routeDirection:"";
  const transientModalOpen=Boolean(ui.confirmation||ui.quickCreateOpen||ui.peopleFiltersOpen||ui.communicationContactId||ui.actionEditId||ui.releaseNotesOpen||ui.accountMigrationOpen||ui.accountAction||(ui.settingsOpen&&ui.routedScreen!=="settings")||(ui.achievementsOpen&&ui.routedScreen!=="achievements")||(ui.pipelineStageDetail&&ui.routedScreen!=="pipeline-stage")||(ui.pipelineContactId&&ui.routedScreen!=="stage-transition")||(ui.customerPipelineStageDetail&&ui.routedScreen!=="pipeline-stage")||(ui.customerPipelineContactId&&ui.routedScreen!=="stage-transition")||(ui.placeDetailId&&ui.routedScreen!=="place")||(ui.detailId&&!["person","person-edit"].includes(ui.routedScreen))||(ui.activityHistoryContactId&&ui.routedScreen!=="person-timeline")||(ui.scorecardShareOpen&&ui.routedScreen!=="scorecard"));
  syncDocumentScrollLock(transientModalOpen);
  app.innerHTML = `${AppShell(renderPage(), { inert: Boolean(ui.accountAction||ui.confirmation) })}${ui.settingsOpen && ui.routedScreen!=="settings" ? settingsModal() : ""}${ui.achievementsOpen && ui.routedScreen!=="achievements" ? achievementsModal() : ""}${ui.quickCreateOpen ? quickCreateModal() : ""}${ui.peopleFiltersOpen ? peopleFilterSheet(peopleVisibleContacts().length) : ""}${ui.actionEditId ? followUpRescheduleSheet() : ""}${ui.placeDetailId && ui.routedScreen!=="place" ? placeDetailSheet(ui.placeDetailId) : ""}${ui.detailId && !["person","person-edit"].includes(ui.routedScreen) ? contactModal(ui.detailId) : ""}${ui.activityHistoryContactId && ui.routedScreen!=="person-timeline" ? activityHistoryModal(ui.activityHistoryContactId) : ""}${ui.communicationContactId ? communicationLogModal(ui.communicationContactId) : ""}${ui.scorecardShareOpen && ui.routedScreen!=="scorecard" ? scorecardShareModal() : ""}${ui.releaseNotesOpen ? releaseNotesModal() : ""}${ui.accountMigrationOpen ? accountMigrationModal() : ""}${ui.accountAction ? accountActionModal() : ""}${ui.confirmation ? confirmationDialog() : ""}`;
  lastRenderedPresentationKey=nextPresentationKey;
  ui.routeEntryMotion="";
  lastRenderedNavSelection=nextNavSelection;
  bindCommonEvents();
  bindSharedPrimitiveEvents();
  if (ui.confirmation) bindConfirmationEvents();
  bindPageEvents();
  if (ui.settingsOpen) bindSettingsEvents();
  if (ui.achievementsOpen) bindAchievementEvents();
  if (ui.quickCreateOpen) bindQuickCreateEvents();
  if (ui.detailId) bindContactModalEvents();
  if (ui.activityHistoryContactId) bindActivityHistoryEvents();
  if (ui.communicationContactId) bindCommunicationLogEvents();
  if (ui.scorecardShareOpen) bindScorecardShareEvents();
  if (ui.releaseNotesOpen) bindReleaseNotesEvents();
  if (ui.accountMigrationOpen) bindAccountMigrationEvents();
  if (ui.accountAction) bindAccountActionEvents();
  const navIndicator=$('.nav-selection-indicator');
  if(navIndicator&&previousNavSelection!==null&&previousNavSelection!==nextNavSelection&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    const from=previousNavSelection;const to=nextNavSelection;
    const frames=from<0&&to>=0?[{transform:`translateX(${to*100}%)`,opacity:0},{transform:`translateX(${to*100}%)`,opacity:1}]
      :from>=0&&to<0?[{transform:`translateX(${from*100}%)`,opacity:1},{transform:`translateX(${from*100}%)`,opacity:0}]
      :[{transform:`translateX(${from*100}%)`,opacity:1},{transform:`translateX(${to*100}%)`,opacity:1}];
    navIndicator.animate(frames,{duration:320,easing:'cubic-bezier(.16,1,.3,1)'});
  }
  if (pendingNotificationNavigationURL && stateHydrated && !blockingModalOpen()) setTimeout(resumePendingNotificationNavigation, 0);
}

function renderSharedScorecard() {
  if (ui.sharedScorecardLoading) return `<main class="shared-scorecard-shell"><div class="shared-scorecard-loading">${LoadingSkeleton({ lines: 3, className: "shared-scorecard-skeleton" })}<strong>Opening shared scorecard</strong><span>Preparing this read-only relationship summary.</span></div></main>`;
  if (ui.sharedScorecardError) return `<main class="shared-scorecard-shell">${SurfaceCard(`<div class="shared-brand"><span class="shared-brand-symbol" aria-hidden="true">${icons.bridge}</span><span>Bridge CRM</span></div><div class="shared-scorecard-head"><span class="ui-eyebrow">Private link</span><h1 class="ui-editorial-heading">Scorecard unavailable</h1><p>${escapeHTML(ui.sharedScorecardError)}</p></div><p class="shared-read-only">This link may have expired or been revoked.</p>`, { className: "shared-scorecard shared-scorecard--error", raised: true })}</main>`;
  const scorecard = ui.sharedScorecard;
  const metrics = scorecard.metrics || {};
  const contacts = Array.isArray(scorecard.contacts) ? scorecard.contacts : [];
  const owner = escapeHTML(scorecard.ownerName || "Bridge");
  const metricGrid = MetricGrid(`${MetricCard(String(metrics.conversations || 0), "Conversations", { iconName: "chart" })}${MetricCard(String(metrics.contacts || 0), "Contacts", { iconName: "contactCard" })}${MetricCard(String(metrics.prospects || 0), "Prospects", { iconName: "people" })}${MetricCard(String(metrics.prospectiveCustomers || 0), "Prospective Customers", { iconName: "target" })}`, { className: "shared-metrics", label: "Shared scorecard metrics" });
  const contactDisclosure = scorecard.includeContacts && contacts.length
    ? `${SurfaceCard(`${SectionHeader("New relationships", { eyebrow: "Shared with consent", action: StatusBadge(String(contacts.length), "brand"), level: 2 })}<p class="shared-contact-disclosure">Only name, role, stage, and place are included.</p><button class="button subtle shared-contacts-button" id="toggleSharedContacts" type="button" aria-expanded="${ui.sharedScorecardContactsOpen}" aria-controls="sharedContactList">${icons.people}<span>${ui.sharedScorecardContactsOpen ? "Hide new contacts" : `View ${contacts.length} new contact${contacts.length === 1 ? "" : "s"}`}</span></button>${ui.sharedScorecardContactsOpen ? `<section class="shared-contact-list" id="sharedContactList" aria-label="Shared contacts">${contacts.map(sharedScorecardContact).join("")}</section>` : ""}`, { cream: true, className: "shared-contacts-surface" })}`
    : `<p class="shared-privacy-note">This scorecard was shared without contact details.</p>`;
  return `<main class="shared-scorecard-shell">${SurfaceCard(`<div class="shared-brand"><span class="shared-brand-symbol" aria-hidden="true">${icons.bridge}</span><span>Bridge CRM</span></div><header class="shared-scorecard-head"><span class="ui-eyebrow">Shared by ${owner}</span><h1 class="ui-editorial-heading">${owner}'s Scorecard</h1><p>${escapeHTML(scorecard.periodLabel || "Today")}</p></header>${metricGrid}<p class="shared-summary">${escapeHTML(`${metrics.conversations || 0} conversation${Number(metrics.conversations) === 1 ? "" : "s"} in this period`)}</p>${contactDisclosure}<p class="shared-read-only">Read-only scorecard · Contact details are shown only when the sender opted in.</p>`, { className: "shared-scorecard", raised: true })}</main>`;
}

function sharedScorecardContact(contact) {
  const meta = [contact.role, contact.pipelineStage, contact.placeName].filter(Boolean).map(escapeHTML).join(" · ");
  return `<article class="shared-contact-row"><div class="avatar">${escapeHTML(contact.initials || initials(contact.name))}</div><div><strong>${escapeHTML(contact.name)}</strong>${meta ? `<span class="muted">${meta}</span>` : ""}</div></article>`;
}

function bindSharedScorecardEvents() {
  $("#toggleSharedContacts")?.addEventListener("click", () => { ui.sharedScorecardContactsOpen = !ui.sharedScorecardContactsOpen; render(); });
}

function blockingModalOpen() {
  return Boolean(ui.confirmation||ui.quickCreateOpen||ui.peopleFiltersOpen||ui.communicationContactId||ui.actionEditId||ui.releaseNotesOpen||ui.accountMigrationOpen||ui.accountAction||(ui.settingsOpen&&ui.routedScreen!=="settings")||(ui.achievementsOpen&&ui.routedScreen!=="achievements")||(ui.pipelineStageDetail&&ui.routedScreen!=="pipeline-stage")||(ui.pipelineContactId&&ui.routedScreen!=="stage-transition")||(ui.customerPipelineStageDetail&&ui.routedScreen!=="pipeline-stage")||(ui.customerPipelineContactId&&ui.routedScreen!=="stage-transition")||(ui.placeDetailId&&ui.routedScreen!=="place")||(ui.detailId&&!["person","person-edit"].includes(ui.routedScreen))||(ui.activityHistoryContactId&&ui.routedScreen!=="person-timeline")||(ui.scorecardShareOpen&&ui.routedScreen!=="scorecard"));
}

function requestConfirmation({ title, message, confirmLabel = "Confirm", danger = false, onConfirm, onCancel = null }) {
  if (ui.confirmation) return false;
  ui.confirmation = { title, message, confirmLabel, danger, onConfirm, onCancel };
  render();
  return true;
}

function confirmationDialog() {
  const confirmation=ui.confirmation;
  if(!confirmation)return "";
  return ConfirmDialog(confirmation.title,confirmation.message,{
    id:"bridgeConfirmDialog",
    className:confirmation.danger?"ui-confirm-dialog--danger":"",
    confirmLabel:confirmation.confirmLabel,
    confirmAttributes:'id="bridgeConfirmAction"'
  });
}

function bindConfirmationEvents() {
  const confirmation=ui.confirmation;
  const dialog=$("#bridgeConfirmDialog [data-ui-dialog]");
  if(!confirmation||!dialog)return;
  let resolved=false;
  const cancel=()=>{
    if(resolved)return;
    resolved=true;
    if(ui.confirmation===confirmation)ui.confirmation=null;
    confirmation.onCancel?.();
  };
  dialog.addEventListener("bridge:dialogclose",cancel,{once:true});
  $("#bridgeConfirmAction")?.addEventListener("click",()=>{
    if(resolved)return;
    resolved=true;
    if(ui.confirmation===confirmation)ui.confirmation=null;
    confirmation.onConfirm?.();
  },{once:true});
}

function releaseNotesModal() {
  const items = APP_RELEASE.items.map(item => `<li class="release-note-item"><div class="release-note-icon">${icons[item.icon] || icons.sparkles}</div><div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.description)}</p></div></li>`).join("");
  return `<div class="modal-backdrop release-notes-backdrop" id="releaseNotesBackdrop"><section class="modal release-notes-modal" role="dialog" aria-modal="true" aria-labelledby="releaseNotesTitle" aria-describedby="releaseNotesVersion"><div class="release-notes-scroll"><header class="release-notes-header"><span class="release-notes-mark" aria-hidden="true">${icons.bridge}</span><h2 id="releaseNotesTitle">${escapeHTML(APP_RELEASE.title)}</h2><p id="releaseNotesVersion">Version ${escapeHTML(APP_RELEASE.version)}</p></header><ul class="release-notes-list">${items}</ul></div><footer class="release-notes-actions"><button class="button primary" id="continueReleaseNotes" type="button">${icons.circleCheck}<span>Continue</span></button></footer></section></div>`;
}

function releaseFocusableElements() {
  return $$('#releaseNotesBackdrop button:not([disabled]), #releaseNotesBackdrop [href], #releaseNotesBackdrop input:not([disabled]), #releaseNotesBackdrop select:not([disabled]), #releaseNotesBackdrop textarea:not([disabled]), #releaseNotesBackdrop [tabindex]:not([tabindex="-1"])');
}

function quickCreateFocusableElements() {
  return $$('#quickCreateBackdrop button:not([disabled]), #quickCreateBackdrop [href], #quickCreateBackdrop input:not([disabled]), #quickCreateBackdrop select:not([disabled]), #quickCreateBackdrop textarea:not([disabled]), #quickCreateBackdrop [tabindex]:not([tabindex="-1"])');
}

function settingsFocusableElements() {
  return $$('#settingsBackdrop button:not([disabled]), #settingsBackdrop [href], #settingsBackdrop input:not([disabled]), #settingsBackdrop select:not([disabled]), #settingsBackdrop textarea:not([disabled]), #settingsBackdrop [tabindex]:not([tabindex="-1"])');
}

function scorecardFocusableElements() {
  return $$('#scorecardShareBackdrop button:not([disabled]), #scorecardShareBackdrop [href], #scorecardShareBackdrop input:not([disabled]), #scorecardShareBackdrop select:not([disabled]), #scorecardShareBackdrop textarea:not([disabled]), #scorecardShareBackdrop [tabindex]:not([tabindex="-1"])');
}

function accountActionFocusableElements() {
  return $$('#accountActionBackdrop button:not([disabled]), #accountActionBackdrop [href], #accountActionBackdrop input:not([disabled]), #accountActionBackdrop select:not([disabled]), #accountActionBackdrop textarea:not([disabled]), #accountActionBackdrop [tabindex]:not([tabindex="-1"])');
}

function closeScorecardShare() {
  if(ui.routedScreen==="scorecard"){presentationBack();return;}
  ui.scorecardShareOpen = false;
  ui.scorecardShareBusy = false;
  ui.scorecardCreated = null;
  render();
  requestAnimationFrame(() => {
    if (scorecardFocusReturn?.isConnected) scorecardFocusReturn.focus();
    else $("#shareScorecard")?.focus();
    scorecardFocusReturn = null;
  });
  if(!ui.accountBusy)requestAnimationFrame(()=>accountActionFocusableElements()[0]?.focus({preventScroll:true}));
}

function closeSettings() {
  if(ui.routedScreen==="settings"){presentationBack();return;}
  ui.settingsOpen=false;ui.settingsExcludedDatesDraft=null;ui.settingsRestRulesDraft=null;
  render();
  requestAnimationFrame(()=>{if(settingsFocusReturn?.isConnected)settingsFocusReturn.focus();settingsFocusReturn=null;});
}

function closeReleaseNotes() {
  markReleaseSeen(undefined, APP_RELEASE);
  ui.releaseNotesOpen = false;
  const returnToSettings = ui.releaseNotesReturnToSettings;
  ui.releaseNotesReturnToSettings = false;
  if (returnToSettings) {
    ui.settingsOpen = true;
    render();
    requestAnimationFrame(() => $("#openReleaseNotes")?.focus());
    return;
  }
  render();
  requestAnimationFrame(() => {
    if (releaseFocusReturn?.isConnected) releaseFocusReturn.focus();
    releaseFocusReturn = null;
  });
}

function bindReleaseNotesEvents() {
  $("#continueReleaseNotes")?.addEventListener("click", closeReleaseNotes);
  requestAnimationFrame(() => $("#continueReleaseNotes")?.focus());
}

function shellProfile() {
  const accountUser = accountContext.user || {};
  const name = [accountUser.firstName, accountUser.lastName].filter(Boolean).join(" ") || state.settings.firstName || "Your workspace";
  return `<div class="shell-profile"><span class="shell-profile__avatar" aria-hidden="true">${escapeHTML(initials(name))}</span><span class="shell-profile__copy"><strong>${escapeHTML(name)}</strong><small>${escapeHTML(accountSyncLabel())}</small></span></div>`;
}
function pageHead(title, subtitle, actions = "") { return `<header class="page-head"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="head-actions">${actions}</div></header>`; }

function syncDocumentScrollLock(shouldLock) {
  if (shouldLock) {
    if (lockedDocumentScrollY !== null) return;
    cancelPendingScrollState();
    lockedDocumentScrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.inset = `${-lockedDocumentScrollY}px 0 auto`;
    document.body.style.width = "100%";
    document.body.classList.add("modal-open");
    document.documentElement.classList.add("modal-open");
    return;
  }
  document.body.classList.remove("modal-open");
  document.documentElement.classList.remove("modal-open");
  if (lockedDocumentScrollY === null) return;
  const restoreY = lockedDocumentScrollY;
  const previousBehavior = document.documentElement.style.scrollBehavior;
  lockedDocumentScrollY = null;
  document.body.style.removeProperty("position");
  document.body.style.removeProperty("inset");
  document.body.style.removeProperty("width");
  document.documentElement.style.scrollBehavior = "auto";
  window.scrollTo(0, restoreY);
  document.documentElement.style.scrollBehavior = previousBehavior;
  requestAnimationFrame(() => {
    if (lockedDocumentScrollY !== null) return;
    const behavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, restoreY);
    document.documentElement.style.scrollBehavior = behavior;
  });
}

function springProgress(seconds, { stiffness, damping }) {
  const naturalFrequency=Math.sqrt(stiffness);
  const dampingRatio=damping/(2*naturalFrequency);
  if(dampingRatio<1){
    const dampedFrequency=naturalFrequency*Math.sqrt(1-dampingRatio*dampingRatio);
    const envelope=Math.exp(-dampingRatio*naturalFrequency*seconds);
    return 1-envelope*(Math.cos(dampedFrequency*seconds)+(dampingRatio*naturalFrequency/dampedFrequency)*Math.sin(dampedFrequency*seconds));
  }
  return 1-Math.exp(-naturalFrequency*seconds)*(1+naturalFrequency*seconds);
}

function springKeyframes(from, to, motion=REFERENCE_MOTION.tab, steps=24) {
  const durationSeconds=motion.settleMs/1000;
  const values=[];
  for(let index=0;index<=steps;index+=1){
    const offset=index/steps;
    const progress=index===steps?1:springProgress(durationSeconds*offset,motion);
    values.push({value:from+(to-from)*progress,offset});
  }
  return values;
}

function bindTravelingTabIndicator(tablist) {
  const indicator=$('.ui-tabs__indicator',tablist);
  const active=$('[role="tab"][aria-selected="true"]',tablist);
  if(!indicator||!active)return;
  const computed=getComputedStyle(active);
  const insetLeft=Number.parseFloat(computed.paddingLeft)||0;
  const insetRight=Number.parseFloat(computed.paddingRight)||0;
  const current={x:active.offsetLeft+insetLeft-tablist.scrollLeft,width:Math.max(2,active.offsetWidth-insetLeft-insetRight)};
  const key=String(tablist.dataset.uiTabKey||tablist.getAttribute('aria-label')||'tabs');
  const previous=tabIndicatorMetrics.get(key);
  tabIndicatorMetrics.set(key,current);
  indicator.style.width=`${current.width}px`;
  indicator.style.transform=`translate3d(${current.x}px,0,0)`;
  if(!previous||matchMedia('(prefers-reduced-motion: reduce)').matches||(Math.abs(previous.x-current.x)<.5&&Math.abs(previous.width-current.width)<.5))return;
  if(typeof indicator.animate!=="function"){
    indicator.style.transition='none';
    indicator.style.width=`${previous.width}px`;
    indicator.style.transform=`translate3d(${previous.x}px,0,0)`;
    void indicator.offsetWidth;
    indicator.style.transition='transform 420ms cubic-bezier(.16,1,.3,1), width 420ms cubic-bezier(.16,1,.3,1)';
    requestAnimationFrame(()=>{indicator.style.width=`${current.width}px`;indicator.style.transform=`translate3d(${current.x}px,0,0)`;});
    setTimeout(()=>indicator.style.removeProperty('transition'),REFERENCE_MOTION.tab.settleMs);
    return;
  }
  indicator._bridgeAnimation?.cancel?.();
  const xFrames=springKeyframes(previous.x,current.x);
  const widthFrames=springKeyframes(previous.width,current.width);
  indicator._bridgeAnimation=indicator.animate(xFrames.map((frame,index)=>({offset:frame.offset,transform:`translate3d(${frame.value}px,0,0)`,width:`${widthFrames[index].value}px`})),{duration:REFERENCE_MOTION.tab.settleMs,easing:'linear'});
}

function bindBottomSheetGesture(sheet, dismiss) {
  if(!sheet||sheet.dataset.uiSheetBound==='true'||typeof dismiss!=="function")return;
  sheet.dataset.uiSheetBound='true';
  const backdrop=sheet.closest('[data-ui-sheet-backdrop]');
  const scrollRoot=$('[data-ui-sheet-scroll]',sheet);
  const dragRegion=$('[data-ui-sheet-drag-region]',sheet);
  let gesture=null;
  let snapAnimation=null;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clearDragStyles=()=>{
    sheet.classList.remove('is-dragging','is-snapping','is-drag-dismissing');
    backdrop?.classList.remove('is-dragging');
    sheet.style.removeProperty('transform');
    backdrop?.style.removeProperty('--sheet-drag-progress');
  };
  const snapBack=distance=>{
    if(reduced){clearDragStyles();return;}
    sheet.classList.remove('is-dragging');
    sheet.classList.add('is-snapping');
    backdrop?.classList.remove('is-dragging');
    snapAnimation?.cancel?.();
    if(typeof sheet.animate!=="function"){
      sheet.style.transition='transform 460ms cubic-bezier(.16,1,.3,1)';
      requestAnimationFrame(()=>{sheet.style.transform='translate3d(0,0,0)';});
      setTimeout(()=>{sheet.style.removeProperty('transition');clearDragStyles();},REFERENCE_MOTION.sheet.settleMs);
      return;
    }
    const frames=springKeyframes(Math.max(0,distance),0,REFERENCE_MOTION.sheet,28);
    snapAnimation=sheet.animate(frames.map(frame=>({offset:frame.offset,transform:`translate3d(0,${frame.value}px,0)`})),{duration:REFERENCE_MOTION.sheet.settleMs,easing:'linear'});
    snapAnimation.finished.catch(()=>{}).finally(clearDragStyles);
  };
  const dismissFrom=distance=>{
    sheet.classList.remove('is-dragging');
    sheet.classList.add('is-drag-dismissing');
    backdrop?.classList.remove('is-dragging');
    if(backdrop)backdrop.dataset.uiDraggedDismiss='true';
    if(reduced){dismiss();return;}
    const end=Math.max(innerHeight,sheet.getBoundingClientRect().height+40);
    if(typeof sheet.animate!=="function"){
      sheet.style.transition='transform 180ms cubic-bezier(.4,0,1,1)';
      backdrop?.style.setProperty('transition','background-color 180ms ease-in, backdrop-filter 180ms ease-in');
      requestAnimationFrame(()=>{sheet.style.transform=`translate3d(0,${end}px,0)`;if(backdrop){backdrop.style.backgroundColor='rgba(27,25,19,0)';backdrop.style.backdropFilter='blur(0px)';}});
      setTimeout(dismiss,180);
      return;
    }
    const sheetAnimation=sheet.animate([{transform:`translate3d(0,${Math.max(0,distance)}px,0)`},{transform:`translate3d(0,${end}px,0)`}],{duration:180,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
    backdrop?.animate([{backgroundColor:'rgba(27,25,19,.35)',backdropFilter:'blur(2px)'},{backgroundColor:'rgba(27,25,19,0)',backdropFilter:'blur(0px)'}],{duration:180,easing:'ease-in',fill:'forwards'});
    sheetAnimation.finished.catch(()=>{}).finally(dismiss);
  };
  const beginGesture=(id,x,y,target)=>{
    const inDragRegion=Boolean(dragRegion?.contains(target));
    const inScroll=Boolean(scrollRoot?.contains(target));
    if(!inDragRegion&&!inScroll)return;
    if(inScroll&&(scrollRoot?.scrollTop||0)>0)return;
    if(!inDragRegion&&target.closest('button,a,input,select,textarea,[contenteditable="true"],summary,label'))return;
    gesture={id,startX:x,startY:y,lastY:y,lastAt:performance.now(),distance:0,velocity:0,dragging:false};
  };
  const moveGesture=(id,x,y,at,preventDefault)=>{
    if(!gesture||id!==gesture.id)return;
    const dx=x-gesture.startX;
    const dy=Math.max(0,y-gesture.startY);
    if(!gesture.dragging){
      if(Math.abs(dx)>Math.abs(dy)+8){gesture=null;return;}
      if(dy<7)return;
      if(scrollRoot&&(scrollRoot.scrollTop||0)>0){gesture=null;return;}
      gesture.dragging=true;
      sheet.classList.add('is-dragging');
      backdrop?.classList.add('is-dragging');
    }
    preventDefault?.();
    const elapsed=Math.max(1,at-gesture.lastAt);
    gesture.velocity=(y-gesture.lastY)/elapsed;
    gesture.lastY=y;
    gesture.lastAt=at;
    gesture.distance=dy;
    const resisted=dy>innerHeight*.55?innerHeight*.55+(dy-innerHeight*.55)*.25:dy;
    const progress=Math.min(1,resisted/Math.max(1,sheet.getBoundingClientRect().height));
    sheet.style.transform=`translate3d(0,${resisted}px,0)`;
    backdrop?.style.setProperty('--sheet-drag-progress',String(progress));
  };
  const finishGesture=id=>{
    if(!gesture||id!==gesture.id)return;
    const current=gesture;
    gesture=null;
    if(!current.dragging)return;
    const threshold=Math.min(180,Math.max(96,sheet.getBoundingClientRect().height*.24));
    if(current.distance>=threshold||(current.distance>=64&&current.velocity>.65))dismissFrom(current.distance);
    else snapBack(current.distance);
  };
  const cancelGesture=id=>{if(!gesture||id!==gesture.id)return;const distance=gesture.distance;gesture=null;snapBack(distance);};
  if('PointerEvent' in globalThis){
    sheet.addEventListener('pointerdown',event=>{if(event.button!==0)return;beginGesture(event.pointerId,event.clientX,event.clientY,event.target);});
    sheet.addEventListener('pointermove',event=>{moveGesture(event.pointerId,event.clientX,event.clientY,event.timeStamp,()=>{if(event.cancelable)event.preventDefault();try{sheet.setPointerCapture(event.pointerId);}catch{}});},{passive:false});
    sheet.addEventListener('pointerup',event=>finishGesture(event.pointerId));
    sheet.addEventListener('pointercancel',event=>cancelGesture(event.pointerId));
  } else {
    const mouseMove=event=>moveGesture('mouse',event.clientX,event.clientY,event.timeStamp,()=>event.preventDefault());
    const mouseUp=()=>{window.removeEventListener('mousemove',mouseMove);window.removeEventListener('mouseup',mouseUp);finishGesture('mouse');};
    sheet.addEventListener('mousedown',event=>{if(event.button!==0)return;beginGesture('mouse',event.clientX,event.clientY,event.target);if(gesture?.id==='mouse'){window.addEventListener('mousemove',mouseMove,{passive:false});window.addEventListener('mouseup',mouseUp);}});
    sheet.addEventListener('touchstart',event=>{const touch=event.changedTouches[0];if(touch)beginGesture(touch.identifier,touch.clientX,touch.clientY,event.target);},{passive:true});
    sheet.addEventListener('touchmove',event=>{const touch=Array.from(event.changedTouches).find(item=>item.identifier===gesture?.id);if(touch)moveGesture(touch.identifier,touch.clientX,touch.clientY,event.timeStamp,()=>{if(event.cancelable)event.preventDefault();});},{passive:false});
    sheet.addEventListener('touchend',event=>{const touch=Array.from(event.changedTouches).find(item=>item.identifier===gesture?.id);if(touch)finishGesture(touch.identifier);});
    sheet.addEventListener('touchcancel',event=>{const touch=Array.from(event.changedTouches).find(item=>item.identifier===gesture?.id);if(touch)cancelGesture(touch.identifier);});
  }
}

function bindSharedPrimitiveEvents() {
  const focusable = root => $$('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', root).filter(element => !element.hidden);
  const closeDialog = dialog => {
    if (dialog.dataset.uiClosing === "true") return;
    dialog.dataset.uiClosing = "true";
    const returnFocus = dialog._uiReturnFocus;
    dialog.dispatchEvent(new CustomEvent("bridge:dialogclose", { bubbles:true }));
    const backdrop=dialog.closest('[data-ui-dialog-backdrop]');
    backdrop?.classList.add('is-closing');
    const finish=()=>{
      backdrop?.remove();
      if(!document.querySelector('[data-ui-dialog]')){
        const shell=$('.bridge-pattern-shell');
        if(shell){shell.inert=false;shell.removeAttribute('aria-hidden');}
      }
      if(!blockingModalOpen())syncDocumentScrollLock(false);
      if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true});
      if (pendingNotificationNavigationURL && stateHydrated && !blockingModalOpen()) setTimeout(resumePendingNotificationNavigation, 0);
    };
    if (backdrop?.dataset.uiDraggedDismiss==='true'||matchMedia('(prefers-reduced-motion: reduce)').matches) finish();
    else setTimeout(finish, 180);
  };
  const activateTab = (tab, moveFocus=false) => {
    const tablist = tab.closest('[role="tablist"]');
    if (!tablist) return;
    $$('[role="tab"]', tablist).forEach(candidate => {
      const selected = candidate === tab;
      candidate.setAttribute("aria-selected", String(selected));
      candidate.tabIndex = selected ? 0 : -1;
      const panelId=candidate.getAttribute("aria-controls");
      const panel = panelId ? document.getElementById(panelId) : null;
      if (panel) panel.hidden = !selected;
    });
    if (moveFocus) tab.focus();
  };
  $$('.ui-tabs').forEach(tablist => {
    bindTravelingTabIndicator(tablist);
    tablist.addEventListener('click', event => { const tab=event.target.closest('[role="tab"]'); if(tab) activateTab(tab); });
    tablist.addEventListener('keydown', event => {
      const tabs=$$('[role="tab"]',tablist); const current=event.target.closest('[role="tab"]'); if(!current||!tabs.length)return;
      const index=tabs.indexOf(current); let next=null;
      if(event.key==='ArrowRight'||event.key==='ArrowDown')next=tabs[(index+1)%tabs.length];
      if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=tabs[(index-1+tabs.length)%tabs.length];
      if(event.key==='Home')next=tabs[0]; if(event.key==='End')next=tabs.at(-1);
      if(next){event.preventDefault();next.click();next.focus();}
    });
  });
  $$('[data-ui-dialog]').forEach(dialog => {
    dialog._uiReturnFocus=document.activeElement;
    const initial=focusable(dialog)[0];
    const shell=$('.bridge-pattern-shell');
    requestAnimationFrame(()=>{if(initial)initial.focus();if(shell&&!shell.contains(dialog)){shell.inert=true;shell.setAttribute('aria-hidden','true');}});
    dialog.addEventListener('keydown', event => {
      if(event.key==='Escape'){event.preventDefault();closeDialog(dialog);return;}
      if(event.key!=='Tab')return;
      const items=focusable(dialog); if(!items.length)return;
      const first=items[0], last=items.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    });
    $$('[data-ui-dialog-close]',dialog).forEach(button=>button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();closeDialog(dialog);}));
    const backdrop=dialog.closest('[data-ui-dialog-backdrop]');
    backdrop?.addEventListener('click',event=>{if(event.target!==backdrop)return;event.preventDefault();event.stopImmediatePropagation();closeDialog(dialog);});
    if(dialog.matches('[data-ui-sheet]'))bindBottomSheetGesture(dialog,()=>closeDialog(dialog));
  });
}

function quickCaptureContactOptions(contacts,{allowNew=false}={}) { return `${allowNew?'<option value="">New person</option>':'<option value="">Choose a person</option>'}${contacts.map(contact=>`<option value="${escapeHTML(contact.id)}" ${String(ui.quickCreateContactId)===String(contact.id)?"selected":""}>${escapeHTML(contact.fullName)}</option>`).join("")}`; }
function quickCaptureStageOptions() { return `<option value="">No stage change</option><optgroup label="Prospect">${PIPELINES.Prospect.map(stage=>`<option value="${escapeHTML(stage)}" data-stage-role="Prospect">${escapeHTML(stage)}</option>`).join("")}</optgroup><optgroup label="Customer">${PIPELINES.Customer.map(stage=>`<option value="${escapeHTML(stage)}" data-stage-role="Customer">${escapeHTML(stage)}</option>`).join("")}</optgroup>`; }
function quickCaptureError(form,message) { const target=$('.quick-capture-error',form); if(target){target.hidden=false;target.textContent=message;target.focus();} }
function quickCaptureErrorState() { return '<p class="quick-capture-error" role="alert" tabindex="-1" hidden></p>'; }
function quickCaptureBack() { return '<button class="quick-create-back" type="button">Back</button>'; }
function quickCaptureAdvanced(content,label="Add relationship details") { return `<details class="quick-capture-advanced"><summary><span>${escapeHTML(label)}</span>${icons.chevronDown}</summary><div>${content}</div></details>`; }
function ActivitySelector({ selected = [], label = "Relevant activity", hint = "Select either or both when they happened." } = {}) {
  const active = new Set(selected);
  return `<fieldset class="activity-selector"><legend>${escapeHTML(label)}</legend><p>${escapeHTML(hint)}</p><div>${["MSA","DTM"].map(stage=>`<label class="activity-selector__option"><input type="checkbox" name="${stageInputName(stage)}" value="${stage}" ${active.has(stage)?"checked":""}><span><strong>${stage}</strong><small>${stage==="MSA"?"Made aware":"Drop the message"}</small></span></label>`).join("")}</div></fieldset>`;
}
function quickCaptureRecentContacts(contacts,limit=6) { const ordered=[...contacts].sort((left,right)=>new Date(peopleActivityAt(right)||0)-new Date(peopleActivityAt(left)||0)||String(left.fullName||"").localeCompare(String(right.fullName||"")));const selectedIndex=ordered.findIndex(contact=>String(contact.id)===String(ui.quickCreateContactId||""));if(selectedIndex>0)ordered.unshift(...ordered.splice(selectedIndex,1));return ordered.slice(0,limit); }
function quickCapturePersonPicker(contacts,{allowNew=false}={}) {
  const selectedId=String(ui.quickCreateContactId||"");
  const recent=quickCaptureRecentContacts(contacts);
  const recentIds=new Set(recent.map(contact=>String(contact.id)));const ordered=[...recent,...contacts.filter(contact=>!recentIds.has(String(contact.id)))];
  return `<div class="quick-capture-picker" data-capture-person-picker><input type="hidden" name="contactId" value="${escapeHTML(selectedId)}"><label class="quick-capture-picker__search"><span class="sr-only">Search people</span>${icons.search}<input type="search" data-capture-person-search autocomplete="off" autocapitalize="words" placeholder="Who did you meet?"></label><div class="quick-capture-picker__heading"><span>${recent.length?"Recent people":"People"}</span><small data-capture-person-count>${recent.length}</small></div><div class="quick-capture-picker__list" data-capture-person-list>${ordered.map(contact=>{const selected=selectedId===String(contact.id);return `<button type="button" class="quick-capture-picker__row${selected?" is-selected":""}" data-capture-person-id="${escapeHTML(contact.id)}" data-capture-recent="${recentIds.has(String(contact.id))}" data-capture-search-value="${escapeHTML([contact.fullName,contact.placeName,contact.phoneNumber,contact.email].filter(Boolean).join(" ").toLowerCase())}" aria-pressed="${selected}" ${recentIds.has(String(contact.id))?"":"hidden"}>${Avatar(contact.fullName,{size:"small"})}<span><strong>${escapeHTML(contact.fullName||"Unnamed person")}</strong><small>${escapeHTML(peopleRelativeDate(peopleActivityAt(contact)))}</small></span><span class="quick-capture-picker__selected" data-capture-selected aria-hidden="true">${selected?"Selected":""}</span></button>`;}).join("")}</div>${allowNew?`<button class="quick-capture-picker__new" type="button" data-capture-new-person hidden>${icons.userPlus}<span>Add <strong data-capture-new-person-label>new person</strong></span>${icons.chevronRight}</button><div data-new-person-name hidden>${field("New person name",'<input name="fullName" autocomplete="name" placeholder="Full name">')}</div>`:""}</div>`;
}
function quickCapturePlaceActivityMap() {
  const activity=new Map();
  for(const contact of state.contacts){
    const at=peopleActivityAt(contact);if(!at)continue;
    const keys=[contact.placeId?`id:${String(contact.placeId)}`:"",contact.placeName?`name:${String(contact.placeName).toLowerCase()}`:""].filter(Boolean);
    for(const key of keys){const current=activity.get(key);if(!current||new Date(at)>new Date(current))activity.set(key,at);}
  }
  return activity;
}
function quickCapturePlaceActivityAt(place,activity=quickCapturePlaceActivityMap()) {
  return activity.get(`id:${String(place.id)}`)||activity.get(`name:${String(place.name||"").toLowerCase()}`)||null;
}
function quickCapturePlacePicker() {
  const activity=quickCapturePlaceActivityMap();
  const places=[...state.places].sort((left,right)=>Number(right.isFavorite)-Number(left.isFavorite)||new Date(quickCapturePlaceActivityAt(right,activity)||0)-new Date(quickCapturePlaceActivityAt(left,activity)||0)||left.name.localeCompare(right.name));
  const suggestions=places.slice(0,4);
  return `<div class="quick-capture-picker quick-capture-place-picker" data-capture-place-picker><select name="placeId" class="sr-only" tabindex="-1" aria-hidden="true"><option value="">None</option>${places.map(place=>`<option value="${escapeHTML(place.id)}">${escapeHTML(place.name)}</option>`).join("")}</select>${suggestions.length?`<div class="quick-capture-place-suggestions" aria-label="Favorite and recent places">${suggestions.map(place=>`<button type="button" data-capture-place-id="${escapeHTML(place.id)}">${place.isFavorite?icons.star:""}<span>${escapeHTML(place.name.split("—")[0].trim())}</span></button>`).join("")}</div>`:""}<label class="quick-capture-picker__search"><span class="sr-only">Search places</span>${icons.location}<input type="search" data-capture-place-search autocomplete="off" placeholder="Search or create a place"></label><div class="quick-capture-picker__list" data-capture-place-list>${places.map(place=>{const usedAt=quickCapturePlaceActivityAt(place,activity);return `<button type="button" class="quick-capture-picker__row" data-capture-place-id="${escapeHTML(place.id)}" data-capture-search-value="${escapeHTML(String(place.name||"").toLowerCase())}"><span><strong>${escapeHTML(place.name)}</strong><small>${place.isFavorite?"Favorite place":usedAt?`Used ${fmtDate(usedAt)}`:"Saved place"}</small></span><i></i></button>`;}).join("")}</div><button class="quick-capture-picker__new" type="button" data-capture-new-place hidden>${icons.plus}<span>Create <strong data-capture-new-place-label>place</strong></span>${icons.chevronRight}</button><div class="quick-capture-new-place" data-capture-new-place-fields hidden>${field("New place",'<input name="newPlaceName" placeholder="Place name">')}<label class="quick-capture-check"><input type="checkbox" name="favoritePlace"><span>Save as a favorite</span></label></div></div>`;
}
function quickCaptureWizardFooter({last=false,saveLabel="Save conversation"}={}) { return `<footer class="quick-capture-wizard__footer">${last?`<button class="button primary" type="submit">${icons.check}<span>${escapeHTML(saveLabel)}</span></button>`:`<button class="button primary" type="button" data-capture-step-next>Continue</button>`}</footer>`; }
function quickCaptureWizardStep(key,title,content,{first=false,last=false,saveLabel="Save conversation"}={}) { return `<section class="quick-capture-wizard__step" data-capture-step="${key}" ${first?"":"hidden"}><header><h3>${escapeHTML(title)}</h3></header>${content}${quickCaptureWizardFooter({last,saveLabel})}</section>`; }
function quickCaptureWizardProgress(steps) { return `<div class="quick-capture-wizard__progress-row"><button class="quick-capture-wizard__back" type="button" data-capture-step-back aria-label="Back">${icons.chevronLeft}</button><div class="quick-capture-wizard__progress" aria-label="Capture progress" style="--capture-step-count:${steps.length}"><span class="is-current"></span>${steps.slice(1).map(()=>"<span></span>").join("")}</div><p class="quick-capture-wizard__status"><span data-capture-step-number>1</span>/${steps.length}</p></div>`; }
function quickCaptureNextAction() {
  return `<fieldset class="quick-capture-next"><legend>What should happen next?</legend><label><input type="radio" name="nextAction" value="none" checked><span><strong>Nothing yet</strong><small>Save this conversation without a reminder.</small></span></label><label><input type="radio" name="nextAction" value="checkBack"><span><strong>Reconnect later</strong><small>Keep this relationship on your radar.</small></span></label><div data-next-action-detail="checkBack" hidden>${field("Check back",'<input name="checkBackDate" type="datetime-local">')}${field("Reason",'<input name="checkBackNote" placeholder="Why reconnect?">')}</div><label><input type="radio" name="nextAction" value="followUp"><span><strong>Schedule a follow-up</strong><small>Create a specific next action.</small></span></label><div data-next-action-detail="followUp" hidden>${field("Follow-up time",'<input name="followUpDate" type="datetime-local">')}${field("Reason",'<input name="followUpNote" placeholder="What is the next step?">')}</div></fieldset>`;
}
function quickCapturePersonDetails({includeConversation=true}={}) {
  const places=[...state.places].sort((a,b)=>Number(b.isFavorite)-Number(a.isFavorite)||a.name.localeCompare(b.name));
  const newPersonFields=`<div class="quick-capture-new-person-fields" data-new-person-fields>${field("Phone number",'<input name="phoneNumber" type="tel" autocomplete="tel" placeholder="Optional">')}${field("Email",'<input name="email" type="email" autocomplete="email" inputmode="email" placeholder="Optional">')}${field("Role",'<select name="role" data-capture-role><option>Prospect</option><option>Customer</option><option>Team</option></select>')}<div data-capture-fit>${field("Interest",`<select name="interestLevel">${INTERESTS.map(level=>`<option ${level==="Unsure"?"selected":""}>${level}</option>`).join("")}</select>`)}</div><div data-capture-fit>${field("Judgment",'<select name="judgement"><option>Good Fit</option><option>Not Good Fit</option></select>')}</div>${includeConversation?field("Conversation type",`<select name="conversationType">${CONVERSATION_TYPES.map(type=>`<option>${type}</option>`).join("")}</select>`):""}</div>`;
  return `<div class="quick-capture-person-fields">${newPersonFields}${field("Saved place",`<select name="placeId"><option value="">None</option>${places.map(place=>`<option value="${escapeHTML(place.id)}">${escapeHTML(place.name)}${place.isFavorite?" · Favorite":""}</option>`).join("")}</select>`)}${field("New place",'<input name="newPlaceName" placeholder="Coffee shop, gym, event…">')}<label class="quick-capture-check"><input type="checkbox" name="favoritePlace"><span>Save new place as a favorite</span></label>${field("What I Know",'<textarea name="personalInfo" placeholder="Useful context about goals, family, work, or interests"></textarea>')}</div>`;
}
function quickCaptureTrackingFields() { return `${ActivitySelector()}${field("Move to stage",`<select name="pipelineStage" data-capture-stage>${quickCaptureStageOptions()}</select>`)}`; }
function quickCaptureConversationForm(mode,contacts) {
  const meeting=mode==="meeting";
  const steps=["person","place","learned","next"];
  const person=`${quickCapturePersonPicker(contacts,{allowNew:true})}<div class="quick-capture-new-person-fields" data-new-person-fields hidden>${quickCaptureAdvanced(`${field("Phone number",'<input name="phoneNumber" type="tel" autocomplete="tel" placeholder="Optional">')}${field("Email",'<input name="email" type="email" autocomplete="email" inputmode="email" placeholder="Optional">')}${field("Role",'<select name="role" data-capture-role><option>Prospect</option><option>Customer</option><option>Team</option></select>')}<div data-capture-fit>${field("Interest",`<select name="interestLevel">${INTERESTS.map(level=>`<option ${level==="Unsure"?"selected":""}>${level}</option>`).join("")}</select>`)}</div><div data-capture-fit>${field("Judgment",'<select name="judgement"><option>Good Fit</option><option>Not Good Fit</option></select>')}</div>${field("Conversation type",`<select name="conversationType">${CONVERSATION_TYPES.map(type=>`<option>${type}</option>`).join("")}</select>`)}`,"Add person details")}</div>`;
  const learned=`${field(meeting?"What did you discuss?":"What did you learn?",`<textarea name="notes" required placeholder="${meeting?"Key points from the meeting":"A useful detail, need, goal, or next step"}"></textarea>`)}${field("Add to What I Know",'<textarea name="personalInfo" placeholder="Optional relationship context"></textarea>')}`;
  const next=`${quickCaptureNextAction()}${quickCaptureAdvanced(`${field("Date and time",`<input name="conversationDate" type="datetime-local" value="${dateTimeLocalValue(new Date())}" required>`)}${quickCaptureTrackingFields()}`,"Date, stage, and activity details")}`;
  return `<form id="quickConversationForm" class="quick-create-form quick-capture-composer quick-capture-wizard" data-capture-kind="${mode}" data-capture-steps="${steps.join(",")}" data-capture-step-index="0">${quickCaptureErrorState()}${quickCaptureWizardProgress(steps)}${quickCaptureWizardStep("person",meeting?"Who was in the meeting?":"Who was it?",person,{first:true})}${quickCaptureWizardStep("place","Where?",quickCapturePlacePicker())}${quickCaptureWizardStep("learned",meeting?"What did you discuss?":"What did you learn?",learned)}${quickCaptureWizardStep("next","What's next?",next,{last:true,saveLabel:meeting?"Save meeting":"Save conversation"})}</form>`;
}
function quickCaptureCommunicationForm(mode,contacts) {
  const call=mode==="call"; const label=call?"Call":"Text"; const outcomes=call?CALL_OUTCOMES:TEXT_OUTCOMES;
  if(!contacts.length)return `${quickCaptureBack()}${EmptyState("No people yet",`Add a person before logging a ${mode}.`)}`;
  const steps=call?["person","outcome","notes","next"]:["person","notes","next"];
  const notes=`${field(call?"What did you talk about?":"What did you discuss?",`<textarea name="notes" placeholder="Optional ${mode} notes"></textarea>`)}<p class="quick-capture-note">Write only what is useful to remember. ${label} activity does not increase the Conversations metric.</p>`;
  const details=`${field("Direction",`<select name="direction">${COMMUNICATION_DIRECTIONS.map(direction=>`<option>${direction}</option>`).join("")}</select>`)}${field("Outcome",`<select name="outcome">${outcomes.map(outcome=>`<option>${outcome}</option>`).join("")}</select>`)}${call?field("Duration (minutes)",'<input name="durationMinutes" type="number" min="0" step="1" inputmode="numeric">'):""}`;
  const next=`${field("Date and time",`<input name="conversationDate" type="datetime-local" value="${dateTimeLocalValue(new Date())}" required>`)}${field("Follow-up",'<input name="followUpDate" type="datetime-local">')}${field("Follow-up reason",'<input name="followUpNote" placeholder="What is the next step?">')}${quickCaptureAdvanced(`${ActivitySelector()}${field("Move to stage",`<select name="pipelineStage" data-capture-stage>${quickCaptureStageOptions()}</select>`)}`,"Pipeline and activity details")}`;
  return `<form id="quickCommunicationForm" class="quick-create-form quick-capture-composer quick-capture-wizard" data-capture-kind="${mode}" data-capture-steps="${steps.join(",")}" data-capture-step-index="0">${quickCaptureErrorState()}${quickCaptureWizardProgress(steps)}${quickCaptureWizardStep("person","Who was it?",quickCapturePersonPicker(contacts),{first:true})}${call?quickCaptureWizardStep("outcome","Did you connect?",details):""}${quickCaptureWizardStep("notes",call?"What happened?":"What was said?",notes)}${quickCaptureWizardStep("next","What's next?",next,{last:true,saveLabel:`Save ${label.toLowerCase()}`})}</form>`;
}
function quickCaptureContactForm() {
  const steps=["person","details"];
  const person=`${field("Full name",'<input name="fullName" required autocomplete="name" placeholder="Who did you meet?">')}${field("Phone number",'<input name="phoneNumber" type="tel" autocomplete="tel" placeholder="Optional">')}${field("Email",'<input name="email" type="email" autocomplete="email" inputmode="email" placeholder="Optional">')}`;
  const details=`${field("Role",'<select name="role" data-capture-role><option>Prospect</option><option>Customer</option><option>Team</option></select>')}<div data-capture-fit>${field("Interest",`<select name="interestLevel">${INTERESTS.map(level=>`<option ${level==="Unsure"?"selected":""}>${level}</option>`).join("")}</select>`)}</div><div data-capture-fit>${field("Judgment",'<select name="judgement"><option>Good Fit</option><option>Not Good Fit</option></select>')}</div>${quickCapturePlacePicker()}${field("What I Know",'<textarea name="personalInfo" placeholder="Useful context about goals, family, work, or interests"></textarea>')}${quickCaptureAdvanced(quickCaptureTrackingFields(),"Pipeline and activity details")}`;
  return `<form id="quickContactForm" class="quick-create-form quick-capture-composer quick-capture-wizard" data-capture-kind="contact" data-capture-steps="${steps.join(",")}" data-capture-step-index="0">${quickCaptureErrorState()}${quickCaptureWizardProgress(steps)}${quickCaptureWizardStep("person","Who did you meet?",person,{first:true})}${quickCaptureWizardStep("details","What should Bridge know?",details,{last:true,saveLabel:"Add person"})}</form>`;
}
function quickCaptureActionForm(contacts) {
  if(!contacts.length)return `${quickCaptureBack()}${EmptyState("No people yet","Add a person before scheduling a follow-up.")}`;
  const steps=["person","when"];
  const when=`${field("Date and time",`<input name="dueDate" type="datetime-local" value="${dateTimeLocalValue(addDays(new Date(),state.settings.defaultFollowUpDays))}" required>`)}${field("Reason to reconnect",'<textarea name="note" required placeholder="What is the next step?">Follow up</textarea>')}`;
  return `<form id="quickActionForm" class="quick-create-form quick-capture-composer quick-capture-wizard" data-capture-kind="action" data-capture-steps="${steps.join(",")}" data-capture-step-index="0">${quickCaptureErrorState()}${quickCaptureWizardProgress(steps)}${quickCaptureWizardStep("person","Who is this for?",quickCapturePersonPicker(contacts),{first:true})}${quickCaptureWizardStep("when","When should you reconnect?",when,{last:true,saveLabel:"Schedule follow-up"})}</form>`;
}
function quickCaptureNoteForm(contacts) {
  if(!contacts.length)return `${quickCaptureBack()}${EmptyState("No people yet","Add a person before saving an activity.")}`;
  const steps=["person","learned"];
  const note=`${field("Note",'<textarea name="notes" required placeholder="What is worth remembering?"></textarea>')}${field("Date",`<input name="conversationDate" type="date" max="${todayInput()}" value="${todayInput()}" required>`)}${quickCaptureAdvanced(quickCaptureTrackingFields(),"Pipeline and activity details")}`;
  return `<form id="quickNoteForm" class="quick-create-form quick-capture-composer quick-capture-wizard" data-capture-kind="note" data-capture-steps="${steps.join(",")}" data-capture-step-index="0">${quickCaptureErrorState()}${quickCaptureWizardProgress(steps)}${quickCaptureWizardStep("person","Who was it?",quickCapturePersonPicker(contacts),{first:true})}${quickCaptureWizardStep("learned","What happened?",note,{last:true,saveLabel:"Save activity"})}</form>`;
}
function quickCapturePlace(form) {
  let placeId=String(form.get("placeId")||"")||null,placeName="";const newName=String(form.get("newPlaceName")||"").trim();
  if(newName){let place=state.places.find(item=>item.name.toLowerCase()===newName.toLowerCase());if(!place){place={id:uid(),name:newName,isFavorite:form.has("favoritePlace"),createdAt:nowISO()};state.places.push(place);}else if(form.has("favoritePlace"))place.isFavorite=true;placeId=place.id;placeName=place.name;}else if(placeId){placeName=state.places.find(item=>String(item.id)===String(placeId))?.name||"";}
  return {placeId,placeName};
}
function quickCaptureISO(value) {
  const date=new Date(String(value||""));
  return Number.isFinite(date.getTime())?date.toISOString():"";
}
function quickCaptureNewContact(form,occurredAt,{conversationType="Other"}={}) {
  const fullName=String(form.get("fullName")||"").trim();const phoneNumber=String(form.get("phoneNumber")||"").trim();const email=String(form.get("email")||"").trim();const role=["Prospect","Customer","Team"].includes(String(form.get("role")))?String(form.get("role")):"Prospect";const team=role==="Team";const {placeId,placeName}=quickCapturePlace(form);const createdAt=nowISO();
  const contact={id:uid(),fullName,phoneNumber,email,capturedPhoneNumber:phoneNumber,phoneCapturedAt:phoneNumber?occurredAt:null,role,judgement:team?"Good Fit":String(form.get("judgement")||"Good Fit"),interestLevel:team?"Unsure":String(form.get("interestLevel")||"Unsure"),conversationType:String(form.get("conversationType")||conversationType),placeId,placeName,dateFirstMet:occurredAt,personalInfo:String(form.get("personalInfo")||"").trim(),healthCadenceDays:null,isFilteredOut:false,filteredOutAt:null,checkBackDate:quickCaptureISO(form.get("checkBackDate"))||null,archivedAt:null,archiveReason:null,stages:Object.fromEntries(ALL_STAGES.map(stage=>[stage,false])),stageDates:{},stageEvents:[],followUps:[],notes:[],conversations:[],createdAt,updatedAt:createdAt};
  for(const stage of ["MSA","DTM"]){if(form.has(stageInputName(stage))){contact.stages[stage]=true;contact.stageDates[stage]=occurredAt;contact.stageEvents.push({id:uid(),stage,fromStage:null,toStage:stage,occurredAt,source:"quick-capture"});}}
  const selected=String(form.get("pipelineStage")||"");if((PIPELINES[role]||[]).includes(selected))setPipelineStage(contact,selected,occurredAt,"quick-capture");return contact;
}
function applyQuickCaptureDetails(contact,form,occurredAt,source) {
  const selected=String(form.get("pipelineStage")||"");if(selected&&(PIPELINES[contact.role]||[]).includes(selected))setPipelineStage(contact,selected,occurredAt,source);
  const standalone=String(form.get("standaloneActivity")||"");if(["MSA","DTM"].includes(standalone)&&!contact.stages[standalone]){contact.stages[standalone]=true;contact.stageDates[standalone]=occurredAt;contact.stageEvents.push({id:uid(),stage:standalone,fromStage:null,toStage:standalone,occurredAt,source});}
  for(const stage of ["MSA","DTM"]){if(form.has(stageInputName(stage))&&!contact.stages[stage]){contact.stages[stage]=true;contact.stageDates[stage]=occurredAt;contact.stageEvents.push({id:uid(),stage,fromStage:null,toStage:stage,occurredAt,source});}}
  const personalInfo=String(form.get("personalInfo")||"").trim();if(personalInfo)contact.personalInfo=personalInfo;
  const place=quickCapturePlace(form);if(place.placeId||place.placeName){contact.placeId=place.placeId;contact.placeName=place.placeName;}
  const followUpDate=quickCaptureISO(form.get("followUpDate"));if(followUpDate)createFollowUp(contact,followUpDate,String(form.get("followUpNote")||"Follow up").trim()||"Follow up");
  const checkBackDate=quickCaptureISO(form.get("checkBackDate"));if(checkBackDate){contact.checkBackDate=checkBackDate;createFollowUp(contact,checkBackDate,String(form.get("checkBackNote")||"Check back down the line").trim()||"Check back down the line");}
}
function quickCreateModal() {
  const continuing=Boolean($('#quickCreateBackdrop'));
  const activeContacts=state.contacts.filter(contact=>!contact.archivedAt&&!contact.isFilteredOut);
  const choices=[
    ["conversation","Conversation","Someone you talked to in person","messages"],["call","Call","Dialed or received","phone"],["text","Text","Message thread","chat"],["meeting","Meeting","Scheduled sit-down","people"],["action","Follow-up","Schedule a reason to reconnect","calendarPlus"],["contact","Add person","No conversation yet","userPlus"]
  ];
  let content=`<div class="quick-create-list capture-action-grid">${choices.map(([mode,title,description,iconName])=>`<button class="quick-create-option capture-action" type="button" data-quick-mode="${mode}"><span class="quick-create-icon">${icons[iconName]}</span><span><strong>${title}</strong><small>${description}</small></span></button>`).join("")}</div>`;
  if(ui.quickCreateMode==="conversation"||ui.quickCreateMode==="meeting")content=quickCaptureConversationForm(ui.quickCreateMode,activeContacts);
  if(ui.quickCreateMode==="call"||ui.quickCreateMode==="text")content=quickCaptureCommunicationForm(ui.quickCreateMode,activeContacts);
  if(ui.quickCreateMode==="contact")content=quickCaptureContactForm();
  if(ui.quickCreateMode==="action")content=quickCaptureActionForm(activeContacts);
  if(ui.quickCreateMode==="note")content=quickCaptureNoteForm(activeContacts);
  const titles={conversation:"Conversation",call:"Call",text:"Text",meeting:"Meeting",action:"Follow-up",contact:"Add person",note:"Other activity"};
  return `<div class="modal-backdrop quick-create-backdrop capture-sheet-backdrop${continuing?" is-continuing":""}" id="quickCreateBackdrop" data-ui-sheet-backdrop><section class="modal quick-create-modal capture-sheet${ui.quickCreateMode?" has-step":""}" role="dialog" aria-modal="true" aria-labelledby="quickCreateTitle" data-ui-sheet><header class="modal-head capture-sheet-head" data-ui-sheet-drag-region><div><span class="eyebrow">Capture</span><h2 id="quickCreateTitle">${ui.quickCreateMode?titles[ui.quickCreateMode]:"What happened?"}</h2></div><button class="ui-icon-button" id="closeQuickCreate" type="button" aria-label="Close">${icons.close}</button></header><div class="modal-body capture-sheet-body${ui.quickCreateMode?" motion-step":""}" data-ui-sheet-scroll>${content}</div></section></div>`;
}

function closeQuickCreate() {
  ui.quickCreateOpen=false;ui.quickCreateMode=null;ui.quickCreateContactId="";
  const backdrop=$('#quickCreateBackdrop');
  const finish=()=>{render();requestAnimationFrame(()=>{const target=quickCreateFocusReturn?.isConnected?quickCreateFocusReturn:$('[aria-label="Capture what happened"]');target?.focus({preventScroll:true});quickCreateFocusReturn=null;});};
  if(!backdrop||backdrop.dataset.uiDraggedDismiss==='true'||matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return;}
  if(backdrop.classList.contains('is-closing'))return;
  backdrop.classList.add('is-closing');
  setTimeout(finish,180);
}
function syncQuickCaptureFields(form,{hydrateRelationship=false}={}) {
  if(!form)return;const selectedId=String(form.elements.contactId?.value||"");const selected=state.contacts.find(contact=>String(contact.id)===selectedId);const role=selected?.role||String(form.elements.role?.value||"Prospect");
  $$('[data-new-person-fields]',form).forEach(section=>{section.hidden=Boolean(selected)||section.dataset.captureNewPersonActive!=="true";});
  $$('[data-new-person-name]',form).forEach(section=>{section.hidden=Boolean(selected)||section.dataset.captureNewPersonActive!=="true";});
  $$('[data-capture-fit]',form).forEach(section=>{section.hidden=role==="Team";});
  $$('[data-stage-role]',form).forEach(option=>{option.disabled=option.dataset.stageRole!==role;});
  const stage=form.elements.pipelineStage;if(stage?.selectedOptions?.[0]?.disabled)stage.value="";
  if(hydrateRelationship){
    const savedPlaceId=selected?.placeId||state.places.find(place=>String(place.name||"").toLowerCase()===String(selected?.placeName||"").toLowerCase())?.id||"";
    if(form.elements.placeId)form.elements.placeId.value=String(savedPlaceId);
    if(form.elements.newPlaceName)form.elements.newPlaceName.value="";
    if(form.elements.favoritePlace)form.elements.favoritePlace.checked=false;
    if(form.elements.personalInfo)form.elements.personalInfo.value=String(selected?.personalInfo||"");
  }
}
function syncQuickCapturePickerState(form) {
  if(!form)return;
  const contactId=String(form.elements.contactId?.value||"");
  $$('[data-capture-person-id]',form).forEach(button=>{const selected=String(button.dataset.capturePersonId)===contactId;button.classList.toggle('is-selected',selected);button.setAttribute('aria-pressed',String(selected));const marker=$('[data-capture-selected]',button);if(marker)marker.textContent=selected?'Selected':'';});
  const placeId=String(form.elements.placeId?.value||"");
  $$('[data-capture-place-id]',form).forEach(button=>{const selected=String(button.dataset.capturePlaceId)===placeId;button.classList.toggle('is-selected',selected);const marker=$('i',button);if(marker)marker.textContent=selected?'Selected':'';});
}
function syncQuickCaptureStepAction(form) {
  if(!form?.matches('.quick-capture-wizard'))return;
  const index=Number(form.dataset.captureStepIndex)||0;const keys=String(form.dataset.captureSteps||'').split(',');const panel=$$('[data-capture-step]',form)[index];const button=$('[data-capture-step-next]',panel);if(!button)return;
  const key=keys[index];button.disabled=key==='person'?!String(form.elements.contactId?.value||'')&&!String(form.elements.fullName?.value||'').trim():key==='learned'?!String(form.elements.notes?.value||'').trim():false;button.setAttribute('aria-disabled',String(button.disabled));
}
function updateQuickCaptureReview(form) {
  const target=$('[data-capture-review]',form);if(!target)return;
  const data=new FormData(form);const contact=state.contacts.find(item=>String(item.id)===String(data.get('contactId')));const person=contact?.fullName||String(data.get('fullName')||'New person').trim();const place=String(data.get('newPlaceName')||'').trim()||state.places.find(item=>String(item.id)===String(data.get('placeId')))?.name||'No place';const notes=String(data.get('notes')||'').trim();const next=String(data.get('nextAction')||'none');const nextLabel=next==='followUp'?'Follow-up scheduled':next==='checkBack'?'Reconnect later':'No next action';const stage=String(data.get('pipelineStage')||'');
  target.innerHTML=`<dl><div><dt>Person</dt><dd>${escapeHTML(person||'Person not selected')}</dd></div><div><dt>Place</dt><dd>${escapeHTML(place)}</dd></div><div><dt>Next</dt><dd>${escapeHTML(nextLabel)}</dd></div>${stage?`<div><dt>Stage</dt><dd>${escapeHTML(stage)}</dd></div>`:''}</dl><blockquote>${escapeHTML(notes||'No activity note')}</blockquote>`;
  const saveText=$('[type="submit"] span',form);if(saveText)saveText.textContent=form.dataset.captureKind==='meeting'?'Save meeting':'Save conversation';
}
function validateQuickCaptureStep(form,index) {
  const steps=String(form.dataset.captureSteps||'').split(',');const key=steps[index];
  if(key==='person'&&!String(form.elements.contactId?.value||'')&&!String(form.elements.fullName?.value||'').trim()){quickCaptureError(form,'Choose a person or add a new person name.');return false;}
  if(key==='learned'&&!String(form.elements.notes?.value||'').trim()){quickCaptureError(form,'Add what happened before continuing.');return false;}
  if(key==='next'){
    const action=String(form.elements.nextAction?.value||'none');
    if(action==='followUp'&&!quickCaptureISO(form.elements.followUpDate?.value)){quickCaptureError(form,'Choose a valid follow-up time.');return false;}
    if(action==='checkBack'&&!quickCaptureISO(form.elements.checkBackDate?.value)){quickCaptureError(form,'Choose a valid time to reconnect.');return false;}
  }
  const error=$('.quick-capture-error',form);if(error){error.hidden=true;error.textContent='';}return true;
}
function setQuickCaptureStep(form,nextIndex,{direction='forward'}={}) {
  const panels=$$('[data-capture-step]',form);if(!panels.length)return;
  const current=Math.max(0,Math.min(panels.length-1,Number(form.dataset.captureStepIndex)||0));const next=Math.max(0,Math.min(panels.length-1,nextIndex));
  panels.forEach((panel,index)=>{panel.hidden=index!==next;panel.classList.remove('is-entering-forward','is-entering-back');});
  form.dataset.captureStepIndex=String(next);$$('.quick-capture-wizard__progress span',form).forEach((item,index)=>{item.classList.toggle('is-complete',index<next);item.classList.toggle('is-current',index===next);});const status=$('[data-capture-step-number]',form);if(status)status.textContent=String(next+1);syncQuickCaptureStepAction(form);if(next===panels.length-1)updateQuickCaptureReview(form);
  const panel=panels[next];panel.classList.add(direction==='back'?'is-entering-back':'is-entering-forward');requestAnimationFrame(()=>{panel.classList.remove('is-entering-forward','is-entering-back');const focusTarget=$('input:not([type="hidden"]):not([tabindex="-1"]), textarea, button',panel);focusTarget?.focus({preventScroll:true});panel.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
}
function bindQuickCreateEvents() {
  const backgroundShell=$('.bridge-pattern-shell');if(backgroundShell){backgroundShell.inert=true;backgroundShell.setAttribute('aria-hidden','true');}
  bindBottomSheetGesture($('.quick-create-modal'),closeQuickCreate);
  $('#closeQuickCreate')?.addEventListener('click',closeQuickCreate);$('#quickCreateBackdrop')?.addEventListener('click',event=>{if(event.target.id==='quickCreateBackdrop')closeQuickCreate();});
  $$('.quick-create-back').forEach(button=>button.addEventListener('click',()=>{ui.quickCreateMode=null;ui.quickCreateContactId="";render();}));
  $$('[data-quick-mode]').forEach(button=>button.addEventListener('click',()=>{ui.quickCreateMode=button.dataset.quickMode;ui.quickCreateContactId="";render();}));
  $$('.quick-capture-composer').forEach(form=>{syncQuickCaptureFields(form,{hydrateRelationship:true});syncQuickCapturePickerState(form);syncQuickCaptureStepAction(form);form.addEventListener('input',()=>syncQuickCaptureStepAction(form));form.elements.contactId?.addEventListener('change',event=>{ui.quickCreateContactId=event.target.value;syncQuickCaptureFields(form,{hydrateRelationship:true});syncQuickCapturePickerState(form);syncQuickCaptureStepAction(form);});form.elements.role?.addEventListener('change',()=>syncQuickCaptureFields(form));});
  $$('[data-capture-person-search]').forEach(input=>input.addEventListener('input',event=>{const form=event.currentTarget.closest('form');const query=event.currentTarget.value.trim().toLowerCase();let visible=0;$$('[data-capture-person-id]',form).forEach(button=>{button.hidden=query?!String(button.dataset.captureSearchValue||'').includes(query):button.dataset.captureRecent!=='true';if(!button.hidden)visible+=1;});const count=$('[data-capture-person-count]',form);if(count)count.textContent=String(visible);const heading=$('.quick-capture-picker__heading span',form);if(heading)heading.textContent=query?'Search results':visible?'Recent people':'People';const create=$('[data-capture-new-person]',form);if(create){const exact=state.contacts.some(contact=>String(contact.fullName||'').trim().toLowerCase()===query);create.hidden=!query||exact;const label=$('[data-capture-new-person-label]',form);if(label)label.textContent=query?`“${event.currentTarget.value.trim()}”`:'new person';}}));
  $$('[data-capture-person-id]').forEach(button=>button.addEventListener('click',event=>{const form=event.currentTarget.closest('form');form.elements.contactId.value=event.currentTarget.dataset.capturePersonId;ui.quickCreateContactId=form.elements.contactId.value;if(form.elements.fullName)form.elements.fullName.value='';$$('[data-new-person-name],[data-new-person-fields]',form).forEach(section=>{delete section.dataset.captureNewPersonActive;section.hidden=true;});syncQuickCaptureFields(form,{hydrateRelationship:true});syncQuickCapturePickerState(form);syncQuickCaptureStepAction(form);}));
  $$('[data-capture-new-person]').forEach(button=>button.addEventListener('click',event=>{const form=event.currentTarget.closest('form');const query=String($('[data-capture-person-search]',form)?.value||'').trim();form.elements.contactId.value='';ui.quickCreateContactId='';$$('[data-new-person-name],[data-new-person-fields]',form).forEach(section=>{section.dataset.captureNewPersonActive="true";section.hidden=false;});syncQuickCaptureFields(form);syncQuickCapturePickerState(form);if(form.elements.fullName){form.elements.fullName.value=query;form.elements.fullName.focus();}syncQuickCaptureStepAction(form);}));
  $$('[data-capture-place-search]').forEach(input=>input.addEventListener('input',event=>{const form=event.currentTarget.closest('form');const query=event.currentTarget.value.trim().toLowerCase();$$('[data-capture-place-list] [data-capture-place-id]',form).forEach(button=>{button.hidden=Boolean(query&&!String(button.dataset.captureSearchValue||'').includes(query));});const create=$('[data-capture-new-place]',form);if(create){const exact=state.places.some(place=>String(place.name||'').trim().toLowerCase()===query);create.hidden=!query||exact;const label=$('[data-capture-new-place-label]',form);if(label)label.textContent=query?`“${event.currentTarget.value.trim()}”`:'place';}}));
  $$('[data-capture-place-id]').forEach(button=>button.addEventListener('click',event=>{const form=event.currentTarget.closest('form');form.elements.placeId.value=event.currentTarget.dataset.capturePlaceId;if(form.elements.newPlaceName)form.elements.newPlaceName.value='';const newFields=$('[data-capture-new-place-fields]',form);if(newFields)newFields.hidden=true;syncQuickCapturePickerState(form);}));
  $$('[data-capture-new-place]').forEach(button=>button.addEventListener('click',event=>{const form=event.currentTarget.closest('form');const query=String($('[data-capture-place-search]',form)?.value||'').trim();form.elements.placeId.value='';if(form.elements.newPlaceName){form.elements.newPlaceName.value=query;const fields=$('[data-capture-new-place-fields]',form);if(fields)fields.hidden=false;form.elements.newPlaceName.focus();}syncQuickCapturePickerState(form);}));
  $$('[name="nextAction"]').forEach(input=>input.addEventListener('change',event=>{const form=event.currentTarget.closest('form');const action=event.currentTarget.value;$$('[data-next-action-detail]',form).forEach(section=>{section.hidden=section.dataset.nextActionDetail!==action;});if(action==='followUp'){if(!form.elements.followUpDate.value)form.elements.followUpDate.value=dateTimeLocalValue(addDays(new Date(),state.settings.defaultFollowUpDays));form.elements.checkBackDate.value='';}else if(action==='checkBack'){if(!form.elements.checkBackDate.value)form.elements.checkBackDate.value=dateTimeLocalValue(addDays(new Date(),Math.max(14,state.settings.defaultFollowUpDays)));form.elements.followUpDate.value='';}else{form.elements.followUpDate.value='';form.elements.checkBackDate.value='';}}));
  $$('[data-capture-step-next]').forEach(button=>button.addEventListener('click',event=>{const form=event.currentTarget.closest('form');const index=Number(form.dataset.captureStepIndex)||0;if(validateQuickCaptureStep(form,index))setQuickCaptureStep(form,index+1);}));
  $$('[data-capture-step-back]').forEach(button=>button.addEventListener('click',event=>{const form=event.currentTarget.closest('form');const index=Number(form.dataset.captureStepIndex)||0;if(index<=0){ui.quickCreateMode=null;ui.quickCreateContactId='';render();return;}setQuickCaptureStep(form,index-1,{direction:'back'});}));
  $$('.quick-capture-wizard').forEach(form=>form.addEventListener('keydown',event=>{if(event.key!=='Enter'||event.target.matches('textarea,button'))return;const index=Number(form.dataset.captureStepIndex)||0;const panels=$$('[data-capture-step]',form);if(index>=panels.length-1)return;event.preventDefault();if(validateQuickCaptureStep(form,index))setQuickCaptureStep(form,index+1);}));
  $('#quickContactForm')?.addEventListener('submit',event=>{event.preventDefault();const form=new FormData(event.currentTarget);const fullName=String(form.get('fullName')||'').trim();if(!fullName){quickCaptureError(event.currentTarget,'Add a full name.');return;}const phone=String(form.get('phoneNumber')||'').trim();const duplicate=isCallablePhone(phone)&&state.contacts.find(contact=>normalizedPhone(contact.phoneNumber)===normalizedPhone(phone));if(duplicate){quickCaptureError(event.currentTarget,`That phone number belongs to ${duplicate.fullName}.`);return;}const contact=quickCaptureNewContact(form,nowISO());state.contacts.unshift(contact);queueSave('Contact added');closeQuickCreate();});
  $('#quickActionForm')?.addEventListener('submit',event=>{event.preventDefault();const form=new FormData(event.currentTarget);const contact=state.contacts.find(item=>String(item.id)===String(form.get('contactId')));const due=quickCaptureISO(form.get('dueDate'));if(!contact||!due){quickCaptureError(event.currentTarget,'Choose a person and a valid follow-up time.');return;}createFollowUp(contact,due,String(form.get('note')||'Follow up').trim()||'Follow up');contact.updatedAt=nowISO();queueSave('Action scheduled');closeQuickCreate();});
  $('#quickNoteForm')?.addEventListener('submit',event=>{event.preventDefault();const form=new FormData(event.currentTarget);const contact=state.contacts.find(item=>String(item.id)===String(form.get('contactId')));const notes=String(form.get('notes')||'').trim();if(!contact||!notes){quickCaptureError(event.currentTarget,'Choose a person and add a note.');return;}const conversationDate=`${String(form.get('conversationDate')||todayInput())}T12:00:00`;const occurredAt=quickCaptureISO(conversationDate)||conversationDate;applyQuickCaptureDetails(contact,form,occurredAt,'quick-other-activity');contact.conversations.push({id:uid(),type:'Note',interestLevel:contact.interestLevel,notes,createdAt:nowISO(),conversationDate,isCountedConversation:false});contact.updatedAt=nowISO();queueSave('Activity added');closeQuickCreate();});
  $('#quickConversationForm')?.addEventListener('submit',event=>{event.preventDefault();const element=event.currentTarget;const form=new FormData(element);const selected=state.contacts.find(contact=>String(contact.id)===String(form.get('contactId')));const fullName=String(form.get('fullName')||'').trim();const notes=String(form.get('notes')||'').trim();const occurredAt=quickCaptureISO(form.get('conversationDate'));if(!selected&&!fullName){quickCaptureError(element,'Choose a person or add a new person name.');return;}if(!notes||!occurredAt){quickCaptureError(element,'Add what happened and a valid activity time.');return;}const phone=String(form.get('phoneNumber')||'').trim();const duplicate=!selected&&isCallablePhone(phone)&&state.contacts.find(contact=>normalizedPhone(contact.phoneNumber)===normalizedPhone(phone));if(duplicate){quickCaptureError(element,`That phone number belongs to ${duplicate.fullName}. Choose them from the person list instead.`);return;}const meeting=element.dataset.captureKind==='meeting';const type=meeting?'Meeting':selected?.conversationType||String(form.get('conversationType')||'Prospecting');const contact=selected||quickCaptureNewContact(form,occurredAt,{conversationType:meeting?'Other':type});applyQuickCaptureDetails(contact,form,occurredAt,meeting?'quick-meeting':'quick-conversation');contact.conversations.push({id:uid(),type,interestLevel:contact.interestLevel,notes,createdAt:nowISO(),conversationDate:occurredAt,isCountedConversation:true});contact.updatedAt=nowISO();if(!selected)state.contacts.unshift(contact);queueSave(meeting?'Meeting saved':'Conversation saved');closeQuickCreate();});
  $('#quickCommunicationForm')?.addEventListener('submit',event=>{event.preventDefault();const element=event.currentTarget;const form=new FormData(element);const contact=state.contacts.find(item=>String(item.id)===String(form.get('contactId')));const occurredAt=quickCaptureISO(form.get('conversationDate'));if(!contact||!occurredAt){quickCaptureError(element,'Choose a person and a valid activity time.');return;}const type=element.dataset.captureKind==='text'?'Text':'Call';const followUp=quickCaptureISO(form.get('followUpDate'));contact.conversations.push({id:uid(),type:type==='Text'?'Text Message':'Call',communicationType:type,direction:String(form.get('direction')||'Outgoing'),outcome:String(form.get('outcome')||''),durationMinutes:type==='Call'?(Number(form.get('durationMinutes'))||null):null,interestLevel:contact.interestLevel,notes:String(form.get('notes')||'').trim(),conversationDate:occurredAt,createdAt:nowISO(),isCountedConversation:false,followUpCreated:Boolean(followUp)});applyQuickCaptureDetails(contact,form,occurredAt,`quick-${type.toLowerCase()}`);contact.updatedAt=nowISO();queueSave(`${type} logged`);closeQuickCreate();});
  requestAnimationFrame(()=>(ui.quickCreateMode?$('.quick-create-form [data-capture-person-search], .quick-create-form input:not([type="hidden"]):not([tabindex="-1"]), .quick-create-form select:not([tabindex="-1"]), .quick-create-form textarea'):$('.quick-create-option'))?.focus());
}
function renderPage() {
  if (ui.routedScreen) return renderPresentationScreen();
  if (ui.page === "contacts") return renderContacts();
  if (ui.page === "followups") return renderFollowUps();
  if (ui.page === "analytics") return renderAnalytics();
  return renderDashboard();
}

function presentationMissing(title, message) {
  return PresentationScreen(EmptyState(title,message,{className:"presentation-screen__empty"}),{title:"Unavailable",eyebrow:"Bridge"});
}

function presentationMotionClass() {
  const direction=escapeHTML(ui.routeDirection||"forward");
  return `presentation-screen--${direction}${ui.routeEntryMotion?` presentation-screen--enter presentation-screen--enter-${direction}`:""}`;
}

function renderPeopleSearchScreen() {
  const hasQuery=Boolean(ui.search.trim());
  const clearAction=`<button type="button" class="people-search-clear" data-clear-people-search aria-label="Clear search" ${hasQuery?"":"hidden"}>${icons.close}</button>`;
  const search=SearchField({id:"contactSearch",value:ui.search,placeholder:"Name, place, or something they said",label:"Search people",className:"people-search-screen__search",trailing:clearAction,attributes:"autocapitalize=\"words\""});
  return `<section class="presentation-screen ${presentationMotionClass()} people-search-screen" data-presentation-screen="people-search"><header class="people-search-screen__header"><button type="button" class="people-search-screen__back" data-presentation-back aria-label="Back">${icons.chevronLeft}</button><h1 class="sr-only">Search people</h1>${search}</header><div class="presentation-screen__body">${peopleSearchBodyMarkup()}</div></section>`;
}

function peopleSearchBodyMarkup() {
  const hasQuery=Boolean(ui.search.trim());
  if(!hasQuery)return renderPeopleSearchSuggestions(peopleVisibleContacts(getFilteredContacts({ignoreSearch:true})));
  const contacts=peopleVisibleContacts(getFilteredContacts());
  const activeContacts=state.contacts.filter(contact=>!contact.archivedAt&&!contact.isFilteredOut);
  return `<p class="people-home__count">${contacts.length} ${contacts.length===1?"result":"results"}</p>${renderPeopleList(contacts,activeContacts.length,{query:ui.search,emptyTitle:"No match yet",emptyMessage:"Bridge searches names, places, and everything you've written about someone.",noResults:true})}`;
}

function bindPeopleSearchResultActions(root) {
  $$('[data-contact-id]',root).forEach(button=>button.addEventListener('click',()=>navigatePresentation("person",{person:button.dataset.contactId},{opener:button})));
  $$('[data-place-detail-id]',root).forEach(button=>button.addEventListener('click',()=>{const place=state.places.find(item=>String(item.id)===String(button.dataset.placeDetailId));if(place)navigatePresentation("place",{place:place.id},{opener:button});}));
}

function refreshPeopleSearchResults(cursor=0) {
  const body=$(".people-search-screen > .presentation-screen__body");
  const input=$("#contactSearch");
  if(!body||!input)return false;
  body.innerHTML=peopleSearchBodyMarkup();
  bindPeopleSearchResultActions(body);
  const clear=$("[data-clear-people-search]");
  if(clear)clear.hidden=!ui.search.trim();
  input.focus({preventScroll:true});
  input.setSelectionRange(cursor,cursor);
  return true;
}

function renderPipelineStageScreen() {
  if(ui.routedError)return presentationMissing("Stage unavailable",ui.routedError);
  const role=ui.pipelineRole;const stage=role==="Prospect"?ui.pipelineStageDetail:ui.customerPipelineStageDetail;const contacts=activePipelineContacts(role);const body=role==="Prospect"?prospectStageDetailContent(stage,contacts):customerStageDetailContent(stage,contacts);
  return PresentationScreen(body,{title:stage,eyebrow:`${role} pipeline`,className:"pipeline-stage-screen"});
}

function renderStageTransitionScreen() {
  if(ui.routedError)return presentationMissing("Stage unavailable",ui.routedError);
  const contact=state.contacts.find(item=>String(item.id)===String(ui.pipelineContactId||ui.customerPipelineContactId));
  if(!contact)return presentationMissing("Person unavailable","This person no longer exists.");
  const body=contact.role==="Prospect"?prospectTransitionContent(contact):customerTransitionContent(contact);
  return PresentationScreen(body,{title:"Update stage",eyebrow:contact.fullName,className:"stage-transition-screen"});
}

function renderPlaceDetailScreen() {
  if(ui.routedError)return presentationMissing("Place unavailable",ui.routedError);
  const place=state.places.find(item=>String(item.id)===String(ui.placeDetailId));
  if(!place)return presentationMissing("Place unavailable","This place no longer exists.");
  return PresentationScreen(placeDetailContent(place.id),{title:place.name,eyebrow:place.isFavorite?"Favorite place":"Saved place",className:"place-detail-screen"});
}

function renderAnalyticsDetailScreen() {
  const scorecard=analyticsScorecardData();
  const range=scorecard.range;
  const previousScorecard=analyticsMetricsForRange(previousAnalyticsRange(range));
  const model=buildInsightsModel({contacts:state.contacts,places:state.places,range,pipelines:PIPELINES,dailyGoal:state.settings.dailyGoal,resolveCurrentStage:currentPipelineStage,now:new Date(),stallDays:PIPELINE_STALL_DAYS});
  const content=`<div class="analytics-detail-route">${analyticsDetailPeriodControls(range)}${insightsDetailedAnalytics(model,scorecard,previousScorecard,{embedded:false})}</div>`;
  return PresentationScreen(content,{title:"Analytics",eyebrow:"Behavior and outcomes",className:"analytics-detail-screen"});
}

function goalPeriodMetrics(now=new Date()) {
  const anchor=dayKey(now)||todayInput();
  const weekRange=analyticsRange({mode:"week",anchor,weekStart:state.settings.weekStart});
  const monthRange=analyticsRange({mode:"month",anchor,weekStart:state.settings.weekStart});
  return {week:countedConversations(weekRange).length,month:countedConversations(monthRange).length};
}
function goalsProgressRow(label,current,target) {
  const maximum=Math.max(1,Number(target)||1);const percent=Math.min(100,Math.max(current?2:0,Math.round(Number(current||0)/maximum*100)));
  return `<div class="goals-progress-row"><div><span>${escapeHTML(label)}</span><strong>${Number(current)||0} / ${maximum}</strong></div><i aria-hidden="true"><span style="width:${percent}%"></span></i></div>`;
}
function renderGoalsScreen() {
  const metrics=dailyGoalMetrics(state);const periods=goalPeriodMetrics();const result=evaluateAchievements(state,state.meta.achievements||{});const unlocked=result.progress.filter(item=>item.complete).length;
  const achievements=result.progress.map(item=>`<li class="${item.complete?"is-unlocked":""}"><span>${escapeHTML(item.name)}</span><strong>${item.complete?"Unlocked":`${Math.min(item.current,item.target)} of ${item.target}`}</strong></li>`).join("");
  const body=`<section class="goals-streak-hero" aria-label="Current streak">${icons.fire}<strong>${metrics.goalStreak} day${metrics.goalStreak===1?"":"s"}</strong><span>in a row with a conversation</span></section><section class="goals-screen__section"><h2>Conversations</h2><div class="goals-progress-rows">${goalsProgressRow("Today",metrics.todayCount,metrics.goal)}${goalsProgressRow("This week",periods.week,state.settings.weeklyGoal)}${goalsProgressRow("This month",periods.month,state.settings.monthlyGoal)}</div><button class="goals-adjust" type="button" data-settings-section-open="goals">Adjust goals</button></section><section class="goals-screen__section goals-achievement-list"><h2>Achievements <span>${unlocked}</span></h2><ul>${achievements}</ul></section>`;
  return PresentationScreen(body,{title:"Progress",eyebrow:"Goals and streak",className:"goals-screen"});
}

function renderPresentationScreen() {
  if(ui.routedScreen==="people-search")return renderPeopleSearchScreen();
  if(ui.routedScreen==="person")return ui.routedError?presentationMissing("Person unavailable",ui.routedError):contactModal(ui.detailId,{routed:true});
  if(ui.routedScreen==="person-edit")return ui.routedError?presentationMissing("Person unavailable",ui.routedError):contactModal(ui.detailId,{routed:true});
  if(ui.routedScreen==="person-timeline")return ui.routedError?presentationMissing("Person unavailable",ui.routedError):activityHistoryModal(ui.activityHistoryContactId,{routed:true});
  if(ui.routedScreen==="pipeline-stage")return renderPipelineStageScreen();
  if(ui.routedScreen==="stage-transition")return renderStageTransitionScreen();
  if(ui.routedScreen==="place")return renderPlaceDetailScreen();
  if(ui.routedScreen==="analytics-detail")return renderAnalyticsDetailScreen();
  if(ui.routedScreen==="goals")return renderGoalsScreen();
  if(ui.routedScreen==="achievements")return achievementsModal({routed:true});
  if(ui.routedScreen==="scorecard")return scorecardShareModal({routed:true});
  if(ui.routedScreen==="settings")return ui.routedError?presentationMissing("Settings unavailable",ui.routedError):settingsModal({routed:true});
  return presentationMissing("Screen unavailable","Return to Bridge and try again.");
}

function renderDashboard() {
  const now = new Date();
  const dailyGoal = dailyGoalMetrics(state);
  const savedFirstName = String(state.settings.firstName || "").trim();
  const greeting = savedFirstName ? `Hi, ${escapeHTML(savedFirstName)}` : "Hi there";
  const attention = todayAttentionItems(now);
  const next = attention[0] || null;
  const recent = recentlyMetContacts(3);
  const momentum = todayMomentum(now);
  return `<section class="today-home" aria-label="Today">
    <header class="today-home__header">
      <div><p class="today-home__date">${escapeHTML(new Intl.DateTimeFormat(undefined, { weekday:"long", month:"long", day:"numeric" }).format(now))}</p><h1>${greeting}</h1></div>
      ${IconButton("gear", "Settings", { attributes:'id="settingsButton"', className:"today-home__settings" })}
    </header>
    ${todayGoalProgress(dailyGoal)}
    <section class="today-home__section today-home__next" aria-labelledby="today-next-up"><h2 id="today-next-up">Next up</h2>${next ? todayNextAction(next, now) : todayClearAction()}</section>
    ${todayAttentionSection(attention, now)}
    ${recent.length ? todayRecentSection(recent) : ""}
    ${todayWorthDoingSection(attention.slice(1,3), now)}
    ${todayMomentumSection(momentum, dailyGoal)}
  </section>`;
}
function todayGoalProgress(dailyGoal) {
  const completed = Number.isFinite(Number(dailyGoal?.todayCount)) ? Math.max(0, Number(dailyGoal.todayCount)) : 0;
  const goal = Number.isFinite(Number(dailyGoal?.goal)) ? Math.max(1, Number(dailyGoal.goal)) : 1;
  const ratio = Math.min(1, completed / goal);
  const percentage = Math.round(ratio * 10000) / 100;
  const visual = goal <= 8
    ? `<div class="today-goal__segments" aria-hidden="true">${Array.from({ length:goal }, (_, index) => `<span class="${index < Math.min(goal, Math.floor(completed)) ? "is-complete" : ""}"></span>`).join("")}</div>`
    : `<div class="today-goal__track" aria-hidden="true"><span style="width:${percentage}%"></span></div>`;
  const progressText = completed >= goal ? "Goal reached" : `${Math.round(percentage)}% complete`;
  return `<section class="today-goal" aria-label="Daily conversation progress"><div class="today-goal__visual" role="progressbar" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${completed}" aria-valuetext="${escapeHTML(`${completed} of ${goal} conversations; ${progressText}`)}">${visual}</div><strong><span>${escapeHTML(`${completed} / ${goal}`)}</span><small>conversations today</small></strong><button class="today-goal__streak" data-open-goals type="button" aria-label="Open goals and streak; ${dailyGoal.goalStreak} day streak">${icons.fire}<span>${dailyGoal.goalStreak}</span></button></section>`;
}
function todayRelativeTime(value, now = new Date()) {
  const days = calendarDaysBetween(now, value);
  if (!Number.isFinite(days)) return "Date unavailable";
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}
function todayFollowUpSummary(item, now = new Date()) {
  const due = new Date(item.dueDate);
  if (Number.isNaN(due.getTime())) return "Follow-up date unavailable";
  const overdue = due < now;
  const dayDistance = calendarDaysBetween(now, due);
  if (overdue) return `Follow-up overdue · ${Math.max(1, dayDistance)} day${Math.max(1, dayDistance) === 1 ? "" : "s"}`;
  if (startOfDay(due).getTime() === startOfDay(now).getTime()) return "Follow-up scheduled today";
  if (startOfDay(due).getTime() === startOfDay(addDays(now, 1)).getTime()) return "Follow-up scheduled tomorrow";
  return `Follow-up scheduled ${fmtDate(item.dueDate)}`;
}
function todayAttentionItems(now = new Date()) {
  const scores = relationshipScoreMap(now);
  const actionItems = activeFollowUps().map(item => ({ type:"follow-up", contact:item.contact, followUp:item, score:scores.get(String(item.contact.id)) }));
  const actionIds = new Set(actionItems.map(item => String(item.contact.id)));
  const relationshipItems = state.contacts
    .filter(contact => !contact.archivedAt && !contact.isFilteredOut && !actionIds.has(String(contact.id)))
    .map(contact => ({ type:"relationship", contact, score:scores.get(String(contact.id)) }))
    .filter(item => ["At Risk", "Needs Attention"].includes(item.score?.band) || !latestConversationTime(item.contact));
  const priority = item => {
    if (item.type === "follow-up") {
      const due = new Date(item.followUp.dueDate);
      if (due < now) return 0;
      if (startOfDay(due).getTime() === startOfDay(now).getTime()) return 1;
      return 2;
    }
    return item.score?.band === "At Risk" ? 3 : item.score?.band === "Needs Attention" ? 4 : 5;
  };
  return [...actionItems, ...relationshipItems].sort((left, right) => priority(left) - priority(right) || (left.followUp ? new Date(left.followUp.dueDate) : 0) - (right.followUp ? new Date(right.followUp.dueDate) : 0));
}
function todayContactContext(contact, score, now = new Date()) {
  const latest = latestConversationTime(contact);
  if (latest) return `Last conversation ${todayRelativeTime(latest, now)}`;
  if (score?.band) return `Relationship health · ${score.band}`;
  return "No conversation recorded yet";
}
function todayStageChip(contact) {
  const stage = contact.role === "Team" ? "Team" : stageFor(contact);
  return `<span class="today-stage-chip"><i aria-hidden="true"></i>${escapeHTML([contact.role, stage].filter(Boolean).join(" · "))}</span>`;
}
function todayNextAction(item, now = new Date()) {
  const { contact, followUp, score } = item;
  const name = String(contact.fullName || "Unnamed contact");
  const overdue = Boolean(followUp && new Date(followUp.dueDate) < now);
  const summary = followUp ? `${todayFollowUpSummary(followUp, now)} · ${todayContactContext(contact, score, now)}` : todayContactContext(contact, score, now);
  const note = String(followUp?.note || "").trim();
  const helpId=followUp?`today-swipe-help-${escapeHTML(followUp.id)}`:"";
  const card=`<article class="today-next-card ${overdue ? "is-overdue" : ""}" ${helpId?`aria-describedby="${helpId}"`:""}><div class="today-next-card__identity">${Avatar(name, { size:"large", className:`today-next-card__avatar ${overdue ? "today-next-card__avatar--overdue" : ""}` })}<div><h3>${escapeHTML(name)}</h3><p>${escapeHTML(summary)}</p>${todayStageChip(contact)}</div></div>${note ? `<blockquote>${escapeHTML(note)}</blockquote>` : ""}<div class="today-next-card__actions${followUp ? " has-follow-up" : ""}"><button class="button primary" type="button" data-contact-id="${escapeHTML(contact.id)}">${followUp ? "Follow up" : "Open relationship"}</button>${followUp ? `<button class="button subtle today-reschedule-action" type="button" data-action-id="${escapeHTML(contact.id)}:${escapeHTML(followUp.id)}" aria-label="Reschedule follow-up for ${escapeHTML(name)}">${icons.clock}</button><button class="button subtle today-complete-action" type="button" data-today-contact-id="${escapeHTML(contact.id)}" data-follow-up-id="${escapeHTML(followUp.id)}" aria-label="Mark follow-up with ${escapeHTML(name)} done">Done</button>` : ""}</div></article>`;
  if(!followUp)return card;
  return `<div class="today-swipe-shell" data-today-swipe-card data-today-contact-id="${escapeHTML(contact.id)}" data-follow-up-id="${escapeHTML(followUp.id)}" data-action-id="${escapeHTML(contact.id)}:${escapeHTML(followUp.id)}"><div class="today-swipe-feedback today-swipe-feedback--done" aria-hidden="true">${icons.check}<span>Done</span></div><div class="today-swipe-feedback today-swipe-feedback--reschedule" aria-hidden="true">${icons.clock}<span>Reschedule</span></div>${card}<p class="sr-only" id="${helpId}">Swipe left to mark this follow-up done or right to open rescheduling. The visible buttons provide the same actions.</p></div>`;
}
function todayClearAction() { return SurfaceCard(`<div class="today-clear-action"><span>${icons.circleCheck}</span><div><strong>Nothing needs attention right now</strong><p>Your next follow-up or relationship signal will appear here.</p></div><button class="button subtle" type="button" data-page="add">Log conversation</button></div>`, { className:"today-clear-action-card" }); }
function todayAttentionSection(items, now = new Date()) {
  const visible = items.slice(1, 6);
  if (!visible.length) return `<section class="today-home__section today-attention" aria-labelledby="today-needs-attention"><div class="today-section-head"><h2 id="today-needs-attention">Needs attention</h2><button type="button" data-page="followups">See all</button></div><p class="today-attention__empty">No relationships need attention yet.</p></section>`;
  return `<section class="today-home__section today-attention" aria-labelledby="today-needs-attention"><div class="today-section-head"><h2 id="today-needs-attention">Needs attention <span>${items.length}</span></h2><button type="button" data-page="followups">See all</button></div><div class="today-attention__list">${visible.map(item => todayAttentionRow(item, now)).join("")}</div></section>`;
}
function todayAttentionRow(item, now = new Date()) {
  const { contact, followUp, score } = item;
  const name = String(contact.fullName || "Unnamed contact");
  const overdue = Boolean(followUp && new Date(followUp.dueDate) < now);
  const label = followUp ? todayFollowUpSummary(followUp, now) : todayContactContext(contact, score, now);
  return `<button type="button" class="today-attention-row ${overdue ? "is-overdue" : ""}" data-contact-id="${escapeHTML(contact.id)}">${Avatar(name, { size:"small", className:`today-attention-row__avatar ${overdue ? "today-attention-row__avatar--overdue" : ""}` })}<span><strong>${escapeHTML(name)}</strong><small>${escapeHTML(label)}</small></span>${icons.chevronRight}</button>`;
}
function recentlyMetContacts(limit = 4) { return state.contacts.filter(contact => !contact.archivedAt && !contact.isFilteredOut && contact.dateFirstMet).sort((left, right) => new Date(right.dateFirstMet) - new Date(left.dateFirstMet)).slice(0, limit); }
function todayRecentSection(contacts) { return `<section class="today-home__section today-recent" aria-labelledby="today-recently-met"><div class="today-section-head"><h2 id="today-recently-met">Recently met</h2><button type="button" data-open-people>People</button></div><div class="today-recent__list">${contacts.map(contact => `<button type="button" data-contact-id="${escapeHTML(contact.id)}">${Avatar(contact.fullName, { size:"small" })}<span><strong>${escapeHTML(contact.fullName || "Unnamed contact")}</strong><small>${escapeHTML([contact.placeName,fmtDate(contact.dateFirstMet)].filter(Boolean).join(" · "))}</small></span>${icons.chevronRight}</button>`).join("")}</div></section>`; }
function todayWorthDoingSection(items, now=new Date()) {
  const useful=items.filter(item=>item?.contact);
  return `<section class="today-home__section today-worth" aria-labelledby="today-worth-doing"><div class="today-section-head"><h2 id="today-worth-doing">Worth doing</h2></div>${useful.length?`<div class="today-worth__list">${useful.map(item=>{const name=String(item.contact.fullName||"Unnamed contact");const signal=item.followUp?todayFollowUpSummary(item.followUp,now):todayContactContext(item.contact,item.score,now);const note=String(item.followUp?.note||item.contact.personalInfo||"").trim();return `<article><span aria-hidden="true"></span><div><h3>${escapeHTML(name)}</h3><p>${escapeHTML(signal)}${note?` · ${escapeHTML(note.slice(0,120))}`:""}</p><button type="button" data-contact-id="${escapeHTML(item.contact.id)}">Open relationship ${icons.chevronRight}</button></div></article>`;}).join("")}</div>`:`<p class="today-worth__empty">Relationship signals will appear here when Bridge has a truthful next step to show.</p>`}</section>`;
}
function todayMomentum(now = new Date()) {
  const weekStart = startOfDay(addDays(now, -6));
  const conversations = countedConversations().filter(log => new Date(log.conversationDate || log.createdAt) >= weekStart).length;
  const pipelineMoves = state.contacts.flatMap(contact => contact.stageEvents || []).filter(event => PIPELINE_STAGES.includes(event.stage) && new Date(event.occurredAt) >= weekStart).length;
  const activeRelationships = state.contacts.filter(contact => !contact.archivedAt && !contact.isFilteredOut).length;
  return { conversations, pipelineMoves, activeRelationships, series:conversationTrend(7,now) };
}
function todayMomentumSection(momentum, dailyGoal) {
  const max=Math.max(1,...momentum.series.map(point=>point.value));
  return `<section class="today-home__section today-momentum" aria-labelledby="today-momentum"><div class="today-section-head"><h2 id="today-momentum">Momentum</h2><button type="button" data-page="analytics">Insights</button></div><button type="button" class="today-momentum__weekly" data-page="analytics" aria-label="Open Insights; ${escapeHTML(momentum.series.map(point=>`${point.label} ${point.value}`).join(", "))}"><span class="today-momentum__bars" aria-hidden="true">${momentum.series.map(point=>`<i><b style="height:${point.value?Math.max(14,Math.round(point.value/max*100)):5}%"></b><small>${escapeHTML(point.label.slice(0,1))}</small></i>`).join("")}</span><span class="today-momentum__summary"><span><strong>${momentum.conversations} conversations</strong> this week</span><span>${momentum.pipelineMoves} pipeline movements</span></span></button></section>`;
}
function conversationTrend(days=7,now=new Date()){const start=startOfDay(now);return Array.from({length:days},(_,index)=>{const date=addDays(start,index-(days-1));const key=dayKey(date);return {date:key,label:new Intl.DateTimeFormat(undefined,{weekday:"short"}).format(date),value:countedConversations().filter(log=>dayKey(log.conversationDate||log.createdAt)===key).length};});}
function renderMiniTrend(points){const max=Math.max(1,...points.map(point=>point.value));return `<div class="mini-trend" role="img" aria-label="Conversation trend: ${points.map(point=>`${point.label} ${point.value}`).join(', ')}">${points.map(point=>`<span style="--trend-height:${Math.max(8,Math.round(point.value/max*100))}%" title="${point.label}: ${point.value}"></span>`).join("")}</div>`;}
function renderRelationshipJourney(points){
  const total=points.reduce((sum,point)=>sum+point.value,0);
  const activePoints=points.filter(point=>point.value>0);
  const summary=total ? `${total} counted conversation${total===1?"":"s"} over the last ${points.length} days. ${points.map(point=>`${point.label} ${point.value}`).join(", ")}.` : `No counted conversations in the last ${points.length} days.`;
  if(!stateHydrated) return SurfaceCard(`${SectionHeader("Relationship Journey", { description:"Loading your relationship activity", level:2 })}${LoadingSkeleton({ lines:2, className:"journey-skeleton" })}<span class="sr-only">Loading relationship activity.</span>`, { className:"relationship-journey relationship-journey--loading" });
  if(!total) return SurfaceCard(`${SectionHeader("Relationship Journey", { description:"Your conversation rhythm this week", action:"<strong>0</strong>", level:2 })}${EmptyState("No conversations yet", "Your counted conversations will appear here as you build momentum.", { className:"relationship-journey__empty" })}<p class="sr-only">${summary}</p>`, { className:"relationship-journey relationship-journey--empty" });
  const width=320,height=104,padding=12,max=Math.max(1,...points.map(point=>point.value));
  const coordinates=points.map((point,index)=>({x:padding+(index/Math.max(1,points.length-1))*(width-padding*2),y:height-padding-(point.value/max)*(height-padding*2)}));
  const line=coordinates.map(point=>`${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area=coordinates.length?`M ${coordinates[0].x.toFixed(1)} ${height-padding} L ${coordinates.map(point=>`${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" L ")} L ${coordinates.at(-1).x.toFixed(1)} ${height-padding} Z`:"";
  const currentIndex=coordinates.length-1;
  return SurfaceCard(`${SectionHeader("Relationship Journey", { description:activePoints.length===1?"One day of conversation activity this week":"Your conversation rhythm this week", action:`<strong>${total}</strong>`, level:2 })}<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHTML(summary)}"><path class="journey-area" d="${area}"></path><polyline class="journey-line" points="${line}"></polyline>${coordinates.map((point,index)=>`<circle class="${index===currentIndex?"current":""}" cx="${point.x}" cy="${point.y}" r="3.5"></circle>`).join("")}</svg><div class="journey-labels"><span>${points[0]?.label||""}</span><span>${points[Math.floor(points.length/2)]?.label||""}</span><span>Today</span></div><p class="sr-only">${summary}</p>`, { className:`relationship-journey ${activePoints.length===1?"relationship-journey--single":""}` });
}
function renderPipelineDistribution(contacts){const counts=PIPELINE_STAGES.map(stage=>({stage,count:contacts.filter(contact=>currentPipelineStage(contact)===stage).length})).filter(item=>item.count);const total=Math.max(1,counts.reduce((sum,item)=>sum+item.count,0));return counts.length?`<div class="pipeline-distribution">${counts.map(item=>`<div><span>${escapeHTML(stageLabel(item.stage))}</span><div class="distribution-track"><i style="width:${Math.round(item.count/total*100)}%"></i></div><strong>${item.count}</strong></div>`).join("")}</div>`:emptyInline("No active stages", "Assign a stage when the next step is clear.");}
function recentRelationshipActivity(limit=5){const conversationActivity=state.contacts.flatMap(contact=>(contact.conversations||[]).map(log=>({contact,at:log.conversationDate||log.createdAt,label:log.communicationType?`${log.communicationType} · ${log.outcome||log.direction||"Activity"}`:log.type||"Note",icon:log.communicationType==="Call"?"phoneCall":log.communicationType==="Text"?"chat":"note"})));const actionActivity=state.contacts.flatMap(contact=>(contact.followUps||[]).filter(item=>item.updatedAt||item.createdAt).map(item=>({contact,at:item.updatedAt||item.createdAt,label:`Action ${followUpStatus(item)}`,icon:"calendarCheck"})));return [...conversationActivity,...actionActivity].filter(item=>item.at).sort((left,right)=>new Date(right.at)-new Date(left.at)).slice(0,limit);}
function recentNetworkActivity(contactIds,limit=5){const contacts=state.contacts.filter(contact=>contactIds.has(String(contact.id)));const conversations=contacts.flatMap(contact=>(contact.conversations||[]).map(log=>({contact,at:log.conversationDate||log.createdAt,label:log.communicationType?`${log.communicationType} · ${log.outcome||log.direction||"Activity"}`:log.type||"Note"})));const actions=contacts.flatMap(contact=>(contact.followUps||[]).filter(item=>item.updatedAt||item.createdAt).map(item=>({contact,at:item.updatedAt||item.createdAt,label:`Action ${followUpStatus(item)}`})));return [...conversations,...actions].filter(item=>item.at).sort((left,right)=>new Date(right.at)-new Date(left.at)).slice(0,limit);}
function miniFollowUp(item) { const overdue = new Date(item.dueDate)<new Date(); return `<button class="mini-row" data-contact-id="${item.contact.id}"><div class="avatar">${initials(item.contact.fullName)}</div><div><strong>${escapeHTML(item.contact.fullName)}</strong><span class="muted">${escapeHTML(item.note||"Follow up")}</span></div><div class="row-end"><span class="pill ${overdue?"danger":"accent"}">${overdue?"Overdue · ":""}${fmtDateTime(item.dueDate)}</span></div></button>`; }
function emptyInline(title, text) { return `<div class="empty"><div><strong>${title}</strong>${text}</div></div>`; }

function renderContacts() {
  if (!stateHydrated) return contactsLoading();
  const filtered = getFilteredContacts();
  const connectionState = accountContext.mode === "account" && ["offline", "error"].includes(accountContext.status?.state)
    ? '<p class="contacts-status-note" role="status">Showing the latest saved contacts while Bridge reconnects.</p>'
    : "";
  if (ui.contactMode !== "list") return renderContactWorkspace(filtered, connectionState);
  const people = peopleVisibleContacts(filtered);
  const activeContacts = state.contacts.filter(contact => !contact.archivedAt && !contact.isFilteredOut);
  return `<section class="people-home" aria-label="People">
    <header class="people-home__header"><h1>People</h1><button class="people-home__places" type="button" data-people-contact-mode="places" aria-label="Browse places">${icons.location}</button></header>
    ${SearchField({ id:"contactSearch", value:ui.search, placeholder:"Search people", label:"Search people", className:"people-home__search" })}
    <div class="people-home__filters" role="group" aria-label="Quick people filters">${["All","Recent","Priority","Prospects","Customers"].map(label => Chip(label, { active:ui.peopleQuick===label, className:"people-home__quick-filter", attributes:`data-people-quick="${label}"` })).join("")}${peopleFiltersTrigger()}</div>
    <p class="people-home__count">${people.length} ${people.length===1 ? "person" : "people"}</p>
    ${connectionState}${renderPeopleList(people, activeContacts.length)}
  </section>`;
}
function renderContactWorkspace(filtered, connectionState="") { const labels={pipeline:"Pipeline",places:"Places",network:"Human Network"}; if(ui.contactMode==="pipeline")return renderPipeline(connectionState); if(ui.contactMode==="places")return renderPlaces(connectionState); return `<section class="contacts-route contacts-route--workspace" aria-label="${labels[ui.contactMode]||"People"}">${pageHead(labels[ui.contactMode]||"People", "Your existing relationship workspace.", '<button class="button subtle" type="button" data-people-contact-mode="list">Back to People</button>')}${connectionState}${renderNetworkWorkspace(filtered)}</section>`; }
function contactsLoading() { return `<section class="people-home people-home--loading" aria-label="People" aria-busy="true"><header class="people-home__header"><h1>People</h1></header>${LoadingSkeleton({lines:4})}<span class="sr-only">Loading people.</span></section>`; }
function peopleVisibleContacts(filtered = getFilteredContacts()) { if (ui.peopleQuick === "Recent") return filtered.filter(contact => contactRecencyDays(contact) <= 14); if (ui.peopleQuick === "Priority") return filtered.filter(contact => contact.interestLevel === "High" || relationshipActionState(contact) === "Overdue"); if (ui.peopleQuick === "Prospects") return filtered.filter(contact => contact.role === "Prospect"); if (ui.peopleQuick === "Customers") return filtered.filter(contact => contact.role === "Customer"); return filtered; }
function peopleFiltersTrigger({className=""}={}) { return Chip("Filter", { count:peopleActiveFilterCount() || "", iconName:"sliders", className:`people-home__filter-button${className?` ${className}`:""}`, attributes:'data-open-people-filters' }); }
function peopleActiveFilterCount() { return [ui.roleFilter !== "All Roles", ui.visibilityFilter !== "Active", ui.healthBandFilter !== "All", ui.healthTrendFilter !== "All", ui.actionCoverageFilter !== "All", ui.recencyFilter !== "All", ui.pipelineStageFilter !== "All", ui.interestFilter !== "All", ui.judgementFilter !== "All", ui.placeFilter !== "All", ui.followUpFilter !== "All", Boolean(ui.conversationFrom || ui.conversationTo), ui.sort !== "recentContact"].filter(Boolean).length; }
function peopleRelativeDate(value, now = new Date()) { if (!value) return "No activity yet"; const days=Math.max(0,calendarDaysBetween(now,value)); return days===0 ? "Today" : days===1 ? "Yesterday" : `${days} days ago`; }
function renderPeopleList(contacts, activeCount, {query="",emptyTitle="",emptyMessage="",noResults=false}={}) { if (!contacts.length) return activeCount||noResults ? EmptyState(emptyTitle||"Nobody matches that", emptyMessage||"Try another search or loosen a filter.", { className:"people-home__empty" }) : EmptyState("No people yet", "Capture your first relationship to start your People list.", { className:"people-home__empty" }); return `<div class="people-list">${contacts.map(contact => peopleRow(contact,{query})).join("")}</div>`; }
function highlightPeopleMatch(value,query="") { const text=String(value||""); const phrase=String(query).trim(); if(!phrase)return escapeHTML(text); const escaped=phrase.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); if(!escaped)return escapeHTML(text); const matcher=new RegExp(`(${escaped})`,"ig"); return text.split(matcher).map((part,index)=>index%2?`<mark class="people-match">${escapeHTML(part)}</mark>`:escapeHTML(part)).join(""); }
function peopleSearchText(contact) { return [contact.fullName,contact.phoneNumber,contact.email,contact.placeName,contact.personalInfo,...(contact.conversations||[]).map(log=>log.notes),...(contact.notes||[]).map(note=>typeof note==="string"?note:note?.text||note?.notes||"")].filter(Boolean).join(" "); }
function peopleSearchContext(contact,query="") { const needle=String(query).trim().toLowerCase(); if(!needle)return ""; const name=String(contact.fullName||""); if(name.toLowerCase().includes(needle))return `${contact.placeName||"No place saved"} · ${peopleRelativeDate(latestConversationTime(contact)||contact.dateFirstMet||contact.createdAt)}`; if(String(contact.placeName||"").toLowerCase().includes(needle))return `Met at ${contact.placeName}`; const written=[contact.personalInfo,...(contact.conversations||[]).map(log=>log.notes),...(contact.notes||[]).map(note=>typeof note==="string"?note:note?.text||note?.notes||"")].find(value=>String(value||"").toLowerCase().includes(needle)); return written?`“${String(written).trim().replace(/\s+/g," ").slice(0,110)}”`:"Matches a saved relationship detail"; }
function peopleRow(contact,{query=""}={}) { const name=String(contact.fullName||"Unnamed contact"); const latest=latestConversationTime(contact)||contact.dateFirstMet||contact.createdAt; const place=contact.placeName||"No place saved"; const stage=contact.role === "Team" ? "Team" : stageFor(contact); const stageContent=stage === "No stage" ? '<span class="people-row__stage people-row__stage--empty">No stage</span>' : `<span class="people-row__stage"><i aria-hidden="true"></i>${escapeHTML(contact.role === "Team" ? stage : `${contact.role} · ${stage}`)}</span>`; const actionState=relationshipActionState(contact); const secondary=actionState==="Overdue" ? '<em class="people-row__overdue">Follow-up overdue</em>' : contact.role !== "Team" && contact.interestLevel !== "Unsure" ? `<em>${escapeHTML(contact.interestLevel)} interest</em>` : ""; const matchContext=peopleSearchContext(contact,query); const meta=matchContext||`${place} · ${peopleRelativeDate(latest)}`; return `<article class="people-row"><button type="button" class="people-row__open" data-contact-id="${escapeHTML(contact.id)}" aria-label="Open ${escapeHTML(name)}">${Avatar(name,{size:"small",className:"people-row__avatar"})}<span class="people-row__body"><strong>${highlightPeopleMatch(name,query)}</strong><small>${highlightPeopleMatch(meta,query)}</small><span class="people-row__indicators">${stageContent}${secondary}</span></span>${icons.chevronRight}</button></article>`; }
function peopleActivityAt(contact) { return [latestConversationTime(contact),...(contact.followUps||[]).map(item=>item.updatedAt||item.createdAt),contact.dateFirstMet,contact.createdAt].filter(value=>Number.isFinite(new Date(value).getTime())).sort((left,right)=>new Date(right)-new Date(left))[0]||null; }
function peopleSuggestionLabel(contact) { const conversation=latestConversationTime(contact); if(conversation)return `Last interaction ${peopleRelativeDate(conversation)}`; if(contact.dateFirstMet)return `Met ${peopleRelativeDate(contact.dateFirstMet)}`; return contact.createdAt?`Added ${peopleRelativeDate(contact.createdAt)}`:"No activity yet"; }
function renderPeopleSearchSuggestions(contacts) { const recent=[...contacts].sort((left,right)=>new Date(peopleActivityAt(right)||0)-new Date(peopleActivityAt(left)||0)).slice(0,4); const places=state.places.map(place=>{const related=contacts.filter(contact=>placeMatchesContact(place,contact));const latest=related.map(peopleActivityAt).filter(Boolean).sort((left,right)=>new Date(right)-new Date(left))[0]||null;return {...place,related,latest};}).filter(place=>place.related.length).sort((left,right)=>new Date(right.latest||0)-new Date(left.latest||0)).slice(0,3); if(!recent.length)return EmptyState("No recent relationships", "People you add or interact with will appear here.",{className:"people-home__empty"}); return `<section class="people-suggestions" aria-label="Search suggestions"><div class="people-suggestions__section"><h2>Most recent</h2><div class="people-suggestions__list">${recent.map(contact=>`<button type="button" class="people-suggestion-row" data-contact-id="${escapeHTML(contact.id)}">${Avatar(contact.fullName,{size:"small"})}<span><strong>${escapeHTML(contact.fullName||"Unnamed contact")}</strong><small>${escapeHTML(peopleSuggestionLabel(contact))}</small></span>${icons.chevronRight}</button>`).join("")}</div></div>${places.length?`<div class="people-suggestions__section"><h2>Places</h2><div class="people-suggestions__list">${places.map(place=>`<button type="button" class="people-suggestion-row people-suggestion-row--place" data-place-detail-id="${escapeHTML(place.id)}"><span class="people-suggestion-row__icon" aria-hidden="true">${icons.location}</span><span><strong>${escapeHTML(place.name)}</strong><small>${place.related.length} ${place.related.length===1?"person":"people"}${place.latest?` · ${escapeHTML(peopleRelativeDate(place.latest))}`:""}</small></span>${icons.chevronRight}</button>`).join("")}</div></div>`:""}</section>`; }
function peopleFilterStageOptions() { return [{value:"All",label:"All stages"},...Object.entries(PIPELINES).flatMap(([role,stages])=>stages.map(stage=>({value:`${role}:${stage}`,label:`${role} · ${stage}`})))]; }
function peopleFilterPlaceOptions() { const saved=state.places.slice().sort((left,right)=>String(left.name).localeCompare(String(right.name))); const knownNames=new Set(saved.map(place=>String(place.name||"").trim().toLowerCase())); const legacyNames=[...new Set(state.contacts.map(contact=>String(contact.placeName||"").trim()).filter(Boolean).filter(name=>!knownNames.has(name.toLowerCase())))].sort((left,right)=>left.localeCompare(right)); return [{value:"All",label:"All places"},...saved.map(place=>({value:`id:${place.id}`,label:place.name})),...legacyNames.map(name=>({value:`name:${name.toLowerCase()}`,label:name}))]; }
function peopleFilterSheet(resultCount) { const modes=["list","pipeline","places","network"]; const footer=`<div class="people-filter-sheet__actions"><button type="button" class="button subtle" data-people-reset>Clear all</button><button type="button" class="button primary" data-people-filter-close data-ui-dialog-close>Show ${resultCount} ${resultCount===1?"person":"people"}</button></div>`; return MobileSheet(`<div class="people-filter-sheet__content"><section><p class="people-filter-sheet__label">View</p>${SegmentedControl(modes.map(mode=>({label:mode[0].toUpperCase()+mode.slice(1),value:mode,active:ui.contactMode===mode,attributes:`data-people-contact-mode="${mode}"`})),{label:"People workspace",className:"people-filter-sheet__modes"})}</section><section><p class="people-filter-sheet__label">Sort</p>${FilterControl({id:"peopleSort",label:"Sort people",iconName:"sort",value:ui.sort,options:[{value:"recentContact",label:"Most recently added"},{value:"recentConversation",label:"Most recent conversation"},{value:"oldestConversation",label:"Oldest conversation"},{value:"followup",label:"Next follow-up"},{value:"interest",label:"Interest"}]})}</section><section><p class="people-filter-sheet__label">Relationship</p><div class="people-filter-sheet__chips">${["All Roles","Prospect","Customer","Team"].map(role=>Chip(role === "All Roles" ? "All" : role,{active:ui.roleFilter===role,attributes:`data-people-role="${role}"`})).join("")}</div>${FilterControl({id:"peoplePipelineStage",label:"Exact pipeline stage",value:ui.pipelineStageFilter,options:peopleFilterStageOptions()})}${relationshipFilterSelect("peopleInterest","Interest",["All",...INTERESTS],ui.interestFilter)}${relationshipFilterSelect("peopleJudgement","Judgment",["All","Good Fit","Not Good Fit"],ui.judgementFilter)}${FilterControl({id:"peoplePlace",label:"Place",value:ui.placeFilter,options:peopleFilterPlaceOptions()})}</section><section><p class="people-filter-sheet__label">Relationship signals</p>${relationshipFilterSelect("healthBandFilter","Health",["All","Strong","Steady","Needs Attention","At Risk","Building Baseline"],ui.healthBandFilter)}${relationshipFilterSelect("healthTrendFilter","Trend",["All","Improving","Steady","Declining"],ui.healthTrendFilter)}${relationshipFilterSelect("actionCoverageFilter","Next action",["All","Overdue","Missing next action","Covered"],ui.actionCoverageFilter)}${relationshipFilterSelect("peopleFollowUp","Follow-up status",["All","Overdue","Due today","Scheduled","No follow-up"],ui.followUpFilter)}${relationshipFilterSelect("recencyFilter","Last interaction",["All","Within 7 days","Within 14 days","Within 30 days","60+ days"],ui.recencyFilter)}</section><section><p class="people-filter-sheet__label">Visibility</p>${FilterControl({id:"peopleVisibility",label:"Contact visibility",iconName:"archive",value:ui.visibilityFilter,options:["Active","No-Go","Archived","All"]})}</section><section><p class="people-filter-sheet__label">Conversation date</p><div class="people-filter-sheet__dates">${field("From",`<input id="conversationFrom" type="date" value="${ui.conversationFrom}">`)}${field("To",`<input id="conversationTo" type="date" value="${ui.conversationTo}">`)}</div></section></div>`,{title:"Filter people",id:"peopleFilterSheet",className:"people-filter-sheet",closeAttributes:"data-people-filter-close",footer}); }
function relationshipFilterSelect(id,label,options,value){return `<div class="people-filter-sheet__field"><span>${escapeHTML(label)}</span>${FilterControl({id,label,value,options})}</div>`;}
function relationshipActionState(contact, now = new Date()) { const scheduled=(contact.followUps||[]).filter(isScheduledFollowUp); if(scheduled.some(item=>new Date(item.dueDate)<now))return "Overdue"; return scheduled.length?"Covered":"Missing next action"; }
function contactRecencyDays(contact, now = new Date()) { const latest=latestConversationTime(contact); if(!latest)return Number.POSITIVE_INFINITY; return Math.max(0,calendarDaysBetween(now,latest)); }
function relationshipTrendDirection(score) { return String(score?.trend?.direction || score?.trend || "steady").toLowerCase(); }
function followUpFilterState(contact, now=new Date()) { const scheduled=(contact.followUps||[]).filter(isScheduledFollowUp); if(!scheduled.length)return "No follow-up"; if(scheduled.some(item=>new Date(item.dueDate)<now))return "Overdue"; const today=startOfDay(now).getTime(); if(scheduled.some(item=>startOfDay(new Date(item.dueDate)).getTime()===today))return "Due today"; return "Scheduled"; }
function getFilteredContacts({ignoreSearch=false}={}) {
  const query=ignoreSearch?"":ui.search.trim().toLowerCase();
  const rank={High:0,Medium:1,Low:2,Unsure:3};
  const scores=relationshipScoreMap();
  const contacts=state.contacts.filter(c=>{const score=scores.get(String(c.id));const recency=contactRecencyDays(c);const bandMatches=ui.healthBandFilter==="All"||score?.band===ui.healthBandFilter;const trendMatches=ui.healthTrendFilter==="All"||relationshipTrendDirection(score)===ui.healthTrendFilter.toLowerCase();const actionMatches=ui.actionCoverageFilter==="All"||relationshipActionState(c)===ui.actionCoverageFilter;const recencyMatches=ui.recencyFilter==="All"||(ui.recencyFilter==="Within 7 days"&&recency<=7)||(ui.recencyFilter==="Within 14 days"&&recency<=14)||(ui.recencyFilter==="Within 30 days"&&recency<=30)||(ui.recencyFilter==="60+ days"&&recency>=60);const [filterRole,filterStage]=ui.pipelineStageFilter==="All"?["",""]:ui.pipelineStageFilter.split(":");const stageMatches=ui.pipelineStageFilter==="All"||(c.role===filterRole&&stageFor(c)===filterStage);const interestMatches=ui.interestFilter==="All"||c.interestLevel===ui.interestFilter;const judgementMatches=ui.judgementFilter==="All"||c.judgement===ui.judgementFilter;const selectedPlaceId=ui.placeFilter.startsWith("id:")?ui.placeFilter.slice(3):"";const selectedPlace=selectedPlaceId?state.places.find(place=>String(place.id)===selectedPlaceId):null;const selectedPlaceName=ui.placeFilter.startsWith("name:")?ui.placeFilter.slice(5):"";const placeMatches=ui.placeFilter==="All"||(selectedPlace?placeMatchesContact(selectedPlace,c):String(c.placeName||"").trim().toLowerCase()===selectedPlaceName);const followUpMatches=ui.followUpFilter==="All"||followUpFilterState(c)===ui.followUpFilter;return matchesVisibilityFilter(c,ui.visibilityFilter)&&(ui.roleFilter==="All Roles"||c.role===ui.roleFilter)&&bandMatches&&trendMatches&&actionMatches&&recencyMatches&&stageMatches&&interestMatches&&judgementMatches&&placeMatches&&followUpMatches&&hasConversationInRange(c,ui.conversationFrom,ui.conversationTo)&&(!query||peopleSearchText(c).toLowerCase().includes(query));});
  return sortContacts(contacts,ui.sort,rank,nextFollowUpDate);
}
function nextFollowUpDate(contact){const active=contact.followUps.filter(isScheduledFollowUp).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate))[0];return active?new Date(active.dueDate).getTime():Number.MAX_SAFE_INTEGER;}
function renderContactList(contacts) { if(!contacts.length)return emptyInline("No contacts found","Try a different filter or add a new conversation.");const scores=relationshipScoreMap();return `<div class="contact-list">${contacts.map(contact=>contactCard(contact,scores.get(String(contact.id)))).join("")}</div>`; }
function contactCard(contact,score=null) { const follow=contact.followUps.filter(isScheduledFollowUp).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate))[0];const latest=latestConversationTime(contact);const team=contact.role==="Team";const actionState=relationshipActionState(contact);const primaryMeta=[contact.role,!team&&stageFor(contact)].filter(Boolean).map(escapeHTML).join(" · ");const relationshipMeta=[!team&&contact.interestLevel?`${escapeHTML(contact.interestLevel)} interest`:"",contact.placeName?escapeHTML(contact.placeName):"",latest?`Last conversation ${fmtDate(new Date(latest).toISOString())}`:""].filter(Boolean).join(" · ");const status=contact.archivedAt?'<span class="ui-status-badge">Archived</span>':contact.isFilteredOut?'<span class="ui-status-badge ui-status-badge--overdue">No-Go</span>':follow?`<span class="ui-status-badge ${new Date(follow.dueDate)<new Date()?"ui-status-badge--overdue":"ui-status-badge--brand"}">${fmtDate(follow.dueDate)}</span>`:team?"":`<span class="ui-status-badge ui-status-badge--uncertain">${escapeHTML(contact.judgement)}</span>`;const trend=relationshipTrendDirection(score);const health=state.settings.healthScoresVisible&&score?`<div class="contact-health"><span class="health-dot health-${score.band.toLowerCase().replaceAll(" ","-")}"></span><strong>${escapeHTML(score.band)}</strong>${score.score===null?"":`<span>${score.score}</span>`}<span>${escapeHTML(trend[0].toUpperCase()+trend.slice(1))}</span>${actionState!=="Covered"?`<span class="${actionState==="Overdue"?"danger-text":""}">${actionState}</span>`:""}</div>`:""; return `<article class="contact-card glass"><button class="contact-card-open" data-contact-id="${contact.id}" aria-label="Open ${escapeHTML(contact.fullName)}"><span class="avatar ui-avatar ui-avatar--small">${initials(contact.fullName)}</span><span class="contact-body"><strong class="contact-name">${escapeHTML(contact.fullName)}</strong><span class="contact-primary-meta">${primaryMeta}</span>${relationshipMeta?`<span class="contact-relationship-meta">${relationshipMeta}</span>`:""}${health}</span><span class="contact-status">${status}</span></button>${isCallablePhone(contact.phoneNumber)?`<div class="contact-quick-actions"><a class="ui-icon-button contact-call" href="${phoneHref(contact.phoneNumber)}" data-communication-contact-id="${contact.id}" data-communication-type="Call" aria-label="Call ${escapeHTML(contact.fullName)}">${icons.phone}</a><a class="ui-icon-button contact-text" href="${messageHref(contact.phoneNumber)}" data-communication-contact-id="${contact.id}" data-communication-type="Text" aria-label="Text ${escapeHTML(contact.fullName)}">${icons.chat}</a></div>`:""}</article>`; }
function renderPipelineGroup(role, contacts) { const stages=PIPELINES[role] || []; return `<section class="pipeline-role-group contacts-pipeline-group"><header class="pipeline-role-head">${SectionHeader(role === "Customer" ? "Customer relationships" : "Prospect relationships",{eyebrow:"Pipeline",description:"Move each relationship forward when the next step is clear.",level:2})}</header><div class="pipeline-board ${role === "Customer" ? "customer-pipeline" : ""}">${stages.map(stage=>{const group=contacts.filter(c=>c.role===role&&stageFor(c)===stage);const people=group.map(c=>`<button class="pipeline-person contacts-pipeline-person" data-contact-id="${c.id}">${Avatar(c.fullName,{size:"small"})}<span><strong>${escapeHTML(c.fullName)}</strong><small>${escapeHTML(c.interestLevel||"Interest unknown")} interest</small></span></button>`).join("")||'<p class="contacts-pipeline-empty">No relationships in this stage.</p>';return SurfaceCard(`<header class="column-head"><div><span class="ui-eyebrow">${escapeHTML(role)}</span><strong>${escapeHTML(stageLabel(stage))}</strong></div>${StatusBadge(String(group.length),"neutral")}</header><div class="contacts-pipeline-people">${people}</div>`,{className:"pipeline-column contacts-pipeline-column"});}).join("")}</div></section>`; }
function activePipelineContacts(role) { return state.contacts.filter(contact=>contact.role===role&&!contact.archivedAt&&!contact.isFilteredOut&&PIPELINES[role].includes(currentPipelineStage(contact))); }
function pipelineStageEnteredAt(contact,stage) {
  const values=[contact.stageDates?.[stage],...(contact.stageEvents||[]).filter(event=>(event.toStage||event.stage)===stage).map(event=>event.occurredAt)].filter(value=>Number.isFinite(new Date(value).getTime())).sort((left,right)=>new Date(right)-new Date(left));
  return values[0]||null;
}
function pipelineStageAge(contact,stage,now=new Date()) { const enteredAt=pipelineStageEnteredAt(contact,stage);return enteredAt===null?null:Math.max(0,calendarDaysBetween(now,enteredAt)); }
function prospectPipelineMovements(now=new Date()) {
  const start=startOfDay(addDays(now,-6));
  return state.contacts.filter(contact=>contact.role==="Prospect"&&!contact.archivedAt&&!contact.isFilteredOut).flatMap(contact=>(contact.stageEvents||[]).filter(event=>PIPELINES.Prospect.includes(event.stage)&&new Date(event.occurredAt)>=start).map(event=>({contact,event}))).sort((left,right)=>new Date(right.event.occurredAt)-new Date(left.event.occurredAt));
}
function pipelineMovementText(event) {
  const from=PIPELINES.Prospect.includes(event.fromStage)?event.fromStage:"";const to=PIPELINES.Prospect.includes(event.toStage)?event.toStage:PIPELINES.Prospect.includes(event.stage)?event.stage:"";
  if(from&&to)return `${from} → ${to}`;if(to)return `→ ${to}`;if(from)return `${from} → No stage`;return "Stage updated";
}
function pipelineAvatarStack(contacts) { return contacts.length?`<span class="prospect-stage__avatars" aria-hidden="true">${contacts.slice(0,3).map(contact=>Avatar(contact.fullName,{size:"small"})).join("")}</span>`:""; }
function prospectPipelinePersonRow(contact,stage,now=new Date()) {
  const age=pipelineStageAge(contact,stage,now);const stalled=age!==null&&age>PIPELINE_STALL_DAYS;const detail=age===null?"Stage date not recorded":`${age} ${age===1?"day":"days"} in ${stage}`;
  return `<button type="button" class="prospect-stage-person ${stalled?"is-stalled":""}" data-prospect-pipeline-contact="${escapeHTML(contact.id)}" aria-label="Manage ${escapeHTML(contact.fullName)} in ${escapeHTML(stage)}">${Avatar(contact.fullName,{size:"small"})}<span><strong>${escapeHTML(contact.fullName)}</strong><small>${escapeHTML(detail)}</small></span></button>`;
}
function prospectPipelineStage(stage,contacts,now=new Date()) {
  const group=contacts.filter(contact=>currentPipelineStage(contact)===stage);const stalled=group.filter(contact=>{const age=pipelineStageAge(contact,stage,now);return age!==null&&age>PIPELINE_STALL_DAYS;});const expanded=ui.pipelineExpandedStages.has(stage);
  return `<section class="prospect-stage ${group.length?"has-people":"is-empty"} ${expanded?"is-expanded":""}" data-prospect-stage="${escapeHTML(stage)}"><button type="button" class="prospect-stage__header" data-prospect-stage-toggle="${escapeHTML(stage)}" aria-expanded="${expanded}"><i class="prospect-stage__dot" aria-hidden="true"></i><span class="prospect-stage__heading"><span><strong>${escapeHTML(stage)}</strong><em>${group.length}</em></span><small>${escapeHTML(PROSPECT_STAGE_DESCRIPTIONS[stage])}${stalled.length?` · <b>${stalled.length} stalled</b>`:""}</small></span>${pipelineAvatarStack(group)}<span class="prospect-stage__chevron" aria-hidden="true">${icons.chevronDown}</span></button>${expanded?`<div class="prospect-stage__body">${group.length?group.map(contact=>prospectPipelinePersonRow(contact,stage,now)).join(""):'<p class="prospect-stage__empty">Nobody here yet.</p>'}<button type="button" class="prospect-stage__open" data-prospect-stage-open="${escapeHTML(stage)}">Open ${escapeHTML(stage)}</button></div>`:""}</section>`;
}
function prospectStageHistory(contact) {
  return (contact.stageEvents||[]).filter(event=>PIPELINES.Prospect.includes(event.stage)||PIPELINES.Prospect.includes(event.fromStage)||PIPELINES.Prospect.includes(event.toStage)).sort((left,right)=>new Date(right.occurredAt)-new Date(left.occurredAt));
}
function prospectStageDetailSheet(stage,contacts,now=new Date()) {
  const content=prospectStageDetailContent(stage,contacts,now);return content?MobileSheet(content,{title:stage,id:"prospectStageDetailSheet",className:"prospect-stage-sheet"}):"";
}
function pipelineStageDetailContent(role,stage,contacts,now=new Date()) {
  const stages=PIPELINES[role]||[];
  if(!stages.includes(stage))return "";
  const descriptions=role==="Prospect"?PROSPECT_STAGE_DESCRIPTIONS:CUSTOMER_STAGE_DESCRIPTIONS;
  const group=contacts.filter(contact=>currentPipelineStage(contact)===stage);
  const ages=group.map(contact=>pipelineStageAge(contact,stage,now)).filter(Number.isFinite);
  const stalled=group.filter(contact=>{const age=pipelineStageAge(contact,stage,now);return age!==null&&age>PIPELINE_STALL_DAYS;});
  const averageAge=ages.length?Math.round(ages.reduce((sum,age)=>sum+age,0)/ages.length):null;
  const dataAttribute=role==="Prospect"?"data-prospect-pipeline-contact":"data-customer-pipeline-contact";
  const rows=group.map(contact=>{const age=pipelineStageAge(contact,stage,now);const isStalled=age!==null&&age>PIPELINE_STALL_DAYS;const latest=latestConversationTime(contact);return `<button type="button" class="prospect-stage-person pipeline-stage-detail__person ${isStalled?"is-stalled":""}" ${dataAttribute}="${escapeHTML(contact.id)}">${Avatar(contact.fullName,{size:"small"})}<span><strong>${escapeHTML(contact.fullName||"Unnamed contact")}</strong><small>${escapeHTML(age===null?"Stage date not recorded":`${age} ${age===1?"day":"days"} in ${stage}`)} · ${escapeHTML(latest?`last talked ${peopleRelativeDate(latest)}`:"no conversation recorded")}</small></span>${icons.chevronRight}</button>`;}).join("");
  const movements=state.contacts.filter(contact=>contact.role===role).flatMap(contact=>(contact.stageEvents||[]).filter(event=>(event.toStage||event.stage)===stage).map(event=>({contact,event}))).sort((left,right)=>new Date(right.event.occurredAt)-new Date(left.event.occurredAt)).slice(0,5);
  return `<section class="prospect-stage-detail pipeline-stage-detail"><p class="pipeline-stage-detail__description">${escapeHTML(descriptions[stage])}</p><div class="pipeline-stage-detail__rail" style="--stage-count:${stages.length}" aria-label="${escapeHTML(role)} pipeline; current stage ${escapeHTML(stage)}">${stages.map(item=>`<span class="${item===stage?"is-current":""}"><i aria-hidden="true"></i><b>${escapeHTML(item)}</b></span>`).join("")}</div><div class="pipeline-stage-detail__metrics"><div><strong>${group.length}</strong><span>People</span></div><div><strong>${averageAge===null?"—":averageAge}</strong><span>Average days</span></div><div><strong>${stalled.length}</strong><span>Stalled</span></div></div><section class="pipeline-stage-detail__people"><h2>Who is here</h2>${group.length?rows:emptyInline(`No people in ${stage}`,`This stage currently has no assigned ${role}s.`)}</section><section class="pipeline-stage-detail__history"><h2>Stage history</h2>${movements.length?movements.map(({contact,event})=>`<div><strong>${escapeHTML(contact.fullName||"Unnamed contact")}</strong><span>→ ${escapeHTML(stage)}</span><time datetime="${escapeHTML(event.occurredAt)}">${escapeHTML(fmtDate(event.occurredAt))}</time></div>`).join(""):emptyInline("No recorded movement",`Bridge has no stored movements into ${stage}.`)}</section></section>`;
}
function prospectStageDetailContent(stage,contacts,now=new Date()) {
  return pipelineStageDetailContent("Prospect",stage,contacts,now);
}
function prospectTransitionContent(contact) {
  if(!contact||contact.role!=="Prospect")return "";const current=currentPipelineStage(contact);const history=prospectStageHistory(contact).slice(0,4);
  return `<form id="prospectStageTransitionForm" class="prospect-transition-form" data-prospect-contact-id="${escapeHTML(contact.id)}"><p class="prospect-transition-form__current">Current stage <strong>${escapeHTML(current||"No stage")}</strong></p><fieldset><legend>Move to</legend>${PIPELINES.Prospect.map(stage=>`<label><input type="radio" name="pipelineStage" value="${escapeHTML(stage)}" ${current===stage?"checked":""}><span><strong>${escapeHTML(stage)}</strong><small>${escapeHTML(PROSPECT_STAGE_DESCRIPTIONS[stage])}</small></span></label>`).join("")}<label class="prospect-transition-form__clear"><input type="radio" name="pipelineStage" value="" ${current?"":"checked"}><span><strong>No stage</strong><small>Remove from the active pipeline and keep history</small></span></label></fieldset>${history.length?`<section class="prospect-transition-history"><h3>Stage history</h3>${history.map(event=>`<div><span>${escapeHTML(pipelineMovementText(event))}</span><time datetime="${escapeHTML(event.occurredAt)}">${escapeHTML(fmtDate(event.occurredAt))}</time></div>`).join("")}</section>`:""}<button class="button primary" type="submit">Save stage</button><button class="button subtle" type="button" data-prospect-view-contact="${escapeHTML(contact.id)}">View relationship</button></form>`;
}
function prospectTransitionSheet(contact) {
  const content=prospectTransitionContent(contact);return content?MobileSheet(content,{title:contact.fullName,id:"prospectTransitionSheet",className:"prospect-transition-sheet"}):"";
}
function renderProspectPipeline(contacts,now=new Date()) {
  if(!ui.pipelineExpandedInitialized){const firstStage=PIPELINES.Prospect[0];if(contacts.some(contact=>currentPipelineStage(contact)===firstStage))ui.pipelineExpandedStages.add(firstStage);ui.pipelineExpandedInitialized=true;}
  const movements=prospectPipelineMovements(now);const stalled=contacts.filter(contact=>{const stage=currentPipelineStage(contact);const age=pipelineStageAge(contact,stage,now);return age!==null&&age>PIPELINE_STALL_DAYS;});const unstaged=state.contacts.filter(contact=>contact.role!=="Team"&&!contact.archivedAt&&!contact.isFilteredOut&&!currentPipelineStage(contact));
  return `<div class="prospect-pipeline"><p class="prospect-pipeline__summary"><strong>${contacts.length} ${contacts.length===1?"person":"people"}</strong> in the Prospect pipeline · ${movements.length} ${movements.length===1?"movement":"movements"} this week${stalled.length?` · <em>${stalled.length} stalled over ${PIPELINE_STALL_DAYS} days</em>`:""}</p><div class="prospect-pipeline-stages" aria-label="Prospect pipeline stages">${PIPELINES.Prospect.map(stage=>prospectPipelineStage(stage,contacts,now)).join("")}</div><section class="prospect-recent-movement" aria-labelledby="prospect-recent-movement"><h2 id="prospect-recent-movement">Recent movement</h2>${movements.length?movements.slice(0,5).map(({contact,event})=>`<button type="button" data-prospect-pipeline-contact="${escapeHTML(contact.id)}"><strong>${escapeHTML(contact.fullName)}</strong><span>${escapeHTML(pipelineMovementText(event))}</span><time datetime="${escapeHTML(event.occurredAt)}">${escapeHTML(fmtDate(event.occurredAt))}</time></button>`).join(""):emptyInline("No recent movement","Prospect stage changes from this week will appear here.")}</section>${customerNotInPipeline(unstaged)}</div>`;
}
function customerPipelineMovements(now=new Date()) {
  const start=startOfDay(addDays(now,-6));
  return state.contacts.filter(contact=>contact.role==="Customer"&&!contact.archivedAt&&!contact.isFilteredOut).flatMap(contact=>(contact.stageEvents||[]).filter(event=>PIPELINES.Customer.includes(event.stage)&&new Date(event.occurredAt)>=start).map(event=>({contact,event}))).sort((left,right)=>new Date(right.event.occurredAt)-new Date(left.event.occurredAt));
}
function customerPipelineMovementText(event) {
  const from=PIPELINES.Customer.includes(event.fromStage)?event.fromStage:"";const to=PIPELINES.Customer.includes(event.toStage)?event.toStage:PIPELINES.Customer.includes(event.stage)?event.stage:"";
  if(from&&to)return `${from} → ${to}`;if(to)return `→ ${to}`;if(from)return `${from} → No stage`;return "Stage updated";
}
function customerPipelinePersonRow(contact,stage,now=new Date()) {
  const age=pipelineStageAge(contact,stage,now);const stalled=age!==null&&age>PIPELINE_STALL_DAYS;const detail=age===null?"Stage date not recorded":`${age} ${age===1?"day":"days"} in ${stage}`;
  return `<button type="button" class="prospect-stage-person customer-stage-person ${stalled?"is-stalled":""}" data-customer-pipeline-contact="${escapeHTML(contact.id)}" aria-label="Manage ${escapeHTML(contact.fullName)} in ${escapeHTML(stage)}">${Avatar(contact.fullName,{size:"small"})}<span><strong>${escapeHTML(contact.fullName)}</strong><small>${escapeHTML(detail)}</small></span></button>`;
}
function customerPipelineStage(stage,contacts,now=new Date()) {
  const group=contacts.filter(contact=>currentPipelineStage(contact)===stage);const stalled=group.filter(contact=>{const age=pipelineStageAge(contact,stage,now);return age!==null&&age>PIPELINE_STALL_DAYS;});const expanded=ui.customerPipelineExpandedStages.has(stage);
  return `<section class="prospect-stage customer-stage ${group.length?"has-people":"is-empty"} ${expanded?"is-expanded":""}" data-customer-stage="${escapeHTML(stage)}"><button type="button" class="prospect-stage__header" data-customer-stage-toggle="${escapeHTML(stage)}" aria-expanded="${expanded}"><i class="prospect-stage__dot" aria-hidden="true"></i><span class="prospect-stage__heading"><span><strong>${escapeHTML(stage)}</strong><em>${group.length}</em></span><small>${escapeHTML(CUSTOMER_STAGE_DESCRIPTIONS[stage])}${stalled.length?` · <b>${stalled.length} stalled</b>`:""}</small></span>${pipelineAvatarStack(group)}<span class="prospect-stage__chevron" aria-hidden="true">${icons.chevronDown}</span></button>${expanded?`<div class="prospect-stage__body">${group.length?group.map(contact=>customerPipelinePersonRow(contact,stage,now)).join(""):'<p class="prospect-stage__empty">Nobody here yet.</p>'}<button type="button" class="prospect-stage__open" data-customer-stage-open="${escapeHTML(stage)}">Open ${escapeHTML(stage)}</button></div>`:""}</section>`;
}
function customerStageHistory(contact) {
  return (contact.stageEvents||[]).filter(event=>PIPELINES.Customer.includes(event.stage)||PIPELINES.Customer.includes(event.fromStage)||PIPELINES.Customer.includes(event.toStage)).sort((left,right)=>new Date(right.occurredAt)-new Date(left.occurredAt));
}
function customerStageDetailSheet(stage,contacts,now=new Date()) {
  const content=customerStageDetailContent(stage,contacts,now);return content?MobileSheet(content,{title:stage,id:"customerStageDetailSheet",className:"customer-stage-sheet"}):"";
}
function customerStageDetailContent(stage,contacts,now=new Date()) {
  return pipelineStageDetailContent("Customer",stage,contacts,now);
}
function customerTransitionContent(contact) {
  if(!contact||contact.role!=="Customer")return "";const current=currentPipelineStage(contact);const history=customerStageHistory(contact).slice(0,4);
  return `<form id="customerStageTransitionForm" class="prospect-transition-form customer-transition-form" data-customer-contact-id="${escapeHTML(contact.id)}"><p class="prospect-transition-form__current">Current stage <strong>${escapeHTML(current||"No stage")}</strong></p><fieldset><legend>Move to</legend>${PIPELINES.Customer.map(stage=>`<label><input type="radio" name="pipelineStage" value="${escapeHTML(stage)}" ${current===stage?"checked":""}><span><strong>${escapeHTML(stage)}</strong><small>${escapeHTML(CUSTOMER_STAGE_DESCRIPTIONS[stage])}</small></span></label>`).join("")}<label class="prospect-transition-form__clear"><input type="radio" name="pipelineStage" value="" ${current?"":"checked"}><span><strong>No stage</strong><small>Remove from the active pipeline and keep history</small></span></label></fieldset>${history.length?`<section class="prospect-transition-history"><h3>Stage history</h3>${history.map(event=>`<div><span>${escapeHTML(customerPipelineMovementText(event))}</span><time datetime="${escapeHTML(event.occurredAt)}">${escapeHTML(fmtDate(event.occurredAt))}</time></div>`).join("")}</section>`:""}<button class="button primary" type="submit">Save stage</button><button class="button subtle" type="button" data-customer-view-contact="${escapeHTML(contact.id)}">View relationship</button></form>`;
}
function customerTransitionSheet(contact) {
  const content=customerTransitionContent(contact);return content?MobileSheet(content,{title:contact.fullName,id:"customerTransitionSheet",className:"customer-transition-sheet"}):"";
}
function customerNotInPipeline(contacts) {
  if(!contacts.length)return "";
  return `<section class="customer-not-pipeline" aria-labelledby="customer-not-pipeline-title"><h2 id="customer-not-pipeline-title">Not in a pipeline <span>${contacts.length}</span></h2><div>${contacts.map(contact=>`<button type="button" data-contact-id="${escapeHTML(contact.id)}">${Avatar(contact.fullName,{size:"small"})}<span><strong>${escapeHTML(contact.fullName)}</strong><small>No stage assigned yet</small></span>${icons.chevronRight}</button>`).join("")}</div></section>`;
}
function renderCustomerPipeline(contacts,now=new Date()) {
  if(!ui.customerPipelineExpandedInitialized){const firstStage=PIPELINES.Customer[0];if(contacts.some(contact=>currentPipelineStage(contact)===firstStage))ui.customerPipelineExpandedStages.add(firstStage);ui.customerPipelineExpandedInitialized=true;}
  const movements=customerPipelineMovements(now);const stalled=contacts.filter(contact=>{const stage=currentPipelineStage(contact);const age=pipelineStageAge(contact,stage,now);return age!==null&&age>PIPELINE_STALL_DAYS;});const unstaged=state.contacts.filter(contact=>contact.role!=="Team"&&!contact.archivedAt&&!contact.isFilteredOut&&!currentPipelineStage(contact));
  return `<div class="prospect-pipeline customer-pipeline"><p class="prospect-pipeline__summary"><strong>${contacts.length} ${contacts.length===1?"person":"people"}</strong> in the Customer pipeline · ${movements.length} ${movements.length===1?"movement":"movements"} this week${stalled.length?` · <em>${stalled.length} stalled over ${PIPELINE_STALL_DAYS} days</em>`:""}</p><div class="prospect-pipeline-stages customer-pipeline-stages" aria-label="Customer pipeline stages">${PIPELINES.Customer.map(stage=>customerPipelineStage(stage,contacts,now)).join("")}</div><section class="prospect-recent-movement customer-recent-movement" aria-labelledby="customer-recent-movement"><h2 id="customer-recent-movement">Recent movement</h2>${movements.length?movements.slice(0,5).map(({contact,event})=>`<button type="button" data-customer-pipeline-contact="${escapeHTML(contact.id)}"><strong>${escapeHTML(contact.fullName)}</strong><span>${escapeHTML(customerPipelineMovementText(event))}</span><time datetime="${escapeHTML(event.occurredAt)}">${escapeHTML(fmtDate(event.occurredAt))}</time></button>`).join(""):emptyInline("No recent movement","Customer stage changes from this week will appear here.")}</section>${customerNotInPipeline(unstaged)}</div>`;
}
function renderPipeline(connectionState="") {
  const prospectContacts=activePipelineContacts("Prospect"),customerContacts=activePipelineContacts("Customer");const now=new Date();const selectedContact=state.contacts.find(contact=>String(contact.id)===String(ui.pipelineContactId));const selectedCustomerContact=state.contacts.find(contact=>String(contact.id)===String(ui.customerPipelineContactId));
  const tabs=Tabs([{label:"Prospect",value:"Prospect",active:ui.pipelineRole==="Prospect",attributes:'data-pipeline-role="Prospect"'},{label:"Customer",value:"Customer",active:ui.pipelineRole==="Customer",attributes:'data-pipeline-role="Customer"'}],{label:"Pipeline type",className:"pipeline-home__tabs",idPrefix:"pipeline-role"});
  return `<section class="contacts-route pipeline-home" aria-label="Pipeline"><header class="pipeline-home__header"><h1>Pipeline</h1></header>${tabs}${connectionState}<div id="pipeline-role-panel-${escapeHTML(ui.pipelineRole)}" role="tabpanel" aria-labelledby="pipeline-role-tab-${escapeHTML(ui.pipelineRole)}">${ui.pipelineRole==="Prospect"?renderProspectPipeline(prospectContacts,now):renderCustomerPipeline(customerContacts,now)}</div>${ui.pipelineStageDetail?prospectStageDetailSheet(ui.pipelineStageDetail,prospectContacts,now):""}${selectedContact?prospectTransitionSheet(selectedContact):""}${ui.customerPipelineStageDetail?customerStageDetailSheet(ui.customerPipelineStageDetail,customerContacts,now):""}${selectedCustomerContact?customerTransitionSheet(selectedCustomerContact):""}</section>`;
}
function placeMatchesContact(place,contact){return String(contact?.placeId||"")===String(place?.id||"")||(!contact?.placeId&&String(contact?.placeName||"").trim().toLowerCase()===String(place?.name||"").trim().toLowerCase());}
function placeActivityRecords(contacts=[]){return contacts.flatMap(contact=>(contact.conversations||[]).map(log=>({contact,log,at:log.conversationDate||log.createdAt}))).filter(item=>item.at).sort((left,right)=>new Date(right.at)-new Date(left.at));}
function placeModels(){const allContacts=state.contacts;return state.places.map(place=>{const related=allContacts.filter(contact=>placeMatchesContact(place,contact));const activities=placeActivityRecords(related);return {...place,contacts:related,activities,count:related.length,interactionCount:activities.length,latest:activities[0]?.at||null};}).sort((left,right)=>Number(right.isFavorite)-Number(left.isFavorite)||right.count-left.count||right.interactionCount-left.interactionCount||String(left.name).localeCompare(String(right.name)));}
function placePipelineLabel(contact){const stage=contact.role==="Team"?"Team":currentPipelineStage(contact);return stage?`${contact.role} · ${stage}`:`${contact.role} · No stage`;}
function placeActivityLabel(log){return log.communicationType?`${log.communicationType} · ${log.outcome||log.direction||"Activity"}`:log.isCountedConversation?"Conversation":log.type||"Activity";}
function renderPlaces(connectionState="") {
  const places=placeModels();
  if(!places.length)return `<section class="places-home" aria-label="Places"><header class="places-home__header"><button type="button" class="places-home__back" data-people-contact-mode="list">${icons.chevronRight}<span>People</span></button><h1>Places</h1></header>${connectionState}${EmptyState("No saved places","Save a place while capturing a relationship to see it here.",{className:"places-home__empty"})}</section>`;
  const favoriteCount=places.filter(place=>place.isFavorite).length;
  return `<section class="places-home" aria-label="Places"><header class="places-home__header"><button type="button" class="places-home__back" data-people-contact-mode="list">${icons.chevronRight}<span>People</span></button><div><span class="ui-eyebrow">Relationship context</span><h1>Places</h1></div></header><p class="places-home__summary">${places.length} saved place${places.length===1?"":"s"}${favoriteCount?` · ${favoriteCount} favorite${favoriteCount===1?"":"s"}`:""}</p>${connectionState}<div class="places-home__list">${places.map(place=>`<article class="place-row ${place.isFavorite?"is-favorite":""}"><button type="button" data-place-detail-id="${escapeHTML(place.id)}" aria-label="Open ${escapeHTML(place.name)}"><span class="place-row__icon">${icons.location}</span><span class="place-row__body"><strong>${escapeHTML(place.name)}</strong><small>${place.count} ${place.count===1?"person":"people"} · ${place.interactionCount} recorded interaction${place.interactionCount===1?"":"s"}</small><em>${escapeHTML(place.latest?`Last interaction ${peopleRelativeDate(place.latest)}`:"No interaction recorded")}</em></span>${place.isFavorite?`<span class="place-row__favorite" aria-label="Favorite place">${icons.star}</span>`:""}${icons.chevronRight}</button></article>`).join("")}</div></section>`;
}
function placeDetailSheet(placeId){
  const content=placeDetailContent(placeId);return content?MobileSheet(content,{title:"Place detail",id:"placeDetailSheet",className:"place-detail-sheet"}):"";
}
function placeDetailContent(placeId){
  const place=state.places.find(item=>String(item.id)===String(placeId));
  if(!place)return "";
  const model=placeModels().find(item=>String(item.id)===String(placeId))||{...place,contacts:[],activities:[],count:0,interactionCount:0,latest:null};
  const people=model.contacts.sort((left,right)=>String(left.fullName).localeCompare(String(right.fullName)));
  const recent=model.activities.slice(0,5);
  const activePeople=people.filter(contact=>!contact.archivedAt&&!contact.isFilteredOut).length;
  const customers=people.filter(contact=>contact.role==="Customer").length;
  const stageCounts=PIPELINE_STAGES.map(stage=>({stage,count:people.filter(contact=>currentPipelineStage(contact)===stage).length})).filter(item=>item.count);
  const peopleRows=people.length?people.map(contact=>`<button type="button" class="place-detail__person" data-contact-id="${escapeHTML(contact.id)}">${Avatar(contact.fullName,{size:"small"})}<span><strong>${escapeHTML(contact.fullName||"Unnamed contact")}</strong><small>${escapeHTML(placePipelineLabel(contact))}</small></span>${icons.chevronRight}</button>`).join(""):'<p class="place-detail__empty">No saved relationships currently use this place.</p>';
  const activityRows=recent.length?recent.map(item=>`<button type="button" class="place-detail__activity" data-contact-id="${escapeHTML(item.contact.id)}"><span><strong>${escapeHTML(item.contact.fullName||"Unnamed contact")}</strong><small>${escapeHTML(placeActivityLabel(item.log))}${item.log.notes?` · ${escapeHTML(String(item.log.notes).slice(0,88))}`:""}</small></span><time datetime="${escapeHTML(item.at)}">${escapeHTML(peopleRelativeDate(item.at))}</time></button>`).join(""):'<p class="place-detail__empty">No recorded interactions for these relationships.</p>';
  return `<section class="place-detail"><div class="place-detail__intro"><span class="place-detail__marker">${icons.location}</span><div><span class="ui-eyebrow">${place.isFavorite?"Favorite place":"Saved place"}</span><h2>${escapeHTML(place.name)}</h2></div>${place.isFavorite?`<span class="place-detail__favorite" aria-label="Favorite place">${icons.star}</span>`:""}</div><div class="place-detail__metrics"><div><strong>${model.interactionCount}</strong><span>Activities</span></div><div><strong>${model.count}</strong><span>People met</span></div><div><strong>${activePeople}</strong><span>Active</span></div><div><strong>${customers}</strong><span>Customers</span></div></div><section><header><span class="ui-eyebrow">People</span><h3>People met here</h3></header><div class="place-detail__people">${peopleRows}</div></section><section><header><span class="ui-eyebrow">Activity</span><h3>Recent interactions</h3><p>Recorded across people linked to this place.</p></header><div class="place-detail__activity-list">${activityRows}</div></section><section class="place-detail__outcomes"><header><span class="ui-eyebrow">Pipeline</span><h3>Current outcomes</h3><p>Exact current stages for relationships linked to this place.</p></header>${stageCounts.length?`<div>${stageCounts.map(item=>`<p><span>${escapeHTML(item.stage)}</span><strong>${item.count}</strong></p>`).join("")}</div>`:'<p class="place-detail__empty">No linked relationships currently have a pipeline stage.</p>'}</section></section>`;
}

function networkModel(contacts) {
  const withStages=contacts.map(contact=>({...contact,currentStage:currentPipelineStage(contact)}));
  return buildNetworkModel({contacts:withStages,places:state.places,companies:Array.isArray(state.companies)?state.companies:[],scores:relationshipScores(),entityFilter:ui.networkEntityFilter,now:new Date()});
}
function networkNodeTone(node) { return node.type==="person"?(node.strength==="strong"?"positive":node.strength==="attention"?"overdue":node.strength==="steady"?"info":"uncertain"):node.type==="place"?"brand":"info"; }
function renderNetworkGraph(model, selectedId) {
  const positions=new Map(model.nodes.map(node=>[node.id,node]));
  const edges=model.edges.map(edge=>{const source=positions.get(edge.source),target=positions.get(edge.target);if(!source||!target)return "";return `<line class="network-edge network-edge--${escapeHTML(edge.strength||edge.type)}" x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}"><title>${escapeHTML(source.label)} connected to ${escapeHTML(target.label)}</title></line>`;}).join("");
  const nodes=model.nodes.map(node=>{const selected=node.id===selectedId;const initialsLabel=node.type==="person"?initials(node.label):node.type==="place"?"P":node.type==="company"?"C":"You";return `<g class="network-node network-node--${node.type} network-node--${node.strength||"context"}${selected?" is-selected":""}" data-network-node-id="${escapeHTML(node.id)}" role="button" tabindex="0" aria-pressed="${selected}" aria-label="Select ${escapeHTML(node.label)}"><circle class="network-node-hit" cx="${node.x}" cy="${node.y}" r="${node.type==="you"?36:26}"></circle><circle class="network-node-surface" cx="${node.x}" cy="${node.y}" r="${node.type==="you"?30:node.type==="person"?22:18}"></circle><text class="network-node-mark" x="${node.x}" y="${node.y}" text-anchor="middle" dominant-baseline="central">${escapeHTML(initialsLabel)}</text><text class="network-node-label" x="${node.x}" y="${node.y+(node.type==="you"?44:35)}" text-anchor="middle">${escapeHTML(node.label.length>20?`${node.label.slice(0,18)}…`:node.label)}</text><title>${escapeHTML(node.label)}${node.band?` · ${escapeHTML(node.band)}`:""}</title></g>`;}).join("");
  const summary=`Network graph with ${model.personCount} people, ${model.placeCount} places, and ${model.companyCount} companies.`;
  return `<svg class="relationship-network-graph${model.personCount>12?" is-dense":""}" viewBox="0 0 720 480" role="group" aria-label="${escapeHTML(summary)}" preserveAspectRatio="xMidYMid meet">${edges}${nodes}</svg><p class="sr-only">${escapeHTML(summary)} Select a node to review its relationship context.</p>`;
}
function networkPersonDetail(node) {
  const contact=state.contacts.find(item=>String(item.id)===node.recordId);
  if(!contact)return "";
  const healthTone=networkNodeTone(node);
  const actions=`<div class="network-detail-actions"><button type="button" class="button primary" data-contact-id="${escapeHTML(contact.id)}">Open relationship</button>${isCallablePhone(contact.phoneNumber)?`<a class="ui-icon-button" href="${phoneHref(contact.phoneNumber)}" data-communication-contact-id="${escapeHTML(contact.id)}" data-communication-type="Call" aria-label="Call ${escapeHTML(contact.fullName)}">${icons.phone}</a><a class="ui-icon-button" href="${messageHref(contact.phoneNumber)}" data-communication-contact-id="${escapeHTML(contact.id)}" data-communication-type="Text" aria-label="Message ${escapeHTML(contact.fullName)}">${icons.chat}</a>`:""}</div>`;
  return `${SectionHeader(node.label,{eyebrow:"Selected relationship",action:StatusBadge(node.band,healthTone),description:[node.role,node.stage].filter(Boolean).join(" · "),level:2})}<div class="network-information">${InformationRow("Relationship health",node.score===null?node.band:`${node.score} · ${node.band}`)}${InformationRow("Last conversation",node.lastConversationAt?fmtDate(new Date(node.lastConversationAt).toISOString()):"No conversation recorded")}${InformationRow("Relationship context",node.placeName||"No place linked")}${InformationRow("Interest",node.interest||"Not recorded")}${InformationRow("Next action",node.nextAction?`${node.nextAction.note} · ${fmtDateTime(node.nextAction.dueDate)}`:"No next action scheduled")}</div>${actions}`;
}
function networkContextDetail(node) {
  const people=(node.people||[]).map(id=>state.contacts.find(contact=>String(contact.id)===String(id))).filter(Boolean);
  return `${SectionHeader(node.label,{eyebrow:node.type==="place"?(node.favorite?"Favorite place":"Relationship place"):"Company",description:`${people.length} connected relationship${people.length===1?"":"s"}`,level:2})}<div class="network-context-people">${people.map(contact=>ListRow(`<button type="button" data-contact-id="${escapeHTML(contact.id)}"><strong>${escapeHTML(contact.fullName)}</strong><small>${escapeHTML([contact.role,currentPipelineStage(contact)].filter(Boolean).join(" · "))}</small></button>`,{className:"network-context-person"})).join("")}</div>`;
}
function networkSelectionDetail(model, selectedId) {
  const node=model.nodes.find(item=>item.id===selectedId)||model.nodes.find(item=>item.id==="you");
  if(!node)return "";
  if(node.type==="person")return networkPersonDetail(node);
  if(node.type==="place"||node.type==="company")return networkContextDetail(node);
  return `${SectionHeader("Your Human Network",{eyebrow:"Relationship context",description:"Select a person or place to see what connects you.",level:2})}<div class="network-summary-metrics"><div><strong>${model.personCount}</strong><span>People</span></div><div><strong>${model.placeCount}</strong><span>Places</span></div><div><strong>${model.companyCount}</strong><span>Companies</span></div></div>${model.truncated?`<p class="muted">Showing the ${model.personCount} strongest or most recent relationships of ${model.totalPeople} matching contacts.</p>`:""}`;
}
function renderNetworkActivity(model) {
  const ids=new Set(model.nodes.filter(node=>node.type==="person").map(node=>node.recordId));
  const activity=recentNetworkActivity(ids,5);
  if(!activity.length)return EmptyState("No recent network activity","Record a conversation or next action to begin building this view.");
  return SurfaceCard(`${SectionHeader("Recent network activity",{eyebrow:"What changed",level:2})}<div class="network-activity-list">${activity.map(item=>ListRow(`<button type="button" data-contact-id="${escapeHTML(item.contact.id)}"><strong>${escapeHTML(item.contact.fullName)}</strong><small>${escapeHTML(item.label)}</small></button>`,{end:`<time datetime="${escapeHTML(item.at)}">${fmtDate(item.at)}</time>`,className:"network-activity-row"})).join("")}</div>`,{className:"network-activity-card"});
}
function renderNetworkWorkspace(contacts=[]) {
  const model=networkModel(contacts);
  const selected=model.nodes.some(node=>node.id===ui.networkSelectedNodeId)?ui.networkSelectedNodeId:"you";
  const filters=SegmentedControl([{label:"All",value:"all",active:ui.networkEntityFilter==="all",attributes:'data-network-filter="all"'},{label:"People",value:"people",active:ui.networkEntityFilter==="people",attributes:'data-network-filter="people"'},{label:"Places",value:"places",active:ui.networkEntityFilter==="places",attributes:'data-network-filter="places"'},{label:"Companies",value:"companies",active:ui.networkEntityFilter==="companies",attributes:`data-network-filter="companies" ${model.companyCount?"":'aria-disabled="true"'}`}],{label:"Network entities",className:"network-entity-filter"});
  if(!model.personCount)return `<section class="network-workspace" aria-label="Human Network">${SectionHeader("Human Network",{eyebrow:"Relationship workspace",description:"Connections are drawn only from your matching Bridge records.",action:filters,level:2})}${EmptyState("No relationships to map","Adjust the contact filters or record a conversation to build your network.")}</section>`;
  if(model.nodes.length===1&&["places","companies"].includes(model.entityFilter)){const label=model.entityFilter==="places"?"place connections":"company associations";return `<section class="network-workspace" aria-label="Human Network">${SectionHeader("Human Network",{eyebrow:"Relationship workspace",description:"Connections are drawn only from your matching Bridge records.",action:filters,level:2})}${EmptyState(`No ${label}`,`No matching contacts have real ${label} yet.`)}</section>`;}
  return `<section class="network-workspace" aria-label="Human Network">${SectionHeader("Human Network",{eyebrow:"Relationship workspace",description:"People, places, and context derived from your Bridge records.",action:filters,level:2})}<div class="network-workspace-grid">${SurfaceCard(renderNetworkGraph(model,selected),{className:"network-graph-card"})}${SurfaceCard(networkSelectionDetail(model,selected),{className:"network-detail-card"})}</div>${renderNetworkActivity(model)}</section>`;
}

function renderAdd() {
  const steps = [["person","Person"],["context","Context"],["learnings","What I Learned"],["tracking","Tracking / pipeline"],["next-step","Next step"],["review","Review"]];
  const activeStep=Math.max(0,Math.min(steps.length-1,Number(ui.conversationStep)||0));
  const controls=index=>`<div class="conversation-step-controls">${index?`<button class="button subtle" type="button" data-conversation-back>Back</button>`:"<span></span>"}${index<steps.length-1?`<button class="button primary" type="button" data-conversation-next>Next</button>`:""}</div>`;
  const step=(id,index,title,description,content,className="")=>`<section class="form-section conversation-step ${className}" id="conversation-step-${id}" data-conversation-step="${index}" data-active="${activeStep===index}" aria-labelledby="conversation-step-${id}-title"><header class="conversation-step-head"><span class="conversation-step-number" aria-hidden="true">${index+1}</span><div><span class="eyebrow">${escapeHTML(steps[index][1])}</span><h2 id="conversation-step-${id}-title" tabindex="-1">${escapeHTML(title)}</h2><p>${escapeHTML(description)}</p></div></header>${SurfaceCard(content,{className:"conversation-step-card"})}${controls(index)}</section>`;
  const stepNavigation = `<nav class="conversation-step-navigation" aria-label="Conversation sections">${steps.map(([id,label],index)=>`<button type="button" data-conversation-step-target="${index}" aria-current="${activeStep===index?"step":"false"}"><span aria-hidden="true">${index+1}</span><strong>${escapeHTML(label)}</strong></button>`).join("")}</nav>`;
  const person=step("person",0,"Who did you speak with?","Start with the relationship and how Bridge should organize it.",`<div class="grid form-grid">${field("Full name",'<input name="fullName" required autocomplete="name" placeholder="Full name">')}${field("Phone number",'<input name="phoneNumber" autocomplete="tel" inputmode="tel" placeholder="Optional">')}${field("Email",'<input name="email" type="email" autocomplete="email" inputmode="email" placeholder="Optional">')}${field("Role",`<select name="role" id="newRole"><option>Prospect</option><option>Customer</option><option>Team</option></select>`)}<div data-role-fit-field>${field("Judgment",'<select name="judgement"><option>Good Fit</option><option>Not Good Fit</option></select>')}</div><div data-role-fit-field>${field("Interest",`<select name="interestLevel">${INTERESTS.map(x=>`<option ${x==="Unsure"?"selected":""}>${x}</option>`).join("")}</select>`)}</div></div>`);
  const context=step("context",1,"When and where did you connect?","Keep the real conversation date, type, and place together.",`<div class="grid form-grid">${field("Conversation date",`<input name="conversationDate" type="date" max="${todayInput()}" value="${todayInput()}" required>`)}${field("Conversation type",`<select name="conversationType">${CONVERSATION_TYPES.map(x=>`<option>${x}</option>`).join("")}</select>`)}${field("Saved place",`<select name="placeId"><option value="">None</option>${[...state.places].sort((a,b)=>Number(b.isFavorite)-Number(a.isFavorite)||a.name.localeCompare(b.name)).map(p=>`<option value="${p.id}">${escapeHTML(p.name)}</option>`).join("")}</select>`)}${field("Create new place",'<input name="newPlaceName" placeholder="Coffee shop, gym, event…">')}<label class="check-tile favorite-place-toggle"><input type="checkbox" name="favoritePlace"><span><strong>Favorite place</strong><small class="muted">Save this new place as a favorite</small></span></label></div>`);
  const learnings=step("learnings",2,"What is worth remembering?","Separate durable relationship context from this conversation’s notes.",`<div class="grid form-grid">${field("What I Know",'<textarea name="personalInfo" placeholder="Occupation, goals, family, interests, needs, or helpful background"></textarea>',"full")}${field("Conversation notes",'<textarea name="notes" placeholder="What happened in this conversation?"></textarea>',"full")}</div>`);
  const tracking=step("tracking",3,"What should Bridge track?","Record standalone activity and the current pipeline position without changing their meaning.",`<div class="conversation-tracking"><div><span class="eyebrow">Standalone activity</span><div class="checks tracking-checks">${stageCheck("MSA","",{showDescription:false})}${stageCheck("DTM","",{showDescription:false})}</div></div><div id="newPipelineSection"><span class="eyebrow">Pipeline · optional</span><div class="checks pipeline-checks" id="newPipelineChecks">${roleStageChecks("Prospect")}</div></div><p id="newTeamPipelineNote" class="muted" hidden>Team contacts do not participate in the prospect or customer pipeline.</p></div>`);
  const nextStep=step("next-step",4,"How will the relationship move forward?","Schedule the next action and its existing reminder behavior.",`<div class="grid form-grid conversation-schedule-grid">${field("Check back later",'<input name="checkBackDate" type="datetime-local">')}${field("Follow-up",'<input name="followUpDate" type="datetime-local">')}</div>`);
  const review=step("review",5,"Ready to save?","Bridge will count this as one conversation and keep every selected relationship action.",`<div class="conversation-review-card"><dl aria-live="polite"><div><dt>Person</dt><dd data-conversation-review="person">Add a full name</dd></div><div><dt>Role</dt><dd data-conversation-review="role">Prospect</dd></div><div><dt>Conversation</dt><dd data-conversation-review="conversation">${escapeHTML(todayInput())} · Prospecting</dd></div><div><dt>Place</dt><dd data-conversation-review="place">No place selected</dd></div><div><dt>Next action</dt><dd data-conversation-review="next-action">No follow-up scheduled</dd></div></dl><button class="button primary conversation-save" type="submit">${icons.check}<span>Save conversation</span></button><p class="conversation-save-note">Required fields are marked by your browser. Your existing duplicate-contact check runs before anything is saved.</p></div>`,"conversation-review");
  return `${pageHead("Conversation Studio", "Capture the relationship, context, learning, and next step while it is fresh.")}<form id="addContactForm" class="form-shell conversation-flow" novalidate>${stepNavigation}<div class="conversation-studio-layout"><div class="conversation-studio-main">${person}${context}${learnings}${tracking}${nextStep}</div><aside class="conversation-studio-review" aria-label="Conversation review">${review}</aside></div></form>`;
}
function field(label, control, cls="") {
  const kind=String(control).match(/^<(input|select|textarea)\b/)?.[1];
  const className=kind?`ui-${kind}`:"";
  const styled=className?(String(control).match(/^<[^>]+\bclass="/)?String(control).replace('class="',`class="${className} `):String(control).replace(`<${kind}`,`<${kind} class="${className}"`)):control;
  return `<label class="field ui-field ${cls}"><span>${label}</span>${styled}</label>`;
}
function stageCheck(stage,title,{type="checkbox",checked=false,showDescription=true}={}) { const name=type==="radio"?"pipelineStage":stageInputName(stage); const description=showDescription&&title?`<small class="muted">${escapeHTML(title)}</small>`:""; return `<label class="check-tile"><input type="${type}" name="${name}" value="${escapeHTML(stage)}" ${checked?"checked":""}><span><strong>${escapeHTML(stageLabel(stage))}</strong>${description}</span></label>`; }
function roleStageChecks(role,contact=null) { return (PIPELINES[role] || []).map(stage=>stageCheck(stage,"",{type:"radio",checked:Boolean(contact?.stages?.[stage]),showDescription:false})).join(""); }

function renderFollowUps() {
  if (!stateHydrated) return followUpsLoading();
  const now=new Date();
  const openItems=activeFollowUps();
  const completedItems=state.contacts
    .filter(contact=>!contact.archivedAt&&!contact.isFilteredOut)
    .flatMap(contact=>(contact.followUps||[]).filter(item=>followUpStatus(item)==="completed").map(item=>({...item,contact})))
    .sort((left,right)=>new Date(right.completedAt||right.updatedAt)-new Date(left.completedAt||left.updatedAt));
  const overdue=openItems.filter(item=>new Date(item.dueDate)<now);
  const scheduled=openItems.filter(item=>new Date(item.dueDate)>=now);
  const todayStart=startOfDay(now);
  const tomorrowStart=startOfDay(addDays(now,1));
  const dueToday=scheduled.filter(item=>startOfDay(new Date(item.dueDate)).getTime()===todayStart.getTime());
  const upcoming=scheduled.filter(item=>new Date(item.dueDate)>=tomorrowStart);
  const offlineNote=accountContext.mode==="account"&&accountContext.status?.state==="offline"?'<p class="followup-offline-note" role="status">Showing the latest saved follow-ups while Bridge reconnects.</p>':"";
  const editedKind=ui.actionEditId&&overdue.some(item=>`${item.contact.id}:${item.id}`===ui.actionEditId)?"overdue":ui.actionEditId&&dueToday.some(item=>`${item.contact.id}:${item.id}`===ui.actionEditId)?"today":ui.actionEditId&&upcoming.some(item=>`${item.contact.id}:${item.id}`===ui.actionEditId)?"upcoming":"";
  const selectedKind=["today","upcoming","overdue","completed"].includes(ui.actionView)?ui.actionView:(editedKind||(overdue.length?"overdue":dueToday.length?"today":"upcoming"));
  const primaryControls=Tabs([
    { label:`Today ${dueToday.length}`,value:"today",active:selectedKind==="today",attributes:'data-action-view="today"' },
    { label:`Upcoming ${upcoming.length}`,value:"upcoming",active:selectedKind==="upcoming",attributes:'data-action-view="upcoming"' },
    { label:`Overdue ${overdue.length}`,value:"overdue",active:selectedKind==="overdue",attributes:'data-action-view="overdue"' }
  ],{label:"Follow-up timing",className:"followups-home__status",idPrefix:"followups"});
  const queues={today:["Today",dueToday,"The relationships to move forward today."],upcoming:["Upcoming",upcoming,"Keep the next step visible before it becomes urgent."],overdue:["Overdue",overdue,"Needs your attention before it slips further."]};
  const selectedQueue=queues[selectedKind]||queues.today;
  const summary=`${completedItems.length} completed · ${openItems.length} still open`;
  return `<section class="followups-home" aria-label="Follow-Ups"><header class="followups-home__header"><span class="ui-eyebrow">Action center</span><h1>Follow-ups</h1>${primaryControls}<p class="followups-home__summary">${selectedKind==="completed"?"Completed follow-ups remain in relationship history.":summary}</p></header>${offlineNote}${selectedKind==="completed"?`<div class="followups-home__queue followups-home__queue--completed">${followUpQueueSection("Completed",completedItems,{kind:"completed",completed:true})}<button type="button" class="followups-history-toggle" data-action-view="${overdue.length?"overdue":dueToday.length?"today":"upcoming"}">Back to open follow-ups</button></div>`:`<div class="followups-home__queue" aria-label="${escapeHTML(selectedQueue[0])} follow-ups">${followUpQueueSection(selectedQueue[0],selectedQueue[1],{kind:selectedKind,description:selectedQueue[2]})}${completedItems.length?`<button type="button" class="followups-history-toggle" data-action-view="completed">View completed history <span>${completedItems.length}</span></button>`:""}</div>`}</section>`;
}
function followUpsLoading(){return `<section class="followups-home" aria-label="Follow-Ups" aria-busy="true"><header class="followups-home__header"><span class="ui-eyebrow">Action center</span><h1>Follow-ups</h1><p class="followups-home__summary">Loading your relationship queue.</p></header><div class="followups-home__loading">${LoadingSkeleton({lines:4})}<span class="sr-only">Loading follow-ups.</span></div></section>`;}
function followUpEmptyState(kind){const copy={overdue:["Nothing overdue","You are current. Keep capturing conversations and Bridge will tell you when someone needs you."],today:["Nothing due today","You are current. Keep capturing conversations and Bridge will tell you when someone needs you."],upcoming:["Nothing scheduled ahead","When you capture a conversation, choose Follow up and it will appear here with the reason attached."],completed:["No completed follow-ups yet","Completed follow-ups will remain available in relationship history."]}[kind]||["No follow-ups","Schedule a next step from a relationship to keep it visible here."];return `<section class="followups-empty" aria-label="${escapeHTML(copy[0])}"><span aria-hidden="true">${icons.circleCheck}</span><div><h2>${escapeHTML(copy[0])}</h2><p>${escapeHTML(copy[1])}</p></div></section>`;}
function followUpQueueSection(title,items,{kind="upcoming",description="",completed=false}={}){
  return `<section class="followup-queue followup-queue--${escapeHTML(kind)}" aria-label="${escapeHTML(title)} follow-ups">${items.length?`<div class="followup-queue__list">${items.map(item=>actionRow(item,{completed})).join("")}</div>`:followUpEmptyState(kind)}</section>`;
}
function followUpDueLabel(value,{completed=false}={}){if(!value)return completed?"Completed":"Time not set";const due=new Date(value);if(Number.isNaN(due.getTime()))return completed?"Completed":"Time not set";if(completed)return `Completed ${fmtDate(value)}`;const today=startOfDay(new Date()), tomorrow=addDays(today,1), dueDay=startOfDay(due);const time=new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit"}).format(due);if(dueDay.getTime()===today.getTime())return `Today · ${time}`;if(dueDay.getTime()===tomorrow.getTime())return `Tomorrow · ${time}`;return fmtDateTime(value);}
function followUpPipelineLabel(contact){const stage=contact.role==="Team"?"Team":currentPipelineStage(contact);return stage?`${contact.role} · ${stage}`:`${contact.role} · No stage`;}
function followUpLastInteractionLabel(contact){const latest=latestConversationTime(contact);return latest?`Last conversation ${peopleRelativeDate(latest)}`:"No conversation recorded";}
function actionRow(item){
  const completed=followUpStatus(item)==="completed";
  const overdue=!completed&&new Date(item.dueDate)<new Date();
  const name=String(item.contact.fullName||"Unknown contact");
  const dateValue=completed?(item.completedAt||item.updatedAt):item.dueDate;
  const dueLabel=followUpDueLabel(dateValue,{completed});
  const callable=isCallablePhone(item.contact.phoneNumber);
  const stage=followUpPipelineLabel(item.contact);
  return `<article class="followup-card ${completed?"is-completed":""} ${overdue?"is-overdue":""}">
    <div class="followup-card__identity"><button type="button" class="followup-card__person" data-contact-id="${escapeHTML(item.contact.id)}" aria-label="View relationship with ${escapeHTML(name)}">${Avatar(name,{size:"small",className:"followup-card__avatar"})}<span><strong>${escapeHTML(name)}</strong></span></button><time datetime="${escapeHTML(dateValue||"")}" class="followup-card__due">${escapeHTML(dueLabel)}</time></div>
    <p class="followup-card__last-interaction">${escapeHTML(followUpLastInteractionLabel(item.contact))}</p>
    <p class="followup-card__note">“${escapeHTML(item.note||"Follow up")}”</p>
    <div class="followup-card__context"><span class="followup-card__stage">${escapeHTML(stage)}</span></div>
    ${completed?`<div class="followup-card__completed"><span>${icons.circleCheck}</span><span>${escapeHTML(dueLabel)}</span><button type="button" class="followup-card__relationship" data-contact-id="${escapeHTML(item.contact.id)}">View relationship ${icons.chevronRight}</button></div>`:`<div class="followup-card__actions"><div class="followup-card__communication">${callable?`<a href="${phoneHref(item.contact.phoneNumber)}" data-communication-contact-id="${escapeHTML(item.contact.id)}" data-communication-type="Call" aria-label="Call ${escapeHTML(name)}">${icons.phone}<span>Call</span></a><a href="${messageHref(item.contact.phoneNumber)}" data-communication-contact-id="${escapeHTML(item.contact.id)}" data-communication-type="Text" aria-label="Text ${escapeHTML(name)}">${icons.chat}<span>Text</span></a>`:`<button type="button" disabled aria-label="Call unavailable for ${escapeHTML(name)}">${icons.phone}<span>Call</span></button><button type="button" disabled aria-label="Text unavailable for ${escapeHTML(name)}">${icons.chat}<span>Text</span></button>`}</div><button type="button" class="followup-card__reschedule edit-action" data-action-id="${escapeHTML(item.contact.id)}:${escapeHTML(item.id)}" aria-label="Reschedule follow-up for ${escapeHTML(name)}">${icons.clock}<span>Reschedule</span></button><button type="button" class="followup-card__done complete-action" data-followup-contact-id="${escapeHTML(item.contact.id)}" data-follow-up-id="${escapeHTML(item.id)}">${icons.check}<span>Done</span></button></div>`}
  </article>`;
}

function followUpRescheduleSheet(){
  const [contactId,followUpId]=String(ui.actionEditId||"").split(":");
  const record=findFollowUpRecord(contactId,followUpId);
  if(!record){ui.actionEditId=null;return "";}
  const {contact,followUp}=record;
  const name=String(contact.fullName||"this relationship");
  const footer=`<div class="followup-reschedule-sheet__actions"><button class="button subtle cancel-action-edit" type="button" data-ui-dialog-close>Cancel</button><button class="button primary" type="submit" form="followUpRescheduleForm">Save changes</button></div>`;
  return MobileSheet(`<form id="followUpRescheduleForm" class="action-edit-form followup-reschedule-sheet__form" data-followup-contact-id="${escapeHTML(contact.id)}" data-follow-up-id="${escapeHTML(followUp.id)}"><p>Update the next step for ${escapeHTML(name)}. This change remains part of the relationship's history.</p>${field("Due date and time",`<input name="dueDate" type="datetime-local" value="${dateTimeLocalValue(followUp.dueDate)}" required>`)}${field("Reason or note",`<input name="note" value="${escapeHTML(followUp.note||"Follow up")}" required>`)}<button class="followup-reschedule-sheet__delete" type="button" data-followup-delete data-followup-contact-id="${escapeHTML(contact.id)}" data-follow-up-id="${escapeHTML(followUp.id)}">${icons.trash}<span>Delete follow-up</span></button></form>`,{title:"Reschedule follow-up",id:"followUpRescheduleSheet",className:"followup-reschedule-sheet",footer});
}

function analyticsDateControls() {
  if (ui.analyticsRange === "month") return `<label class="analytics-date-field"><span>Month</span><input class="date-control" id="analyticsMonth" type="month" value="${ui.analyticsAnchor.slice(0,7)}"></label>`;
  if (ui.analyticsRange === "custom") return `<div class="analytics-custom-dates"><label class="analytics-date-field"><span>From</span><input class="date-control" id="analyticsCustomStart" type="date" value="${ui.analyticsCustomStart}"></label><label class="analytics-date-field"><span>To</span><input class="date-control" id="analyticsCustomEnd" type="date" value="${ui.analyticsCustomEnd}"></label></div>`;
  return `<label class="analytics-date-field"><span>${ui.analyticsRange === "day" ? "Day" : "Week containing"}</span><input class="date-control" id="analyticsAnchor" type="date" value="${ui.analyticsAnchor}"></label>`;
}

function sharedContactsForRange(contacts) {
  return contacts.map(contact => ({
    fullName: contact.fullName,
    role: contact.role,
    pipelineStage: currentPipelineStage(contact),
    placeName: contact.placeName
  }));
}

function scorecardSupportingMetrics(range) {
  const completedFollowUps=state.contacts.flatMap(contact=>contact.followUps||[]).filter(item=>item.completedAt&&inRange(item.completedAt,range)).length;
  const pipelineMovements=state.contacts.flatMap(contact=>contact.stageEvents||[]).filter(event=>event.occurredAt&&PIPELINE_STAGES.includes(event.stage)&&inRange(event.occurredAt,range)).length;
  return {completedFollowUps,pipelineMovements};
}

function compactScorecardRangeLabel(range) {
  const start=dateOnly(range?.start);
  const end=dateOnly(range?.end);
  if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime()))return String(range?.label||"");
  const month=value=>new Intl.DateTimeFormat(undefined,{month:"short"}).format(value);
  const day=value=>new Intl.DateTimeFormat(undefined,{day:"numeric"}).format(value);
  if(start.getFullYear()===end.getFullYear()&&start.getMonth()===end.getMonth())return `${month(start)} ${day(start)}–${day(end)}`;
  return `${month(start)} ${day(start)}–${month(end)} ${day(end)}`;
}

function scorecardSharePreview(data) {
  const supporting=scorecardSupportingMetrics(data.range);
  const metric=(label,value)=>`<div class="scorecard-design-metric"><span>${escapeHTML(label)}</span><strong>${value}</strong></div>`;
  return `<section class="scorecard-design-preview" aria-label="Scorecard preview"><span class="ui-eyebrow">Bridge scorecard</span><h3>${escapeHTML(data.range.label)}</h3><div class="scorecard-design-metrics">${metric("Conversations",data.metrics.conversations)}${metric("New people",data.newContacts.length)}${metric("Prospects",data.metrics.prospects)}${metric("Customers",data.metrics.prospectiveCustomers)}</div><p>${supporting.completedFollowUps} follow-up${supporting.completedFollowUps===1?"":"s"} completed · ${supporting.pipelineMovements} pipeline movement${supporting.pipelineMovements===1?"":"s"}</p></section>`;
}

function scorecardShareModal({ routed=false }={}) {
  const data = analyticsScorecardData();
  const range = data.range;
  const preview=scorecardSharePreview(data);
  const created=ui.scorecardCreated;
  const privacySummary=ui.scorecardIncludeContacts?"Names, roles, stages, and places only":"No personal relationship details";
  const body=created?`<div class="scorecard-share-result">${preview}<section class="share-result ${created.revoked?"is-revoked":""}" aria-live="polite"><span class="ui-eyebrow">${created.revoked?"Access removed":"Secure link ready"}</span><h3>${created.revoked?"Scorecard link revoked":"Ready to share"}</h3><p>${created.revoked?"This link no longer opens the scorecard.":`This link expires ${escapeHTML(fmtDateTime(created.expiresAt))}.`}</p>${created.revoked?"":`<a href="${escapeHTML(created.url)}" target="_blank" rel="noreferrer">Open shared scorecard ${icons.chevronRight}</a><div class="scorecard-result-actions"><button class="button primary" id="messageScorecardLink" type="button">${icons.chat}<span>Message link</span></button><button class="button subtle" id="revokeScorecardLink" type="button" ${ui.scorecardShareBusy?"disabled":""}>${icons.trash}<span>${ui.scorecardShareBusy?"Revoking…":"Revoke link"}</span></button></div>`}<button class="button subtle" id="createAnotherScorecard" type="button">Create another scorecard</button></section></div>`:`${preview}<form id="scorecardShareForm" class="scorecard-share-form"><fieldset><legend>Include</legend><div class="scorecard-scope-options"><label class="share-scope-option"><input type="radio" name="scorecardScope" value="scorecard" ${!ui.scorecardIncludeContacts ? "checked" : ""}><span><strong>Metrics only</strong><small>The four numbers and the date range.</small></span></label><label class="share-scope-option"><input type="radio" name="scorecardScope" value="contacts" ${ui.scorecardIncludeContacts ? "checked" : ""}><span><strong>Metrics + new contacts</strong><small>Adds ${data.newContacts.length} ${data.newContacts.length===1?"person":"people"}: name, role, stage, and place only.</small></span></label></div></fieldset><p class="scorecard-expiry-note">Links expire after seven days.</p><details class="scorecard-privacy-disclosure" id="scorecardSharePrivacy"><summary><span><strong>What gets shared?</strong><small>${escapeHTML(privacySummary)}</small></span>${icons.chevronDown}</summary><div><p>Phone numbers, notes, follow-ups, private judgements, interest levels, and editing controls are never shared.</p></div></details><button class="button primary scorecard-create-link" name="shareAction" value="link" type="submit" ${ui.scorecardShareBusy ? "disabled" : ""}>${ui.scorecardShareBusy?"Creating secure link…":"Create share link"}</button><button class="button subtle scorecard-share-image" name="shareAction" value="image" type="submit" ${ui.scorecardShareBusy ? "disabled" : ""}>${icons.share}<span>Share metrics as image</span></button></form>`;
  if(routed)return PresentationScreen(body,{title:"Share scorecard",eyebrow:compactScorecardRangeLabel(range),className:"scorecard-share-screen"});
  return `<div class="modal-backdrop scorecard-share-backdrop" id="scorecardShareBackdrop"><section class="modal scorecard-share-modal" role="dialog" aria-modal="true" aria-labelledby="shareScorecardTitle"><header class="modal-head scorecard-share-head">${IconButton("chevronRight", "Close scorecard sharing", { className: "close-scorecard-share scorecard-share-back" })}<div><span class="ui-eyebrow">${escapeHTML(range.label)}</span><h2 class="ui-editorial-heading" id="shareScorecardTitle">Share scorecard</h2></div></header><div class="modal-body">${body}</div></section></div>`;
}

function analyticsPeriodEyebrow() { return ({ day:"This day", week:"This week", month:"This month", custom:"Selected period" })[ui.analyticsRange] || "Selected period"; }
function analyticsCountLabel(value, singular, plural = `${singular}s`) { return `${value} ${value === 1 ? singular : plural}`; }
function analyticsPeriodControls(range) {
  const periodControl=Tabs(["day","week","month","custom"].map(mode=>({label:mode[0].toUpperCase()+mode.slice(1),value:mode,active:ui.analyticsRange===mode,attributes:`data-range="${mode}"`})),{label:"Analytics period",className:"analytics-segmented",idPrefix:"analytics-range"});
  const dateNavigator=DateNavigator(range.label,{className:"analytics-date-navigator",previousClassName:"analytics-period-previous",nextClassName:"analytics-period-next",previousAttributes:`aria-label="Previous ${ui.analyticsRange} period"`,nextAttributes:`aria-label="Next ${ui.analyticsRange} period"`});
  return `<details class="insights-period" ${ui.analyticsRange==="custom"?"open":""}><summary><span>Period</span><strong>${escapeHTML(range.label)}</strong>${icons.chevronDown}</summary><div class="insights-period__body">${periodControl}${dateNavigator}<div class="analytics-period-detail">${analyticsDateControls()}</div></div></details>`;
}
function analyticsDetailPeriodControls(range) {
  const labels={day:"Day",week:"Week",month:"Month",custom:"Custom"};
  const tabs=Tabs(Object.entries(labels).map(([mode,label])=>({label,value:mode,active:ui.analyticsRange===mode,attributes:`data-range="${mode}"`})),{label:"Analytics period",className:"analytics-detail-tabs",idPrefix:"analytics-detail-range"});
  const navigator=DateNavigator(range.label,{className:"analytics-date-navigator",previousClassName:"analytics-period-previous",nextClassName:"analytics-period-next",previousAttributes:`aria-label="Previous ${ui.analyticsRange} period"`,nextAttributes:`aria-label="Next ${ui.analyticsRange} period"`});
  return `<div class="analytics-detail-period">${tabs}<details class="analytics-detail-range" ${ui.analyticsRange==="custom"?"open":""}><summary><span>${escapeHTML(range.label)}</span>${icons.chevronDown}</summary><div>${navigator}<div class="analytics-period-detail">${analyticsDateControls()}</div></div></details></div>`;
}
function insightsConversationChart(model) {
  const total=model.conversations.length;
  if(!total)return `<section class="insights-section insights-conversation" aria-labelledby="insights-conversation-title"><h2 id="insights-conversation-title">Conversation activity</h2>${emptyInline("No conversation activity","Counted conversations for this period will appear here.")}</section>`;
  const max=Math.max(1,...model.daySeries.map(point=>point.value));
  return `<section class="insights-section insights-conversation" aria-labelledby="insights-conversation-title"><h2 id="insights-conversation-title">Conversation activity</h2><div class="insights-chart-scroll"><div class="insights-chart" style="--insights-points:${model.daySeries.length}" role="img" aria-label="Conversation activity: ${escapeHTML(model.daySeries.map(point=>`${point.date} ${point.value}`).join(", "))}">${model.daySeries.map(point=>`<div class="insights-chart__point"><span class="insights-chart__value">${point.value||""}</span><span class="insights-chart__bar ${point.value?"has-value":""}" style="height:${point.value?Math.max(12,Math.round(point.value/max*100)):4}%"></span><span class="insights-chart__label">${escapeHTML(point.label)}</span></div>`).join("")}</div></div><details class="analytics-data-table"><summary>View data table</summary><table><thead><tr><th scope="col">Date</th><th scope="col">Count</th></tr></thead><tbody>${model.daySeries.map(point=>`<tr><th scope="row">${escapeHTML(fmtDate(point.date))}</th><td>${point.value}</td></tr>`).join("")}</tbody></table></details></section>`;
}
function insightsPipelineIntelligence(model) {
  const items=model.stalledRelationships.slice(0,4);
  const activity=model.completedFollowUps.length||model.pipelineEvents.length?`<article class="is-positive"><h3>Follow-up and pipeline activity</h3><p>${analyticsCountLabel(model.completedFollowUps.length,"completed follow-up")} · ${analyticsCountLabel(model.pipelineEvents.length,"pipeline movement")} in this period.</p><button type="button" data-page="followups">See follow-ups ${icons.chevronRight}</button></article>`:"";
  const intelligence=items.map(item=>`<article><h3>${escapeHTML(item.contact.fullName)} has been in ${escapeHTML(item.stage)} for ${item.ageDays} days</h3><p>${escapeHTML(item.role)} pipeline · Stage entered ${escapeHTML(fmtDate(item.enteredAt))}</p><button type="button" data-contact-id="${escapeHTML(item.contact.id)}">Open relationship ${icons.chevronRight}</button></article>`).join("");
  return `<section class="insights-section insights-intelligence" aria-labelledby="insights-intelligence-title"><h2 id="insights-intelligence-title">Pipeline intelligence</h2>${intelligence||activity?`<div class="insights-intelligence__list">${intelligence}${activity}</div>`:emptyInline("No pipeline signals yet","Stalled relationships and verified follow-up or stage activity will appear here.")}</section>`;
}
function insightsStageSnapshot(role, model) {
  const stages=PIPELINES[role];
  const counts=model.currentStageCounts[role];
  const max=Math.max(1,...stages.map(stage=>counts[stage]||0));
  return `<section class="insights-stage-group" aria-labelledby="insights-${role.toLowerCase()}-pipeline"><header><div><h3 id="insights-${role.toLowerCase()}-pipeline">${escapeHTML(role)} pipeline</h3><p>Current people by exact stage</p></div><button type="button" data-insights-pipeline="${escapeHTML(role)}">View</button></header><div class="insights-stage-list">${stages.map(stage=>{const count=counts[stage]||0;return `<div><div><span>${escapeHTML(stage)}</span><strong>${count}</strong></div><i><span style="width:${count?Math.max(8,Math.round(count/max*100)):0}%"></span></i></div>`;}).join("")}</div></section>`;
}
function insightsFollowUpEffectiveness(model) {
  return `<section class="insights-section insights-followup" aria-labelledby="insights-followup-title"><h2 id="insights-followup-title">Follow-up effectiveness</h2>${model.followUpCompletion===null?emptyInline("No follow-up data","Follow-ups created or due in this period will appear here."):`<strong>${model.followUpCompletion}%</strong><p>${model.completedFollowUps.length} completed of ${model.followUps.length} recorded</p><button type="button" data-page="followups">View follow-ups ${icons.chevronRight}</button>`}</section>`;
}
function insightsPlaces(model) {
  return `<section class="insights-section insights-places" aria-labelledby="insights-places-title"><header><h2 id="insights-places-title">Where you’re connecting</h2><button type="button" data-insights-places>See all</button></header>${model.placeActivity.length?`<div>${model.placeActivity.slice(0,4).map(item=>`<button type="button" data-insights-place-id="${escapeHTML(item.place.id)}"><span><strong>${escapeHTML(item.place.name)}</strong><small>${analyticsCountLabel(item.activePeople,"active relationship")} · ${analyticsCountLabel(item.movements,"movement")}</small></span><b>${item.recordedConversations}</b></button>`).join("")}</div><p class="insights-places__note">Counts are recorded conversations among people linked to each saved place.</p>`:emptyInline("No saved-place activity","Link people to a saved place to see their recorded activity here.")}</section>`;
}
function analyticsDetailMetricRow(label,value,{detail="",progress=null,max=1}={}) {
  const progressMarkup=Number.isFinite(progress)?ProgressBar(progress,{label:`${label} activity`,max}):"";
  return `<div class="analytics-detail-metric"><div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>${progressMarkup}${detail?`<small>${escapeHTML(detail)}</small>`:""}</div>`;
}
function analyticsDetailActivity(model) {
  const max=Math.max(1,...model.daySeries.map(point=>point.value));
  const minimumWidth=Math.max(1,model.daySeries.length)*28;
  return `<section class="analytics-detail-section analytics-detail-activity"><h3>Activity</h3>${model.conversations.length?`<div class="analytics-detail-chart-scroll"><div class="analytics-detail-chart" style="--insights-points:${model.daySeries.length};--analytics-chart-min:${minimumWidth}px" role="img" aria-label="Conversation activity: ${escapeHTML(model.daySeries.map(point=>`${point.date} ${point.value}`).join(", "))}">${model.daySeries.map(point=>`<div><span>${point.value||""}</span><i class="${point.value?"has-value":""}" style="height:${point.value?Math.max(6,Math.round(point.value/max*70)):3}px"></i><small>${escapeHTML(point.label)}</small></div>`).join("")}</div></div>`:emptyInline("No conversations in this period","Counted conversations will fill this chart without inventing activity.")}</section>`;
}
function insightsDetailedAnalytics(model, scorecard, previousScorecard, { embedded=true }={}) {
  const dailyGoal=dailyGoalMetrics(state,new Date());
  const conversationMix=CONVERSATION_TYPES.map(type=>[type,model.conversations.filter(log=>log.type===type).length]);
  const interestBreakdown=INTERESTS.map(level=>[level,model.newPeople.filter(c=>c.role!=="Team"&&c.interestLevel===level).length]);
  const outcomes=Object.entries(model.communicationOutcomes).sort((left,right)=>right[1]-left[1]||left[0].localeCompare(right[0]));
  const movementCounts=Object.fromEntries(PIPELINE_STAGES.map(stage=>[stage,model.pipelineEvents.filter(item=>item.stage===stage).length]));
  const standaloneCounts=Object.fromEntries(["MSA","DTM"].map(stage=>[stage,model.standaloneEvents.filter(item=>item.stage===stage).length]));
  const maxMix=Math.max(1,...conversationMix.map(([,value])=>value));
  const maxInterest=Math.max(1,...interestBreakdown.map(([,value])=>value));
  const maxOutcome=Math.max(1,...outcomes.map(([,value])=>value));
  const maxMovement=Math.max(1,...Object.values(movementCounts));
  const maxStandalone=Math.max(1,...Object.values(standaloneCounts));
  const comparisonItems=[["Conversations",scorecard.metrics.conversations,previousScorecard.metrics.conversations],["Phone numbers captured",scorecard.metrics.contacts,previousScorecard.metrics.contacts],["New Prospects",scorecard.metrics.prospects,previousScorecard.metrics.prospects],["New Customers",scorecard.metrics.prospectiveCustomers,previousScorecard.metrics.prospectiveCustomers]];
  const calls=model.communications.filter(log=>log.communicationType==="Call");
  const texts=model.communications.filter(log=>log.communicationType==="Text");
  const connectedCalls=calls.filter(log=>/connected/i.test(String(log.outcome||""))).length;
  const activityMaximum=Math.max(1,maxMovement,maxStandalone);
  const body=`<div class="insights-details__body analytics-detail-body">${analyticsDetailActivity(model)}<section class="analytics-detail-section"><h3>Summary</h3><div class="analytics-detail-list">${analyticsDetailMetricRow("Conversations",model.conversations.length)}${analyticsDetailMetricRow("New people",model.newPeople.length)}${analyticsDetailMetricRow("Pipeline movements",model.pipelineEvents.length)}${analyticsDetailMetricRow("Follow-up completion",model.followUpCompletion===null?"—":`${model.followUpCompletion}%`,{detail:model.followUps.length?`${model.completedFollowUps.length} of ${model.followUps.length}`:"No follow-ups in this period"})}</div></section><section class="analytics-detail-section"><h3>Pipeline activity</h3><div class="analytics-detail-list analytics-detail-bars">${["MSA","DTM"].map(stage=>analyticsDetailMetricRow(stage,standaloneCounts[stage],{progress:standaloneCounts[stage],max:activityMaximum})).join("")}${PIPELINES.Prospect.map(stage=>analyticsDetailMetricRow(stage,movementCounts[stage],{progress:movementCounts[stage],max:activityMaximum})).join("")}${PIPELINES.Customer.map(stage=>analyticsDetailMetricRow(stage,movementCounts[stage],{progress:movementCounts[stage],max:activityMaximum})).join("")}</div></section><section class="analytics-detail-section"><h3>Communication activity</h3><div class="analytics-detail-list">${analyticsDetailMetricRow("Calls attempted",calls.length)}${analyticsDetailMetricRow("Calls connected",connectedCalls)}${analyticsDetailMetricRow("Texts sent",texts.length)}${analyticsDetailMetricRow("Follow-ups created",model.followUps.length)}</div></section><section class="analytics-detail-section"><h3>Interest breakdown</h3><div class="analytics-detail-list analytics-detail-bars">${interestBreakdown.map(([label,value])=>analyticsDetailMetricRow(label,value,{progress:value,max:maxInterest})).join("")}</div></section><section class="analytics-detail-section"><h3>Conversation mix</h3><div class="analytics-detail-list analytics-detail-bars">${conversationMix.map(([label,value])=>analyticsDetailMetricRow(label,value,{progress:value,max:maxMix})).join("")}</div></section><p class="analytics-detail-note">Numbers here describe behavior, not scorekeeping. If a section is empty, it simply means that kind of activity hasn’t happened in this period.</p><details class="analytics-detail-more"><summary>More detail</summary><div><section><h3>Previous period</h3><div class="insights-comparison">${comparisonItems.map(([label,value,previous])=>{const delta=value-previous;return `<div><span>${escapeHTML(label)}</span><strong>${value}</strong><small>${previous?`${delta>=0?"+":""}${delta} vs previous`:(value?"No prior activity":"No change")}</small></div>`;}).join("")}</div></section><section><h3>Goal consistency</h3>${model.goalConsistency===null?emptyInline("Not enough activity","Goal consistency appears after a counted conversation in this period."):`<p class="insights-detail-callout"><strong>${model.goalConsistency}%</strong><span>${model.goalDays} of ${model.daySeries.length} days reached the ${model.goal}-conversation goal · ${dailyGoal.goalStreak} day current streak</span></p>`}</section><section><h3>Communication outcomes</h3>${outcomes.length?`<div class="metric-bars insights-detail-bars">${outcomes.map(([label,value])=>metricBar(label,value,maxOutcome)).join("")}</div>`:emptyInline("No call or text outcomes","Logged communication outcomes for this period will appear here.")}</section></div></details></div>`;
  if(!embedded)return body;
  return `<details class="insights-details"><summary><span><strong>Detailed analytics</strong><small>Goals, outcomes, trends, and stage movement</small></span>${icons.chevronRight}</summary>${body}</details>`;
}
function renderAnalytics() {
  const scorecard=analyticsScorecardData();
  const range=scorecard.range;
  const previousScorecard=analyticsMetricsForRange(previousAnalyticsRange(range));
  const model=buildInsightsModel({contacts:state.contacts,places:state.places,range,pipelines:PIPELINES,dailyGoal:state.settings.dailyGoal,resolveCurrentStage:currentPipelineStage,now:new Date(),stallDays:PIPELINE_STALL_DAYS});
  const periodActivity=model.conversations.length+model.newPeople.length+model.pipelineEvents.length+model.followUps.length;
  const busiest=model.placeActivity[0];
  const summary=`${analyticsCountLabel(model.conversations.length,"conversation")}, ${analyticsCountLabel(model.newPeople.length,"new person","new people")}, ${analyticsCountLabel(model.pipelineEvents.length,"pipeline movement")}.`;
  const followUpSummary=model.followUps.length?`${model.completedFollowUps.length} of ${model.followUps.length} follow-ups completed.`:"No follow-ups recorded in this period.";
  const placeSummary=busiest?` Your busiest place was ${escapeHTML(busiest.place.name)}.`:"";
  return `<section class="analytics-workspace insights-home" aria-label="Insights">${pageHead("Insights", "Relationship activity and momentum from your existing Bridge data.", IconButton("share","Share scorecard",{attributes:'id="shareScorecard"'}))}<section class="insights-hero" aria-labelledby="insights-period-summary"><span>${escapeHTML(analyticsPeriodEyebrow())}</span>${periodActivity?`<h2 id="insights-period-summary">${summary}</h2><p>${followUpSummary}${placeSummary}</p>`:`<div id="insights-period-summary">${emptyInline("No activity in this period","Open Detailed analytics to choose another period, or log a conversation to begin your Insights history.")}</div>`}</section>${insightsConversationChart(model)}${insightsPipelineIntelligence(model)}<section class="insights-section insights-pipeline-snapshot" aria-labelledby="insights-pipeline-snapshot"><h2 id="insights-pipeline-snapshot">Pipeline activity</h2><p class="insights-section__description">Current stage distribution uses Bridge’s exact Prospect and Customer stages.</p>${insightsStageSnapshot("Prospect",model)}${insightsStageSnapshot("Customer",model)}</section>${insightsFollowUpEffectiveness(model)}${insightsPlaces(model)}${insightsDetailedAnalytics(model,scorecard,previousScorecard)}</section>`;
}
function metricBar(label,value,max){return `<div><div class="metric-label"><span>${escapeHTML(String(label))}</span><strong>${value}</strong></div>${ProgressBar(value,{label:`${String(label)} activity`,max})}</div>`;}

function achievementsModal({ routed=false }={}) {
  const result = evaluateAchievements(state, state.meta.achievements || {});
  const groups = [...new Set(result.progress.map(item => item.category))];
  const content=`<div class="achievement-groups">${groups.map(group => `<section><h3>${escapeHTML(group)}</h3><div class="achievement-grid">${result.progress.filter(item => item.category === group).map(achievementCard).join("")}</div></section>`).join("")}</div>`;
  if(routed)return PresentationScreen(content,{title:"Achievements",eyebrow:"Progress",className:"achievements-screen"});
  return `<div class="modal-backdrop" id="achievementsBackdrop"><section class="modal wide" role="dialog" aria-modal="true" aria-labelledby="achievementsTitle"><header class="modal-head"><div><span class="eyebrow">Progress</span><h2 id="achievementsTitle">Achievements</h2></div><button class="ui-icon-button close-achievements" aria-label="Close">${icons.close}</button></header><div class="modal-body">${content}</div></section></div>`;
}
function achievementCard(item) {
  const unlockedAt = state.meta.achievements?.[item.id];
  const current=Math.min(item.current,item.target);
  return `<article class="achievement-card ${unlockedAt ? "unlocked" : "locked"}"><div class="achievement-badge">${icons[item.icon] || icons.award}</div><div><span class="achievement-category">${unlockedAt ? `Unlocked ${fmtDate(unlockedAt, { month: "short", day: "numeric", year: "numeric" })}` : item.category}</span><h4>${escapeHTML(item.name)}</h4><p>${escapeHTML(item.description)}</p>${ProgressBar(current,{label:`${item.name} progress`,max:item.target})}<small>${current} of ${item.target}</small></div></article>`;
}
function bindAchievementEvents() {
  $(".close-achievements")?.addEventListener("click", () => { ui.achievementsOpen = false; render(); });
  $("#achievementsBackdrop")?.addEventListener("click", event => { if (event.target.id === "achievementsBackdrop") { ui.achievementsOpen = false; render(); } });
}

function accountModeActive() {
  return accountContext.mode === "account" && accountContext.authenticated && Boolean(accountClient);
}

function accountWorkspaceSettings({ section="account" }={}) {
  if (!accountModeActive()) return "";
  const user = accountContext.user || {};
  const status = accountContext.status || {};
  const pending = Number(status.pending || 0);
  const conflicts = Number(status.conflicts || 0);
  const sessions = Array.isArray(ui.accountSessions) ? ui.accountSessions : [];
  const displayName=[user.firstName,user.lastName].filter(Boolean).join(" ")||"Bridge user";
  const syncedAt=status.lastSyncedAt?`Last synced ${fmtDateTime(status.lastSyncedAt)}`:accountSyncLabel();
  const profile=`<header class="hn-account-profile"><div class="account-avatar">${escapeHTML(initials(displayName||user.email||"B"))}</div><div><span class="ui-eyebrow">Bridge account</span><h2 id="bridgeAccountTitle">${escapeHTML(displayName)}</h2><p>${escapeHTML(user.email||"")}</p></div><span class="sync-badge ${escapeHTML(status.state||"synced")}">${escapeHTML(accountSyncLabel())}</span></header>`;
  const error=ui.accountPanelError?`<p class="settings-note account-panel-error">${escapeHTML(ui.accountPanelError)}</p>`:"";
  const sync=`<section class="hn-account-sync" aria-labelledby="accountSyncTitle"><div><span class="ui-eyebrow">Synchronization</span><h3 id="accountSyncTitle">${escapeHTML(accountSyncLabel())}</h3><p>${escapeHTML(syncedAt)}</p></div><button class="button primary" id="syncAccountNow" type="button" ${ui.accountBusy?"disabled":""}>${icons.refresh||icons.check}<span>${ui.accountBusy?"Syncing…":"Sync now"}</span></button><div class="hn-account-sync-metrics" aria-label="Account synchronization"><span><strong>${pending}</strong><small>Pending</small></span><span><strong>${conflicts}</strong><small>Conflicts</small></span></div></section>`;
  let content="";
  if(section==="data")content=`${sync}${settingsNavigationRow("Backups and export","Cloud and on-device recovery tools","backup","download")}`;
  else if(section==="sessions")content=`<section class="settings-focused-group" aria-labelledby="activeSessionsTitle"><div class="settings-focused-group__head"><span class="ui-eyebrow">Security</span><h3 id="activeSessionsTitle">Active sessions</h3><p>Review the devices currently signed in to this Bridge account.</p></div><div class="account-session-list">${!ui.accountPanelLoaded?`<p class="settings-note">Loading sessions…</p>`:sessions.length?sessions.map(accountSessionRow).join(""):`<p class="settings-note">No active sessions found.</p>`}</div></section>`;
  else if(section==="backup")content=accountBackupRows();
  else content=`<section class="settings-focused-group"><div class="settings-focused-group__head"><span class="ui-eyebrow">Password and access</span><h3>Account security</h3><p>Changing your password signs out other devices. Existing authentication and session rules remain unchanged.</p></div><div class="account-actions hn-account-security-actions"><button class="button subtle" id="changeAccountPassword" type="button" ${ui.accountBusy?"disabled":""}>Change password</button><button class="button subtle" id="signOutAccount" type="button" ${ui.accountBusy?"disabled":""}>Sign out of this device</button></div></section><section class="settings-reference-section"><h2>Devices</h2><div class="settings-reference-rows"><button type="button" data-settings-section-open="sessions">Review signed-in devices</button></div></section><div class="account-danger-zone"><strong>Delete Bridge account</strong><small>Deletes this account's cloud CRM records, revokes sessions, notifications, and scorecard links. Browser-only data is not silently erased.</small><button class="button destructive" id="deleteBridgeAccount" type="button" ${ui.accountBusy?"disabled":""}>Delete account</button></div>`;
  return `<section class="hn-account-workspace" aria-labelledby="bridgeAccountTitle">${profile}${error}${content}</section>`;
}

function accountSessionRow(session) {
  const lastSeen = session.lastSeenAt || session.last_seen_at || session.createdAt || session.created_at;
  return `<div class="account-session-row">
    <div><strong>${session.current ? "This device" : "Bridge session"}</strong><small>${lastSeen ? `Last active ${escapeHTML(fmtDate(lastSeen, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))}` : "Active session"}</small></div>
    ${session.current ? `<span class="current-session-label">Current</span>` : `<button class="button subtle revoke-account-session" type="button" data-session-id="${escapeHTML(session.id)}">Sign out</button>`}
  </div>`;
}

function accountBackupRows() {
  if (!accountModeActive()) return "";
  const backups = Array.isArray(ui.accountBackups) ? ui.accountBackups : [];
  const list = !ui.accountPanelLoaded
    ? `<p class="settings-note">Loading cloud backups…</p>`
    : backups.length
      ? `<div class="backup-list">${backups.map(accountBackupRow).join("")}</div>`
      : `<p class="settings-note">No cloud backups have been created for this account.</p>`;
  return `<div class="cloud-backup-block">
    <div class="account-actions">
      <button class="button subtle" id="createCloudBackup" type="button" ${ui.accountBusy ? "disabled" : ""}>${icons.download}<span>Create cloud backup</span></button>
      <button class="button subtle" id="exportAccountData" type="button" ${ui.accountBusy ? "disabled" : ""}>${icons.download}<span>Export my account</span></button>
    </div>
    ${list}
  </div>`;
}

function accountBackupRow(backup) {
  const createdAt = backup.createdAt || backup.created_at;
  const completedAt = backup.completedAt || backup.completed_at;
  const size = Number(backup.byteSize || backup.byte_size || 0);
  const label = createdAt ? fmtDate(createdAt, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Cloud backup";
  return `<div class="backup-row">
    <div><strong>${escapeHTML(label)}</strong><small>${escapeHTML(backup.status || "complete")}${completedAt ? "" : " · processing"}${size ? ` · ${Math.max(1, Math.round(size / 1024))} KB` : ""}</small></div>
    <button class="button subtle restore-cloud-backup" type="button" data-backup-id="${escapeHTML(backup.id)}" ${backup.status && backup.status !== "complete" ? "disabled" : ""}>Restore</button>
  </div>`;
}

function dataAndBackupSettings() {
  const local = `${settingsRow("Download all Bridge data",Button(`${icons.download}<span>JSON</span>`,{tone:"secondary",className:"settings-export-action",attributes:'id="exportBackup"'}))}${settingsRow("Export contacts",Button(`${icons.download}<span>CSV</span>`,{tone:"secondary",className:"settings-export-action",attributes:'id="exportCSV"'}))}${settingsRow("Restore from JSON backup",`<label class="ui-button ui-button--secondary settings-export-action">Choose file<input id="importBackup" type="file" accept="application/json" hidden></label>`)}`;
  return local;
}

async function refreshAccountPanelData() {
  if (!accountModeActive() || ui.accountPanelLoaded) return;
  const [account, backups, sessions] = await Promise.allSettled([
    accountClient.accountDetails(),
    accountClient.listBackups(),
    accountClient.listSessions()
  ]);
  ui.accountPanelError = "";
  if (account.status === "fulfilled" && account.value?.user) {
    accountContext.user = account.value.user;
  }
  if (backups.status === "fulfilled") {
    ui.accountBackups = backups.value?.backups || [];
  }
  if (sessions.status === "fulfilled") {
    ui.accountSessions = sessions.value?.sessions || [];
  }
  const failed = [account, backups, sessions].filter(result => result.status === "rejected");
  if (failed.length) ui.accountPanelError = "Some account details could not be loaded. Your local work remains available.";
  ui.accountPanelLoaded = true;
  if (ui.settingsOpen) render();
}

function settingsNavigationRow(title,detail,section,iconName="gear",meta=""){
  return `<button class="settings-nav-row" type="button" data-settings-section-open="${escapeHTML(section)}"><span class="settings-nav-row__copy"><strong>${escapeHTML(title)}</strong>${detail?`<small>${escapeHTML(detail)}</small>`:""}</span><span class="settings-nav-row__chevron" aria-hidden="true">${icons.chevronRight}</span></button>`;
}
function settingsNavigationGroup(title,content){return `<section class="settings-nav-group"><h2>${escapeHTML(title)}</h2><div class="settings-nav-group__rows">${content}</div></section>`;}
function settingsCapabilityNote(title,detail,tone="neutral"){return `<section class="settings-capability settings-capability--${escapeHTML(tone)}"><span class="status-dot ${tone==="success"?"granted":"default"}" aria-hidden="true"></span><div><strong>${escapeHTML(title)}</strong><small>${escapeHTML(detail)}</small></div></section>`;}
function settingsRootContent(s,metrics){
  const user=accountContext.user||{};
  const profileName=[user.firstName||s.firstName,user.lastName||s.lastName].filter(Boolean).join(" ")||"Bridge profile";
  const profileDetail=[profileName,s.businessName].filter(Boolean).join(" · ");
  const [reminderHour,reminderMinute]=String(s.dailyReminderTime||"09:00").split(":").map(Number);
  const reminderTime=new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit"}).format(new Date(2000,0,1,reminderHour||0,reminderMinute||0));
  const conversationReminder=s.dailyReminderEnabled?`Daily nudge at ${reminderTime}`:"Off";
  const followUpReminder=s.followUpNotifications?"On, at the scheduled time":"Off";
  const accountRow=accountModeActive()?settingsNavigationRow("Account & security","Password, sessions, and account controls","account"):"";
  const groups=[
    settingsNavigationGroup("Profile",`${settingsNavigationRow("Profile",profileDetail,"profile")}${accountRow}`),
    settingsNavigationGroup("Goals",settingsNavigationRow("Goals & progress",`${s.dailyGoal} daily · ${s.weeklyGoal} weekly · ${s.monthlyGoal} monthly · ${metrics.goalStreak} day streak`,"goals")),
    settingsNavigationGroup("Notifications",settingsNavigationRow("Notifications",`${conversationReminder} · follow-ups ${followUpReminder.toLowerCase()}`,"notifications")),
    settingsNavigationGroup("Relationships",`${settingsNavigationRow("Workflow","Default follow-up and week layout","preferences")}${settingsNavigationRow("Relationship health","Visibility, cadence, and scoring","health")}${settingsNavigationRow("Archive","Inactive-contact behavior","archive")}`),
    settingsNavigationGroup("Data",`${settingsNavigationRow("Data & sync",accountModeActive()?accountSyncLabel():"Saved on this device","data")}${settingsNavigationRow("Backup & export","Local and cloud backup tools","backup")}`),
    settingsNavigationGroup("Privacy & sharing",settingsNavigationRow("Scorecards and sharing","Link privacy and deletion behavior","privacy")),
    settingsNavigationGroup("About Bridge",settingsNavigationRow("About & support",`Version ${APP_RELEASE.version}`,"about"))
  ];
  return `<div class="settings-root">${groups.join("")}</div>`;
}
function settingsRestControls(excludedDates,restRules,restFrequency,todayExcluded){
  return `<p class="settings-note streak-settings-copy">Rest days protect your streak without adding a completed day or changing the streak calculation.</p><div class="rest-rule-builder"><label class="field"><span>Repeats</span><select id="streakRestFrequency" aria-label="Rest day repeat frequency"><option value="once" ${restFrequency==="once"?"selected":""}>Does not repeat</option><option value="weekly" ${restFrequency==="weekly"?"selected":""}>Every week</option><option value="monthly" ${restFrequency==="monthly"?"selected":""}>Every month</option><option value="yearly" ${restFrequency==="yearly"?"selected":""}>Every year</option></select></label><div class="rest-rule-panel" data-rest-panel="once" ${restFrequency==="once"?"":"hidden"}><label class="field"><span>Rest date</span><input id="oneTimeRestDate" type="date" aria-label="One-time rest date"></label><small>Applies to this date only.</small></div><div class="rest-rule-panel" data-rest-panel="weekly" ${restFrequency==="weekly"?"":"hidden"}><span class="field-label">Rest days</span><div class="weekday-picker" role="group" aria-label="Weekly rest days">${weekdayButtons()}</div><small>Choose one or more days.</small></div><div class="rest-rule-panel" data-rest-panel="monthly" ${restFrequency==="monthly"?"":"hidden"}><label class="field"><span>Day of month</span><input id="monthlyRestDay" type="number" min="1" max="31" inputmode="numeric" placeholder="1–31"></label><small>Skipped in shorter months.</small></div><div class="rest-rule-panel" data-rest-panel="yearly" ${restFrequency==="yearly"?"":"hidden"}><label class="field"><span>Annual rest date</span><input id="yearlyRestDate" type="date" aria-label="Annual rest date"></label><small>Repeats each year.</small></div><button class="button subtle rest-rule-add" id="addStreakRestRule" type="button">${icons.plus}<span>Add rest day</span></button></div><div id="oneTimeRestDaysSection" class="legacy-rest-days" ${excludedDates.length?"":"hidden"}><span class="field-label">One-time</span><div id="streakRestDays" class="rest-day-list">${restDayRows(excludedDates)}</div></div><div id="streakRestRules" class="rest-day-list" aria-live="polite">${restRuleRows(restRules)}</div><p id="todayRestDayStatus" class="settings-note rest-day-status ${todayExcluded?"active":""}">${todayExcluded?"Today is a rest day.":"Today counts toward your goal."}</p>`;
}
function settingsProfileContent(s){
  const firstName=s.firstName||accountContext.user?.firstName||"";const lastName=s.lastName||accountContext.user?.lastName||"";
  const user=accountContext.user||{};const displayName=[firstName,lastName].filter(Boolean).join(" ")||"Bridge profile";const signedIn=accountModeActive();
  const identity=`<header class="settings-account-identity"><div class="account-avatar">${escapeHTML(initials(displayName||user.email||"B"))}</div><div><h2>${escapeHTML(displayName)}</h2>${user.email?`<p>${escapeHTML(user.email)}</p>`:""}<small class="${signedIn?"is-synced":""}"><i aria-hidden="true"></i>${signedIn?"Signed in and synced":"Stored on this device"}</small></div></header>`;
  const profile=`<section class="settings-reference-section settings-account-profile-fields"><h2>Profile</h2><div class="settings-reference-fields">${field("First name",`<input name="firstName" value="${escapeHTML(firstName)}" placeholder="First name" autocomplete="given-name">`)}${field("Last name",`<input name="lastName" value="${escapeHTML(lastName)}" placeholder="Last name" autocomplete="family-name">`)}${field("Business name",`<input name="businessName" value="${escapeHTML(s.businessName)}" placeholder="Business">`)}</div></section>`;
  return `${identity}${profile}`;
}
function settingsGoalsContent(s,metrics,excludedDates,restRules,restFrequency){
  const goals=`<section class="settings-reference-section settings-goal-targets"><p class="settings-goals-intro">Goals exist to keep you talking to people. They stay quiet in the app — a single line on Today — so relationships stay the main event.</p><h2>Targets</h2><div class="settings-reference-fields">${field("Daily conversations",`<input name="dailyGoal" type="number" min="1" max="100" inputmode="numeric" value="${s.dailyGoal}">`)}${field("Weekly conversations",`<input name="weeklyGoal" type="number" min="1" max="500" inputmode="numeric" value="${s.weeklyGoal}">`)}${field("Monthly conversations",`<input name="monthlyGoal" type="number" min="1" max="2000" inputmode="numeric" value="${s.monthlyGoal}">`)}</div></section>`;
  const streak=`<section class="settings-reference-section settings-goal-streak"><h2>Streak</h2><div class="settings-reference-rule"><strong>A day counts when the goal is met</strong><small>Rest days preserve continuity without adding a completed day.</small></div><details class="settings-rest-disclosure"><summary><span><strong>Rest days</strong><small>${excludedDates.length+restRules.length?`${excludedDates.length+restRules.length} protected schedule${excludedDates.length+restRules.length===1?"":"s"}`:"Add one-time or repeating rest days"}</small></span>${icons.chevronDown}</summary><div>${settingsRestControls(excludedDates,restRules,restFrequency,metrics.todayExcluded)}</div></details></section>`;
  return `${goals}${streak}`;
}
function settingsPreferencesContent(s){
  const workflow=`${settingsRow("Default follow-up",`<select name="defaultFollowUpDays"><option value="1" ${s.defaultFollowUpDays==1?"selected":""}>1 day</option><option value="2" ${s.defaultFollowUpDays==2?"selected":""}>2 days</option><option value="7" ${s.defaultFollowUpDays==7?"selected":""}>1 week</option></select>`)}${settingsRow("Week starts",`<select name="weekStart"><option value="0" ${s.weekStart==0?"selected":""}>Sunday</option><option value="1" ${s.weekStart==1?"selected":""}>Monday</option></select>`)}`;
  return settingsSection("Workflow",workflow);
}
function settingsHealthContent(s){return settingsSection("Relationship health",relationshipHealthSettings(s));}
function settingsArchiveContent(s){
  const archived=state.contacts.filter(contact=>contact.archivedAt).length;
  return `<section class="settings-reference-section settings-archive-section"><h2>Inactive contacts</h2><div class="settings-reference-toggle-rows">${ToggleRow("Archive after 30 inactive days",{detail:"Only no-stage prospects without MSA activity, scheduled follow-ups, or pipeline progress leave the active list. History stays in Analytics.",name:"autoArchiveInactive",checked:s.autoArchiveInactive})}</div><p class="settings-reference-note">${archived} archived contact${archived===1?"":"s"}. Restore archived relationships from the People visibility filter.</p></section>`;
}
function settingsDataContent(){
  if(!accountModeActive())return `<section class="settings-sync-status"><strong>Stored on this device</strong><p>${state.contacts.length} relationship${state.contacts.length===1?"":"s"} · saved in this browser</p></section>`;
  const status=accountContext.status||{};const pending=Number(status.pending||0);const conflicts=Number(status.conflicts||0);const syncedAt=status.lastSyncedAt?fmtDateTime(status.lastSyncedAt):"Not synced yet";
  return `<section class="settings-sync-status"><strong><i aria-hidden="true"></i>${escapeHTML(accountSyncLabel())}</strong><p>${state.contacts.length} relationship${state.contacts.length===1?"":"s"} · ${pending} pending · ${conflicts} conflict${conflicts===1?"":"s"} · last sync ${escapeHTML(syncedAt)}</p></section><section class="settings-reference-section"><h2>Sync</h2><div class="settings-reference-rows"><button type="button" id="syncAccountNow">Sync now</button></div></section>`;
}
function settingsBackupContent(){
  const cloud=accountModeActive()?`${settingsSection("Cloud backup",accountWorkspaceSettings({section:"backup"}))}`:"";
  return `${cloud}${settingsSection("On this device",dataAndBackupSettings())}<p class="settings-note">Restore continues to require explicit confirmation before replacing the current Bridge data.</p>`;
}
function settingsAccountContent(section){
  if(accountModeActive())return accountWorkspaceSettings({section});
  return EmptyState("No account required","Bridge opens directly on this device. Edit your profile from Settings and use local backups to move your data.");
}
function settingsPrivacyContent(){
  return `<section class="settings-privacy-hero"><span class="ui-eyebrow">Private by default</span><h2>Share only what you choose</h2><p>Scorecard links exclude phone numbers, notes, follow-ups, private judgements, interest levels, and editing controls. Scope, seven-day expiry, confirmation, and revocation stay in the share flow where they apply.</p>${Button(`${icons.share}<span>Open scorecard sharing</span>`,{tone:"primary",size:"large",attributes:"data-open-scorecard-settings"})}</section>`;
}
function settingsAboutContent(){
  return `<section class="settings-reference-section"><h2>About Bridge</h2><div class="settings-reference-rows"><div class="ui-settings-row"><span><strong>Version</strong><small>${escapeHTML(APP_RELEASE.version)}</small></span></div><button type="button" id="openReleaseNotes">View release notes</button></div></section><section class="settings-reference-section"><h2>Support</h2><div class="settings-reference-rows settings-support-rows"><a class="ui-settings-row" href="mailto:fountainofyouthxs@gmail.com?subject=Bridge%20Feedback"><span><strong>Send feedback</strong><small>Email feedback about Bridge</small></span><span class="ui-settings-row__end">${icons.chevronRight}</span></a><a class="ui-settings-row" href="mailto:fountainofyouthxs@gmail.com?subject=Bridge%20Bug%20Report"><span><strong>Report a bug</strong><small>Email a bug report</small></span><span class="ui-settings-row__end">${icons.chevronRight}</span></a></div></section>`;
}
function settingsPageForm(section,content,save=true){return save?`<form id="settingsForm" class="hn-settings-form settings-route-stack" data-settings-section="${escapeHTML(section)}">${content}<div class="form-actions hn-settings-save">${Button("Save settings",{tone:"primary",size:"large",type:"submit"})}</div></form>`:`<div class="hn-settings-form settings-route-stack" data-settings-section="${escapeHTML(section)}">${content}</div>`;}
function settingsModal({routed=false}={}){
  const s=state.settings;const section=routed?(ui.routedSection||"root"):"root";
  const excludedDates=normalizeExcludedDates(Array.isArray(ui.settingsExcludedDatesDraft)?ui.settingsExcludedDatesDraft:s.streakExcludedDates);
  const restRules=normalizeRestRules(Array.isArray(ui.settingsRestRulesDraft)?ui.settingsRestRulesDraft:s.streakRestRules);
  const restFrequency=["once","weekly","monthly","yearly"].includes(ui.settingsRestFrequencyDraft)?ui.settingsRestFrequencyDraft:"once";
  const goalMetrics=dailyGoalMetrics({...state,settings:{...s,streakExcludedDates:excludedDates,streakRestRules:restRules}});
  const contentBySection={root:settingsRootContent(s,goalMetrics),profile:settingsProfileContent(s),goals:settingsGoalsContent(s,goalMetrics,excludedDates,restRules,restFrequency),notifications:notificationSettings(s),preferences:settingsPreferencesContent(s),health:settingsHealthContent(s),archive:settingsArchiveContent(s),data:settingsDataContent(),account:settingsAccountContent("account"),sessions:settingsAccountContent("sessions"),backup:settingsBackupContent(),privacy:settingsPrivacyContent(),about:settingsAboutContent()};
  const saveSections=new Set(["profile","goals","notifications","preferences","health","archive"]);
  const canSave=saveSections.has(section)&&(section!=="notifications"||notificationDeliveryState().kind==="active");
  const body=settingsPageForm(section,contentBySection[section]||contentBySection.root,canSave);
  const coveredByAccountAction=Boolean(ui.accountAction);
  if(routed){const titles={root:"Settings",profile:"Profile",goals:"Goals & progress",notifications:"Notifications",preferences:"Workflow",health:"Relationship health",archive:"Archive",data:"Data & sync",account:"Account & security",sessions:"Signed-in devices",backup:"Backup & export",privacy:"Privacy & sharing",about:"About Bridge"};return PresentationScreen(body,{title:titles[section]||"Settings",eyebrow:"",className:`settings-screen settings-screen--${escapeHTML(section)}`,large:section==="root"});}
  return `<div class="modal-backdrop hn-settings-backdrop" id="settingsBackdrop" ${coveredByAccountAction?'aria-hidden="true" inert':""}><section class="modal hn-settings-modal" role="dialog" ${coveredByAccountAction?"":'aria-modal="true"'} aria-labelledby="settingsTitle"><header class="modal-head hn-settings-head"><div><span class="ui-eyebrow">Bridge preferences</span><h2 id="settingsTitle">Settings</h2><p>Shape how you stay close to the people who matter.</p></div>${IconButton("close","Close settings",{className:"close-modal"})}</header><div class="modal-body hn-settings-body">${body}</div></section></div>`;
}
function settingsSection(title,content){return SurfaceCard(`${SectionHeader(title,{level:2})}<div class="hn-settings-section__content">${content}</div>`,{className:"settings-section hn-settings-section"});}
function settingsRow(label,control,className=""){return SettingsRow(label,{end:control,tag:"div",className});}
function settingsMomentumSummary(metrics){return `<section class="hn-settings-momentum" aria-label="Goal and streak summary"><div><span class="ui-eyebrow">Today</span><strong>${metrics.todayCount} / ${metrics.goal}</strong><small>${metrics.todayExcluded?"Rest day protected":"conversations"}</small></div><div class="hn-settings-momentum__progress">${ProgressBar(metrics.todayCount,{label:"Today's conversation goal",max:metrics.goal})}<span>${metrics.todayComplete?"Daily goal complete":metrics.todayExcluded?"Your streak is protected":"Keep the momentum going"}</span></div><div><span class="ui-eyebrow">Streak</span><strong>${metrics.goalStreak}</strong><small>day${metrics.goalStreak===1?"":"s"}</small></div></section>`;}
function healthPresetFieldName(role,stage){return `healthPreset_${role.replaceAll(/\W/g,"_")}_${stage.replaceAll(/\W/g,"_")}`;}
function relationshipHealthSettings(settings){
  const presets=normalizeCadencePresets(settings.healthCadencePresets);
  const roles=Object.entries(DEFAULT_CADENCE_PRESETS).map(([role,stages])=>`<fieldset class="health-preset-group"><legend>${escapeHTML(role)}</legend><div class="health-preset-grid">${Object.keys(stages).map(stage=>`<label><span>${escapeHTML(stage==="default"?"No stage":stageLabel(stage))}</span><span class="cadence-input"><input name="${healthPresetFieldName(role,stage)}" type="number" min="1" max="365" inputmode="numeric" value="${presets[role][stage]}"><small>days</small></span></label>`).join("")}</div></fieldset>`).join("");
  return `<p class="settings-note">Scores use counted conversations and scheduled actions to show which relationships need attention.</p>${ToggleRow("Show relationship health",{detail:"Display scores, bands, confidence, and trends throughout Bridge.",name:"healthScoresVisible",checked:settings.healthScoresVisible!==false})}${settingsRow("Fallback cadence",`<span class="cadence-input"><input name="healthFallbackCadenceDays" type="number" min="1" max="365" inputmode="numeric" value="${settings.healthFallbackCadenceDays||14}"><small>days</small></span>`)}<details class="health-preset-editor"><summary><span>Edit role and stage cadences</span>${icons.chevronDown}</summary><div class="health-preset-groups">${roles}</div></details>`;
}
function readHealthCadencePresets(formData){
  const draft={};
  Object.entries(DEFAULT_CADENCE_PRESETS).forEach(([role,stages])=>{draft[role]={};Object.keys(stages).forEach(stage=>{draft[role][stage]=Number(formData.get(healthPresetFieldName(role,stage)));});});
  return normalizeCadencePresets(draft);
}
const WEEKDAY_NAMES=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function weekdayButtons() {
  return WEEKDAY_NAMES.map((day,index)=>`<button type="button" class="weekday-button" data-weekday="${index}" aria-pressed="false" aria-label="${day}">${day.slice(0,1)}</button>`).join("");
}
function restRuleRows(rules) {
  if(!rules.length)return "";
  return rules.map((rule,index)=>{
    const summary=rule.frequency==="weekly"?`Every week · ${rule.weekdays.map(day=>WEEKDAY_NAMES[day].slice(0,3)).join(", ")}`:rule.frequency==="monthly"?`Every month · Day ${rule.day}`:`Every year · ${fmtDate(`2000-${rule.date}`,{month:"long",day:"numeric"})}`;
    return `<div class="rest-day-row"><div><strong>${escapeHTML(summary)}</strong><small>Streak protected</small></div><button class="ui-icon-button remove-rest-rule" type="button" data-rest-rule-index="${index}" aria-label="Remove ${escapeHTML(summary)}">${icons.trash}</button></div>`;
  }).join("");
}
function restDayRows(dates) {
  return dates.map(date=>`<div class="rest-day-row"><div><strong>${escapeHTML(fmtDate(date,{weekday:"short",month:"short",day:"numeric",year:"numeric"}))}</strong><small>${escapeHTML(date)}${date===todayInput()?" · Today":""}</small></div><button class="ui-icon-button remove-rest-day" type="button" data-rest-date="${escapeHTML(date)}" aria-label="Remove rest day ${escapeHTML(date)}">${icons.trash}</button></div>`).join("");
}
function refreshRestDayEditor() {
  const dates=normalizeExcludedDates(ui.settingsExcludedDatesDraft);
  const rules=normalizeRestRules(ui.settingsRestRulesDraft);
  ui.settingsExcludedDatesDraft=dates;
  ui.settingsRestRulesDraft=rules;
  const list=$("#streakRestDays");
  if(list)list.innerHTML=restDayRows(dates);
  const oneTimeSection=$("#oneTimeRestDaysSection");
  if(oneTimeSection)oneTimeSection.hidden=!dates.length;
  const ruleList=$("#streakRestRules");
  if(ruleList)ruleList.innerHTML=restRuleRows(rules);
  const todayExcluded=dailyGoalMetrics({...state,settings:{...state.settings,streakExcludedDates:dates,streakRestRules:rules}}).todayExcluded;
  const status=$("#todayRestDayStatus");
  if(status){status.classList.toggle("active",todayExcluded);status.textContent=todayExcluded?"Today is a rest day.":"Today counts toward your goal.";}
}
function notificationSettings(s){
  const delivery=notificationDeliveryState();
  const active=delivery.kind==="active";
  const canEnable=["default","granted"].includes(delivery.kind);
  const actions=active?`<div class="notification-actions">${Button("Send test",{tone:"secondary",size:"small",attributes:'id="testPushNotification"'})}${Button("Turn off on this device",{tone:"quiet",size:"small",attributes:'id="disablePushNotifications"'})}</div>`:canEnable?Button("Enable background reminders",{tone:"secondary",attributes:'id="requestNotifications"'}):"";
  const reminderLabel=`One reminder at ${new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit"}).format(new Date(`2000-01-01T${s.dailyReminderTime||"09:00"}:00`))} if you haven't reached today's goal.`;
  const unavailableNote=active?"":'<p class="settings-notification-help" id="notificationControlsHelp">Enable reminders on this device to adjust delivery.</p>';
  return `<section class="notification-status settings-notification-status" role="status" aria-live="polite" ${delivery.kind==="checking"?'aria-busy="true"':""}><div><strong>${escapeHTML(delivery.title)}</strong><small>${escapeHTML(delivery.detail)}</small></div>${actions}</section>${unavailableNote}<section class="settings-reference-section settings-notification-section${active?"":" is-disabled"}"><h2>Conversation reminders</h2><div class="settings-reference-toggle-rows">${ToggleRow("Daily nudge",{detail:reminderLabel,name:"dailyReminderEnabled",checked:active&&s.dailyReminderEnabled,disabled:!active,attributes:active?"":'aria-describedby="notificationControlsHelp"'})}${SettingsRow("Reminder time",{detail:"Uses this device's local time.",end:`<input class="compact-time-control" type="time" name="dailyReminderTime" value="${escapeHTML(s.dailyReminderTime||"09:00")}" ${active?"":"disabled"}>`,tag:"div",className:"settings-reminder-time"})}</div></section><section class="settings-reference-section settings-notification-section${active?"":" is-disabled"}"><h2>Follow-up reminders</h2><div class="settings-reference-toggle-rows">${ToggleRow("At the scheduled time",{detail:"Includes the reason you wrote down.",name:"followUpNotifications",checked:active&&s.followUpNotifications,disabled:!active,attributes:active?"":'aria-describedby="notificationControlsHelp"'})}</div></section>`;
}
function detailItem(label,value,cls=""){return `<div class="contact-info-item ${cls}"><span>${label}</span><strong class="${value?"":"muted"}">${value?escapeHTML(value):"Not provided"}</strong></div>`;}

function contactInformation(c) {
  const team = c.role === "Team";
  if (ui.contactEditing) {
    const places=[...state.places].sort((left,right)=>Number(right.isFavorite)-Number(left.isFavorite)||String(left.name).localeCompare(String(right.name)));
    const metDate=String(c.dateFirstMet||"").slice(0,10);
    const roleLocked=PIPELINE_STAGES.some(stage=>Boolean(c.stages?.[stage]));
    const roleEditor=roleLocked?`${field("Role",`<div class="read-only-control">${escapeHTML(c.role)}</div>`)}<input type="hidden" name="role" value="${escapeHTML(c.role)}"><p class="relationship-edit-helper">Move or clear the current pipeline stage before changing this role.</p>`:field("Role",`<select name="role" id="editContactRole"><option ${c.role==="Prospect"?"selected":""}>Prospect</option><option ${c.role==="Customer"?"selected":""}>Customer</option><option ${team?"selected":""}>Team</option></select>`);
    const newPlaceEditor=`${field("Add a new place",'<input name="newPlaceName" data-edit-new-place placeholder="Optional place name">')}<label class="quick-capture-check edit-new-place-favorite" data-edit-new-place-favorite hidden><input type="checkbox" name="favoritePlace" disabled><span>Save this new place as a favorite</span></label>`;
    return `<section class="contact-information relationship-edit-form"><form id="contactInfoForm"><details class="relationship-edit-section" open><summary><span><strong>Identity</strong><small>${escapeHTML(c.fullName)}</small></span>${icons.chevronDown}</summary><div class="relationship-edit-section__body relationship-edit-contact-fields">${field("Full name",`<input name="fullName" value="${escapeHTML(c.fullName)}" required autocomplete="name">`)}${field("Phone",`<input name="phoneNumber" value="${escapeHTML(c.phoneNumber)}" autocomplete="tel" inputmode="tel">`)}${field("Email",`<input name="email" type="email" value="${escapeHTML(c.email||"")}" autocomplete="email" inputmode="email" placeholder="Optional">`)}${roleEditor}</div></details><details class="relationship-edit-section" open><summary><span><strong>Fit & interest</strong><small>${team?"Team relationship":escapeHTML(`${c.judgement} · ${c.interestLevel}`)}</small></span>${icons.chevronDown}</summary><div class="relationship-edit-section__body"><div data-edit-role-fit-field ${team?"hidden":""}>${field("Interest",`<select name="interestLevel">${INTERESTS.map(x=>`<option ${c.interestLevel===x?"selected":""}>${x}</option>`).join("")}</select>`)}</div><div data-edit-role-fit-field ${team?"hidden":""}>${field("Judgment",`<select name="judgement"><option ${c.judgement==="Good Fit"?"selected":""}>Good Fit</option><option ${c.judgement==="Not Good Fit"?"selected":""}>Not Good Fit</option></select>`)}</div>${field("Conversation type",`<select name="conversationType">${CONVERSATION_TYPES.map(x=>`<option ${c.conversationType===x?"selected":""}>${x}</option>`).join("")}</select>`)}</div></details><details class="relationship-edit-section" open><summary><span><strong>Place & first meeting</strong><small>${escapeHTML(c.placeName||"Not provided")}</small></span>${icons.chevronDown}</summary><div class="relationship-edit-section__body">${field("Where we met",`<select name="placeId"><option value="">No saved place</option>${places.map(place=>`<option value="${escapeHTML(place.id)}" ${String(c.placeId||"")===String(place.id)?"selected":""}>${escapeHTML(place.name)}${place.isFavorite?" · Favorite":""}</option>`).join("")}</select>`)}${newPlaceEditor}${field("Date first met",`<input name="dateFirstMet" type="date" value="${escapeHTML(metDate)}">`)}</div></details><div class="form-actions contact-edit-actions"><button class="button" id="cancelContactInfoEdit" type="button">Cancel</button><button class="button primary" type="submit">${icons.check}Save changes</button></div></form></section>`;
  }
  return `<section class="card glass contact-information"><div class="card-section-head"><div><span class="eyebrow">Details</span><h2>Contact Information</h2></div><button class="button subtle edit-contact-button" id="editContactInfo" type="button">${icons.pencil}<span>Edit</span></button></div><div class="contact-info-grid">${detailItem("Full name",c.fullName)}${detailItem("Phone",c.phoneNumber)}${detailItem("Email",c.email)}${detailItem("Role",c.role)}${team?"":detailItem("Interest",`${c.interestLevel} interest`)}${team?"":detailItem("Judgement",c.judgement)}${detailItem("Conversation type",c.conversationType)}</div></section>`;
}

function contactHealthCard(c){
  const score=scoreContact(c,{settings:state.settings,analytics:state.analytics,now:new Date()});
  if(!state.settings.healthScoresVisible)return "";
  const componentLabels={recency:"Recency",consistency:"Consistency",actionHealth:"Action health",momentum:"Momentum"};
  const components=Object.entries(score.components).map(([key,component])=>`<div class="ui-metric-card health-component${component?"":" is-unavailable"}"><span class="ui-metric-card__label">${componentLabels[key]}</span><strong class="ui-metric-card__value">${component?component.value:"—"}</strong><small class="ui-metric-card__detail">${component?escapeHTML(component.explanation):"Not enough applicable history"}</small></div>`).join("");
  const trend=`${escapeHTML(score.trend.direction)}${score.trend.delta?` ${score.trend.delta>0?"+":""}${score.trend.delta}`:""}`;
  const customCadence=Number.isInteger(Number(c.healthCadenceDays))&&Number(c.healthCadenceDays)>=1&&Number(c.healthCadenceDays)<=365;
  const cadenceValue=customCadence?Number(c.healthCadenceDays):score.cadence.days;
  return `<details class="ui-surface-card contact-health-card"><summary class="contact-health-summary"><div><span class="ui-eyebrow ui-eyebrow--brand">Relationship health</span><h2 class="ui-editorial-heading">${escapeHTML(score.band)}</h2></div><div class="contact-health-summary-meta"><strong class="health-score-value">${score.score===null?"—":score.score}</strong><span class="contact-health-summary-chevron" aria-hidden="true">${icons.chevronDown}</span></div></summary><div class="contact-health-details"><div class="health-context"><span class="ui-status-badge ui-status-badge--brand">${score.cadence.days}-day cadence</span><span class="ui-status-badge">${escapeHTML(score.confidence)} confidence</span><span class="ui-status-badge">${trend}</span></div><p>${escapeHTML(score.explanation)}</p><div class="ui-metric-grid health-component-grid">${components}</div><form id="contactCadenceForm" class="contact-cadence-form"><fieldset class="contact-cadence-mode"><legend>Contact cadence override</legend><div><label><input type="radio" name="healthCadenceMode" value="automatic" ${customCadence?"":"checked"}><span>Automatic</span></label><label><input type="radio" name="healthCadenceMode" value="custom" ${customCadence?"checked":""}><span>Custom</span></label></div></fieldset><label class="contact-cadence-custom" data-contact-cadence-custom ${customCadence?"":"hidden"}><span>Days between conversations</span><span class="cadence-input"><input name="healthCadenceDays" type="number" min="1" max="365" inputmode="numeric" value="${cadenceValue}" ${customCadence?"":"disabled"}><small>days</small></span></label><button class="ui-button ui-button--secondary" type="submit">Save cadence</button></form><small class="formula-note">Health updated ${escapeHTML(fmtDateTime(score.calculatedAt))}</small></div></details>`;
}

function contactPersonalInfo(c){return `<section class="personal-info-workspace" aria-labelledby="personalInfoWorkspaceTitle"><div><span class="ui-eyebrow">Relationship context</span><h2 id="personalInfoWorkspaceTitle">What I know</h2><p>Keep useful details about this person separate from conversation notes.</p></div><form id="personalInfoForm"><label class="field"><span>Personal details</span><textarea name="personalInfo" placeholder="Goals, family, work, interests, or helpful context">${escapeHTML(c.personalInfo||"")}</textarea></label><div class="form-actions personal-info-actions"><button class="button primary" type="submit">Save personal info</button></div></form></section>`;}

function contactTracking(c) {
  const team = c.role === "Team";
  const pipeline = team ? '<p class="muted">Team contacts do not participate in the prospect or customer pipeline.</p>' : `<span class="eyebrow">${c.role === "Customer" ? "Customer sales pipeline" : "Pipeline"} · optional</span><div class="checks tracking-checks ${c.role === "Customer" ? "customer-stage-checks" : ""}" id="editPipelineChecks">${roleStageChecks(c.role,c)}</div>${currentPipelineStage(c)?'<button class="button subtle clear-pipeline" id="clearPipelineStage" type="button">Clear pipeline stage</button>':""}<label class="check-tile filtered-out-toggle"><input type="checkbox" name="isFilteredOut" ${c.isFilteredOut?"checked":""}><span><strong>No-Go</strong><br><small class="muted">Remove this person from the active opportunity pipeline without deleting their history.</small></span></label>${c.isFilteredOut?'<button class="button subtle restore-no-go" id="restoreNoGo" type="button">Restore to Active</button>':""}`;
  const selected=["MSA","DTM"].filter(stage=>c.stages?.[stage]);
  return `<section class="card glass contact-tracking"><form id="editTrackingForm">${ActivitySelector({selected,label:"Activity",hint:"MSA and DTM stay independent from the sales pipeline."})}${pipeline}<div class="form-actions"><button class="button primary" type="submit">Save tracking</button></div></form></section>`;
}

function contactFollowUpCard(c,active){return `<section class="card glass contact-followup-card"><div class="card-section-head"><div><span class="eyebrow">Next action</span><h2>Follow-Up</h2></div></div>${active?`<div class="followup-summary"><span class="pill ${new Date(active.dueDate)<new Date()?"danger":"accent"}">${fmtDateTime(active.dueDate)}</span><p>${escapeHTML(active.note||"Follow up")}</p></div><div class="followup-actions"><button class="button primary" id="completeFollowUp">${icons.check}Complete</button><button class="button danger" id="removeFollowUp">${icons.trash}Remove</button></div>`:`<p class="muted">No follow-up set.</p>`}<form id="setFollowUpForm" class="followup-form">${field(active?"Replace with":"Set follow-up",'<input name="dueDate" type="datetime-local" required>')}<button class="button" type="submit">Set reminder</button></form></section>`;}
function contactPlaceCard(c){return `<section class="card glass contact-place-card"><div class="card-section-head"><div><span class="eyebrow">Relationship context</span><h2>Place Met</h2></div></div><p class="contact-place">${c.placeName?`${escapeHTML(c.placeName)}${state.places.find(place=>place.id===c.placeId)?.isFavorite?`<span class="favorite-star" role="img" aria-label="Favorite place" title="Favorite place">${icons.star}</span>`:""}`:'<span class="muted">No place saved</span>'}</p></section>`;}
function contactArchiveCard(c){return c.archivedAt?`<section class="card glass"><h2>Archived Contact</h2><p class="muted">Archived ${fmtDate(c.archivedAt,{month:"short",day:"numeric",year:"numeric"})}. History remains in Insights.</p><button class="button" id="restoreContact">Restore to active contacts</button></section>`:"";}
function contactActivityPanel(c){return `<div class="contact-tab-layout"><div>${contactTracking(c)}<section class="card glass contact-activity-card"><div class="card-section-head"><div><span class="eyebrow">Timeline</span><h2>Recent Activity</h2></div><div class="history-actions"><button class="button subtle" data-log-communication-contact-id="${c.id}" data-communication-type="Call" type="button">${icons.phoneCall}<span>Log call</span></button><button class="button subtle" data-log-communication-contact-id="${c.id}" data-communication-type="Text" type="button">${icons.chat}<span>Log text</span></button></div></div><div class="timeline timeline-list compact-activity-list">${renderLogs(c,{limit:3})}</div>${c.conversations.length?`<button class="button subtle view-all-activity" id="viewAllActivity" type="button">View all activity (${c.conversations.length})</button>`:""}</section></div></div>`;}
function contactNotesPanel(c){const noteCount=c.conversations.filter(log=>!log.communicationType).length;return `<section class="card glass contact-notes-card"><div class="card-section-head"><div><span class="eyebrow">Private context</span><h2>Notes</h2></div></div><form id="addLogForm" class="stack-card"><div class="grid form-grid">${field("Note or activity",'<textarea name="notes" required placeholder="Log what you learned or discussed"></textarea>',"full")}${field("Type",`<select name="type">${CONVERSATION_TYPES.map(x=>`<option>${x}</option>`).join("")}</select>`)}${field("Date",`<input name="conversationDate" type="date" max="${todayInput()}" value="${todayInput()}">`)}</div><p class="muted">Notes do not increase the Conversations metric. Only Add creates a counted conversation.</p><button class="button" type="submit">${icons.plus}Add note</button></form><div class="timeline timeline-list compact-activity-list">${renderLogs(c,{limit:3,filter:"Notes"})}</div>${noteCount>3?`<button class="button subtle view-all-activity" id="viewAllActivity" type="button">View all notes (${noteCount})</button>`:""}</section>`;}

function contactOverviewFields(c,active) {
  if (ui.contactEditing) return contactInformation(c);
  const latest=latestConversationTime(c);
  const nextStep=active ? `${active.note || "Follow up"} · ${fmtDateTime(active.dueDate)}` : "No follow-up set";
  const tags=[c.role, c.role === "Team" ? "" : c.interestLevel, currentPipelineStage(c)].filter(Boolean).join(" · ");
  const rows=[
    ["Last conversation",latest?fmtDateTime(latest):"Not yet", "calendar"],
    ["Stage",stageLabel(stageFor(c)), "chart"],
    ...(c.role === "Team" ? [] : [["Interest",`${c.interestLevel} interest`, "target"]]),
    ["Phone",c.phoneNumber||"Not provided", "phone"],
    ["Email","Not provided", "note"],
    ["Next step",nextStep, "check"],
    ["Place met",c.placeName||"Not provided", "pin"],
    ["Relationship tags",tags||"Not provided", "tags"],
    ...(c.role === "Team" ? [] : [["Judgment",c.judgement||"Not provided", "check"]])
  ];
  return SurfaceCard(`${SectionHeader("Overview",{eyebrow:"Contact details",level:3})}<div class="contact-overview-rows">${rows.map(([label,value,iconName])=>InformationRow(label,value,{iconName})).join("")}</div>`,{className:"contact-overview-fields"});
}

function profileBriefLines(c) {
  return String(c.personalInfo || "").split(/\n+/).map(line=>line.trim()).filter(Boolean);
}
function profileStageEvents(c) {
  const stages=new Set(PIPELINE_STAGES);
  return (c.stageEvents || []).filter(event=>stages.has(event.stage)||stages.has(event.fromStage)||stages.has(event.toStage)).sort((left,right)=>new Date(right.occurredAt)-new Date(left.occurredAt));
}
function relationshipTimelineEvents(c) {
  const conversations=(c.conversations || []).map(log=>({id:`conversation-${log.id}`,kind:"conversation",at:log.conversationDate||log.createdAt,title:log.communicationType||(log.isCountedConversation?"Conversation":log.type||"Note"),meta:log.communicationType?[log.direction,log.outcome].filter(Boolean).join(" · "):(log.type||""),body:String(log.notes||""),place:c.placeName||"",raw:log}));
  const actions=(c.followUps || []).flatMap(item=>{
    const events=[{id:`followup-${item.id}-created`,kind:"followup",at:item.createdAt,title:"Follow-up scheduled",meta:`Due ${fmtDateTime(item.dueDate)}`,body:String(item.note||"")}];
    if(item.completedAt)events.push({id:`followup-${item.id}-completed`,kind:"followup",at:item.completedAt,title:"Follow-up completed",meta:fmtDateTime(item.dueDate),body:String(item.note||"")});
    if(item.canceledAt)events.push({id:`followup-${item.id}-canceled`,kind:"followup",at:item.canceledAt,title:"Follow-up canceled",meta:fmtDateTime(item.dueDate),body:String(item.note||"")});
    if(item.deletedAt)events.push({id:`followup-${item.id}-deleted`,kind:"followup",at:item.deletedAt,title:"Follow-up removed",meta:fmtDateTime(item.dueDate),body:String(item.note||"")});
    return events;
  });
  const pipeline=profileStageEvents(c).map(event=>{const from=event.fromStage||"";const to=event.toStage??event.stage??"";return {id:`stage-${event.id}`,kind:"pipeline",at:event.occurredAt,title:to?"Pipeline stage updated":"Pipeline stage cleared",meta:from&&to?`${from} → ${to}`:to?`Entered ${to}`:from?`Left ${from}`:"Stage changed",body:""};});
  const met=c.dateFirstMet?[{id:`met-${c.id}`,kind:"met",at:c.dateFirstMet,title:"Relationship added",meta:c.placeName?`Met at ${c.placeName}`:"Date first met",body:""}]:[];
  return [...conversations,...actions,...pipeline,...met].filter(event=>event.at&&!Number.isNaN(new Date(event.at).getTime())).sort((left,right)=>new Date(right.at)-new Date(left.at));
}
function profileTimelineIconName(event) {
  if(event.kind==="conversation"){
    if(event.raw?.communicationType==="Call")return "phone";
    if(event.raw?.communicationType==="Text")return "chat";
    return event.raw?.isCountedConversation?"chat":"pencilLine";
  }
  if(event.kind==="followup")return "flag";
  if(event.kind==="pipeline")return "arrowUpRight";
  return "handshake";
}
function profileTimelineEvent(event) {
  const iconName=profileTimelineIconName(event);
  const actions=event.kind==="conversation"?`<span class="profile-timeline-event__actions">${event.raw?.communicationType?`<button class="ui-icon-button edit-communication-log" data-log-id="${escapeHTML(event.raw.id)}" aria-label="Edit ${escapeHTML(event.title)}">${icons.pencil}</button>`:""}<button class="ui-icon-button delete-log" data-log-id="${escapeHTML(event.raw.id)}" aria-label="Delete ${escapeHTML(event.title)}">${icons.trash}</button></span>`:"";
  return `<article class="profile-timeline-event profile-timeline-event--${event.kind}"><span class="profile-timeline-event__icon" aria-hidden="true">${icons[iconName]}</span><div><header><strong>${escapeHTML(event.title)}</strong><time datetime="${escapeHTML(new Date(event.at).toISOString())}">${escapeHTML(fmtDate(event.at))}</time></header>${event.place?`<small>${escapeHTML(event.place)}</small>`:""}${event.meta?`<small>${escapeHTML(event.meta)}</small>`:""}${event.body?`<p>${escapeHTML(event.body)}</p>`:""}</div>${actions}</article>`;
}
function profileTimeline(c,limit=4) {
  const events=relationshipTimelineEvents(c);
  return `<section class="relationship-profile__section profile-timeline" aria-labelledby="profileTimelineTitle"><header class="profile-section-head"><h3 id="profileTimelineTitle">Timeline</h3>${events.length?`<button type="button" id="viewAllActivity">Full history</button>`:""}</header>${events.length?`<div class="profile-timeline__list">${events.slice(0,limit).map(profileTimelineEvent).join("")}</div>`:EmptyState("No relationship activity yet","Conversations, follow-ups, and recorded stage changes will appear here.",{className:"profile-timeline__empty"})}</section>`;
}
function profileNextAction(c,active) {
  const overdue=active&&new Date(active.dueDate)<new Date();
  const firstName=String(c.fullName||"this person").trim().split(/\s+/)[0]||"this person";
  return `<section class="relationship-profile__section profile-next-action${overdue?" is-overdue":""}" id="profileNextAction" aria-labelledby="profileNextActionTitle"><h3 id="profileNextActionTitle">Next action</h3>${active?`<div class="profile-next-action__content"><time datetime="${escapeHTML(new Date(active.dueDate).toISOString())}">${escapeHTML(fmtDateTime(active.dueDate))}${overdue?" · Overdue":""}</time><p>${escapeHTML(active.note||"Follow up")}</p><div><button class="button primary" id="completeFollowUp" type="button">${icons.check}<span>Done</span></button><button class="button subtle" data-profile-reschedule type="button">${icons.clock}<span>Reschedule</span></button></div></div>`:`<button class="profile-next-action__empty" data-profile-followup type="button"><span>Nothing scheduled with ${escapeHTML(firstName)}</span><strong>Set one</strong></button>`}</section>`;
}
function profileBridgeBrief(c) {
  const lines=profileBriefLines(c);
  return `<section class="relationship-profile__section profile-brief" aria-labelledby="profileBriefTitle"><header class="profile-section-head"><h3 id="profileBriefTitle">Bridge Brief</h3><button type="button" data-contact-detail-tab="personal" aria-label="Edit what I know about ${escapeHTML(c.fullName)}">Edit</button></header>${lines.length?`<div class="profile-brief__lines">${lines.map(line=>`<p>${escapeHTML(line)}</p>`).join("")}</div>`:EmptyState("Nothing captured yet","Add useful context about goals, family, work, interests, or preferences.",{className:"profile-brief__empty"})}</section>`;
}
function profileStageEditor(c) {
  const team=c.role==="Team";
  const stages=PIPELINES[c.role] || [];
  const selected=["MSA","DTM"].filter(stage=>c.stages?.[stage]);
  return `<form id="editTrackingForm" class="profile-stage-editor"><div class="profile-stage-options">${team?`<p>Team contacts do not use a sales pipeline.</p>`:`<label class="profile-stage-option"><input type="radio" name="pipelineStage" value="" ${currentPipelineStage(c)?"":"checked"}><span>No stage</span></label>${stages.map(stage=>`<label class="profile-stage-option"><input type="radio" name="pipelineStage" value="${escapeHTML(stage)}" ${currentPipelineStage(c)===stage?"checked":""}><span>${escapeHTML(stage)}</span></label>`).join("")}`}</div><details class="profile-secondary-tracking"><summary>Additional tracking</summary>${ActivitySelector({selected,label:"Relevant activity",hint:"Select either or both without changing the pipeline stage."})}${team?"":`<label class="check-tile filtered-out-toggle"><input type="checkbox" name="isFilteredOut" ${c.isFilteredOut?"checked":""}><span><strong>No-Go</strong><br><small class="muted">Keep history while removing this person from the active opportunity pipeline.</small></span></label>`}</details><button class="button primary" type="submit">Save tracking</button></form>`;
}
function profilePipelineSection(c) {
  const team=c.role==="Team";
  const stages=PIPELINES[c.role] || [];
  const current=currentPipelineStage(c);
  const currentIndex=stages.indexOf(current);
  const history=profileStageEvents(c);
  return `<section class="relationship-profile__section profile-pipeline" aria-labelledby="profilePipelineTitle"><h3 id="profilePipelineTitle">Pipeline</h3>${team?`<p class="profile-pipeline__team">Team contacts do not participate in the Prospect or Customer pipeline.</p>`:`<div class="profile-pipeline__status"><strong>${escapeHTML(`${c.role} · ${current||"No stage"}`)}</strong></div><div class="profile-stage-progress" style="--profile-stage-count:${stages.length}" aria-label="${escapeHTML(c.role)} pipeline stages">${stages.map((stage,index)=>`<span class="${index<currentIndex?"is-complete":index===currentIndex?"is-current":""}"><i aria-hidden="true"></i><b>${escapeHTML(stage)}</b></span>`).join("")}</div>`}<details class="profile-stage-update"><summary><span>Update stage</span>${icons.chevronRight}</summary>${profileStageEditor(c)}</details><details class="profile-stage-history"><summary><span><strong>Stage history</strong><small>${history.length} movement${history.length===1?"":"s"}</small></span>${icons.chevronDown}</summary>${history.length?`<ol>${history.map(event=>{const from=event.fromStage||"";const to=event.toStage??event.stage??"";const label=from&&to?`${from} → ${to}`:to?`Entered ${to}`:from?`Left ${from}`:"Stage changed";return `<li><span>${escapeHTML(label)}</span><time datetime="${escapeHTML(new Date(event.occurredAt).toISOString())}">${escapeHTML(fmtDate(event.occurredAt))}</time></li>`;}).join("")}</ol>`:`<p>No recorded stage movements.</p>`}</details></section>`;
}
function profileDetails(c) {
  const noteLogs=(c.conversations || []).filter(log=>String(log.notes||"").trim());
  const details=[
    ["Contact",[c.phoneNumber,c.email].filter(Boolean).join(" · ")||"Not provided",`<div class="profile-contact-lines"><p><strong>Phone</strong>${c.phoneNumber?`<a href="${phoneHref(c.phoneNumber)}">${escapeHTML(c.phoneNumber)}</a>`:"<span>No phone number saved.</span>"}</p><p><strong>Email</strong>${c.email?`<a href="${emailHref(c.email)}">${escapeHTML(c.email)}</a>`:"<span>No email saved.</span>"}</p></div><p>Conversation type: ${escapeHTML(c.conversationType||"Not provided")}</p><p>Met ${escapeHTML(fmtDate(c.dateFirstMet,{month:"long",day:"numeric",year:"numeric"})||"date not provided")}</p>`],
    ["Fit & interest",c.role==="Team"?"Team relationship":`${c.judgement||"Not provided"} · ${c.interestLevel||"Unsure"} interest`,`<p>${c.role==="Team"?"Fit and interest do not apply to Team contacts.":`${escapeHTML(c.judgement||"Not provided")} · ${escapeHTML(c.interestLevel||"Unsure")} interest`}</p>`],
    ["Places",c.placeName||"Not provided",`<p>${c.placeName?escapeHTML(c.placeName):"No place saved."}</p>`],
    ["Notes",noteLogs.length?`${noteLogs.length} saved`:"Empty",noteLogs.length?`<div class="profile-details__notes">${noteLogs.slice(0,3).map(log=>`<p>${escapeHTML(log.notes)}</p>`).join("")}</div>`:"<p>No notes saved.</p>"]
  ];
  return `<section class="relationship-profile__section profile-details" aria-labelledby="profileDetailsTitle"><h3 id="profileDetailsTitle">Details</h3><div class="profile-details__rows">${details.map(([label,summary,body])=>`<details><summary><span><strong>${escapeHTML(label)}</strong><small>${escapeHTML(summary)}</small></span>${icons.chevronDown}</summary><div>${body}</div></details>`).join("")}</div><button class="profile-edit-everything" data-edit-contact-info type="button"><span>Edit everything about ${escapeHTML(c.fullName.split(/\s+/)[0]||c.fullName)}</span>${icons.chevronRight}</button>${contactHealthCard(c)}${contactArchiveCard(c)}<details class="profile-danger-zone"><summary>Contact actions</summary><button class="button danger" id="deleteContact" type="button">${icons.trash}Delete contact</button></details></section>`;
}
function profileHeader(c, { routed=false }={}) {
  if(routed&&ui.routedScreen==="person-edit")return ScreenHeader("Edit person",{eyebrow:c.fullName});
  if(routed&&ui.contactDetailTab==="personal")return `<header class="ui-screen-header"><button type="button" class="ui-screen-header__back" data-contact-detail-tab="overview" aria-label="Back to profile">${icons.chevronLeft}</button><div class="ui-screen-header__title"><span>${escapeHTML(c.fullName)}</span><h1 id="presentationTitle" tabindex="-1">Personal Info</h1></div><span class="ui-screen-header__spacer" aria-hidden="true"></span></header>`;
  if(routed){
    const eyebrow=`${c.role} · Met ${fmtDate(c.dateFirstMet,{month:"short",day:"numeric"})||"date unknown"}`;
    return `<header class="ui-screen-header profile-collapse-header" data-profile-collapse-header><button type="button" class="ui-screen-header__back" data-presentation-back aria-label="Back">${icons.chevronLeft}</button><div class="ui-screen-header__title profile-collapse-header__identity"><span>${escapeHTML(eyebrow)}</span><strong data-profile-compact-title aria-hidden="true">${escapeHTML(c.fullName)}</strong></div><div class="ui-screen-header__action"><button class="contact-head-edit" data-edit-contact-info type="button" aria-label="Edit ${escapeHTML(c.fullName)}">${icons.pencil}</button></div></header>`;
  }
  return `<header class="modal-head contact-hero-head profile-sticky-header"><button class="contact-back close-modal" type="button" aria-label="Back to People"><span aria-hidden="true">${icons.chevronRight}</span></button><div><span>${escapeHTML(c.role)} · Met ${escapeHTML(fmtDate(c.dateFirstMet,{month:"short",day:"numeric"})||"date unknown")}</span><strong id="contactTitle">${escapeHTML(c.fullName)}</strong></div><button class="contact-head-edit" data-edit-contact-info type="button" aria-label="Edit ${escapeHTML(c.fullName)}">${icons.pencil}</button></header>`;
}
function relationshipProfileOverview(c,active,{routed=false}={}) {
  const callable=isCallablePhone(c.phoneNumber);
  const emailable=Boolean(String(c.email||"").trim()&&isValidEmail(c.email));
  const latest=latestConversationTime(c);
  const current=currentPipelineStage(c);
  const actions=`${callable?`<a href="${phoneHref(c.phoneNumber)}" data-communication-contact-id="${c.id}" data-communication-type="Call" aria-label="Call ${escapeHTML(c.fullName)}">${icons.phone}<span>Call</span></a>`:`<button type="button" disabled aria-label="Call unavailable; no phone number">${icons.phone}<span>Call</span></button>`}${callable?`<a href="${messageHref(c.phoneNumber)}" data-communication-contact-id="${c.id}" data-communication-type="Text" aria-label="Text ${escapeHTML(c.fullName)}">${icons.chat}<span>Text</span></a>`:`<button type="button" disabled aria-label="Text unavailable; no phone number">${icons.chat}<span>Text</span></button>`}${emailable?`<a href="${emailHref(c.email)}" aria-label="Email ${escapeHTML(c.fullName)}">${icons.mail}<span>Email</span></a>`:`<button type="button" disabled aria-label="Email unavailable; no email address">${icons.mail}<span>Email</span></button>`}<button type="button" data-contact-detail-tab="notes">${icons.penLine}<span>Log</span></button><button type="button" data-profile-followup>${icons.calendarPlus}<span>Follow up</span></button>`;
  const context=[c.conversationType,c.placeName?`met at ${c.placeName}`:""].filter(Boolean).join(" · ");
  const identityTitle=routed?`<h1 id="presentationTitle" tabindex="-1" data-profile-large-title>${escapeHTML(c.fullName)}</h1>`:`<h2>${escapeHTML(c.fullName)}</h2>`;
  return `<div class="relationship-profile"><section class="profile-identity">${identityTitle}<div class="profile-identity__status">${c.role==="Team"?`<span class="profile-role-chip">Team</span>`:`<span class="profile-role-chip"><i aria-hidden="true"></i>${escapeHTML(`${c.role} · ${current||"No stage"}`)}</span>`}<span>Last interaction ${latest?escapeHTML(peopleRelativeDate(latest)):"not recorded"}</span></div>${context?`<p>${escapeHTML(context)}</p>`:""}</section><div class="profile-quick-actions" aria-label="Quick contact actions">${actions}</div>${profileNextAction(c,active)}${profileBridgeBrief(c)}${profileTimeline(c)}${profilePipelineSection(c)}${profileDetails(c)}</div>`;
}
function contactModal(id, { routed=false }={}) {
  const c=state.contacts.find(x=>x.id===id); if(!c){ui.detailId=null;return "";}
  const active=c.followUps.filter(isScheduledFollowUp).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate))[0];
  let content=relationshipProfileOverview(c,active,{routed});
  if(ui.contactEditing)content=`<div class="relationship-profile relationship-profile--editor"><p class="profile-editor-intro">Update this person's contact details, fit, and first-meeting information.</p>${contactInformation(c)}</div>`;
  else if(ui.contactDetailTab==="personal")content=`<div class="relationship-profile relationship-profile--editor relationship-personal-info">${contactPersonalInfo(c)}</div>`;
  else if(ui.contactDetailTab==="notes")content=`<div class="relationship-profile relationship-profile--editor">${contactNotesPanel(c)}<button class="button subtle" type="button" data-contact-detail-tab="overview">Back to profile</button></div>`;
  if(routed)return `<section class="presentation-screen ${presentationMotionClass()} relationship-profile-screen" data-presentation-screen="${escapeHTML(ui.routedScreen||"")}">${profileHeader(c,{routed:true})}<div class="presentation-screen__body contact-detail-body" role="region" aria-label="Relationship profile">${content}</div></section>`;
  return `<div class="modal-backdrop contact-profile-backdrop" id="contactBackdrop"><section class="modal wide contact-detail-modal relationship-profile-modal" role="dialog" aria-modal="true" aria-labelledby="contactTitle">${profileHeader(c)}<div class="modal-body contact-detail-body" role="region" aria-label="Relationship profile">${content}</div></section></div>`;
}
function editStageCheck(c,stage,title){return stageCheck(stage,title,{checked:Boolean(c.stages?.[stage])});}
function sortedLogs(c){return [...c.conversations].sort((a,b)=>new Date(b.conversationDate||b.createdAt)-new Date(a.conversationDate||a.createdAt));}
function logFilterMatches(log,filter){if(filter==="Calls")return log.communicationType==="Call";if(filter==="Texts")return log.communicationType==="Text";if(filter==="Notes")return !log.communicationType;return true;}
function activityDateGroup(log){const date=new Date(log.conversationDate||log.createdAt);const today=new Date();const start=new Date(today.getFullYear(),today.getMonth(),today.getDate());const day=new Date(date.getFullYear(),date.getMonth(),date.getDate());const difference=Math.round((start-day)/86400000);return difference===0?"Today":difference===1?"Yesterday":"Earlier";}
function renderLogEntry(log){const communication=log.communicationType;const label=communication?(communication==="Text"?"Text Message":"Phone Call"):(log.type||"Activity");const title=communication?`${label}${log.direction?` · ${log.direction}`:""}`:label;const meta=[fmtDateTime(log.conversationDate||log.createdAt),communication&&log.outcome,log.durationMinutes?`${Number(log.durationMinutes)} min`:null,log.isCountedConversation?"Counted conversation":!communication?"Note":null].filter(Boolean).join(" · ");const notes=String(log.notes||"");const canExpand=notes.length>110||notes.includes("\n");const expanded=ui.expandedLogIds.has(log.id);return `<article class="log-row ${communication?"communication-log":""}"><div class="log-row-head"><div class="log-title">${communication?`<span class="log-icon">${communication==="Text"?icons.chat:icons.phoneCall}</span>`:""}<div><strong>${escapeHTML(title)}</strong><div class="muted">${meta}</div></div></div><div class="log-actions">${communication?`<button class="ui-icon-button edit-communication-log" data-log-id="${log.id}" aria-label="Edit ${escapeHTML(label)}">${icons.pencil}</button>`:""}<button class="ui-icon-button delete-log" data-log-id="${log.id}" aria-label="Delete log">${icons.trash}</button></div></div>${notes?`<div class="log-note-wrap"><p class="log-note ${expanded?"expanded":""}">${escapeHTML(notes)}</p>${canExpand?`<button class="log-note-toggle" data-expand-log-id="${log.id}" type="button" aria-expanded="${expanded}">${expanded?"Less":"More"}</button>`:""}</div>`:""}</article>`;}
function renderLogs(c,{limit=null,filter="All",grouped=false}={}){let logs=sortedLogs(c).filter(log=>logFilterMatches(log,filter));if(limit)logs=logs.slice(0,limit);if(!logs.length)return emptyInline(filter==="All"?"No conversation history":`No ${filter.toLowerCase()} found`,filter==="All"?"Add a note, call, or text to start the timeline.":"Try another activity filter.");if(!grouped)return logs.map(renderLogEntry).join("");const groups=["Today","Yesterday","Earlier"];return groups.map(group=>{const entries=logs.filter(log=>activityDateGroup(log)===group);return entries.length?`<section class="activity-date-group"><h3>${group}</h3><div class="timeline">${entries.map(renderLogEntry).join("")}</div></section>`:"";}).join("");}

function profileTimelineMonth(value){const date=new Date(value);return Number.isNaN(date.getTime())?"Date unavailable":new Intl.DateTimeFormat(undefined,{month:"long",year:"numeric"}).format(date);}
function profileTimelineGroups(events){const groups=[];for(const event of events){const label=profileTimelineMonth(event.at);let group=groups.find(item=>item.label===label);if(!group){group={label,events:[]};groups.push(group);}group.events.push(event);}return groups;}
function activityHistoryModal(id,{routed=false}={}){
  const c=state.contacts.find(contact=>contact.id===id);if(!c)return "";
  const filters=[{label:"Everything",value:"All"},{label:"Conversations",value:"Conversations"},{label:"Follow-ups",value:"Actions"},{label:"Pipeline",value:"Pipeline"}];
  const events=relationshipTimelineEvents(c).filter(event=>ui.activityFilter==="All"||(ui.activityFilter==="Conversations"&&event.kind==="conversation")||(ui.activityFilter==="Actions"&&event.kind==="followup")||(ui.activityFilter==="Pipeline"&&event.kind==="pipeline"));
  const groups=profileTimelineGroups(events);
  const content=`<div class="activity-filters" role="group" aria-label="Filter relationship history">${filters.map(filter=>`<button class="activity-filter ${ui.activityFilter===filter.value?"active":""}" data-activity-filter="${filter.value}" type="button" aria-pressed="${ui.activityFilter===filter.value}">${filter.label}</button>`).join("")}</div><div class="activity-history-groups">${groups.length?groups.map(group=>`<section class="profile-history-group"><h2>${escapeHTML(group.label)}</h2><div class="activity-history-list profile-timeline__list">${group.events.map(profileTimelineEvent).join("")}</div></section>`).join(""):emptyInline("No matching history","Only stored relationship activity appears here.")}</div><button class="button subtle show-less-activity" type="button">Back to profile</button>`;
  if(routed)return PresentationScreen(content,{title:"Relationship history",eyebrow:c.fullName,className:"profile-history-screen"});
  return `<div class="modal-backdrop activity-history-backdrop" id="activityHistoryBackdrop"><section class="modal activity-history-modal profile-history-modal" role="dialog" aria-modal="true" aria-labelledby="activityHistoryTitle"><header class="modal-head"><div><span class="eyebrow">${escapeHTML(c.fullName)}</span><h2 id="activityHistoryTitle">Relationship history</h2></div><button class="ui-icon-button close-activity-history" aria-label="Close relationship history">${icons.close}</button></header><div class="modal-body">${content}</div></section></div>`;
}

function communicationLogModal(id) {
  const c=state.contacts.find(contact=>contact.id===id); if(!c){ui.communicationContactId=null;return "";}
  const current=currentPipelineStage(c);
  const existing=c.conversations.find(log=>log.id===ui.communicationLogId);
  const type=existing?.communicationType||ui.communicationType||"Call";
  const outcomes=type==="Text"?TEXT_OUTCOMES:CALL_OUTCOMES;
  const selectedOutcome=existing?.outcome||outcomes[0];
  const heading=existing?`Edit ${type.toLowerCase()} log`:`Log ${type.toLowerCase()}`;
  const captureNote=type==="Text"?"Opening Messages does not confirm that a text was sent. Save the actual outcome after you return.":"Save the actual outcome so this relationship timeline stays useful.";
  const relationship=`<section class="capture-detail-person">${Avatar(c.fullName)}<span><strong>${escapeHTML(c.fullName)}</strong><small>${escapeHTML(current?`${c.role} · ${current}`:`${c.role} · No stage`)}</small></span></section>`;
  const activity=`<section class="capture-detail-section"><h3>What happened?</h3><div class="capture-detail-fields">${field("Date and time",`<input name="conversationDate" type="datetime-local" value="${dateTimeLocalValue(existing?.conversationDate||ui.communicationStartedAt||new Date())}" required>`)}${field("Direction",`<select name="direction">${COMMUNICATION_DIRECTIONS.map(direction=>`<option ${existing?.direction===direction?"selected":""}>${direction}</option>`).join("")}</select>`)}${type==="Call"?field("Duration (minutes)",`<input name="durationMinutes" type="number" min="0" step="1" inputmode="numeric" placeholder="Optional" value="${existing?.durationMinutes||""}">`):""}${field("Outcome",`<select name="outcome">${outcomes.map(outcome=>`<option ${selectedOutcome===outcome?"selected":""}>${outcome}</option>`).join("")}</select>`)}${field(type==="Text"?"What did you discuss?":"What did you talk about?",`<textarea name="notes" placeholder="Add ${type.toLowerCase()} notes">${escapeHTML(existing?.notes||"")}</textarea>`)}</div></section>`;
  const next=`<section class="capture-detail-section"><h3>What's next?</h3><div class="capture-detail-fields">${field("Follow-up date and time",'<input name="followUpDate" type="datetime-local">')}</div><details class="quick-capture-advanced"><summary><span>Pipeline and activity details</span>${icons.chevronDown}</summary><div>${ActivitySelector({hint:"Select either or both if they occurred during this interaction."})}${field("Current pipeline stage",`<div class="read-only-control">${escapeHTML(current||"No stage")}</div>`)}${field("Move to stage",`<select name="pipelineStage"><option value="">No change</option><option value="__clear">Clear pipeline stage</option>${PIPELINES[c.role].map(stage=>`<option value="${escapeHTML(stage)}">${escapeHTML(stage)}</option>`).join("")}</select>`)}</div></details></section>`;
  return `<div class="modal-backdrop call-log-backdrop capture-sheet-backdrop" id="communicationLogBackdrop" data-ui-sheet-backdrop><section class="modal call-log-modal capture-detail-sheet capture-sheet" role="dialog" aria-modal="true" aria-labelledby="communicationLogTitle" data-ui-sheet><header class="modal-head capture-detail-head capture-sheet-head" data-ui-sheet-drag-region><div><span class="eyebrow">Capture</span><h2 id="communicationLogTitle">${escapeHTML(heading)}</h2></div><button class="ui-icon-button close-communication-log" aria-label="Close">${icons.close}</button></header><div class="modal-body capture-sheet-body" data-ui-sheet-scroll><form id="communicationLogForm" class="call-log-form capture-detail-form"><input type="hidden" name="communicationType" value="${type}">${relationship}${activity}${next}<p class="capture-detail-note">${escapeHTML(captureNote)}</p></form></div><footer class="form-actions capture-detail-actions"><button class="button close-communication-log" type="button">Cancel</button><button class="button primary" type="submit" form="communicationLogForm">${icons.check}${existing?"Save changes":`Save ${type.toLowerCase()}`}</button></footer></section></div>`;
}

function clearContactEdit() { ui.contactEditing=false;ui.contactEditDirty=false; }
function discardContactEdit(onDiscard=null) {
  if(ui.contactEditing&&ui.contactEditDirty){requestConfirmation({title:"Discard unsaved changes?",message:"Your edits to this relationship will not be saved.",confirmLabel:"Discard changes",danger:true,onConfirm:()=>{clearContactEdit();onDiscard?.();}});return false;}
  clearContactEdit();
  return true;
}
function clearPersonalInfoDraft(){ui.personalInfoDirty=false;}
function discardPersonalInfoDraft(onDiscard=null){
  if(ui.personalInfoDirty){requestConfirmation({title:"Discard Personal Info changes?",message:"Your unsaved relationship details will not be kept.",confirmLabel:"Discard changes",danger:true,onConfirm:()=>{clearPersonalInfoDraft();onDiscard?.();}});return false;}
  clearPersonalInfoDraft();
  return true;
}
function closeContactDetail(onClose=null) {
  const close=()=>{clearContactEdit();clearPersonalInfoDraft();ui.detailId=null;ui.contactDetailTab="overview";ui.activityHistoryContactId=null;ui.activityFilter="All";ui.expandedLogIds.clear();onClose?.();};
  if(ui.personalInfoDirty){discardPersonalInfoDraft(close);return false;}
  if(ui.contactEditing&&ui.contactEditDirty){discardContactEdit(close);return false;}
  close();
  return true;
}

function bindCommonEvents(){
  $$('[data-presentation-back]').forEach(button=>button.addEventListener('click',presentationBack));
  $$('[data-page]').forEach(button=>button.addEventListener('click',()=>{const nextPage=button.dataset.page;if(nextPage==='add'){const open=()=>{quickCreateFocusReturn=button;ui.quickCreateOpen=true;ui.quickCreateMode=null;ui.quickCreateContactId="";render();};if(ui.contactEditing&&ui.contactEditDirty){discardContactEdit(open);return;}open();return;}navigateMain(nextPage,{mode:nextPage==="contacts"?"list":ui.contactMode,opener:button});}));
  $$('[data-open-people]').forEach(button=>button.addEventListener('click',()=>navigateMain("contacts",{mode:"list",opener:button})));
  $$('[data-open-pipeline]').forEach(button=>button.addEventListener('click',()=>{if(["No-Go","Archived"].includes(ui.visibilityFilter))ui.visibilityFilter="Active";navigateMain("contacts",{mode:"pipeline",role:ui.pipelineRole,opener:button});}));
  $('#quickCreateButton')?.addEventListener('click',()=>{const opener=document.activeElement;const open=()=>{quickCreateFocusReturn=opener;ui.quickCreateOpen=true;render();};if(ui.detailId){closeContactDetail(open);return;}open();});
  $$('[data-contact-id]').forEach(button=>button.addEventListener('click',()=>navigatePresentation("person",{person:button.dataset.contactId},{opener:button})));
  $$('[data-communication-contact-id]').forEach(link=>link.addEventListener('click',event=>{const contact=state.contacts.find(item=>item.id===link.dataset.communicationContactId);const type=link.dataset.communicationType||"Call";if(!contact||!canonicalPhone(contact.phoneNumber)){event.preventDefault();showToast('Add a valid phone number before using this action');return;}if(!startCommunication(contact.id,type))event.preventDefault();}));
  $$('[data-log-communication-contact-id]').forEach(button=>button.addEventListener('click',()=>openCommunicationLog(button.dataset.logCommunicationContactId,button.dataset.communicationType||"Call")));
  $('.close-modal')?.addEventListener('click',()=>{if(ui.detailId){closeContactDetail(closeSettings);return;}closeSettings();});
  $$('[data-open-achievements], #viewAchievements').forEach(button=>button.addEventListener('click',()=>navigatePresentation("achievements",{}, {opener:button})));
  $$('[data-open-goals]').forEach(button=>button.addEventListener('click',()=>navigatePresentation("goals",{}, {opener:button})));
  $('[data-open-analytics-detail], .insights-details > summary')?.addEventListener('click',event=>{if(ui.routedScreen==="analytics-detail")return;event.preventDefault();navigatePresentation("analytics-detail",{}, {opener:event.currentTarget});});
  $$('[data-settings-section-open]').forEach(button=>button.addEventListener('click',event=>{const section=button.dataset.settingsSectionOpen||"root";event.preventDefault();navigatePresentation("settings",{section},{opener:button});}));
  $('[data-open-scorecard-settings]')?.addEventListener('click',event=>{scorecardFocusReturn=event.currentTarget;ui.scorecardCreated=null;navigatePresentation("scorecard",{}, {opener:event.currentTarget});});
  $('#settingsBackdrop')?.addEventListener('click',event=>{if(event.target.id==='settingsBackdrop')closeSettings();});
  $('#contactBackdrop')?.addEventListener('click',event=>{if(event.target.id==='contactBackdrop')closeContactDetail(render);});
  $('#scorecardShareBackdrop')?.addEventListener('click',event=>{if(event.target.id==='scorecardShareBackdrop')closeScorecardShare();});
  document.onkeydown=event=>{
    if(ui.accountAction){
      if(event.key==="Escape"){event.preventDefault();closeAccountAction();return;}
      if(event.key!=="Tab")return;
      const focusable=accountActionFocusableElements();
      if(!focusable.length)return;
      const first=focusable[0],last=focusable.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      return;
    }
    if(ui.releaseNotesOpen){
      if(event.key==="Escape"){event.preventDefault();closeReleaseNotes();return;}
      if(event.key!=="Tab")return;
      const focusable=releaseFocusableElements();
      if(!focusable.length)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      return;
    }
    if(ui.quickCreateOpen){
      if(event.key==="Tab"){
        const focusable=quickCreateFocusableElements();
        if(!focusable.length)return;
        const first=focusable[0],last=focusable[focusable.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
        return;
      }
      if(event.key==="Escape"){event.preventDefault();closeQuickCreate();}
      return;
    }
    if(ui.settingsOpen){
      if(ui.routedScreen==="settings")return;
      if(event.key==="Escape"){event.preventDefault();closeSettings();return;}
      if(event.key!=="Tab")return;
      const focusable=settingsFocusableElements();
      if(!focusable.length)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      return;
    }
    if(ui.scorecardShareOpen&&ui.routedScreen!=="scorecard"){
      if(event.key==="Escape"){event.preventDefault();closeScorecardShare();return;}
      if(event.key!=="Tab")return;
      const focusable=scorecardFocusableElements();
      if(!focusable.length)return;
      const first=focusable[0],last=focusable.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      return;
    }
    if(event.key!=="Escape"||!(ui.quickCreateOpen||ui.communicationContactId||(ui.settingsOpen&&ui.routedScreen!=="settings")||(ui.achievementsOpen&&ui.routedScreen!=="achievements")||(ui.placeDetailId&&ui.routedScreen!=="place")||(ui.detailId&&!["person","person-edit"].includes(ui.routedScreen))||(ui.activityHistoryContactId&&ui.routedScreen!=="person-timeline")||(ui.scorecardShareOpen&&ui.routedScreen!=="scorecard")))return;
    if(ui.communicationContactId){ui.communicationContactId=null;ui.communicationStartedAt=null;ui.communicationLogId=null;clearPendingCommunication();render();return;}
    if(ui.activityHistoryContactId){ui.activityHistoryContactId=null;ui.activityFilter="All";ui.expandedLogIds.clear();render();return;}
    if(ui.scorecardShareOpen){closeScorecardShare();return;}
    if(ui.placeDetailId){ui.placeDetailId=null;render();return;}
    if(ui.detailId){closeContactDetail(()=>{ui.settingsOpen=false;ui.settingsExcludedDatesDraft=null;ui.settingsRestRulesDraft=null;ui.achievementsOpen=false;render();});return;}
    ui.settingsOpen=false;ui.settingsExcludedDatesDraft=null;ui.settingsRestRulesDraft=null;ui.achievementsOpen=false;render();
  };
}

function togglePipelineDisclosure(button, expandedStages, stage, sectionAttribute) {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const expanded=expandedStages.has(stage);
  const commit=()=>{if(expanded)expandedStages.delete(stage);else expandedStages.add(stage);render();};
  if(reduced){commit();return;}
  if(expanded){
    const body=button.closest(`[${sectionAttribute}]`)?.querySelector('.prospect-stage__body');
    if(!body){commit();return;}
    button.disabled=true;
    const animation=body.animate([{height:`${body.scrollHeight}px`,opacity:1},{height:'0px',opacity:0}],{duration:200,easing:'cubic-bezier(.4,0,1,1)',fill:'both'});
    animation.finished.catch(()=>{}).finally(commit);
    return;
  }
  commit();
  requestAnimationFrame(()=>{
    const section=$$(`[${sectionAttribute}]`).find(candidate=>candidate.getAttribute(sectionAttribute)===stage);
    const body=section?.querySelector('.prospect-stage__body');
    if(!body)return;
    const animation=body.animate([{height:'0px',opacity:0},{height:`${body.scrollHeight}px`,opacity:1}],{duration:240,easing:'cubic-bezier(.16,1,.3,1)'});
    animation.finished.catch(()=>{}).finally(()=>animation.cancel());
  });
}

const TODAY_SWIPE_INTENT_PX=8;

function completeTodayAction(contactId,followUpId) {
  const key=`${contactId}:${followUpId}`;
  if(todayActionLocks.has(key))return false;
  const record=findFollowUpRecord(contactId,followUpId);
  if(!record||!isScheduledFollowUp(record.followUp))return false;
  todayActionLocks.add(key);
  if(!transitionFollowUp(record.followUp,"completed")){todayActionLocks.delete(key);return false;}
  record.contact.updatedAt=nowISO();
  queueSave("Action completed");
  render();
  if(!matchMedia("(prefers-reduced-motion: reduce)").matches)requestAnimationFrame(()=>{
    const next=$(".today-home__next > :last-child");
    next?.animate([{opacity:.6,transform:"translateY(10px) scale(.99)"},{opacity:1,transform:"translateY(0) scale(1)"}],{duration:220,easing:"cubic-bezier(.16,1,.3,1)"});
  });
  setTimeout(()=>todayActionLocks.delete(key),600);
  return true;
}

function openTodayReschedule(actionId) {
  if(!actionId)return false;
  const [contactId,followUpId]=String(actionId).split(":");
  const record=findFollowUpRecord(contactId,followUpId);
  if(!record||!isScheduledFollowUp(record.followUp)||todayActionLocks.has(actionId))return false;
  todayActionLocks.add(actionId);
  ui.actionEditId=actionId;
  render();
  setTimeout(()=>todayActionLocks.delete(actionId),400);
  return true;
}

function bindTodaySwipeCard() {
  const shell=$("[data-today-swipe-card]");
  if(!shell)return;
  const surface=$(".today-next-card",shell);
  if(!surface)return;
  let gesture=null;
  let locked=false;
  let snapTimer=0;
  const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clearVisuals=()=>{
    shell.classList.remove("is-dragging","is-committing");
    shell.removeAttribute("data-swipe-direction");
    shell.style.removeProperty("--swipe-progress");
    surface.style.removeProperty("transform");
    surface.style.removeProperty("opacity");
    surface.style.removeProperty("transition");
  };
  const snapBack=()=>{
    if(locked)return;
    surface.style.transition=reduced?"none":"transform 320ms cubic-bezier(.16,1,.3,1), opacity 180ms ease-out";
    surface.style.transform="translate3d(0,0,0) rotate(0deg) scale(1)";
    surface.style.opacity="1";
    shell.style.setProperty("--swipe-progress","0");
    shell.classList.remove("is-dragging");
    clearTimeout(snapTimer);
    snapTimer=setTimeout(clearVisuals,reduced?0:330);
  };
  const finish=direction=>{
    if(locked)return;
    locked=true;
    shell.classList.remove("is-dragging");
    shell.classList.add("is-committing");
    shell.setAttribute("aria-busy","true");
    $$("button",surface).forEach(button=>{button.disabled=true;});
    shell.dataset.swipeDirection=direction;
    shell.style.setProperty("--swipe-progress","1");
    const sign=direction==="done"?-1:1;
    const distance=window.innerWidth+surface.getBoundingClientRect().width;
    surface.style.transition=reduced?"none":"transform 260ms cubic-bezier(.2,.8,.2,1), opacity 220ms ease-out";
    surface.style.transform=`translate3d(${sign*distance}px,0,0) rotate(${sign*7}deg) scale(.98)`;
    surface.style.opacity="0";
    setTimeout(()=>{
      if(direction==="done")completeTodayAction(shell.dataset.todayContactId,shell.dataset.followUpId);
      else openTodayReschedule(shell.dataset.actionId);
    },reduced?0:245);
  };
  surface.addEventListener("pointerdown",event=>{
    if(locked||event.button!==0||event.target.closest("button,a,input,select,textarea,summary,label"))return;
    clearTimeout(snapTimer);
    gesture={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,dx:0,dy:0,velocityX:0,width:Math.max(1,surface.getBoundingClientRect().width),axis:"",samples:[{x:event.clientX,t:event.timeStamp}]};
    try{surface.setPointerCapture(event.pointerId);}catch{}
  });
  surface.addEventListener("pointermove",event=>{
    if(!gesture||event.pointerId!==gesture.pointerId||locked)return;
    const dx=event.clientX-gesture.startX,dy=event.clientY-gesture.startY;
    if(!gesture.axis&&Math.max(Math.abs(dx),Math.abs(dy))>=TODAY_SWIPE_INTENT_PX)gesture.axis=Math.abs(dx)>Math.abs(dy)*1.15?"horizontal":"vertical";
    if(gesture.axis!=="horizontal")return;
    event.preventDefault();
    gesture.samples.push({x:event.clientX,t:event.timeStamp});
    gesture.samples=gesture.samples.filter(sample=>sample.t>=event.timeStamp-80);
    const oldest=gesture.samples[0],elapsed=Math.max(1,event.timeStamp-oldest.t);
    gesture.velocityX=(event.clientX-oldest.x)/elapsed;
    gesture.dx=dx;gesture.dy=dy;
    const width=gesture.width;
    const threshold=Math.min(120,Math.max(84,width*.28));
    const progress=Math.min(1,Math.abs(dx)/threshold);
    const rotation=Math.max(-5,Math.min(5,dx/width*7));
    surface.style.transition="none";
    surface.style.transform=`translate3d(${dx}px,0,0) rotate(${rotation}deg) scale(${1-progress*.015})`;
    shell.dataset.swipeDirection=dx<0?"done":"reschedule";
    shell.style.setProperty("--swipe-progress",String(progress));
    shell.classList.add("is-dragging");
  });
  const endGesture=event=>{
    if(!gesture||event.pointerId!==gesture.pointerId||locked)return;
    const current=gesture;gesture=null;
    try{surface.releasePointerCapture(event.pointerId);}catch{}
    const direction=todaySwipeDecision({dx:current.dx,dy:current.dy,velocityX:current.velocityX,width:current.width});
    if(direction)finish(direction);else snapBack();
  };
  surface.addEventListener("pointerup",endGesture);
  surface.addEventListener("pointercancel",event=>{if(!gesture||event.pointerId!==gesture.pointerId)return;gesture=null;snapBack();});
  surface.addEventListener("lostpointercapture",event=>{if(!gesture||event.pointerId!==gesture.pointerId||locked)return;gesture=null;snapBack();});
}

function bindPageEvents(){
  $('#settingsButton')?.addEventListener('click',()=>{settingsFocusReturn=document.activeElement;ui.settingsExcludedDatesDraft=[...normalizeExcludedDates(state.settings.streakExcludedDates)];ui.settingsRestRulesDraft=normalizeRestRules(state.settings.streakRestRules);ui.settingsRestFrequencyDraft="once";ui.accountPanelLoaded=false;ui.accountPanelError="";navigatePresentation("settings",{section:"root"},{opener:settingsFocusReturn});refreshAccountPanelData().catch(()=>{});});
  $('#shareScorecard')?.addEventListener('click',()=>{scorecardFocusReturn=document.activeElement;ui.scorecardCreated=null;navigatePresentation("scorecard",{}, {opener:scorecardFocusReturn});});
  $$('[data-insights-pipeline]').forEach(button=>button.addEventListener('click',()=>{const role=button.dataset.insightsPipeline;if(!["Prospect","Customer"].includes(role))return;navigateMain("contacts",{mode:"pipeline",role,opener:button});}));
  $('[data-insights-places]')?.addEventListener('click',event=>navigateMain("contacts",{mode:"places",opener:event.currentTarget}));
  $$('[data-insights-place-id]').forEach(button=>button.addEventListener('click',()=>{const place=state.places.find(item=>String(item.id)===String(button.dataset.insightsPlaceId));if(!place)return;navigatePresentation("place",{place:place.id},{opener:button});}));
  $$('[data-open-people-filters]').forEach(button=>button.addEventListener('click',()=>{ui.peopleFiltersOpen=true;render();}));
  $$('[data-people-quick]').forEach(button=>button.addEventListener('click',()=>{ui.peopleQuick=button.dataset.peopleQuick||"All";render();}));
  $$('[data-people-contact-mode]').forEach(button=>button.addEventListener('click',()=>{const nextMode=button.dataset.peopleContactMode||"list";if(nextMode==="pipeline"&&["No-Go","Archived"].includes(ui.visibilityFilter))ui.visibilityFilter="Active";ui.peopleFiltersOpen=false;navigateMain("contacts",{mode:nextMode,role:ui.pipelineRole,opener:button});}));
  $$('[data-place-detail-id]').forEach(button=>button.addEventListener('click',()=>{const place=state.places.find(item=>String(item.id)===String(button.dataset.placeDetailId));if(!place)return;navigatePresentation("place",{place:place.id},{opener:button});}));
  $('#placeDetailSheet [data-ui-dialog]')?.addEventListener('bridge:dialogclose',()=>{ui.placeDetailId=null;});
  $$('[data-people-role]').forEach(button=>button.addEventListener('click',()=>{ui.roleFilter=button.dataset.peopleRole||"All Roles";ui.peopleQuick="All";render();}));
  $('#peopleSort')?.addEventListener('change',event=>{ui.sort=event.target.value;ui.peopleQuick="All";render();});
  $('#peopleVisibility')?.addEventListener('change',event=>{ui.visibilityFilter=event.target.value;if(["No-Go","Archived"].includes(ui.visibilityFilter))ui.peopleQuick="All";render();});
  $$('[data-people-reset]').forEach(button=>button.addEventListener('click',()=>{ui.peopleQuick="All";ui.roleFilter="All Roles";ui.visibilityFilter="Active";ui.healthBandFilter="All";ui.healthTrendFilter="All";ui.actionCoverageFilter="All";ui.recencyFilter="All";ui.pipelineStageFilter="All";ui.interestFilter="All";ui.judgementFilter="All";ui.placeFilter="All";ui.followUpFilter="All";ui.conversationFrom="";ui.conversationTo="";ui.sort="recentContact";render();}));
  $$('[data-people-filter-close]').forEach(button=>button.addEventListener('click',()=>{ui.peopleFiltersOpen=false;render();}));
  $('#peopleFilterSheet [data-ui-dialog]')?.addEventListener('bridge:dialogclose',()=>{ui.peopleFiltersOpen=false;});
  $$('[data-pipeline-role]').forEach(button=>button.addEventListener('click',()=>{const role=button.dataset.pipelineRole;if(!["Prospect","Customer"].includes(role)||ui.pipelineRole===role)return;navigateMain("contacts",{mode:"pipeline",role,replace:true,opener:button});}));
  $$('[data-prospect-stage-toggle]').forEach(button=>button.addEventListener('click',()=>{const stage=button.dataset.prospectStageToggle;if(!PIPELINES.Prospect.includes(stage))return;togglePipelineDisclosure(button,ui.pipelineExpandedStages,stage,'data-prospect-stage');}));
  $$('[data-prospect-stage-open]').forEach(button=>button.addEventListener('click',()=>{const stage=button.dataset.prospectStageOpen;if(!PIPELINES.Prospect.includes(stage))return;navigatePresentation("pipeline-stage",{role:"Prospect",stage},{opener:button});}));
  $$('[data-prospect-pipeline-contact]').forEach(button=>button.addEventListener('click',()=>{const contact=state.contacts.find(item=>String(item.id)===String(button.dataset.prospectPipelineContact));if(!contact||contact.role!=="Prospect")return;navigatePresentation("stage-transition",{role:"Prospect",person:contact.id},{opener:button});}));
  $('#prospectStageDetailSheet [data-ui-dialog]')?.addEventListener('bridge:dialogclose',()=>{ui.pipelineStageDetail=null;});
  $('#prospectTransitionSheet [data-ui-dialog]')?.addEventListener('bridge:dialogclose',()=>{ui.pipelineContactId=null;});
  $('#prospectStageTransitionForm')?.addEventListener('submit',event=>{event.preventDefault();const form=new FormData(event.currentTarget);const contact=state.contacts.find(item=>String(item.id)===String(event.currentTarget.dataset.prospectContactId));const selected=String(form.get('pipelineStage')||'');if(!contact||contact.role!=="Prospect"||(selected&&!PIPELINES.Prospect.includes(selected)))return;const changed=setPipelineStage(contact,selected,nowISO(),"prospect-pipeline");contact.updatedAt=nowISO();const routed=ui.routedScreen==="stage-transition";if(!routed)ui.pipelineContactId=null;if(selected)ui.pipelineExpandedStages.add(selected);if(changed)queueSave(selected?`Moved to ${selected}`:'Removed from Prospect pipeline');if(routed)presentationBack();else render();if(!changed)showToast('Stage unchanged');});
  $$('[data-prospect-view-contact]').forEach(button=>button.addEventListener('click',()=>{const contact=state.contacts.find(item=>String(item.id)===String(button.dataset.prospectViewContact));if(!contact)return;navigatePresentation("person",{person:contact.id},{opener:button});}));
  $$('[data-customer-stage-toggle]').forEach(button=>button.addEventListener('click',()=>{const stage=button.dataset.customerStageToggle;if(!PIPELINES.Customer.includes(stage))return;togglePipelineDisclosure(button,ui.customerPipelineExpandedStages,stage,'data-customer-stage');}));
  $$('[data-customer-stage-open]').forEach(button=>button.addEventListener('click',()=>{const stage=button.dataset.customerStageOpen;if(!PIPELINES.Customer.includes(stage))return;navigatePresentation("pipeline-stage",{role:"Customer",stage},{opener:button});}));
  $$('[data-customer-pipeline-contact]').forEach(button=>button.addEventListener('click',()=>{const contact=state.contacts.find(item=>String(item.id)===String(button.dataset.customerPipelineContact));if(!contact||contact.role!=="Customer")return;navigatePresentation("stage-transition",{role:"Customer",person:contact.id},{opener:button});}));
  $('#customerStageDetailSheet [data-ui-dialog]')?.addEventListener('bridge:dialogclose',()=>{ui.customerPipelineStageDetail=null;});
  $('#customerTransitionSheet [data-ui-dialog]')?.addEventListener('bridge:dialogclose',()=>{ui.customerPipelineContactId=null;});
  $('#customerStageTransitionForm')?.addEventListener('submit',event=>{event.preventDefault();const form=new FormData(event.currentTarget);const contact=state.contacts.find(item=>String(item.id)===String(event.currentTarget.dataset.customerContactId));const selected=String(form.get('pipelineStage')||'');if(!contact||contact.role!=="Customer"||(selected&&!PIPELINES.Customer.includes(selected)))return;const changed=setPipelineStage(contact,selected,nowISO(),"customer-pipeline");contact.updatedAt=nowISO();const routed=ui.routedScreen==="stage-transition";if(!routed)ui.customerPipelineContactId=null;if(selected)ui.customerPipelineExpandedStages.add(selected);if(changed)queueSave(selected?`Moved to ${selected}`:'Removed from Customer pipeline');if(routed)presentationBack();else render();if(!changed)showToast('Stage unchanged');});
  $$('[data-customer-view-contact]').forEach(button=>button.addEventListener('click',()=>{const contact=state.contacts.find(item=>String(item.id)===String(button.dataset.customerViewContact));if(!contact)return;navigatePresentation("person",{person:contact.id},{opener:button});}));
  $$('[data-contact-mode]').forEach(button=>button.addEventListener('click',()=>{const nextMode=button.dataset.contactMode;if(ui.contactMode===nextMode)return;if(nextMode==="pipeline"&&["No-Go","Archived"].includes(ui.visibilityFilter))ui.visibilityFilter="Active";ui.contactMode=nextMode;render();}));
  $$('[data-network-filter]').forEach(button=>{
    const apply=()=>{if(button.getAttribute('aria-disabled')==='true')return;ui.networkEntityFilter=button.dataset.networkFilter||"all";ui.networkSelectedNodeId="you";render();};
    button.addEventListener('click',apply);
    button.addEventListener('keydown',event=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;const options=$$('[data-network-filter]').filter(item=>item.getAttribute('aria-disabled')!=="true");const current=options.indexOf(button);const next=event.key==="Home"?options[0]:event.key==="End"?options.at(-1):options[(current+(event.key==="ArrowRight"?1:-1)+options.length)%options.length];if(!next)return;event.preventDefault();next.click();requestAnimationFrame(()=>document.querySelector(`[data-network-filter="${next.dataset.networkFilter}"]`)?.focus());});
  });
  $$('[data-network-node-id]').forEach(node=>{
    const select=(restoreFocus=false)=>{const id=node.dataset.networkNodeId||"you";ui.networkSelectedNodeId=id;render();if(restoreFocus)requestAnimationFrame(()=>document.querySelector(`[data-network-node-id="${CSS.escape(id)}"]`)?.focus());};
    node.addEventListener('click',()=>select(false));
    node.addEventListener('keydown',event=>{if(event.key!=="Enter"&&event.key!==" ")return;event.preventDefault();select(true);});
  });
  $('#contactSearch')?.addEventListener('focus',event=>{
    if(suppressPeopleSearchRouteOnce){suppressPeopleSearchRouteOnce=false;return;}
    if(ui.routedScreen!=="people-search")navigatePresentation("people-search",{}, {opener:event.currentTarget});
  });
  $('#contactSearch')?.addEventListener('input',event=>{ui.search=event.target.value;const cursor=event.target.selectionStart;clearTimeout(searchRenderTimer);searchRenderTimer=setTimeout(()=>{if(ui.routedScreen==="people-search"&&refreshPeopleSearchResults(cursor))return;render();const input=$('#contactSearch');input?.focus();input?.setSelectionRange(cursor,cursor);},100);});
  $$('[data-clear-people-search]').forEach(button=>button.addEventListener('click',()=>{ui.search="";clearTimeout(searchRenderTimer);const input=$('#contactSearch');if(input)input.value="";if(!refreshPeopleSearchResults(0)){render();requestAnimationFrame(()=>$('#contactSearch')?.focus());}}));
  $('#roleFilter')?.addEventListener('change',event=>{ui.roleFilter=event.target.value;render();});
  $('#visibilityFilter')?.addEventListener('change',event=>{ui.visibilityFilter=event.target.value;if(["No-Go","Archived"].includes(ui.visibilityFilter))ui.contactMode="list";render();});
  $('#healthBandFilter')?.addEventListener('change',event=>{ui.healthBandFilter=event.target.value;render();});
  $('#healthTrendFilter')?.addEventListener('change',event=>{ui.healthTrendFilter=event.target.value;render();});
  $('#actionCoverageFilter')?.addEventListener('change',event=>{ui.actionCoverageFilter=event.target.value;render();});
  $('#recencyFilter')?.addEventListener('change',event=>{ui.recencyFilter=event.target.value;render();});
  $('#peoplePipelineStage')?.addEventListener('change',event=>{ui.pipelineStageFilter=event.target.value;render();});
  $('#peopleInterest')?.addEventListener('change',event=>{ui.interestFilter=event.target.value;render();});
  $('#peopleJudgement')?.addEventListener('change',event=>{ui.judgementFilter=event.target.value;render();});
  $('#peoplePlace')?.addEventListener('change',event=>{ui.placeFilter=event.target.value;render();});
  $('#peopleFollowUp')?.addEventListener('change',event=>{ui.followUpFilter=event.target.value;render();});
  $('#conversationFrom')?.addEventListener('change',event=>{ui.conversationFrom=event.target.value;if(ui.conversationTo&&ui.conversationFrom>ui.conversationTo)ui.conversationTo=ui.conversationFrom;render();});
  $('#conversationTo')?.addEventListener('change',event=>{ui.conversationTo=event.target.value;if(ui.conversationFrom&&ui.conversationTo<ui.conversationFrom)ui.conversationFrom=ui.conversationTo;render();});
  $('#clearConversationDates')?.addEventListener('click',()=>{ui.conversationFrom='';ui.conversationTo='';render();});
  $('#sortContacts')?.addEventListener('change',event=>{ui.sort=event.target.value;render();});
  $('#followUpView')?.addEventListener('change',event=>{ui.actionView=event.target.value==="completed"?"completed":"open";ui.actionEditId=null;render();});
  $$('[data-action-view]').forEach(button=>button.addEventListener('click',()=>{ui.actionView=button.dataset.actionView;ui.actionEditId=null;render();}));
  $('#followUpRescheduleSheet [data-ui-dialog]')?.addEventListener('bridge:dialogclose',()=>{ui.actionEditId=null;});
  bindTodaySwipeCard();
  $$('.today-reschedule-action').forEach(button=>button.addEventListener('click',()=>openTodayReschedule(button.dataset.actionId)));
  $$('.today-complete-action').forEach(button=>button.addEventListener('click',()=>completeTodayAction(button.dataset.todayContactId,button.dataset.followUpId)));
  $$('.edit-action').forEach(button=>button.addEventListener('click',()=>{ui.actionEditId=ui.actionEditId===button.dataset.actionId?null:button.dataset.actionId;render();}));
  $$('.cancel-action-edit').forEach(button=>button.addEventListener('click',()=>{ui.actionEditId=null;render();}));
  $$('.action-edit-form').forEach(form=>form.addEventListener('submit',event=>{event.preventDefault();const record=findFollowUpRecord(form.dataset.followupContactId||form.dataset.contactId,form.dataset.followUpId);if(!record)return;const data=new FormData(form);const dueDate=String(data.get('dueDate')||'');const note=String(data.get('note')||'').trim()||'Follow up';if(!dueDate)return;const changed=rescheduleFollowUp(record.followUp,dueDate);if(record.followUp.note!==note){record.followUp.note=note;record.followUp.updatedAt=nowISO();}record.contact.updatedAt=nowISO();ui.actionEditId=null;queueSave(changed?'Action rescheduled':'Action updated');render();}));
  $$('.complete-action').forEach(button=>button.addEventListener('click',()=>{const record=findFollowUpRecord(button.dataset.followupContactId||button.dataset.contactId,button.dataset.followUpId);if(!record||!transitionFollowUp(record.followUp,'completed'))return;record.contact.updatedAt=nowISO();queueSave('Action completed');render();}));
  $$('[data-followup-delete]').forEach(button=>button.addEventListener('click',()=>{const record=findFollowUpRecord(button.dataset.followupContactId||button.dataset.contactId,button.dataset.followUpId);if(!record)return;requestConfirmation({title:'Delete this action?',message:'Its history will remain available for analytics.',confirmLabel:'Delete action',danger:true,onConfirm:()=>{transitionFollowUp(record.followUp,'deleted');record.contact.updatedAt=nowISO();if(ui.actionEditId===`${record.contact.id}:${record.followUp.id}`)ui.actionEditId=null;queueSave('Action deleted');render();}});}));
  const conversationForm=$('#addContactForm');
  restoreConversationDraft(conversationForm);
  $('#newRole')?.addEventListener('change',event=>{updateNewRoleFields(event.target.value);captureConversationDraft(conversationForm);updateConversationReview(conversationForm);});
  conversationForm?.addEventListener('input',()=>{captureConversationDraft(conversationForm);updateConversationReview(conversationForm);});
  conversationForm?.addEventListener('change',()=>{captureConversationDraft(conversationForm);updateConversationReview(conversationForm);});
  if(conversationForm){
    $$('[data-conversation-step-target]',conversationForm).forEach(button=>button.addEventListener('click',()=>setConversationStep(conversationForm,Number(button.dataset.conversationStepTarget))));
    $$('[data-conversation-next]',conversationForm).forEach(button=>button.addEventListener('click',()=>setConversationStep(conversationForm,ui.conversationStep+1)));
    $$('[data-conversation-back]',conversationForm).forEach(button=>button.addEventListener('click',()=>setConversationStep(conversationForm,ui.conversationStep-1,{validate:false})));
  }
  conversationForm?.addEventListener('submit',event=>{if(!validateConversationStudio(conversationForm)){event.preventDefault();return;}handleAddContact(event);});
  updateConversationReview(conversationForm);
  $$('[data-range]').forEach(button=>button.addEventListener('click',()=>{ui.analyticsRange=button.dataset.range;if(ui.analyticsRange==='custom'&&!ui.analyticsCustomStart){ui.analyticsCustomStart=ui.analyticsAnchor;ui.analyticsCustomEnd=ui.analyticsAnchor;}render();}));
  $('.analytics-segmented')?.addEventListener('keydown',event=>{const modes=["day","week","month","custom"],current=modes.indexOf(ui.analyticsRange);let next=current;if(event.key==="ArrowRight"||event.key==="ArrowDown")next=(current+1)%modes.length;else if(event.key==="ArrowLeft"||event.key==="ArrowUp")next=(current+modes.length-1)%modes.length;else if(event.key==="Home")next=0;else if(event.key==="End")next=modes.length-1;else return;event.preventDefault();ui.analyticsRange=modes[next];render();requestAnimationFrame(()=>document.querySelector(`[data-range="${modes[next]}"]`)?.focus());});
  $('.analytics-period-previous')?.addEventListener('click',()=>{shiftAnalyticsPeriod(-1);render();});
  $('.analytics-period-next')?.addEventListener('click',()=>{shiftAnalyticsPeriod(1);render();});
  $('#analyticsAnchor')?.addEventListener('change',event=>{ui.analyticsAnchor=event.target.value;render();});
  $('#analyticsMonth')?.addEventListener('change',event=>{if(event.target.value)ui.analyticsAnchor=`${event.target.value}-01`;render();});
  $('#analyticsCustomStart')?.addEventListener('change',event=>{ui.analyticsCustomStart=event.target.value||ui.analyticsAnchor;if(ui.analyticsCustomEnd<ui.analyticsCustomStart)ui.analyticsCustomEnd=ui.analyticsCustomStart;render();});
  $('#analyticsCustomEnd')?.addEventListener('change',event=>{ui.analyticsCustomEnd=event.target.value||ui.analyticsCustomStart;if(ui.analyticsCustomEnd<ui.analyticsCustomStart)ui.analyticsCustomStart=ui.analyticsCustomEnd;render();});
}

function messageScorecard(url) {
  const body = encodeURIComponent(url);
  location.href = `sms:?&body=${body}`;
}

function scorecardSnapshot({ includeContacts = ui.scorecardIncludeContacts } = {}) {
  const data = analyticsScorecardData();
  const contacts = includeContacts ? sharedContactsForRange(data.newContacts) : [];
  const ownerName = state.settings.firstName || state.settings.name || "Bridge";
  return createSnapshot({ ownerName, range: data.range, metrics: data.metrics, includeContacts, contacts });
}

function drawRoundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function drawScorecardIcon(context, name, x, y, size, color) {
  const scale = size / 24;
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  if (name === "chart") {
    context.moveTo(3, 3); context.lineTo(3, 21); context.lineTo(21, 21);
    context.moveTo(7, 16); context.lineTo(7, 11);
    context.moveTo(12, 16); context.lineTo(12, 7);
    context.moveTo(17, 16); context.lineTo(17, 13);
  } else if (name === "contactCard") {
    context.roundRect(3, 3, 18, 18, 3);
    context.moveTo(12, 16); context.arc(9, 16, 3.5, 0, Math.PI, true);
    context.moveTo(11.5, 9); context.arc(9, 9, 2.5, 0, Math.PI * 2);
    context.moveTo(15, 8); context.lineTo(18, 8);
    context.moveTo(15, 12); context.lineTo(18, 12);
    context.moveTo(15, 16); context.lineTo(17, 16);
  } else if (name === "people") {
    context.moveTo(2, 21); context.lineTo(2, 19); context.arc(9, 19, 4, Math.PI, 0);
    context.moveTo(13, 7); context.arc(9, 7, 4, 0, Math.PI * 2);
    context.moveTo(16, 3.2); context.arc(16, 7, 3.8, -1.35, 1.35);
    context.moveTo(18.7, 15.2); context.arc(19, 19, 4, -1.35, 0);
  } else {
    context.arc(12, 12, 10, 0, Math.PI * 2);
    context.moveTo(18, 12); context.arc(12, 12, 6, 0, Math.PI * 2);
    context.moveTo(14, 12); context.arc(12, 12, 2, 0, Math.PI * 2);
  }
  context.stroke();
  context.restore();
}

function scorecardPreviewPNG(scorecard, { format = "preview" } = {}) {
  const isImage = format === "image";
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = isImage ? 1200 : 630;
  const context = canvas.getContext("2d");
  if (!context) return "";
  const background = "#f5f2ec";
  const surface = "#ffffff";
  const foreground = "#1b1913";
  const secondary = "#4b463c";
  const line = "#e4dfd4";
  const accent = "#0e6b5c";
  const accentRGB = "14,107,92";
  const iconSurface = `rgba(${accentRGB},.13)`;
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = foreground;
  context.font = `${isImage ? "760 54px" : "760 42px"} -apple-system, BlinkMacSystemFont, sans-serif`;
  context.fillText("Bridge Scorecard", isImage ? 52 : 58, isImage ? 76 : 60);
  context.fillStyle = secondary;
  context.font = `${isImage ? "500 30px" : "500 24px"} -apple-system, BlinkMacSystemFont, sans-serif`;
  context.fillText(scorecard.periodLabel, isImage ? 52 : 58, isImage ? 118 : 96);
  const cards = [
    ["chart", "Conversations", scorecard.metrics.conversations],
    ["contactCard", "Contacts", scorecard.metrics.contacts],
    ["people", "Prospects", scorecard.metrics.prospects],
    ["target", "Prospective Customers", scorecard.metrics.prospectiveCustomers]
  ];
  const outerX = isImage ? 52 : 58;
  const columnGap = isImage ? 30 : 28;
  const rowGap = isImage ? 30 : 20;
  const cardWidth = (canvas.width - outerX * 2 - columnGap) / 2;
  const cardTop = isImage ? 154 : 126;
  const cardHeight = isImage ? 476 : 232;
  const cardRadius = isImage ? 38 : 30;
  const cardPadding = isImage ? 38 : 28;
  const iconSize = isImage ? 108 : 70;
  const iconGlyph = isImage ? 52 : 34;
  cards.forEach(([iconName, label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = outerX + column * (cardWidth + columnGap);
    const y = cardTop + row * (cardHeight + rowGap);
    context.save();
    context.shadowColor = dark ? "rgba(0,0,0,.24)" : "rgba(25,35,47,.07)";
    context.shadowBlur = isImage ? 28 : 18;
    context.shadowOffsetY = isImage ? 10 : 6;
    context.fillStyle = surface;
    drawRoundedRect(context, x, y, cardWidth, cardHeight, cardRadius);
    context.fill();
    context.restore();
    context.strokeStyle = line;
    context.lineWidth = 2;
    drawRoundedRect(context, x, y, cardWidth, cardHeight, cardRadius);
    context.stroke();
    const iconX = x + cardPadding;
    const iconY = y + cardPadding;
    context.fillStyle = iconSurface;
    drawRoundedRect(context, iconX, iconY, iconSize, iconSize, isImage ? 30 : 20);
    context.fill();
    drawScorecardIcon(
      context,
      iconName,
      iconX + (iconSize - iconGlyph) / 2,
      iconY + (iconSize - iconGlyph) / 2,
      iconGlyph,
      accent
    );
    context.fillStyle = foreground;
    context.font = `${isImage ? "760 86px" : "760 54px"} -apple-system, BlinkMacSystemFont, sans-serif`;
    context.fillText(String(value), x + cardPadding, y + (isImage ? 322 : 174));
    context.fillStyle = secondary;
    context.font = `${isImage ? "500 44px" : "500 27px"} -apple-system, BlinkMacSystemFont, sans-serif`;
    if (label === "Prospective Customers" && isImage) {
      context.fillText("Prospective", x + cardPadding, y + 392);
      context.fillText("Customers", x + cardPadding, y + 446);
    } else {
      context.fillText(label, x + cardPadding, y + (isImage ? 406 : 212));
    }
  });
  return canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
}

function scorecardImageFile(scorecard) {
  const base64 = scorecardPreviewPNG(scorecard, { format: "image" });
  if (!base64) throw new Error("Bridge could not prepare the scorecard image");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const rangeName = String(scorecard.periodLabel || "scorecard")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return new File([bytes], `bridge-scorecard-${rangeName || "scorecard"}.png`, { type: "image/png" });
}

async function shareScorecardImage() {
  const scorecard = scorecardSnapshot({ includeContacts: false });
  const file = scorecardImageFile(scorecard);
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: "Bridge Scorecard" });
    return true;
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Scorecard image downloaded");
  return true;
}

async function createScorecardLink() {
  const snapshot = scorecardSnapshot();
  const previewPNG = scorecardPreviewPNG(snapshot);
  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ scorecard: snapshot, previewPNG })
  };
  if (accountModeActive()) {
    const result = await accountClient.request("/api/scorecards", options);
    return { snapshot, ...result };
  }
  const response = await apiFetch("/api/scorecards", options);
  const contentType = response.headers.get("content-type") || "";
  const result = contentType.includes("application/json") ? await response.json().catch(() => ({})) : {};
  if (!response.ok) throw new Error(result.error || "Secure scorecards require the hosted Bridge app.");
  return { snapshot, ...result };
}

async function revokeScorecardLink(created) {
  if(!created?.token)throw new Error("Scorecard link unavailable");
  const path=`/api/scorecards/${encodeURIComponent(created.token)}`;
  if(accountModeActive())return accountClient.request(path,{method:"DELETE"});
  if(!created.managementToken)throw new Error("This scorecard can no longer be managed from this device");
  const response=await apiFetch(path,{method:"DELETE",headers:{Authorization:`Bearer ${created.managementToken}`,Accept:"application/json"}});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.error||"Bridge could not revoke this scorecard link");
  return result;
}

function bindScorecardShareEvents() {
  $$(".close-scorecard-share").forEach(button => button.addEventListener("click", closeScorecardShare));
  $("#scorecardShareForm")?.addEventListener("change", event => {
    const form = event.currentTarget;
    ui.scorecardIncludeContacts = form.scorecardScope.value === "contacts";
    render();
  });
  $("#scorecardShareForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const action = event.submitter?.value === "image" ? "image" : "link";
    const form = new FormData(event.currentTarget);
    ui.scorecardIncludeContacts = form.get("scorecardScope") === "contacts";
    ui.scorecardShareBusy = true;
    render();
    try {
      if (action === "image") {
        await shareScorecardImage();
        closeScorecardShare();
        return;
      } else {
        const created = await createScorecardLink();
        ui.scorecardCreated=created;
        ui.scorecardShareBusy=false;
        render();
        requestAnimationFrame(()=>$("#messageScorecardLink")?.focus());
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
      showToast(error?.message || "Bridge could not create a secure scorecard link");
    } finally {
      ui.scorecardShareBusy = false;
      render();
    }
  });
  $("#messageScorecardLink")?.addEventListener("click",()=>{if(ui.scorecardCreated?.url)messageScorecard(ui.scorecardCreated.url);});
  $("#createAnotherScorecard")?.addEventListener("click",()=>{ui.scorecardCreated=null;render();requestAnimationFrame(()=>$("#scorecardShareForm input")?.focus());});
  $("#revokeScorecardLink")?.addEventListener("click",()=>{
    if(ui.scorecardShareBusy||!ui.scorecardCreated)return;
    const scorecard=ui.scorecardCreated;
    requestConfirmation({title:"Revoke this scorecard link?",message:"Anyone with the link will lose access.",confirmLabel:"Revoke link",danger:true,onConfirm:async()=>{
      ui.scorecardShareBusy=true;render();
      try{await revokeScorecardLink(scorecard);ui.scorecardCreated={...scorecard,revoked:true};ui.scorecardShareBusy=false;render();showToast("Scorecard link revoked");}
      catch(error){ui.scorecardShareBusy=false;render();showToast(error?.message||"Bridge could not revoke this scorecard link");}
    }});
  });
}

function updateNewRoleFields(role) {
  const isTeam = role === "Team";
  $$('[data-role-fit-field]').forEach(field => { field.hidden = isTeam; });
  const pipelineSection = $('#newPipelineSection');
  const teamNote = $('#newTeamPipelineNote');
  if (pipelineSection) pipelineSection.hidden = isTeam;
  if (teamNote) teamNote.hidden = !isTeam;
  const container = $('#newPipelineChecks');
  if (container) container.innerHTML = roleStageChecks(role);
}

function setConversationStep(form, target, { validate=true }={}) {
  if (!form) return false;
  const steps=$$('[data-conversation-step]',form);
  const next=Math.max(0,Math.min(steps.length-1,Number(target)||0));
  if(validate&&next>ui.conversationStep){
    const invalid=steps.slice(0,next).flatMap(step=>$$('input, select, textarea',step)).find(control=>!control.checkValidity());
    if(invalid){
      const invalidStep=invalid.closest('[data-conversation-step]');
      ui.conversationStep=Number(invalidStep?.dataset.conversationStep)||0;
      steps.forEach((step,index)=>step.dataset.active=String(index===ui.conversationStep));
      $$('[data-conversation-step-target]',form).forEach((button,index)=>button.setAttribute('aria-current',index===ui.conversationStep?'step':'false'));
      invalid.focus();
      invalid.reportValidity();
      return false;
    }
  }
  captureConversationDraft(form);
  ui.conversationStep=next;
  steps.forEach((step,index)=>step.dataset.active=String(index===next));
  $$('[data-conversation-step-target]',form).forEach((button,index)=>button.setAttribute('aria-current',index===next?'step':'false'));
  steps[next]?.querySelector('h2')?.focus({preventScroll:true});
  steps[next]?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  return true;
}

function validateConversationStudio(form) {
  const invalid=$$('input, select, textarea',form).find(control=>!control.checkValidity());
  if(!invalid)return true;
  const invalidStep=invalid.closest('[data-conversation-step]');
  setConversationStep(form,Number(invalidStep?.dataset.conversationStep)||0,{validate:false});
  invalid.focus();
  invalid.reportValidity();
  return false;
}

function updateConversationReview(form) {
  if (!form) return;
  const data = new FormData(form);
  const value = name => String(data.get(name) || "").trim();
  const write = (key, text) => { const target=form.querySelector(`[data-conversation-review="${key}"]`); if(target)target.textContent=text; };
  const placeSelect=form.elements.placeId;
  const savedPlace=value("placeId") ? String(placeSelect?.selectedOptions?.[0]?.textContent || "").trim() : "";
  const newPlace=value("newPlaceName");
  const date=value("conversationDate");
  const conversation=[date?fmtDate(`${date}T12:00:00`):"Date needed",value("conversationType")||"Conversation type needed"].join(" · ");
  const nextActions=[];
  if(value("followUpDate"))nextActions.push(`Follow-up ${fmtDateTime(value("followUpDate"))}`);
  if(value("checkBackDate"))nextActions.push(`Check back ${fmtDateTime(value("checkBackDate"))}`);
  write("person",value("fullName")||"Add a full name");
  write("role",value("role")||"Prospect");
  write("conversation",conversation);
  write("place",newPlace||savedPlace||"No place selected");
  write("next-action",nextActions.join(" · ")||"No follow-up scheduled");
}

function captureConversationDraft(form) {
  if (!form) return;
  const draft = {};
  for (const element of form.elements) {
    if (!element.name) continue;
    if (element.type === "checkbox") draft[element.name] = element.checked;
    else if (element.type === "radio") { if (element.checked) draft[element.name] = element.value; }
    else draft[element.name] = element.value;
  }
  conversationDraft = draft;
  conversationDraftDirty = true;
}

function restoreConversationDraft(form) {
  if (!form || !conversationDraft) return;
  const role = String(conversationDraft.role || form.elements.role?.value || "Prospect");
  if (form.elements.role) form.elements.role.value = role;
  updateNewRoleFields(role);
  for (const element of form.elements) {
    if (!element.name || !(element.name in conversationDraft)) continue;
    if (element.type === "checkbox") element.checked = Boolean(conversationDraft[element.name]);
    else if (element.type === "radio") element.checked = conversationDraft[element.name] === element.value;
    else element.value = conversationDraft[element.name];
  }
}

function clearConversationDraft() {
  conversationDraft = null;
  conversationDraftDirty = false;
}

function discardConversationDraft(onDiscard=null) {
  if(conversationDraftDirty){requestConfirmation({title:"Discard this conversation draft?",message:"The information entered in this capture flow will not be saved.",confirmLabel:"Discard draft",danger:true,onConfirm:()=>{clearConversationDraft();onDiscard?.();}});return false;}
  clearConversationDraft();
  return true;
}

function handleAddContact(event){
  event.preventDefault(); const form=new FormData(event.currentTarget); const fullName=String(form.get('fullName')||'').trim(); if(!fullName)return;
  let placeId=String(form.get('placeId')||'')||null, placeName=''; const newPlaceName=String(form.get('newPlaceName')||'').trim();
  if(newPlaceName){let place=state.places.find(p=>p.name.toLowerCase()===newPlaceName.toLowerCase());if(!place){place={id:uid(),name:newPlaceName,isFavorite:form.has('favoritePlace'),createdAt:nowISO()};state.places.push(place);}else if(form.has('favoritePlace'))place.isFavorite=true;placeId=place.id;placeName=place.name;} else if(placeId){placeName=state.places.find(p=>p.id===placeId)?.name||'';}
  const role=["Prospect","Customer","Team"].includes(String(form.get('role'))) ? String(form.get('role')) : "Prospect"; const isTeam=role==="Team"; const conversationDate=`${form.get('conversationDate')}T12:00:00`; const stages=Object.fromEntries(ALL_STAGES.map(stage=>[stage,false])); const stageDates={};
  for(const stage of ['MSA','DTM']){if(form.has(stageInputName(stage))){stages[stage]=true;stageDates[stage]=conversationDate;}}
  const selectedPipelineStage=String(form.get('pipelineStage')||'');
  if((PIPELINES[role] || []).includes(selectedPipelineStage)){stages[selectedPipelineStage]=true;stageDates[selectedPipelineStage]=conversationDate;}
  const notes=String(form.get('notes')||'').trim(); const personalInfo=String(form.get('personalInfo')||'').trim(); const phoneNumber=String(form.get('phoneNumber')||'').trim(); const email=String(form.get('email')||'').trim();
  if(!isValidEmail(email)){showToast('Enter a valid email address or leave it blank');return;}
  const duplicate=isCallablePhone(phoneNumber)&&state.contacts.find(existing=>normalizedPhone(existing.phoneNumber)===normalizedPhone(phoneNumber));
  if(duplicate){requestConfirmation({title:"Use the existing relationship?",message:`${duplicate.fullName} already uses this phone number. Add this as a new conversation on their existing record instead?`,confirmLabel:"Add conversation",onConfirm:()=>{duplicate.conversations.push({id:uid(),type:String(form.get('conversationType')),interestLevel:duplicate.interestLevel,notes,createdAt:nowISO(),conversationDate,isCountedConversation:true});if(personalInfo&&!duplicate.personalInfo)duplicate.personalInfo=personalInfo;if(email&&!duplicate.email)duplicate.email=email;duplicate.updatedAt=nowISO();clearConversationDraft();ui.conversationStep=0;queueSave('Conversation added to existing contact');ui.page='contacts';ui.detailId=duplicate.id;render();}});return;}
  const interestLevel=isTeam?"Unsure":String(form.get('interestLevel')||"Unsure"); const judgement=isTeam?"Good Fit":String(form.get('judgement')||"Good Fit");
  const contact={id:uid(),fullName,phoneNumber,email,capturedPhoneNumber:phoneNumber,phoneCapturedAt:phoneNumber?conversationDate:null,role,judgement,interestLevel,conversationType:String(form.get('conversationType')),placeId,placeName,dateFirstMet:conversationDate,personalInfo,isFilteredOut:false,filteredOutAt:null,checkBackDate:form.get('checkBackDate')?new Date(String(form.get('checkBackDate'))).toISOString():null,archivedAt:null,archiveReason:null,stages,stageDates,stageEvents:Object.entries(stageDates).map(([stage,occurredAt])=>({id:uid(),stage,fromStage:null,toStage:stage,occurredAt,source:"add-new"})),followUps:[],notes:[],conversations:[{id:uid(),type:String(form.get('conversationType')),interestLevel,notes,createdAt:nowISO(),conversationDate,isCountedConversation:true}],createdAt:nowISO(),updatedAt:nowISO()};
  if(form.get('followUpDate'))createFollowUp(contact,new Date(String(form.get('followUpDate'))).toISOString(),'Follow up');
  if(form.get('checkBackDate'))createFollowUp(contact,new Date(String(form.get('checkBackDate'))).toISOString(),'Check back down the line');
  state.contacts.unshift(contact); clearConversationDraft(); ui.conversationStep=0; queueSave('Conversation saved'); ui.page='contacts'; render();
}

function downloadBlob(name, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showSignedOutAccount(message) {
  clearInterval(reminderTimer);
  reminderTimer = null;
  navigator.serviceWorker?.controller?.postMessage({ type: "bridge-account-logout" });
  state = defaultState();
  stateHydrated = false;
  anonymousSnapshot = null;
  ui.settingsOpen = false;
  ui.accountMigrationOpen = false;
  ui.accountAction = null;
  ui.accountBusy = false;
  accountContext = {
    ...accountContext,
    authenticated: false,
    user: null,
    status: { state: "signed-out", message: "Signed out", pending: 0, conflicts: 0 }
  };
  accountClient.renderAuthScreen({ message });
}

function bindSettingsEvents(){
  if(accountModeActive()&&!ui.accountPanelLoaded&&["root","profile","account","sessions","data","backup"].includes(ui.routedSection||"root"))refreshAccountPanelData().catch(()=>{});
  $('#openReleaseNotes')?.addEventListener('click',()=>{releaseFocusReturn=document.activeElement;ui.settingsOpen=false;ui.releaseNotesReturnToSettings=true;ui.releaseNotesOpen=true;render();});
  $('#syncAccountNow')?.addEventListener('click',async()=>{
    if(ui.accountBusy)return;
    ui.accountBusy=true;render();
    try{
      const result=await accountClient.syncNow({state});
      if(result?.state)state=normalizeState(result.state);
      ui.accountPanelLoaded=false;
      ui.accountBusy=false;
      render();
      refreshAccountPanelData().catch(()=>{});
      showToast('Account synced');
    }catch(error){
      ui.accountBusy=false;render();showToast(error?.message||'Bridge could not sync this account');
    }
  });
  $('#signOutAccount')?.addEventListener('click',()=>{
    if(ui.accountBusy)return;
    const pending=Number(accountContext.status?.pending||0);
    requestConfirmation({title:'Sign out of Bridge?',message:pending?`${pending} pending change${pending===1?'':'s'} will remain on this device and resume after you sign in again.`:'This device will be signed out of your Bridge account.',confirmLabel:'Sign out',danger:true,onConfirm:async()=>{
      ui.accountBusy=true;render();
      await disableBackgroundPush().catch(()=>{});
      await accountClient.logout();
      showSignedOutAccount(pending?'Signed out. Pending changes are preserved on this device.':'Signed out of Bridge.');
    }});
  });
  $('#changeAccountPassword')?.addEventListener('click',async()=>{
    if(ui.accountBusy)return;
    accountActionFocusReturn=document.activeElement;
    accountActionFocusSelector=routeFocusSelector(accountActionFocusReturn);
    ui.accountAction={type:'change-password'};
    render();
  });
  $$('.revoke-account-session').forEach(button=>button.addEventListener('click',()=>{
    if(ui.accountBusy)return;
    const sessionId=button.dataset.sessionId;
    requestConfirmation({title:'Sign this device out?',message:'That device will need to sign in again to access this Bridge account.',confirmLabel:'Sign out device',danger:true,onConfirm:async()=>{
      ui.accountBusy=true;render();
      try{
        await accountClient.revokeSession(sessionId);
        ui.accountSessions=ui.accountSessions.filter(session=>session.id!==sessionId);
        ui.accountBusy=false;render();showToast('Session signed out');
      }catch(error){ui.accountBusy=false;render();showToast(error?.message||'Bridge could not revoke that session');}
    }});
  }));
  $('#createCloudBackup')?.addEventListener('click',async()=>{
    if(ui.accountBusy)return;
    ui.accountBusy=true;render();
    try{
      await accountClient.createBackup();
      ui.accountPanelLoaded=false;ui.accountBusy=false;render();refreshAccountPanelData().catch(()=>{});
      showToast('Cloud backup created');
    }catch(error){ui.accountBusy=false;render();showToast(error?.message||'Cloud backups are not configured');}
  });
  $('#exportAccountData')?.addEventListener('click',async()=>{
    if(ui.accountBusy)return;
    ui.accountBusy=true;render();
    try{
      const blob=await accountClient.downloadAccountExport();
      downloadBlob(`bridge-account-export-${todayInput()}.json`,blob);
      ui.accountBusy=false;render();showToast('Account export downloaded');
    }catch(error){ui.accountBusy=false;render();showToast(error?.message||'Bridge could not export this account');}
  });
  $$('.restore-cloud-backup').forEach(button=>button.addEventListener('click',async()=>{
    if(ui.accountBusy)return;
    const restoreOpener=button;
    ui.accountBusy=true;render();
    try{
      const preview=await accountClient.previewBackup(button.dataset.backupId);
      const counts=preview?.counts||{};
      ui.accountBusy=false;
      accountActionFocusReturn=restoreOpener;
      accountActionFocusSelector=routeFocusSelector(restoreOpener);
      ui.accountAction={type:'restore-backup',backupId:button.dataset.backupId,counts};
      render();
    }catch(error){ui.accountBusy=false;render();showToast(error?.message||'Bridge could not restore that backup');}
  }));
  $('#deleteBridgeAccount')?.addEventListener('click',async()=>{
    if(ui.accountBusy)return;
    accountActionFocusReturn=document.activeElement;
    accountActionFocusSelector=routeFocusSelector(accountActionFocusReturn);
    ui.accountAction={type:'delete-account'};
    render();
  });
  $('#streakRestFrequency')?.addEventListener('change',event=>{ui.settingsRestFrequencyDraft=event.target.value;$$('[data-rest-panel]').forEach(panel=>{panel.hidden=panel.dataset.restPanel!==ui.settingsRestFrequencyDraft;});});
  $$('.weekday-button').forEach(button=>button.addEventListener('click',()=>{const selected=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(selected));button.classList.toggle('active',selected);}));
  $('#addStreakRestRule')?.addEventListener('click',()=>{
    const frequency=String($('#streakRestFrequency')?.value||'once');
    if(frequency==='once'){
      const input=$('#oneTimeRestDate');
      const date=String(input?.value||'');
      const current=normalizeExcludedDates(ui.settingsExcludedDatesDraft);
      const next=normalizeExcludedDates([...current,date]);
      if(!date||!next.includes(date)){showToast('Choose a valid rest date');input?.focus();return;}
      if(next.length===current.length){showToast('That rest day already exists');return;}
      ui.settingsExcludedDatesDraft=next;
      refreshRestDayEditor();
      input.value='';
      return;
    }
    let rule=null;
    if(frequency==='weekly'){
      const weekdays=$$('.weekday-button[aria-pressed="true"]').map(button=>Number(button.dataset.weekday));
      if(!weekdays.length){showToast('Choose at least one weekly rest day');return;}
      rule={frequency,weekdays};
    } else if(frequency==='monthly'){
      const input=$('#monthlyRestDay');
      const day=Number(input?.value);
      if(!Number.isInteger(day)||day<1||day>31){showToast('Choose a day from 1 to 31');input?.focus();return;}
      rule={frequency,day};
    } else {
      const input=$('#yearlyRestDate');
      const value=String(input?.value||'');
      if(!normalizeRestRules([{frequency,date:value.slice(5)}]).length){showToast('Choose a valid annual rest date');input?.focus();return;}
      rule={frequency,date:value.slice(5)};
    }
    const current=normalizeRestRules(ui.settingsRestRulesDraft);
    const next=normalizeRestRules([...current,rule]);
    if(next.length===current.length){showToast('That rest schedule already exists');return;}
    ui.settingsRestRulesDraft=next;
    refreshRestDayEditor();
    $$('.weekday-button').forEach(button=>{button.classList.remove('active');button.setAttribute('aria-pressed','false');});
    if($('#monthlyRestDay'))$('#monthlyRestDay').value='';
    if($('#yearlyRestDate'))$('#yearlyRestDate').value='';
  });
  $('#streakRestRules')?.addEventListener('click',event=>{const button=event.target.closest('.remove-rest-rule');if(!button)return;const index=Number(button.dataset.restRuleIndex);ui.settingsRestRulesDraft=normalizeRestRules(ui.settingsRestRulesDraft).filter((_,ruleIndex)=>ruleIndex!==index);refreshRestDayEditor();});
  $('#streakRestDays')?.addEventListener('click',event=>{const button=event.target.closest('.remove-rest-day');if(!button)return;const value=button.dataset.restDate;ui.settingsExcludedDatesDraft=normalizeExcludedDates(ui.settingsExcludedDatesDraft).filter(date=>date!==value);refreshRestDayEditor();});
  $('#requestNotifications')?.addEventListener('click',async()=>{try{pushSubscriptionState='checking';render();await enableBackgroundPush();queueSave('Background reminders enabled');render();startReminderChecks();}catch(error){await refreshPushSubscriptionState();if(notificationPermission()!=="granted"){state.settings.notificationsEnabled=false;persistStateSilently();}showToast(error?.message||'Background reminders could not be enabled');render();}});
  $('#testPushNotification')?.addEventListener('click',async()=>{try{const subscription=await currentPushSubscription();const token=pushDeviceToken();if(!subscription||!token)throw new Error('Enable background reminders first');const response=await apiFetch('/api/push/test-device',{method:'POST',headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Test notification failed');showToast('Test notification sent');}catch(error){showToast(error?.message||'Test notification failed');}});
  $('#disablePushNotifications')?.addEventListener('click',async()=>{await disableBackgroundPush();state.settings.notificationsEnabled=false;queueSave('Background reminders disabled on this device');render();startReminderChecks();});
  $("#settingsForm")?.addEventListener("submit",async event=>{
    event.preventDefault();
    const form=event.currentTarget;
    const f=new FormData(form);
    const hasControl=name=>Boolean(form.elements.namedItem(name));
    const enabledControl=name=>{const control=form.elements.namedItem(name);return Boolean(control&&!control.disabled);};
    const next={...state.settings};
    if(hasControl("firstName")||hasControl("lastName")||hasControl("businessName")){
      const firstName=String(f.get("firstName")||"").trim();
      const lastName=String(f.get("lastName")||"").trim();
      if(accountModeActive()){
        try{const result=await accountClient.updateAccount({firstName,lastName});if(result?.user)accountContext.user=result.user;}
        catch(error){showToast(error?.message||"Bridge could not update the account profile");return;}
      }
      next.name=[firstName,lastName].filter(Boolean).join(" ");
      next.firstName=firstName;
      next.lastName=lastName;
      next.businessName=String(f.get("businessName")||"");
    }
    if(hasControl("dailyGoal"))next.dailyGoal=Math.min(100,Math.max(1,Number(f.get("dailyGoal"))||5));
    if(hasControl("weeklyGoal"))next.weeklyGoal=Math.min(500,Math.max(1,Number(f.get("weeklyGoal"))||25));
    if(hasControl("monthlyGoal"))next.monthlyGoal=Math.min(2000,Math.max(1,Number(f.get("monthlyGoal"))||100));
    if(form.dataset.settingsSection==="goals"){
      next.streakExcludedDates=normalizeExcludedDates(ui.settingsExcludedDatesDraft);
      next.streakRestRules=normalizeRestRules(ui.settingsRestRulesDraft);
    }
    if(hasControl("defaultFollowUpDays"))next.defaultFollowUpDays=Number(f.get("defaultFollowUpDays"))||2;
    if(hasControl("weekStart"))next.weekStart=Number(f.get("weekStart"))||0;
    let archived=0;
    if(hasControl("autoArchiveInactive")){next.autoArchiveInactive=f.has("autoArchiveInactive");archived=archiveInactiveContacts(state.contacts,next.autoArchiveInactive);}
    if(enabledControl("notificationsEnabled"))next.notificationsEnabled=f.has("notificationsEnabled")&&notificationPermission()==="granted";
    if(hasControl("followUpNotifications"))next.followUpNotifications=f.has("followUpNotifications");
    if(hasControl("dailyReminderEnabled"))next.dailyReminderEnabled=f.has("dailyReminderEnabled");
    if(hasControl("dailyReminderTime"))next.dailyReminderTime=String(f.get("dailyReminderTime")||"09:00");
    if(hasControl("healthScoresVisible"))next.healthScoresVisible=f.has("healthScoresVisible");
    if(hasControl("healthFallbackCadenceDays")){
      next.healthFallbackCadenceDays=Math.min(365,Math.max(1,Number(f.get("healthFallbackCadenceDays"))||14));
      next.healthCadencePresets=readHealthCadencePresets(f);
    }
    state.settings=next;
    ui.settingsExcludedDatesDraft=null;ui.settingsRestRulesDraft=null;
    applyFixedAppearance();queueSave(archived?`${archived} inactive contact${archived===1?"":"s"} archived`:"Settings saved");
    if(ui.routedScreen==="settings")presentationBack();else{ui.settingsOpen=false;render();}
    startReminderChecks();
  });
  $('#exportBackup')?.addEventListener('click',()=>downloadFile(`bridge-backup-${todayInput()}.json`,JSON.stringify(state,null,2),'application/json'));
  $('#exportCSV')?.addEventListener('click',()=>{const rows=[['Name','Phone','Email','Role','Interest','Judgement','Conversation Type','Place','Date First Met','Pipeline'],...state.contacts.map(c=>[c.fullName,c.phoneNumber,c.email,c.role,c.interestLevel,c.judgement,c.conversationType,c.placeName,c.dateFirstMet,stageFor(c)])];downloadFile(`bridge-contacts-${todayInput()}.csv`,rows.map(r=>r.map(csvCell).join(',')).join('\n'),'text/csv');});
  $('#importBackup')?.addEventListener('change',async event=>{const input=event.target;const file=input.files?.[0];if(!file)return;try{const imported=normalizeState(JSON.parse(await file.text()));requestConfirmation({title:'Replace current Bridge data?',message:`Restore ${imported.contacts.length} contact${imported.contacts.length===1?'':'s'} from this backup. This replaces the data currently open in Bridge.`,confirmLabel:'Restore backup',danger:true,onConfirm:()=>{state=imported;applyFixedAppearance();queueSave('Backup restored');ui.settingsOpen=false;render();},onCancel:()=>{input.value='';}});}catch{input.value='';showToast('That backup file could not be read');}});
}
function csvCell(value){return `"${String(value||'').replaceAll('"','""')}"`;}
function downloadFile(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

function bindProfileCollapsingHeader() {
  const screen=$(".relationship-profile-screen");
  if(!screen)return;
  const header=$("[data-profile-collapse-header]",screen);
  const largeTitle=$("[data-profile-large-title]",screen);
  if(!header||!largeTitle)return;
  const compactTitle=$("[data-profile-compact-title]",header);
  if(!compactTitle)return;
  let frame=0;
  let collapsed=null;
  const update=()=>{
    frame=0;
    if(!header.isConnected||!largeTitle.isConnected)return;
    const next=largeTitle.getBoundingClientRect().bottom<=header.getBoundingClientRect().bottom+.5;
    if(next===collapsed)return;
    collapsed=next;
    screen.classList.toggle("is-profile-collapsed",next);
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
  window.addEventListener("scroll",schedule,{passive:true});
  window.addEventListener("resize",schedule,{passive:true});
  update();
  profileHeaderScrollSync=update;
  profileHeaderScrollCleanup=()=>{
    window.removeEventListener("scroll",schedule);
    window.removeEventListener("resize",schedule);
    if(frame)cancelAnimationFrame(frame);
    profileHeaderScrollSync=null;
  };
}

function bindContactModalEvents(){
  const c=state.contacts.find(x=>x.id===ui.detailId);if(!c)return;
  if(ui.routedScreen==="person")bindProfileCollapsingHeader();
  $('.profile-stage-update > summary')?.addEventListener('click',event=>{
    if(ui.routedScreen!=="person"||!["Prospect","Customer"].includes(c.role))return;
    event.preventDefault();
    navigatePresentation("stage-transition",{role:c.role,person:c.id},{opener:event.currentTarget});
  });
  $$('[data-contact-detail-tab]').forEach(button=>button.addEventListener('click',()=>{
    const nextTab=String(button.dataset.contactDetailTab||'overview');
    if(nextTab===ui.contactDetailTab)return;
    const activate=()=>{clearPersonalInfoDraft();ui.contactDetailTab=nextTab;ui.activityHistoryContactId=null;ui.activityFilter=nextTab==='notes'?'Notes':'All';ui.expandedLogIds.clear();render();};
    if(ui.contactDetailTab==='personal'&&ui.personalInfoDirty){discardPersonalInfoDraft(activate);return;}
    if(ui.contactEditing&&ui.contactEditDirty){discardContactEdit(activate);return;}
    clearContactEdit();activate();
  }));
  $$('[data-edit-contact-info], #editContactInfo').forEach(button=>button.addEventListener('click',()=>{if(ui.routedScreen==="person")navigatePresentation("person-edit",{person:c.id},{opener:button});else{ui.contactDetailTab='overview';ui.contactEditing=true;ui.contactEditDirty=false;render();requestAnimationFrame(()=>$('#contactInfoForm input[name="fullName"]')?.focus());}}));
  $$('[data-profile-followup]').forEach(button=>button.addEventListener('click',()=>{quickCreateFocusReturn=button;ui.quickCreateOpen=true;ui.quickCreateMode="action";ui.quickCreateContactId=c.id;render();}));
  $$('[data-profile-reschedule]').forEach(button=>button.addEventListener('click',()=>{const active=c.followUps.filter(isScheduledFollowUp).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate))[0];if(!active)return;rescheduleFollowUp(active,addDays(new Date(active.dueDate),3).toISOString());c.updatedAt=nowISO();queueSave('Moved out three days');render();}));
  $('#contactInfoForm')?.addEventListener('input',()=>{ui.contactEditDirty=true;});
  $('#contactInfoForm')?.addEventListener('change',()=>{ui.contactEditDirty=true;});
  $('#editContactRole')?.addEventListener('change', event => {
    const team = event.target.value === "Team";
    $$('[data-edit-role-fit-field]').forEach(field => { field.hidden = team; });
  });
  const editNewPlaceInput=$('[data-edit-new-place]');
  const editNewPlaceFavorite=$('[data-edit-new-place-favorite]');
  const syncEditNewPlace=()=>{const active=Boolean(String(editNewPlaceInput?.value||'').trim());if(editNewPlaceFavorite){editNewPlaceFavorite.hidden=!active;const checkbox=$('input[name="favoritePlace"]',editNewPlaceFavorite);if(checkbox){checkbox.disabled=!active;if(!active)checkbox.checked=false;}}};
  editNewPlaceInput?.addEventListener('input',syncEditNewPlace);
  $('#contactInfoForm select[name="placeId"]')?.addEventListener('change',event=>{if(event.target.value&&editNewPlaceInput){editNewPlaceInput.value='';syncEditNewPlace();}});
  syncEditNewPlace();
  $('#cancelContactInfoEdit')?.addEventListener('click',()=>{const close=()=>{if(ui.routedScreen==="person-edit")presentationBack();else render();};if(ui.contactEditing&&ui.contactEditDirty){discardContactEdit(close);return;}clearContactEdit();close();});
  $('#contactInfoForm')?.addEventListener('submit',event=>{event.preventDefault();const f=new FormData(event.currentTarget);const nextRole=["Prospect","Customer","Team"].includes(String(f.get('role'))) ? String(f.get('role')) : c.role;const pipelineLocked=PIPELINE_STAGES.some(stage=>Boolean(c.stages?.[stage]));if(nextRole!==c.role&&pipelineLocked){showToast('Move or clear the current pipeline stage before changing this role');return;}const nextPhone=String(f.get('phoneNumber')||'').trim();const nextEmail=String(f.get('email')||'').trim();if(!isValidEmail(nextEmail)){showToast('Enter a valid email address or leave it blank');return;}const duplicate=isCallablePhone(nextPhone)&&state.contacts.find(other=>other.id!==c.id&&normalizedPhone(other.phoneNumber)===normalizedPhone(nextPhone));if(duplicate){showToast(`That phone number already belongs to ${duplicate.fullName}`);return;}c.fullName=String(f.get('fullName')).trim()||c.fullName;c.phoneNumber=nextPhone;c.email=nextEmail;c.role=nextRole;if(nextRole!=="Team"){c.interestLevel=String(f.get('interestLevel')||c.interestLevel);c.judgement=String(f.get('judgement')||c.judgement);}else{setFilteredOut(c,false,nowISO());}c.conversationType=String(f.get('conversationType'));const place=quickCapturePlace(f);c.placeId=place.placeId;c.placeName=place.placeName;const metDate=String(f.get('dateFirstMet')||'');if(metDate)c.dateFirstMet=`${metDate}T12:00:00`;c.updatedAt=nowISO();ui.contactEditing=false;ui.contactEditDirty=false;queueSave('Relationship updated');if(ui.routedScreen==="person-edit")presentationBack();else render();});
  $('#personalInfoForm')?.addEventListener('input',()=>{ui.personalInfoDirty=true;});
  $('#personalInfoForm')?.addEventListener('submit',event=>{event.preventDefault();const f=new FormData(event.currentTarget);c.personalInfo=String(f.get('personalInfo')||'').trim();c.updatedAt=nowISO();clearPersonalInfoDraft();queueSave('Personal info saved');render();});
  const cadenceForm=$('#contactCadenceForm');
  const syncContactCadenceMode=()=>{if(!cadenceForm)return;const custom=cadenceForm.elements.healthCadenceMode?.value==='custom';const section=$('[data-contact-cadence-custom]',cadenceForm);const input=cadenceForm.elements.healthCadenceDays;if(section)section.hidden=!custom;if(input){input.disabled=!custom;input.required=custom;}};
  cadenceForm?.addEventListener('change',event=>{if(event.target.name==='healthCadenceMode'){syncContactCadenceMode();if(event.target.value==='custom')cadenceForm.elements.healthCadenceDays?.focus();}});
  cadenceForm?.addEventListener('submit',event=>{event.preventDefault();const form=event.currentTarget;const custom=form.elements.healthCadenceMode?.value==='custom';if(custom){const cadence=Number(form.elements.healthCadenceDays?.value);if(!Number.isInteger(cadence)||cadence<1||cadence>365){showToast('Choose a cadence from 1 to 365 days');form.elements.healthCadenceDays?.focus();return;}c.healthCadenceDays=cadence;}else{c.healthCadenceDays=null;}c.updatedAt=nowISO();queueSave(custom?'Contact cadence saved':'Contact cadence set to automatic');render();});
  syncContactCadenceMode();
  $('#editTrackingForm')?.addEventListener('submit',event=>{event.preventDefault();const f=new FormData(event.currentTarget);const team=c.role==="Team";const nextFiltered=team?false:f.has('isFilteredOut');const saveTracking=()=>{setFilteredOut(c,nextFiltered,nowISO());c.stageEvents=Array.isArray(c.stageEvents)?c.stageEvents:[];for(const stage of ['MSA','DTM']){const checked=f.has(stageInputName(stage));if(checked&&!c.stages[stage]){const occurredAt=nowISO();c.stageDates[stage]=occurredAt;c.stageEvents.push({id:uid(),stage,occurredAt});}c.stages[stage]=checked;}const selected=String(f.get('pipelineStage')||'');setPipelineStage(c,(PIPELINES[c.role] || []).includes(selected)?selected:'');c.updatedAt=nowISO();queueSave(nextFiltered?'Contact moved to No-Go':'Tracking updated');render();};if(nextFiltered&&!c.isFilteredOut){requestConfirmation({title:`Mark ${c.fullName} as No-Go?`,message:'They will leave the active pipeline, but their history will be preserved.',confirmLabel:'Mark No-Go',danger:true,onConfirm:saveTracking});return;}saveTracking();});
  $('#clearPipelineStage')?.addEventListener('click',()=>{requestConfirmation({title:'Clear the current pipeline stage?',message:'Historical stage activity will remain.',confirmLabel:'Clear stage',danger:true,onConfirm:()=>{setPipelineStage(c,'');c.updatedAt=nowISO();queueSave('Pipeline stage cleared');render();}});});
  $('#addLogForm')?.addEventListener('submit',event=>{event.preventDefault();const f=new FormData(event.currentTarget);c.conversations.push({id:uid(),type:String(f.get('type')),interestLevel:c.interestLevel,notes:String(f.get('notes')).trim(),createdAt:nowISO(),conversationDate:`${f.get('conversationDate')}T12:00:00`,isCountedConversation:false});c.updatedAt=nowISO();queueSave('Note added');render();});
  $('#viewAllActivity')?.addEventListener('click',event=>{if(ui.routedScreen==="person")navigatePresentation("person-timeline",{person:c.id},{opener:event.currentTarget});else{ui.activityHistoryContactId=c.id;ui.activityFilter=ui.contactDetailTab==='notes'?"Notes":"All";ui.expandedLogIds.clear();render();}});
  $$('.log-note-toggle').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.expandLogId;if(ui.expandedLogIds.has(id))ui.expandedLogIds.delete(id);else ui.expandedLogIds.add(id);render();}));
  $$('.edit-communication-log').forEach(button=>button.addEventListener('click',()=>{const log=c.conversations.find(item=>item.id===button.dataset.logId);if(log){ui.activityHistoryContactId=null;openCommunicationLog(c.id,log.communicationType||"Call",log.conversationDate||log.createdAt,log.id);}}));
  $$('.delete-log').forEach(button=>button.addEventListener('click',()=>{const logId=button.dataset.logId;requestConfirmation({title:'Delete this conversation log?',message:'The contact and other relationship history will remain.',confirmLabel:'Delete log',danger:true,onConfirm:()=>{c.conversations=c.conversations.filter(log=>log.id!==logId);c.updatedAt=nowISO();queueSave('Log deleted');render();}});}));
  $('#completeFollowUp')?.addEventListener('click',()=>{const active=c.followUps.filter(isScheduledFollowUp).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate))[0];if(!active)return;transitionFollowUp(active,'completed');c.updatedAt=nowISO();queueSave('Follow-up completed');render();});
  $('#restoreNoGo')?.addEventListener('click',()=>{setFilteredOut(c,false,nowISO());c.updatedAt=nowISO();ui.visibilityFilter='Active';queueSave('Contact restored to Active');render();});
  $('#restoreContact')?.addEventListener('click',()=>{restoreContact(c,nowISO());ui.visibilityFilter='Active';queueSave('Contact restored');render();});
  $('#deleteContact')?.addEventListener('click',()=>{requestConfirmation({title:`Delete ${c.fullName}?`,message:'This cannot be undone.',confirmLabel:'Delete contact',danger:true,onConfirm:()=>{state.contacts=state.contacts.filter(x=>x.id!==c.id);ui.detailId=null;queueSave('Contact deleted');if(["person","person-edit"].includes(ui.routedScreen))presentationBack();else render();}});});
}

function bindActivityHistoryEvents(){
  const contact=state.contacts.find(item=>item.id===ui.activityHistoryContactId);
  const close=()=>{if(ui.routedScreen==="person-timeline"){presentationBack();return;}ui.activityHistoryContactId=null;ui.activityFilter="All";ui.expandedLogIds.clear();render();};
  $('.close-activity-history')?.addEventListener('click',close);
  $('.show-less-activity')?.addEventListener('click',close);
  $('#activityHistoryBackdrop')?.addEventListener('click',event=>{if(event.target.id==='activityHistoryBackdrop')close();});
  $$('[data-activity-filter]').forEach(button=>button.addEventListener('click',()=>{ui.activityFilter=button.dataset.activityFilter;ui.expandedLogIds.clear();render();}));
  $$('.edit-communication-log').forEach(button=>button.addEventListener('click',()=>{const log=contact?.conversations.find(item=>item.id===button.dataset.logId);if(!log)return;if(ui.routedScreen!=="person-timeline")ui.activityHistoryContactId=null;openCommunicationLog(contact.id,log.communicationType||"Call",log.conversationDate||log.createdAt,log.id);}));
  $$('.delete-log').forEach(button=>button.addEventListener('click',()=>{if(!contact)return;const logId=button.dataset.logId;requestConfirmation({title:'Delete this conversation log?',message:'The contact and other relationship history will remain.',confirmLabel:'Delete log',danger:true,onConfirm:()=>{contact.conversations=contact.conversations.filter(log=>log.id!==logId);contact.updatedAt=nowISO();queueSave('Log deleted');render();}});}));
}

function bindCommunicationLogEvents(){
  const c=state.contacts.find(contact=>contact.id===ui.communicationContactId);if(!c)return;
  const close=()=>{ui.communicationContactId=null;ui.communicationStartedAt=null;ui.communicationLogId=null;clearPendingCommunication();render();};
  bindBottomSheetGesture($('.call-log-modal'),close);
  $$('.close-communication-log').forEach(button=>button.addEventListener('click',close));
  $('#communicationLogBackdrop')?.addEventListener('click',event=>{if(event.target.id==='communicationLogBackdrop')close();});
  $('#communicationLogForm')?.addEventListener('submit',event=>{event.preventDefault();const f=new FormData(event.currentTarget);const occurredAt=new Date(String(f.get('conversationDate'))).toISOString();const communicationType=String(f.get('communicationType'))==='Text'?'Text':'Call';const duration=communicationType==='Call'?(Number(f.get('durationMinutes'))||null):null;const followUp=String(f.get('followUpDate')||'');let log=c.conversations.find(item=>item.id===ui.communicationLogId);const isNew=!log;if(!log){log={id:uid(),createdAt:nowISO(),isCountedConversation:false};c.conversations.push(log);}Object.assign(log,{type:communicationType==='Text'?'Text Message':'Call',communicationType,direction:String(f.get('direction')||'Outgoing'),outcome:String(f.get('outcome')),durationMinutes:duration,interestLevel:c.interestLevel,notes:String(f.get('notes')||'').trim(),conversationDate:occurredAt,isCountedConversation:false,followUpCreated:Boolean(log.followUpCreated||followUp)});if(followUp){replaceScheduledFollowUp(c,new Date(followUp).toISOString(),`${communicationType} follow-up`,{sourceCommunicationId:log.id});}for(const activity of ['MSA','DTM']){if(f.has(stageInputName(activity))&&!c.stages[activity]){c.stages[activity]=true;c.stageDates[activity]=occurredAt;c.stageEvents.push({id:uid(),stage:activity,fromStage:"",toStage:activity,occurredAt,source:"communication"});}}const nextStage=String(f.get('pipelineStage')||'');if(nextStage==='__clear')setPipelineStage(c,'',occurredAt,'communication');else if(PIPELINES[c.role].includes(nextStage))setPipelineStage(c,nextStage,occurredAt,'communication');c.updatedAt=nowISO();ui.communicationContactId=null;ui.communicationStartedAt=null;ui.communicationLogId=null;clearPendingCommunication();queueSave(isNew?`${communicationType} logged`:'Communication log updated');render();});
}

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.addEventListener("message", event => {
    if (event.data?.type !== "bridge-notification-navigation" || !event.data.url) return;
    if (!stateHydrated) {
      pendingNotificationNavigationURL = String(event.data.url);
      return;
    }
    if (blockingModalOpen()) {
      deferNotificationNavigation(event.data.url);
      return;
    }
    consumeNotificationNavigation(event.data.url);
  });
}

startBridge().catch(error => {
  console.error("Bridge startup failed", error);
  if (accountContext.mode === "account") {
    accountClient?.renderAuthScreen({ error: "Bridge could not open your private workspace. Check your connection and try again." });
    return;
  }
  loadState().catch(() => {
    state = defaultState();
    finishStateHydration();
    showToast("Bridge opened with a new local workspace");
  });
});
