(function installBridgeContactLogic(global) {
  const asArray = value => Array.isArray(value) ? value : [];
  const asObject = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const number = value => {
    if (value === null || value === undefined || value === "") return null;
    try {
      const result = Number(value);
      return Number.isFinite(result) ? result : null;
    } catch {
      return null;
    }
  };
  const validDateOnly = text => {
    const [year, month, day] = text.split("-").map(Number);
    const date = new Date(`${text}T12:00:00`);
    return Number.isFinite(date.getTime()) && date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
  };
  const time = value => {
    if (value === null || value === undefined || value === "") return null;
    try {
      if (typeof value === "string") {
        const text = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(text) && !validDateOnly(text)) return null;
      }
      const result = value instanceof Date ? value.getTime() : new Date(value).getTime();
      return Number.isFinite(result) ? result : null;
    } catch {
      return null;
    }
  };

  const dateBoundary = (value, end = false) => {
    if (value instanceof Date || typeof value === "number") {
      const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
      if (!Number.isFinite(date.getTime())) return null;
      date.setHours(end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0);
      return date.getTime();
    }
    const text = String(value ?? "").trim();
    if (!text) return null;
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(text) && !validDateOnly(text)) return null;
      const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
        ? new Date(`${text}T${end ? "23:59:59.999" : "00:00:00"}`)
        : new Date(text);
      return Number.isFinite(date.getTime()) ? date.getTime() : null;
    } catch {
      return null;
    }
  };

  const comparisonValue = value => {
    if (value instanceof Date) return time(value);
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    return time(value);
  };

  const stageIsSelected = value => Boolean(value?.isComplete ?? value);
  const activityTime = log => time(log?.conversationDate) ?? time(log?.createdAt);

  function latestConversationTime(contact) {
    const values = asArray(contact?.conversations)
      .map(activityTime)
      .filter(value => value !== null);
    return values.length ? Math.max(...values) : null;
  }

  function hasConversationInRange(contact, from, to) {
    if (!from && !to) return true;
    let start = from ? dateBoundary(from) : -Infinity;
    let end = to ? dateBoundary(to, true) : Infinity;
    if (start === null || end === null) return false;
    if (start > end) [start, end] = [end, start];
    return asArray(contact?.conversations).some(log => {
      const value = activityTime(log);
      return value !== null && value >= start && value <= end;
    });
  }

  function sortContacts(contacts, sort, interestRank, nextFollowUpTime) {
    const source = asArray(contacts);
    const ranks = asObject(interestRank);
    const followUp = typeof nextFollowUpTime === "function" ? nextFollowUpTime : () => null;
    return [...source].sort((a, b) => {
      if (sort === "recentConversation" || sort === "oldestConversation") {
        const aTime = latestConversationTime(a);
        const bTime = latestConversationTime(b);
        if (aTime === null && bTime === null) return 0;
        if (aTime === null) return 1;
        if (bTime === null) return -1;
        return sort === "recentConversation" ? bTime - aTime : aTime - bTime;
      }
      if (sort === "followup") {
        const aTime = comparisonValue(followUp(a));
        const bTime = comparisonValue(followUp(b));
        if (aTime === null && bTime === null) return 0;
        if (aTime === null) return 1;
        if (bTime === null) return -1;
        return bTime === aTime ? 0 : aTime - bTime;
      }
      if (sort === "interest") {
        const aRank = number(ranks[a?.interestLevel]) ?? Number.MAX_SAFE_INTEGER;
        const bRank = number(ranks[b?.interestLevel]) ?? Number.MAX_SAFE_INTEGER;
        return aRank === bRank ? 0 : aRank - bRank;
      }
      return (time(b?.createdAt) || 0) - (time(a?.createdAt) || 0);
    });
  }

  function lastRelevantActivityTime(contact) {
    const values = [time(contact?.createdAt), time(contact?.updatedAt), latestConversationTime(contact)];
    Object.values(asObject(contact?.stageDates)).forEach(value => values.push(time(value)));
    asArray(contact?.stageEvents).forEach(event => values.push(time(event?.occurredAt || event?.date)));
    asArray(contact?.followUps).forEach(followUp => {
      values.push(
        time(followUp?.createdAt),
        time(followUp?.updatedAt),
        time(followUp?.completedAt),
        time(followUp?.canceledAt),
        time(followUp?.deletedAt)
      );
    });
    const valid = values.filter(value => value !== null);
    return valid.length ? Math.max(...valid) : null;
  }

  function shouldArchiveContact(contact, now = Date.now()) {
    if (!contact || typeof contact !== "object") return false;
    const nowTime = time(now) ?? Date.now();
    if (contact.archivedAt || contact.role !== "Prospect" || contact.isFilteredOut) return false;
    if (Object.values(asObject(contact.stages)).some(stageIsSelected)) return false;
    if (asArray(contact.followUps).some(followUp => {
      if (followUp?.status) return ["scheduled", "open"].includes(followUp.status);
      return !followUp?.completedAt && !followUp?.canceledAt && !followUp?.deletedAt;
    })) return false;
    const checkBack = time(contact.checkBackDate);
    if (checkBack !== null && checkBack > nowTime) return false;
    const lastActivity = lastRelevantActivityTime(contact);
    if (lastActivity === null || lastActivity > nowTime) return false;
    const inactiveFor = nowTime - lastActivity;
    return inactiveFor >= 30 * 24 * 60 * 60 * 1000;
  }

  function archiveInactiveContacts(contacts, enabled, now = Date.now()) {
    if (!enabled) return 0;
    const nowTime = time(now) ?? Date.now();
    let archived = 0;
    asArray(contacts).forEach(contact => {
      if (!shouldArchiveContact(contact, nowTime)) return;
      contact.archivedAt = new Date(nowTime).toISOString();
      contact.archiveReason = "inactive-30-days";
      archived += 1;
    });
    return archived;
  }

  function restoreContact(contact, restoredAt = new Date().toISOString()) {
    if (!contact || typeof contact !== "object") return contact;
    contact.archivedAt = null;
    contact.archiveReason = null;
    contact.updatedAt = time(restoredAt) === null ? new Date().toISOString() : restoredAt;
    return contact;
  }

  function setFilteredOut(contact, filtered, changedAt = new Date().toISOString()) {
    if (!contact || typeof contact !== "object") return contact;
    if (contact.role === "Team") {
      contact.isFilteredOut = false;
      contact.filteredOutAt = null;
      return contact;
    }
    contact.isFilteredOut = Boolean(filtered);
    contact.filteredOutAt = filtered ? (contact.filteredOutAt || (time(changedAt) === null ? new Date().toISOString() : changedAt)) : null;
    return contact;
  }

  function latestStageEventTime(contact, stage) {
    const values = asArray(contact?.stageEvents)
      .filter(event => (event?.toStage || event?.stage) === stage)
      .map(event => time(event?.occurredAt || event?.date))
      .filter(value => value !== null);
    return values.length ? Math.max(...values) : null;
  }

  function resolveCurrentPipelineStage(contact, validStages) {
    const stages = Array.isArray(validStages) ? [...new Set(validStages.filter(stage => typeof stage === "string" && stage))] : [];
    const selected = stages.filter(stage => stageIsSelected(contact?.stages?.[stage]));
    if (!selected.length) return "";
    const withEvents = selected
      .map(stage => ({ stage, occurredAt: latestStageEventTime(contact, stage) }))
      .filter(item => item.occurredAt !== null)
      .sort((a, b) => b.occurredAt - a.occurredAt);
    if (withEvents.length) return withEvents[0].stage;
    const withDates = selected
      .map(stage => ({ stage, occurredAt: time(contact.stageDates?.[stage]) }))
      .filter(item => item.occurredAt !== null)
      .sort((a, b) => b.occurredAt - a.occurredAt);
    if (withDates.length) return withDates[0].stage;
    return selected.sort((a, b) => stages.indexOf(b) - stages.indexOf(a))[0];
  }

  function normalizePipelineStages(contact, validStages) {
    if (!contact || typeof contact !== "object") return "";
    contact.stages = contact.stages && typeof contact.stages === "object" && !Array.isArray(contact.stages) ? contact.stages : {};
    const stages = Array.isArray(validStages) ? [...new Set(validStages.filter(stage => typeof stage === "string" && stage))] : [];
    Object.keys(contact.stages).forEach(stage => {
      if (stage !== "MSA" && stage !== "DTM" && !stages.includes(stage)) contact.stages[stage] = false;
    });
    const current = resolveCurrentPipelineStage(contact, stages);
    stages.forEach(stage => { contact.stages[stage] = stage === current; });
    return current;
  }

  function matchesVisibilityFilter(contact, filter = "Active") {
    if (!contact || typeof contact !== "object") return false;
    if (filter === "All") return true;
    if (filter === "Archived") return Boolean(contact.archivedAt);
    if (filter === "No-Go") return !contact.archivedAt && Boolean(contact.isFilteredOut);
    return !contact.archivedAt && !contact.isFilteredOut;
  }

  global.BridgeLogic = Object.freeze({
    archiveInactiveContacts,
    hasConversationInRange,
    lastRelevantActivityTime,
    latestConversationTime,
    matchesVisibilityFilter,
    normalizePipelineStages,
    resolveCurrentPipelineStage,
    restoreContact,
    setFilteredOut,
    shouldArchiveContact,
    sortContacts
  });
})(globalThis);
