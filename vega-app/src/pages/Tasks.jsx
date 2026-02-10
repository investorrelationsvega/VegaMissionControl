// =============================================
// VEGA MISSION CONTROL - Tasks Page
// Operational task manager with filtering,
// add/edit modal, overdue tracking
// =============================================

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import useTaskStore from '../stores/taskStore'
import useInvestorStore from '../stores/investorStore'
import useUiStore from '../stores/uiStore'

// ── Constants ───────────────────────────────────────────────────────────────
const TEAM_EMAILS = ['j@vegarei.com', 'cory@vegacapital.com']
const PRIORITIES = ['High', 'Medium', 'Low']
const STATUSES = ['To Do', 'In Progress', 'Done']

const TODAY = new Date().toISOString().slice(0, 10)

function isOverdue(task) {
  return task.status !== 'Done' && task.dueDate && task.dueDate < TODAY
}

const EMPTY_FORM = {
  title: '',
  description: '',
  assignee: 'j@vegarei.com',
  dueDate: '',
  priority: 'Medium',
  status: 'To Do',
  linkedInvestor: '',
}

// ═══════════════════════════════════════════════
// TASKS PAGE COMPONENT
// ═══════════════════════════════════════════════
export default function Tasks() {
  const navigate = useNavigate()

  // ── Stores ──────────────────────────────────
  const tasks = useTaskStore((s) => s.tasks)
  const addTask = useTaskStore((s) => s.add)
  const updateTask = useTaskStore((s) => s.update)
  const completeTask = useTaskStore((s) => s.complete)
  const removeTask = useTaskStore((s) => s.remove)

  const investors = useInvestorStore((s) => s.getAll)
  const investorList = useMemo(() => investors(), [investors])

  const showToast = useUiStore((s) => s.showToast)

  // ── Local state ─────────────────────────────
  const [assigneeFilter, setAssigneeFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  // ── Derived stats ───────────────────────────
  const totalCount = tasks.length
  const todoCount = useMemo(() => tasks.filter((t) => t.status === 'To Do').length, [tasks])
  const inProgressCount = useMemo(() => tasks.filter((t) => t.status === 'In Progress').length, [tasks])
  const doneCount = useMemo(() => tasks.filter((t) => t.status === 'Done').length, [tasks])
  const overdueCount = useMemo(() => tasks.filter((t) => isOverdue(t)).length, [tasks])

  // ── Filtered tasks ──────────────────────────
  const filtered = useMemo(() => {
    let list = tasks
    if (assigneeFilter !== 'All') {
      list = list.filter((t) => t.assignee === assigneeFilter)
    }
    if (priorityFilter !== 'All') {
      list = list.filter((t) => t.priority === priorityFilter)
    }
    if (statusFilter !== 'All') {
      list = list.filter((t) => t.status === statusFilter)
    }
    return list
  }, [tasks, assigneeFilter, priorityFilter, statusFilter])

  // ── Investor name lookup ────────────────────
  const investorMap = useMemo(() => {
    const map = {}
    investorList.forEach((inv) => {
      map[inv.id] = inv.name
    })
    return map
  }, [investorList])

  // ── Handlers ────────────────────────────────
  const openAddModal = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setShowModal(true)
  }

  const openEditModal = (task) => {
    setEditingId(task.id)
    setForm({
      title: task.title,
      description: task.description || '',
      assignee: task.assignee || 'j@vegarei.com',
      dueDate: task.dueDate || '',
      priority: task.priority || 'Medium',
      status: task.status || 'To Do',
      linkedInvestor: task.linkedInvestor || '',
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
  }

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    if (!form.title.trim()) return
    if (editingId) {
      updateTask(editingId, { ...form })
      showToast('Task updated')
    } else {
      addTask({ ...form })
      showToast('Task created')
    }
    closeModal()
  }

  const handleComplete = (id) => {
    completeTask(id)
    showToast('Task marked as done')
  }

  const handleDelete = (id) => {
    removeTask(id)
    showToast('Task deleted')
  }

  const handleStatusChange = (id, newStatus) => {
    updateTask(id, { status: newStatus })
    showToast(`Status changed to ${newStatus}`)
  }

  // ── Priority badge class ────────────────────
  const priorityBadgeClass = (p) => {
    if (p === 'High') return 'badge badge-red'
    if (p === 'Medium') return 'badge badge-yellow'
    return 'badge badge-muted'
  }

  // ── Status badge class ──────────────────────
  const statusBadgeClass = (s) => {
    if (s === 'Done') return 'badge badge-green'
    if (s === 'In Progress') return 'badge badge-blue'
    return 'badge badge-muted'
  }

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════
  return (
    <div className="main">
      {/* ── Page Header ───────────────────────── */}
      <div className="page-header">
        <div className="page-header-dot"><span>Active Module</span></div>
        <h1 className="page-title">Tasks</h1>
        <p className="page-subtitle">Operational Task Manager</p>
      </div>

      {/* ── Stats Row ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Tasks', value: totalCount },
          { label: 'To Do', value: todoCount },
          { label: 'In Progress', value: inProgressCount, color: 'var(--blu)' },
          { label: 'Done', value: doneCount, color: 'var(--grn)' },
          { label: 'Overdue', value: overdueCount, color: overdueCount > 0 ? 'var(--red)' : 'var(--grn)' },
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              background: 'rgba(15,23,42,0.5)',
              border: '1px solid var(--bd)',
              borderRadius: 6,
              padding: '14px 18px',
            }}
          >
            <div
              className="mono"
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: 'var(--t4)',
                marginBottom: 4,
              }}
            >
              {stat.label}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 300,
                color: stat.color || 'var(--t1)',
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter Bar ────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        {/* Assignee Filter */}
        <select
          className="form-select"
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          style={{ minWidth: 180 }}
        >
          <option value="All">All Assignees</option>
          {TEAM_EMAILS.map((email) => (
            <option key={email} value={email}>{email}</option>
          ))}
        </select>

        {/* Priority Filter */}
        <select
          className="form-select"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          style={{ minWidth: 130 }}
        >
          <option value="All">All Priority</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          className="form-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ minWidth: 130 }}
        >
          <option value="All">All Status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Add Task Button */}
        <button
          className="btn btn-primary"
          style={{ marginLeft: 'auto' }}
          onClick={openAddModal}
        >
          + Add Task
        </button>
      </div>

      {/* ── Results Count ─────────────────────── */}
      <div
        className="mono"
        style={{ fontSize: 11, color: 'var(--t5)', marginBottom: 12 }}
      >
        {filtered.length} task{filtered.length !== 1 ? 's' : ''} found
      </div>

      {/* ── Task List ─────────────────────────── */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 0',
            color: 'var(--t4)',
            fontSize: 14,
          }}
        >
          No tasks match current filters
        </div>
      ) : (
        filtered.map((task) => {
          const overdue = isOverdue(task)
          const linkedName = task.linkedInvestor ? investorMap[task.linkedInvestor] || '' : ''

          return (
            <div
              key={task.id}
              style={{
                background: 'var(--bg-card-half)',
                border: '1px solid var(--bd)',
                borderLeft: overdue ? '3px solid var(--red)' : '1px solid var(--bd)',
                borderRadius: 6,
                padding: 16,
                marginBottom: 8,
              }}
            >
              {/* Top row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                {/* Left: content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Title */}
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: 'var(--t1)',
                      marginBottom: 4,
                    }}
                  >
                    {task.title}
                  </div>

                  {/* Description */}
                  {task.description && (
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--t3)',
                        lineHeight: 1.5,
                        marginBottom: 8,
                      }}
                    >
                      {task.description}
                    </div>
                  )}

                  {/* Meta row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    {/* Assignee */}
                    <span
                      className="mono"
                      style={{ fontSize: 11, color: 'var(--t4)' }}
                    >
                      {task.assignee}
                    </span>

                    {/* Due date */}
                    {task.dueDate && (
                      <span
                        className="mono"
                        style={{
                          fontSize: 11,
                          color: overdue ? 'var(--red)' : 'var(--t4)',
                          fontWeight: overdue ? 700 : 400,
                        }}
                      >
                        Due: {task.dueDate}
                        {overdue && ' (OVERDUE)'}
                      </span>
                    )}

                    {/* Linked investor */}
                    {linkedName && (
                      <span
                        className="mono"
                        style={{
                          fontSize: 11,
                          color: 'var(--grn)',
                          cursor: 'pointer',
                        }}
                        onClick={() => navigate('/directory')}
                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        {linkedName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: badges + actions */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 8,
                    flexShrink: 0,
                  }}
                >
                  {/* Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className={priorityBadgeClass(task.priority)}>
                      {task.priority}
                    </span>
                    <span className={statusBadgeClass(task.status)}>
                      {task.status}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {/* Status quick-change */}
                    <select
                      className="form-select"
                      value={task.status}
                      onChange={(e) => handleStatusChange(task.id, e.target.value)}
                      style={{ fontSize: 10, padding: '3px 6px', minWidth: 90 }}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>

                    {task.status !== 'Done' && (
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: 10, padding: '4px 10px' }}
                        onClick={() => handleComplete(task.id)}
                      >
                        Complete
                      </button>
                    )}
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 10, padding: '4px 10px' }}
                      onClick={() => openEditModal(task)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: 10, padding: '4px 10px' }}
                      onClick={() => handleDelete(task.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })
      )}

      {/* ── Add/Edit Task Modal ───────────────── */}
      {showModal && (
        <div
          className="modal-overlay active"
          style={{ display: 'flex' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">{editingId ? 'Edit Task' : 'Add Task'}</div>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <div className="modal-body">
              {/* Title */}
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.title}
                  onChange={(e) => handleFormChange('title', e.target.value)}
                  placeholder="Task title..."
                />
              </div>

              {/* Description */}
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  value={form.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  rows={3}
                  placeholder="Task description..."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              {/* Assignee + Due Date row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="form-label">Assignee</label>
                  <select
                    className="form-select"
                    value={form.assignee}
                    onChange={(e) => handleFormChange('assignee', e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {TEAM_EMAILS.map((email) => (
                      <option key={email} value={email}>{email}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Due Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.dueDate}
                    onChange={(e) => handleFormChange('dueDate', e.target.value)}
                  />
                </div>
              </div>

              {/* Priority + Status row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="form-label">Priority</label>
                  <select
                    className="form-select"
                    value={form.priority}
                    onChange={(e) => handleFormChange('priority', e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={form.status}
                    onChange={(e) => handleFormChange('status', e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Linked Investor */}
              <div style={{ marginBottom: 0 }}>
                <label className="form-label">Link to Investor (optional)</label>
                <select
                  className="form-select"
                  value={form.linkedInvestor}
                  onChange={(e) => handleFormChange('linkedInvestor', e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="">-- None --</option>
                  {investorList.map((inv) => (
                    <option key={inv.id} value={inv.id}>{inv.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editingId ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
