import React from 'react';
import type { Tab, User } from '../types';

type AdminLandingPageProps = {
    onNavigate: React.Dispatch<React.SetStateAction<Tab>>;
    currentUser: User;
};

const quickLinks: { label: string; tab: Tab; description: string }[] = [
    { label: 'Financial Records', tab: 'records', description: 'Add or review income entries.' },
    { label: 'Member Directory', tab: 'members', description: 'Manage the full member list.' },
    { label: 'Mark Attendance', tab: 'attendance', description: 'Capture weekly attendance.' },
    { label: 'Weekly History', tab: 'history', description: 'Submit society weekly reports.' },
];

const AdminLandingPage: React.FC<AdminLandingPageProps> = ({ onNavigate, currentUser }) => {
    return (
        <div className="space-y-6">
 codex/restore-missing-imports-for-app.tsx
            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-purple-50 to-fuchsia-100/70 p-6">

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6">
 main
                <h2 className="text-2xl font-bold text-slate-800">Welcome, {currentUser.username}</h2>
                <p className="text-slate-600">Use the shortcuts below to move between the most common tasks.</p>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quickLinks.map(link => (
                    <button
                        key={link.tab}
                        onClick={() => onNavigate(link.tab)}
 codex/restore-missing-imports-for-app.tsx
                        className="rounded-3xl p-6 text-left shadow-md border border-white/60 bg-gradient-to-br from-white via-indigo-50 to-sky-100/70 hover:shadow-lg hover:scale-[1.01] transition-transform"

                        className="bg-white border border-slate-200 rounded-2xl p-6 text-left hover:border-indigo-400 hover:shadow-sm transition"
 main
                    >
                        <h3 className="text-xl font-semibold text-slate-800">{link.label}</h3>
                        <p className="text-sm text-slate-500 mt-2">{link.description}</p>
                    </button>
                ))}
            </section>
        </div>
    );
};

export default AdminLandingPage;
