export interface User {
  email: string;
  password: string;
  isAdmin: boolean;
}

export interface SpeakerData {
  id: string; // Unique identifier for each speaker entry
  createdBy: string; // Email of the user who created this entry
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  businessEmail: string;
  country: string;
  website: string;
  fullName: string;
  isEmailValid: boolean;
  isLinkedInValid: boolean;
  isWebsiteValid: boolean;
  extractedRole: string;
  isCeo: boolean;
  isSpeaker: boolean;
  isAuthor: boolean;
  industry: string;
  personLinkedinUrl: string;
  stage: string;
  phoneNumber: string;
  employees: string;
  location: string;
  city: string;
  state: string;
  companyAddress: string;
  companyCity: string;
  companyState: string;
  companyCountry: string;
  companyPhone: string;
  secondaryEmail: string;
  speakingTopic: string;
  speakingLink: string;
}

export type SpeakerDataStore = SpeakerData[];

export type UsersStore = User[];
