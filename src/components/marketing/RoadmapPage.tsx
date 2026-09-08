import { PublicPageShell } from './PublicPageShell';

const phases=[
  {phase:'Now',title:'Release verification',items:['Finish Windows installer and clean-machine testing','Complete production landing, legal and attribution pages','Certify Google Drive sync across real desktop and browser devices','Finalize project license and release checksums']},
  {phase:'Next',title:'Public preview',items:['Ship the verified Windows pre-release','Deploy and verify the browser application and offline shell','Complete full-text search beyond titles','Finish remaining workspace explorer and settings actions']},
  {phase:'Later / exploring',title:'Post-release directions',items:['Native macOS and Linux packages','Browser and mobile handwriting recognition','Optional peer-to-peer or real-time collaboration','Additional provider adapters, including OneDrive']},
] as const;

export function RoadmapPage(){return <PublicPageShell label="Product / Roadmap" title="Built in the open. Verified before promised." intro="Panvas is moving through release verification. “Later” items are directions under exploration, not committed dates or guaranteed releases." aside={<>STATUS / V0.1.0 PRE-RELEASE<br/>Local workspace available<br/>Sync certification pending</>}>
  <section className="pp-roadmap" aria-label="Panvas roadmap">
    {phases.map(({phase,title,items})=><div className="pp-roadmap-row" key={phase}><span className="pp-roadmap-phase">{phase}</span><h2>{title}</h2><ul>{items.map(item=><li key={item}>{item}</li>)}</ul></div>)}
  </section>
</PublicPageShell>}
