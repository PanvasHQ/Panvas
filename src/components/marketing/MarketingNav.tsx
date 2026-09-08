// ============================================
// Panvas — Marketing Navigation (Cybercore Edition)
// Frosted metallic header, Neo-Grotesk type, restrained status indicators
// ============================================

import React, { useState } from 'react';
import { Link } from 'wouter';
import { PANVAS_RELEASE } from './releaseMetadata';
import { captureEvent } from '@/lib/analytics';
import { Menu, X, ArrowRight, Github } from 'lucide-react';
import { CrosshairTick } from './CyberOrnament';

interface MarketingNavProps {
  onOpenWorkspace: () => void;
}

export const MarketingNav: React.FC<MarketingNavProps> = ({ onOpenWorkspace }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Notebooks', href: '#notebooks' },
    { label: 'Vector Ink', href: '#ink' },
    { label: 'PDF Workbench', href: '#pdf' },
    { label: 'Infinite Canvas', href: '#canvas' },
    { label: 'Local-First', href: '#local-first' },
    { label: 'FAQ', href: '#faq' },
    { label: 'Roadmap', href: '/roadmap', isRouter: true },
  ];

  const handleNavClick = (href: string, label: string) => {
    captureEvent('cta_click', { placement: `nav_${label.toLowerCase().replace(/\s+/g, '_')}` });
    setMobileMenuOpen(false);
    if (href.startsWith('#')) {
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <header
      className="fixed top-0 inset-x-0 h-16 z-50 border-b border-[#D6DEE2]/10 bg-[#080A0D]/75 backdrop-blur-2xl backdrop-saturate-150 transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
      role="banner"
    >
      <div className="max-w-[1440px] mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        
        {/* Left: Brand Identity + Build Indicator */}
        <div className="flex items-center gap-6 lg:gap-8">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#83C9EE] rounded-lg p-1"
            aria-label="Panvas Home"
          >
            <img
              src="/panvas-logo-1.1.png"
              alt="Panvas Brandmark"
              className="h-7 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
            />
            <div className="flex flex-col">
              <span className="font-sans text-sm font-semibold tracking-tight text-[#F5F7F7] leading-none group-hover:text-white transition-colors">
                Panvas
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#98A7B1] mt-0.5">
                {PANVAS_RELEASE.windows.releaseTag}
              </span>
            </div>
          </a>

          {/* Precision Alignment Mark */}
          <div className="hidden xl:block">
            <CrosshairTick size={10} className="text-[#B8C3CA]/25" />
          </div>
        </div>

        {/* Center: Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 font-sans text-[13px] font-medium tracking-tight text-[#B8C3CA]" aria-label="Main Navigation">
          {navLinks.map((link) => {
            if (link.isRouter) {
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className="hover:text-[#F5F7F7] transition-colors duration-150 py-1"
                >
                  {link.label}
                </Link>
              );
            }
            return (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(link.href, link.label);
                }}
                className="hover:text-[#F5F7F7] transition-colors duration-150 py-1"
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-3.5">
          {/* GitHub Star/Repo Link */}
          <a
            href={PANVAS_RELEASE.project.githubRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => captureEvent('external_link_click', { destination: 'github_nav' })}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#B8C3CA]/15 bg-[#0D1115]/80 text-[#D6DEE2] hover:text-white hover:border-[#D6DEE2]/40 font-sans text-xs font-medium transition-all duration-150"
            aria-label="View Panvas repository on GitHub"
          >
            <Github size={14} />
            <span>GitHub</span>
          </a>

          {/* Primary Launch Action Button */}
          <button
            type="button"
            onClick={() => {
              captureEvent('cta_click', { placement: 'nav_open_web' });
              onOpenWorkspace();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#EEF2F3] text-[#080A0D] border border-[#B8C3CA] hover:bg-white hover:shadow-[0_2px_16px_rgba(131,201,238,0.3)] font-sans text-xs font-semibold tracking-tight transition-all duration-150 active:scale-[0.98] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
          >
            <span>Launch Web App</span>
            <ArrowRight size={13} className="opacity-70" />
          </button>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg border border-[#B8C3CA]/15 text-[#D6DEE2] hover:text-white hover:bg-white/5 transition-colors focus:outline-none"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#D6DEE2]/10 bg-[#080A0D]/95 backdrop-blur-2xl px-6 py-6 space-y-4">
          <nav className="flex flex-col space-y-3 font-sans text-sm text-[#D6DEE2]">
            {navLinks.map((link) => {
              if (link.isRouter) {
                return (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-1 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                );
              }
              return (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick(link.href, link.label);
                  }}
                  className="py-1 hover:text-white transition-colors"
                >
                  {link.label}
                </a>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-white/8 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenWorkspace();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#EEF2F3] text-[#080A0D] font-sans text-xs font-semibold tracking-tight"
            >
              <span>Launch Panvas Web</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
