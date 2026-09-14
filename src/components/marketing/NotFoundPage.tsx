import { ArrowRight, Home } from 'lucide-react';
import { Link } from 'wouter';
import { PublicDocument, PublicPageShell } from './PublicPageShell';

export function NotFoundPage() {
  return (
    <PublicPageShell
      label="404 Error"
      title="Page not found."
      intro="The address you requested does not match a known Panvas page or document."
      aside={<>HTTP 404<br />Resource not located</>}
    >
      <PublicDocument>
        <section>
          <span className="pp-section-index">404</span>
          <div>
            <h2>Looking for your workspace?</h2>
            <p>
              If you were trying to access your local-first notes, digital notebooks, or infinite canvas, open the Panvas application directly.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '24px' }}>
              <Link href="/" className="pl-button pl-button-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', padding: '10px 18px', borderRadius: '6px' }}>
                <Home size={15} aria-hidden="true" />
                Back home
              </Link>
              <Link href="/app" className="pl-button pl-button-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', padding: '10px 18px', borderRadius: '6px' }}>
                Open Panvas
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </PublicDocument>
    </PublicPageShell>
  );
}

