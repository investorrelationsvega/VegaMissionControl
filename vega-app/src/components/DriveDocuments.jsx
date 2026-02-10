// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Drive Documents Component
// Shared doc section with Google Drive integration
// ═══════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import useGoogleStore from '../stores/googleStore';
import useFundStore from '../stores/fundStore';
import useUiStore from '../stores/uiStore';
import { initGapi, requestAccessTokenWithConsent, requestAccessToken, isTokenValid } from '../services/googleAuth';
import { listFilesInFolder, getFolderMetadata, parseFolderIdFromUrl, getFileTypeLabel } from '../services/driveService';

export default function DriveDocuments({ fundId, fundShortName }) {
  const fundDocuments = useFundStore((s) => s.fundDocuments);
  const showToast = useUiStore((s) => s.showToast);

  const isAuthenticated = useGoogleStore((s) => s.isAuthenticated);
  const accessToken = useGoogleStore((s) => s.accessToken);
  const folderMappings = useGoogleStore((s) => s.folderMappings);
  const fileCache = useGoogleStore((s) => s.fileCache);
  const setToken = useGoogleStore((s) => s.setToken);
  const setFolderMapping = useGoogleStore((s) => s.setFolderMapping);
  const removeFolderMapping = useGoogleStore((s) => s.removeFolderMapping);
  const setCachedFiles = useGoogleStore((s) => s.setCachedFiles);
  const getCachedFiles = useGoogleStore((s) => s.getCachedFiles);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configInputs, setConfigInputs] = useState({});
  const [verifying, setVerifying] = useState({});
  const [verified, setVerified] = useState({});
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Static docs as fallback
  const staticDocs = fundDocuments[fundId] || {};
  const staticCategories = Object.entries(staticDocs);
  const fundMappings = folderMappings[fundId] || {};

  // ── Fetch Drive Files ─────────────────────────────────────────────────
  const fetchDriveFiles = useCallback(async () => {
    if (!isAuthenticated) return;
    const mappedCategories = Object.entries(fundMappings).filter(([k]) => k !== '_root');
    if (mappedCategories.length === 0) return;

    setLoadingFiles(true);
    try {
      // Ensure gapi is initialized
      await initGapi();

      for (const [category, mapping] of mappedCategories) {
        const cached = getCachedFiles(mapping.folderId);
        if (cached) continue; // Use cache

        const files = await listFilesInFolder(mapping.folderId);
        setCachedFiles(mapping.folderId, files);
      }
    } catch (err) {
      console.error('Drive fetch error:', err);
    } finally {
      setLoadingFiles(false);
    }
  }, [isAuthenticated, fundMappings, getCachedFiles, setCachedFiles]);

  useEffect(() => {
    fetchDriveFiles();
  }, [fetchDriveFiles]);

  // ── Connect Google Drive ──────────────────────────────────────────────
  const handleConnect = async () => {
    try {
      await initGapi();
      const token = await requestAccessTokenWithConsent();
      setToken(token);
      showToast('Google Drive connected');
    } catch (err) {
      console.error('Google auth error:', err);
    }
  };

  // ── Get files for a category ──────────────────────────────────────────
  const getFilesForCategory = (category, staticFiles) => {
    const mapping = fundMappings[category];
    if (!mapping || !isAuthenticated) return staticFiles;

    const cached = getCachedFiles(mapping.folderId);
    if (cached && cached.length > 0) return cached;

    return staticFiles; // Fallback while loading
  };

  // ── Config Modal ──────────────────────────────────────────────────────
  const openConfig = () => {
    const inputs = {};
    // Pre-fill with existing mappings
    for (const [category] of staticCategories) {
      const existing = fundMappings[category];
      inputs[category] = existing
        ? `https://drive.google.com/drive/folders/${existing.folderId}`
        : '';
    }
    // Root folder
    const rootMapping = fundMappings._root;
    inputs._root = rootMapping
      ? `https://drive.google.com/drive/folders/${rootMapping.folderId}`
      : '';
    setConfigInputs(inputs);
    setVerified({});
    setShowConfigModal(true);
  };

  const handleVerify = async (key) => {
    const url = configInputs[key];
    const folderId = parseFolderIdFromUrl(url);
    if (!folderId) {
      setVerified((v) => ({ ...v, [key]: { error: 'Invalid URL or folder ID' } }));
      return;
    }

    setVerifying((v) => ({ ...v, [key]: true }));
    try {
      if (!isAuthenticated) {
        await initGapi();
        const token = await requestAccessTokenWithConsent();
        setToken(token);
      }
      await initGapi();
      const metadata = await getFolderMetadata(folderId);
      setVerified((v) => ({
        ...v,
        [key]: { success: true, folderId, folderName: metadata.name },
      }));
    } catch (err) {
      setVerified((v) => ({
        ...v,
        [key]: { error: 'Folder not found or no access' },
      }));
    } finally {
      setVerifying((v) => ({ ...v, [key]: false }));
    }
  };

  const handleSaveConfig = () => {
    for (const [key, result] of Object.entries(verified)) {
      if (result.success) {
        setFolderMapping(fundId, key, {
          folderId: result.folderId,
          folderName: result.folderName,
        });
      }
    }
    setShowConfigModal(false);
    showToast('Drive folder mappings saved');
    // Clear cache to force re-fetch
    useGoogleStore.getState().clearFileCache();
    fetchDriveFiles();
  };

  const handleRemoveMapping = (key) => {
    removeFolderMapping(fundId, key);
    setConfigInputs((prev) => ({ ...prev, [key]: '' }));
    setVerified((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  // ── Open In Drive ─────────────────────────────────────────────────────
  const rootFolder = fundMappings._root;
  const driveUrl = rootFolder
    ? `https://drive.google.com/drive/folders/${rootFolder.folderId}`
    : null;

  // ── Build final categories (merge static + Drive) ─────────────────────
  const allCategories = staticCategories.map(([category, staticFiles]) => {
    const files = getFilesForCategory(category, staticFiles);
    const isMapped = !!fundMappings[category];
    return [category, files, isMapped];
  });

  return (
    <div
      style={{
        background: 'var(--bg-card-half)',
        border: '1px solid var(--bd)',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--bd)',
        }}
      >
        <span className="section-label">{fundShortName} Documents</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Configure button */}
          <button
            onClick={openConfig}
            className="mono"
            style={{
              fontSize: 10,
              color: 'var(--t5)',
              background: 'none',
              border: '1px solid var(--bd)',
              padding: '3px 8px',
              borderRadius: 3,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Configure
          </button>
          {/* Open in Drive */}
          <a
            href={driveUrl || '#'}
            target={driveUrl ? '_blank' : undefined}
            rel={driveUrl ? 'noopener noreferrer' : undefined}
            onClick={(e) => {
              if (!driveUrl) {
                e.preventDefault();
                openConfig();
              }
            }}
            className="mono"
            style={{
              fontSize: 11,
              color: driveUrl ? 'var(--grn)' : 'var(--t5)',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (driveUrl) e.currentTarget.style.color = '#2dd4a0';
            }}
            onMouseLeave={(e) => {
              if (driveUrl) e.currentTarget.style.color = 'var(--grn)';
            }}
          >
            Open In Drive &rarr;
          </a>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 20 }}>
        {allCategories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--t4)' }}>
            No documents yet
          </div>
        ) : (
          allCategories.map(([category, files, isMapped], catIdx) => (
            <div
              key={category}
              style={{
                marginBottom: catIdx < allCategories.length - 1 ? 20 : 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--t3)',
                  marginBottom: 12,
                }}
              >
                {category}
                {isMapped && isAuthenticated && (
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: 'var(--grn)',
                      display: 'inline-block',
                    }}
                    title="Synced with Google Drive"
                  />
                )}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 10,
                }}
              >
                {files.map((doc, docIdx) => (
                  <div
                    key={doc.driveId || `${category}-${docIdx}`}
                    onClick={() => {
                      if (doc.url) window.open(doc.url, '_blank');
                    }}
                    style={{
                      background: 'var(--bgI)',
                      borderRadius: 6,
                      padding: 12,
                      cursor: doc.url ? 'pointer' : 'default',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'var(--bgH)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = 'var(--bgI)')
                    }
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 3,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--t1)',
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {doc.name}
                      </div>
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: 'var(--t4)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {doc.mimeType && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            padding: '1px 4px',
                            borderRadius: 2,
                            background: 'var(--grnM)',
                            color: 'var(--grn)',
                          }}
                        >
                          {getFileTypeLabel(doc.mimeType)}
                        </span>
                      )}
                      {doc.meta}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {/* Connect Drive CTA when not authenticated and no mappings */}
        {!isAuthenticated && Object.keys(fundMappings).length === 0 && (
          <div
            style={{
              marginTop: 16,
              padding: '16px 20px',
              background: 'var(--bgI)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 2 }}>
                Connect Google Drive to sync fund documents
              </div>
              <div
                className="mono"
                style={{ fontSize: 11, color: 'var(--t5)' }}
              >
                Link folders to see live files here
              </div>
            </div>
            <button
              onClick={handleConnect}
              className="btn btn-primary"
              style={{ fontSize: 11, padding: '8px 16px' }}
            >
              Connect Drive
            </button>
          </div>
        )}
      </div>

      {/* ── Config Modal ──────────────────────────────────────────────── */}
      {showConfigModal && (
        <div
          className="modal-overlay active"
          style={{ display: 'flex' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowConfigModal(false);
          }}
        >
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <div className="modal-title">
                Configure Drive Folders — {fundShortName}
              </div>
              <button
                className="modal-close"
                onClick={() => setShowConfigModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              {/* Root folder */}
              <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--bd)' }}>
                <label className="form-label">Root Fund Folder</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Paste Google Drive folder URL..."
                    value={configInputs._root || ''}
                    onChange={(e) =>
                      setConfigInputs((p) => ({ ...p, _root: e.target.value }))
                    }
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 10, padding: '8px 12px', whiteSpace: 'nowrap' }}
                    onClick={() => handleVerify('_root')}
                    disabled={verifying._root}
                  >
                    {verifying._root ? '...' : 'Verify'}
                  </button>
                  {fundMappings._root && (
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: 10, padding: '8px 12px' }}
                      onClick={() => handleRemoveMapping('_root')}
                    >
                      &times;
                    </button>
                  )}
                </div>
                {verified._root && (
                  <div
                    className="mono"
                    style={{
                      fontSize: 10,
                      marginTop: 6,
                      color: verified._root.success ? 'var(--grn)' : 'var(--red)',
                    }}
                  >
                    {verified._root.success
                      ? `✓ ${verified._root.folderName}`
                      : verified._root.error}
                  </div>
                )}
                {fundMappings._root && !verified._root && (
                  <div
                    className="mono"
                    style={{ fontSize: 10, marginTop: 6, color: 'var(--grn)' }}
                  >
                    ✓ Linked: {fundMappings._root.folderName}
                  </div>
                )}
              </div>

              {/* Category folders */}
              {staticCategories.map(([category]) => (
                <div
                  key={category}
                  style={{
                    marginBottom: 16,
                  }}
                >
                  <label className="form-label">{category}</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Paste folder URL..."
                      value={configInputs[category] || ''}
                      onChange={(e) =>
                        setConfigInputs((p) => ({
                          ...p,
                          [category]: e.target.value,
                        }))
                      }
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 10, padding: '8px 12px', whiteSpace: 'nowrap' }}
                      onClick={() => handleVerify(category)}
                      disabled={verifying[category]}
                    >
                      {verifying[category] ? '...' : 'Verify'}
                    </button>
                    {fundMappings[category] && (
                      <button
                        className="btn btn-danger"
                        style={{ fontSize: 10, padding: '8px 12px' }}
                        onClick={() => handleRemoveMapping(category)}
                      >
                        &times;
                      </button>
                    )}
                  </div>
                  {verified[category] && (
                    <div
                      className="mono"
                      style={{
                        fontSize: 10,
                        marginTop: 6,
                        color: verified[category].success
                          ? 'var(--grn)'
                          : 'var(--red)',
                      }}
                    >
                      {verified[category].success
                        ? `✓ ${verified[category].folderName}`
                        : verified[category].error}
                    </div>
                  )}
                  {fundMappings[category] && !verified[category] && (
                    <div
                      className="mono"
                      style={{
                        fontSize: 10,
                        marginTop: 6,
                        color: 'var(--grn)',
                      }}
                    >
                      ✓ Linked: {fundMappings[category].folderName}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowConfigModal(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveConfig}>
                Save Mappings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
