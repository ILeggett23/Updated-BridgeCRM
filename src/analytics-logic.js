(function installBridgeAnalyticsLogic(global) {
  const asArray = value => Array.isArray(value) ? value : [];
  const asObject = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const isValidDate = value => value instanceof Date && Number.isFinite(value.getTime());
  const finiteNumber = value => {
    if (value === null || value === undefined || value === "") return null;
    try {
      const result = Number(value);
      return Number.isFinite(result) ? result : null;
    } catch {
      return null;
    }
  };
  const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
  const validDateOnly = text => {
    const [year, month, day] = text.split("-").map(Number);
    const date = new Date(`${text}T12:00:00`);
    return isValidDate(date) && date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
  };

  const parseDate = value => {
    if (value instanceof Date) return new Date(value.getTime());
    if (typeof value === "number") return Number.isFinite(value) ? new Date(value) : new Date(NaN);
    if (value === null || value === undefined || value === "") return new Date(NaN);
    try {
      const text = String(value).trim();
      if (!text) return new Date(NaN);
      if (DATE_ONLY.test(text) && !validDateOnly(text)) return new Date(NaN);
      return new Date(DATE_ONLY.test(text) ? `${text}T12:00:00` : text);
    } catch {
      return new Date(NaN);
    }
  };
  const activityDateValue = item => {
    for (const value of [item?.conversationDate, item?.createdAt]) {
      if (isValidDate(parseDate(value))) return value;
    }
    return null;
  };
  const hasTimeOfDay = value => {
    if (value instanceof Date || typeof value === "number") return isValidDate(parseDate(value));
    if (typeof value !== "string") return false;
    return /(?:T|\s)\d{2}:\d{2}/.test(value.trim()) && isValidDate(parseDate(value));
  };
  const eventDateValue = item => {
    for (const value of [item?.occurredAt, item?.date]) {
      if (isValidDate(parseDate(value))) return value;
    }
    return null;
  };
  const followUpDateValue = item => {
    for (const value of [item?.createdAt, item?.dueDate]) {
      if (isValidDate(parseDate(value))) return value;
    }
    return null;
  };

  const startOfDay = value => {
    const date = parseDate(value);
    if (!isValidDate(date)) return date;
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const endOfDay = value => {
    const date = parseDate(value);
    if (!isValidDate(date)) return date;
    date.setHours(23, 59, 59, 999);
    return date;
  };

  const addDays = (value, amount) => {
    const date = parseDate(value);
    if (!isValidDate(date)) return date;
    date.setDate(date.getDate() + amount);
    return date;
  };

  const fullDate = date => new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);

  function dateRangeLabel(start, end) {
    if (!isValidDate(start) || !isValidDate(end)) return "Unknown date";
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

  function analyticsRange({ mode = "week", anchor, customStart, customEnd, weekStart = 0 } = {}) {
    const suppliedAnchor = parseDate(anchor);
    const anchorDate = isValidDate(suppliedAnchor) ? suppliedAnchor : new Date();
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
      const suppliedStart = parseDate(customStart);
      const suppliedEnd = parseDate(customEnd);
      let start = startOfDay(isValidDate(suppliedStart) ? suppliedStart : anchorDate);
      let end = endOfDay(isValidDate(suppliedEnd) ? suppliedEnd : (isValidDate(suppliedStart) ? suppliedStart : anchorDate));
      if (start > end) [start, end] = [startOfDay(end), endOfDay(start)];
      return { start, end, label: dateRangeLabel(start, end) };
    }
    const day = startOfDay(anchorDate);
    const suppliedWeekStart = finiteNumber(weekStart);
    const normalizedWeekStart = suppliedWeekStart !== null
      ? ((Math.trunc(suppliedWeekStart) % 7) + 7) % 7
      : 0;
    const delta = (day.getDay() - normalizedWeekStart + 7) % 7;
    const start = addDays(day, -delta);
    const end = endOfDay(addDays(start, 6));
    return { start, end, label: dateRangeLabel(start, end) };
  }

  function inAnalyticsRange(value, range) {
    const date = parseDate(value);
    if (!isValidDate(date) || !range || typeof range !== "object") return false;
    const start = typeof range.start === "string" && DATE_ONLY.test(range.start.trim()) ? startOfDay(range.start) : parseDate(range.start);
    const end = typeof range.end === "string" && DATE_ONLY.test(range.end.trim()) ? endOfDay(range.end) : parseDate(range.end);
    return isValidDate(start) && isValidDate(end) && date >= start && date <= end;
  }

  function normalizePhone(value) {
    const identity = global.BridgeCommunication?.phoneIdentity?.(value);
    if (identity) return identity.startsWith("1") && identity.length === 11 ? identity.slice(1) : identity;
    let digits = "";
    try { digits = String(value ?? "").replace(/\D/g, ""); } catch { return ""; }
    if (digits.length < 8 || digits.length > 15) return "";
    return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  }

  function uniquePhoneCaptures(contacts, range = null) {
    const earliestByPhone = new Map();
    for (const contact of asArray(contacts)) {
      if (!contact || typeof contact !== "object") continue;
      const phone = normalizePhone(contact.capturedPhoneNumber || "");
      const capturedAt = contact.phoneCapturedAt;
      const capturedDate = parseDate(capturedAt);
      if (!phone || capturedAt === null || capturedAt === undefined || capturedAt === "" || !isValidDate(capturedDate)) continue;
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
    if (!isValidDate(date)) return "";
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

  const daysBetween = (later, earlier) => {
    const laterDay = startOfDay(later);
    const earlierDay = startOfDay(earlier);
    if (!isValidDate(laterDay) || !isValidDate(earlierDay)) return null;
    return Math.max(0, Math.round((laterDay - earlierDay) / 86400000));
  };

  function stageEntryDate(contact, stage) {
    const values = [
      contact?.stageDates?.[stage],
      ...asArray(contact?.stageEvents)
        .filter(event => pipelineEventStage(event) === stage)
        .map(eventDateValue)
    ].filter(value => isValidDate(parseDate(value)));
    return values.sort((left, right) => parseDate(right) - parseDate(left))[0] || null;
  }

  const hasValue = value => {
    if (value === null || value === undefined) return false;
    try { return String(value).trim() !== ""; } catch { return false; }
  };

  function contactMatchesPlace(contact, place) {
    if (hasValue(contact?.placeId) && hasValue(place?.id)) return String(contact.placeId) === String(place.id);
    return Boolean(hasValue(contact?.placeName) && hasValue(place?.name) && String(contact.placeName).trim().toLowerCase() === String(place.name).trim().toLowerCase());
  }

  function buildInsightsModel(options = {}) {
    const input = asObject(options);
    const suppliedRange = input.range;
    if (!suppliedRange || typeof suppliedRange !== "object") throw new TypeError("An analytics range is required");
    const suppliedStart = parseDate(suppliedRange.start);
    const suppliedEnd = parseDate(suppliedRange.end);
    let range;
    if (isValidDate(suppliedStart) && isValidDate(suppliedEnd)) {
      const boundaries = [
        { value: suppliedStart, dateOnly: typeof suppliedRange.start === "string" && DATE_ONLY.test(suppliedRange.start.trim()) },
        { value: suppliedEnd, dateOnly: typeof suppliedRange.end === "string" && DATE_ONLY.test(suppliedRange.end.trim()) }
      ].sort((left, right) => left.value - right.value);
      const start = boundaries[0].dateOnly ? startOfDay(boundaries[0].value) : boundaries[0].value;
      const end = boundaries[1].dateOnly ? endOfDay(boundaries[1].value) : boundaries[1].value;
      range = { ...suppliedRange, start, end };
    } else {
      const fallback = new Date();
      range = { ...suppliedRange, start: startOfDay(fallback), end: endOfDay(fallback) };
    }
    const contacts = asArray(input.contacts).filter(contact => contact && typeof contact === "object");
    const places = asArray(input.places).filter(place => place && typeof place === "object");
    const pipelines = asObject(input.pipelines);
    const validRoles = ["Prospect", "Customer"];
    const pipelineFor = role => asArray(pipelines[role]).filter(stage => typeof stage === "string" && stage);
    const stageSets = Object.fromEntries(validRoles.map(role => [role, new Set(pipelineFor(role))]));
    const pipelineStageSet = new Set(validRoles.flatMap(role => pipelineFor(role)));
    const standaloneStageSet = new Set(["MSA", "DTM"]);
    const currentStage = contact => {
      let candidate = "";
      if (typeof input.resolveCurrentStage === "function") {
        try { candidate = input.resolveCurrentStage(contact); } catch { candidate = ""; }
      }
      if (!candidate) {
        const stages = pipelineFor(contact?.role);
        for (let index = stages.length - 1; index >= 0; index -= 1) {
          if (Boolean(contact?.stages?.[stages[index]]?.isComplete ?? contact?.stages?.[stages[index]])) {
            candidate = stages[index];
            break;
          }
        }
      }
      return stageSets[contact?.role]?.has(candidate) ? candidate : "";
    };
    const allLogs = contacts.flatMap(contact => asArray(contact.conversations)
      .filter(log => log && typeof log === "object")
      .map(log => ({ ...log, contact })));
    const conversations = allLogs.filter(log => log.isCountedConversation && inAnalyticsRange(activityDateValue(log), range));
    const communications = allLogs.filter(log => log.communicationType && inAnalyticsRange(activityDateValue(log), range));
    const newPeople = contacts.filter(contact => inAnalyticsRange(contact.dateFirstMet, range));
    const stageEvents = contacts.flatMap(contact => asArray(contact.stageEvents)
      .filter(event => event && typeof event === "object")
      .map(event => ({ contact, event, stage: pipelineEventStage(event) })));
    const pipelineEvents = stageEvents
      .filter(item => pipelineStageSet.has(item.stage) && inAnalyticsRange(eventDateValue(item.event), range));
    const standaloneEvents = stageEvents
      .filter(item => standaloneStageSet.has(item.stage) && inAnalyticsRange(eventDateValue(item.event), range));
    const allFollowUps = contacts.flatMap(contact => asArray(contact.followUps)
      .filter(item => item && typeof item === "object")
      .map(item => ({ ...item, contact })));
    // Preserve Bridge's established completion denominator: non-deleted follow-ups
    // whose created date (or due date when createdAt is absent) falls in the period.
    const followUps = allFollowUps.filter(item => followUpStatus(item) !== "deleted" && inAnalyticsRange(followUpDateValue(item), range));
    const completedFollowUps = followUps.filter(item => followUpStatus(item) === "completed");
    const nowDate = parseDate(input.now);
    const safeNow = isValidDate(nowDate) ? nowDate : new Date();
    const todayKey = localDayKey(safeNow);
    const daySeries = [];
    const seriesStart = startOfDay(range.start);
    const seriesEnd = startOfDay(range.end);
    for (let cursor = seriesStart, index = 0; isValidDate(cursor) && isValidDate(seriesEnd) && cursor.getTime() <= seriesEnd.getTime() && index < 100000; cursor = addDays(cursor, 1), index += 1) {
      const date = new Date(cursor);
      const dateKey = localDayKey(date);
      daySeries.push({
        date: dateKey,
        label: new Intl.DateTimeFormat(undefined, { weekday: "narrow" }).format(date),
        weekday: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date),
        weekdayIndex: date.getDay(),
        day: date.getDate(),
        month: new Intl.DateTimeFormat(undefined, { month: "short" }).format(date),
        isWeekStart: date.getDay() === 0,
        isToday: dateKey === todayKey,
        value: conversations.filter(log => localDayKey(activityDateValue(log)) === dateKey).length
      });
    }
    const timedConversations = conversations.filter(log => hasTimeOfDay(activityDateValue(log)));
    const hourSeries = Array.from({ length: 12 }, (_, index) => {
      const startHour = index * 2;
      const endHour = startHour + 2;
      return {
        startHour,
        endHour,
        value: timedConversations.filter(log => parseDate(activityDateValue(log)).getHours() >= startHour && parseDate(activityDateValue(log)).getHours() < endHour).length
      };
    });
    const dailyGoalValue = finiteNumber(input.dailyGoal);
    const goal = dailyGoalValue !== null && dailyGoalValue > 0 ? Math.max(1, Math.round(dailyGoalValue)) : 5;
    const goalDays = daySeries.filter(day => day.value >= goal).length;
    const currentStageCounts = Object.fromEntries(validRoles.map(role => [role, Object.fromEntries(pipelineFor(role).map(stage => [stage, 0]))]));
    contacts.filter(contact => !contact.archivedAt && !contact.isFilteredOut).forEach(contact => {
      const stage = currentStage(contact);
      if (stage && currentStageCounts[contact.role]) currentStageCounts[contact.role][stage] += 1;
    });
    const suppliedStallDays = finiteNumber(input.stallDays);
    const safeStallDays = suppliedStallDays !== null ? Math.max(0, suppliedStallDays) : 21;
    const stalledRelationships = contacts.filter(contact => !contact.archivedAt && !contact.isFilteredOut && validRoles.includes(contact.role)).map(contact => {
      const stage = currentStage(contact);
      const enteredAt = stage ? stageEntryDate(contact, stage) : null;
      const ageDays = enteredAt ? daysBetween(safeNow, enteredAt) : null;
      return { contact, role: contact.role, stage, enteredAt, ageDays };
    }).filter(item => item.stage && Number.isFinite(item.ageDays) && item.ageDays > safeStallDays).sort((left, right) => right.ageDays - left.ageDays);
    const placeActivity = places.map(place => {
      const linkedContacts = contacts.filter(contact => contactMatchesPlace(contact, place));
      const linkedIds = new Set(linkedContacts.map(contact => String(contact.id)));
      const recordedConversations = conversations.filter(log => linkedIds.has(String(log.contact?.id))).length;
      const movements = pipelineEvents.filter(item => linkedIds.has(String(item.contact?.id))).length;
      const activePeople = linkedContacts.filter(contact => !contact.archivedAt && !contact.isFilteredOut).length;
      return { place, recordedConversations, movements, activePeople };
    }).filter(item => item.recordedConversations || item.movements)
      .sort((left, right) => right.recordedConversations - left.recordedConversations || right.movements - left.movements || right.activePeople - left.activePeople || String(left.place?.name || "").localeCompare(String(right.place?.name || "")));
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
      hourSeries,
      timedConversationCount: timedConversations.length,
      unavailableConversationCount: conversations.length - timedConversations.length,
      goal,
      goalDays,
      goalConsistency: conversations.length && daySeries.length ? Math.round(goalDays / daySeries.length * 100) : null,
      currentStageCounts,
      stalledRelationships,
      placeActivity,
      communicationOutcomes,
      communications
    };
  }

  global.BridgeAnalytics = Object.freeze({ analyticsRange, buildInsightsModel, dateRangeLabel, inAnalyticsRange, normalizePhone, uniquePhoneCaptures });
})(globalThis);
