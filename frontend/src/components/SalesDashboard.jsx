import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, Filter, FileText, User, TrendingUp, ShoppingCart, Clock } from 'lucide-react';
import { logAction } from '../utils/audit';

export default function SalesDashboard() {
  console.log("SalesDashboard rendu!");
  const [sales, setSales] = useState([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState('all'); 
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [adminAuthCode, setAdminAuthCode] = useState('');
  const [dbAdminCode, setDbAdminCode] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [financialStats, setFinancialStats] = useState({
    sales: { global: 0, monthly: 0, daily: 0 },
    purchases: { global: 0, monthly: 0, daily: 0 }
  });

  useEffect(() => {
    fetchSales();
    fetchFinancialStats();
    fetchAdminCode();
  }, [filterDate]);

  const fetchAdminCode = async () => {
    const { data, error } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'admin_code')
        .maybeSingle();
    if (data) setDbAdminCode(data.value);
  };

  const fetchFinancialStats = async () => {
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfToday = new Date(today.setHours(23, 59, 59, 999)).toISOString();
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    
    try {
      // SALES
      const { data: salesData } = await supabase
        .from('factures')
        .select('total_amount, created_at')
        .neq('status', 'cancelled')
        .neq('status', 'draft');

      const salesStats = { global: 0, monthly: 0, daily: 0 };
      salesData?.forEach(s => {
        const amt = parseFloat(s.total_amount) || 0;
        salesStats.global += amt;
        if (s.created_at >= startOfMonth) salesStats.monthly += amt;
        if (s.created_at >= startOfToday && s.created_at <= endOfToday) salesStats.daily += amt;
      });

      // PURCHASES (Calculé comme la simple somme des prix d'achat de tous les produits)
      const { data: productData } = await supabase
        .from('produits')
        .select('purchase_price');

      let totalPurchaseSum = 0;
      productData?.forEach(p => {
        totalPurchaseSum += parseFloat(p.purchase_price) || 0;
      });

      setFinancialStats({
        sales: salesStats,
        purchases: { global: totalPurchaseSum, monthly: 0, daily: 0 } // Historique non disponible
      });
    } catch (err) {
      console.error("Error fetching financial stats:", err);
    }
  };

  // Logic for filtering and pagination
  const filteredSales = useMemo(() => {
      let salesFiltered = sales;
      if (filterType === 'paid') {
          salesFiltered = salesFiltered.filter(s => s.type === 'COMPTANT');
      } else if (filterType === 'sent') {
          salesFiltered = salesFiltered.filter(s => s.type === 'CREDIT');
      }
      return salesFiltered.filter(sale => sale.number.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [sales, searchTerm, filterType]);

  const paginatedSales = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return filteredSales.slice(start, start + itemsPerPage);
  }, [filteredSales, currentPage]);

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);

  const fetchSales = async () => {
    // Get start and end of selected date in UTC
    const startOfDay = new Date(filterDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(filterDate);
    endOfDay.setHours(23, 59, 59, 999);

    let query = supabase
        .from('factures')
        .select('*, clients(name), facture_items(*, produits(name, unite_base, unite_superieure, quantite_par_unite)), paiements(*)')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .neq('status', 'draft')
        .neq('status', 'cancelled');
    
    // Apply status filter
    if (filterType === 'paid') query = query.eq('status', 'paid');
    else if (filterType === 'sent') query = query.eq('status', 'sent');
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) console.error("Error fetching sales:", error);
    if (data) {
        const enrichedSales = data.map(sale => {
            const totalAvance = sale.paiements?.filter(p => p.type_paiement === 'avance').reduce((sum, p) => sum + Number(p.montant), 0) || 0;
            const totalVersement = sale.paiements?.filter(p => p.type_paiement === 'versement').reduce((sum, p) => sum + Number(p.montant), 0) || 0;
            return { ...sale, totalAvance, totalVersement };
        });
        setSales(enrichedSales);
    }
  };

  const totals = useMemo(() => {
    return sales.reduce((acc, sale) => {
        const amount = sale.total_amount || 0;
        const avance = sale.totalAvance || 0;
        if (sale.type === 'CREDIT') acc.credit += amount;
        else acc.cash += amount;
        acc.daily += amount;
        acc.avances += avance;
        return acc;
    }, { cash: 0, credit: 0, daily: 0, avances: 0 });
  }, [sales]);
const handleCancelInvoice = async (invoice) => {
  if (!window.confirm("Êtes-vous sûr de vouloir annuler cette facture ? Le stock sera restauré.")) return;

  try {
      console.log("Attempting cancellation for invoice:", invoice.id);
      
      // 1. Restore stock in the correct depot
      for (const item of invoice.facture_items) {
          // Si depot_id est présent sur la facture, on restaure dans ce dépôt
          if (invoice.depot_id) {
            const { data: depotStock } = await supabase
              .from('stocks')
              .select('id, quantity')
              .eq('product_id', item.produit_id)
              .eq('depot_id', invoice.depot_id)
              .maybeSingle();

            if (depotStock) {
              await supabase.from('stocks')
                .update({ quantity: Number(depotStock.quantity) + Number(item.quantity) })
                .eq('id', depotStock.id);
            } else {
              // Si pas de stock trouvé pour ce produit dans ce dépôt, on l'insère
              await supabase.from('stocks').insert([{
                product_id: item.produit_id,
                depot_id: invoice.depot_id,
                quantity: item.quantity
              }]);
            }
          } else {
            // Fallback pour compatibilité ascendante si depot_id n'est pas sur la facture
            const { data: product } = await supabase.from('produits').select('stock_quantity').eq('id', item.produit_id).single();
            await supabase.from('produits').update({ stock_quantity: product.stock_quantity + item.quantity }).eq('id', item.produit_id);
          }
      }
      // 2. Mark invoice as cancelled
      await supabase.from('factures').update({ status: 'cancelled' }).eq('id', invoice.id);

      console.log("Logging action...");
      await logAction('Annulation Facture', 'SalesDashboard', invoice.id, { number: invoice.number });
      console.log("Action logged.");

      setSelectedInvoice(null);

      fetchSales();
  } catch (e) { 
      console.error("Cancellation error:", e);
      alert(e.message); 
  }
};

  const initiateCloseDay = () => {
    setIsAdminAuthOpen(true);
  };

  const handleCloseDay = async () => {
    if (adminAuthCode !== dbAdminCode) {
        alert("Code administrateur incorrect");
        return;
    }
    
    if (!window.confirm("Êtes-vous sûr de vouloir clôturer la journée du " + filterDate + " ? Cette action enregistrera les totaux actuels.")) return;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('daily_closures').insert([{
            closure_date: filterDate,
            total_cash: totals.cash,
            total_credit: totals.credit,
            total_advances: totals.avances,
            total_journalier: totals.daily,
            user_id: user.id
        }]);
        if (error) throw error;
        alert("Journée clôturée avec succès !");
        setIsAdminAuthOpen(false);
        setAdminAuthCode('');
    } catch (e) {
        alert("Erreur lors de la clôture : " + e.message);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
            <h1 className="text-3xl font-black text-slate-800">Tableau de Bord</h1>
            <p className="text-slate-500 font-bold text-lg">Aujourd'hui : {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex gap-2">
            {new Date().getHours() >= 18 && (
                <button onClick={initiateCloseDay} className="bg-red-600 text-white font-black px-4 py-2 rounded-xl shadow-lg hover:bg-red-700 transition-all uppercase text-base">Clôturer Journée</button>
            )}
            <input type="text" placeholder="Rechercher facture..." onChange={e => setSearchTerm(e.target.value)} className="p-2 rounded-xl border border-slate-200 text-lg" />
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="p-2 rounded-xl border border-slate-200" />
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="p-2 rounded-xl border border-slate-200">
                <option value="all">Toutes les ventes</option>
                <option value="paid">Vente directe</option>
                <option value="sent">Vente à Crédit</option>
            </select>
        </div>
      </div>
      
      {/* Admin Auth Modal */}
      {isAdminAuthOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white p-8 rounded-3xl w-full max-w-sm space-y-6 shadow-2xl">
                <h3 className="text-2xl font-black text-gray-800 uppercase">Autorisation Admin</h3>
                <input 
                    type="password" 
                    placeholder="Code secret" 
                    className="w-full bg-emerald-50 border-2 border-emerald-100 rounded-2xl px-4 py-4 text-2xl font-black outline-none" 
                    value={adminAuthCode} 
                    onChange={e => setAdminAuthCode(e.target.value)} 
                    autoFocus
                />
                <div className="flex gap-3">
                    <button onClick={() => { setIsAdminAuthOpen(false); setAdminAuthCode(''); }} className="flex-1 py-4 font-bold text-gray-400">Annuler</button>
                    <button onClick={handleCloseDay} className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-2xl">Valider</button>
                </div>
            </div>
        </div>
      )}

      {/* Financial Summaries */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Sales */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100">
            <h3 className="text-[13px] font-black uppercase text-emerald-600 tracking-wider mb-2">Ventes (Global/Mois/Jour)</h3>
            <p className="text-2xl font-black text-slate-800">{financialStats.sales.global.toLocaleString()} Ar</p>
            <div className="flex gap-4 mt-2 text-[13px] font-bold text-slate-500">
                <span>Mois: {financialStats.sales.monthly.toLocaleString()}</span>
                <span>Jour: {financialStats.sales.daily.toLocaleString()}</span>
            </div>
        </div>

        {/* Purchases */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-blue-100">
            <h3 className="text-[13px] font-black uppercase text-blue-600 tracking-wider mb-2">Achats (Global/Mois/Jour)</h3>
            <p className="text-2xl font-black text-slate-800">{financialStats.purchases.global.toLocaleString()} Ar</p>
            <div className="flex gap-4 mt-2 text-[13px] font-bold text-slate-500">
                <span>Mois: {financialStats.purchases.monthly.toLocaleString()}</span>
                <span>Jour: {financialStats.purchases.daily.toLocaleString()}</span>
            </div>
        </div>

        {/* Filtered Context */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-[13px] font-black uppercase text-slate-600 tracking-wider mb-2">Filtre (Détails)</h3>
            <p className="text-2xl font-black text-slate-800">{totals.daily.toLocaleString()} Ar</p>
            <div className="grid grid-cols-1 gap-1 mt-2 text-[12px] font-bold text-slate-500">
                <span className="text-emerald-600 font-black">Comptant: {totals.cash.toLocaleString()} Ar</span>
                <span className="text-orange-600 font-black">Crédit: {totals.credit.toLocaleString()} Ar</span>
                <span className="text-blue-600 font-black">Avance: {totals.avances.toLocaleString()} Ar</span>
            </div>
        </div>
        
        {/* Today's Context */}
        <div className="bg-emerald-900 text-white p-6 rounded-3xl shadow-lg">
            <h3 className="text-[13px] font-black uppercase text-emerald-400 tracking-wider mb-2">Total Journalier</h3>
            <p className="text-3xl font-black">{totals.daily.toLocaleString()} Ar</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-4 overflow-y-auto max-h-[70vh]">
        <div className="min-w-[700px]">
        <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-400 uppercase text-[16px] font-black">
                <tr>
                    <th className="p-4">Facture</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Client</th>
                    <th className="p-4">Détails</th>
                    <th className="p-4">Type</th>
                    <th className="p-4 text-right">Total</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {paginatedSales.map(sale => (
                    <tr key={sale.id} className="text-[15px] font-bold text-slate-700">
                        <td className="p-4">{sale.number}</td>
                        <td className="p-4 text-[16px]">
                          {new Date(sale.created_at).toLocaleDateString('fr-FR')} {new Date(sale.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                        </td>
                        <td className="p-4">{sale.clients?.name || sale.guest_name || 'Anonyme'}</td>
                        <td className="p-4">
                            <button 
                                onClick={() => setSelectedInvoice(sale)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded-lg text-[16px] font-black uppercase transition-all"
                            >
                                Voir détails
                            </button>
                        </td>
                        <td className="p-4 uppercase font-black text-[16px]">
                            {sale.type === 'CREDIT' ? (
                                <span className="text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">Crédit</span>
                            ) : (
                                <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">Comptant</span>
                            )}
                        </td>
                        <td className="p-4 text-right">{sale.total_amount.toLocaleString()} Ar</td>
                    </tr>
                ))}
            </tbody>
        </table>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
            <div className="flex justify-center gap-2 p-4">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="px-4 py-2 bg-slate-100 rounded-lg text-base font-black">Précédent</button>
                <span className="px-4 py-2 text-base font-black text-slate-500">Page {currentPage} / {totalPages}</span>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="px-4 py-2 bg-slate-100 rounded-lg text-base font-black">Suivant</button>
            </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-2xl font-black text-slate-800">Facture: {selectedInvoice.number}</h3>
                        <p className="text-lg font-bold text-slate-600">Date: {new Date(selectedInvoice.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-lg font-bold text-slate-600">Client: {selectedInvoice.clients?.name || selectedInvoice.guest_name || 'Anonyme'}</p>
                        <p className="text-lg font-bold text-slate-600">Contact: {selectedInvoice.guest_contact || 'Non renseigné'}</p>
                    </div>
                    <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-slate-800">Fermer</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-base">
                        <thead className="text-slate-400 uppercase font-black border-b border-slate-100">
                            <tr>
                                <th className="p-2">Désignation</th>
                                <th className="p-2 text-center">Qté</th>
                                <th className="p-2 text-center">Unités</th>
                                <th className="p-2 text-center">Remise</th>
                                <th className="p-2 text-right">P.U</th>
                                <th className="p-2 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {selectedInvoice.facture_items?.map(item => (
                                <tr key={item.id} className="text-slate-800 font-bold">
                                    <td className="p-2 uppercase">{item.produits?.name}</td>
                                    <td className="p-2 text-center">{item.quantity || 0}</td>
                                    <td className="p-2 text-center text-[15px] text-slate-500 italic">
                                        {item.produits && item.produits.quantite_par_unite > 1 ? 
                                            `${Math.floor((item.quantity || 0) / item.produits.quantite_par_unite)} ${item.produits.unite_superieure || 'Ctn'} + ${(item.quantity || 0) % item.produits.quantite_par_unite} ${item.produits.unite_base || 'Pce'}` 
                                            : `${item.quantity || 0} ${item.produits?.unite_base || 'Pce'}`
                                        }
                                    </td>
                                    <td className="p-2 text-center text-orange-600">
                                        {item.discount_value ? `${item.discount_value}${item.discount_type || ''}` : '-'}
                                    </td>
                                    <td className="p-2 text-right">{(item.unit_price || 0).toLocaleString()} Ar</td>
                                    <td className="p-2 text-right font-black">
                                        {(( (item.quantity || 0) * (item.unit_price || 0) ) - (item.discount_value ? (item.discount_type === '%' ? ((item.quantity || 0) * (item.unit_price || 0)) * (item.discount_value/100) : item.discount_value) : 0)).toLocaleString()} Ar
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                <div className="mt-8 pt-6 border-t border-slate-100">
                    <div className="flex justify-between items-center mb-4 text-lg font-bold text-slate-700 bg-slate-100 p-3 rounded-xl">
                        <span>Avances totales:</span>
                        <span className="font-black text-emerald-700">{selectedInvoice.totalAvance.toLocaleString()} Ar</span>
                    </div>
                    <div className="flex justify-between items-center mb-4 text-lg font-bold text-slate-700 bg-slate-100 p-3 rounded-xl">
                        <span>Versements totaux:</span>
                        <span className="font-black text-blue-700">{selectedInvoice.totalVersement.toLocaleString()} Ar</span>
                    </div>
                    <button 
                        onClick={() => handleCancelInvoice(selectedInvoice)}
                        className="w-full bg-red-600 hover:bg-red-700 text-white p-4 rounded-xl font-black text-lg uppercase shadow-md transition-all"
                    >
                        Annuler la facture
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
