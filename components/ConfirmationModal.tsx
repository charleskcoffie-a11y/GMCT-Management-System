import React from 'react';

type ConfirmationModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmTone?: 'danger' | 'primary';
};

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    confirmTone = 'danger',
}) => {
    if (!isOpen) return null;

    const confirmClasses = confirmTone === 'primary'
        ? 'bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg'
        : 'bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-lg';

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="w-full max-w-lg rounded-3xl shadow-2xl border border-white/60 bg-gradient-to-br from-white via-rose-50 to-pink-100/80">
                <header className="border-b border-white/60 bg-white/60 backdrop-blur p-6 rounded-t-3xl">
                    <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
                </header>
                <div className="p-6 space-y-4">
                    <p className="text-slate-600">{message}</p>
                    <div className="flex justify-end gap-3">
                        <button onClick={onClose} className="bg-white/80 border border-pink-200 text-pink-700 font-semibold px-4 py-2 rounded-lg hover:bg-white">{cancelLabel}</button>
                        <button onClick={onConfirm} className={confirmClasses}>{confirmLabel}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
