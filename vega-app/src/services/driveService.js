// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Google Drive Service
// Drive API wrappers via gapi.client
// ═══════════════════════════════════════════════

import useGoogleStore from '../stores/googleStore';

/** Ensure gapi.client has the current access token from the store */
function syncGapiToken() {
  const token = useGoogleStore.getState().accessToken;
  if (!token) throw new Error('No Google access token available');
  window.gapi.client.setToken({ access_token: token });
}

/**
 * List files in a Google Drive folder.
 * @param {string} folderId
 * @returns {Promise<Array>} Array of formatted file objects
 */
export async function listFilesInFolder(folderId) {
  syncGapiToken();
  const response = await window.gapi.client.drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, modifiedTime, webViewLink, iconLink)',
    orderBy: 'modifiedTime desc',
    pageSize: 50,
  });

  const files = response.result.files || [];
  return files.map(formatFileForDisplay);
}

/**
 * Get metadata for a Drive folder (verify it exists).
 * @param {string} folderId
 * @returns {Promise<{id, name, webViewLink}>}
 */
export async function getFolderMetadata(folderId) {
  syncGapiToken();
  const response = await window.gapi.client.drive.files.get({
    fileId: folderId,
    fields: 'id, name, webViewLink, mimeType',
  });
  return response.result;
}

/**
 * Extract folder ID from a Google Drive URL.
 * Supports:
 *   https://drive.google.com/drive/folders/FOLDER_ID
 *   https://drive.google.com/drive/u/0/folders/FOLDER_ID
 *   Bare folder ID strings
 */
export function parseFolderIdFromUrl(input) {
  if (!input) return null;
  const trimmed = input.trim();

  // Try to extract from URL
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];

  // Check if it's a bare folder ID (alphanumeric + hyphens + underscores)
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed) && trimmed.length > 10) {
    return trimmed;
  }

  return null;
}

/**
 * Format a Drive API file object for display.
 * Matches the existing {name, meta, url} schema.
 */
function formatFileForDisplay(driveFile) {
  return {
    name: driveFile.name,
    meta: formatRelativeDate(driveFile.modifiedTime),
    url: driveFile.webViewLink,
    mimeType: driveFile.mimeType,
    driveId: driveFile.id,
    iconLink: driveFile.iconLink,
  };
}

/**
 * Format an ISO date string as relative time or short date.
 */
function formatRelativeDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;

  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  // Show short date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Get a file type label from mime type for display.
 */
export function getFileTypeLabel(mimeType) {
  const map = {
    'application/vnd.google-apps.document': 'Doc',
    'application/vnd.google-apps.spreadsheet': 'Sheet',
    'application/vnd.google-apps.presentation': 'Slides',
    'application/vnd.google-apps.form': 'Form',
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'image/png': 'PNG',
    'image/jpeg': 'JPG',
  };
  return map[mimeType] || 'File';
}
