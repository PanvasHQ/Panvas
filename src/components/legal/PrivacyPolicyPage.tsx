import React from 'react';
import { Footer } from '@/components/layout/Footer';

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#0D1117] text-white flex flex-col font-sans">
      <div className="max-w-[800px] mx-auto px-6 py-24 flex-1 w-full">
        <h1 className="text-4xl font-bold mb-4 font-handwritten tracking-tight">Privacy Policy</h1>
        <p className="text-panvas-text-tertiary mb-12">Last updated: {new Date().toLocaleDateString()}</p>
        
        <div className="prose prose-invert prose-p:text-[#A3A3A3] prose-headings:text-white max-w-none">
          <p>
            Welcome to Panvas. We respect your privacy and are committed to protecting your personal data. 
            Because Panvas is built with a <strong>local-first architecture</strong>, the vast majority of your data 
            never leaves your device unless you explicitly enable Cloud Sync.
          </p>

          <h2 className="text-2xl font-semibold mt-12 mb-4">1. Data We Collect</h2>
          <p>
            When you use Panvas offline, <strong>we collect absolutely nothing</strong>. All your canvases, 
            folders, and custom blocks are stored entirely in your browser's IndexedDB.
          </p>
          <p>
            If you create an account to use Cloud Sync, we collect:
          </p>
          <ul className="list-disc pl-6 text-[#A3A3A3] mb-6 flex flex-col gap-2">
            <li>Your email address (for authentication).</li>
            <li>Basic profile information (if provided via OAuth).</li>
            <li>The encrypted or securely transmitted canvas data you explicitly sync to our Supabase backend.</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-12 mb-4">2. How We Use Your Data</h2>
          <p>
            Your synced data is used exclusively to provide the synchronization service across your devices. 
            We do not sell, rent, or share your canvas data, notes, or code blocks with any third parties, 
            including AI training models.
          </p>

          <h2 className="text-2xl font-semibold mt-12 mb-4">3. Data Security</h2>
          <p>
            All data synced to the cloud is protected by Row Level Security (RLS) policies. This ensures that 
            on a database level, no other user can query or access your workspaces, folders, or canvases.
          </p>

          <h2 className="text-2xl font-semibold mt-12 mb-4">4. Analytics</h2>
          <p>
            We use privacy-friendly analytics (PostHog) to understand how the application is used (e.g., page views, feature clicks). 
            This data is anonymized and helps us improve the user experience. You can opt out by using standard ad-blockers.
          </p>

          <h2 className="text-2xl font-semibold mt-12 mb-4">5. Your Rights</h2>
          <p>
            You can delete your account and all associated cloud data at any time. Because Panvas is local-first, 
            you can continue using the application entirely offline even after deleting your cloud account.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
