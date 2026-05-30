import React from 'react';
import { Footer } from '@/components/layout/Footer';

export function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#0D1117] text-white flex flex-col font-sans">
      <div className="max-w-[800px] mx-auto px-6 py-24 flex-1 w-full">
        <h1 className="text-4xl font-bold mb-4 font-handwritten tracking-tight">Terms of Service</h1>
        <p className="text-panvas-text-tertiary mb-12">Last updated: {new Date().toLocaleDateString()}</p>
        
        <div className="prose prose-invert prose-p:text-[#A3A3A3] prose-headings:text-white max-w-none">
          <p>
            By accessing or using Panvas, you agree to be bound by these Terms of Service. If you disagree 
            with any part of the terms, you may not access the service.
          </p>

          <h2 className="text-2xl font-semibold mt-12 mb-4">1. Description of Service</h2>
          <p>
            Panvas is a visual thinking workspace that provides infinite canvases, document editing, and 
            diagramming tools. The service operates on a local-first architecture, meaning the primary copy 
            of your data resides on your device.
          </p>

          <h2 className="text-2xl font-semibold mt-12 mb-4">2. Account Creation</h2>
          <p>
            While you can use Panvas completely offline without an account, creating an account is required 
            to use our Cloud Sync features. You are responsible for safeguarding the password that you use to 
            access the service and for any activities or actions under your password.
          </p>

          <h2 className="text-2xl font-semibold mt-12 mb-4">3. User Content</h2>
          <p>
            You retain all rights and ownership to the content you create, upload, or store within Panvas. 
            We do not claim any ownership rights to your workspaces, notes, or diagrams.
          </p>

          <h2 className="text-2xl font-semibold mt-12 mb-4">4. Acceptable Use</h2>
          <p>
            You agree not to use Panvas to store or transmit illegal content, malware, or material that 
            infringes on the intellectual property rights of others. We reserve the right to terminate accounts 
            that violate these terms.
          </p>

          <h2 className="text-2xl font-semibold mt-12 mb-4">5. Disclaimer of Warranties</h2>
          <p>
            Panvas is provided "as is" and "as available". We do not warrant that the service will be 
            uninterrupted, error-free, or completely secure, although we take significant measures (like our 
            local-first design) to prevent data loss.
          </p>

          <h2 className="text-2xl font-semibold mt-12 mb-4">6. Limitation of Liability</h2>
          <p>
            In no event shall Panvas or its developers be liable for any indirect, incidental, special, 
            consequential, or punitive damages, including without limitation, loss of profits, data, or 
            other intangible losses resulting from your use of the service.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
