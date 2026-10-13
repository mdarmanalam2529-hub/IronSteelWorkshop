# SteelWorks Manager - Metal Fabrication & Workshop Management System

A full-stack, enterprise-grade Workshop Management and ERP solution tailored for metal fabrication, welding, steelworks, and industrial workshops. Built with React, TypeScript, Tailwind CSS, and a fast local SQLite / Node.js Express backend.

---

## 🚀 Key Features

- **📊 Workshop Dashboard**:
  - Live performance overview: Active Jobs, Completed Work, Payments Received, and Outstanding Balances.
  - 7-Day Revenue & Orders Analytics area chart.
  - Low-stock inventory alert banners and recent order activity feed.

- **👥 Customer Profile Management**:
  - Customer directory with search, filter (recent, name, city), and quick WhatsApp link.
  - Comprehensive customer detail view with order history, payment history, and financial statistics.
  - Edit and update customer contact details seamlessly.

- **📦 Job & Order Tracking**:
  - Track orders with statuses (*Pending, Active, Completed, Cancelled*) and priorities (*Low, Medium, High, Urgent*).
  - Advance payment tracking with automatic ledger recording.
  - Automatic inventory material deduction prompt when a job is completed.
  - 1-Click WhatsApp order status updates to clients.
  - Attach technical drawings, reference photos, and exact measurements (length, width, height, unit).

- **🧾 Indian GST-Compliant Invoicing**:
  - Create full, milestone, or advance payment invoices.
  - Automatic CGST (50%) + SGST (50%) split or interstate IGST calculation.
  - Tax inclusive / exclusive pricing options with automatic round-off.
  - Integrated HSN / SAC code directory for fabrication.
  - Professional PDF invoice generation and direct browser printing.
  - Share invoice summaries directly on WhatsApp.
  - Invoice version tracking and archive/recovery capabilities.

- **💳 Payments Ledger**:
  - Log customer payments across cash, UPI / bank transfer, card, or cheque.
  - Automatic balance due calculation and order synchronization.
  - Track pending, paid, and overdue balances.

- **📈 Raw Materials & Inventory Control**:
  - Stock level tracking with units (kg, m, pcs, L).
  - Low-stock threshold alerts (Reorder At).
  - Unit price tracking and total stock valuation.

- **📈 Financial Reports & Analytics**:
  - Financial health dashboard: Revenue collected, outstanding receivables, stock valuation.
  - Order value breakdown by status.
  - Payment status distribution and top customers by contract value.

- **⚙️ Settings, Roles & Backup**:
  - Workshop identity: Name, address, GSTIN, default state, and HSN settings.
  - Staff management: User accounts with roles (*Admin, Manager, Worker*).
  - Automated and manual JSON database backup and restore system with Google Drive integration support.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Recharts, React Hook Form, Zod
- **Backend**: Node.js, Express, Better-SQLite3
- **PDF Generation**: jsPDF, jsPDF-AutoTable
- **Build Tool**: Vite 5

---

## 💻 Getting Started Locally

### Prerequisites
- Node.js (v18 or newer)
- npm or pnpm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/mdarmanalam2529-hub/metalworkshop.git
   cd metalworkshop
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (optional):
   ```bash
   cp .env.example .env
   ```

4. Start both the frontend and backend servers concurrently:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to:
   - **Frontend App**: `http://localhost:5173`
   - **Backend API**: `http://localhost:3001`

---

## 🔑 Demo Login Accounts

On the login page, you can click on the quick demo buttons or enter:
- **Admin**: `frank@steelworks.com` / `password123`
- **Worker**: `jane@steelworks.com` / `password123`

---

## 📄 License
MIT License. Free to use and customize for your workshop.
