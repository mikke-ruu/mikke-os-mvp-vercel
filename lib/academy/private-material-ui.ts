// Keep the production UI off until DB, Storage E2E and API rollout gates pass.
export const privateMaterialUiEnabled = process.env.NODE_ENV === "development";
