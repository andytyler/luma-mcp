export const EVENT_BACKGROUND_VARIANTS = ["serpent", "quantum", "classic-snake", "ribbon", "topography"] as const;

export type EventBackgroundVariant = (typeof EVENT_BACKGROUND_VARIANTS)[number];
