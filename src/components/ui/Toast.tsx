// ============================================
// Panvas — Toast Notification
// ============================================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

export function Toast() {
  const { toast, clearToast } = useUIStore();

  const icons = {
    info: <Info size={15} className="text-panvas-accent-blue" />,
    success: <CheckCircle size={15} className="text-panvas-accent-emerald" />,
    error: <AlertCircle size={15} className="text-panvas-accent-rose" />,
  };

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50
                     flex items-center gap-2.5 px-4 py-2.5
                     rounded-lg glass-panel shadow-2xl"
        >
          {icons[toast.type]}
          <span className="text-sm text-panvas-text-primary">{toast.message}</span>
          <button onClick={clearToast} className="btn-icon p-0.5 ml-1">
            <X size={12} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
