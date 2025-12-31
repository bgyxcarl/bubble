import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'info';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger'
}) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[201]">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-md bg-white border-4 border-black neo-shadow-lg pointer-events-auto overflow-hidden"
            >
              {/* Header */}
              <div className={`p-4 border-b-4 border-black flex items-center justify-between ${variant === 'danger' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'}`}>
                <h3 className="font-black uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle size={20} />
                  {title}
                </h3>
                <button
                  onClick={onClose}
                  className="hover:scale-110 transition-transform"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6">
                <p className="text-gray-900 font-medium">
                  {description}
                </p>
              </div>

              {/* Footer */}
              <div className="p-4 border-t-4 border-black bg-gray-50 flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border-2 border-black font-bold uppercase text-xs neo-shadow-sm neo-shadow-hover neo-shadow-active bg-white"
                >
                  {cancelText}
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={`px-6 py-2 border-2 border-black font-bold uppercase text-xs neo-shadow-sm neo-shadow-hover neo-shadow-active text-white ${variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ConfirmDialog;
