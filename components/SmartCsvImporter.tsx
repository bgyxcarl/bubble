import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, CheckCircle2, Target, Loader2 } from 'lucide-react';
import { normalizeCsvData } from '@/services/geminiService';
import { Transaction, TxType } from '../types';

const MotionDiv = motion.div as any;

interface SmartCsvImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (newTxns: Transaction[], addedNative: number, addedErc20: number, reason: string) => void;
  theme: 'light' | 'dark';
  onAddBaseAddresses: (addresses: string[]) => void;
  initialBaseAddresses?: string; // Optional pre-fill
}

type ImportTypeHint = 'native' | 'erc20' | 'mixed';

const parseCSVRow = (row: string): string[] => {
  const result = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      inQuote = !inQuote;
    } else if (char === ',' && !inQuote) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
};

const SmartCsvImporter: React.FC<SmartCsvImporterProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  theme,
  onAddBaseAddresses,
  initialBaseAddresses = ''
}) => {
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [importHint, setImportHint] = useState<ImportTypeHint>('native');
  const [csvBaseAddress, setCsvBaseAddress] = useState(initialBaseAddresses);
  const [importResultMsg, setImportResultMsg] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const bgMain = theme === 'light' ? 'bg-white' : 'bg-[#1a1a1a]';
  const borderMain = theme === 'light' ? 'border-black' : 'border-gray-600';
  const textMain = theme === 'light' ? 'text-black' : 'text-gray-100';
  const inputBg = theme === 'light' ? 'bg-white' : 'bg-black text-white border-gray-700';

  const resetState = () => {
    setImportStep(1);
    setCsvBaseAddress('');
    setImportResultMsg('');
  };

  const handleClose = () => {
    onClose();
    resetState();
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (csvBaseAddress.trim()) {
      const targets = csvBaseAddress.split(/[\n, ]+/).filter(t => t.trim().length > 0);
      onAddBaseAddresses(targets);
    }

    setImportStep(2);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim() !== '');
      const snippet = lines.slice(0, 5).join('\n');

      try {
        const mapping = await normalizeCsvData(snippet, importHint);
        const startIdx = mapping.hasHeader ? 1 : 0;
        let addedNative = 0;
        let addedErc20 = 0;

        const newTxns: Transaction[] = lines.slice(startIdx).map(line => {
          const cols = parseCSVRow(line);
          if (cols.length < 2) return null;
          const getCol = (idx: number) => idx > -1 && cols[idx] ? cols[idx] : '';

          let valStr = getCol(mapping.valueIndex).replace(/,/g, '');
          const val = parseFloat(valStr);

          let tokenSymbol = getCol(mapping.tokenIndex);
          if (tokenSymbol) tokenSymbol = tokenSymbol.toUpperCase();

          let rowType: TxType = 'native';
          if (importHint === 'native') rowType = 'native';
          else if (importHint === 'erc20') rowType = 'erc20';
          else if (mapping.detectedType === 'mixed' || importHint === 'mixed') {
            rowType = tokenSymbol && tokenSymbol.length > 0 ? 'erc20' : 'native';
          } else {
            rowType = mapping.detectedType === 'erc20' ? 'erc20' : 'native';
          }

          if (rowType === 'native') addedNative++;
          else addedErc20++;

          let timestampStr = getCol(mapping.timestampIndex);
          if (!timestampStr) {
            timestampStr = new Date().toISOString();
          } else {
            const num = Number(timestampStr);
            if (!isNaN(num) && num > 0) {
              if (num < 10000000000) {
                timestampStr = new Date(num * 1000).toISOString();
              } else {
                timestampStr = new Date(num).toISOString();
              }
            } else {
              const parsed = Date.parse(timestampStr);
              if (!isNaN(parsed)) {
                timestampStr = new Date(parsed).toISOString();
              } else {
                timestampStr = new Date().toISOString();
              }
            }
          }

          return {
            id: Math.random().toString(36).substr(2, 9),
            hash: getCol(mapping.hashIndex) || `0x${Math.random().toString(16).substr(2, 16)}...`,
            method: getCol(mapping.methodIndex) || 'Transfer',
            block: parseInt(getCol(mapping.blockIndex)) || 0,
            timestamp: timestampStr,
            from: getCol(mapping.fromIndex) || '0xUnknown',
            to: getCol(mapping.toIndex) || '0xUnknown',
            value: isNaN(val) ? 0 : val,
            token: tokenSymbol || (rowType === 'native' ? 'ETH' : 'TOKEN'),
            fee: rowType === 'native' ? (parseFloat(getCol(mapping.feeIndex)) || 0) : undefined,
            type: rowType,
            status: 'success'
          };
        }).filter(Boolean) as Transaction[];

        onImportComplete(newTxns, addedNative, addedErc20, mapping.confidenceReason || 'User Hint + AI Verification');

        setImportResultMsg(`Success! AI analyzed the file structure.\n\nAdded:\n• ${addedNative} to Transactions (Native)\n• ${addedErc20} to Transfers (ERC20)\n\nReason: ${mapping.confidenceReason || 'User Hint + AI Verification'}`);
        setImportStep(3);

      } catch (err) {
        console.error(err);
        setImportResultMsg("Analysis Failed. The file format was too ambiguous.");
        setImportStep(3);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <MotionDiv
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6"
        >
          <MotionDiv
            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
            className={`w-full max-w-lg ${bgMain} border-4 ${borderMain} neo-shadow-lg p-8 relative ${textMain}`}
          >
            <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X size={24} /></button>

            {importStep === 1 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-blue-600 text-white p-2 border-2 border-black"><Upload size={24} /></div>
                  <h2 className="text-2xl font-black uppercase">Import Data Source</h2>
                </div>
                <p className="text-sm font-mono text-gray-500">Step 1: Help our AI understand your CSV content.</p>

                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded border border-gray-300 dark:border-gray-700">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-gray-500 flex items-center gap-2">
                    <Target size={12} /> Base/Seed Addresses (Optional)
                  </label>
                  <textarea
                    placeholder="Enter addresses to mark as '0' node (comma or newline separated)..."
                    value={csvBaseAddress}
                    onChange={(e) => setCsvBaseAddress(e.target.value)}
                    className={`w-full p-2 border border-gray-400 ${inputBg} text-sm font-mono h-24 resize-none`}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">These addresses will be highlighted with a red badge in visualizations.</p>
                </div>

                <div className="space-y-3">
                  <button onClick={() => setImportHint('native')} className={`w-full p-4 border-2 flex items-center justify-between transition-all ${importHint === 'native' ? 'border-blue-600 bg-blue-50/10' : 'border-gray-200 hover:border-gray-400'}`}>
                    <span className="font-bold">Native Transactions (ETH/BTC)</span>
                    {importHint === 'native' && <CheckCircle2 className="text-blue-600" />}
                  </button>
                  <button onClick={() => setImportHint('erc20')} className={`w-full p-4 border-2 flex items-center justify-between transition-all ${importHint === 'erc20' ? 'border-purple-600 bg-purple-50/10' : 'border-gray-200 hover:border-gray-400'}`}>
                    <span className="font-bold">Token Transfers (ERC20)</span>
                    {importHint === 'erc20' && <CheckCircle2 className="text-purple-600" />}
                  </button>
                  <button onClick={() => setImportHint('mixed')} className={`w-full p-4 border-2 flex items-center justify-between transition-all ${importHint === 'mixed' ? 'border-orange-500 bg-orange-50/10' : 'border-gray-200 hover:border-gray-400'}`}>
                    <span className="font-bold">Mixed / Unsure</span>
                    {importHint === 'mixed' && <CheckCircle2 className="text-orange-500" />}
                  </button>
                </div>

                <input type="file" ref={fileInputRef} onChange={handleCSVImport} className="hidden" accept=".csv" />
                <button onClick={triggerFileUpload} className={`w-full py-3 font-black uppercase tracking-widest transition-colors ${theme === 'light' ? 'bg-black text-white hover:bg-gray-800' : 'bg-white text-black hover:bg-gray-200'}`}>
                  Select CSV File
                </button>
              </div>
            )}

            {importStep === 2 && (
              <div className="text-center py-12">
                <Loader2 size={48} className="animate-spin mx-auto mb-4 text-blue-600" />
                <h3 className="text-xl font-black uppercase mb-2">AI Analysis in Progress...</h3>
                <p className="text-sm font-mono text-gray-500">Detecting columns and classifying rows...</p>
              </div>
            )}
            {importStep === 3 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-green-500 text-white p-2 border-2 border-black"><CheckCircle2 size={24} /></div>
                  <h2 className="text-2xl font-black uppercase">Import Complete</h2>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 p-4 border-2 border-gray-300 dark:border-gray-700 font-mono text-sm whitespace-pre-line leading-relaxed">
                  {importResultMsg}
                </div>
                <button onClick={handleClose} className={`w-full py-3 font-black uppercase tracking-widest transition-colors ${theme === 'light' ? 'bg-black text-white hover:bg-gray-800' : 'bg-white text-black hover:bg-gray-200'}`}>
                  Done
                </button>
              </div>
            )}
          </MotionDiv>
        </MotionDiv>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default SmartCsvImporter;
