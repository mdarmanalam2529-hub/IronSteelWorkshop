import { useState, useEffect } from 'react';
import { Sidebar, type PageId } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { DashboardPage } from '@/pages/DashboardPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { CustomerDetailPage } from '@/pages/CustomerDetailPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { PaymentsPage } from '@/pages/PaymentsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { InvoicesPage } from '@/pages/InvoicesPage';
import { LoginPage } from '@/pages/LoginPage';
import { ProfileModal } from '@/components/admin/ProfileModal';
import { WorkshopSettingsModal } from '@/components/admin/WorkshopSettingsModal';
import { HelpSupportModal } from '@/components/admin/HelpSupportModal';
import { CustomerFormModal, type CustomerFormValues } from '@/components/customers/CustomerFormModal';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { Toaster } from 'react-hot-toast';
import { getSession, setSession, clearSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import type { User, UserRole, Customer } from '@/types';

const pageTitles: Record<PageId, string> = {
  dashboard: 'Dashboard',
  customers: 'Customers',
  orders: 'Orders',
  inventory: 'Inventory',
  payments: 'Payments',
  invoices: 'Invoices',
  reports: 'Reports',
  settings: 'Settings',
};

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [page, setPage] = useState<PageId>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [workshopOpen, setWorkshopOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [savingCustomer, setSavingCustomer] = useState(false);

  useEffect(() => {
    // Check initial session
    const initAuth = async () => {
      let session = null;
      try {
        const res = await supabase.auth.getSession();
        session = res?.data?.session;
      } catch {
        // Supabase offline or unconfigured
      }
      const localSession = getSession();

      if (session?.user && localSession) {
        setCurrentUser(localSession);
      } else if (session?.user && !localSession) {
        // Reconstruct session if missing but supabase is logged in
        const user: User = {
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || null,
          phone: session.user.phone || null,
          role: (session.user.user_metadata?.role as UserRole) || 'worker',
          active: true,
          created_at: session.user.created_at,
        };
        setSession(user);
        setCurrentUser(user);
      } else if (localSession) {
        // Valid local session exists
        setCurrentUser(localSession);
      } else {
        clearSession();
        setCurrentUser(null);
      }
      setAuthChecked(true);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearSession();
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  function handleNavigate(p: PageId) {
    setPage(p);
    setMobileSidebarOpen(false);
    setSearch('');
    setSelectedCustomerId(null);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    clearSession();
    setCurrentUser(null);
    setPage('dashboard');
    setMobileSidebarOpen(false);
    setSearch('');
    setSelectedCustomerId(null);
  }

  function renderPage() {
    if (page === 'customers' && selectedCustomerId) {
      return (
        <CustomerDetailPage
          customerId={selectedCustomerId}
          onBack={() => setSelectedCustomerId(null)}
          onEdit={(customer) => setEditingCustomer(customer)}
        />
      );
    }
    switch (page) {
      case 'dashboard':
        return <DashboardPage onNavigate={handleNavigate} />;
      case 'customers':
        return <CustomersPage search={search} onSelectCustomer={setSelectedCustomerId} />;
      case 'orders':
        return <OrdersPage search={search} />;
      case 'inventory':
        return <InventoryPage search={search} />;
      case 'payments':
        return <PaymentsPage search={search} />;
      case 'invoices':
        return <InvoicesPage search={search} />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage currentUser={currentUser} />;
    }
  }

  const currentTitle =
    page === 'customers' && selectedCustomerId
      ? 'Customer Profile'
      : pageTitles[page];

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-charcoal-600 border-t-amber-400" />
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLogin={setCurrentUser} />;
  }

  return (
    <div className="min-h-screen bg-charcoal-950">
      <Sidebar
        current={page}
        onNavigate={handleNavigate}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />
      <div className="lg:pl-64">
        <TopBar
          title={currentTitle}
          onMenuClick={() => setMobileSidebarOpen(true)}
          search={search}
          onSearchChange={setSearch}
          user={currentUser}
          onProfile={() => setProfileOpen(true)}
          onWorkshopSettings={() => setWorkshopOpen(true)}
          onHelpSupport={() => setHelpOpen(true)}
          onSignOut={handleSignOut}
        />
        <main className="p-4 lg:p-6">{renderPage()}</main>
      </div>

      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        user={currentUser}
        onSaved={(updated) => setCurrentUser(updated)}
      />
      <WorkshopSettingsModal
        open={workshopOpen}
        onClose={() => setWorkshopOpen(false)}
      />
      <HelpSupportModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
      <CustomerFormModal
        open={Boolean(editingCustomer)}
        onClose={() => setEditingCustomer(null)}
        editing={editingCustomer}
        saving={savingCustomer}
        onSave={async (values) => {
          if (!editingCustomer) return;
          setSavingCustomer(true);
          try {
            await api.patch(`customers/${editingCustomer.id}`, values);
            setEditingCustomer(null);
          } catch {}
          finally {
            setSavingCustomer(false);
          }
        }}
      />
      <CommandPalette onNavigate={handleNavigate} />
      <Toaster 
        position="bottom-right" 
        toastOptions={{ 
          style: { 
            background: '#1e293b', 
            color: '#f8fafc', 
            border: '1px solid #334155' 
          } 
        }} 
      />
    </div>
  );
}

export default App;
