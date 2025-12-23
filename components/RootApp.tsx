"use client"

import React, { useState, useEffect } from 'react';
import { Tab, Transaction, TxType } from '../types';
import { MOCK_DATA } from '../lib/constants';
import DataEditor from './DataEditor';
import BubbleViz from './BubbleViz';
import AnalysisPanel from './AnalysisPanel';
import { LayoutGrid, Activity, BrainCircuit, Database, Sun, Moon, LogIn, UserPlus, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSession, signIn, signOut } from 'next-auth/react';

const RootApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DATA);
  const [activeType, setActiveType] = useState<TxType>('native');
  const [data, setData] = useState<Transaction[]>(MOCK_DATA);
  
  // Base/Target Addresses State (Nodes marked as '0')
  const [baseAddresses, setBaseAddresses] = useState<Set<string>>(new Set());
  
  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const { data: session, status } = useSession();

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Background Styles
  const bgClass = theme === 'light' ? 'bg-[#f8f8f8]' : 'bg-[#0a0a0a]';
  const textClass = theme === 'light' ? 'text-black' : 'text-gray-100';
  const borderClass = theme === 'light' ? 'border-black' : 'border-white/20';

  const handleAddData = (newTxns: Transaction[]) => {
      setData(prev => [...newTxns, ...prev]);
  };

  return (
    <div className={`min-h-screen flex flex-col overflow-hidden font-sans transition-colors duration-300 ${theme === 'light' ? 'bg-white text-black' : 'bg-black text-white'}`}>
      
      {/* Header / Nav */}
      <header className={`border-b-4 ${borderClass} ${theme === 'light' ? 'bg-white' : 'bg-[#111]'} p-4 flex justify-between items-center z-50 relative`}>
        <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${theme === 'light' ? 'bg-blue-600 border-black' : 'bg-blue-500 border-white'} border-2 flex items-center justify-center neo-shadow-sm transform hover:rotate-12 transition-transform`}>
                <Activity className="text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter italic">CHAIN<span className="text-blue-500">SCOPE</span>_V2</h1>
        </div>

        <nav className={`flex ${theme === 'light' ? 'bg-gray-100' : 'bg-[#222]'} p-1 border-2 ${borderClass} gap-2`}>
            {[
                { id: Tab.DATA, icon: Database, label: 'SOURCE' },
                { id: Tab.VISUALIZE, icon: LayoutGrid, label: 'VISUALIZE' },
                { id: Tab.ANALYSIS, icon: BrainCircuit, label: 'INTELLIGENCE' },
            ].map((item) => (
                <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`
                        flex items-center gap-2 px-4 py-2 font-bold text-sm transition-all border-2 border-transparent
                        ${activeTab === item.id 
                            ? `${theme === 'light' ? 'bg-white border-black text-black' : 'bg-black border-white text-white'} neo-shadow-sm transform -translate-y-1` 
                            : 'text-gray-500 hover:text-gray-400 hover:bg-gray-200/10'}
                    `}
                >
                    <item.icon size={16} />
                    {item.label}
                </button>
            ))}
        </nav>

        <div className="flex gap-4 items-center">
             {/* Theme Toggle */}
            <button onClick={toggleTheme} className={`p-2 border-2 ${borderClass} hover:bg-gray-200/20 transition-colors`}>
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            {/* Auth Buttons */}
            {status === 'loading' ? (
                <div className="text-sm">Loading...</div>
            ) : session ? (
                <div className="flex gap-2 items-center border-l pl-4 border-gray-700">
                    <span className="text-sm">Welcome, {session.user?.name || session.user?.email}</span>
                    <button 
                        onClick={() => signOut()} 
                        className={`flex items-center gap-2 px-3 py-1 text-sm border-2 ${borderClass} hover:bg-gray-200/20 transition-colors`}
                    >
                        <LogOut size={16} />
                        Logout
                    </button>
                </div>
            ) : (
                <div className="flex gap-2 items-center border-l pl-4 border-gray-700">
                    <button 
                        onClick={() => window.location.href = '/auth/signin'} 
                        className={`flex items-center gap-2 px-3 py-1 text-sm border-2 ${borderClass} hover:bg-gray-200/20 transition-colors`}
                    >
                        <LogIn size={16} />
                        Login
                    </button>
                    <button 
                        onClick={() => window.location.href = '/auth/register'} 
                        className={`flex items-center gap-2 px-3 py-1 text-sm border-2 ${borderClass} hover:bg-gray-200/20 transition-colors`}
                    >
                        <UserPlus size={16} />
                        Register
                    </button>
                </div>
            )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`flex-1 relative p-6 ${bgClass} overflow-hidden`}>
        {/* Decorative Background Elements */}
        <div className={`absolute top-10 left-10 w-64 h-64 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob ${theme === 'light' ? 'bg-pink-200' : 'bg-pink-900 mix-blend-screen'}`}></div>
        <div className={`absolute top-10 right-10 w-64 h-64 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 ${theme === 'light' ? 'bg-yellow-200' : 'bg-yellow-900 mix-blend-screen'}`}></div>
        <div className={`absolute bottom-10 left-20 w-64 h-64 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000 ${theme === 'light' ? 'bg-blue-200' : 'bg-blue-900 mix-blend-screen'}`}></div>

        <div className="relative z-10 h-full">
            {activeTab === Tab.DATA && (
                <motion.div 
                    initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} 
                    className="h-full"
                >
                    <DataEditor 
                        data={data} 
                        setData={setData} 
                        activeType={activeType}
                        setActiveType={setActiveType}
                        theme={theme}
                        baseAddresses={baseAddresses}
                        setBaseAddresses={setBaseAddresses}
                    />
                </motion.div>
            )}
            
            {activeTab === Tab.VISUALIZE && (
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} 
                    className="h-full"
                >
                    <BubbleViz 
                        data={data} 
                        activeType={activeType}
                        setActiveType={setActiveType}
                        onAddData={handleAddData}
                        theme={theme}
                        baseAddresses={baseAddresses}
                    />
                </motion.div>
            )}

            {activeTab === Tab.ANALYSIS && (
                <motion.div 
                    initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} 
                    className="h-full"
                >
                    <AnalysisPanel 
                        data={data} 
                        activeType={activeType}
                        theme={theme}
                    />
                </motion.div>
            )}
        </div>
      </main>
      
      <style>{`
        @keyframes blob {
            0% { transform: translate(0px, 0px) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
            100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
            animation: blob 7s infinite;
        }
        .animation-delay-2000 {
            animation-delay: 2s;
        }
        .animation-delay-4000 {
            animation-delay: 4s;
        }
        .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: ${theme === 'light' ? '#f1f1f1' : '#333'}; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: ${theme === 'light' ? '#000' : '#888'}; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: ${theme === 'light' ? '#333' : '#aaa'}; 
        }
      `}</style>
    </div>
  );
};

export default RootApp;
