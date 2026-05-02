import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
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
  Tag,
  Menu,
  X,
  ShoppingCart,
  Calendar,
  Clock,
  Settings as SettingsIcon,
  Box,
  Shield,
  DollarSign
} from 'lucide-react';
import Inventory from '../components/Inventory';
import Clients from '../components/Clients';
import Suppliers from '../components/Suppliers';
import Categories from '../components/Categories';
import Billing from '../components/Billing';
import POS from '../components/POS';
import Deadlines from '../components/Deadlines';
import CreditHistory from '../components/CreditHistory';
import Settings from '../components/Settings';
import Conversions from '../components/Conversions';
import SalesDashboard from '../components/SalesDashboard';
import Historique from '../components/Historique';
import Decaissement from '../components/Decaissement';

export default function Dashboard({ session }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const activeTab = useMemo(() => {
    const path = location.pathname.split('/').pop();
    if (path === 'dashboard' || !path) return 'dashboard';
    return path;
  }, [location.pathname]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [dashboardSearchTerm, setDashboardSearchTerm] = useState('');
  const [stats, setStats] = useState({
    totalSales: 0,
    stockAlerts: 0,
    paidInvoices: 0,
    pendingInvoices: 0,
    overdueCredits: 0
  });
  const [loading, setLoading] = useState(true);
  const [billingSearchTerm, setBillingSearchTerm] = useState('');
  const [deadlineSearchTerm, setDeadlineSearchTerm] = useState('');
  const [overdueList, setOverdueList] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleLogout = () => supabase.auth.signOut();

  const handleViewClientCredit = (clientName) => {
    setDeadlineSearchTerm(clientName);
    navigate('/dashboard/deadlines');
  };

  const fetchStats = async () => {
    setLoading(true);
    // 1. Get total sales (paid invoices)
    const { data: invoices } = await supabase
      .from('factures')
      .select('total_amount, status');
    
    const paidInvoices = invoices?.filter(inv => inv.status === 'paid') || [];
    const pendingInvoices = invoices?.filter(inv => ['sent', 'unpaid', 'pending'].includes(inv.status)) || [];
    
    const totalSales = paidInvoices.reduce((acc, inv) => acc + (inv.total_amount || 0), 0) || 0;

    // 2. Get stock alerts (quantity < 10)
    const { count: stockAlerts } = await supabase
      .from('produits')
      .select('*', { count: 'exact', head: true })
      .lt('stock_quantity', 10);

    // 3. Get overdue credits
    const today = new Date().toISOString().split('T')[0];
    const { data: overdues } = await supabase
      .from('echeances_details')
      .select('*, factures(number, guest_name, clients(name))')
      .eq('statut', 'non_paye')
      .lt('date_echeance', today);

    setOverdueList(overdues || []);

    setStats({
      totalSales,
      stockAlerts: stockAlerts || 0,
      paidInvoices: paidInvoices.length,
      pendingInvoices: pendingInvoices.length,
      overdueCredits: overdues?.length || 0
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const getTitle = () => {
    switch(activeTab) {
      case 'dashboard': return "Vue d'ensemble";
      case 'pos': return "Caisse / Vente Directe";
      case 'inventory': return "Stock & Denrées";
      case 'clients': return "Clients";
      case 'suppliers': return "Fournisseurs";
      case 'categories': return "Catégories";
      case 'billing': return "Facturation";
      case 'deadlines': return "Échéancier";
      case 'credit_history': return "Historique Crédits";
      case 'settings': return "Paramètres & Utilisateurs";
      default: return "Dashboard";
    }
  };

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="relative min-h-screen flex bg-white font-sans overflow-hidden">
      {/* Background Image (Idem Login) */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.05] bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=2000&auto=format&fit=crop')" }}
      ></div>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-20 lg:hidden"
          onClick={closeSidebar}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-72 bg-white/90 lg:bg-white/40 backdrop-blur-xl border-r border-emerald-50 flex flex-col transform transition-transform duration-300 ease-in-out h-full overflow-y-auto ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-8">
          <div className="flex items-center justify-between mb-10">
            <div onClick={() => navigate('/dashboard')} className="cursor-pointer flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                <span className="text-white text-xl font-bold">+</span>
              </div>
              <h1 className="text-xl font-bold text-gray-800 tracking-tight">Gestock<span className="text-emerald-500">PPN</span></h1>
            </div>
            <button className="lg:hidden text-gray-400 hover:text-emerald-500" onClick={closeSidebar}>
              <X size={24} />
            </button>
          </div>

          <nav className="space-y-8">
            {/* GROUPE 1: Caisse & Ventes */}
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-4">Caisse & Ventes</p>
              <div className="space-y-1">
                <NavItem icon={<LayoutDashboard size={20} />} label="Tableau de bord" active={activeTab === 'dashboard'} onClick={() => { navigate('/dashboard'); closeSidebar(); }} />
                <NavItem icon={<ShoppingCart size={20} />} label="Caisse (POS)" active={activeTab === 'pos'} onClick={() => { navigate('/dashboard/pos'); closeSidebar(); }} />
                <NavItem icon={<TrendingUp size={20} />} label="Analyse Ventes" active={activeTab === 'sales-analytics'} onClick={() => { navigate('/dashboard/sales-analytics'); closeSidebar(); }} />
              </div>
            </div>

            {/* GROUPE 2: Gestion Financière */}
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-4">Gestion Financière</p>
              <div className="space-y-1">
                <NavItem icon={<FileText size={20} />} label="Facturation" active={activeTab === 'billing'} onClick={() => { navigate('/dashboard/billing'); closeSidebar(); }} />
                <NavItem icon={<Calendar size={20} />} label="Échéancier" active={activeTab === 'deadlines'} onClick={() => { navigate('/dashboard/deadlines'); closeSidebar(); }} />
                <NavItem icon={<Clock size={20} />} label="Crédits" active={activeTab === 'credit_history'} onClick={() => { navigate('/dashboard/credit_history'); closeSidebar(); }} />
                <NavItem icon={<DollarSign size={20} />} label="Décaissements" active={activeTab === 'decaissement'} onClick={() => { navigate('/dashboard/decaissement'); closeSidebar(); }} />
              </div>
            </div>

            {/* GROUPE 3: Stock & Logistique */}
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-4">Stock & Logistique</p>
              <div className="space-y-1">
                <NavItem icon={<Package size={20} />} label="Inventaire" active={activeTab === 'inventory'} onClick={() => { navigate('/dashboard/inventory'); closeSidebar(); }} />
                <NavItem icon={<Box size={20} />} label="Conversions" active={activeTab === 'conversions'} onClick={() => { navigate('/dashboard/conversions'); closeSidebar(); }} />
                <NavItem icon={<Tag size={20} />} label="Catégories" active={activeTab === 'categories'} onClick={() => { navigate('/dashboard/categories'); closeSidebar(); }} />
              </div>
            </div>

            {/* GROUPE 4: Système */}
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-4">Système</p>
              <div className="space-y-1">
                <NavItem icon={<SettingsIcon size={20} />} label="Paramètres" active={activeTab === 'settings'} onClick={() => { navigate('/dashboard/settings'); closeSidebar(); }} />
                <NavItem icon={<Shield size={20} />} label="Historique" active={activeTab === 'historique'} onClick={() => { navigate('/dashboard/historique'); closeSidebar(); }} />
              </div>
            </div>
          </nav>
        </div>

        <div className="mt-auto p-8 border-t border-emerald-50">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold">
              {session.user.email[0].toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-gray-800 truncate">{session.user.email.split('@')[0]}</p>
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Gestionnaire Stock</p>
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
        <header className="h-20 bg-white/20 backdrop-blur-md border-b border-emerald-50 px-4 md:px-8 flex justify-between items-center shrink-0 z-50">
          <div className="flex items-center gap-4">
            <button
              className="p-2 text-gray-500 hover:bg-emerald-50 rounded-lg transition-colors"
              onClick={() => setIsSidebarOpen(true)}
            >              <Menu size={24} />
            </button>
            <h2 className="text-lg md:text-xl font-bold text-gray-800 capitalize truncate">
              {getTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <div className="relative w-40 md:w-64 hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Rechercher..."
                className="w-full bg-emerald-50/30 border border-emerald-100 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
                value={dashboardSearchTerm}
                onChange={(e) => setDashboardSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative">
              <button 
                className="relative text-gray-400 hover:text-emerald-500 p-2 transition-colors" 
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell size={20} />
                {stats.overdueCredits > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                    {stats.overdueCredits}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-emerald-50 overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2">
                  <div className="p-4 border-b border-emerald-50 flex justify-between items-center bg-emerald-50/30">
                    <h4 className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Alertes de Retard</h4>
                    <button onClick={() => setShowNotifications(false)}><X size={14} className="text-gray-400" /></button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {overdueList.length > 0 ? overdueList.map((item) => (
                      <div 
                        key={item.id} 
                        onClick={() => {
                          handleViewClientCredit(item.factures?.clients?.name || item.factures?.guest_name);
                          setShowNotifications(false);
                        }}
                        className="p-4 border-b border-emerald-50 hover:bg-emerald-50/50 cursor-pointer transition-colors"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-xs font-black text-gray-800">{item.factures?.number}</p>
                          <p className="text-[9px] font-black text-red-500 uppercase">{new Date(item.date_echeance).toLocaleDateString()}</p>
                        </div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase truncate">
                          {item.factures?.clients?.name || item.factures?.guest_name || 'Client Direct'}
                        </p>
                        <p className="text-sm font-black text-emerald-600 mt-1">{item.montant.toLocaleString()} Ar</p>
                      </div>
                    )) : (
                      <div className="p-10 text-center">
                        <CheckCircle2 size={32} className="text-emerald-200 mx-auto mb-2" />
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Aucun retard détecté</p>
                      </div>
                    )}
                  </div>
                  {overdueList.length > 0 && (
                    <button 
                      onClick={() => { navigate('/dashboard/deadlines'); setShowNotifications(false); }}
                      className="w-full py-3 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors"
                    >
                      Voir tout l'échéancier
                    </button>
                  )}
                </div>
              )}
            </div>
            <button 
              onClick={handleLogout}
              className="lg:hidden p-2 text-gray-400 hover:text-red-500 transition-colors"
              title="Déconnexion"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Dashboard Body */}
        <div className="flex-1 overflow-hidden p-4 md:p-6">
          <Routes>
            <Route path="/" element={
              <div className="h-full overflow-y-auto pr-2 space-y-6 md:space-y-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                  <StatCard 
                    title="Ventes de Produits PPN" 
                    value={`${stats.totalSales.toLocaleString('fr-MG')} MGA`} 
                    trend="+ Actuel" 
                    icon={<TrendingUp className="text-emerald-600" size={24} />} 
                  />
                  <StatCard 
                    title="Alertes Stock PPN" 
                    value={`${stats.stockAlerts} articles`} 
                    trend={stats.stockAlerts > 0 ? "Réapprovisionner" : "Correct"} 
                    negative={stats.stockAlerts > 0} 
                    icon={<AlertCircle className={stats.stockAlerts > 0 ? "text-orange-500" : "text-emerald-500"} size={24} />} 
                  />
                  <StatCard 
                    title={stats.overdueCredits > 0 ? "Crédits en retard" : (stats.pendingInvoices > 0 ? "Échéances en attente" : "Factures payées")} 
                    value={stats.overdueCredits > 0 ? stats.overdueCredits.toString() : (stats.pendingInvoices > 0 ? stats.pendingInvoices.toString() : stats.paidInvoices.toString())} 
                    trend={stats.overdueCredits > 0 ? "Urgent" : (stats.pendingInvoices > 0 ? "À encaisser" : "Historique")} 
                    negative={stats.overdueCredits > 0 || stats.pendingInvoices > 0}
                    icon={stats.overdueCredits > 0 ? <Clock className="text-red-500" size={24} /> : (stats.pendingInvoices > 0 ? <AlertCircle className="text-orange-500" size={24} /> : <CheckCircle2 className="text-emerald-600" size={24} />)} 
                  />
                </div>

                {/* Recent Activity Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
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
                      onClick={() => navigate('/dashboard/inventory')}
                      className="w-full py-3 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-sm hover:bg-emerald-100 transition-colors"
                    >
                      Gérer l'inventaire
                    </button>
                  </div>
                  <div className="bg-white/60 backdrop-blur-md border border-emerald-100 rounded-3xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                      <Calendar size={20} className="text-emerald-500" /> Échéancier & Crédits
                    </h3>
                    <p className="text-gray-400 text-sm text-center py-10">
                      {stats.pendingInvoices > 0 
                        ? `Vous avez ${stats.pendingInvoices} ventes à crédit en attente de paiement.` 
                        : "Toutes vos factures récentes sont réglées."}
                    </p>
                    <button 
                      onClick={() => navigate('/dashboard/deadlines')}
                      className="w-full py-3 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-sm hover:bg-emerald-100 transition-colors"
                    >
                      Voir l'échéancier
                    </button>
                  </div>
                </div>
              </div>
            } />
            <Route path="pos" element={<POS session={session} />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="categories" element={<Categories />} />
            <Route path="clients" element={<Clients onViewCredit={handleViewClientCredit} />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="billing" element={<Billing 
              initialSearchTerm={billingSearchTerm} 
              onSearchReset={() => setBillingSearchTerm('')} 
            />} />
            <Route path="deadlines" element={<Deadlines 
              initialSearchTerm={deadlineSearchTerm}
              onSearchReset={() => setDeadlineSearchTerm('')}
            />} />
            <Route path="credit_history" element={<CreditHistory />} />
            <Route path="decaissement" element={<Decaissement session={session} />} />
            <Route path="sales-analytics" element={<SalesDashboard />} />
            <Route path="historique" element={<Historique />} />
            <Route path="conversions" element={<Conversions session={session} />} />
            <Route path="settings" element={<Settings session={session} />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
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
