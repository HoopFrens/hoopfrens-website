export type IntentTargetRoom =
  | "executive-office"
  | "intelligence-center"
  | "production-studio"
  | "strategy-room"
  | "product-lab"
  | "library"
  | "unknown";

export interface IntentRoute {
  targetWorkspace: "executive-workspace";
  targetRoom: IntentTargetRoom;
}
