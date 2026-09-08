/** Release-gated capabilities. Both are opt-in and false in an ordinary local build. */
export const CLOUD_SYNC_ENABLED = import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true';
export const CLOUD_SYNC_V2_ENABLED = import.meta.env.VITE_PANVAS_SYNC_V2 === 'true';
export const ANALYTICS_ENABLED = import.meta.env.VITE_ENABLE_ANALYTICS === 'true'
  && import.meta.env.VITE_MARKETING_ONLY === 'true';
