import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  widthClass?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, widthClass = 'max-w-2xl' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-75" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={onClose}>
            <div className="absolute inset-0 bg-slate-900 opacity-75"></div>
        </div>

        {/* This element is to trick the browser into centering the modal contents. */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        
        <div className={`inline-block w-full ${widthClass} p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-slate-800 shadow-xl rounded-2xl border border-slate-700`}>
            <div className="flex items-start justify-between pb-4 border-b border-slate-600">
                <h3 className="text-lg font-medium leading-6 text-white" id="modal-title">
                  {title}
                </h3>
                <button
                    onClick={onClose}
                    className="text-slate-400 bg-transparent hover:bg-slate-700 hover:text-white rounded-lg text-sm p-1.5 ml-auto inline-flex items-center"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                    <span className="sr-only">Close modal</span>
                </button>
            </div>
            <div className="mt-4">
                {children}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
