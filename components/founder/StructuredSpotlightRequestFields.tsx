import {
  SpotlightAudience,
  SpotlightEmphasis,
  SpotlightGoal,
  SpotlightMedia,
  SpotlightPlatform,
  spotlightAudienceOptions,
  spotlightEmphasisOptions,
  spotlightGoalOptions,
  spotlightMediaOptions,
  synchronizeSchoolSpotlightRequest,
  type SchoolSpotlightRequestProjectionSection,
  type SchoolSpotlightRequest,
} from "@/domain/founder-simple";
import { platformLabels } from "./founderSimpleLabels";

const goalValues = spotlightGoalOptions.map((option) => option.value);
const audienceValues = spotlightAudienceOptions.map((option) => option.value);
const mediaValues = spotlightMediaOptions.map((option) => option.value);

const platformOptions = [
  SpotlightPlatform.InstagramReel,
  SpotlightPlatform.TikTok,
  SpotlightPlatform.YouTubeShort,
] as const;

const inputClassName = "mt-2 min-h-12 w-full border border-white/15 bg-black px-4 py-3 text-base font-bold text-white outline-none placeholder:text-zinc-600 focus:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500/40";
const labelClassName = "text-sm font-black text-zinc-200";
const optionalPanelClassName = "border border-white/10 bg-white/[0.02] p-4 sm:p-5";

export type SpotlightRequestFocusTarget =
  | "goal"
  | "goal-other"
  | "audience"
  | "audience-other"
  | "platform"
  | "emphasis-other"
  | "media-other";

const requestFocusIds: Record<SpotlightRequestFocusTarget, string> = {
  goal: "spotlight-goal-introduce-school",
  "goal-other": "spotlight-goal-other-text",
  audience: "spotlight-audience-players",
  "audience-other": "spotlight-audience-other-text",
  platform: "spotlight-platform-instagram-reel",
  "emphasis-other": "spotlight-emphasis-other-text",
  "media-other": "spotlight-media-other-text",
};

export function spotlightRequestFocusId(target: SpotlightRequestFocusTarget) {
  return requestFocusIds[target];
}

export function firstUnresolvedSpotlightRequestField(
  request: SchoolSpotlightRequest,
): SpotlightRequestFocusTarget | null {
  if (!request.goals.length) return "goal";
  if (request.goals.includes(SpotlightGoal.Other) && !request.goalOther?.trim()) return "goal-other";
  if (!request.audiences.length) return "audience";
  if (request.audiences.includes(SpotlightAudience.Other) && !request.audienceOther?.trim()) return "audience-other";
  if (!request.platforms.length) return "platform";
  if (request.primaryEmphasis === SpotlightEmphasis.Other && !request.emphasisOther?.trim()) return "emphasis-other";
  if (request.media.includes(SpotlightMedia.Other) && !request.mediaOther?.trim()) return "media-other";
  return null;
}

function inApprovedOrder<T extends string>(selected: readonly T[], options: readonly T[]) {
  const selectedSet = new Set(selected);
  return options.filter((option) => selectedSet.has(option));
}

function toggleSelection<T extends string>(
  selected: readonly T[],
  option: T,
  checked: boolean,
  options: readonly T[],
) {
  const next = checked
    ? [...selected, option]
    : selected.filter((item) => item !== option);
  return inApprovedOrder(next, options);
}

export function nextSpotlightMediaSelection(
  selected: readonly SpotlightMedia[],
  option: SpotlightMedia,
  checked: boolean,
) {
  if (checked && option === SpotlightMedia.NoMediaYet) return [SpotlightMedia.NoMediaYet];
  const compatible = option === SpotlightMedia.NoMediaYet
    ? selected
    : selected.filter((item) => item !== SpotlightMedia.NoMediaYet);
  return toggleSelection(compatible, option, checked, mediaValues);
}

/** Keeps the legacy presentation fields current while structured drafts roll out. */
export function withStructuredSpotlightRequest(
  request: SchoolSpotlightRequest,
  update: Partial<SchoolSpotlightRequest>,
): SchoolSpotlightRequest {
  const editedSections: SchoolSpotlightRequestProjectionSection[] = [];
  if (["goals", "goalOther", "supplementalGoalText"].some((field) => field in update)) {
    editedSections.push("goal");
  }
  if (["audiences", "audienceOther"].some((field) => field in update)) {
    editedSections.push("audience");
  }
  if (["primaryEmphasis", "emphasisOther", "specificAngle"].some((field) => field in update)) {
    editedSections.push("emphasis");
  }
  if (["media", "mediaOther", "mediaDescription"].some((field) => field in update)) {
    editedSections.push("media");
  }
  return synchronizeSchoolSpotlightRequest({ ...request, ...update }, editedSections);
}

function selectionClassName(selected: boolean) {
  return [
    "flex min-h-14 cursor-pointer items-start gap-3 border px-4 py-3 text-sm font-black leading-6 transition",
    "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white",
    selected
      ? "border-red-500 bg-red-500/10 text-white"
      : "border-white/15 bg-black text-zinc-300 hover:border-red-500/70 hover:text-white",
  ].join(" ");
}

type StructuredSpotlightRequestFieldsProps = {
  request: SchoolSpotlightRequest;
  onRequest(request: SchoolSpotlightRequest): void;
};

export function StructuredSpotlightRequestFields({
  request,
  onRequest,
}: StructuredSpotlightRequestFieldsProps) {
  const missingGoal = !request.goals.length;
  const missingGoalOther = request.goals.includes(SpotlightGoal.Other) && !request.goalOther?.trim();
  const missingAudience = !request.audiences.length;
  const missingAudienceOther = request.audiences.includes(SpotlightAudience.Other) && !request.audienceOther?.trim();
  const missingPlatforms = !request.platforms.length;

  function update(update: Partial<SchoolSpotlightRequest>) {
    onRequest(withStructuredSpotlightRequest(request, update));
  }

  return (
    <div className="grid gap-8">
      <fieldset
        aria-describedby="spotlight-goal-help spotlight-goal-requirement"
        aria-invalid={missingGoal || missingGoalOther}
        aria-required="true"
      >
        <legend className="text-base font-black text-white">What should this Spotlight accomplish?</legend>
        <p id="spotlight-goal-help" className="mt-2 text-sm font-bold leading-6 text-zinc-500">Choose one or more goals. You can add context afterward without writing the Spotlight itself.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {spotlightGoalOptions.map((option) => {
            const selected = request.goals.includes(option.value);
            return (
              <label key={option.value} className={selectionClassName(selected)}>
                <input
                  id={`spotlight-goal-${option.value}`}
                  type="checkbox"
                  checked={selected}
                  onChange={(event) => update({
                    goals: toggleSelection(request.goals, option.value, event.target.checked, goalValues),
                  })}
                  className="mt-1 h-4 w-4 shrink-0 accent-red-600"
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
        {request.goals.includes(SpotlightGoal.Other) ? (
          <label className={`${labelClassName} mt-4 block`}>
            Other goal
            <input
              id="spotlight-goal-other-text"
              required
              aria-invalid={missingGoalOther}
              value={request.goalOther || ""}
              onChange={(event) => update({ goalOther: event.target.value || undefined })}
              className={inputClassName}
            />
          </label>
        ) : null}
        <div className={`${optionalPanelClassName} mt-4`}>
          <label className={labelClassName}>
            Anything else Headquarters should know? <span className="font-normal text-zinc-500">(optional)</span>
            <textarea
              value={request.supplementalGoalText || ""}
              onChange={(event) => update({ supplementalGoalText: event.target.value || undefined })}
              className={`${inputClassName} min-h-24 font-normal leading-6`}
            />
          </label>
        </div>
        <p id="spotlight-goal-requirement" className={`mt-3 text-sm font-bold leading-6 ${missingGoal || missingGoalOther ? "text-amber-200" : "text-zinc-600"}`}>
          {missingGoal ? "Choose at least one Spotlight goal before continuing." : missingGoalOther ? "Describe the other Spotlight goal before continuing." : "Spotlight goal selected."}
        </p>
      </fieldset>

      <fieldset
        aria-describedby="spotlight-audience-help spotlight-audience-requirement"
        aria-invalid={missingAudience || missingAudienceOther}
        aria-required="true"
      >
        <legend className="text-base font-black text-white">Who should it reach?</legend>
        <p id="spotlight-audience-help" className="mt-2 text-sm font-bold leading-6 text-zinc-500">Choose every audience this Spotlight should serve.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {spotlightAudienceOptions.map((option) => {
            const selected = request.audiences.includes(option.value);
            return (
              <label key={option.value} className={selectionClassName(selected)}>
                <input
                  id={`spotlight-audience-${option.value}`}
                  type="checkbox"
                  checked={selected}
                  onChange={(event) => update({
                    audiences: toggleSelection(request.audiences, option.value, event.target.checked, audienceValues),
                  })}
                  className="mt-1 h-4 w-4 shrink-0 accent-red-600"
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
        {request.audiences.includes(SpotlightAudience.Other) ? (
          <label className={`${labelClassName} mt-4 block`}>
            Other audience
            <input
              id="spotlight-audience-other-text"
              required
              aria-invalid={missingAudienceOther}
              value={request.audienceOther || ""}
              onChange={(event) => update({ audienceOther: event.target.value || undefined })}
              className={inputClassName}
            />
          </label>
        ) : null}
        <p id="spotlight-audience-requirement" className={`mt-3 text-sm font-bold leading-6 ${missingAudience || missingAudienceOther ? "text-amber-200" : "text-zinc-600"}`}>
          {missingAudience ? "Choose at least one audience before continuing." : missingAudienceOther ? "Describe the other audience before continuing." : "Audience selected."}
        </p>
      </fieldset>

      <fieldset
        aria-describedby="spotlight-platform-help spotlight-platform-requirement"
        aria-invalid={missingPlatforms}
        aria-required="true"
      >
        <legend className="text-base font-black text-white">Where will it be used?</legend>
        <p id="spotlight-platform-help" className="mt-2 text-sm font-bold leading-6 text-zinc-500">Every Spotlight includes a shared vertical-video package, an Instagram caption, a photo and video shot list, and a source and verification package. Choose where the shared vertical-video plan will be used. Headquarters does not publish, schedule, or upload anything from this screen.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {platformOptions.map((platform) => {
            const selected = request.platforms.includes(platform);
            return (
              <label key={platform} className={selectionClassName(selected)}>
                <input
                  id={`spotlight-platform-${platform}`}
                  type="checkbox"
                  checked={selected}
                  onChange={(event) => update({
                    platforms: toggleSelection(request.platforms, platform, event.target.checked, platformOptions),
                  })}
                  className="mt-1 h-4 w-4 shrink-0 accent-red-600"
                />
                <span>{platformLabels[platform]}</span>
              </label>
            );
          })}
        </div>
        <p id="spotlight-platform-requirement" className={`mt-3 text-sm font-bold leading-6 ${missingPlatforms ? "text-amber-200" : "text-zinc-600"}`}>
          {missingPlatforms ? "Choose at least one place where the Spotlight will be used before continuing." : "Platform selected."}
        </p>
      </fieldset>

      <fieldset aria-describedby={request.primaryEmphasis === SpotlightEmphasis.Other && !request.emphasisOther?.trim() ? "spotlight-emphasis-help spotlight-emphasis-requirement" : "spotlight-emphasis-help"}>
        <legend className="text-base font-black text-white">What should viewers remember most? <span className="text-sm font-normal text-zinc-500">(optional)</span></legend>
        <p id="spotlight-emphasis-help" className="mt-2 text-sm font-bold leading-6 text-zinc-500">Choose the main idea the audience should remember after seeing the Spotlight.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {spotlightEmphasisOptions.map((option) => {
            const selected = request.primaryEmphasis === option.value;
            return (
              <label key={option.value} className={selectionClassName(selected)}>
                <input
                  type="radio"
                  name="spotlight-primary-emphasis"
                  checked={selected}
                  onChange={() => update({ primaryEmphasis: option.value })}
                  className="mt-1 h-4 w-4 shrink-0 accent-red-600"
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
        {request.primaryEmphasis === SpotlightEmphasis.Other ? (
          <label className={`${labelClassName} mt-4 block`}>
            Other emphasis
            <input
              id="spotlight-emphasis-other-text"
              required
              aria-invalid={!request.emphasisOther?.trim()}
              value={request.emphasisOther || ""}
              onChange={(event) => update({ emphasisOther: event.target.value || undefined })}
              className={inputClassName}
            />
          </label>
        ) : null}
        {request.primaryEmphasis === SpotlightEmphasis.Other && !request.emphasisOther?.trim() ? <p id="spotlight-emphasis-requirement" className="mt-3 text-sm font-bold leading-6 text-amber-200">Describe the other main idea before continuing.</p> : null}
        <div className={`${optionalPanelClassName} mt-4`}>
          <label className={labelClassName}>
            Add a more specific angle <span className="font-normal text-zinc-500">(optional)</span>
            <input
              value={request.specificAngle || ""}
              onChange={(event) => update({ specificAngle: event.target.value || undefined })}
              className={inputClassName}
            />
          </label>
        </div>
      </fieldset>

      <fieldset aria-describedby={request.media.includes(SpotlightMedia.Other) && !request.mediaOther?.trim() ? "spotlight-media-help spotlight-no-media-help spotlight-media-requirement" : "spotlight-media-help spotlight-no-media-help"}>
        <legend className="text-base font-black text-white">What media is available? <span className="text-sm font-normal text-zinc-500">(optional)</span></legend>
        <p id="spotlight-media-help" className="mt-2 text-sm font-bold leading-6 text-zinc-500">Choose what you already have. This records availability only; it does not upload files or grant media rights.</p>
        <p id="spotlight-no-media-help" className="mt-2 text-sm font-bold leading-6 text-zinc-500">Choosing No media yet clears the other media choices.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {spotlightMediaOptions.map((option) => {
            const selected = request.media.includes(option.value);
            return (
              <label key={option.value} className={selectionClassName(selected)}>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(event) => update({
                    media: nextSpotlightMediaSelection(request.media, option.value, event.target.checked),
                  })}
                  className="mt-1 h-4 w-4 shrink-0 accent-red-600"
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
        {request.media.includes(SpotlightMedia.Other) ? (
          <label className={`${labelClassName} mt-4 block`}>
            Describe other media
            <input
              id="spotlight-media-other-text"
              required
              aria-invalid={!request.mediaOther?.trim()}
              value={request.mediaOther || ""}
              onChange={(event) => update({ mediaOther: event.target.value || undefined })}
              className={inputClassName}
            />
          </label>
        ) : null}
        {request.media.includes(SpotlightMedia.Other) && !request.mediaOther?.trim() ? <p id="spotlight-media-requirement" className="mt-3 text-sm font-bold leading-6 text-amber-200">Describe the other available media before continuing.</p> : null}
        <div className={`${optionalPanelClassName} mt-4`}>
          <label className={labelClassName}>
            Describe the media you already have <span className="font-normal text-zinc-500">(optional)</span>
            <textarea
              value={request.mediaDescription || ""}
              onChange={(event) => update({ mediaDescription: event.target.value || undefined })}
              className={`${inputClassName} min-h-24 font-normal leading-6`}
            />
          </label>
        </div>
        <label className={`${selectionClassName(request.needShotList)} mt-4 max-w-xl`}>
          <input
            type="checkbox"
            checked={request.needShotList}
            onChange={(event) => update({ needShotList: event.target.checked })}
            className="mt-1 h-4 w-4 shrink-0 accent-red-600"
          />
          <span>
            <span className="block">I need a shot list</span>
            <span className="mt-1 block font-bold text-zinc-400">The Spotlight package will include a recommended photo and video shot list.</span>
          </span>
        </label>
      </fieldset>

      <label className={labelClassName}>
        Call to action <span className="font-normal text-zinc-500">(optional)</span>
        <input
          value={request.callToAction}
          onChange={(event) => update({ callToAction: event.target.value })}
          className={inputClassName}
        />
      </label>
    </div>
  );
}
