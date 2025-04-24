export interface Contact {
    name: string;
    email?: string;
    phone: string;
    company?: string;
    title?: string;
    notes?: string;
    tags?: string[];
    created: string;
    modified: string;
    last_contacted?: string;
    next_contact?: string;
    contact_frequency?: string;
}

export interface ContactsPluginSettings {
    contactsFolder: string;
    defaultView: 'table' | 'grid';
    showInRibbon: boolean;
}

export const DEFAULT_SETTINGS: ContactsPluginSettings = {
    contactsFolder: 'Contacts',
    defaultView: 'table',
    showInRibbon: true
};