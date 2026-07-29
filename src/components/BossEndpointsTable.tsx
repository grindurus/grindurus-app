import { useCallback, useEffect, useState, type DragEvent, type MouseEvent, type ReactNode } from 'react'
import { normalizeBossEndpointUrl } from '../hooks/useCustomBossEndpoints'
import { clearBossEndpointProbeCache, useBossEndpointProbes } from '../hooks/useBossEndpointProbes'
import type { BossEndpointUrlsState } from '../hooks/useBossEndpointUrls'
import { requestGraiBossMetadataReload } from '../hooks/useGraiTokenMetadata'
import { ENDPOINTS_ICON, ENDPOINTS_RESET_ICON, ENDPOINTS_TABLE_COLUMN_ICONS } from './grai/graiPageIcons'
import { GraiFieldInfoButton } from './grai/GraiFieldInfo'

type BossEndpointsTableProps = {
  endpoints: BossEndpointUrlsState
}

const RESET_ENDPOINTS_HINT =
  'Clear local endpoint changes and re-fetch boss URLs from GRAI metadata (metadata.json).'

const ENDPOINTS_LEAD_HINT =
  'Boss API URIs for grinder data. Defaults load from GRAI metadata; reorder, probe, edit, or add URIs locally.'

const GRAI_STATUS_NOTICES_STORAGE_KEY = 'grai-show-status-notices'
const GRAI_STATUS_NOTICES_HIDDEN_CLASS = 'grai-status-notices-hidden'

function readShowStatusNotices(): boolean {
  try {
    return localStorage.getItem(GRAI_STATUS_NOTICES_STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

function applyShowStatusNotices(show: boolean) {
  document.documentElement.classList.toggle(GRAI_STATUS_NOTICES_HIDDEN_CLASS, !show)
  try {
    localStorage.setItem(GRAI_STATUS_NOTICES_STORAGE_KEY, show ? '1' : '0')
  } catch {
    /* ignore quota / private mode */
  }
}

function BossEndpointsColumnHead({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="grai-boss-endpoints-col-head">
      <span className="grai-boss-endpoints-col-head-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="grai-boss-endpoints-col-head-label">{label}</span>
    </span>
  )
}

function BossEndpointActionButton({
  className,
  hint,
  ariaLabel,
  onClick,
  disabled,
  children,
}: {
  className: string
  hint: string
  ariaLabel: string
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <span className="grai-field-info-wrap grai-boss-endpoints-action-wrap">
      <button
        type="button"
        className={`grai-boss-endpoints-icon-btn ${className}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
      >
        {children}
      </button>
      <span className="grai-field-info-tooltip grai-boss-endpoints-action-tooltip" role="tooltip">
        {hint}
      </span>
    </span>
  )
}

export function BossEndpointsTable({ endpoints }: BossEndpointsTableProps) {
  const {
    activeUrls: allUrls,
    customUrls,
    isMetadataLoading,
    metadataError,
    addCustomUrl,
    removeUrl,
    updateUrl,
    resetEndpointLists,
    reorderUrls,
  } = endpoints
  const [isAddFormOpen, setIsAddFormOpen] = useState(false)
  const [draftUri, setDraftUri] = useState('')
  const [draftError, setDraftError] = useState<string | null>(null)
  const [editingUri, setEditingUri] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [editingUriCellWidth, setEditingUriCellWidth] = useState<number | null>(null)
  const [draggedUri, setDraggedUri] = useState<string | null>(null)
  const [dropTargetUri, setDropTargetUri] = useState<string | null>(null)
  const [showStatusNotices, setShowStatusNotices] = useState(readShowStatusNotices)

  useEffect(() => {
    applyShowStatusNotices(showStatusNotices)
  }, [showStatusNotices])

  const { rows, probeUri, abortProbeUri } = useBossEndpointProbes(allUrls, !isMetadataLoading)

  const openAddForm = useCallback(() => {
    setDraftError(null)
    setIsAddFormOpen(true)
  }, [])

  const closeAddForm = useCallback(() => {
    setDraftError(null)
    setDraftUri('')
    setIsAddFormOpen(false)
  }, [])

  const applyCustomUri = useCallback(() => {
    const error = addCustomUrl(draftUri, allUrls)
    if (error) {
      setDraftError(error)
      return
    }

    closeAddForm()
  }, [addCustomUrl, allUrls, closeAddForm, draftUri])

  const handleReset = useCallback(() => {
    resetEndpointLists()
    clearBossEndpointProbeCache()
    closeAddForm()
    setEditingUri(null)
    setEditDraft('')
    setEditError(null)
    setEditingUriCellWidth(null)
    requestGraiBossMetadataReload()
  }, [closeAddForm, resetEndpointLists])

  const startEditUri = useCallback((uri: string, event: MouseEvent<HTMLButtonElement>) => {
    const td = event.currentTarget.closest('td')
    if (td) {
      setEditingUriCellWidth(td.getBoundingClientRect().width)
    }
    setEditingUri(uri)
    setEditDraft(uri)
    setEditError(null)
  }, [])

  const cancelEditUri = useCallback(() => {
    setEditingUri(null)
    setEditDraft('')
    setEditError(null)
    setEditingUriCellWidth(null)
  }, [])

  const applyEditUri = useCallback(
    (fromUri: string) => {
      const normalizedFrom = normalizeBossEndpointUrl(fromUri)
      const normalizedTo = normalizeBossEndpointUrl(editDraft)
      if (!normalizedFrom || !normalizedTo) {
        setEditError('Enter a valid http or https URL')
        return
      }
      if (normalizedFrom === normalizedTo) {
        cancelEditUri()
        return
      }

      const error = updateUrl(normalizedFrom, editDraft, allUrls)
      if (error) {
        setEditError(error)
        return
      }

      abortProbeUri(normalizedFrom)
      clearBossEndpointProbeCache(normalizedFrom)
      clearBossEndpointProbeCache(normalizedTo)
      probeUri(normalizedTo)
      cancelEditUri()
    },
    [allUrls, abortProbeUri, cancelEditUri, editDraft, probeUri, updateUrl],
  )

  const handleDragStart = useCallback((uri: string) => (event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', uri)
    setDraggedUri(uri)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedUri(null)
    setDropTargetUri(null)
  }, [])

  const handleRowDragOver = useCallback(
    (uri: string) => (event: DragEvent<HTMLTableRowElement>) => {
      if (!draggedUri || draggedUri === uri) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setDropTargetUri(uri)
    },
    [draggedUri],
  )

  const handleRowDrop = useCallback(
    (uri: string) => (event: DragEvent<HTMLTableRowElement>) => {
      event.preventDefault()
      const fromUri = draggedUri ?? event.dataTransfer.getData('text/plain')
      if (!fromUri || fromUri === uri) {
        handleDragEnd()
        return
      }

      const fromIndex = allUrls.indexOf(fromUri)
      const toIndex = allUrls.indexOf(uri)
      if (fromIndex < 0 || toIndex < 0) {
        handleDragEnd()
        return
      }

      reorderUrls(fromIndex, toIndex, allUrls)
      handleDragEnd()
    },
    [allUrls, draggedUri, handleDragEnd, reorderUrls],
  )

  return (
    <div className="grai-boss-endpoints">
      <div className="grai-boss-endpoints-header">
        <GraiFieldInfoButton
          hint={ENDPOINTS_LEAD_HINT}
          ariaLabel={ENDPOINTS_LEAD_HINT}
          className="grai-boss-endpoints-lead-wrap"
          tooltipClassName="grai-boss-endpoints-lead-tooltip"
        >
          <span className="grai-boss-endpoints-lead">
            <span className="grai-boss-endpoints-lead-icon" aria-hidden="true">
              {ENDPOINTS_ICON}
            </span>
            Endpoints
          </span>
        </GraiFieldInfoButton>
        <span className="grai-field-info-wrap grai-boss-endpoints-reset-wrap">
          <button
            type="button"
            className="grai-boss-endpoints-reset-btn"
            onClick={handleReset}
            disabled={isMetadataLoading}
            aria-label={RESET_ENDPOINTS_HINT}
          >
            <span className="grai-boss-endpoints-reset-btn-icon" aria-hidden="true">
              {ENDPOINTS_RESET_ICON}
            </span>
            Reset
          </button>
          <span className="grai-field-info-tooltip grai-boss-endpoints-reset-tooltip" role="tooltip">
            {RESET_ENDPOINTS_HINT}
          </span>
        </span>
      </div>
      {metadataError ? (
        <p className="grai-boss-endpoints-status is-error" role="status">
          {metadataError}
        </p>
      ) : null}
      <div className="grai-boss-endpoints-table-wrap" role="region" aria-label="Endpoints">
        <table className="grai-boss-endpoints-table">
          <thead>
            <tr>
              <th scope="col" className="is-uri">
                <BossEndpointsColumnHead icon={ENDPOINTS_TABLE_COLUMN_ICONS.uri} label="URIs" />
              </th>
              <th scope="col" className="is-name">
                <BossEndpointsColumnHead icon={ENDPOINTS_TABLE_COLUMN_ICONS.name} label="Name" />
              </th>
              <th scope="col" className="is-grinders-max">
                <BossEndpointsColumnHead icon={ENDPOINTS_TABLE_COLUMN_ICONS.grindersMax} label="Grinders max" />
              </th>
              <th scope="col" className="is-auth">
                <BossEndpointsColumnHead icon={ENDPOINTS_TABLE_COLUMN_ICONS.auth} label="Auth" />
              </th>
              <th scope="col" className="is-reorder">
                <span className="grai-boss-endpoints-sr-only">Reorder</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isMetadataLoading && (
              <tr>
                <td colSpan={5}>
                  <span className="grai-boss-endpoints-status" role="status">
                    Loading GRAI metadata…
                  </span>
                </td>
              </tr>
            )}

            {!isMetadataLoading && allUrls.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <span className="grai-boss-endpoints-status" role="status">
                    {customUrls.length > 0 ? 'No endpoints in the list.' : 'No boss URLs in GRAI metadata.'}
                  </span>
                </td>
              </tr>
            )}

            {!isMetadataLoading &&
              rows.map((row, index) => (
                <tr
                  key={row.uri}
                  className={[
                    row.status === 'error' ? 'is-unreachable' : '',
                    draggedUri === row.uri ? 'is-dragging' : '',
                    dropTargetUri === row.uri ? 'is-drop-target' : '',
                  ]
                    .filter(Boolean)
                    .join(' ') || undefined}
                  onDragOver={handleRowDragOver(row.uri)}
                  onDragLeave={() => setDropTargetUri((current) => (current === row.uri ? null : current))}
                  onDrop={handleRowDrop(row.uri)}
                >
                  <td
                    className="is-uri"
                    style={
                      editingUri === row.uri && editingUriCellWidth
                        ? { width: editingUriCellWidth, minWidth: editingUriCellWidth }
                        : undefined
                    }
                  >
                    <div className="grai-boss-endpoint-uri-row">
                      <span className="grai-boss-endpoint-index" aria-hidden="true">
                        {index + 1}
                      </span>
                      <div className="grai-boss-endpoint-uri-actions">
                        <BossEndpointActionButton
                          className="grai-boss-endpoints-remove-btn"
                          hint="Remove from list"
                          ariaLabel={`Remove ${row.uri}`}
                          onClick={() => {
                            clearBossEndpointProbeCache(row.uri)
                            removeUrl(row.uri)
                          }}
                        >
                          <svg
                            className="grai-boss-endpoints-remove-btn-icon"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            aria-hidden="true"
                          >
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </BossEndpointActionButton>
                        <BossEndpointActionButton
                          className="grai-boss-endpoints-probe-btn"
                          hint="Probe /grinders"
                          ariaLabel={`Refresh ${row.uri}`}
                          onClick={() => probeUri(row.uri)}
                          disabled={row.status === 'loading'}
                        >
                          <svg
                            className="grai-boss-endpoints-probe-btn-icon"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M5 12h14" />
                            <path d="M12 5l7 7-7 7" />
                          </svg>
                        </BossEndpointActionButton>
                      </div>
                      <div
                        className={`grai-boss-endpoint-uri-cell${editingUri === row.uri ? ' is-editing' : ''}`}
                      >
                        <BossEndpointActionButton
                          className="grai-boss-endpoints-edit-btn"
                          hint="Edit URI"
                          ariaLabel={`Edit ${row.uri}`}
                          onClick={(event) => {
                            if (editingUri === row.uri) return
                            startEditUri(row.uri, event)
                          }}
                          disabled={editingUri === row.uri}
                        >
                          <svg
                            className="grai-boss-endpoints-edit-btn-icon"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </BossEndpointActionButton>
                        {editingUri === row.uri ? (
                          <div className="grai-boss-endpoint-uri-edit">
                            <input
                              type="url"
                              className="grai-boss-endpoint-uri-input"
                              value={editDraft}
                              onChange={(event) => {
                                setEditDraft(event.target.value)
                                if (editError) setEditError(null)
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  applyEditUri(row.uri)
                                }
                                if (event.key === 'Escape') {
                                  event.preventDefault()
                                  cancelEditUri()
                                }
                              }}
                              onBlur={() => applyEditUri(row.uri)}
                              aria-label={`Edit boss URI ${row.uri}`}
                              autoFocus
                            />
                            {editError ? (
                              <span className="grai-boss-endpoint-uri-edit-error" role="status">
                                {editError}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <code className="grai-boss-endpoint-uri">{row.uri}</code>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="is-name">
                    <span className="grai-boss-endpoint-meta-cell">
                      <code className="grai-boss-endpoint-meta-name">{row.metaName}</code>
                    </span>
                  </td>
                  <td className="is-grinders-max">
                    <code className="grai-boss-endpoint-grinders-max">{row.grindersMax}</code>
                  </td>
                  <td className="is-auth">{row.authLabel}</td>
                  <td className="is-reorder">
                    <button
                      type="button"
                      className="grai-boss-endpoints-drag-handle"
                      draggable
                      onDragStart={handleDragStart(row.uri)}
                      onDragEnd={handleDragEnd}
                      aria-label={`Reorder ${row.uri}`}
                      title="Drag to reorder"
                    >
                      <svg
                        className="grai-boss-endpoints-drag-handle-icon"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <circle cx="9" cy="7" r="1.35" />
                        <circle cx="15" cy="7" r="1.35" />
                        <circle cx="9" cy="12" r="1.35" />
                        <circle cx="15" cy="12" r="1.35" />
                        <circle cx="9" cy="17" r="1.35" />
                        <circle cx="15" cy="17" r="1.35" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="grai-boss-endpoints-add">
        {isAddFormOpen ? (
          <div className="grai-boss-endpoints-add-form">
            <button
              type="button"
              className="grai-boss-endpoints-add-cancel"
              onClick={closeAddForm}
              aria-label="Cancel adding custom boss URI"
              title="Cancel"
            >
              <svg
                className="grai-boss-endpoints-add-cancel-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <input
              type="url"
              className="grai-boss-endpoints-add-input"
              value={draftUri}
              onChange={(event) => {
                setDraftUri(event.target.value)
                if (draftError) setDraftError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  applyCustomUri()
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  closeAddForm()
                }
              }}
              placeholder="https://boss.example.com"
              aria-label="Custom boss URI"
              autoFocus
            />
            <button type="button" className="grai-boss-endpoints-add-apply" onClick={applyCustomUri}>
              Apply
            </button>
            {draftError ? (
              <span className="grai-boss-endpoints-add-error" role="status">
                {draftError}
              </span>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            className="grai-boss-endpoints-add-toggle"
            onClick={openAddForm}
            aria-label="Add custom boss URI"
          >
            <svg
              className="grai-boss-endpoints-add-toggle-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}
      </div>
      <button
        type="button"
        className={`grai-boss-endpoints-notices-toggle${showStatusNotices ? ' is-active' : ''}`}
        aria-pressed={showStatusNotices}
        aria-label={showStatusNotices ? 'Hide status notices' : 'Show status notices'}
        title={showStatusNotices ? 'Hide status notices' : 'Show status notices'}
        onClick={() => setShowStatusNotices((prev) => !prev)}
      >
        Notices
      </button>
    </div>
  )
}
