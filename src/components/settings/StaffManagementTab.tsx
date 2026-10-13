import { useState, useEffect, useMemo, useCallback } from 'react';
import type { User, UserRole } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, EmptyState } from '@/components/ui/States';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import {
  Users,
  UserPlus,
  Shield,
  Briefcase,
  HardHat,
  Search,
  Key,
  Pencil,
  Trash2,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Check,
} from 'lucide-react';

interface StaffManagementTabProps {
  currentUser?: User | null;
}

const roleConfigs: Record<UserRole, {
  label: string;
  badge: 'amber' | 'blue' | 'gray';
  icon: typeof Shield;
  colorClass: string;
  bgClass: string;
  description: string;
}> = {
  admin: {
    label: 'Admin',
    badge: 'amber',
    icon: Shield,
    colorClass: 'text-amber-400',
    bgClass: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
    description: 'Full workshop management, tax settings, invoices, staff & data backups',
  },
  manager: {
    label: 'Manager',
    badge: 'blue',
    icon: Briefcase,
    colorClass: 'text-blue-400',
    bgClass: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
    description: 'Job orders, inventory stock, customer relations, payments & invoices',
  },
  worker: {
    label: 'Worker',
    badge: 'gray',
    icon: HardHat,
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
    description: 'Shop floor execution, job orders status, and material usage',
  },
};

export function StaffManagementTab({ currentUser }: StaffManagementTabProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Add / Edit Modal state
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('worker');
  const [formPassword, setFormPassword] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);

  // Reset Password Modal state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);

  // Delete Confirm Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // Fetch users from SQLite backend with Supabase fallback
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Try local SQLite API first
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setUsers(data);
          setLoading(false);
          return;
        }
      }
    } catch {
      // Fall through to Supabase
    }

    // 2. Fallback to Supabase
    try {
      const { data, error } = await supabase.from('users').select('*').order('name');
      if (!error && data) {
        setUsers(data.map((u: any) => ({ ...u, active: Boolean(u.active) })));
      }
    } catch (err) {
      console.error('Failed to fetch staff members:', err);
      toast.error('Could not load staff list.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role === 'admin').length;
    const managers = users.filter((u) => u.role === 'manager').length;
    const workers = users.filter((u) => u.role === 'worker').length;
    const activeCount = users.filter((u) => u.active).length;
    const inactiveCount = total - activeCount;
    return { total, admins, managers, workers, activeCount, inactiveCount };
  }, [users]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Search
      const query = search.trim().toLowerCase();
      if (query) {
        const matchName = u.name.toLowerCase().includes(query);
        const matchEmail = (u.email || '').toLowerCase().includes(query);
        const matchPhone = (u.phone || '').toLowerCase().includes(query);
        if (!matchName && !matchEmail && !matchPhone) return false;
      }
      // Role
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      // Status
      if (statusFilter === 'active' && !u.active) return false;
      if (statusFilter === 'inactive' && u.active) return false;

      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  // Quick Role Change
  async function handleRoleChange(user: User, newRole: UserRole) {
    if (user.role === newRole) return;
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        toast.success(`Updated ${user.name}'s role to ${roleConfigs[newRole].label}`);
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)));
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update role');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error updating role');
    }
  }

  // Quick Active/Inactive Toggle
  async function handleToggleActive(user: User) {
    if (currentUser && currentUser.id === user.id && user.active) {
      toast.error('You cannot deactivate your own account.');
      return;
    }
    const nextActive = !user.active;
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: nextActive }),
      });
      if (res.ok) {
        toast.success(`${user.name} is now ${nextActive ? 'Active' : 'Inactive'}`);
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, active: nextActive } : u)));
      } else {
        throw new Error('Failed to update status');
      }
    } catch {
      toast.error('Could not update staff status.');
    }
  }

  // Open Add Modal
  function handleOpenAdd() {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormRole('worker');
    setFormPassword('');
    setFormActive(true);
    setShowPassword(false);
    setUserModalOpen(true);
  }

  // Open Edit Modal
  function handleOpenEdit(user: User) {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email || '');
    setFormPhone(user.phone || '');
    setFormRole(user.role);
    setFormPassword('');
    setFormActive(user.active);
    setShowPassword(false);
    setUserModalOpen(true);
  }

  // Save User (Add or Edit)
  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Staff name is required.');
      return;
    }
    if (!editingUser && !formEmail.trim()) {
      toast.error('Email address is required for new accounts.');
      return;
    }

    setModalSaving(true);
    try {
      if (editingUser) {
        // Edit existing
        const updatePayload: Record<string, any> = {
          name: formName.trim(),
          email: formEmail.trim() || null,
          phone: formPhone.trim() || null,
          role: formRole,
          active: formActive,
        };
        if (formPassword.trim()) {
          updatePayload.password = formPassword.trim();
        }

        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload),
        });

        if (res.ok) {
          const updated = await res.json();
          setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? { ...u, ...updated } : u)));
          toast.success(`Updated ${updated.name}'s details.`);
          setUserModalOpen(false);
        } else {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to update user.');
        }
      } else {
        // Add new staff
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            email: formEmail.trim().toLowerCase(),
            phone: formPhone.trim() || null,
            role: formRole,
            password: formPassword.trim() || 'password123',
            active: formActive,
          }),
        });

        if (res.ok) {
          const created = await res.json();
          setUsers((prev) => [created, ...prev]);
          toast.success(`Staff member ${created.name} registered successfully!`);
          setUserModalOpen(false);
        } else {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to create staff member.');
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setModalSaving(false);
    }
  }

  // Open Password Reset Modal
  function handleOpenResetPassword(user: User) {
    setTargetUser(user);
    setNewPassword('');
    setShowNewPassword(false);
    setResetModalOpen(true);
  }

  // Submit Password Reset
  async function handleResetPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetUser) return;
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    setResetSaving(true);
    try {
      const res = await fetch(`/api/users/${targetUser.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: newPassword.trim() }),
      });

      if (res.ok) {
        toast.success(`Password for ${targetUser.name} has been reset.`);
        setResetModalOpen(false);
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to reset password.');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error resetting password.');
    } finally {
      setResetSaving(false);
    }
  }

  // Open Delete Modal
  function handleOpenDelete(user: User) {
    if (currentUser && currentUser.id === user.id) {
      toast.error('You cannot delete your own account.');
      return;
    }
    setUserToDelete(user);
    setDeleteModalOpen(true);
  }

  // Confirm Delete
  async function handleConfirmDelete() {
    if (!userToDelete) return;
    setDeleteSaving(true);
    try {
      const res = await fetch(`/api/users/${userToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(`Removed ${userToDelete.name} from staff.`);
        setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
        setDeleteModalOpen(false);
      } else {
        throw new Error('Failed to delete staff member.');
      }
    } catch {
      toast.error('Could not delete staff member.');
    } finally {
      setDeleteSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header and KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total Staff */}
        <div className="rounded-xl border border-charcoal-700/80 bg-charcoal-800/80 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-steel-400">Total Staff</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-steel-700/30 text-steel-300">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-steel-100">{stats.total}</p>
          <p className="mt-1 text-xs text-steel-400">{stats.activeCount} Active · {stats.inactiveCount} Inactive</p>
        </div>

        {/* Admins */}
        <div className="rounded-xl border border-amber-500/20 bg-charcoal-800/80 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-amber-400/90">Admins</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
              <Shield className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-300">{stats.admins}</p>
          <p className="mt-1 text-xs text-steel-400">Full Workshop Control</p>
        </div>

        {/* Managers */}
        <div className="rounded-xl border border-blue-500/20 bg-charcoal-800/80 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-blue-400/90">Managers</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
              <Briefcase className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-300">{stats.managers}</p>
          <p className="mt-1 text-xs text-steel-400">Orders, Stock & Billing</p>
        </div>

        {/* Workers */}
        <div className="rounded-xl border border-emerald-500/20 bg-charcoal-800/80 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-emerald-400/90">Workers</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <HardHat className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-300">{stats.workers}</p>
          <p className="mt-1 text-xs text-steel-400">Shop Floor Execution</p>
        </div>
      </div>

      {/* Control Bar: Search, Filters, and Add Staff */}
      <div className="flex flex-col gap-3 rounded-xl border border-charcoal-700/80 bg-charcoal-800/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff by name, email or phone…"
            className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 py-2 pl-9 pr-3 text-sm text-steel-100 placeholder-steel-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
          />
        </div>

        {/* Filters and Add button */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Role pills */}
          <div className="inline-flex rounded-lg border border-charcoal-700 bg-charcoal-900 p-0.5 text-xs">
            {(['all', 'admin', 'manager', 'worker'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`rounded-md px-2.5 py-1 font-medium capitalize transition-colors ${
                  roleFilter === r
                    ? 'bg-amber-500 text-charcoal-950 font-bold shadow'
                    : 'text-steel-400 hover:text-steel-200'
                }`}
              >
                {r === 'all' ? 'All Roles' : r}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-lg border border-charcoal-700 bg-charcoal-900 px-2.5 py-1.5 text-xs text-steel-300 focus:border-amber-500/50 focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>

          {/* Add Staff Button */}
          <Button onClick={handleOpenAdd} size="sm">
            <UserPlus className="h-4 w-4" /> Add Staff Member
          </Button>
        </div>
      </div>

      {/* Staff Grid */}
      {loading ? (
        <LoadingState label="Loading staff directory…" />
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10 text-steel-500" />}
          title="No staff members found"
          message={search || roleFilter !== 'all' ? 'Try adjusting your search or filters.' : 'Add your first staff member to get started.'}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredUsers.map((u) => {
            const roleCfg = roleConfigs[u.role] || roleConfigs.worker;
            const RoleIcon = roleCfg.icon;
            const isSelf = currentUser?.id === u.id;

            return (
              <div
                key={u.id}
                className={`flex flex-col justify-between rounded-xl border transition-all ${
                  u.active
                    ? 'border-charcoal-700/80 bg-charcoal-800/80 hover:border-charcoal-600 shadow-lg'
                    : 'border-red-900/30 bg-charcoal-900/60 opacity-80'
                }`}
              >
                {/* Card Top: Avatar, Name, Role Badge, Self Tag */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold uppercase ring-1 ${
                          u.role === 'admin'
                            ? 'bg-amber-500/20 text-amber-300 ring-amber-500/40'
                            : u.role === 'manager'
                            ? 'bg-blue-500/20 text-blue-300 ring-blue-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/40'
                        }`}
                      >
                        {u.name.substring(0, 2)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="truncate text-sm font-semibold text-steel-100">{u.name}</h4>
                          {isSelf && (
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-bold text-amber-400 ring-1 ring-amber-500/30">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-steel-400 truncate">{u.email || 'No email registered'}</p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      {u.active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 ring-1 ring-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-400 ring-1 ring-red-500/20">
                          <XCircle className="h-3 w-3" /> Inactive
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Role and Permissions Description */}
                  <div className="mt-3.5 rounded-lg border border-charcoal-700/60 bg-charcoal-900/60 p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <RoleIcon className={`h-3.5 w-3.5 ${roleCfg.colorClass}`} />
                        <span className="text-xs font-bold text-steel-200">{roleCfg.label} Role</span>
                      </div>
                      {/* Inline Role Selector */}
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                        disabled={isSelf && u.role === 'admin'}
                        className="rounded border border-charcoal-700 bg-charcoal-800 px-1.5 py-0.5 text-[11px] font-semibold text-steel-200 focus:border-amber-500 focus:outline-none"
                      >
                        <option value="worker">Worker</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <p className="text-[11px] leading-tight text-steel-400">{roleCfg.description}</p>
                  </div>

                  {/* Contact Info: Phone */}
                  <div className="mt-3 flex items-center justify-between text-xs text-steel-400">
                    <div className="flex items-center gap-1 truncate">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-steel-500" />
                      <span>{u.phone || 'No phone set'}</span>
                    </div>
                    <span className="text-[10px] text-steel-500">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : ''}
                    </span>
                  </div>
                </div>

                {/* Card Actions Bottom Toolbar */}
                <div className="flex items-center justify-between border-t border-charcoal-700/70 bg-charcoal-900/40 px-3 py-2">
                  {/* Status Toggle Switch */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(u)}
                    disabled={isSelf}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                      u.active
                        ? 'text-steel-400 hover:text-amber-400 hover:bg-amber-500/10'
                        : 'text-emerald-400 hover:bg-emerald-500/10'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                    title={isSelf ? 'Cannot deactivate self' : u.active ? 'Click to deactivate' : 'Click to activate'}
                  >
                    {u.active ? 'Deactivate' : 'Activate Account'}
                  </button>

                  {/* Icon Actions: Password Reset, Edit, Delete */}
                  <div className="flex items-center gap-1">
                    {/* Reset Password */}
                    <button
                      type="button"
                      onClick={() => handleOpenResetPassword(u)}
                      className="rounded-lg p-1.5 text-steel-400 hover:bg-amber-500/15 hover:text-amber-300 transition-colors"
                      title="Reset Staff Password"
                    >
                      <Key className="h-4 w-4" />
                    </button>

                    {/* Edit Details */}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(u)}
                      className="rounded-lg p-1.5 text-steel-400 hover:bg-charcoal-700 hover:text-steel-200 transition-colors"
                      title="Edit Staff Information"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    {/* Delete Staff */}
                    <button
                      type="button"
                      onClick={() => handleOpenDelete(u)}
                      disabled={isSelf}
                      className="rounded-lg p-1.5 text-steel-400 hover:bg-red-500/15 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title={isSelf ? 'Cannot delete your own account' : 'Remove Staff Member'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT USER MODAL */}
      {/* ========================================================================= */}
      {userModalOpen && (
        <Modal
          open={userModalOpen}
          onClose={() => setUserModalOpen(false)}
          title={editingUser ? `Edit Staff: ${editingUser.name}` : 'Add New Staff Member'}
        >
          <form onSubmit={handleSaveUser} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-steel-300">Full Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                required
                className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-steel-300">Email Address *</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="rahul@steelworks.com"
                  required={!editingUser}
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-steel-300">Phone / WhatsApp</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 px-3 py-2 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-steel-300">Workshop Role *</label>
              <div className="grid grid-cols-3 gap-2">
                {(['worker', 'manager', 'admin'] as const).map((r) => {
                  const cfg = roleConfigs[r];
                  const Icon = cfg.icon;
                  const isSelected = formRole === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setFormRole(r)}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border p-2.5 text-center transition-all ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40'
                          : 'border-charcoal-700 bg-charcoal-900/60 text-steel-400 hover:border-charcoal-600 hover:text-steel-200'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-xs font-bold capitalize">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Password field */}
            <div>
              <label className="mb-1 block text-xs font-medium text-steel-300">
                {editingUser ? 'Change Password (leave blank to keep current)' : 'Initial Password *'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={editingUser ? '••••••••' : 'Minimum 6 characters'}
                  required={!editingUser}
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 py-2 pl-3 pr-10 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-steel-500 hover:text-steel-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Active checkbox */}
            <label className="flex items-center gap-2 text-xs font-medium text-steel-300 pt-1">
              <input
                type="checkbox"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
                className="h-4 w-4 rounded border-charcoal-600 bg-charcoal-900 text-amber-500 focus:ring-amber-500/30"
              />
              Account active (can log in and access workshop)
            </label>

            <div className="flex justify-end gap-2 border-t border-charcoal-700/60 pt-4">
              <Button type="button" variant="secondary" onClick={() => setUserModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={modalSaving}>
                {editingUser ? 'Save Changes' : 'Create Staff Member'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* RESET PASSWORD MODAL */}
      {/* ========================================================================= */}
      {resetModalOpen && targetUser && (
        <Modal
          open={resetModalOpen}
          onClose={() => setResetModalOpen(false)}
          title={`Reset Password for ${targetUser.name}`}
        >
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <Key className="h-4 w-4" /> Administrator Password Reset
              </div>
              <p>
                Setting a new password for <span className="font-semibold text-white">{targetUser.name}</span> ({targetUser.email}).
                They will immediately use this new password to sign in.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-steel-300">New Password (min 6 chars) *</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new secure password"
                  required
                  className="w-full rounded-lg border border-charcoal-700 bg-charcoal-900 py-2 pl-3 pr-10 text-sm text-steel-100 placeholder-steel-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-steel-500 hover:text-steel-300"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Quick Generator Button */}
            <div className="flex justify-start">
              <button
                type="button"
                onClick={() => {
                  const generated = 'SW' + Math.floor(100000 + Math.random() * 900000);
                  setNewPassword(generated);
                  setShowNewPassword(true);
                  toast.success(`Generated password: ${generated}`);
                }}
                className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 hover:underline"
              >
                <Sparkles className="h-3.5 w-3.5" /> Auto-generate temporary password
              </button>
            </div>

            <div className="flex justify-end gap-2 border-t border-charcoal-700/60 pt-4">
              <Button type="button" variant="secondary" onClick={() => setResetModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={resetSaving}>
                <Check className="h-4 w-4" /> Confirm & Reset Password
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRM MODAL */}
      {/* ========================================================================= */}
      {deleteModalOpen && userToDelete && (
        <Modal
          open={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          title="Remove Staff Member"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
              <div>
                <p className="font-bold text-red-200">Are you sure you want to delete this staff account?</p>
                <p className="mt-1">
                  User <span className="font-semibold text-white">{userToDelete.name}</span> ({userToDelete.email})
                  will lose access to the workshop portal permanently.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-charcoal-700/60 pt-4">
              <Button type="button" variant="secondary" onClick={() => setDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={deleteSaving}
                onClick={handleConfirmDelete}
              >
                <Trash2 className="h-4 w-4" /> Yes, Remove Staff Member
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
