import React from 'react';
import type { Entry, Member, Settings } from '../types';
import { formatCurrency } from '../utils';

type UtilitiesProps = {
    entries: Entry[];
    members: Member[];
    settings: Settings;
};

const Utilities: React.FC<UtilitiesProps> = ({ entries, members, settings }) => {
    const copyData = async () => {
        try {
            await navigator.clipboard.writeText(JSON.stringify({ entries, members }, null, 2));
            alert('Copied entries and members to clipboard.');
        } catch (error) {
            console.error('Unable to copy to clipboard', error);
            alert('Clipboard copy failed.');
        }
    };

    const averagePerMember = members.length > 0 ? entries.reduce((acc, entry) => acc + entry.amount, 0) / members.length : 0;

    return (
        <div className="space-y-6">
            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-indigo-50 to-purple-100/70 p-6">
                <h2 className="text-2xl font-bold text-slate-800">Quick Utilities</h2>
                <p className="text-slate-500">Shortcuts for admins to triage data and share quick exports.</p>
                <div className="flex flex-wrap gap-3 mt-4">
                    <button onClick={copyData} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg">Copy Data Snapshot</button>
                </div>
            </section>

            <section className="rounded-3xl shadow-lg border border-white/60 bg-gradient-to-br from-white via-slate-50 to-slate-100/70 p-6">
                <h3 className="text-xl font-semibold text-slate-800 mb-4">Stats</h3>
                <ul className="space-y-2 text-slate-600">
                    <li>Total entries: <strong>{entries.length}</strong></li>
                    <li>Total members: <strong>{members.length}</strong></li>
                    <li>Average gift per member: <strong>{formatCurrency(averagePerMember, settings.currency)}</strong></li>
                </ul>
            </section>
        </div>
    );
};

export default Utilities;
