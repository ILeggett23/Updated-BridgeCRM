(function installBridgeNetwork(global) {
  const asArray = value => Array.isArray(value) ? value : [];
  const hasValue = value => {
    if (value === null || value === undefined) return false;
    try { return String(value).trim() !== ""; } catch { return false; }
  };
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
    return Number.isFinite(date.getTime()) && date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
  };
  const timestamp = value => {
    if (!hasValue(value)) return null;
    try {
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) && !validDateOnly(value.trim())) return null;
      const result = value instanceof Date ? value.getTime() : new Date(value).getTime();
      return Number.isFinite(result) ? result : null;
    } catch {
      return null;
    }
  };
  const clean = value => {
    try { return String(value ?? "").trim(); } catch { return ""; }
  };
  const activityTimestamp = item => timestamp(item?.conversationDate) ?? timestamp(item?.createdAt);
  const scheduledFollowUps = contact => asArray(contact?.followUps).filter(item => {
    if (!item || typeof item !== "object") return false;
    const status = item.status || (item.completedAt ? "completed" : item.deletedAt ? "deleted" : item.canceledAt ? "canceled" : "scheduled");
    return ["scheduled", "open"].includes(status) && timestamp(item.dueDate) !== null;
  });
  const latestConversation = contact => {
    const values = asArray(contact?.conversations)
      .filter(item => item && typeof item === "object")
      .map(activityTimestamp)
      .filter(value => value !== null);
    return values.length ? Math.max(...values) : null;
  };
  const stableId = (type, value) => `${type}:${clean(value)}`;
  const pointOnRing = (index, total, radius, centerX, centerY, offset = -Math.PI / 2) => {
    const angle = offset + (Math.PI * 2 * index / Math.max(1, total));
    return { x: Math.round((centerX + Math.cos(angle) * radius) * 10) / 10, y: Math.round((centerY + Math.sin(angle) * radius) * 10) / 10 };
  };
  const strengthClass = (band, score) => {
    const normalizedBand = clean(band);
    if (normalizedBand === "Strong") return "strong";
    if (normalizedBand === "Steady") return "steady";
    if (["Needs Attention", "At Risk"].includes(normalizedBand)) return "attention";
    const numericScore = finiteNumber(score);
    if (numericScore === null) return "baseline";
    if (numericScore >= 80) return "strong";
    if (numericScore >= 60) return "steady";
    return "attention";
  };

  function buildNetworkModel(input = {}) {
    const options = input && typeof input === "object" ? input : {};
    const { contacts = [], places = [], companies = [], scores = [], now = new Date(), entityFilter = "all", maxPeople: requestedMaxPeople = 40 } = options;
    const nowTime = timestamp(now) ?? Date.now();
    const scoreMap = new Map(asArray(scores).filter(score => score && typeof score === "object" && hasValue(score.contactId)).map(score => [String(score.contactId), score]));
    const allowedContacts = asArray(contacts)
      .filter(contact => contact && typeof contact === "object" && hasValue(contact.id))
      .sort((left, right) => {
        const leftScore = finiteNumber(scoreMap.get(String(left.id))?.score);
        const rightScore = finiteNumber(scoreMap.get(String(right.id))?.score);
        const scoreDifference = (rightScore ?? -1) - (leftScore ?? -1);
        return scoreDifference || (latestConversation(right) || 0) - (latestConversation(left) || 0) || String(left.id).localeCompare(String(right.id));
      });
    const normalizedMaxPeople = finiteNumber(requestedMaxPeople);
    const maxPeople = normalizedMaxPeople === null ? 40 : Math.max(1, Math.floor(normalizedMaxPeople));
    const visibleContacts = allowedContacts.slice(0, Math.max(1, maxPeople));
    const savedPlaces = asArray(places).filter(place => place && typeof place === "object" && hasValue(place.id));
    const savedPlaceMap = new Map(savedPlaces.map(place => [String(place.id), place]));
    const savedPlaceNameMap = new Map(savedPlaces.filter(place => clean(place.name)).map(place => [clean(place.name).toLowerCase(), place]));
    const savedCompanies = asArray(companies).filter(company => company && typeof company === "object" && hasValue(company.id));
    const companyMap = new Map(savedCompanies.map(company => [String(company.id), company]));
    const scoreFor = contact => scoreMap.get(String(contact.id)) || null;
    const personNodes = visibleContacts.map((contact, index) => {
      const score = scoreFor(contact);
      const followUps = scheduledFollowUps(contact).sort((left, right) => timestamp(left.dueDate) - timestamp(right.dueDate));
      const nextAction = followUps[0] || null;
      const overdue = Boolean(nextAction && timestamp(nextAction.dueDate) < nowTime);
      const point = pointOnRing(index, visibleContacts.length, visibleContacts.length > 16 ? 170 : 145, 360, 240);
      return {
        id: stableId("person", contact.id), type: "person", recordId: String(contact.id), label: clean(contact.fullName) || "Unnamed contact",
        x: point.x, y: point.y, score: finiteNumber(score?.score),
        band: clean(score?.band) || "Building Baseline", strength: strengthClass(score?.band, score?.score), trend: clean(score?.trend?.direction || score?.trend) || "steady",
        role: clean(contact.role), interest: clean(contact.interestLevel), judgment: clean(contact.judgement), stage: clean(contact.currentStage),
        placeName: clean(contact.placeName), lastConversationAt: latestConversation(contact), conversationCount: asArray(contact.conversations).filter(item => item && typeof item === "object" && activityTimestamp(item) !== null).length,
        nextAction: nextAction ? { id: String(nextAction.id), dueDate: nextAction.dueDate, note: clean(nextAction.note) || "Follow up", overdue } : null,
        phoneNumber: clean(contact.phoneNumber), archived: Boolean(contact.archivedAt), filteredOut: Boolean(contact.isFilteredOut)
      };
    });
    const personByRecordId = new Map(personNodes.map(node => [node.recordId, node]));
    const placeRelations = new Map();
    const companyRelations = new Map();
    for (const contact of visibleContacts) {
      const person = personByRecordId.get(String(contact.id));
      const place = hasValue(contact.placeId) ? savedPlaceMap.get(String(contact.placeId)) : savedPlaceNameMap.get(clean(contact.placeName).toLowerCase());
      if (person && place) {
        const key = String(place.id);
        if (!placeRelations.has(key)) placeRelations.set(key, { place, people: [] });
        placeRelations.get(key).people.push(person.recordId);
      }
      const company = contact.companyId ? companyMap.get(String(contact.companyId)) : (hasValue(contact.companyId) ? companyMap.get(String(contact.companyId)) : null);
      if (person && company) {
        const key = String(company.id);
        if (!companyRelations.has(key)) companyRelations.set(key, { company, people: [] });
        companyRelations.get(key).people.push(person.recordId);
      }
    }
    const contexts = [...placeRelations.values()].map(item => ({ type: "place", record: item.place, people: item.people }))
      .concat([...companyRelations.values()].map(item => ({ type: "company", record: item.company, people: item.people })))
      .sort((left, right) => left.type.localeCompare(right.type) || clean(left.record.name).localeCompare(clean(right.record.name)) || String(left.record.id).localeCompare(String(right.record.id)));
    const contextNodes = contexts.map((item, index) => {
      const point = pointOnRing(index, contexts.length, 218, 360, 240, -Math.PI / 2 + Math.PI / Math.max(2, contexts.length));
      return { id: stableId(item.type, item.record.id), type: item.type, recordId: String(item.record.id), label: clean(item.record.name) || (item.type === "place" ? "Saved place" : "Company"), x: point.x, y: point.y, people: [...item.people], favorite: Boolean(item.record.isFavorite) };
    });
    const allNodes = [{ id: "you", type: "you", label: "You", x: 360, y: 240 }, ...personNodes, ...contextNodes];
    const allEdges = personNodes.map(person => ({ id: `you-${person.id}`, source: "you", target: person.id, type: "relationship", strength: person.strength, score: person.score }))
      .concat(contextNodes.flatMap(context => context.people.map(personId => ({ id: `${stableId("person", personId)}-${context.id}`, source: stableId("person", personId), target: context.id, type: context.type, strength: "context" }))));
    const requested = ["people", "places", "companies"].includes(entityFilter) ? entityFilter : "all";
    let permitted = new Set(allNodes.map(node => node.id));
    if (requested === "people") permitted = new Set(["you", ...personNodes.map(node => node.id)]);
    if (requested === "places" || requested === "companies") {
      const type = requested === "places" ? "place" : "company";
      const contextIds = contextNodes.filter(node => node.type === type).map(node => node.id);
      const relatedPeople = new Set(allEdges.filter(edge => contextIds.includes(edge.target)).map(edge => edge.source));
      permitted = new Set(["you", ...contextIds, ...relatedPeople]);
    }
    const nodes = allNodes.filter(node => permitted.has(node.id));
    const edges = allEdges.filter(edge => permitted.has(edge.source) && permitted.has(edge.target));
    return {
      nodes, edges, personCount: personNodes.length, totalPeople: allowedContacts.length,
      placeCount: contextNodes.filter(node => node.type === "place").length,
      companyCount: contextNodes.filter(node => node.type === "company").length,
      truncated: allowedContacts.length > visibleContacts.length, entityFilter: requested
    };
  }

  global.BridgeNetwork = Object.freeze({ buildNetworkModel, latestConversation, strengthClass });
})(globalThis);
