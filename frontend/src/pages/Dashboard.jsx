import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  LogOut, 
  Package, 
  Users, 
  FileText, 
  LayoutDashboard, 
  Search, 
  Bell, 
  Plus,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Truck,
  Tag
} from 'lucide-react';
import Inventory from '../components/Inventory';
import Clients from '../components/Clients';
import Suppliers from '../components/Suppliers';
import Categories from '../components/Categories';
import Billing from '../components/Billing';

export default function Dashboard({ session }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardSearchTerm, setDashboardSearchTerm] = useState('');
  const [stats, setStats] = useState({
    totalSales: 0,
    stockAlerts: 0,
    paidInvoices: 0
  });
  const [loading, setLoading] = useState(true);

  const handleLogout = () => supabase.auth.signOut();

  const fetchStats = async () => {
    setLoading(true);
    // 1. Get total sales (paid invoices today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: invoices } = await supabase
      .from('factures')
      .select('total_amount, status')
      .eq('status', 'paid');
    
    const totalSales = invoices?.reduce((acc, inv) => acc + (inv.total_amount || 0), 0) || 0;
    const paidCount = invoices?.length || 0;

    // 2. Get stock alerts (quantity < 10)
    const { count: stockAlerts } = await supabase
      .from('produits')
      .select('*', { count: 'exact', head: true })
      .lt('stock_quantity', 10);

    setStats({
      totalSales,
      stockAlerts: stockAlerts || 0,
      paidInvoices: paidCount
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const getTitle = () => {
    switch(activeTab) {
      case 'dashboard': return "Vue d'ensemble";
      case 'inventory': return "Stock & Produits";
      case 'clients': return "Clients";
      case 'suppliers': return "Fournisseurs";
      case 'categories': return "Catégories";
      case 'billing': return "Facturation";
      default: return "Dashboard";
    }
  };

  return (
    <div className="relative min-h-screen flex bg-white font-sans overflow-hidden">
      {/* Background Image (Idem Login) */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.05] bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1631549916768-4119b2e5f926?q=80&w=2000&auto=format&fit=crop')" }}
      ></div>

      {/* Sidebar */}
      <aside className="relative z-10 w-72 bg-white/40 backdrop-blur-xl border-r border-emerald-50 flex flex-col">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <span className="text-white text-xl font-bold">+</span>
            </div>
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">Gestock<span className="text-emerald-500">Pharma</span></h1>
          </div>

          <nav className="space-y-2">
            <NavItem 
              icon={<LayoutDashboard size={20} />} 
              label="Vue d'ensemble" 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
            />
            <NavItem 
              icon={<Package size={20} />} 
              label="Stock & Produits" 
              active={activeTab === 'inventory'} 
              onClick={() => setActiveTab('inventory')} 
            />
            <NavItem 
              icon={<Tag size={20} />} 
              label="Catégories" 
              active={activeTab === 'categories'} 
              onClick={() => setActiveTab('categories')} 
            />
            <NavItem 
              icon={<Users size={20} />} 
              label="Clients" 
              active={activeTab === 'clients'} 
              onClick={() => setActiveTab('clients')} 
            />
            <NavItem 
              icon={<Truck size={20} />} 
              label="Fournisseurs" 
              active={activeTab === 'suppliers'} 
              onClick={() => setActiveTab('suppliers')} 
            />
            <NavItem 
              icon={<FileText size={20} />} 
              label="Facturation" 
              active={activeTab === 'billing'} 
              onClick={() => setActiveTab('billing')} 
            />
          </nav>
        </div>

        <div className="mt-auto p-8 border-t border-emerald-50">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold">
              {session.user.email[0].toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-gray-800 truncate">{session.user.email.split('@')[0]}</p>
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Pharmacien</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 text-gray-400 hover:text-red-500 transition-colors w-full group"
          >
            <LogOut size={18} />
            <span className="font-bold text-sm">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white/20 backdrop-blur-md border-b border-emerald-50 px-8 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800 capitalize">
            {getTitle()}
          </h2>

          <div className="flex items-center gap-6">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Rechercher..."
                className="w-full bg-emerald-50/30 border border-emerald-100 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
                value={dashboardSearchTerm}
                onChange={(e) => setDashboardSearchTerm(e.target.value)}
              />
            </div>
            <button className="relative text-gray-400 hover:text-emerald-500" onClick={fetchStats}>
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        {/* Dashboard Body */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                  title="Ventes Totales (Encaissées)" 
                  value={`${stats.totalSales.toLocaleString('fr-MG')} MGA`} 
                  trend="+ Actuel" 
                  icon={<TrendingUp className="text-emerald-600" size={24} />} 
                />
                <StatCard 
                  title="Ruptures / Alertes Stock" 
                  value={`${stats.stockAlerts} articles`} 
                  trend={stats.stockAlerts > 0 ? "Action requise" : "Correct"} 
                  negative={stats.stockAlerts > 0} 
                  icon={<AlertCircle className={stats.stockAlerts > 0 ? "text-orange-500" : "text-emerald-500"} size={24} />} 
                />
                <StatCard 
                  title="Factures payées" 
                  value={stats.paidInvoices.toString()} 
                  trend="Historique" 
                  icon={<CheckCircle2 className="text-emerald-600" size={24} />} 
                />
              </div>

              {/* Recent Activity Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white/60 backdrop-blur-md border border-emerald-100 rounded-3xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <Package size={20} className="text-emerald-500" /> État du Stock
                  </h3>
                  <p className="text-gray-400 text-sm text-center py-10">
                    {stats.stockAlerts > 0 
                      ? `Attention : ${stats.stockAlerts} produits sont en dessous du seuil critique.` 
                      : "Tout votre stock est actuellement suffisant."}
                  </p>
                  <button 
                    onClick={() => setActiveTab('inventory')}
                    className="w-full py-3 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-sm hover:bg-emerald-100 transition-colors"
                  >
                    Gérer l'inventaire
                  </button>
                </div>
                <div className="bg-white/60 backdrop-blur-md border border-emerald-100 rounded-3xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <FileText size={20} className="text-emerald-500" /> Facturation
                  </h3>
                  <p className="text-gray-400 text-sm text-center py-10">
                    {stats.paidInvoices} factures ont été marquées comme payées au total.
                  </p>
                  <button 
                    onClick={() => setActiveTab('billing')}
                    className="w-full py-3 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-sm hover:bg-emerald-100 transition-colors"
                  >
                    Voir les factures
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'inventory' && <Inventory />}
          {activeTab === 'categories' && <Categories />}
          {activeTab === 'clients' && <Clients />}
          {activeTab === 'suppliers' && <Suppliers />}
          {activeTab === 'billing' && <Billing />}
        </div>
      </main>
    </div>
  );
}



function NavItem({ icon, label, active = false, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all w-full text-left ${
        active 
          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' 
          : 'text-gray-500 hover:bg-emerald-50 hover:text-emerald-600'
      }`}
    >
      {icon}
      <span className="font-bold text-sm tracking-tight">{label}</span>
    </button>
  );
}

function StatCard({ title, value, trend, icon, negative = false }) {
  return (
    <div className="bg-white/60 backdrop-blur-md border border-emerald-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 bg-white/80 rounded-2xl flex items-center justify-center shadow-sm">
          {icon}
        </div>
        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg ${
          negative ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'
        }`}>
          {trend}
        </span>
      </div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-2xl font-black text-gray-800 mt-1">{value}</p>
    </div>
  );
}
