import assert from "node:assert/strict";
import test from "node:test";
import {
  FounderWorkflowKind,
  FounderWorkflowStatus,
  FounderWorkflowStep,
  SpotlightAudience,
  SpotlightBrandingPreset,
  SpotlightEmphasis,
  SpotlightGoal,
  SpotlightLength,
  SpotlightMedia,
  SpotlightPlatform,
  SpotlightTone,
  assertSchoolSpotlightRequestReady,
  createInMemoryFounderWorkflowDraftRepository,
  createVolatileFounderWorkflowDraftStore,
  normalizeSchoolSpotlightRequest,
  synchronizeSchoolSpotlightRequest,
  validateFounderWorkflowDraft,
  type FounderWorkflowDraft,
  type SchoolSpotlightRequest,
} from "@/domain/founder-simple";
import { withStructuredSpotlightRequest } from "@/components/founder/StructuredSpotlightRequestFields";

const legacyRequest = {
  objective: "Tell Malone's untold basketball story",
  audience: "Players, families, coaches, and basketball fans",
  platforms: [SpotlightPlatform.InstagramReel, SpotlightPlatform.YouTubeShort],
  centralEmphasis: "A tradition that deserves more attention",
  availableMedia: ["Campus photos, game footage", "Historic team archive"],
  callToAction: "Visit the official athletics website.",
};

function legacyDraft(): FounderWorkflowDraft {
  return {
    id: "legacy-founder-request",
    workspaceId: "executive-workspace",
    ownerId: "founder-admin",
    kind: FounderWorkflowKind.SchoolSpotlight,
    step: FounderWorkflowStep.Request,
    status: FounderWorkflowStatus.Active,
    request: legacyRequest as SchoolSpotlightRequest,
    facts: [],
    customization: {
      tone: SpotlightTone.ClearAndConfident,
      length: SpotlightLength.Standard,
      hook: "",
      emphasis: "",
      callToAction: "",
      mediaAvailability: [],
      brandingPreset: SpotlightBrandingPreset.Headquarters,
      verticalVideoScript: "",
      instagramCaption: "",
      shotList: [],
      rightsConfirmed: false,
    },
    createdAt: "2026-07-18T12:00:00.000Z",
    updatedAt: "2026-07-18T12:00:00.000Z",
    createdBy: "founder-admin",
    updatedBy: "founder-admin",
    revision: 1,
  };
}

test("legacy freeform Spotlight requests become structured without losing original values", () => {
  const request = normalizeSchoolSpotlightRequest(legacyRequest);

  assert.equal(request.objective, legacyRequest.objective);
  assert.equal(request.goalOther, legacyRequest.objective);
  assert.deepEqual(request.goals, [SpotlightGoal.Other]);
  assert.equal(request.audience, legacyRequest.audience);
  assert.deepEqual(request.audiences, [
    SpotlightAudience.Players,
    SpotlightAudience.ParentsAndFamilies,
    SpotlightAudience.BasketballFans,
    SpotlightAudience.Other,
  ]);
  assert.equal(request.audienceOther, "coaches");
  assert.equal(request.centralEmphasis, legacyRequest.centralEmphasis);
  assert.equal(request.primaryEmphasis, SpotlightEmphasis.Other);
  assert.equal(request.emphasisOther, legacyRequest.centralEmphasis);
  assert.deepEqual(request.availableMedia, legacyRequest.availableMedia);
  assert.deepEqual(request.media, [SpotlightMedia.CampusPhotos, SpotlightMedia.GameFootage, SpotlightMedia.Other]);
  assert.equal(request.mediaOther, "Historic team archive");
  assert.equal(request.needShotList, false);
  assert.deepEqual(request.platforms, legacyRequest.platforms);
});

test("normalized Spotlight requests omit blank optional fields instead of materializing undefined", () => {
  const request = normalizeSchoolSpotlightRequest({
    objective: "Showcase basketball facilities",
    goals: [SpotlightGoal.ShowcaseFacilities],
    audience: "Players",
    audiences: [SpotlightAudience.Players],
    platforms: [SpotlightPlatform.InstagramReel],
    centralEmphasis: "Campus experience",
    primaryEmphasis: SpotlightEmphasis.CampusExperience,
    availableMedia: ["Practice footage"],
    media: [SpotlightMedia.PracticeFootage],
    needShotList: false,
    callToAction: "Learn more.",
  });

  for (const optionalField of [
    "goalOther",
    "supplementalGoalText",
    "audienceOther",
    "emphasisOther",
    "specificAngle",
    "mediaOther",
    "mediaDescription",
  ]) {
    assert.equal(optionalField in request, false, `${optionalField} should be omitted`);
  }
});

test("structured selections maintain the legacy projections used by existing package services", () => {
  const request = synchronizeSchoolSpotlightRequest(normalizeSchoolSpotlightRequest({
    objective: "",
    goals: [SpotlightGoal.IntroduceSchool, SpotlightGoal.PromoteSpecificStrength, SpotlightGoal.Other],
    goalOther: "Celebrate Malone's local impact",
    supplementalGoalText: "Keep the tone welcoming",
    audience: "",
    audiences: [SpotlightAudience.Players, SpotlightAudience.ParentsAndFamilies],
    platforms: [SpotlightPlatform.InstagramReel],
    centralEmphasis: "",
    primaryEmphasis: SpotlightEmphasis.BasketballProgram,
    specificAngle: "Program development",
    availableMedia: [],
    media: [SpotlightMedia.CampusPhotos, SpotlightMedia.Other],
    mediaOther: "Founder-approved archival images",
    mediaDescription: "Images are already cleared for internal package preparation",
    needShotList: true,
    callToAction: "Learn more.",
  }), ["goal", "audience", "emphasis", "media"]);

  assert.equal(
    request.objective,
    "Introduce the school; Promote a specific strength; Celebrate Malone's local impact; Keep the tone welcoming",
  );
  assert.equal(request.audience, "Players, Parents and families");
  assert.equal(request.centralEmphasis, "Basketball program: Program development");
  assert.deepEqual(request.availableMedia, [
    "Campus photos",
    "Founder-approved archival images",
    "Images are already cleared for internal package preparation",
  ]);
  assert.equal(request.needShotList, true);
  assert.deepEqual(request.platforms, [SpotlightPlatform.InstagramReel]);
});

test("request validation enforces compatible media and plain-language review readiness", () => {
  const incomplete = normalizeSchoolSpotlightRequest({
    objective: "",
    goals: [],
    audience: "",
    audiences: [],
    platforms: [SpotlightPlatform.TikTok],
    centralEmphasis: "",
    availableMedia: [],
    media: [],
    needShotList: false,
    callToAction: "",
  });
  assert.throws(
    () => assertSchoolSpotlightRequestReady({ ...incomplete, goals: [SpotlightGoal.IntroduceSchool] }),
    /Choose at least one audience before continuing\./,
  );

  const draft = legacyDraft();
  assert.throws(
    () => validateFounderWorkflowDraft({
      ...draft,
      request: {
        ...normalizeSchoolSpotlightRequest(draft.request),
        media: [SpotlightMedia.NoMediaYet, SpotlightMedia.CampusPhotos],
      },
    }),
    /Choose No media yet by itself/,
  );
});

test("an unrelated shot-list edit preserves every legacy freeform value byte-for-byte", () => {
  const rawLegacy = {
    objective: "  Tell Malone’s story — exactly.  ",
    audience: "Players / Families & LOCAL supporters",
    platforms: [SpotlightPlatform.InstagramReel],
    centralEmphasis: "Culture: belonging + tradition",
    availableMedia: ["Campus PHOTOS; original labels", "  VHS archive  "],
    callToAction: "Learn more.",
  };
  const request = normalizeSchoolSpotlightRequest(rawLegacy);
  const originalMediaReference = request.availableMedia;

  const changed = withStructuredSpotlightRequest(request, { needShotList: true });

  assert.equal(changed.needShotList, true);
  assert.equal(changed.objective, rawLegacy.objective);
  assert.equal(changed.audience, rawLegacy.audience);
  assert.equal(changed.centralEmphasis, rawLegacy.centralEmphasis);
  assert.strictEqual(changed.availableMedia, originalMediaReference);
  assert.deepEqual(changed.availableMedia, rawLegacy.availableMedia);
});

test("draft repositories reopen and migrate legacy requests on the next owner-scoped autosave", async () => {
  const store = createVolatileFounderWorkflowDraftStore([legacyDraft()]);
  const repository = createInMemoryFounderWorkflowDraftRepository(
    store,
    () => "2026-07-18T12:01:00.000Z",
  );

  const reopened = await repository.getById("legacy-founder-request", { actorId: "founder-admin" });
  assert.ok(reopened);
  assert.equal(reopened.request.objective, legacyRequest.objective);
  assert.deepEqual(reopened.request.goals, [SpotlightGoal.Other]);
  assert.equal(reopened.request.goalOther, legacyRequest.objective);

  const updatedRequest = synchronizeSchoolSpotlightRequest({
    ...reopened.request,
    audiences: [...reopened.request.audiences, SpotlightAudience.Recruits],
    needShotList: true,
  }, ["audience"]);
  const saved = await repository.update(reopened.id, { request: updatedRequest }, {
    actorId: "founder-admin",
  }, { expectedRevision: 1 });

  assert.equal(saved.revision, 2);
  assert.equal(saved.request.objective, legacyRequest.objective);
  assert.equal(saved.request.goalOther, legacyRequest.objective);
  assert.ok(saved.request.audiences.includes(SpotlightAudience.Recruits));
  assert.equal(saved.request.needShotList, true);
  assert.deepEqual(store.read()[0].request, saved.request);
});
