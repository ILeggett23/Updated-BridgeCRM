(function installBridgeEngagementLogic(global) {
  const PIPELINE_STAGES = new Set(["PQI", "QI/P", "FUP", "LA", "CNA", "Proposal", "Follow-Up", "Order Placed", "Active Customer"]);
  const pipelineEventStage = event => String(event?.toStage || event?.stage || "");
  const asArray = value => Array.isArray(value) ? value : [];
  const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
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
      if (DATE_ONLY.test(text) && !validDateOnly(text)) return new Date(NaN);
      return text ? new Date(DATE_ONLY.test(text) ? `${text}T12:00:00` : text) : new Date(NaN);
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
  function todaySwipeDecision(input = {}) {
    const { dx = 0, dy = 0, velocityX = 0, width = 0 } = input && typeof input === "object" ? input : {};
    const horizontalDistance = finiteNumber(dx);
    const verticalDistance = finiteNumber(dy);
    const horizontalVelocity = finiteNumber(velocityX);
    const viewportWidth = finiteNumber(width);
    if ([horizontalDistance, verticalDistance, horizontalVelocity, viewportWidth].some(value => value === null)) return "";
    const horizontal = Math.abs(horizontalDistance) > Math.abs(verticalDistance) * 1.15;
    if (!horizontal) return "";
    const threshold = Math.min(120, Math.max(84, Math.max(0, viewportWidth) * .28));
    const sameDirection = horizontalDistance !== 0 && horizontalVelocity !== 0 && Math.sign(horizontalDistance) === Math.sign(horizontalVelocity);
    const flick = Math.abs(horizontalDistance) >= 32 && Math.abs(horizontalVelocity) >= .55 && sameDirection;
    return Math.abs(horizontalDistance) >= threshold || flick ? (horizontalDistance < 0 ? "done" : "reschedule") : "";
  }

  const dayKey = value => {
    const date = value === undefined || value === null || value === "" ? new Date() : parseDate(value);
    if (!isValidDate(date)) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };

  function normalizeExcludedDates(value) {
    if (!Array.isArray(value)) return [];
    const valid = value.filter(item => {
      if (typeof item !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item)) return false;
      const [year, month, day] = item.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    });
    return [...new Set(valid)].sort();
  }

  function normalizeRestRules(value) {
    if (!Array.isArray(value)) return [];
    const normalized = value.flatMap(rule => {
      if (!rule || typeof rule !== "object") return [];
      if (rule.frequency === "weekly") {
        const weekdays = [...new Set((Array.isArray(rule.weekdays) ? rule.weekdays : []).map(finiteNumber).filter(day => day !== null && Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b);
        return weekdays.length ? [{ frequency: "weekly", weekdays }] : [];
      }
      if (rule.frequency === "monthly") {
        const day = finiteNumber(rule.day);
        return day !== null && Number.isInteger(day) && day >= 1 && day <= 31 ? [{ frequency: "monthly", day }] : [];
      }
      if (rule.frequency === "yearly") {
        const date = String(rule.date || "");
        if (!/^\d{2}-\d{2}$/.test(date)) return [];
        const [month, day] = date.split("-").map(Number);
        const candidate = new Date(2000, month - 1, day);
        return candidate.getMonth() === month - 1 && candidate.getDate() === day ? [{ frequency: "yearly", date }] : [];
      }
      return [];
    });
    const seen = new Set();
    return normalized.filter(rule => {
      const key = rule.frequency === "weekly" ? `weekly:${rule.weekdays.join(",")}` : rule.frequency === "monthly" ? `monthly:${rule.day}` : `yearly:${rule.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function matchesRestRule(date, rule) {
    if (!isValidDate(date) || !rule || typeof rule !== "object") return false;
    if (rule.frequency === "weekly") return Array.isArray(rule.weekdays) && rule.weekdays.includes(date.getDay());
    if (rule.frequency === "monthly") return date.getDate() === rule.day;
    if (rule.frequency === "yearly") return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` === rule.date;
    return false;
  }

  function dailyGoalMetrics(state, now = new Date()) {
    const source = state && typeof state === "object" ? state : {};
    const settings = source.settings && typeof source.settings === "object" ? source.settings : {};
    const nowDate = parseDate(now);
    const safeNow = isValidDate(nowDate) ? nowDate : new Date();
    const goalValue = finiteNumber(settings.dailyGoal);
    const goal = goalValue !== null && goalValue > 0 ? Math.max(1, Math.round(goalValue)) : 5;
    const today = dayKey(safeNow);
    const counts = new Map();
    const excludedDates = normalizeExcludedDates(settings.streakExcludedDates);
    const restRules = normalizeRestRules(settings.streakRestRules);
    const excludedDays = new Set(excludedDates.filter(key => key <= today));
    const isExcludedDay = date => excludedDays.has(dayKey(date)) || restRules.some(rule => matchesRestRule(date, rule));

    asArray(source.contacts).forEach(contact => {
      asArray(contact?.conversations).forEach(log => {
        if (!log || typeof log !== "object" || !log.isCountedConversation) return;
        const occurredAt = parseDate(activityDateValue(log));
        if (!isValidDate(occurredAt) || occurredAt > safeNow) return;
        const key = dayKey(occurredAt);
        if (!key || key > today) return;
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });

    const completedDays = new Set([...counts].filter(([, count]) => count >= goal).map(([key]) => key));
    const todayDate = new Date(safeNow.getFullYear(), safeNow.getMonth(), safeNow.getDate());
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = dayKey(yesterdayDate);
    const todayComplete = completedDays.has(today);
    const yesterdayComplete = completedDays.has(yesterday);
    const todayExcluded = isExcludedDay(todayDate);

    // Keep the last earned streak visible while today's goal is still in progress.
    // Rest days are neutral: they preserve continuity but never add to the streak.
    const streakEndDate = todayComplete || todayExcluded ? todayDate : yesterdayDate;
    let goalStreak = 0;
    if (completedDays.size) {
      const earliestCompletedDay = [...completedDays].sort()[0];
      const cursor = new Date(streakEndDate);
      // A malformed or over-broad recurring rule must not make this loop run
      // forever. Once we move before the oldest completed day there is no
      // completed day left that can contribute to this streak.
      for (let steps = 0; steps < 100000; steps += 1) {
        const key = dayKey(cursor);
        if (!key || (earliestCompletedDay && key < earliestCompletedDay)) break;
        if (isExcludedDay(cursor)) {
          cursor.setDate(cursor.getDate() - 1);
          continue;
        }
        if (!completedDays.has(key)) break;
        goalStreak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
    }

    return {
      goal,
      today,
      todayCount: counts.get(today) || 0,
      todayComplete,
      yesterday,
      yesterdayComplete,
      completedDayCount: completedDays.size,
      goalStreak,
      excludedDates,
      restRules,
      todayExcluded
    };
  }

  function achievementMetrics(state) {
    const source = state && typeof state === "object" ? state : {};
    const contacts = asArray(source.contacts).filter(contact => contact && typeof contact === "object");
    const counted = contacts.flatMap(contact => asArray(contact.conversations)).filter(log => log && typeof log === "object" && log.isCountedConversation);
    const dailyGoal = dailyGoalMetrics(state);
    const followUps = contacts.flatMap(contact => asArray(contact.followUps)).filter(item => item && typeof item === "object");
    const completedFollowUps = followUps.filter(item => item.status === "completed" || item.completedAt).length;
    const pipelineEvents = contacts.flatMap(contact => asArray(contact.stageEvents)).filter(event => event && typeof event === "object" && PIPELINE_STAGES.has(pipelineEventStage(event)));
    return {
      contacts: contacts.length,
      conversations: counted.length,
      followUpsScheduled: followUps.length,
      followUpsCompleted: completedFollowUps,
      pipelineMoves: pipelineEvents.length,
      launches: contacts.flatMap(contact => asArray(contact.stageEvents)).filter(event => event && typeof event === "object" && pipelineEventStage(event) === "LA").length,
      favoritePlaces: asArray(source.places).filter(place => place && typeof place === "object" && place.isFavorite).length,
      savedPlaces: asArray(source.places).filter(place => place && typeof place === "object").length,
      goalDays: dailyGoal.completedDayCount,
      goalStreak: dailyGoal.goalStreak
    };
  }

  const definitions = [
    { id: "first-contact", category: "Getting Started", name: "First Connection", description: "Add your first contact.", metric: "contacts", target: 1, icon: "userPlus" },
    { id: "first-conversation", category: "Getting Started", name: "Conversation Starter", description: "Log your first counted conversation.", metric: "conversations", target: 1, icon: "chat" },
    { id: "bridge-builder", category: "Getting Started", name: "Bridge Builder", description: "Build a list of 5 contacts.", metric: "contacts", target: 5, icon: "link" },
    { id: "getting-organized", category: "Getting Started", name: "Getting Organized", description: "Schedule your first follow-up.", metric: "followUpsScheduled", target: 1, icon: "calendarCheck" },
    { id: "first-step-forward", category: "Getting Started", name: "First Step Forward", description: "Move a contact into a pipeline stage.", metric: "pipelineMoves", target: 1, icon: "rocket" },
    { id: "opening-doors", category: "Conversations", name: "Opening Doors", description: "Log 10 counted conversations.", metric: "conversations", target: 10, icon: "sparkles" },
    { id: "momentum-builder", category: "Conversations", name: "Momentum Builder", description: "Log 25 counted conversations.", metric: "conversations", target: 25, icon: "fire" },
    { id: "connector", category: "Conversations", name: "Connector", description: "Log 50 counted conversations.", metric: "conversations", target: 50, icon: "link" },
    { id: "community-builder", category: "Conversations", name: "Community Builder", description: "Log 100 counted conversations.", metric: "conversations", target: 100, icon: "network" },
    { id: "goal-getter", category: "Consistency", name: "Goal Getter", description: "Complete your daily conversation goal.", metric: "goalDays", target: 1, icon: "target" },
    { id: "three-day-spark", category: "Consistency", name: "Three-Day Spark", description: "Complete your daily goal 3 days in a row.", metric: "goalStreak", target: 3, icon: "fire" },
    { id: "one-week-momentum", category: "Consistency", name: "One-Week Momentum", description: "Complete your daily goal 7 days in a row.", metric: "goalStreak", target: 7, icon: "calendar" },
    { id: "consistency-wins", category: "Consistency", name: "Consistency Wins", description: "Complete your daily goal 14 days in a row.", metric: "goalStreak", target: 14, icon: "award" },
    { id: "unstoppable", category: "Consistency", name: "Unstoppable", description: "Complete your daily goal 30 days in a row.", metric: "goalStreak", target: 30, icon: "trophy" },
    { id: "follow-through", category: "Follow-Ups", name: "Follow Through", description: "Complete your first scheduled follow-up.", metric: "followUpsCompleted", target: 1, icon: "circleCheck" },
    { id: "reliable", category: "Follow-Ups", name: "Reliable", description: "Complete 10 follow-ups.", metric: "followUpsCompleted", target: 10, icon: "calendarCheck" },
    { id: "relationship-builder", category: "Follow-Ups", name: "Relationship Builder", description: "Complete 25 follow-ups.", metric: "followUpsCompleted", target: 25, icon: "handshake" },
    { id: "trust-builder", category: "Follow-Ups", name: "Trust Builder", description: "Complete 50 follow-ups.", metric: "followUpsCompleted", target: 50, icon: "award" },
    { id: "first-launch", category: "Pipeline", name: "First Launch", description: "Record your first launch.", metric: "launches", target: 1, icon: "rocket" },
    { id: "favorite-stop", category: "Organization", name: "Favorite Stop", description: "Save your first favorite networking place.", metric: "favoritePlaces", target: 1, icon: "star" },
    { id: "places-to-go", category: "Organization", name: "Places to Go", description: "Save 3 useful networking places.", metric: "savedPlaces", target: 3, icon: "location" }
  ];

  function evaluateAchievements(state, unlocked = {}) {
    const metrics = achievementMetrics(state);
    const savedUnlocks = unlocked && typeof unlocked === "object" ? unlocked : {};
    const newlyUnlocked = [];
    const progress = definitions.map(definition => {
      const current = finiteNumber(metrics[definition.metric]) || 0;
      const unlockDate = savedUnlocks[definition.id] || null;
      if (!unlockDate && current >= definition.target) newlyUnlocked.push(definition.id);
      return { ...definition, current, unlockedAt: unlockDate, complete: Boolean(unlockDate) || current >= definition.target };
    });
    return { metrics, progress, newlyUnlocked };
  }

  function dueReminderEvents(state, now = new Date()) {
    const source = state && typeof state === "object" ? state : {};
    const settings = source.settings && typeof source.settings === "object" ? source.settings : {};
    if (!settings.notificationsEnabled) return [];
    const nowDate = parseDate(now);
    const safeNow = isValidDate(nowDate) ? nowDate : new Date();
    const events = [];
    if (settings.followUpNotifications) {
      asArray(source.contacts).filter(contact => contact && typeof contact === "object" && !contact.archivedAt && !contact.isFilteredOut).forEach(contact => {
        asArray(contact.followUps).filter(item => {
          if (!item || typeof item !== "object" || item.notificationSentAt) return false;
          const status = item.status || (item.completedAt ? "completed" : item.deletedAt ? "deleted" : item.canceledAt ? "canceled" : "scheduled");
          return ["scheduled", "open"].includes(status);
        }).forEach(item => {
          const due = parseDate(item.dueDate);
          if (isValidDate(due) && due <= safeNow) events.push({ type: "followup", contact, followUp: item });
        });
      });
    }
    const today = dayKey(safeNow);
    if (settings.dailyReminderEnabled && source.meta?.dailyReminderSentDate !== today) {
      const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(String(settings.dailyReminderTime || "09:00"));
      const hour = timeMatch ? Number(timeMatch[1]) : 9;
      const minute = timeMatch ? Number(timeMatch[2]) : 0;
      const safeHour = Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 9;
      const safeMinute = Number.isInteger(minute) && minute >= 0 && minute <= 59 ? minute : 0;
      const reminderAt = new Date(safeNow); reminderAt.setHours(safeHour, safeMinute, 0, 0);
      const todayCount = asArray(source.contacts).flatMap(contact => asArray(contact?.conversations)).filter(log => {
        if (!log || typeof log !== "object" || !log.isCountedConversation) return false;
        const occurredAt = parseDate(activityDateValue(log));
        return isValidDate(occurredAt) && occurredAt <= safeNow && dayKey(occurredAt) === today;
      }).length;
      const dailyGoalValue = finiteNumber(settings.dailyGoal);
      const goal = dailyGoalValue !== null && dailyGoalValue > 0 ? Math.max(1, Math.round(dailyGoalValue)) : 5;
      if (safeNow >= reminderAt && todayCount < goal) events.push({ type: "daily", remaining: goal - todayCount, date: today });
    }
    return events;
  }

  global.BridgeEngagement = Object.freeze({ achievementMetrics, dailyGoalMetrics, dayKey, definitions, dueReminderEvents, evaluateAchievements, normalizeExcludedDates, normalizeRestRules, todaySwipeDecision });
})(globalThis);
