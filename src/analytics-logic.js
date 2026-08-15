(function installBridgeAnalyticsLogic(global) {
  const parseDate = value => {
    if (value instanceof Date) return new Date(value);
    const text = String(value || "");
    return new Date(text.length === 10 ? `${text}T12:00:00` : text);
  };

  const startOfDay = value => {
    const date = parseDate(value);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const endOfDay = value => {
    const date = parseDate(value);
    date.setHours(23, 59, 59, 999);
    return date;
  };

  const addDays = (value, amount) => {
    const date = parseDate(value);
    date.setDate(date.getDate() + amount);
    return date;
  };

  const fullDate = date => new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);

  function dateRangeLabel(start, end) {
    if (start.toDateString() === end.toDateString()) return fullDate(start);
    const sameYear = start.getFullYear() === end.getFullYear();
    const sameMonth = sameYear && start.getMonth() === end.getMonth();
    if (sameMonth) {
      const month = new Intl.DateTimeFormat(undefined, { month: "long" }).format(start);
      return `${month} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`;
    }
    if (sameYear) {
      const left = new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(start);
      const right = new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(end);
      return `${left}–${right}, ${end.getFullYear()}`;
    }
    return `${fullDate(start)}–${fullDate(end)}`;
  }

  function analyticsRange({ mode = "week", anchor, customStart, customEnd, weekStart = 0 }) {
    const anchorDate = parseDate(anchor);
    if (mode === "day") {
      const start = startOfDay(anchorDate);
      return { start, end: endOfDay(anchorDate), label: fullDate(start) };
    }
    if (mode === "month") {
      const start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
      const end = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0, 23, 59, 59, 999);
      return {
        start,
        end,
        label: new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(anchorDate)
      };
    }
    if (mode === "custom") {
      let start = startOfDay(customStart || anchor);
      let end = endOfDay(customEnd || customStart || anchor);
      if (start > end) [start, end] = [startOfDay(end), endOfDay(start)];
      return { start, end, label: dateRangeLabel(start, end) };
    }
    const day = startOfDay(anchorDate);
    const delta = (day.getDay() - Number(weekStart || 0) + 7) % 7;
    const start = addDays(day, -delta);
    const end = endOfDay(addDays(start, 6));
    return { start, end, label: dateRangeLabel(start, end) };
  }

  function inAnalyticsRange(value, range) {
    const date = parseDate(value);
    return Number.isFinite(date.getTime()) && date >= range.start && date <= range.end;
  }

  function normalizePhone(value) {
    const identity = global.BridgeCommunication?.phoneIdentity?.(value);
    if (identity) return identity.startsWith("1") && identity.length === 11 ? identity.slice(1) : identity;
    const digits = String(value || "").replace(/\D/g, "");
    return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  }

  function uniquePhoneCaptures(contacts, range = null) {
    const earliestByPhone = new Map();
    for (const contact of contacts || []) {
      const phone = normalizePhone(contact.capturedPhoneNumber || "");
      const capturedAt = contact.phoneCapturedAt;
      const capturedDate = parseDate(capturedAt);
      if (!phone || !capturedAt || !Number.isFinite(capturedDate.getTime())) continue;
      const current = earliestByPhone.get(phone);
      if (!current || capturedDate < current.capturedDate) {
        earliestByPhone.set(phone, { phone, capturedAt, capturedDate, contact });
      }
    }
    const captures = [...earliestByPhone.values()];
    return range ? captures.filter(capture => inAnalyticsRange(capture.capturedAt, range)) : captures;
  }

  const localDayKey = value => {
    const date = parseDate(value);
    if (!Number.isFinite(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const followUpStatus = item => {
    if (item?.status) return item.status;
    if (item?.completedAt) return "completed";
    if (item?.deletedAt) return "deleted";
    if (item?.canceledAt) return "canceled";
    return "scheduled";
  };

  const pipelineEventStage = event => String(event?.toStage || event?.stage || "");

  const daysBetween = (later, earlier) => Math.max(0, Math.round((startOfDay(later) - startOfDay(earlier)) / 86400000));

  function stageEntryDate(contact, stage) {
    const values = [
      contact?.stageDates?.[stage],
      ...(contact?.stageEvents || [])
        .filter(event => pipelineEventStage(event) === stage)
        .map(event => event.occurredAt)
    ].filter(value => Number.isFinite(parseDate(value).getTime()));
    return values.sort((left, right) => parseDate(right) - parseDate(left))[0] || null;
  }

  function contactMatchesPlace(contact, place) {
    if (contact?.placeId && place?.id) return String(contact.placeId) === String(place.id);
    return Boolean(contact?.placeName && place?.name && String(contact.placeName).trim().toLowerCase() === String(place.name).trim().toLowerCase());
  }

  function buildInsightsModel({ contacts = [], places = [], range, pipelines = {}, dailyGoal = 5, resolveCurrentStage = null, now = new Date(), stallDays = 21 } = {}) {
    if (!range?.start || !range?.end) throw new TypeError("An analytics range is required");
    const validRoles = ["Prospect", "Customer"];
    const stageSets = Object.fromEntries(validRoles.map(role => [role, new Set(pipelines[role] || [])]));
    const pipelineStageSet = new Set(validRoles.flatMap(role => pipelines[role] || []));
    const standaloneStageSet = new Set(["MSA", "DTM"]);
    const currentStage = contact => {
      const candidate = resolveCurrentStage ? resolveCurrentStage(contact) : (pipelines[contact?.role] || []).findLast(stage => Boolean(contact?.stages?.[stage]));
      return stageSets[contact?.role]?.has(candidate) ? candidate : "";
    };
    const allLogs = contacts.flatMap(contact => (contact.conversations || []).map(log => ({ ...log, contact })));
    const conversations = allLogs.filter(log => log.isCountedConversation && inAnalyticsRange(log.conversationDate || log.createdAt, range));
    const communications = allLogs.filter(log => log.communicationType && inAnalyticsRange(log.conversationDate || log.createdAt, range));
    const newPeople = contacts.filter(contact => inAnalyticsRange(contact.dateFirstMet, range));
    const stageEvents = contacts.flatMap(contact => (contact.stageEvents || []).map(event => ({ contact, event, stage: pipelineEventStage(event) })));
    const pipelineEvents = stageEvents
      .filter(item => pipelineStageSet.has(item.stage) && inAnalyticsRange(item.event.occurredAt, range));
    const standaloneEvents = stageEvents
      .filter(item => standaloneStageSet.has(item.stage) && inAnalyticsRange(item.event.occurredAt, range));
    const allFollowUps = contacts.flatMap(contact => (contact.followUps || []).map(item => ({ ...item, contact })));
    // Preserve Bridge's established completion denominator: non-deleted follow-ups
    // whose created date (or due date when createdAt is absent) falls in the period.
    const followUps = allFollowUps.filter(item => followUpStatus(item) !== "deleted" && inAnalyticsRange(item.createdAt || item.dueDate, range));
    const completedFollowUps = followUps.filter(item => followUpStatus(item) === "completed");
    const daySeries = [];
    for (let cursor = startOfDay(range.start), end = startOfDay(range.end); cursor <= end; cursor = addDays(cursor, 1)) {
      const date = new Date(cursor);
      const dateKey = localDayKey(date);
      daySeries.push({
        date: dateKey,
        label: new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(date),
        value: conversations.filter(log => localDayKey(log.conversationDate || log.createdAt) === dateKey).length
      });
    }
    const goal = Math.max(1, Number(dailyGoal) || 5);
    const goalDays = daySeries.filter(day => day.value >= goal).length;
    const currentStageCounts = Object.fromEntries(validRoles.map(role => [role, Object.fromEntries((pipelines[role] || []).map(stage => [stage, 0]))]));
    contacts.filter(contact => !contact.archivedAt && !contact.isFilteredOut).forEach(contact => {
      const stage = currentStage(contact);
      if (stage && currentStageCounts[contact.role]) currentStageCounts[contact.role][stage] += 1;
    });
    const stalledRelationships = contacts.filter(contact => !contact.archivedAt && !contact.isFilteredOut && validRoles.includes(contact.role)).map(contact => {
      const stage = currentStage(contact);
      const enteredAt = stage ? stageEntryDate(contact, stage) : null;
      const ageDays = enteredAt ? daysBetween(now, enteredAt) : null;
      return { contact, role: contact.role, stage, enteredAt, ageDays };
    }).filter(item => item.stage && item.ageDays !== null && item.ageDays > stallDays).sort((left, right) => right.ageDays - left.ageDays);
    const placeActivity = places.map(place => {
      const linkedContacts = contacts.filter(contact => contactMatchesPlace(contact, place));
      const linkedIds = new Set(linkedContacts.map(contact => String(contact.id)));
      const recordedConversations = conversations.filter(log => linkedIds.has(String(log.contact.id))).length;
      const movements = pipelineEvents.filter(item => linkedIds.has(String(item.contact.id))).length;
      const activePeople = linkedContacts.filter(contact => !contact.archivedAt && !contact.isFilteredOut).length;
      return { place, recordedConversations, movements, activePeople };
    }).filter(item => item.recordedConversations || item.movements)
      .sort((left, right) => right.recordedConversations - left.recordedConversations || right.movements - left.movements || right.activePeople - left.activePeople || String(left.place.name).localeCompare(String(right.place.name)));
    const communicationOutcomes = communications.reduce((counts, log) => {
      const label = String(log.outcome || log.direction || log.communicationType || "Other");
      counts[label] = (counts[label] || 0) + 1;
      return counts;
    }, {});
    return {
      conversations,
      newPeople,
      pipelineEvents,
      standaloneEvents,
      followUps,
      completedFollowUps,
      followUpCompletion: followUps.length ? Math.round(completedFollowUps.length / followUps.length * 100) : null,
      daySeries,
      goal,
      goalDays,
      goalConsistency: conversations.length ? Math.round(goalDays / daySeries.length * 100) : null,
      currentStageCounts,
      stalledRelationships,
      placeActivity,
      communicationOutcomes,
      communications
    };
  }

  global.BridgeAnalytics = Object.freeze({ analyticsRange, buildInsightsModel, dateRangeLabel, inAnalyticsRange, normalizePhone, uniquePhoneCaptures });
})(globalThis);
