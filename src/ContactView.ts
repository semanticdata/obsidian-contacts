import { ItemView, WorkspaceLeaf } from 'obsidian';
import { Contact } from './types';

export const CONTACTS_VIEW_TYPE = 'contacts-view';

function formatDate(dateStr?: string): string | undefined {
    if (!dateStr) return undefined;
    // Try to parse and format as YYYY-MM-DD or YYYY-MM-DDTHH:mm
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr; // fallback if not a valid date
    // If time is not midnight, show time
    if (d.getHours() !== 0 || d.getMinutes() !== 0) {
        // Pad month, day, hours, minutes
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } else {
        // Just show date
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
}

export class ContactView extends ItemView {
    private contacts: Contact[] = [];

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return CONTACTS_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Contacts';
    }

    async onOpen() {
        // Update next_contact for contacts with frequency and last_contacted
        // @ts-ignore: plugin is available via window
        const plugin = (window as any).app.plugins.plugins['obsidian-contacts'];
        if (plugin && plugin.contactManager) {
            let updated = false;
            for (const contact of this.contacts) {
                if (contact.contact_frequency && contact.last_contacted) {
                    const calculatedNext = plugin.calculateNextContact
                        ? plugin.calculateNextContact(contact.last_contacted, contact.contact_frequency)
                        : (window as any).calculateNextContact
                            ? (window as any).calculateNextContact(contact.last_contacted, contact.contact_frequency)
                            : undefined;
                    if (calculatedNext && contact.next_contact !== calculatedNext) {
                        contact.next_contact = calculatedNext;
                        // Save update
                        plugin.contactManager.updateContact(contact, contact.name);
                        updated = true;
                    }
                }
            }
            // If any were updated, reload contacts after save
            if (updated) {
                this.contacts = await plugin.contactManager.getAllContacts();
            }
        }

        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('contacts-view');
        // Header row with flexbox
        const headerRowDiv = container.createEl('div');
        headerRowDiv.style.display = 'flex';
        headerRowDiv.style.alignItems = 'center';
        headerRowDiv.style.justifyContent = 'space-between';
        headerRowDiv.style.marginBottom = '16px';

        const title = headerRowDiv.createEl('h4', { text: 'Contacts' });
        title.style.margin = '0';

        const newContactBtn = headerRowDiv.createEl('button', { text: 'New Contact' });
        newContactBtn.addClass('new-contact-btn');
        newContactBtn.onclick = () => {
            // @ts-ignore: plugin is available via window
            const plugin = (window as any).app.plugins.plugins['obsidian-contacts'];
            if (plugin) {
                new plugin.NewContactModal(plugin.app, plugin).open();
            }
        };

        const table = container.createEl('table');
        const thead = table.createEl('thead');
        const headerRow = thead.createEl('tr');

        // Create table headers
        ['Name', 'Email', 'Phone', 'Last Contacted', 'Next Contact', 'Frequency'].forEach(header => {
            headerRow.createEl('th', { text: header });
        });

        const tbody = table.createEl('tbody');

        // Populate table with contacts
        this.contacts.forEach(contact => {
            const row = tbody.createEl('tr');
            row.createEl('td', { text: contact.name });
            row.createEl('td', { text: contact.email });
            row.createEl('td', { text: contact.phone });
            row.createEl('td', { text: formatDate(contact.last_contacted) || 'Never' });
            row.createEl('td', { text: formatDate(contact.next_contact) || 'Not scheduled' });
            row.createEl('td', { text: contact.contact_frequency || 'Not set' });

            // Add double-click to edit contact
            row.addEventListener('dblclick', () => {
                // @ts-ignore: plugin is available via window
                const plugin = (window as any).app.plugins.plugins['obsidian-contacts'];
                if (plugin) {
                    new plugin.NewContactModal(plugin.app, plugin, contact).open();
                }
            });
        });
    }

    async onClose() {
        this.containerEl.empty();
    }

    setContacts(contacts: Contact[]) {
        this.contacts = contacts;
        this.onOpen();
    }
}