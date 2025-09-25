import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { SpeakerData } from '../types';
import * as api from '../mockApi';
import Modal from './Modal';
import Toast from './Toast';

interface UserPanelProps {
  data: SpeakerData[];
  onAddSpeaker: (speakerData: Omit<SpeakerData, 'id' | 'createdBy'>) => Promise<SpeakerData | null>;
  onUpdateSpeaker: (speakerData: SpeakerData) => Promise<void>;
  onDeleteSpeaker: (speakerId: string) => Promise<void>;
  currentUserEmail: string;
  onDataImported: () => void;
}

// A simple, predictable normalizer: lowercase and remove all whitespace.
const normalizeKey = (key: string): string => {
    if (!key) return '';
    return key.toLowerCase().replace(/\s+/g, '');
};

// Creates an exhaustive mapping from various normalized header names to the correct SpeakerData keys.
const getFieldMap = (): { [key: string]: keyof SpeakerData } => {
    const map: { [key: string]: keyof SpeakerData } = {};

    const aliases: { [alias: string]: keyof SpeakerData } = {
        // Main Aliases
        'firstname': 'firstName', 'lastname': 'lastName', 'title': 'title', 'company': 'company',
        'businessemail': 'businessEmail', 'email': 'businessEmail', 'emailaddress': 'businessEmail',
        'workemail': 'businessEmail', 'country': 'country', 'website': 'website', 'fullname': 'fullName',
        'emailvalid': 'isEmailValid', 'isemailvalid': 'isEmailValid', 'linkedvalid': 'isLinkedInValid',
        'islinkedinvalid': 'isLinkedInValid', 'websitevalid': 'isWebsiteValid', 'iswebsitevalid': 'isWebsiteValid',
        'extractedrole': 'extractedRole', 'isceo': 'isCeo', 'isspeaker': 'isSpeaker', 'isauthor': 'isAuthor',
        'industry': 'industry', 'personlinkedinurl': 'personLinkedinUrl', 'linkedin': 'personLinkedinUrl',
        'linkedinurl': 'personLinkedinUrl', 'stage': 'stage', 'phonenumber': 'phoneNumber', 'phone': 'phoneNumber',
        'employees': 'employees', 'location': 'location', 'city': 'city', 'state': 'state',
        'companyaddress': 'companyAddress', 'companycity': 'companyCity', 'companystate': 'companyState',
        'companycountry': 'companyCountry', 'companyphone': 'companyPhone', 'secondaryemail': 'secondaryEmail',
        'speakingtopic': 'speakingTopic', 'speakinginfotopic': 'speakingTopic', 'speakinglink': 'speakingLink',
        'speakinginfolink': 'speakingLink', 'createdby': 'createdBy', 'id': 'id'
    };
    
    for (const alias in aliases) {
        map[normalizeKey(alias)] = aliases[alias];
    }
    
    return map;
};

// Generate the map once for efficiency
const fieldMap = getFieldMap();


const getInitialFormData = (): Omit<SpeakerData, 'id' | 'createdBy'> => ({
  firstName: '', lastName: '', title: '', company: '', businessEmail: '',
  country: '', website: '', fullName: '', isEmailValid: false,
  isLinkedInValid: false, isWebsiteValid: false, extractedRole: '',
  isCeo: false, isSpeaker: false, isAuthor: false, industry: '',
  personLinkedinUrl: '', stage: '', phoneNumber: '', employees: '',
  location: '', city: '', state: '', companyAddress: '', companyCity: '',
  companyState: '', companyCountry: '', companyPhone: '', secondaryEmail: '',
  speakingTopic: '', speakingLink: ''
});

const UserPanel: React.FC<UserPanelProps> = ({ data, onAddSpeaker, onUpdateSpeaker, onDeleteSpeaker, currentUserEmail, onDataImported }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSpeaker, setEditingSpeaker] = useState<SpeakerData | null>(null);
  const [formData, setFormData] = useState(getInitialFormData());
  const [errors, setErrors] = useState<Partial<Record<keyof SpeakerData, string>>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ country: '', industry: '', company: '' });

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [passwordFormData, setPasswordFormData] = useState({ currentPassword: '', newPassword: '', confirmPassword: ''});
  const [passwordErrors, setPasswordErrors] = useState<Partial<Record<keyof typeof passwordFormData, string>>>({});

  const importFileRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Cleanup worker on component unmount
    return () => {
        workerRef.current?.terminate();
    }
  }, []);

  const mandatoryFields: (keyof SpeakerData)[] = [
    'firstName', 'lastName', 'title', 'company', 'businessEmail',
    'country', 'website', 'speakingTopic', 'speakingLink'
  ];

  const openAddModal = () => {
    setEditingSpeaker(null);
    setFormData(getInitialFormData());
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (speaker: SpeakerData) => {
    setEditingSpeaker(speaker);
    const { id, createdBy, ...editableData } = speaker;
    setFormData(editableData);
    setErrors({});
    setIsModalOpen(true);
  };
  
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSpeaker(null);
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof SpeakerData, string>> = {};
    mandatoryFields.forEach(field => {
      const value = formData[field as keyof typeof formData];
      if (value === undefined || value === null || String(value).trim() === '') {
        newErrors[field] = 'This field is required.';
      }
    });
    if (formData.businessEmail && !/\S+@\S+\.\S+/.test(formData.businessEmail)) {
      newErrors.businessEmail = 'Please enter a valid email address.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
     if (errors[name as keyof SpeakerData]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name as keyof SpeakerData];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const isDuplicate = await api.isBusinessEmailInUse(formData.businessEmail, editingSpeaker?.id);
      if (isDuplicate) {
        setErrors(prev => ({ ...prev, businessEmail: 'This business email is already in use.' }));
        return;
      }
      
      if (editingSpeaker) {
        await onUpdateSpeaker({ ...editingSpeaker, ...formData });
        setToast({ message: 'Speaker updated successfully!', type: 'success' });
      } else {
        await onAddSpeaker(formData);
        setToast({ message: 'Speaker added successfully!', type: 'success' });
      }
      closeModal();
    } catch (error) {
      setToast({ message: 'An error occurred.', type: 'error' });
    }
  };
  
  const handleDelete = async (speakerId: string) => {
    if(window.confirm('Are you sure you want to delete this speaker entry?')) {
        await onDeleteSpeaker(speakerId);
        setToast({ message: 'Speaker deleted.', type: 'success' });
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordFormData(prev => ({ ...prev, [name]: value }));
    if (passwordErrors[name as keyof typeof passwordErrors]) {
        setPasswordErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[name as keyof typeof passwordErrors];
            return newErrors;
        });
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Partial<Record<keyof typeof passwordFormData, string>> = {};
    if (!passwordFormData.currentPassword) newErrors.currentPassword = 'Current password is required.';
    if (!passwordFormData.newPassword) newErrors.newPassword = 'New password is required.';
    if (passwordFormData.newPassword.length < 6) newErrors.newPassword = 'Password must be at least 6 characters.';
    if (passwordFormData.newPassword !== passwordFormData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match.';
    
    setPasswordErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    try {
        await api.changePassword(currentUserEmail, passwordFormData.currentPassword, passwordFormData.newPassword);
        setToast({ message: 'Password changed successfully!', type: 'success' });
        setIsProfileModalOpen(false);
        setPasswordFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        setToast({ message: `Error: ${errorMessage}`, type: 'error' });
    }
  };
  
  const handleImportClick = () => {
    importFileRef.current?.click();
  };
  
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setToast({ message: 'Parsing CSV file in the background...', type: 'success' });
    
    workerRef.current = new Worker(new URL('../workers/csv.worker.ts', import.meta.url), { type: 'module' });
    
    const allData: any[] = [];

    workerRef.current.onmessage = async (e) => {
        const { type, data, count, error } = e.data;

        if (type === 'chunk') {
            allData.push(...data);
        } else if (type === 'complete') {
            setToast({ message: `Parsing complete. Found ${count} records. Now preparing for import...`, type: 'success' });
            
            const remappedData = allData.map(originalRow => {
                const newRow: { [key: string]: any } = {};
                for (const originalHeader in originalRow) {
                    const normalizedHeader = normalizeKey(originalHeader);
                    const finalKey = fieldMap[normalizedHeader];
                    if (finalKey) {
                        newRow[finalKey] = originalRow[originalHeader];
                    }
                }
                return newRow as Partial<SpeakerData>;
            });
            
            const dataToImport: Omit<SpeakerData, 'id'>[] = [];
            
            for (const row of remappedData) {
                if (row.businessEmail && String(row.businessEmail).trim()) {
                    const getBool = (key: keyof SpeakerData) => ['true', '1', 'yes'].includes(String(row[key] ?? '').toLowerCase());
                    dataToImport.push({
                      createdBy: currentUserEmail,
                      firstName: row.firstName || '', lastName: row.lastName || '', title: row.title || '', company: row.company || '',
                      businessEmail: row.businessEmail, country: row.country || '', website: row.website || '',
                      fullName: row.fullName || `${row.firstName || ''} ${row.lastName || ''}`.trim(), extractedRole: row.extractedRole || '',
                      industry: row.industry || '', personLinkedinUrl: row.personLinkedinUrl || '', stage: row.stage || '', phoneNumber: row.phoneNumber || '',
                      employees: row.employees || '', location: row.location || '', city: row.city || '', state: row.state || '',
                      companyAddress: row.companyAddress || '', companyCity: row.companyCity || '', companyState: row.companyState || '',
                      companyCountry: row.companyCountry || '', companyPhone: row.companyPhone || '', secondaryEmail: row.secondaryEmail || '',
                      speakingTopic: row.speakingTopic || '', speakingLink: row.speakingLink || '', isEmailValid: getBool('isEmailValid'),
                      isLinkedInValid: getBool('isLinkedInValid'), isWebsiteValid: getBool('isWebsiteValid'), isCeo: getBool('isCeo'),
                      isSpeaker: getBool('isSpeaker'), isAuthor: getBool('isAuthor'),
                    });
                }
            }
            
            if (dataToImport.length > 0) {
                setToast({ message: `Importing ${dataToImport.length} valid records... This may take a moment.`, type: 'success' });
                try {
                    const result = await api.bulkAddSpeakerData(dataToImport);
                    setToast({ message: `Import complete. Added ${result.importedCount}, skipped ${result.skippedCount} duplicates.`, type: 'success' });
                    onDataImported();
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during import.';
                    setToast({ message: `Import failed: ${errorMessage}`, type: 'error' });
                }
            } else {
                setToast({ message: 'Import failed. No rows with a valid "Business Email" found.', type: 'error' });
            }

            workerRef.current?.terminate();
            if (event.target) event.target.value = '';

        } else if (type === 'error') {
            setToast({ message: `Error parsing CSV: ${error}`, type: 'error' });
            workerRef.current?.terminate();
            if (event.target) event.target.value = '';
        }
    };

    workerRef.current.postMessage(file);
  };

  const filteredData = useMemo(() => {
     return data.filter(s => {
        const searchTermLower = searchTerm.toLowerCase();
        const matchesSearch = searchTerm === '' ||
            (s.fullName && s.fullName.toLowerCase().includes(searchTermLower)) ||
            (s.company && s.company.toLowerCase().includes(searchTermLower)) ||
            (s.businessEmail && s.businessEmail.toLowerCase().includes(searchTermLower)) ||
            (s.industry && s.industry.toLowerCase().includes(searchTermLower)) ||
            (s.country && s.country.toLowerCase().includes(searchTermLower));

        const matchesCountry = filters.country === '' || (s.country && s.country.toLowerCase().includes(filters.country.toLowerCase()));
        const matchesIndustry = filters.industry === '' || (s.industry && s.industry.toLowerCase().includes(filters.industry.toLowerCase()));
        const matchesCompany = filters.company === '' || (s.company && s.company.toLowerCase().includes(filters.company.toLowerCase()));
        
        return matchesSearch && matchesCountry && matchesIndustry && matchesCompany;
    });
  }, [data, searchTerm, filters]);


  const renderTextInput = (id: keyof typeof formData, label: string) => {
    const isRequired = mandatoryFields.includes(id as keyof SpeakerData);
    return (
      <div>
        <label htmlFor={id} className="block mb-2 text-sm font-medium text-slate-300">
          {label} {isRequired && <span className="text-red-500">*</span>}
        </label>
        <input
          type="text"
          id={id}
          name={id}
          value={String(formData[id] ?? '')}
          onChange={handleChange}
          className={`bg-slate-700 border ${errors[id as keyof SpeakerData] ? 'border-red-500' : 'border-slate-600'} text-slate-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5`}
        />
        {errors[id as keyof SpeakerData] && <p className="mt-1 text-xs text-red-400">{errors[id as keyof SpeakerData]}</p>}
      </div>
    );
  };
  
   const renderCheckboxInput = (id: keyof typeof formData, label: string) => (
     <div className="flex items-center">
        <input 
            id={id}
            name={id}
            type="checkbox" 
            checked={Boolean(formData[id])}
            onChange={handleChange}
            className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-600" 
        />
        <label htmlFor={id} className="ml-2 text-sm font-medium text-slate-300">{label}</label>
    </div>
  );

  const renderSectionTitle = (title: string) => (
    <h3 className="text-lg font-semibold text-indigo-400 col-span-1 md:col-span-2 pt-2">{title}</h3>
  );


  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <input
        type="file"
        ref={importFileRef}
        className="hidden"
        accept=".csv"
        onChange={handleFileImport}
      />
       {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-white">My Speaker Entries</h1>
          <p className="mt-2 text-sm text-slate-400">
            A list of all speakers you have added. Total: <span className="font-semibold text-white">{data.length}</span>
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex items-center space-x-2">
           <button onClick={() => setIsProfileModalOpen(true)} type="button" className="inline-flex items-center justify-center rounded-md border border-slate-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-900 sm:w-auto">
                Profile
            </button>
            <button onClick={handleImportClick} type="button" className="inline-flex items-center justify-center rounded-md border border-transparent bg-slate-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900 sm:w-auto">
                Import Data
            </button>
          <button
            onClick={openAddModal}
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 sm:w-auto"
          >
            + Add New Speaker
          </button>
        </div>
      </div>

       <div className="mt-4 p-4 bg-slate-800/50 rounded-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
                 <label htmlFor="search-speaker" className="block text-sm font-medium text-slate-400 mb-1">Search</label>
                 <input
                    type="text" id="search-speaker" placeholder="Search by name, company, etc."
                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
            </div>
             <div>
                 <label htmlFor="filter-country" className="block text-sm font-medium text-slate-400 mb-1">Country</label>
                <input
                    type="text" id="filter-country" placeholder="Filter by country"
                    value={filters.country} onChange={(e) => setFilters(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
            </div>
             <div>
                <label htmlFor="filter-industry" className="block text-sm font-medium text-slate-400 mb-1">Industry</label>
                <input
                    type="text" id="filter-industry" placeholder="Filter by industry"
                    value={filters.industry} onChange={(e) => setFilters(prev => ({ ...prev, industry: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
            </div>
            <div>
                <label htmlFor="filter-company" className="block text-sm font-medium text-slate-400 mb-1">Company</label>
                <input
                    type="text" id="filter-company" placeholder="Filter by company"
                    value={filters.company} onChange={(e) => setFilters(prev => ({ ...prev, company: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
            </div>
        </div>
      </div>

      <div className="mt-4 ring-1 ring-slate-700 rounded-lg">
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-slate-700">
               <thead className="bg-slate-800">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-white sm:pl-6">Name</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">Title</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">Company</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900">
                {filteredData.map((speaker) => (
                  <tr key={speaker.id}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-white sm:pl-6">{speaker.fullName}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-300">{speaker.title}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-300">{speaker.company}</td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 space-x-4">
                      <button onClick={() => openEditModal(speaker)} className="text-indigo-400 hover:text-indigo-300">Edit</button>
                      <button onClick={() => handleDelete(speaker.id)} className="text-red-400 hover:text-red-300">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
       <Modal isOpen={isModalOpen} onClose={closeModal} title={editingSpeaker ? 'Edit Speaker' : 'Add New Speaker'}>
          <form onSubmit={handleSubmit} noValidate>
             <div className="space-y-6 max-h-[70vh] overflow-y-auto p-1 pr-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-700 pb-6">
                  {renderSectionTitle('Personal Information')}
                  {renderTextInput('firstName', 'First Name')}
                  {renderTextInput('lastName', 'Last Name')}
                  {renderTextInput('fullName', 'Full Name')}
                  {renderTextInput('title', 'Title')}
                  {renderTextInput('businessEmail', 'Business Email')}
                  {renderTextInput('secondaryEmail', 'Secondary Email')}
                  {renderTextInput('phoneNumber', 'Phone Number')}
                  {renderTextInput('personLinkedinUrl', 'LinkedIn URL')}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-700 pb-6">
                  {renderSectionTitle('Personal Location')}
                  {renderTextInput('location', 'Location (e.g. San Francisco, CA)')}
                  {renderTextInput('city', 'City')}
                  {renderTextInput('state', 'State / Province')}
                  {renderTextInput('country', 'Country')}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-700 pb-6">
                  {renderSectionTitle('Company Information')}
                  {renderTextInput('company', 'Company')}
                  {renderTextInput('website', 'Website')}
                  {renderTextInput('industry', 'Industry')}
                  {renderTextInput('employees', 'Employees')}
                  {renderTextInput('companyAddress', 'Company Address')}
                  {renderTextInput('companyCity', 'Company City')}
                  {renderTextInput('companyState', 'Company State')}
                  {renderTextInput('companyCountry', 'Company Country')}
                  {renderTextInput('companyPhone', 'Company Phone')}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-700 pb-6">
                  {renderSectionTitle('Speaking Details')}
                  {renderTextInput('speakingTopic', 'Speaking Topic')}
                  {renderTextInput('speakingLink', 'Speaking Info Link')}
                  {renderTextInput('stage', 'Stage')}
                  {renderTextInput('extractedRole', 'Extracted Role')}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderSectionTitle('Flags & Validation')}
                  <div className="flex flex-col space-y-2">
                    {renderCheckboxInput('isCeo', 'Is CEO?')}
                    {renderCheckboxInput('isSpeaker', 'Is Speaker?')}
                    {renderCheckboxInput('isAuthor', 'Is Author?')}
                  </div>
                  <div className="flex flex-col space-y-2">
                    {renderCheckboxInput('isEmailValid', 'Email Valid?')}
                    {renderCheckboxInput('isLinkedInValid', 'LinkedIn Valid?')}
                    {renderCheckboxInput('isWebsiteValid', 'Website Valid?')}
                  </div>
                </div>

              </div>
            <div className="mt-6 flex justify-end space-x-3 border-t border-slate-600 pt-4">
              <button type="button" onClick={closeModal} className="px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-700">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">{editingSpeaker ? 'Save Changes' : 'Add Speaker'}</button>
            </div>
          </form>
       </Modal>

       <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} title="My Profile">
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-300">Email Address</label>
                <p className="mt-1 text-slate-400">{currentUserEmail}</p>
            </div>
            <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-300">Current Password</label>
                <input type="password" name="currentPassword" id="currentPassword" value={passwordFormData.currentPassword} onChange={handlePasswordChange} required className={`mt-1 block w-full bg-slate-700 border ${passwordErrors.currentPassword ? 'border-red-500' : 'border-slate-600'} rounded-md py-2 px-3 text-white shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}/>
                {passwordErrors.currentPassword && <p className="mt-1 text-xs text-red-400">{passwordErrors.currentPassword}</p>}
            </div>
            <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-slate-300">New Password</label>
                <input type="password" name="newPassword" id="newPassword" value={passwordFormData.newPassword} onChange={handlePasswordChange} required className={`mt-1 block w-full bg-slate-700 border ${passwordErrors.newPassword ? 'border-red-500' : 'border-slate-600'} rounded-md py-2 px-3 text-white shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}/>
                {passwordErrors.newPassword && <p className="mt-1 text-xs text-red-400">{passwordErrors.newPassword}</p>}
            </div>
            <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300">Confirm New Password</label>
                <input type="password" name="confirmPassword" id="confirmPassword" value={passwordFormData.confirmPassword} onChange={handlePasswordChange} required className={`mt-1 block w-full bg-slate-700 border ${passwordErrors.confirmPassword ? 'border-red-500' : 'border-slate-600'} rounded-md py-2 px-3 text-white shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}/>
                {passwordErrors.confirmPassword && <p className="mt-1 text-xs text-red-400">{passwordErrors.confirmPassword}</p>}
            </div>
             <div className="pt-4 flex justify-end space-x-3">
              <button type="button" onClick={() => setIsProfileModalOpen(false)} className="px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-700">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">Update Password</button>
            </div>
        </form>
       </Modal>

    </div>
  );
};

export default UserPanel;
