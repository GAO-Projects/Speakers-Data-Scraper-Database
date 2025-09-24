import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { SpeakerData, User } from '../types';
import * as api from '../mockApi';
import Modal from './Modal';
import Toast from './Toast';

// A simple, predictable normalizer: lowercase and remove all whitespace.
const normalizeKey = (key: string): string => {
    if (!key) return '';
    return key.toLowerCase().replace(/\s+/g, '');
};

// Creates an exhaustive mapping from various normalized header names to the correct SpeakerData keys.
// This is more robust and explicit than a generic "remove all special chars" approach.
const getFieldMap = (): { [key: string]: keyof SpeakerData } => {
    const map: { [key: string]: keyof SpeakerData } = {};

    const aliases: { [alias: string]: keyof SpeakerData } = {
        // Main Aliases
        'firstname': 'firstName',
        'lastname': 'lastName',
        'title': 'title',
        'company': 'company',
        'businessemail': 'businessEmail',
        'email': 'businessEmail',
        'emailaddress': 'businessEmail',
        'workemail': 'businessEmail',
        'country': 'country',
        'website': 'website',
        'fullname': 'fullName',
        'emailvalid': 'isEmailValid',
        'isemailvalid': 'isEmailValid',
        'linkedvalid': 'isLinkedInValid',
        'islinkedinvalid': 'isLinkedInValid',
        'websitevalid': 'isWebsiteValid',
        'iswebsitevalid': 'isWebsiteValid',
        'extractedrole': 'extractedRole',
        'isceo': 'isCeo',
        'isspeaker': 'isSpeaker',
        'isauthor': 'isAuthor',
        'industry': 'industry',
        'personlinkedinurl': 'personLinkedinUrl',
        'linkedin': 'personLinkedinUrl',
        'linkedinurl': 'personLinkedinUrl',
        'stage': 'stage',
        'phonenumber': 'phoneNumber',
        'phone': 'phoneNumber',
        'employees': 'employees',
        'location': 'location',
        'city': 'city',
        'state': 'state',
        'companyaddress': 'companyAddress',
        'companycity': 'companyCity',
        'companystate': 'companyState',
        'companycountry': 'companyCountry',
        'companyphone': 'companyPhone',
        'secondaryemail': 'secondaryEmail',
        'speakingtopic': 'speakingTopic',
        'speakinginfotopic': 'speakingTopic',
        'speakinglink': 'speakingLink',
        'speakinginfolink': 'speakingLink',
        'createdby': 'createdBy',
        'id': 'id'
    };
    
    // Normalize all alias keys before adding them to the map
    for (const alias in aliases) {
        map[normalizeKey(alias)] = aliases[alias];
    }
    
    return map;
};

// Generate the map once for efficiency
const fieldMap = getFieldMap();


const AdminPanel: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [speakerData, setSpeakerData] = useState<SpeakerData[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  const [isLoadingSpeakers, setIsLoadingSpeakers] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  
  const [error, setError] = useState<string | null>(null);
  
  const [selectedSpeaker, setSelectedSpeaker] = useState<SpeakerData | null>(null);
  const [isSpeakerModalOpen, setIsSpeakerModalOpen] = useState(false);
  
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState({ email: '', password: ''});

  const [isDeleteUserModalOpen, setIsDeleteUserModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const [newInternCredentials, setNewInternCredentials] = useState<{email: string, password: string} | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'speakers' | 'users'>('speakers');
  
  const importFileRef = useRef<HTMLInputElement>(null);

  const [speakerSearchTerm, setSpeakerSearchTerm] = useState('');
  const [speakerFilters, setSpeakerFilters] = useState({ country: '', industry: '', company: '' });

  const fetchSpeakers = useCallback(async () => {
    setIsLoadingSpeakers(true);
    setError(null);
    try {
      const allData = await api.getAllSpeakerData();
      setSpeakerData(allData);
    } catch (e) {
      setError('Failed to fetch speaker data.');
    } finally {
      setIsLoadingSpeakers(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const allUsers = await api.getAllUsers();
      setUsers(allUsers);
    } catch (e) {
      setError('Failed to fetch users.');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    // Fetch both sets of data on mount, as speaker data is needed for user counts.
    fetchSpeakers();
    fetchUsers();
  }, [fetchSpeakers, fetchUsers]);

  const speakerCountsByUser = useMemo(() => {
    const counts = new Map<string, number>();
    speakerData.forEach(speaker => {
      const count = counts.get(speaker.createdBy) || 0;
      counts.set(speaker.createdBy, count + 1);
    });
    return counts;
  }, [speakerData]);

  const handleViewDetails = (speaker: SpeakerData) => {
    setSelectedSpeaker(speaker);
    setIsSpeakerModalOpen(true);
  };
  
  const handleOpenAddUserModal = () => {
    setEditingUser(null);
    setUserFormData({ email: '', password: '' });
    setIsUserModalOpen(true);
  };

  const handleOpenEditUserModal = (user: User) => {
    setEditingUser(user);
    setUserFormData({ email: user.email, password: '' }); // Don't show password
    setIsUserModalOpen(true);
  };

  const handleUserFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) { // Update
        await api.updateUser(editingUser.email, { ...editingUser, email: userFormData.email, password: userFormData.password });
        setToast({ message: 'User updated successfully!', type: 'success' });
      } else { // Add
        // Password is now generated by the backend. We pass an empty string.
        const newUserWithPassword = await api.addUser(userFormData.email, '', false);
        setToast({ message: 'Intern added successfully!', type: 'success' });
        setNewInternCredentials(newUserWithPassword); // Show credentials in new modal
      }
      fetchUsers();
      setIsUserModalOpen(false);
    } catch(err) {
      setToast({ message: (err as Error).message, type: 'error' });
    }
  };

  const confirmDeleteUser = (user: User) => {
    setUserToDelete(user);
    setIsDeleteUserModalOpen(true);
  };
  
  const handleDeleteUser = async () => {
    if (userToDelete) {
      try {
        await api.deleteUser(userToDelete.email);
        setToast({ message: 'User deleted successfully.', type: 'success' });
        fetchUsers();
      } catch (err) {
        setToast({ message: 'Failed to delete user.', type: 'error' });
      } finally {
        setIsDeleteUserModalOpen(false);
        setUserToDelete(null);
      }
    }
  };

  const handleExport = async () => {
    setToast({ message: 'Preparing export...', type: 'success' });
    const allSpeakers = await api.getAllSpeakerData();

    if (allSpeakers.length === 0) {
        setToast({ message: 'No speaker data to export.', type: 'error' });
        return;
    }

    const csv = (window as any).Papa.unparse(allSpeakers);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'speaker_data_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setToast({ message: `Exported ${allSpeakers.length} records.`, type: 'success' });
  };
  
  const handleImportClick = () => {
    importFileRef.current?.click();
  };
  
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    (window as any).Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results: { data: { [key: string]: any }[] }) => {
            if (!results.data || results.data.length === 0) {
                setToast({ message: 'Import failed. The CSV file appears to be empty or has no data.', type: 'error' });
                if (event.target) event.target.value = '';
                return;
            }

            // Remap the data from the CSV to our SpeakerData format using the robust fieldMap
            const remappedData = results.data.map(originalRow => {
                const newRow: { [key: string]: any } = {};
                for (const originalHeader in originalRow) {
                    const normalizedHeader = normalizeKey(originalHeader);
                    const finalKey = fieldMap[normalizedHeader]; // Look up the correct camelCase key
                    if (finalKey) {
                        newRow[finalKey] = originalRow[originalHeader];
                    }
                }
                return newRow as Partial<SpeakerData>;
            });

            const dataToImport: Omit<SpeakerData, 'id'>[] = [];
            
            for (const row of remappedData) {
                const businessEmail = row.businessEmail;
                
                if (businessEmail && String(businessEmail).trim()) {
                    const getBool = (key: keyof SpeakerData) => {
                        const val = String(row[key] ?? '').toLowerCase();
                        return ['true', '1', 'yes'].includes(val);
                    };

                    dataToImport.push({
                      createdBy: (row.createdBy || currentUser.email) as string,
                      firstName: row.firstName || '',
                      lastName: row.lastName || '',
                      title: row.title || '',
                      company: row.company || '',
                      businessEmail: businessEmail,
                      country: row.country || '',
                      website: row.website || '',
                      fullName: row.fullName || `${row.firstName || ''} ${row.lastName || ''}`.trim(),
                      extractedRole: row.extractedRole || '',
                      industry: row.industry || '',
                      personLinkedinUrl: row.personLinkedinUrl || '',
                      stage: row.stage || '',
                      phoneNumber: row.phoneNumber || '',
                      employees: row.employees || '',
                      location: row.location || '',
                      city: row.city || '',
                      state: row.state || '',
                      companyAddress: row.companyAddress || '',
                      companyCity: row.companyCity || '',
                      companyState: row.companyState || '',
                      companyCountry: row.companyCountry || '',
                      companyPhone: row.companyPhone || '',
                      secondaryEmail: row.secondaryEmail || '',
                      speakingTopic: row.speakingTopic || '',
                      speakingLink: row.speakingLink || '',
                      isEmailValid: getBool('isEmailValid'),
                      isLinkedInValid: getBool('isLinkedInValid'),
                      isWebsiteValid: getBool('isWebsiteValid'),
                      isCeo: getBool('isCeo'),
                      isSpeaker: getBool('isSpeaker'),
                      isAuthor: getBool('isAuthor'),
                    });
                }
            }
            
            if (dataToImport.length > 0) {
                setToast({ message: `Importing ${dataToImport.length} valid records...`, type: 'success' });
                try {
                    const result = await api.bulkAddSpeakerData(dataToImport);
                    setToast({ message: `Import complete. Added ${result.importedCount} new speakers, skipped ${result.skippedCount} duplicates.`, type: 'success' });
                    fetchSpeakers();
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during import.';
                    setToast({ message: `Import failed: ${errorMessage}`, type: 'error' });
                }
            } else {
                const foundHeaders = results.data.length > 0 ? Object.keys(results.data[0]) : [];
                setToast({ 
                    message: `Import failed. No rows with a valid "Business Email" could be found. Please check your CSV file to ensure the email column is present, correctly named (e.g., "Business Email", "Email"), and contains data. Headers found: ${foundHeaders.slice(0, 5).join(', ')}`,
                    type: 'error' 
                });
            }

            if (event.target) event.target.value = '';
        },
        error: (error: Error) => {
            setToast({ message: `Error parsing CSV: ${error.message}`, type: 'error' });
            if (event.target) event.target.value = '';
        },
    });
  };

  const handleExportUsers = () => {
    if (users.length === 0) {
      setToast({ message: 'No user data to export.', type: 'error' });
      return;
    }

    const interns = users
      .filter(u => !u.isAdmin)
      .map(u => ({ email: u.email, role: 'Intern' }));

    if (interns.length === 0) {
      setToast({ message: 'No interns to export.', type: 'error' });
      return;
    }

    const csv = (window as any).Papa.unparse(interns);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'intern_users_export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast({ message: `Exported ${interns.length} intern records.`, type: 'success' });
  };

  const filteredSpeakers = useMemo(() => {
    return speakerData.filter(s => {
        const searchTermLower = speakerSearchTerm.toLowerCase();
        const matchesSearch = speakerSearchTerm === '' ||
            (s.fullName && s.fullName.toLowerCase().includes(searchTermLower)) ||
            (s.company && s.company.toLowerCase().includes(searchTermLower)) ||
            (s.businessEmail && s.businessEmail.toLowerCase().includes(searchTermLower)) ||
            (s.industry && s.industry.toLowerCase().includes(searchTermLower)) ||
            (s.country && s.country.toLowerCase().includes(searchTermLower));

        const matchesCountry = speakerFilters.country === '' || (s.country && s.country.toLowerCase().includes(speakerFilters.country.toLowerCase()));
        const matchesIndustry = speakerFilters.industry === '' || (s.industry && s.industry.toLowerCase().includes(speakerFilters.industry.toLowerCase()));
        const matchesCompany = speakerFilters.company === '' || (s.company && s.company.toLowerCase().includes(speakerFilters.company.toLowerCase()));
        
        return matchesSearch && matchesCountry && matchesIndustry && matchesCompany;
    });
  }, [speakerData, speakerSearchTerm, speakerFilters]);

  const renderSpeakersTab = () => (
    <>
      <div className="mt-4 p-4 bg-slate-800/50 rounded-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
                 <label htmlFor="search-speaker" className="block text-sm font-medium text-slate-400 mb-1">Search</label>
                 <input
                    type="text"
                    id="search-speaker"
                    placeholder="Search by name, company, etc."
                    value={speakerSearchTerm}
                    onChange={(e) => setSpeakerSearchTerm(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
            </div>
             <div>
                 <label htmlFor="filter-country" className="block text-sm font-medium text-slate-400 mb-1">Country</label>
                <input
                    type="text"
                    id="filter-country"
                    placeholder="Filter by country"
                    value={speakerFilters.country}
                    onChange={(e) => setSpeakerFilters(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
            </div>
             <div>
                <label htmlFor="filter-industry" className="block text-sm font-medium text-slate-400 mb-1">Industry</label>
                <input
                    type="text"
                    id="filter-industry"
                    placeholder="Filter by industry"
                    value={speakerFilters.industry}
                    onChange={(e) => setSpeakerFilters(prev => ({ ...prev, industry: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
            </div>
            <div>
                <label htmlFor="filter-company" className="block text-sm font-medium text-slate-400 mb-1">Company</label>
                <input
                    type="text"
                    id="filter-company"
                    placeholder="Filter by company"
                    value={speakerFilters.company}
                    onChange={(e) => setSpeakerFilters(prev => ({ ...prev, company: e.target.value }))}
                    className="w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
            </div>
        </div>
      </div>
      <div className="mt-4 ring-1 ring-slate-700 rounded-lg">
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            {isLoadingSpeakers ? <p className="p-4">Loading speakers...</p> : (
              <table className="min-w-full divide-y divide-slate-700">
                <thead className="bg-slate-800">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-white sm:pl-6">Name</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">Company</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">Email</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">Created By</th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900">
                  {filteredSpeakers.map((speaker) => (
                    <tr key={speaker.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-white sm:pl-6">{speaker.fullName}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-300">{speaker.company}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-300">{speaker.businessEmail}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-300">{speaker.createdBy}</td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <button onClick={() => handleViewDetails(speaker)} className="text-indigo-400 hover:text-indigo-300">
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );

  const renderUsersTab = () => (
     <div className="mt-8 ring-1 ring-slate-700 rounded-lg">
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full align-middle">
           {isLoadingUsers ? <p className="p-4">Loading users...</p> : (
             <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-800">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-white sm:pl-6">Email</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">Role</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">Entries Created</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900">
                 {users.filter(u => !u.isAdmin).map((user) => (
                  <tr key={user.email}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-white sm:pl-6">{user.email}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-300">Intern</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-300">{speakerCountsByUser.get(user.email) || 0}</td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 space-x-4">
                      <button onClick={() => handleOpenEditUserModal(user)} className="text-indigo-400 hover:text-indigo-300">Edit</button>
                      <button onClick={() => confirmDeleteUser(user)} className="text-red-400 hover:text-red-300">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
           )}
        </div>
      </div>
    </div>
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
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="mt-2 text-sm text-slate-400">
            Manage speaker data and intern accounts.
          </p>
          <div className="mt-4 flex items-center gap-x-3">
            <h2 className="text-base font-medium text-white">Total Speaker Entries:</h2>
            <span className="inline-flex items-center rounded-full bg-indigo-500/80 px-3 py-1 text-sm font-semibold text-white shadow-md">
                {isLoadingSpeakers ? '...' : speakerData.length}
            </span>
          </div>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          {activeTab === 'speakers' && (
            <div className="flex items-center space-x-2">
              <button onClick={handleImportClick} type="button" className="inline-flex items-center justify-center rounded-md border border-transparent bg-slate-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900 sm:w-auto">
                Import from CSV
              </button>
              <button onClick={handleExport} type="button" className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 sm:w-auto">
                Export All to CSV
              </button>
            </div>
          )}
          {activeTab === 'users' && (
            <div className="flex items-center space-x-2">
              <button onClick={handleExportUsers} type="button" className="inline-flex items-center justify-center rounded-md border border-transparent bg-slate-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900 sm:w-auto">
                Export Interns
              </button>
              <button onClick={handleOpenAddUserModal} type="button" className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 sm:w-auto">
                Add Intern
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <div className="border-b border-slate-700">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button onClick={() => setActiveTab('speakers')} className={`${activeTab === 'speakers' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-500'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
              Speaker Database
            </button>
            <button onClick={() => setActiveTab('users')} className={`${activeTab === 'users' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-500'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
              Intern Management
            </button>
          </nav>
        </div>
      </div>
      
      {error && <div className="p-8 text-center text-red-400">{error}</div>}
      
      {activeTab === 'speakers' ? renderSpeakersTab() : renderUsersTab()}

      {selectedSpeaker && (
        <Modal isOpen={isSpeakerModalOpen} onClose={() => setIsSpeakerModalOpen(false)} title={`Details for ${selectedSpeaker.fullName}`}>
          <div className="text-sm text-slate-300 space-y-2 max-h-[60vh] overflow-y-auto pr-2">
            {Object.entries(selectedSpeaker).map(([key, value]) => (
                <div key={key} className="grid grid-cols-2 gap-2 border-b border-slate-700 py-1">
                    <strong className="capitalize text-slate-400">{key.replace(/([A-Z])/g, ' $1').trim()}:</strong>
                    <span>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</span>
                </div>
            ))}
          </div>
        </Modal>
      )}

      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title={editingUser ? 'Edit Intern' : 'Add New Intern'}>
         <form onSubmit={handleUserFormSubmit} className="space-y-4">
            <div>
              <label htmlFor="user-email" className="block text-sm font-medium text-slate-300">Email Address</label>
              <input type="email" id="user-email" value={userFormData.email} onChange={e => setUserFormData({...userFormData, email: e.target.value})} required className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
            </div>
            {editingUser && (
              <div>
                <label htmlFor="user-password" className="block text-sm font-medium text-slate-300">Password</label>
                <input type="password" id="user-password" value={userFormData.password} onChange={e => setUserFormData({...userFormData, password: e.target.value})} placeholder='Leave blank to keep current password' className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md py-2 px-3 text-white shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"/>
              </div>
            )}
            <div className="pt-4 flex justify-end space-x-3">
              <button type="button" onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-700">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">{editingUser ? 'Update User' : 'Add User'}</button>
            </div>
         </form>
      </Modal>

      {newInternCredentials && (
        <Modal isOpen={!!newInternCredentials} onClose={() => setNewInternCredentials(null)} title="Intern Account Created">
          <div className="space-y-4 text-slate-300">
            <p>The account for <span className="font-bold text-white">{newInternCredentials.email}</span> has been successfully created.</p>
            <p>Please provide the following temporary password to the user. They will be required to change it upon first login.</p>
            <div className="bg-slate-900 p-3 rounded-lg flex items-center justify-between">
                <span className="font-mono text-lg text-indigo-300">{newInternCredentials.password}</span>
                <button 
                    onClick={() => {
                        navigator.clipboard.writeText(newInternCredentials.password);
                        setToast({ message: 'Password copied!', type: 'success' });
                    }}
                    className="px-3 py-1 bg-slate-700 text-white font-semibold rounded-lg shadow-md hover:bg-slate-600 text-sm"
                >
                    Copy
                </button>
            </div>
          </div>
           <div className="pt-4 flex justify-end">
             <button type="button" onClick={() => setNewInternCredentials(null)} className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">Close</button>
           </div>
        </Modal>
      )}

      {userToDelete && (
        <Modal isOpen={isDeleteUserModalOpen} onClose={() => setIsDeleteUserModalOpen(false)} title="Confirm Deletion">
          <p className="text-slate-300">Are you sure you want to delete the user: {userToDelete.email}? This action cannot be undone.</p>
          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={() => setIsDeleteUserModalOpen(false)} className="px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-700">Cancel</button>
            <button type="button" onClick={handleDeleteUser} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700">Delete User</button>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default AdminPanel;