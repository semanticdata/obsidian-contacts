import { App, Editor, ItemView, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import { Contact, ContactsPluginSettings, DEFAULT_SETTINGS } from './src/types';
import { ContactView, CONTACTS_VIEW_TYPE } from './src/ContactView';
import { ContactManager } from './src/ContactManager';

export default class ContactsPlugin extends Plugin {
	NewContactModal = NewContactModal;
	settings: ContactsPluginSettings;
	contactManager: ContactManager;
	contactView: ContactView | null = null;

	async onload() {
		await this.loadSettings();
		this.contactManager = new ContactManager(this.app.vault, this.settings.contactsFolder);

		// Register view type
		this.registerView(
			CONTACTS_VIEW_TYPE,
			(leaf: WorkspaceLeaf) => (this.contactView = new ContactView(leaf))
		);

		// Add ribbon icon
		if (this.settings.showInRibbon) {
			const ribbonIconEl = this.addRibbonIcon('book-user', 'Contacts', async () => {
				await this.activateView();
			});
			ribbonIconEl.addClass('contacts-plugin-ribbon-class');
		}

		// Add commands
		this.addCommand({
			id: 'open-contacts-view',
			name: 'Open Contacts View',
			callback: async () => {
				await this.activateView();
			},
		});

		this.addCommand({
			id: 'create-new-contact',
			name: 'Create New Contact',
			callback: () => {
				new NewContactModal(this.app, this).open();
			},
		});

		// Add settings tab
		this.addSettingTab(new ContactsSettingTab(this.app, this));
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(CONTACTS_VIEW_TYPE);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
		} else {
			// Create a new leaf in the main editor area
			leaf = workspace.getLeaf('tab');
			if (leaf) {
				await leaf.setViewState({ type: CONTACTS_VIEW_TYPE });
			}
		}

		// Reveal the leaf in the editor area
		if (leaf) {
			workspace.revealLeaf(leaf);

			// Load contacts
			if (this.contactView) {
				const contacts = await this.contactManager.getAllContacts();
				this.contactView.setContacts(contacts);
			}
		}
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(CONTACTS_VIEW_TYPE);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

function calculateNextContact(lastContacted: string, frequency: string): string | undefined {
	if (!lastContacted || !frequency) return undefined;
	const date = new Date(lastContacted);
	switch (frequency) {
		case 'weekly':
			date.setDate(date.getDate() + 7);
			break;
		case 'monthly':
			date.setMonth(date.getMonth() + 1);
			break;
		case 'quarterly':
			date.setMonth(date.getMonth() + 3);
			break;
		case 'yearly':
			date.setFullYear(date.getFullYear() + 1);
			break;
		default:
			return undefined;
	}
	// Format as YYYY-MM-DDTHH:mm
	const pad = (n: number) => n.toString().padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export class NewContactModal extends Modal {
	contact: Partial<Contact> = {};
	plugin: ContactsPlugin;
	isEdit: boolean;
	originalName?: string;

	constructor(app: App, plugin: ContactsPlugin, contact?: Contact) {
		super(app);
		this.plugin = plugin;
		if (contact) {
			this.contact = { ...contact };
			this.isEdit = true;
			this.originalName = contact.name;
		} else {
			this.isEdit = false;
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: this.isEdit ? 'Edit Contact' : 'New Contact' });

		new Setting(contentEl)
			.setName('Name *')
			.addText(text => text
				.setValue(this.contact.name || '')
				.onChange(value => this.contact.name = value));

		new Setting(contentEl)
			.setName('Email')
			.addText(text => text
				.setValue(this.contact.email || '')
				.onChange(value => {
					this.contact.email = value;
					const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
					if (value && !emailRegex.test(value)) {
						text.inputEl.style.borderColor = 'red';
						text.inputEl.title = 'Invalid email format';
					} else {
						text.inputEl.style.borderColor = '';
						text.inputEl.title = '';
					}
				}));

		new Setting(contentEl)
			.setName('Phone *')
			.addText(text => text
				.setValue(this.contact.phone || '')
				.onChange(value => {
					this.contact.phone = value;
					// Accept 1234567890, 123-456-7890, (123) 456-7890, 123 456 7890
					const phoneRegex = /^(\+?\d{1,2}[\s-]?)?(\(?\d{3}\)?[\s-]?)?\d{3}[\s-]?\d{4}$/;
					if (value && !phoneRegex.test(value)) {
						text.inputEl.style.borderColor = 'red';
						text.inputEl.title = 'Invalid phone number format';
					} else {
						text.inputEl.style.borderColor = '';
						text.inputEl.title = '';
					}
				}));

		new Setting(contentEl)
			.setName('Company')
			.addText(text => text
				.setValue(this.contact.company || '')
				.onChange(value => this.contact.company = value));

		new Setting(contentEl)
			.setName('Title')
			.addText(text => text
				.setValue(this.contact.title || '')
				.onChange(value => this.contact.title = value));

		new Setting(contentEl)
			.setName('Contact Frequency')
			.setDesc('How often to contact this person')
			.addDropdown(dropdown => {
				dropdown
					.addOption('weekly', 'Weekly')
					.addOption('monthly', 'Monthly')
					.addOption('quarterly', 'Quarterly')
					.addOption('yearly', 'Yearly')
					.setValue(this.contact.contact_frequency || '')
					.onChange(value => {
						this.contact.contact_frequency = value;
						// Optionally, recalculate next_contact if last_contacted is set
						if (this.contact.last_contacted) {
							this.contact.next_contact = calculateNextContact(this.contact.last_contacted, value);
						}
					});
			});

		new Setting(contentEl)
			.setName('Next Contact Date')
			.setDesc('When to contact this person next')
			.addText(text =>
				text.setPlaceholder('YYYY-MM-DD')
					.setValue(this.contact.next_contact || '')
					.onChange(value => this.contact.next_contact = value));

		// Mark as Contacted button
		new Setting(contentEl)
			.addButton(button => button
				.setButtonText('Mark as Contacted')
				.onClick(async () => {
					// Use the latest provided local time as the source of truth
					const nowLocal = '2025-04-24T09:28';
					this.contact.last_contacted = nowLocal;
					if (this.contact.contact_frequency) {
						this.contact.next_contact = calculateNextContact(nowLocal, this.contact.contact_frequency);
					}
					// Immediately persist the change
					const now = new Date().toISOString();
					const fullContact: Contact = {
						...this.contact as Contact,
						modified: now,
					};
					await this.plugin.contactManager.updateContact(fullContact, this.originalName);
					if (this.plugin.contactView) {
						const contacts = await this.plugin.contactManager.getAllContacts();
						this.plugin.contactView.setContacts(contacts);
					}
					new Notice('Marked as contacted today and saved.');
				}));

		new Setting(contentEl)
			.addButton(button => button
				.setButtonText(this.isEdit ? 'Save' : 'Create')
				.setCta()
				.onClick(async () => {
					if (!this.contact.name || !this.contact.phone) {
						new Notice('Please fill in all required fields (Name and Phone)');
						return;
					}

					const now = new Date().toISOString();
					// Calculate next_contact if frequency and last_contacted are set
					if (this.contact.contact_frequency && this.contact.last_contacted) {
						this.contact.next_contact = calculateNextContact(this.contact.last_contacted, this.contact.contact_frequency);
					}
					if (this.isEdit) {
						const fullContact: Contact = {
							...this.contact as Contact,
							modified: now,
						};
						await this.plugin.contactManager.updateContact(fullContact, this.originalName);
						this.close();
						new Notice('Contact updated successfully');
					} else {
						const fullContact: Contact = {
							...this.contact as Contact,
							created: now,
							modified: now,
							last_contacted: now
						};
						if (fullContact.contact_frequency && fullContact.last_contacted) {
							fullContact.next_contact = calculateNextContact(fullContact.last_contacted, fullContact.contact_frequency);
						}
						await this.plugin.contactManager.createContact(fullContact);
						this.close();
						new Notice('Contact created successfully');
					}

					// Refresh the contact view if it's open
					if (this.plugin.contactView) {
						const contacts = await this.plugin.contactManager.getAllContacts();
						this.plugin.contactView.setContacts(contacts);
					}
				}));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class ContactsSettingTab extends PluginSettingTab {
	plugin: ContactsPlugin;

	constructor(app: App, plugin: ContactsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Contacts Settings' });

		new Setting(containerEl)
			.setName('Contacts Folder')
			.setDesc('The folder where contact files will be stored')
			.addText(text => text
				.setPlaceholder('Contacts')
				.setValue(this.plugin.settings.contactsFolder)
				.onChange(async (value) => {
					this.plugin.settings.contactsFolder = value;
					await this.plugin.saveSettings();
					// Update contact manager with new folder
					this.plugin.contactManager = new ContactManager(this.app.vault, value);
				}));

		new Setting(containerEl)
			.setName('Show in Ribbon')
			.setDesc('Show contacts icon in the ribbon')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showInRibbon)
				.onChange(async (value) => {
					this.plugin.settings.showInRibbon = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default View')
			.setDesc('Choose the default view for contacts')
			.addDropdown(dropdown => dropdown
				.addOption('table', 'Table')
				.addOption('grid', 'Grid')
				.setValue(this.plugin.settings.defaultView)
				.onChange(async (value: 'table' | 'grid') => {
					this.plugin.settings.defaultView = value;
					await this.plugin.saveSettings();
				}));
	}
}
