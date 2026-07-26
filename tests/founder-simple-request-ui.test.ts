import assert from "node:assert/strict";
import test from "node:test";
import {
  SpotlightAudience,
  SpotlightEmphasis,
  SpotlightGoal,
  SpotlightMedia,
  SpotlightPlatform,
  normalizeSchoolSpotlightRequest,
} from "@/domain/founder-simple";
import {
  StructuredSpotlightRequestFields,
  firstUnresolvedSpotlightRequestField,
  nextSpotlightMediaSelection,
  withStructuredSpotlightRequest,
} from "@/components/founder/StructuredSpotlightRequestFields";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

function request() {
  return normalizeSchoolSpotlightRequest({
    objective: "",
    audience: "",
    platforms: [],
    centralEmphasis: "",
    availableMedia: [],
    callToAction: "",
  });
}

test("structured Spotlight request uses the approved Founder-facing order and accessible controls", () => {
  const markup = renderToStaticMarkup(createElement(StructuredSpotlightRequestFields, {
    request: request(),
    onRequest: () => undefined,
  }));
  const labels = [
    "What should this Spotlight accomplish?",
    "Who should it reach?",
    "Where will it be used?",
    "What should viewers remember most?",
    "What media is available?",
    "Call to action",
  ];

  let prior = -1;
  for (const label of labels) {
    const position = markup.indexOf(label);
    assert.ok(position > prior, `${label} should appear in the approved order`);
    prior = position;
  }
  assert.match(markup, /type="checkbox"/);
  assert.match(markup, /type="radio"/);
  assert.match(markup, /aria-required="true"/);
  assert.match(markup, /Instagram Reel/);
  assert.match(markup, /TikTok/);
  assert.match(markup, /YouTube Short/);
  assert.match(markup, /does not publish, schedule, or upload anything/);
  assert.doesNotMatch(markup, /comma separated|file format|upload files here/i);
});
test("structured request supports multiple selections, Other details, one emphasis, and shot-list persistence", () => {
  const updated = withStructuredSpotlightRequest(request(), {
    goals: [SpotlightGoal.IntroduceSchool, SpotlightGoal.Other],
    goalOther: "Celebrate a century of basketball",
    supplementalGoalText: "Keep the story welcoming.",
    audiences: [SpotlightAudience.Players, SpotlightAudience.ParentsAndFamilies, SpotlightAudience.Other],
    audienceOther: "Community partners",
    platforms: [SpotlightPlatform.InstagramReel, SpotlightPlatform.YouTubeShort],
    primaryEmphasis: SpotlightEmphasis.SchoolCulture,
    specificAngle: "Belonging through basketball",
    media: [SpotlightMedia.CampusPhotos, SpotlightMedia.Other],
    mediaOther: "Historic yearbook images",
    mediaDescription: "Cleared by the School communications office.",
    needShotList: true,
  });
  const markup = renderToStaticMarkup(createElement(StructuredSpotlightRequestFields, {
    request: updated,
    onRequest: () => undefined,
  }));

  assert.deepEqual(updated.goals, [SpotlightGoal.IntroduceSchool, SpotlightGoal.Other]);
  assert.deepEqual(updated.audiences, [SpotlightAudience.Players, SpotlightAudience.ParentsAndFamilies, SpotlightAudience.Other]);
  assert.deepEqual(updated.platforms, [SpotlightPlatform.InstagramReel, SpotlightPlatform.YouTubeShort]);
  assert.equal(updated.primaryEmphasis, SpotlightEmphasis.SchoolCulture);
  assert.equal(updated.needShotList, true);
  assert.match(updated.objective, /Introduce the school; Celebrate a century of basketball; Keep the story welcoming\./);
  assert.match(updated.audience, /Players, Parents and families, Community partners/);
  assert.match(updated.centralEmphasis, /School culture: Belonging through basketball/);
  assert.deepEqual(updated.availableMedia, [
    "Campus photos",
    "Historic yearbook images",
    "Cleared by the School communications office.",
  ]);
  assert.match(markup, /Other goal/);
  assert.match(markup, /Other audience/);
  assert.match(markup, /Describe other media/);
  assert.match(markup, /I need a shot list/);
  assert.match(markup, /checked=""/);
});

test("request validation finds the first unresolved control and No media yet removes conflicts", () => {
  const empty = request();
  assert.equal(firstUnresolvedSpotlightRequestField(empty), "goal");

  const goalOther = withStructuredSpotlightRequest(empty, { goals: [SpotlightGoal.Other] });
  assert.equal(firstUnresolvedSpotlightRequestField(goalOther), "goal-other");

  const audienceOther = withStructuredSpotlightRequest(goalOther, {
    goalOther: "A Founder-authored goal",
    audiences: [SpotlightAudience.Other],
  });
  assert.equal(firstUnresolvedSpotlightRequestField(audienceOther), "audience-other");

  const missingPlatform = withStructuredSpotlightRequest(audienceOther, {
    audienceOther: "Local partners",
  });
  assert.equal(firstUnresolvedSpotlightRequestField(missingPlatform), "platform");

  const mediaOther = withStructuredSpotlightRequest(missingPlatform, {
    platforms: [SpotlightPlatform.TikTok],
    media: [SpotlightMedia.Other],
  });
  assert.equal(firstUnresolvedSpotlightRequestField(mediaOther), "media-other");

  assert.deepEqual(
    nextSpotlightMediaSelection(
      [SpotlightMedia.CampusPhotos, SpotlightMedia.GameFootage],
      SpotlightMedia.NoMediaYet,
      true,
    ),
    [SpotlightMedia.NoMediaYet],
  );
  assert.deepEqual(
    nextSpotlightMediaSelection([SpotlightMedia.NoMediaYet], SpotlightMedia.Logos, true),
    [SpotlightMedia.Logos],
  );
});
