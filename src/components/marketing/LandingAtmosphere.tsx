import React from 'react';

/**
 * Lightweight, hardware-accelerated atmospheric background.
 * Uses layered CSS gradients and composite-only @keyframes animations
 * (transform and opacity) to achieve organic living sky depth with zero JS runtime overhead.
 */
export function LandingAtmosphere() {
  return (
    <div className="pl-atmosphere" aria-hidden="true">
      <div className="pl-atmosphere-sky" />
      <div className="pl-atmosphere-horizon" />
      {/* 3 Cloud layers with depth and distinct drift */}
      <div className="pl-atmosphere-cloud pl-cloud-far" />
      <div className="pl-atmosphere-cloud pl-cloud-mid" />
      <div className="pl-atmosphere-cloud pl-cloud-near" />
      {/* Two subtle light layers: broad sun glow + secondary soft glare */}
      <div className="pl-atmosphere-sun pl-sun-broad" />
      <div className="pl-atmosphere-sun-glare pl-sun-glare" />
      <div className="pl-atmosphere-halftone" />
      <div className="pl-atmosphere-scrap" />
    </div>
  );
}
