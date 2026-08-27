export const BRIDGE_GUIDE_CONTACT_ID = "bridge-guide-jordan-brooks";
export const BRIDGE_GUIDE_PLACE_ID = "bridge-guide-riverside-coffee";

export const BRIDGE_GUIDE_CAPTURE_CONTENT = Object.freeze({
  notes:"Jordan is preparing for a half marathon and wants an introduction to a local running group.",
  context:"Training for a half marathon; values community, accountability, and early-morning workouts.",
  followUpNote:"Send the running-group introduction and check how training is going."
});

const clone = value => JSON.parse(JSON.stringify(value));
const isoAt = (now, days) => new Date(now + days * 86400000).toISOString();

function tutorialContact({ id, fullName, allStages, now, role = "Prospect", stage = "", placeId = BRIDGE_GUIDE_PLACE_ID, placeName = "Riverside Coffee", daysAgo = 3, personalInfo = "", followUpDays = null }) {
  const occurredAt = isoAt(now, -Math.abs(daysAgo));
  const stages = Object.fromEntries(allStages.map(value => [value, value === stage]));
  const stageDates = stage ? { [stage]: occurredAt } : {};
  const stageEvents = stage ? [{ id:`${id}-stage`, stage, fromStage:null, toStage:stage, occurredAt, source:"tutorial" }] : [];
  const followUps = followUpDays === null ? [] : [{ id:`${id}-follow-up`, note:"Check in about the community event", dueDate:isoAt(now, followUpDays), status:"scheduled", createdAt:occurredAt, updatedAt:occurredAt, rescheduleHistory:[] }];
  return {
    id, fullName, role, placeId, placeName, personalInfo, source:"tutorial", isTutorialRecord:true,
    judgement:"Good Fit", interestLevel:"Interested", conversationType:"Networking", dateFirstMet:occurredAt,
    stages, stageDates, stageEvents, followUps, notes:[],
    conversations:[{ id:`${id}-conversation`, type:"Networking", notes:`Met ${fullName} and learned what matters to them.`, createdAt:occurredAt, conversationDate:occurredAt, isCountedConversation:true }],
    createdAt:occurredAt, updatedAt:occurredAt
  };
}

export function createBridgeGuideFixture({ baseState, allStages, now = Date.now(), walkthroughPreference = {} }) {
  const fixture = clone(baseState);
  fixture.settings = { ...fixture.settings, firstName:"Taylor", lastName:"", name:"Taylor", dailyGoal:3, weeklyGoal:15, monthlyGoal:60, walkthrough:clone(walkthroughPreference) };
  fixture.places = [
    { id:BRIDGE_GUIDE_PLACE_ID, name:"Riverside Coffee", isFavorite:true, createdAt:isoAt(now, -30) },
    { id:"bridge-guide-community-center", name:"Northside Community Center", isFavorite:false, createdAt:isoAt(now, -18) }
  ];
  fixture.contacts = [
    tutorialContact({ id:BRIDGE_GUIDE_CONTACT_ID, fullName:"Jordan Brooks", allStages, now, stage:"QI/P", daysAgo:2, followUpDays:1 }),
    tutorialContact({ id:"bridge-guide-maya-chen", fullName:"Maya Chen", allStages, now, role:"Customer", stage:"Proposal", daysAgo:4, personalInfo:"Runs a neighborhood wellness group." }),
    tutorialContact({ id:"bridge-guide-marcus-reed", fullName:"Marcus Reed", allStages, now, stage:"FUP", daysAgo:7, placeId:"bridge-guide-community-center", placeName:"Northside Community Center" }),
    tutorialContact({ id:"bridge-guide-avery-collins", fullName:"Avery Collins", allStages, now, role:"Customer", stage:"Active Customer", daysAgo:10, personalInfo:"Prefers morning check-ins." })
  ];
  fixture.analytics = { records:[], history:[] };
  fixture.meta = { ...fixture.meta, achievements:{}, dailyReminderSentDate:null, updatedAt:new Date(now).toISOString() };
  return fixture;
}
