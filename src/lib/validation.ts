// Validation utilities
export function validateFullName(name: string): string | null {
  if (!name.trim()) return 'Full name is required.';
  if (name.trim().length < 2) return 'Name must be at least 2 characters.';
  if (name.trim().length > 100) return 'Name must be under 100 characters.';
  return null;
}

export function validateCompanyName(name: string): string | null {
  if (!name.trim()) return 'Company name is required.';
  if (name.trim().length < 2) return 'Company name must be at least 2 characters.';
  if (name.trim().length > 150) return 'Company name must be under 150 characters.';
  return null;
}

export function validateWebsite(url: string): string | null {
  if (!url) return null; // optional
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    if (!u.hostname.includes('.')) return 'Please enter a valid website URL.';
    return null;
  } catch {
    return 'Please enter a valid website URL.';
  }
}

export function validateImageFile(file: File): string | null {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return 'Only JPG, JPEG, PNG, and WEBP images are supported.';
  }
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return 'Image must be under 10MB.';
  }
  return null;
}

export function validateBrandFile(file: File): string | null {
  const allowedTypes = [
    'text/plain',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ];
  if (!allowedTypes.includes(file.type)) {
    return 'Only TXT, PDF, and DOCX files are supported.';
  }
  const maxSize = 20 * 1024 * 1024; // 20MB
  if (file.size > maxSize) {
    return 'File must be under 20MB.';
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
