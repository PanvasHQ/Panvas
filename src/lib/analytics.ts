import posthog from 'posthog-js';

// Get these from env variables in a real deployment
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || 'YOUR_POSTHOG_KEY';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.posthog.com';

export const initAnalytics = () => {
  // Only initialize if we're not in a dev/test environment and have a valid key
  if (POSTHOG_KEY && POSTHOG_KEY !== 'YOUR_POSTHOG_KEY') {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      autocapture: false, // We'll manually capture important events
      capture_pageview: false, // Manually track pageviews via wouter/react
    });
  }
};

export const captureEvent = (eventName: string, properties?: Record<string, any>) => {
  if (POSTHOG_KEY && POSTHOG_KEY !== 'YOUR_POSTHOG_KEY') {
    posthog.capture(eventName, properties);
  } else {
    // Development fallback
    console.log(`[Analytics Event] ${eventName}`, properties);
  }
};

export const capturePageView = (url: string) => {
  if (POSTHOG_KEY && POSTHOG_KEY !== 'YOUR_POSTHOG_KEY') {
    posthog.capture('$pageview', {
      $current_url: url,
    });
  }
};
