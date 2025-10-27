// App.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Members from './components/Members';
import Insights from './components/Insights';
import SettingsTab from './components/Settings';
import Login from './components/Login';
import UsersTab from './components/Users';
import AdminLandingPage from './components/AdminLandingPage';
import Attendance from './components/Attendance';
import AdminAttendanceView from './components/AdminAttendanceView';
import Utilities from './components/Utilities';
import EntryModal from './components/EntryModal';
import WeeklyHistory from './components/WeeklyHistory';
import ConfirmationModal from './components/ConfirmationModal';

import { useLocalStorage } from './hooks/useLocalStorage';
import { toCsv, sanitizeEntry, sanitizeMember, sanitizeUser, sanitizeSettings, sanitizeAttendanceStatus, formatCurrency, sanitizeWeeklyHistoryRecord } from './utils';
import type { Entry, Member, Settings, User, Tab, CloudState, AttendanceRecord, EntryType, WeeklyHistoryRecord } from './types';
import { msalSilentSignIn } from './services/oneDrive';
import { DEFAULT_CURRENCY, DEFAULT_MAX_CLASSES } from './constants';

// Initial Data
const INITIAL_USERS: User[] = [
    { username: 'Admin', password: 'GMCT', role: 'admin' },
    { username: 'FinanceUser', password: 'password', role: 'finance' },
    { username: 'ClassLeader1', password: 'password', role: 'class-leader', classLed: '1' },
    { username: 'Statistician', password: 'Stats', role: 'statistician' },
];
const INITIAL_SETTINGS: Settings = { currency: DEFAULT_CURRENCY, maxClasses: DEFAULT_MAX_CLASSES, enforceDirectory: true };

// Define the keys we can sort the financial records table by
type SortKey = 'date' | 'memberName' | 'type' | 'amount' | 'classNumber';

const App: React.FC = () => {
    // --- State Management ---
    const [entries, setEntries] = useLocalStorage<Entry[]>('gmct-entries', [], (data) => Array.isArray(data) ? data.map(sanitizeEntry) : []);
    const [members, setMembers] = useLocalStorage<Member[]>('gmct-members', [], (data) => Array.isArray(data) ? data.map(sanitizeMember) : []);
    const [users, setUsers] = useLocalStorage<User[]>('gmct-users', INITIAL_USERS, (data) => Array.isArray(data) && data.length > 0 ? data.map(sanitizeUser) : INITIAL_USERS);
    const [settings, setSettings] = useLocalStorage<Settings>('gmct-settings', INITIAL_SETTINGS, sanitizeSettings);
    const [attendance, setAttendance] = useLocalStorage<AttendanceRecord[]>('gmct-attendance', [], (data) => Array.isArray(data) ? data : []);
    const [weeklyHistory, setWeeklyHistory] = useLocalStorage<WeeklyHistoryRecord[]>('gmct-weekly-history', [], (data) => Array.isArray(data) ? data.map(sanitizeWeeklyHistoryRecord) : []);
    
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('home');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [entryToDeleteId, setEntryToDeleteId] = useState<string | null>(null);
    
    // -- Sorting & Filtering State for Financial Records --
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    const [searchFilter, setSearchFilter] = useState('');
    const [classFilter, setClassFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState<EntryType | 'all'>('all');
    const [startDateFilter, setStartDateFilter] = useState('');
    const [endDateFilter, setEndDateFilter] = useState('');


    const [cloud, setCloud] = useState<CloudState>({ ready: false, signedIn: false, message: "" });
     useEffect(() => {
        const attemptSilentSignin = async () => {
            const session = await msalSilentSignIn();
            if (session) {
                setCloud({ ready: true, signedIn: true, account: session.account, accessToken: session.accessToken, message: "Signed in silently." });
            } else {
                setCloud({ ready: true, signedIn: false, message: "Ready for manual sign-in." });
            }
        };
        attemptSilentSignin();
    }, []);

    // --- Derived State ---
    const membersMap = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);

    const filteredAndSortedEntries = useMemo(() => {
        // 1. Filter the entries
        const filtered = entries.filter(entry => {
            if (searchFilter && !entry.memberName.toLowerCase().includes(searchFilter.toLowerCase())) return false;
            if (typeFilter !== 'all' && entry.type !== typeFilter) return false;
            if (startDateFilter && entry.date < startDateFilter) return false;
            if (endDateFilter && entry.date > endDateFilter) return false;
            
            const member = membersMap.get(entry.memberID);
            if (classFilter !== 'all' && (!member || member.classNumber !== classFilter)) return false;
            
            return true;
        });

        // 2. Sort the filtered results
        const sortableEntries = [...filtered];
        sortableEntries.sort((a, b) => {
            let aValue: string | number;
            let bValue: string | number;

            if (sortConfig.key === 'classNumber') {
                const memberA = membersMap.get(a.memberID);
                const memberB = membersMap.get(b.memberID);
                aValue = parseInt(memberA?.classNumber || '0', 10) || 0;
                bValue = parseInt(memberB?.classNumber || '0', 10) || 0;
            } else {
                aValue = a[sortConfig.key as keyof Entry];
                bValue = b[sortConfig.key as keyof Entry];
            }
            
            let comparison = 0;
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                comparison = aValue.localeCompare(bValue);
            } else if (aValue < bValue) {
                comparison = -1;
            } else if (aValue > bValue) {
                comparison = 1;
            }

            const result = comparison * (sortConfig.direction === 'asc' ? 1 : -1);

            // Secondary sort by date if primary keys are equal
            if (result === 0 && sortConfig.key !== 'date') {
                return b.date.localeCompare(a.date);
            }

            return result;
        });
        return sortableEntries;
    }, [entries, sortConfig, membersMap, searchFilter, classFilter, typeFilter, startDateFilter, endDateFilter]);

    // --- Handlers ---
    const handleLogin = (username: string, password: string) => {
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
        if (user) {
            setCurrentUser(user);
            setLoginError(null);
            // Navigate to appropriate landing page based on role
            setActiveTab(user.role === 'admin' || user.role === 'finance' ? 'home' : user.role === 'class-leader' ? 'attendance' : user.role === 'statistician' ? 'history' : 'records');
        } else {
            setLoginError('Invalid username or password.');
        }
    };

    const handleLogout = () => setCurrentUser(null);

    const handleSaveEntry = (entry: Entry) => {
        const newEntries = [...entries];
        const index = newEntries.findIndex(e => e.id === entry.id);
        if (index > -1) {
            newEntries[index] = entry;
        } else {
            newEntries.push(entry);
        }
        setEntries(newEntries);
        setIsModalOpen(false);
    };

    const handleSaveAndNew = (entry: Entry) => {
        const newEntries = [...entries];
        // "Save and new" should only apply to new entries, so we just push.
        newEntries.push(entry);
        setEntries(newEntries);
        // Do not close the modal, allowing for the next entry.
    };
    
    const handleDeleteEntry = (id: string) => {
        setEntryToDeleteId(id);
        setIsConfirmModalOpen(true);
    };

    const confirmDeleteEntry = () => {
        if (entryToDeleteId) {
            setEntries(entries.filter(e => e.id !== entryToDeleteId));
            setIsModalOpen(false); // Close the entry modal as well
        }
        setIsConfirmModalOpen(false);
        setEntryToDeleteId(null);
    };

    const handleImport = (newEntries: Entry[]) => {
        setEntries(prev => [...prev, ...newEntries]);
    };
    
    const handleExport = (format: 'csv' | 'json') => {
        const filename = `gmct-export-${new Date().toISOString().slice(0, 10)}`;
        if (format === 'csv') {
            const csv = toCsv(entries);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${filename}.csv`;
            link.click();
        } else {
             const json = JSON.stringify(entries, null, 2);
             const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
             const link = document.createElement('a');
             link.href = URL.createObjectURL(blob);
             link.download = `${filename}.json`;
             link.click();
        }
    };
    
    const handleFullExport = () => {
        const data = { entries, members, users, settings, attendance };
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `gmct-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
    };

    const handleFullImport = (file: File) => {
        if (!window.confirm("This will overwrite all current data. Are you sure you want to continue?")) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);
                if (data.entries) setEntries(data.entries);
                if (data.members) setMembers(data.members);
                if (data.users) setUsers(data.users);
                if (data.settings) setSettings(data.settings);
                if (data.attendance) setAttendance(data.attendance);
                alert("Data imported successfully!");
            } catch (error) {
                alert("Failed to read or parse the backup file.");
                console.error("Import error:", error);
            }
        };
        reader.readAsText(file);
    };

    const handleSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        // if sorting by the same key, toggle the direction
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        } else if (sortConfig.key !== key && key === 'date') {
            // if switching to date column, default to descending
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };
    
    // --- UI Rendering ---

    if (!currentUser) {
        return <Login onLogin={handleLogin} error={loginError} />;
    }

    const renderTabContent = () => {
        switch (activeTab) {
            case 'home': return currentUser.role === 'admin' || currentUser.role === 'finance' ? <AdminLandingPage onNavigate={setActiveTab} currentUser={currentUser} /> : <Dashboard entries={filteredAndSortedEntries} settings={settings} />;
            case 'records':
                return (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-slate-800">Financial Records</h2>
                            <button onClick={() => { setSelectedEntry(null); setIsModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg">Add New Entry</button>
                        </div>

                        {/* Filter Controls */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                            <div className="lg:col-span-1">
                                <label htmlFor="searchFilter" className="block text-sm font-medium text-slate-700">Search Member</label>
                                <input type="text" id="searchFilter" placeholder="Name..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm"/>
                            </div>
                            <div className="lg:col-span-1">
                                <label htmlFor="classFilter" className="block text-sm font-medium text-slate-700">Class</label>
                                <select id="classFilter" value={classFilter} onChange={e => setClassFilter(e.target.value)} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm">
                                    <option value="all">All Classes</option>
                                    {Array.from({ length: settings.maxClasses }, (_, i) => String(i + 1)).map(num => (<option key={num} value={num}>Class {num}</option>))}
                                </select>
                            </div>
                            <div className="lg:col-span-1">
                                <label htmlFor="typeFilter" className="block text-sm font-medium text-slate-700">Type</label>
                                <select id="typeFilter" value={typeFilter} onChange={e => setTypeFilter(e.target.value as EntryType | 'all')} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm">
                                    <option value="all">All Types</option>
                                    {(["tithe", "offering", "first-fruit", "pledge", "harvest-levy", "other"] as EntryType[]).map(t => <option key={t} value={t}>{t.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                                </select>
                            </div>
                            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="startDateFilter" className="block text-sm font-medium text-slate-700">Start Date</label>
                                    <input type="date" id="startDateFilter" value={startDateFilter} onChange={e => setStartDateFilter(e.target.value)} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm"/>
                                </div>
                                <div>
                                    <label htmlFor="endDateFilter" className="block text-sm font-medium text-slate-700">End Date</label>
                                    <input type="date" id="endDateFilter" value={endDateFilter} onChange={e => setEndDateFilter(e.target.value)} className="mt-1 block w-full border-slate-300 rounded-md shadow-sm"/>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-x-auto max-h-[65vh] overflow-y-auto">
                           <table className="w-full text-left text-slate-500">
                                <thead className="text-base text-slate-700 uppercase bg-slate-100 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-3"><button onClick={() => handleSort('date')} className="flex items-center gap-1 font-bold">Date {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</button></th>
                                        <th className="px-6 py-3"><button onClick={() => handleSort('memberName')} className="flex items-center gap-1 font-bold">Member {sortConfig.key === 'memberName' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</button></th>
                                        <th className="px-6 py-3 font-bold">Member ID</th>
                                        <th className="px-6 py-3"><button onClick={() => handleSort('classNumber')} className="flex items-center gap-1 font-bold">Class # {sortConfig.key === 'classNumber' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</button></th>
                                        <th className="px-6 py-3"><button onClick={() => handleSort('type')} className="flex items-center gap-1 font-bold">Type {sortConfig.key === 'type' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</button></th>
                                        <th className="px-6 py-3"><button onClick={() => handleSort('amount')} className="flex items-center gap-1 font-bold">Amount {sortConfig.key === 'amount' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</button></th>
                                        <th className="px-6 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAndSortedEntries.map(entry => {
                                        const member = membersMap.get(entry.memberID);
                                        return (
                                            <tr key={entry.id} className="bg-white border-b hover:bg-slate-50">
                                                <td className="px-6 py-4">{entry.date}</td>
                                                <td className="px-6 py-4 font-medium text-slate-900">{entry.memberName}</td>
                                                <td className="px-6 py-4 font-mono text-sm text-slate-600">{entry.memberID?.substring(0, 8) || 'N/A'}</td>
                                                <td className="px-6 py-4 text-center">{member?.classNumber || 'N/A'}</td>
                                                <td className="px-6 py-4 capitalize">{entry.type}</td>
                                                <td className="px-6 py-4">{formatCurrency(entry.amount, settings.currency)}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => { setSelectedEntry(entry); setIsModalOpen(true); }} className="font-medium text-indigo-600 hover:underline">Edit</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                           </table>
                        </div>
                    </div>
                );
            case 'members': return <Members members={members} setMembers={setMembers} settings={settings} />;
            case 'insights': return <Insights entries={filteredAndSortedEntries} settings={settings} />;
            case 'history': return <WeeklyHistory history={weeklyHistory} setHistory={setWeeklyHistory} />;
            case 'users': return <UsersTab users={users} setUsers={setUsers} />;
            case 'settings': return <SettingsTab settings={settings} setSettings={setSettings} cloud={cloud} setCloud={setCloud} onExport={handleFullExport} onImport={handleFullImport} />;
            case 'attendance': return <Attendance members={members} attendance={attendance} setAttendance={setAttendance} currentUser={currentUser} settings={settings} />;
            case 'admin-attendance': return <AdminAttendanceView members={members} attendance={attendance} settings={settings} currentUser={currentUser} />;
            case 'utilities': return <Utilities entries={filteredAndSortedEntries} members={members} settings={settings} />;
            default: return <div>Select a tab</div>;
        }
    };

    const navItems = [
        { id: 'home', label: 'Home', roles: ['admin', 'finance'] },
        { id: 'records', label: 'Financial Records', roles: ['admin', 'finance'] },
        { id: 'members', label: 'Member Directory', roles: ['admin', 'finance', 'class-leader', 'statistician'] },
        { id: 'insights', label: 'Insights', roles: ['admin', 'finance'] },
        { id: 'attendance', label: 'Mark Attendance', roles: ['admin', 'class-leader'] },
        { id: 'admin-attendance', label: 'Attendance Report', roles: ['admin', 'finance'] },
        { id: 'history', label: 'Weekly History', roles: ['admin', 'statistician'] },
        { id: 'users', label: 'Manage Users', roles: ['admin', 'finance'] },
        { id: 'utilities', label: 'Utilities', roles: ['admin'] },
        { id: 'settings', label: 'Settings', roles: ['admin'] },
    ].filter(item => item.roles.includes(currentUser.role));


    return (
        <div className="bg-slate-50 min-h-screen">
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                <Header entries={entries} onImport={handleImport} onExport={handleExport} currentUser={currentUser} onLogout={handleLogout} />
                <main className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <aside className="lg:col-span-1">
                        <nav className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 space-y-1">
                             {navItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id as Tab)}
                                    className={`w-full text-left font-bold px-4 py-3 rounded-lg transition-colors text-base uppercase tracking-wide ${
                                        activeTab === item.id
                                            ? 'bg-indigo-600 text-white shadow'
                                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                                    }`}
                                >
                                    {item.label}
                                </button>
                             ))}
                        </nav>
                    </aside>
                    <section className="lg:col-span-3">
                       {renderTabContent()}
                    </section>
                </main>
                {isModalOpen && <EntryModal entry={selectedEntry} members={members} settings={settings} onSave={handleSaveEntry} onSaveAndNew={handleSaveAndNew} onClose={() => setIsModalOpen(false)} onDelete={handleDeleteEntry} />}
                <ConfirmationModal
                    isOpen={isConfirmModalOpen}
                    onClose={() => {
                        setIsConfirmModalOpen(false);
                        setEntryToDeleteId(null);
                    }}
                    onConfirm={confirmDeleteEntry}
                    title="Confirm Deletion"
                    message="Are you sure you want to delete this financial entry? This action cannot be undone."
                />
            </div>
        </div>
    );
};

export default App;