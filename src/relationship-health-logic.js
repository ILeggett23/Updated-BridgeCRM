(function installBridgeRelationshipHealth(global) {
  const DAY = 86_400_000;
  const SCHEMA_VERSION = 1;
  const FORMULA_VERSION = "1.0.0";
  const COMPONENT_WEIGHTS = Object.freeze({ recency: 40, consistency: 25, actionHealth: 20, momentum: 15 });
  const DEFAULT_CADENCE_PRESETS = Object.freeze({
    Prospect: Object.freeze({ default: 14, PQI: 14, "QI/P": 14, FUP: 7, LA: 30 }),
    Customer: Object.freeze({ default: 21, CNA: 14, Proposal: 14, "Follow-Up": 7, "Order Placed": 14, "Active Customer": 30 }),
    Team: Object.freeze({ default: 30 })
  });

  const clamp = (value, minimum = 0, maximum = 100) => Math.min(maximum, Math.max(minimum, Number(value) || 0));
  const timestamp = value => {
    if (value === null || value === undefined || value === "") return null;
    const result = new Date(value).getTime();
    return Number.isFinite(result) ? result : null;
  };
  const localDayNumber = value => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY);
  };
  const calendarDaysBetween = (later, earlier) => {
    const laterDay = localDayNumber(later);
    const earlierDay = localDayNumber(earlier);
    return laterDay === null || earlierDay === null ? 0 : laterDay - earlierDay;
  };
  const addLocalDays = (value, amount) => {
    const date = new Date(value);
    date.setDate(date.getDate() + amount);
    return date.getTime();
  };
  const round = value => Math.round(clamp(value));
  const isActiveContact = contact => !contact?.archivedAt && !contact?.isFilteredOut;
  const currentStage = contact => {
    const roleStages = contact?.role === "Customer"
      ? ["CNA", "Proposal", "Follow-Up", "Order Placed", "Active Customer"]
      : contact?.role === "Prospect" ? ["PQI", "QI/P", "FUP", "LA"] : [];
    return roleStages.find(stage => Boolean(contact?.stages?.[stage])) || "";
  };
  const countedConversations = contact => (contact?.conversations || [])
    .filter(item => item?.isCountedConversation && timestamp(item.conversationDate || item.createdAt) !== null)
    .map(item => ({ ...item, occurredAt: timestamp(item.conversationDate || item.createdAt) }))
    .sort((left, right) => left.occurredAt - right.occurredAt);

  function normalizeCadencePresets(value) {
    const source = value && typeof value === "object" ? value : {};
    return Object.fromEntries(Object.entries(DEFAULT_CADENCE_PRESETS).map(([role, defaults]) => {
      const supplied = source[role] && typeof source[role] === "object" ? source[role] : {};
      const normalized = Object.fromEntries(Object.entries(defaults).map(([stage, fallback]) => {
        const candidate = Number(supplied[stage]);
        return [stage, Number.isFinite(candidate) && candidate >= 1 && candidate <= 365 ? Math.round(candidate) : fallback];
      }));
      return [role, normalized];
    }));
  }

  function resolveCadence(contact, settings = {}, now = new Date()) {
    const override = Number(contact?.healthCadenceDays);
    if (Number.isFinite(override) && override >= 1 && override <= 365) {
      return { days: Math.round(override), source: "contact override", stage: currentStage(contact) };
    }
    const deadline = timestamp(contact?.checkBackDate);
    if (deadline !== null) {
      const conversations = countedConversations(contact);
      const baseline = conversations.at(-1)?.occurredAt || timestamp(contact?.createdAt) || timestamp(now);
      const days = Math.max(1, Math.abs(calendarDaysBetween(deadline, baseline)) || 1);
      return { days: Math.min(365, days), source: "check-back deadline", stage: currentStage(contact), deadline: new Date(deadline).toISOString() };
    }
    const role = ["Prospect", "Customer", "Team"].includes(contact?.role) ? contact.role : null;
    const presets = normalizeCadencePresets(settings.healthCadencePresets);
    const stage = currentStage(contact);
    const preset = Number(role ? presets[role]?.[stage || "default"] : NaN);
    if (Number.isFinite(preset) && preset > 0) return { days: preset, source: "role and stage preset", stage };
    const fallback = Number(settings.healthFallbackCadenceDays);
    return { days: Number.isFinite(fallback) && fallback >= 1 ? Math.round(fallback) : 14, source: "global fallback", stage };
  }

  function recencyComponent(conversations, cadenceDays, nowTime) {
    const latest = conversations.at(-1);
    if (!latest) return null;
    const ageDays = Math.max(0, calendarDaysBetween(nowTime, latest.occurredAt));
    const value = ageDays <= cadenceDays ? 100 : 100 * (1 - ((ageDays - cadenceDays) / (cadenceDays * 2)));
    return {
      value: round(value),
      records: [latest.id].filter(Boolean),
      explanation: ageDays <= cadenceDays
        ? `Last counted conversation is within the ${cadenceDays}-day cadence.`
        : `Last counted conversation was ${Math.floor(ageDays)} days ago against a ${cadenceDays}-day cadence.`
    };
  }

  function consistencyComponent(contact, conversations, cadenceDays, nowTime) {
    const trackingStart = timestamp(contact?.createdAt) ?? conversations[0]?.occurredAt;
    if (trackingStart === null || trackingStart === undefined || !conversations.length) return null;
    const elapsedDays = Math.max(0, calendarDaysBetween(nowTime, trackingStart));
    const elapsedWindows = Math.max(1, Math.ceil(elapsedDays / cadenceDays));
    const windowCount = Math.min(4, elapsedWindows);
    let filled = 0;
    const records = [];
    for (let index = 0; index < windowCount; index += 1) {
      const end = addLocalDays(nowTime, -(index * cadenceDays));
      const start = addLocalDays(end, -cadenceDays);
      const matches = conversations.filter(item => item.occurredAt > start && item.occurredAt <= end);
      if (matches.length) filled += 1;
      records.push(...matches.map(item => item.id).filter(Boolean));
    }
    return {
      value: round((filled / windowCount) * 100),
      records: [...new Set(records)],
      explanation: `${filled} of ${windowCount} eligible cadence windows contain a counted conversation.`
    };
  }

  function normalizedFollowUps(contact) {
    return (contact?.followUps || []).map(item => {
      const due = timestamp(item.dueDate);
      const completed = timestamp(item.completedAt);
      const status = item.status || (completed !== null ? "completed" : item.deletedAt ? "deleted" : item.canceledAt ? "canceled" : "scheduled");
      return { ...item, due, completed, status };
    });
  }

  function actionHealthComponent(contact, nowTime) {
    const actions = normalizedFollowUps(contact);
    const relevant = actions.filter(item => !["deleted", "canceled"].includes(item.status));
    const workflowRequiresAction = relevant.length > 0 || Boolean(contact?.checkBackDate) || ["FUP", "Follow-Up"].includes(currentStage(contact));
    if (!workflowRequiresAction) return null;
    const scheduled = relevant.filter(item => item.status === "scheduled" && item.due !== null);
    const completed = relevant.filter(item => item.status === "completed" && item.due !== null && item.completed !== null);
    const overdue = scheduled.filter(item => item.due < nowTime);
    const future = scheduled.filter(item => item.due >= nowTime);
    const coverage = overdue.length ? 0 : future.length ? 100 : completed.length ? 50 : 0;
    const onTime = completed.length ? (completed.filter(item => item.completed <= item.due).length / completed.length) * 100 : null;
    const overdueScore = scheduled.length ? (1 - (overdue.length / scheduled.length)) * 100 : null;
    const parts = [coverage, onTime, overdueScore].filter(value => value !== null);
    return {
      value: round(parts.reduce((total, value) => total + value, 0) / parts.length),
      records: relevant.map(item => item.id).filter(Boolean),
      completedActions: completed.length,
      explanation: overdue.length
        ? `${overdue.length} unresolved overdue action${overdue.length === 1 ? "" : "s"} reduce action health.`
        : future.length ? "A next action is scheduled with no unresolved overdue work." : "Past action completion is available, but no next action is scheduled."
    };
  }

  function momentumComponent(conversations, nowTime) {
    const recentStart = addLocalDays(nowTime, -30);
    const previousStart = addLocalDays(nowTime, -60);
    const recent = conversations.filter(item => item.occurredAt > recentStart && item.occurredAt <= nowTime);
    const previous = conversations.filter(item => item.occurredAt > previousStart && item.occurredAt <= recentStart);
    if (!recent.length && !previous.length) return null;
    const comparison = previous.length ? (recent.length - previous.length) / previous.length : recent.length ? 1 : -1;
    return {
      value: round(50 + (clamp(comparison, -1, 1) * 50)),
      records: [...recent, ...previous].map(item => item.id).filter(Boolean),
      explanation: `${recent.length} counted conversation${recent.length === 1 ? "" : "s"} in the latest 30 days versus ${previous.length} in the preceding 30 days.`
    };
  }

  function bandFor(value) {
    if (value >= 80) return "Strong";
    if (value >= 60) return "Steady";
    if (value >= 40) return "Needs Attention";
    return "At Risk";
  }

  function confidenceFor(conversations, components, completedActions, nowTime) {
    const recent60 = conversations.filter(item => item.occurredAt > addLocalDays(nowTime, -60));
    const recent30 = conversations.filter(item => item.occurredAt > addLocalDays(nowTime, -30));
    const componentCount = Object.values(components).filter(Boolean).length;
    if (recent60.length >= 6 && componentCount === 4 && completedActions >= 3) return "High";
    if (recent30.length >= 3 && componentCount >= 3) return "Medium";
    return "Low";
  }

  function trendFor(contactId, score, analytics, calculatedAt) {
    if (score === null) return { direction: "steady", delta: 0, comparedAt: null };
    const threshold = addLocalDays(calculatedAt, -7);
    const previous = (analytics?.contactHealthEvents || [])
      .filter(event => event.contactId === contactId && event.formulaVersion === FORMULA_VERSION && timestamp(event.calculatedAt) <= threshold && Number.isFinite(Number(event.score)))
      .sort((left, right) => timestamp(right.calculatedAt) - timestamp(left.calculatedAt))[0];
    if (!previous) return { direction: "steady", delta: 0, comparedAt: null };
    const delta = Math.round(score - Number(previous.score));
    return { direction: delta >= 5 ? "improving" : delta <= -5 ? "declining" : "steady", delta, comparedAt: previous.calculatedAt };
  }

  function scoreContact(contact, { settings = {}, analytics = {}, now = new Date() } = {}) {
    const calculatedAt = timestamp(now) ?? Date.now();
    const cadence = resolveCadence(contact, settings, new Date(calculatedAt));
    const conversations = countedConversations(contact).filter(item => item.occurredAt <= calculatedAt);
    const components = {
      recency: recencyComponent(conversations, cadence.days, calculatedAt),
      consistency: consistencyComponent(contact, conversations, cadence.days, calculatedAt),
      actionHealth: actionHealthComponent(contact, calculatedAt),
      momentum: momentumComponent(conversations, calculatedAt)
    };
    const available = Object.entries(components).filter(([, component]) => component !== null);
    const availableWeight = available.reduce((total, [key]) => total + COMPONENT_WEIGHTS[key], 0);
    const hasBaseline = available.length >= 2 && availableWeight >= 60;
    const score = hasBaseline
      ? round(available.reduce((total, [key, component]) => total + (component.value * COMPONENT_WEIGHTS[key]), 0) / availableWeight)
      : null;
    const completedActions = components.actionHealth?.completedActions || 0;
    return {
      contactId: contact?.id,
      active: isActiveContact(contact),
      status: hasBaseline ? "scored" : "building-baseline",
      score,
      band: hasBaseline ? bandFor(score) : "Building Baseline",
      confidence: confidenceFor(conversations, components, completedActions, calculatedAt),
      cadence,
      components,
      availableWeight,
      trend: trendFor(contact?.id, score, analytics, calculatedAt),
      explanation: hasBaseline
        ? `${bandFor(score)} relationship health based on ${available.length} available signals.`
        : "More counted conversation or action history is needed before Bridge can calculate a reliable score.",
      contributingRecords: [...new Set(available.flatMap(([, component]) => component.records || []))],
      calculatedAt: new Date(calculatedAt).toISOString(),
      formulaVersion: FORMULA_VERSION
    };
  }

  function scoreContacts(contacts, options = {}) {
    return (contacts || []).filter(isActiveContact).map(contact => scoreContact(contact, options));
  }

  function summarizeHealth(scores) {
    const scored = (scores || []).filter(item => item.score !== null);
    const bands = { Strong: 0, Steady: 0, "Needs Attention": 0, "At Risk": 0, "Building Baseline": 0 };
    for (const item of scores || []) bands[item.band] = (bands[item.band] || 0) + 1;
    return {
      average: scored.length ? Math.round(scored.reduce((total, item) => total + item.score, 0) / scored.length) : null,
      scored: scored.length,
      total: (scores || []).length,
      bands
    };
  }

  function normalizeAnalyticsState(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      schemaVersion: SCHEMA_VERSION,
      formulaVersion: FORMULA_VERSION,
      trackingStartedAt: source.trackingStartedAt || new Date().toISOString(),
      dailySnapshots: Array.isArray(source.dailySnapshots) ? source.dailySnapshots : [],
      contactHealthEvents: Array.isArray(source.contactHealthEvents) ? source.contactHealthEvents : []
    };
  }

  function recordHealthEvents(analytics, scores) {
    const normalized = normalizeAnalyticsState(analytics);
    for (const score of scores || []) {
      if (score.score === null || !score.contactId) continue;
      const previous = normalized.contactHealthEvents
        .filter(event => event.contactId === score.contactId && event.formulaVersion === score.formulaVersion)
        .at(-1);
      if (previous && previous.score === score.score && previous.band === score.band && previous.confidence === score.confidence) continue;
      normalized.contactHealthEvents.push({
        id: `${score.contactId}-${score.calculatedAt}`,
        contactId: score.contactId,
        score: score.score,
        band: score.band,
        confidence: score.confidence,
        calculatedAt: score.calculatedAt,
        formulaVersion: score.formulaVersion
      });
    }
    return normalized;
  }

  global.BridgeRelationshipHealth = Object.freeze({
    COMPONENT_WEIGHTS,
    DEFAULT_CADENCE_PRESETS,
    FORMULA_VERSION,
    SCHEMA_VERSION,
    bandFor,
    calendarDaysBetween,
    countedConversations,
    isActiveContact,
    normalizeAnalyticsState,
    normalizeCadencePresets,
    recordHealthEvents,
    resolveCadence,
    scoreContact,
    scoreContacts,
    summarizeHealth
  });
})(globalThis);
