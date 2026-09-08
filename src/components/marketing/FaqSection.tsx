// ============================================
// Panvas — FAQ Section (Cybercore Edition)
// Editorial ruled disclosure rows with thin rules and smooth height reveal (No generic cards)
// ============================================

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FAQ_ITEMS } from './marketingTokens';
import { Plus } from 'lucide-react';

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="relative py-28 px-4 sm:px-6 lg:px-8 max-w-[1520px] mx-auto overflow-hidden">
      
      {/* Editorial Header */}
      <div className="max-w-3xl mb-16">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#83C9EE] mb-3">
          <span>07 // TECHNICAL CLARIFICATIONS</span>
        </div>
        <h2 className="font-sans text-4xl sm:text-6xl font-semibold tracking-[-0.03em] text-[#F5F7F7] mb-4 text-balance">
          Frequently Asked Questions.
        </h2>
        <p className="font-sans text-base sm:text-lg text-[#B8C3CA] leading-relaxed max-w-2xl">
          Direct technical answers covering local-first storage, platform support boundaries, accounts, and sync architecture.
        </p>
      </div>

      {/* Editorial Ruled List Container (No cards!) */}
      <div className="max-w-4xl border-t border-[#D6DEE2]/15">
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openIndex === index;
          const indexNum = String(index + 1).padStart(2, '0');
          const headingId = `faq-heading-${index}`;
          const panelId = `faq-panel-${index}`;

          return (
            <div
              key={item.question}
              className="border-b border-[#D6DEE2]/12 transition-colors"
            >
              <button
                type="button"
                id={headingId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggleItem(index)}
                className="w-full py-6 sm:py-7 text-left flex items-center justify-between gap-6 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#83C9EE] select-none group"
              >
                <div className="flex items-baseline gap-4 sm:gap-6">
                  <span className="font-mono text-xs text-[#708D9D] select-none">
                    {indexNum}
                  </span>
                  <span className="font-sans text-lg sm:text-xl font-medium text-[#F5F7F7] group-hover:text-white transition-colors">
                    {item.question}
                  </span>
                </div>

                <div
                  className={`w-6 h-6 flex items-center justify-center text-[#B8C3CA] transition-transform duration-200 shrink-0 ${
                    isOpen ? 'rotate-45 text-[#83C9EE]' : 'group-hover:text-white'
                  }`}
                >
                  <Plus size={18} />
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    id={panelId}
                    role="region"
                    aria-labelledby={headingId}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="pl-8 sm:pl-12 pb-7 pr-6 font-sans text-sm sm:text-base text-[#98A7B1] leading-relaxed max-w-3xl">
                      {item.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

    </section>
  );
};
