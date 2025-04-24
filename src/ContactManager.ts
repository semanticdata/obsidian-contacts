import { TFile, Vault } from 'obsidian';
import { Contact } from './types';

export class ContactManager {
    constructor(private vault: Vault, private contactsFolder: string) {
        this.ensureContactsFolderExists();
    }

    private async ensureContactsFolderExists() {
        try {
            const folder = this.vault.getAbstractFileByPath(this.contactsFolder);
            if (!folder) {
                await this.vault.createFolder(this.contactsFolder);
            }
        }
        catch (error) {
            // console.error('Error ensuring contacts folder exists:', error);
        }
    }

    async getAllContacts(): Promise<Contact[]> {
        const folder = this.vault.getAbstractFileByPath(this.contactsFolder);
        if (!folder) return [];

        const files = this.vault.getMarkdownFiles()
            .filter(file => file.path.startsWith(this.contactsFolder));

        const contacts: Contact[] = [];
        for (const file of files) {
            const contact = await this.getContactFromFile(file);
            if (contact) contacts.push(contact);
        }

        return contacts;
    }

    async getContactFromFile(file: TFile): Promise<Contact | null> {
        const content = await this.vault.read(file);
        const frontmatter = this.extractFrontMatter(content);
        if (!frontmatter || !frontmatter.name) return null;

        // Parse tags as array if comma-separated
        let tags: string[] | undefined = undefined;
        if (frontmatter.tags) {
            if (Array.isArray(frontmatter.tags)) {
                tags = frontmatter.tags;
            } else if (typeof frontmatter.tags === 'string') {
                tags = frontmatter.tags.split(',').map((t: string) => t.trim());
            }
        }

        return {
            name: frontmatter.name,
            email: frontmatter.email || '',
            phone: frontmatter.phone || '',
            company: frontmatter.company,
            title: frontmatter.title,
            notes: frontmatter.notes,
            tags,
            created: frontmatter.created || file.stat.ctime.toString(),
            modified: frontmatter.modified || file.stat.mtime.toString(),
            last_contacted: frontmatter.last_contacted,
            next_contact: frontmatter.next_contact,
            contact_frequency: frontmatter.contact_frequency,
        };
    }

    private extractFrontMatter(content: string): any {
        const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
        const match = content.match(frontMatterRegex);
        if (!match) return null;

        const yaml = match[1];
        try {
            return yaml.split('\n').reduce((acc: any, line: string) => {
                const [key, ...values] = line.split(':').map(s => s.trim());
                if (key && values.length) {
                    acc[key] = values.join(':');
                }
                return acc;
            }, {});
        } catch (e) {
            console.error('Error parsing frontmatter:', e);
            return null;
        }
    }

    async createContact(contact: Contact): Promise<void> {
        const fileName = `${contact.name.replace(/[^a-zA-Z0-9]/g, '-')}.md`;
        const filePath = `${this.contactsFolder}/${fileName}`;

        const frontMatter = this.createFrontMatter(contact);
        const fileContent = `---\n${frontMatter}\n---\n\n# ${contact.name}\n\n${contact.notes || ''}`;

        await this.vault.create(filePath, fileContent);
    }

    async updateContact(contact: Contact, originalName?: string): Promise<void> {
        const oldFileName = `${(originalName || contact.name).replace(/[^a-zA-Z0-9]/g, '-')}.md`;
        const newFileName = `${contact.name.replace(/[^a-zA-Z0-9]/g, '-')}.md`;
        const oldFilePath = `${this.contactsFolder}/${oldFileName}`;
        const newFilePath = `${this.contactsFolder}/${newFileName}`;

        const file = this.vault.getAbstractFileByPath(oldFilePath);
        if (!file) throw new Error('Original contact file not found');

        // If the name changed, rename the file
        if (oldFilePath !== newFilePath) {
            await this.vault.rename(file, newFilePath);
        }

        // Update the content
        const frontMatter = this.createFrontMatter(contact);
        const fileContent = `---\n${frontMatter}\n---\n\n# ${contact.name}\n\n${contact.notes || ''}`;
        const updatedFile = this.vault.getAbstractFileByPath(newFilePath);
        if (!updatedFile || updatedFile instanceof TFile === false) throw new Error('Updated contact file not found');
        await this.vault.modify(updatedFile as TFile, fileContent);
    }

    private createFrontMatter(contact: Contact): string {
        const frontMatter = [
            `name: ${contact.name}`,
            `email: ${contact.email}`,
            `phone: ${contact.phone}`
        ];

        if (contact.company) frontMatter.push(`company: ${contact.company}`);
        if (contact.title) frontMatter.push(`title: ${contact.title}`);
        if (contact.tags?.length) frontMatter.push(`tags: ${contact.tags.join(', ')}`);
        if (contact.last_contacted) frontMatter.push(`last_contacted: ${contact.last_contacted}`);
        if (contact.next_contact) frontMatter.push(`next_contact: ${contact.next_contact}`);
        if (contact.contact_frequency) frontMatter.push(`contact_frequency: ${contact.contact_frequency}`);
        frontMatter.push(`created: ${contact.created}`);
        frontMatter.push(`modified: ${contact.modified}`);

        return frontMatter.join('\n');
    }
}