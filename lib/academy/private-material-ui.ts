// Keep the production UI off until DB, Storage E2E and API rollout gates pass.
export const privateMaterialUiEnabled = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_ACADEMY_PRIVATE_MATERIALS_ENABLED === "true";
