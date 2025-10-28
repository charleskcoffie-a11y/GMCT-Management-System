import React from 'react';

type ConfirmationModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
};

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
 codex/restore-missing-imports-for-app.tsx
            <div className="w-full max-w-lg rounded-3xl shadow-2xl border border-white/60 bg-gradient-to-br from-white via-rose-50 to-pink-100/80">
                <header className="border-b border-white/60 bg-white/60 backdrop-blur p-6 rounded-t-3xl">

            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                <header className="border-b border-slate-200 p-6">
 main
                    <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
                </header>
                <div className="p-6 space-y-4">
                    <p className="text-slate-600">{message}</p>
                    <div className="flex justify-end gap-3">
 codex/restore-missing-imports-for-app.tsx
                        <button onClick={onClose} className="bg-white/80 border border-pink-200 text-pink-700 font-semibold px-4 py-2 rounded-lg hover:bg-white">Cancel</button>

                        <button onClick={onClose} className="bg-white border border-slate-300 text-slate-700 font-semibold px-4 py-2 rounded-lg hover:bg-slate-100">Cancel</button>
 main
                        <button onClick={onConfirm} className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-lg">Confirm</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
