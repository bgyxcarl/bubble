import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Transaction, TxType } from '../types';
import { Edit2, Save, Plus, Trash2, Upload, FileJson, Table as TableIcon, Download, Loader2, ArrowUp, ArrowDown, ArrowUpDown, Search, X, CheckCircle2, Network, Copy, CheckSquare, Square, ClipboardCheck, MoreHorizontal, CalendarClock, Target, Cloud, CloudDownload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SUPPORTED_CHAINS } from '@/lib/constants';
import { useSession } from 'next-auth/react';
import SmartCsvImporter from './SmartCsvImporter';
import { toast } from 'sonner';
import ConfirmDialog from './ConfirmDialog';

const MotionDiv = motion.div as any;
const MotionTr = motion.tr as any;

interface DataEditorProps {
  data: Transaction[];
  setData: React.Dispatch<React.SetStateAction<Transaction[]>>;
  activeType: TxType;
  setActiveType: (type: TxType) => void;
  theme: 'light' | 'dark';
  baseAddresses: Set<string>;
  setBaseAddresses: React.Dispatch<React.SetStateAction<Set<string>>>;
}

type SortKey = keyof Transaction;
type SortDirection = 'asc' | 'desc';

const InteractiveCell = ({ value, label, truncateLen = 14, theme }: { value: string, label: string, truncateLen?: number, theme: 'light' | 'dark' }) => {
  const [showFull, setShowFull] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (value) {
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const truncated = value && value.length > truncateLen ? `${value.slice(0, 6)}...${value.slice(-6)}` : value;

  return (
    <div
      className="relative group inline-block"
      onMouseEnter={() => setShowFull(true)}
      onMouseLeave={() => setShowFull(false)}
    >
      <span className={`cursor-pointer ${theme === 'light' ? 'text-blue-600 hover:text-blue-800' : 'text-blue-400 hover:text-blue-300'} font-medium`}>
        {truncated}
      </span>

      <AnimatePresence>
        {showFull && (
          <MotionDiv
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className={`absolute z-50 bottom-full left-0 mb-2 px-3 py-2 text-xs font-mono font-bold whitespace-nowrap border-2 border-black neo-shadow-sm ${theme === 'light' ? 'bg-yellow-100 text-black' : 'bg-gray-800 text-white'}`}
          >
            <div className="flex items-center gap-2 cursor-pointer" onClick={handleCopy}>
              <span>{value}</span>
              {copied ? <CheckCircle2 size={12} className="text-green-600" /> : <Copy size={12} className="opacity-50" />}
            </div>
            <div className={`absolute bottom-[-6px] left-4 w-3 h-3 border-r-2 border-b-2 border-black transform rotate-45 ${theme === 'light' ? 'bg-yellow-100' : 'bg-gray-800'}`}></div>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
};

const DataEditor: React.FC<DataEditorProps> = ({ data, setData, activeType, setActiveType, theme, baseAddresses, setBaseAddresses }) => {
  const { data: session } = useSession();
  const [viewMode, setViewMode] = useState<'raw' | 'formatted'>('formatted');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempRow, setTempRow] = useState<any | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch Modal State
  const [showFetchModal, setShowFetchModal] = useState(false);
  const [fetchAddress, setFetchAddress] = useState<string>('');
  const [fetchChainId, setFetchChainId] = useState('1');
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string>('');

  const [useDateFilter, setUseDateFilter] = useState(true);
  const [fetchStartDate, setFetchStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    return d.toISOString().split('T')[0];
  });
  const [fetchEndDate, setFetchEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Import Modal State
  const [showImportWizard, setShowImportWizard] = useState(false);

  // Base Address Management State
  const [showBaseAddressManager, setShowBaseAddressManager] = useState(false);
  const [newBaseAddressInput, setNewBaseAddressInput] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'timestamp',
    direction: 'desc'
  });

  // Cloud Save/Load State
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTableName, setSaveTableName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [userTables, setUserTables] = useState<any[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);

  // Table management state
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [newTableName, setNewTableName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Deletion Dialog State
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    id: string;
    mode: 'row' | 'table';
    tableId?: string;
    type?: TxType;
  }>({ isOpen: false, id: '', mode: 'row' });




  const bgMain = theme === 'light' ? 'bg-white' : 'bg-[#1a1a1a]';
  const bgSub = theme === 'light' ? 'bg-gray-100' : 'bg-[#222]';
  const borderMain = theme === 'light' ? 'border-black' : 'border-gray-600';
  const textMain = theme === 'light' ? 'text-black' : 'text-gray-100';
  const inputBg = theme === 'light' ? 'bg-white' : 'bg-black text-white border-gray-700';

  const handleSort = (key: SortKey) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const sortedData = useMemo(() => {
    let filtered = data.filter(t => t.type === activeType);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        (t.hash && t.hash.toLowerCase().includes(q)) ||
        (t.from && t.from.toLowerCase().includes(q)) ||
        (t.to && t.to.toLowerCase().includes(q)) ||
        (t.token && t.token.toLowerCase().includes(q)) ||
        (t.method && t.method.toLowerCase().includes(q)) ||
        String(t.block).includes(q)
      );
    }

    if (!sortConfig.key) return filtered;

    return [...filtered].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal === bVal) return 0;
      if (aVal === undefined) return 1;
      if (bVal === undefined) return -1;

      let comparison = 0;
      if (sortConfig.key === 'value' || sortConfig.key === 'block' || sortConfig.key === 'fee') {
        comparison = (aVal as number) - (bVal as number);
      } else if (sortConfig.key === 'timestamp') {
        // Convert to string safely before creating Date to avoid type overlap errors
        comparison = new Date(String(aVal)).getTime() - new Date(String(bVal)).getTime();
      } else {
        const strA = aVal !== null && aVal !== undefined ? String(aVal) : '';
        const strB = bVal !== null && bVal !== undefined ? String(bVal) : '';
        comparison = strA.localeCompare(strB);
      }
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [data, activeType, sortConfig, searchQuery]);

  const handleSelectAll = () => {
    if (selectedIds.size === sortedData.length && sortedData.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedData.map(d => d.id)));
    }
  };

  const handleSelectRow = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleAddBaseAddress = () => {
    if (newBaseAddressInput.trim()) {
      const newSet = new Set(baseAddresses);
      newSet.add(newBaseAddressInput.trim().toLowerCase());
      setBaseAddresses(newSet);
      setNewBaseAddressInput('');
    }
  };

  const handleRemoveBaseAddress = (addr: string) => {
    const newSet = new Set(baseAddresses);
    newSet.delete(addr);
    setBaseAddresses(newSet);
  };

  const handleCopyToClipboard = () => {
    const targetData = selectedIds.size > 0
      ? sortedData.filter(d => selectedIds.has(d.id))
      : sortedData;

    if (targetData.length === 0) return;

    const headers = ['Hash', 'Method', 'Block', 'Time', 'From', 'To', 'Value', activeType === 'native' ? 'Fee' : 'Token'];
    const rows = targetData.map(d => [
      d.hash,
      d.method,
      d.block,
      d.timestamp,
      d.from,
      d.to,
      d.value,
      activeType === 'native' ? d.fee : d.token
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');

    navigator.clipboard.writeText(csvContent).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  const handleStartEdit = (row: Transaction) => {
    setEditingId(row.id);
    setTempRow({ ...row });
  };

  const handleSave = async () => {
    if (tempRow) {
      const finalRow: Transaction = {
        ...tempRow,
        value: typeof tempRow.value === 'string' ? parseFloat(tempRow.value) : tempRow.value,
        fee: tempRow.fee && typeof tempRow.fee === 'string' ? parseFloat(tempRow.fee) : tempRow.fee,
        block: typeof tempRow.block === 'string' ? parseInt(tempRow.block) : tempRow.block,
        token: tempRow.token ? tempRow.token.toUpperCase() : 'TOKEN'
      };

      if (isNaN(finalRow.value)) finalRow.value = 0;

      // If it's a DB row, update it
      if (finalRow.tableId) {
        try {
          const res = await fetch('/api/data-row', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalRow)
          });
          if (!res.ok) {
            toast.error('Failed to update row in database');
            return;
          }
        } catch (e) {
          console.error(e);
          toast.error('Error updating row');
          return;
        }
      } else if (activeTableId) {
        // New row in a loaded table -> Create it in DB
        try {
          const res = await fetch('/api/data-row', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...finalRow, tableId: activeTableId })
          });
          const result = await res.json();
          if (res.ok) {
            finalRow.id = result.id;
            finalRow.tableId = result.tableId;
          } else {
            toast.error('Failed to create row in database: ' + result.error);
            return;
          }
        } catch (e) {
          console.error(e);
          toast.error('Error creating row');
          return;
        }
      }

      setData(prev => prev.map(row => row.id === tempRow.id ? finalRow : row)); // tempRow.id is the temp ID
      setIsDbLoaded(false);
      setEditingId(null);
      setTempRow(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTempRow(null);
  };

  const handleChange = (field: keyof Transaction, value: any) => {
    if (tempRow) {
      setTempRow({ ...tempRow, [field]: value });
    }
  };

  const handleDelete = (id: string, tableId?: string, type?: TxType) => {
    setDeleteConfirm({ isOpen: true, id, tableId, type, mode: 'row' });
  };

  const executeDelete = async () => {
    const { id, tableId, type, mode } = deleteConfirm;

    if (mode === 'table') {
      try {
        const res = await fetch(`/api/user-tables/${id}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          setUserTables(prev => prev.filter(t => t.id !== id));
          if (activeTableId === id) {
            setActiveTableId(null);
            setIsDbLoaded(false);
          }
          toast.success("Table deleted successfully");
        } else {
          const data = await res.json();
          toast.error(`Failed to delete table: ${data.error}`);
        }
      } catch (error) {
        console.error(error);
        toast.error('Error deleting table');
      }
      return;
    }

    if (tableId && type) {
      try {
        const res = await fetch(`/api/data-row?id=${id}&type=${type}&tableId=${tableId}`, {
          method: 'DELETE'
        });
        if (!res.ok) {
          toast.error('Failed to delete from database');
          return;
        }
      } catch (e) {
        console.error(e);
        toast.error('Error deleting row');
        return;
      }
    }

    setData(prev => prev.filter(row => row.id !== id));
    if (selectedIds.has(id)) {
      const newSet = new Set(selectedIds);
      newSet.delete(id);
      setSelectedIds(newSet);
    }
    setIsDbLoaded(false);
    toast.success("Row deleted successfully");
  };

  const handleAddRow = () => {
    const newRow: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      hash: `0x${Math.random().toString(16).substr(2, 16)}...`,
      method: 'Transfer',
      block: 18000000,
      timestamp: new Date().toISOString(),
      from: '0x...',
      to: '0x...',
      value: 0,
      token: activeType === 'native' ? 'ETH' : 'USDC',
      fee: activeType === 'native' ? 0.001 : undefined,
      type: activeType,
      status: 'pending'
    };
    setData([newRow, ...data]);

    // If not working on a DB table, we mark as not db loaded (meaning "dirty").
    // If we are on a DB table, we keep it "loaded" conceptually, but we need to save the new row.
    // Actually, "isDbLoaded" controls the "Save" button state (disabled if loaded).
    // If we simply add a row, we want to allow editing it.

    if (!activeTableId) {
      setIsDbLoaded(false);
    }
    // If activeTableId exists, we don't set isDbLoaded(false) necessarily? 
    // Actually, setting isDbLoaded(false) enables the big "Save" button for the whole table.
    // If we are syncing per-row, we might not need the big save button for *this* change, 
    // BUT we might still want it for compatibility.
    // However, the user request "add needs to sync update data" implies immediate persistence or consistency.
    // Let's keep isDbLoaded(false) only if we aren't auto-saving.
    // But my plan is to auto-save the new row on "Save" checkmark click.

    handleStartEdit(newRow);
  };

  const handleImportComplete = (newTxns: Transaction[], addedNative: number, addedErc20: number, reason: string) => {
    setData(prev => [...newTxns, ...prev]);
    setIsDbLoaded(false);
    // Logic for success message is now handled inside SmartCsvImporter or we can show a toast here if needed.
    // The modal closes itself or waits for user to close.
    // In the old logic, it showed result message in step 3. 
    // SmartCsvImporter handles step 3.
  };

  const handleAddBaseAddresses = (addresses: string[]) => {
    const newSet = new Set(baseAddresses);
    addresses.forEach(t => newSet.add(t.trim().toLowerCase()));
    setBaseAddresses(newSet);
  };




  const handleFetch = async () => {
    if (!fetchAddress.trim()) return;

    setIsFetching(true);
    setFetchError('');

    const addresses = fetchAddress.split(/[\n, ]+/).map(a => a.trim()).filter(a => a.length > 0);

    if (addresses.length === 0) {
      setIsFetching(false);
      return;
    }

    const newBaseSet = new Set(baseAddresses);
    addresses.forEach(addr => newBaseSet.add(addr.toLowerCase()));
    setBaseAddresses(newBaseSet);

    try {
      let dateRange;
      if (useDateFilter) {
        const endObj = new Date(fetchEndDate);
        endObj.setHours(23, 59, 59, 999);
        dateRange = {
          start: new Date(fetchStartDate),
          end: endObj
        };
      }

      let allFetchedTxns: Transaction[] = [];
      let failCount = 0;

      for (const addr of addresses) {
        const response = await fetch('/api/address-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ address: addr, chainId: fetchChainId, dateRange }),
        });
        const result = await response.json();

        if (result.error) {
          console.warn(`Fetch failed for ${addr}:`, result.error);
          failCount++;
        } else {
          allFetchedTxns = [...allFetchedTxns, ...result.data];
        }

        if (addresses.length > 1) {
          await new Promise(r => setTimeout(r, 200));
        }
      }

      if (allFetchedTxns.length === 0 && failCount > 0) {
        setFetchError(`Failed to fetch data. ${failCount} addresses failed.`);
      } else {
        if (allFetchedTxns.length === 0) {
          setFetchError("No transactions found for these addresses.");
        } else {
          setData(prev => {
            const existingHashes = new Set(prev.map(t => t.hash));
            const uniqueNewTxns = allFetchedTxns.filter(t => !existingHashes.has(t.hash));
            return [...uniqueNewTxns, ...prev];
          });
          setIsDbLoaded(false);

          if (failCount > 0) {
            console.warn(`${failCount} addresses failed to fetch.`);
          }

          setShowFetchModal(false);
          setFetchAddress('');
        }
      }
    } catch (e) {
      setFetchError('An unexpected error occurred during batch fetch.');
      console.error(e);
    } finally {
      setIsFetching(false);
    }
  };

  const handleSaveTable = async () => {
    // We now save ALL data, not just activeType
    const dataToSave = data;

    if (dataToSave.length === 0) {
      toast.warning(`No data to save.`);
      return;
    }

    if (!saveTableName.trim()) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/user-tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: saveTableName, data: dataToSave })
      });
      const result = await response.json();
      if (response.ok) {
        setShowSaveModal(false);
        setSaveTableName('');
        toast.success('Table saved successfully!');
      } else {
        toast.error(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to save table.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadTableList = async () => {
    setIsLoadingTables(true);
    setShowLoadModal(true);
    try {
      const response = await fetch('/api/user-tables');
      if (response.ok) {
        const tables = await response.json();
        setUserTables(tables);
      } else {
        console.error('Failed to fetch tables');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingTables(false);
    }
  };

  const handleImportTable = async (tableId: string) => {
    try {
      const response = await fetch(`/api/user-tables/${tableId}`);
      if (response.ok) {
        const result = await response.json();
        // Merge data
        const newTxns = result.data;
        setData(prev => {
          const existingHashes = new Set(prev.map(t => t.hash));
          const uniqueNewTxns = newTxns.filter((t: Transaction) => !existingHashes.has(t.hash));
          return [...uniqueNewTxns, ...prev];
        });
        setIsDbLoaded(true);
        setActiveTableId(result.id);
        setShowLoadModal(false);
        // Map Prisma Enum to frontend TxType
        // Map Prisma Enum to frontend TxType
        const mappedType = result.type === 'TRANSACTION' ? 'native' :
          result.type === 'TOKEN_TRANSFER' ? 'erc20' :
            result.type === 'MIXED' ? 'native' : // Default to native for mixed
              'native'; // Fallback

        if (mappedType !== activeType) {
          setActiveType(mappedType);
        }
      } else {
        toast.error('Failed to load table data.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error loading table.');
    }
  };

  const handleDeleteTable = async (e: React.MouseEvent, tableId: string) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, id: tableId, mode: 'table' });
  };

  const handleStartRenameTable = (e: React.MouseEvent, table: any) => {
    e.stopPropagation();
    setEditingTableId(table.id);
    setNewTableName(table.name);
  };

  const handleCancelRenameTable = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTableId(null);
    setNewTableName('');
  };

  const handleRenameTable = async (e: React.MouseEvent, tableId: string) => {
    e.stopPropagation();
    if (!newTableName.trim()) return;

    setIsRenaming(true);
    try {
      const res = await fetch(`/api/user-tables/${tableId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTableName })
      });

      if (res.ok) {
        const updated = await res.json();
        setUserTables(prev => prev.map(t => t.id === tableId ? { ...t, name: updated.name } : t));
        setEditingTableId(null);
        toast.success("Table renamed successfully");
      } else {
        const data = await res.json();
        toast.error(`Failed to rename table: ${data.error}`);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error renaming table');
    } finally {
      setIsRenaming(false);
    }
  };


  const truncate = (str: string, len = 14) => {
    if (str.length < len) return str;
    return `${str.slice(0, 6)}...${str.slice(-6)}`;
  };

  const SortHeader = ({ label, field, className = "" }: { label: string, field: SortKey, className?: string }) => (
    <th
      onClick={() => handleSort(field)}
      className={`p-4 font-mono text-xs uppercase tracking-wider border-b-4 ${borderMain} ${theme === 'light' ? 'bg-gray-900 text-white' : 'bg-black text-white'} cursor-pointer hover:bg-gray-800 transition-colors select-none group whitespace-nowrap ${className}`}
    >
      <div className="flex items-center gap-2">
        {label}
        <span className="opacity-50 group-hover:opacity-100 transition-opacity">
          {sortConfig.key === field ? (
            sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-blue-400" /> : <ArrowDown size={12} className="text-blue-400" />
          ) : (
            <ArrowUpDown size={12} />
          )}
        </span>
      </div>
    </th>
  );

  const editInputClass = `w-full ${inputBg} border-2 border-indigo-300 focus:border-blue-600 font-black p-2 text-sm shadow-inner outline-none transition-colors rounded-sm`;

  return (
    <div className={`${bgMain} p-6 rounded-none border-4 ${borderMain} neo-shadow h-full flex flex-col relative`}>

      <SmartCsvImporter
        isOpen={showImportWizard}
        onClose={() => setShowImportWizard(false)}
        onImportComplete={handleImportComplete}
        theme={theme}
        onAddBaseAddresses={handleAddBaseAddresses}
      />

      <div className="flex flex-col gap-4 mb-4">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className={`flex mr-2 border-2 ${borderMain} ${bgSub} p-1`}>
              <button
                onClick={() => { setActiveType('native'); setSelectedIds(new Set()); }}
                className={`px-4 py-1.5 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${activeType === 'native'
                  ? (theme === 'light' ? 'bg-black text-white' : 'bg-white text-black')
                  : 'text-gray-500'}`}
              >
                Transactions
              </button>
              <button
                onClick={() => { setActiveType('erc20'); setSelectedIds(new Set()); }}
                className={`px-4 py-1.5 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${activeType === 'erc20' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
              >
                Token Transfers
              </button>
            </div>

            <div className="relative flex items-center h-full group">
              <div className="absolute left-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                <Search size={16} />
              </div>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-9 pr-8 py-2 border-2 ${borderMain} font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-200 w-32 md:w-64 transition-all ${inputBg}`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="flex gap-1 relative">
              <button
                onClick={() => setShowBaseAddressManager(!showBaseAddressManager)}
                className={`p-2 border-2 ${borderMain} transition-all ${baseAddresses.size > 0 ? 'bg-red-50 text-red-600 border-red-200' : `${bgMain} ${textMain} hover:bg-gray-200/50`}`}
                title="Manage Base/Target Addresses"
              >
                <Target size={18} />
              </button>

              <button onClick={() => setViewMode('formatted')} className={`p-2 border-2 ${borderMain} transition-all ${viewMode === 'formatted' ? 'bg-yellow-400 text-black' : `${bgMain} ${textMain} hover:bg-gray-200/50`}`}><TableIcon size={18} /></button>
              <button onClick={() => setViewMode('raw')} className={`p-2 border-2 ${borderMain} transition-all ${viewMode === 'raw' ? 'bg-pink-500 text-white' : `${bgMain} ${textMain} hover:bg-gray-200/50`}`}><FileJson size={18} /></button>

              <AnimatePresence>
                {showBaseAddressManager && (
                  <MotionDiv
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className={`absolute top-12 left-0 z-50 w-72 ${bgMain} border-4 ${borderMain} neo-shadow p-4`}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-black text-xs uppercase">Base Targets (Nodes)</h4>
                      <button onClick={() => setShowBaseAddressManager(false)}><X size={14} /></button>
                    </div>
                    <div className="flex gap-2 mb-3">
                      <input
                        value={newBaseAddressInput}
                        onChange={(e) => setNewBaseAddressInput(e.target.value)}
                        placeholder="Add address..."
                        className={`flex-1 text-xs p-2 border-2 ${borderMain} ${inputBg}`}
                      />
                      <button onClick={handleAddBaseAddress} className="bg-blue-600 text-white p-2 border-2 border-black"><Plus size={14} /></button>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {Array.from(baseAddresses).map(addr => (
                        <div key={addr} className="flex justify-between items-center text-xs bg-gray-100 dark:bg-gray-800 p-2 border border-gray-300 dark:border-gray-700">
                          <span className="truncate w-40 font-mono">{truncate(addr)}</span>
                          <button onClick={() => handleRemoveBaseAddress(addr)} className="text-red-500 hover:text-red-700"><Trash2 size={12} /></button>
                        </div>
                      ))}
                      {baseAddresses.size === 0 && <p className="text-xs text-gray-400 italic">No base addresses set.</p>}
                    </div>
                  </MotionDiv>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex gap-2">
            {session && (
              <>
                <button onClick={handleLoadTableList} className={`flex items-center gap-2 ${bgMain} ${textMain} px-3 py-2 font-bold border-2 ${borderMain} hover:bg-gray-100/10 neo-shadow-hover transition-transform`}><CloudDownload size={16} /> <span className="hidden lg:inline">My Tables</span></button>
                <button
                  onClick={() => setShowSaveModal(true)}
                  disabled={isDbLoaded}
                  className={`flex items-center gap-2 ${bgMain} ${textMain} px-3 py-2 font-bold border-2 ${borderMain} hover:bg-gray-100/10 neo-shadow-hover transition-transform disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Cloud size={16} /> <span className="hidden lg:inline">Save</span>
                </button>
              </>
            )}
            <button onClick={() => setShowImportWizard(true)} className={`flex items-center gap-2 ${bgMain} ${textMain} px-3 py-2 font-bold border-2 ${borderMain} hover:bg-gray-100/10 neo-shadow-hover transition-transform`}><Upload size={16} /> <span className="hidden lg:inline">Smart Import</span></button>
            <button onClick={() => setShowFetchModal(true)} className={`flex items-center gap-2 ${bgMain} ${textMain} px-3 py-2 font-bold border-2 ${borderMain} hover:bg-gray-100/10 neo-shadow-hover transition-transform`}><Download size={16} /> Fetch Data</button>
          </div>
        </div>

        <div className={`flex items-center justify-between ${bgSub} border-2 ${borderMain} p-2`}>
          <div className="flex items-center gap-4 px-2">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500">
              <MoreHorizontal size={14} />
              <span>Total Records:</span>
              <span className={`px-2 py-0.5 rounded ${theme === 'light' ? 'bg-black text-white' : 'bg-white text-black'}`}>{sortedData.length}</span>
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-600">
                <CheckSquare size={14} />
                <span>Selected: {selectedIds.size}</span>
              </div>
            )}
            {baseAddresses.size > 0 && (
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-500">
                <Target size={14} />
                <span>Targets: {baseAddresses.size}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyToClipboard}
              className={`flex items-center gap-2 px-3 py-1 text-xs font-bold border-2 ${borderMain} transition-all
                        ${copyFeedback ? 'bg-green-400 text-black' : `${bgMain} ${textMain} hover:bg-gray-200/20`}
                    `}
            >
              {copyFeedback ? <ClipboardCheck size={14} /> : <Copy size={14} />}
              {copyFeedback ? 'Copied!' : selectedIds.size > 0 ? 'Copy Selected' : 'Copy All'}
            </button>
            <button
              onClick={handleAddRow}
              className={`flex items-center gap-2 bg-blue-600 text-white px-3 py-1 text-xs font-bold border-2 ${borderMain} transition-all hover:bg-blue-700`}
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>
      </div>

      <div className={`flex-1 overflow-hidden border-2 ${borderMain} ${theme === 'light' ? 'bg-gray-50' : 'bg-[#111]'} relative shadow-inner`}>
        {viewMode === 'formatted' ? (
          <div className="h-full overflow-auto custom-scrollbar">
            <table className={`w-full border-collapse text-left ${bgMain}`}>
              <thead className="sticky top-0 z-10 shadow-md">
                <tr>
                  <th className={`p-4 border-b-4 ${borderMain} ${theme === 'light' ? 'bg-gray-900 text-white' : 'bg-black text-white'} w-10`}>
                    <div onClick={handleSelectAll} className="cursor-pointer hover:text-blue-400 transition-colors">
                      {selectedIds.size > 0 && selectedIds.size === sortedData.length ? <CheckSquare size={16} /> : <Square size={16} />}
                    </div>
                  </th>
                  <SortHeader label="Transaction Hash" field="hash" />
                  <SortHeader label="Method" field="method" />
                  <SortHeader label="Block" field="block" />
                  <SortHeader label="Time" field="timestamp" />
                  <SortHeader label="From" field="from" />
                  <SortHeader label="To" field="to" />
                  <SortHeader label="Amount" field="value" className="text-right" />
                  {activeType === 'native' ? (
                    <SortHeader label="Txn Fee" field="fee" className="text-right" />
                  ) : (
                    <SortHeader label="Token" field="token" />
                  )}
                  <th className={`p-4 font-mono text-xs uppercase tracking-wider border-b-4 ${borderMain} ${theme === 'light' ? 'bg-gray-900 text-white' : 'bg-black text-white'} text-center`}>Action</th>
                </tr>
              </thead>
              <tbody className={`font-mono text-sm ${textMain}`}>
                <AnimatePresence mode="popLayout">
                  {sortedData.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-12 text-center text-gray-400 font-bold uppercase">
                        <div className="flex flex-col items-center gap-2">
                          {searchQuery ? <Search size={48} className="opacity-20" /> : <TableIcon size={48} className="opacity-20" />}
                          <span>{searchQuery ? `No matches for "${searchQuery}"` : `No Data Available`}</span>
                          <div className="mt-4">
                            <button onClick={() => setShowFetchModal(true)} className="text-blue-600 underline hover:text-blue-800">Fetch Chain Data</button>
                            <span className="mx-2 text-gray-300">|</span>
                            <button onClick={() => setShowImportWizard(true)} className="text-blue-600 underline hover:text-blue-800">Import CSV</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedData.map((row) => (
                      <MotionTr
                        key={row.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                        className={`border-b ${theme === 'light' ? 'border-gray-200 hover:bg-gray-50' : 'border-gray-800 hover:bg-gray-900'} transition-all duration-200
                              ${editingId === row.id
                            ? 'bg-yellow-50/10 ring-4 ring-inset ring-blue-600 z-20 relative shadow-2xl scale-[1.005]'
                            : selectedIds.has(row.id) ? (theme === 'light' ? 'bg-blue-50' : 'bg-blue-900/20') : ''
                          }`}
                      >
                        <td className="p-4 w-10 text-center">
                          <div onClick={() => handleSelectRow(row.id)} className={`cursor-pointer ${selectedIds.has(row.id) ? 'text-blue-600' : 'text-gray-300 hover:text-gray-500'}`}>
                            {selectedIds.has(row.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                          </div>
                        </td>

                        {editingId === row.id && tempRow ? (
                          <>
                            <td className="p-2 relative">
                              <div className="absolute top-0 left-0 bg-blue-600 text-white text-[9px] px-1.5 py-0.5 font-black uppercase tracking-wider z-30 shadow-sm">EDITING</div>
                              <input type="text" value={tempRow.hash} onChange={(e) => handleChange('hash', e.target.value)} className={editInputClass} />
                            </td>
                            <td className="p-2"><input type="text" value={tempRow.method} onChange={(e) => handleChange('method', e.target.value)} className={editInputClass} /></td>
                            <td className="p-2"><input type="text" value={tempRow.block} onChange={(e) => handleChange('block', e.target.value)} className={editInputClass} /></td>
                            <td className="p-2 text-gray-400 text-xs italic font-bold">Auto-Calc</td>
                            <td className="p-2"><input type="text" value={tempRow.from} onChange={(e) => handleChange('from', e.target.value)} className={editInputClass} /></td>
                            <td className="p-2"><input type="text" value={tempRow.to} onChange={(e) => handleChange('to', e.target.value)} className={editInputClass} /></td>
                            <td className="p-2"><input type="text" value={tempRow.value} onChange={(e) => handleChange('value', e.target.value)} className={`${editInputClass} text-right`} /></td>
                            {activeType === 'native' ? (
                              <td className="p-2"><input type="text" value={tempRow.fee} onChange={(e) => handleChange('fee', e.target.value)} className={`${editInputClass} text-right`} /></td>
                            ) : (
                              <td className="p-2"><input type="text" value={tempRow.token} onChange={(e) => handleChange('token', e.target.value)} className={editInputClass} /></td>
                            )}
                            <td className="p-2 flex justify-center gap-2 items-center">
                              <button onClick={handleSave} className="text-white bg-green-600 p-2.5 rounded-lg shadow-lg hover:bg-green-500 hover:scale-110 transition-all border-2 border-green-700" title="Save Changes"><Save size={18} /></button>
                              <button onClick={handleCancelEdit} className="text-white bg-red-500 p-2.5 rounded-lg shadow-lg hover:bg-red-400 hover:scale-110 transition-all border-2 border-red-600" title="Cancel"><X size={18} /></button>
                            </td>
                          </>
                        ) : (
                          <>

                            <td className="p-4 text-xs font-medium">
                              <InteractiveCell value={row.hash} label="Hash" theme={theme} />
                            </td>
                            <td className="p-4"><span className={`${theme === 'light' ? 'bg-gray-100 text-gray-600 border-gray-300' : 'bg-gray-800 text-gray-300 border-gray-700'} border px-2 py-1 rounded text-xs font-bold`}>{row.method}</span></td>
                            <td className="p-4 text-xs text-blue-500 hover:underline cursor-pointer">{row.block}</td>
                            <td className="p-4 text-gray-500 text-xs" title={new Date(row.timestamp).toLocaleString()}>{new Date(row.timestamp).toLocaleString()}</td>

                            <td className="p-4 relative">
                              <div className="flex items-center gap-2">
                                <InteractiveCell value={row.from} label="From" theme={theme} />
                                {baseAddresses.has(row.from.toLowerCase()) && <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>}
                              </div>
                            </td>
                            <td className="p-4 relative">
                              <div className="flex items-center gap-2">
                                <InteractiveCell value={row.to} label="To" theme={theme} />
                                {baseAddresses.has(row.to.toLowerCase()) && <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>}
                              </div>
                            </td>

                            <td className="p-4 text-right">
                              <span className={`font-mono font-black ${theme === 'light' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : 'text-emerald-400 bg-emerald-900/20 border-emerald-900'} px-2 py-1 rounded border`}>
                                {row.value.toLocaleString(undefined, { maximumFractionDigits: 4 })} {activeType === 'native' ? 'ETH/TRX' : ''}
                              </span>
                            </td>

                            {activeType === 'native' ? (
                              <td className="p-4 text-right text-xs text-gray-500 tabular-nums">{row.fee?.toFixed(5)}</td>
                            ) : (
                              <td className="p-4"><span className="text-xs font-bold text-purple-500">{row.token}</span></td>
                            )}
                            <td className="p-4 flex justify-center gap-3 opacity-40 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleStartEdit(row)} className="text-blue-500 hover:scale-110 transition-transform"><Edit2 size={16} /></button>
                              <button onClick={() => handleDelete(row.id, row.tableId, row.type)} className="text-red-500 hover:scale-110 transition-transform"><Trash2 size={16} /></button>
                            </td>
                          </>
                        )}
                      </MotionTr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-full w-full">
            <textarea className="w-full h-full p-4 font-mono text-sm resize-none bg-gray-900 text-green-400 focus:outline-none" value={JSON.stringify(sortedData, null, 2)} readOnly />
          </div>
        )}
      </div>

      {mounted && createPortal(
        <AnimatePresence>
          {showFetchModal && (
            <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center">
              <MotionDiv initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, y: 20 }} className={`${bgMain} border-4 ${borderMain} p-6 w-[500px] neo-shadow-lg relative max-h-[90vh] flex flex-col ${textMain}`}>
                <button onClick={() => setShowFetchModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X size={20} /></button>

                <div className="flex items-center gap-3 mb-6 shrink-0">
                  <div className={`${theme === 'light' ? 'bg-black text-white' : 'bg-white text-black'} p-2`}><Network size={24} /></div>
                  <h3 className="text-xl font-black uppercase">Fetch On-Chain Data</h3>
                </div>

                {fetchError && (
                  <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 mb-4 text-sm font-bold flex items-center gap-2 shrink-0">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    {fetchError}
                  </div>
                )}

                <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-gray-500">Blockchain Network</label>
                    <div className="relative">
                      <select
                        value={fetchChainId}
                        onChange={(e) => setFetchChainId(e.target.value)}
                        className={`w-full border-2 ${borderMain} p-3 font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}
                      >
                        {SUPPORTED_CHAINS.map(chain => (
                          <option key={chain.id} value={chain.id}>{chain.name} ({chain.currency})</option>
                        ))}
                      </select>
                      <Network className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" size={16} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 pl-1">Supports Ethereum, Tron, L2s (Arbitrum, Optimism, Base...), and Testnets.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-gray-500">Wallet Address(es) (Batch Support)</label>
                    <div className="relative shadow-sm">
                      <textarea
                        placeholder={fetchChainId === 'TRON' ? "Enter Tron addresses (one per line)...\nT...\nT..." : "Enter EVM addresses (one per line)...\n0x...\n0x..."}
                        value={fetchAddress}
                        onChange={(e) => setFetchAddress(e.target.value)}
                        className="w-full bg-black text-white border-2 border-gray-700 p-4 font-mono text-sm focus:outline-none focus:border-blue-600 transition-colors placeholder:text-gray-600 shadow-inner h-32 resize-none custom-scrollbar"
                      />
                    </div>
                    <p className="text-[10px] text-blue-500 font-bold mt-1 pl-1 flex items-center gap-1"><Target size={10} /> Note: These addresses will be automatically marked as Base/Target nodes.</p>
                  </div>

                  <div className={`border-t-2 ${theme === 'light' ? 'border-gray-100' : 'border-gray-800'} pt-4 mt-2`}>
                    <div className="flex items-center justify-between mb-3">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <div
                          className={`w-5 h-5 border-2 ${borderMain} flex items-center justify-center transition-colors ${useDateFilter ? (theme === 'light' ? 'bg-black' : 'bg-white') : ''}`}
                          onClick={() => setUseDateFilter(!useDateFilter)}
                        >
                          {useDateFilter && <div className={`w-2 h-2 ${theme === 'light' ? 'bg-white' : 'bg-black'}`}></div>}
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Filter By Date (Last 15 Days Default)</span>
                      </label>
                      <CalendarClock className="text-gray-400" size={16} />
                    </div>

                    <AnimatePresence>
                      {useDateFilter && (
                        <MotionDiv initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-3 pl-1">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">From</label>
                              <div className="relative">
                                <input
                                  type="date"
                                  value={fetchStartDate}
                                  onChange={(e) => setFetchStartDate(e.target.value)}
                                  className="w-full bg-black text-white border-2 border-gray-700 p-3 text-sm font-bold focus:outline-none focus:border-blue-600 [&::-webkit-calendar-picker-indicator]:invert cursor-pointer shadow-inner"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">To</label>
                              <div className="relative">
                                <input
                                  type="date"
                                  value={fetchEndDate}
                                  onChange={(e) => setFetchEndDate(e.target.value)}
                                  className="w-full bg-black text-white border-2 border-gray-700 p-3 text-sm font-bold focus:outline-none focus:border-blue-600 [&::-webkit-calendar-picker-indicator]:invert cursor-pointer shadow-inner"
                                />
                              </div>
                            </div>
                          </div>
                        </MotionDiv>
                      )}
                    </AnimatePresence>
                    {!useDateFilter && <p className="text-[10px] text-orange-500 font-bold mt-1 pl-1">Warning: Fetching without date limits will retrieve the latest 1000 records.</p>}
                  </div>

                  <div className="bg-blue-50 border border-blue-200 p-3 rounded text-xs text-blue-800 font-medium">
                    <p className="font-bold mb-1">Query Info:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Fetches up to 1000 latest native transactions.</li>
                      <li>Fetches up to 1000 latest ERC20/TRC20 token transfers.</li>
                      <li>Automatically normalizes decimals and timestamps.</li>
                    </ul>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-8 shrink-0">
                  <button onClick={() => setShowFetchModal(false)} className={`px-6 py-3 font-bold hover:bg-gray-100/10 border-2 border-transparent transition-colors ${textMain}`}>Cancel</button>
                  <button
                    onClick={handleFetch}
                    disabled={isFetching || !fetchAddress}
                    className={`px-8 py-3 bg-blue-600 text-white font-bold border-2 ${borderMain} neo-shadow-hover transition-all flex items-center gap-2
                                ${isFetching || !fetchAddress ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-500'}
                            `}
                  >
                    {isFetching && <Loader2 className="animate-spin" size={18} />}
                    {isFetching ? 'Fetching...' : 'Fetch All Data'}
                  </button>
                </div>
              </MotionDiv>
            </MotionDiv>
          )}
        </AnimatePresence>, document.body)}

      {mounted && createPortal(
        <AnimatePresence>
          {showSaveModal && (
            <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6">
              <MotionDiv initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className={`w-full max-w-md ${bgMain} border-4 ${borderMain} neo-shadow-lg p-6 relative ${textMain}`}>
                <button onClick={() => setShowSaveModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X size={20} /></button>
                <h2 className="text-xl font-black uppercase mb-4 flex items-center gap-2">
                  <Cloud size={24} className="text-blue-600" />
                  Save User Table
                </h2>
                <p className="text-sm font-mono text-gray-500 mb-4">Save your current <strong>{activeType === 'native' ? 'Transaction' : 'Token'}</strong> data to your cloud account.</p>

                <div className="mb-6">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-gray-500">Table Name</label>
                  <input
                    value={saveTableName}
                    onChange={(e) => setSaveTableName(e.target.value)}
                    placeholder="My Analysis 2024..."
                    className={`w-full ${inputBg} p-3 border-2 ${borderMain} font-bold focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  />
                </div>

                <button
                  onClick={handleSaveTable}
                  disabled={isSaving || !saveTableName.trim()}
                  className={`w-full py-3 bg-blue-600 text-white font-bold uppercase tracking-widest border-2 ${borderMain} neo-shadow-hover transition-all flex items-center justify-center gap-2 ${isSaving ? 'opacity-50' : ''}`}
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {isSaving ? 'Saving...' : 'Save Table'}
                </button>
              </MotionDiv>
            </MotionDiv>
          )}

          {showLoadModal && (
            <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6">
              <MotionDiv initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className={`w-full max-w-2xl ${bgMain} border-4 ${borderMain} neo-shadow-lg p-6 relative ${textMain} max-h-[80vh] flex flex-col`}>
                <button onClick={() => setShowLoadModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-black"><X size={20} /></button>
                <h2 className="text-xl font-black uppercase mb-4 flex items-center gap-2 shrink-0">
                  <CloudDownload size={24} className="text-blue-600" />
                  My Tables
                </h2>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                  {isLoadingTables ? (
                    <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
                  ) : userTables.length === 0 ? (
                    <div className="text-center p-12 text-gray-500 font-mono">No saved tables found.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {userTables.map(table => (
                        <div key={table.id} className={`p-4 border-2 ${borderMain} hover:bg-gray-100/50 transition-colors cursor-pointer group relative`} onClick={() => handleImportTable(table.id)}>
                          <div className="flex justify-between items-start mb-2">
                            {editingTableId === table.id ? (
                              <div className="flex-1 flex gap-2" onClick={e => e.stopPropagation()}>
                                <input
                                  autoFocus
                                  value={newTableName}
                                  onChange={e => setNewTableName(e.target.value)}
                                  className={`flex-1 ${inputBg} border-2 border-blue-500 p-1 text-sm font-bold focus:outline-none`}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleRenameTable(e as any, table.id);
                                    if (e.key === 'Escape') handleCancelRenameTable(e as any);
                                  }}
                                />
                                <button onClick={e => handleRenameTable(e, table.id)} disabled={isRenaming} className="text-green-600 hover:scale-110 transition-transform"><Save size={16} /></button>
                                <button onClick={handleCancelRenameTable} className="text-red-500 hover:scale-110 transition-transform"><X size={16} /></button>
                              </div>
                            ) : (
                              <h3 className="font-bold text-lg truncate pr-16">{table.name}</h3>
                            )}
                            <span className={`text-[10px] font-black px-1.5 py-0.5 border border-current rounded uppercase shrink-0 ${table.type === 'TRANSACTION' ? 'text-blue-600 border-blue-200 bg-blue-50' : 'text-purple-600 border-purple-200 bg-purple-50'}`}>
                              {table.type === 'TRANSACTION' ? 'Native' : 'ERC20'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 font-mono mb-2">
                            {new Date(table.createdAt).toLocaleDateString()}
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex gap-3 text-xs font-bold text-gray-400 group-hover:text-black transition-colors">
                              <span>{table._count.transactions + table._count.tokenTransfers} Rows</span>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={e => handleStartRenameTable(e, table)}
                                className="p-1 hover:bg-blue-100 text-blue-600 border border-transparent hover:border-blue-200 transition-all"
                                title="Rename Table"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={e => handleDeleteTable(e, table.id)}
                                className="p-1 hover:bg-red-100 text-red-600 border border-transparent hover:border-red-200 transition-all"
                                title="Delete Table"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                    </div>
                  )}
                </div>
              </MotionDiv>
            </MotionDiv>
          )}
        </AnimatePresence>, document.body)}

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
        onConfirm={executeDelete}
        title={deleteConfirm.mode === 'table' ? 'Delete Table' : 'Delete Row'}
        description={deleteConfirm.mode === 'table'
          ? 'Are you sure you want to delete this table? This will permanently remove all associated data and cannot be undone.'
          : 'Are you sure you want to delete this row? This action cannot be undone.'}
      />
    </div>
  );
};

export default DataEditor;