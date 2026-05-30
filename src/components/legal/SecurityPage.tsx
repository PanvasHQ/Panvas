import React from 'react';
import { Footer } from '@/components/layout/Footer';
import { ShieldCheck, HardDrive, Cloud, Lock } from 'lucide-react';

export function SecurityPage() {
  return (
    <div className="min-h-screen bg-[#0D1117] text-white flex flex-col font-sans">
      <div className="max-w-[800px] mx-auto px-6 py-24 flex-1 w-full">
        <div className="flex items-center gap-4 mb-6">
          <ShieldCheck size={40} className="text-panvas-accent-emerald" />
          <h1 className="text-4xl font-bold font-handwritten tracking-tight">Security at Panvas</h1>
        </div>
        <p className="text-panvas-text-secondary text-lg mb-12 max-w-2xl">
          We built Panvas on a local-first architecture. This fundamentally changes how your data is secured, 
          giving you absolute ownership while still providing the convenience of cloud sync.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <div className="bg-[#111111] border border-white/5 p-6 rounded-2xl">
            <HardDrive className="text-[#A3A3A3] mb-4" size={24} />
            <h3 className="text-lg font-semibold mb-2">Local First</h3>
            <p className="text-sm text-[#737373] leading-relaxed">
              Your device is the source of truth. Data is written immediately to IndexedDB in your browser. 
              If the cloud goes down, your workspace keeps functioning flawlessly.
            </p>
          </div>

          <div className="bg-[#111111] border border-white/5 p-6 rounded-2xl">
            <Lock className="text-[#A3A3A3] mb-4" size={24} />
            <h3 className="text-lg font-semibold mb-2">Data Ownership</h3>
            <p className="text-sm text-[#737373] leading-relaxed">
              You aren't renting space on our servers; you are running Panvas on your machine. We cannot 
              access your offline data, and we do not scan your synced data.
            </p>
          </div>

          <div className="bg-[#111111] border border-white/5 p-6 rounded-2xl">
            <Cloud className="text-[#A3A3A3] mb-4" size={24} />
            <h3 className="text-lg font-semibold mb-2">Secure Cloud Sync</h3>
            <p className="text-sm text-[#737373] leading-relaxed">
              When you opt-in to sync, data is transmitted securely via TLS to our Supabase infrastructure. 
              The Sync Engine ensures changes are seamlessly merged across devices.
            </p>
          </div>

          <div className="bg-[#111111] border border-white/5 p-6 rounded-2xl">
            <ShieldCheck className="text-[#A3A3A3] mb-4" size={24} />
            <h3 className="text-lg font-semibold mb-2">Row Level Security</h3>
            <p className="text-sm text-[#737373] leading-relaxed">
              Our PostgreSQL database uses strict Row Level Security (RLS). Cryptographic session tokens 
              guarantee that your data can only be queried by your authenticated user ID.
            </p>
          </div>
        </div>

        <div className="prose prose-invert prose-p:text-[#A3A3A3] prose-headings:text-white max-w-none">
          <h2 className="text-2xl font-semibold mb-4">Authentication</h2>
          <p>
            Panvas uses Supabase Auth, an enterprise-grade authentication system. We do not store passwords 
            in plain text; all credentials are salted and hashed using standard cryptographic algorithms (bcrypt).
          </p>

          <h2 className="text-2xl font-semibold mt-12 mb-4">Vulnerability Reporting</h2>
          <p>
            If you believe you have found a security vulnerability in Panvas, please report it immediately 
            to <a href="mailto:security@panvas.com" className="text-panvas-accent-primary hover:underline">security@panvas.com</a>. 
            We take all reports seriously and will work with you to resolve the issue promptly.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
