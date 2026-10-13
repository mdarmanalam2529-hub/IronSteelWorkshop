import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { Search, LayoutDashboard, Users, Wrench, Package, CreditCard, FileText, BarChart3, Settings } from 'lucide-react';
import { type PageId } from '@/components/layout/Sidebar';

interface CommandPaletteProps {
  onNavigate: (page: PageId) => void;
}

export function CommandPalette({ onNavigate }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-24 backdrop-blur-sm">
      <div 
        className="fixed inset-0" 
        onClick={() => setOpen(false)} 
      />
      <Command 
        className="relative z-50 w-full max-w-lg overflow-hidden rounded-xl border border-charcoal-700 bg-charcoal-900 shadow-2xl"
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      >
        <div className="flex items-center border-b border-charcoal-800 px-3" cmdk-input-wrapper="">
          <Search className="mr-2 h-5 w-5 shrink-0 text-steel-400" />
          <Command.Input 
            autoFocus
            placeholder="Type a command or search..." 
            className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm text-steel-100 outline-none placeholder:text-steel-500"
          />
        </div>
        <Command.List className="max-h-[300px] overflow-y-auto overflow-x-hidden p-2 text-sm text-steel-300">
          <Command.Empty className="py-6 text-center text-sm text-steel-500">
            No results found.
          </Command.Empty>
          
          <Command.Group heading="Navigation" className="px-2 py-1.5 text-xs font-medium text-steel-400">
            <Command.Item 
              onSelect={() => { onNavigate('dashboard'); setOpen(false); }}
              className="flex cursor-pointer select-none items-center rounded-md px-2 py-2.5 text-sm outline-none hover:bg-charcoal-800 hover:text-amber-400 data-[selected=true]:bg-charcoal-800 data-[selected=true]:text-amber-400"
            >
              <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
            </Command.Item>
            <Command.Item 
              onSelect={() => { onNavigate('customers'); setOpen(false); }}
              className="flex cursor-pointer select-none items-center rounded-md px-2 py-2.5 text-sm outline-none hover:bg-charcoal-800 hover:text-amber-400 data-[selected=true]:bg-charcoal-800 data-[selected=true]:text-amber-400"
            >
              <Users className="mr-2 h-4 w-4" /> Customers
            </Command.Item>
            <Command.Item 
              onSelect={() => { onNavigate('orders'); setOpen(false); }}
              className="flex cursor-pointer select-none items-center rounded-md px-2 py-2.5 text-sm outline-none hover:bg-charcoal-800 hover:text-amber-400 data-[selected=true]:bg-charcoal-800 data-[selected=true]:text-amber-400"
            >
              <Wrench className="mr-2 h-4 w-4" /> Orders
            </Command.Item>
            <Command.Item 
              onSelect={() => { onNavigate('inventory'); setOpen(false); }}
              className="flex cursor-pointer select-none items-center rounded-md px-2 py-2.5 text-sm outline-none hover:bg-charcoal-800 hover:text-amber-400 data-[selected=true]:bg-charcoal-800 data-[selected=true]:text-amber-400"
            >
              <Package className="mr-2 h-4 w-4" /> Inventory
            </Command.Item>
            <Command.Item 
              onSelect={() => { onNavigate('payments'); setOpen(false); }}
              className="flex cursor-pointer select-none items-center rounded-md px-2 py-2.5 text-sm outline-none hover:bg-charcoal-800 hover:text-amber-400 data-[selected=true]:bg-charcoal-800 data-[selected=true]:text-amber-400"
            >
              <CreditCard className="mr-2 h-4 w-4" /> Payments
            </Command.Item>
            <Command.Item 
              onSelect={() => { onNavigate('invoices'); setOpen(false); }}
              className="flex cursor-pointer select-none items-center rounded-md px-2 py-2.5 text-sm outline-none hover:bg-charcoal-800 hover:text-amber-400 data-[selected=true]:bg-charcoal-800 data-[selected=true]:text-amber-400"
            >
              <FileText className="mr-2 h-4 w-4" /> Invoices
            </Command.Item>
            <Command.Item 
              onSelect={() => { onNavigate('reports'); setOpen(false); }}
              className="flex cursor-pointer select-none items-center rounded-md px-2 py-2.5 text-sm outline-none hover:bg-charcoal-800 hover:text-amber-400 data-[selected=true]:bg-charcoal-800 data-[selected=true]:text-amber-400"
            >
              <BarChart3 className="mr-2 h-4 w-4" /> Reports
            </Command.Item>
            <Command.Item 
              onSelect={() => { onNavigate('settings'); setOpen(false); }}
              className="flex cursor-pointer select-none items-center rounded-md px-2 py-2.5 text-sm outline-none hover:bg-charcoal-800 hover:text-amber-400 data-[selected=true]:bg-charcoal-800 data-[selected=true]:text-amber-400"
            >
              <Settings className="mr-2 h-4 w-4" /> Settings
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
