import { TrashItem, FileType } from '../SmartTrashSystem';

// Global Trash Service for application-wide trash management
class GlobalTrashService {
  private static instance: GlobalTrashService;
  private listeners: ((items: TrashItem[]) => void)[] = [];
  private items: TrashItem[] = [];

  static getInstance(): GlobalTrashService {
    if (!GlobalTrashService.instance) {
      GlobalTrashService.instance = new GlobalTrashService();
    }
    return GlobalTrashService.instance;
  }

  // Subscribe to trash changes
  subscribe(listener: (items: TrashItem[]) => void) {
    this.listeners.push(listener);
    listener(this.items);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Add item to trash
  addItem(item: Omit<TrashItem, 'id' | 'deletedAt'>) {
    const trashItem: TrashItem = {
      ...item,
      id: Math.random().toString(36).substring(2, 9),
      deletedAt: Date.now()
    };
    
    this.items = [trashItem, ...this.items];
    this.notifyListeners();
    
    // Store in localStorage for persistence
    this.saveToStorage();
    
    return trashItem;
  }

  // Remove item from trash (restore)
  removeItem(id: string) {
    this.items = this.items.filter(item => item.id !== id);
    this.notifyListeners();
    this.saveToStorage();
  }

  // Permanently delete item
  permanentlyDeleteItem(id: string) {
    this.items = this.items.filter(item => item.id !== id);
    this.notifyListeners();
    this.saveToStorage();
  }

  // Get all items
  getItems(): TrashItem[] {
    return [...this.items];
  }

  // Empty all trash
  emptyTrash() {
    this.items = [];
    this.notifyListeners();
    this.saveToStorage();
  }

  // Helper method to add file from memory lake
  addFileFromMemoryLake(file: any, originalPath: string) {
    return this.addItem({
      name: file.name || file.title || 'Unknown File',
      originalPath,
      size: file.size || 0,
      type: this.detectFileType(file.name || file.title || ''),
      contentSnippet: this.extractContentSnippet(file),
      importanceScore: 0.5,
      aiReason: 'File deleted from Memory Lake',
      verdict: 'Review First'
    });
  }

  // Helper method to add email
  addEmailFromTrash(email: any) {
    return this.addItem({
      name: `Email: ${email.subject || 'No Subject'}`,
      originalPath: `/Emails/${email.from || 'Unknown Sender'}`,
      size: JSON.stringify(email).length,
      type: FileType.DOC,
      contentSnippet: email.body || email.content || 'No content available',
      importanceScore: 0.7,
      aiReason: 'Email moved to trash',
      verdict: 'Review First'
    });
  }

  // Helper method to add generic item
  addGenericItem(name: string, content: any, type: FileType = FileType.OTHER, originalPath: string = '/') {
    return this.addItem({
      name,
      originalPath,
      size: JSON.stringify(content).length,
      type,
      contentSnippet: typeof content === 'string' ? content.substring(0, 200) : JSON.stringify(content).substring(0, 200),
      importanceScore: 0.3,
      aiReason: 'Item deleted from application',
      verdict: 'Safe to Delete'
    });
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.items));
  }

  private saveToStorage() {
    try {
      localStorage.setItem('global_trash_items', JSON.stringify(this.items));
    } catch (e) {
      console.warn('[GlobalTrashService] Failed to save to localStorage:', e);
    }
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem('global_trash_items');
      if (stored) {
        this.items = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[GlobalTrashService] Failed to load from localStorage:', e);
    }
  }

  private detectFileType(fileName: string): FileType {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (['doc', 'docx', 'pdf', 'txt', 'rtf'].includes(extension || '')) {
      return FileType.DOC;
    }
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'html', 'css'].includes(extension || '')) {
      return FileType.CODE;
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(extension || '')) {
      return FileType.IMAGE;
    }
    if (['json', 'csv', 'xml', 'yaml', 'yml', 'zip', 'rar', '7z'].includes(extension || '')) {
      return FileType.DATA;
    }
    
    return FileType.OTHER;
  }

  private extractContentSnippet(file: any): string {
    if (typeof file === 'string') {
      return file.substring(0, 200);
    }
    if (file.content) {
      return typeof file.content === 'string' ? file.content.substring(0, 200) : JSON.stringify(file.content).substring(0, 200);
    }
    if (file.body) {
      return typeof file.body === 'string' ? file.body.substring(0, 200) : JSON.stringify(file.body).substring(0, 200);
    }
    if (file.snippet) {
      return file.snippet;
    }
    
    return 'No content preview available';
  }

  // Initialize the service
  initialize() {
    this.loadFromStorage();
  }
}

// Export singleton instance
export const globalTrashService = GlobalTrashService.getInstance();

// Initialize on import
globalTrashService.initialize();
