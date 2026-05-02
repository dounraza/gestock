import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, Filter, FileText, User } from 'lucide-react';
import { logAction } from '../utils/audit';

export default function SalesDashboard() {
  console.log("SalesDashboard rendu!");
  const [sales, setSales] = useState([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState('all'); 
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchSales();
  }, [filterDate]);

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
        .select('*, clients(name), facture_items(*, produits(name, unite_base, unite_superieure, quantite_par_unite))')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .neq('status', 'draft')
        .neq('status', 'cancelled');
    
    // Apply status filter
    if (filterType === 'paid') query = query.eq('status', 'paid');
    else if (filterType === 'sent') query = query.eq('status', 'sent');
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) console.error("Error fetching sales:", error);
    if (data) setSales(data);
  };

  const totals = useMemo(() => {
    return sales.reduce((acc, sale) => {
        const amount = sale.total_amount || 0;
        if (sale.type === 'CREDIT') acc.credit += amount;
        else acc.cash += amount;
        acc.daily += amount;
        return acc;
    }, { cash: 0, credit: 0, daily: 0 });
  }, [sales]);
const handleCancelInvoice = async (invoice) => {
  if (!window.confirm("Êtes-vous sûr de vouloir annuler cette facture ? Le stock sera restauré.")) return;

  try {
      console.log("Attempting cancellation for invoice:", invoice.id);
      // 1. Restore stock
      for (const item of invoice.facture_items) {
          const { data: product } = await supabase.from('produits').select('stock_quantity').eq('id', item.produit_id).single();
          await supabase.from('produits').update({ stock_quantity: product.stock_quantity + item.quantity }).eq('id', item.produit_id);
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

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
            <h1 className="text-2xl font-black text-slate-800">Tableau de Bord</h1>
            <p className="text-slate-500 font-bold text-sm">Aujourd'hui : {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex gap-2">
            <input type="text" placeholder="Rechercher facture..." onChange={e => setSearchTerm(e.target.value)} className="p-2 rounded-xl border border-slate-200 text-sm" />
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="p-2 rounded-xl border border-slate-200" />
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="p-2 rounded-xl border border-slate-200">
                <option value="all">Toutes les ventes</option>
                <option value="paid">Vente directe</option>
                <option value="sent">Vente à Crédit</option>
            </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-800 text-white p-6 rounded-3xl shadow-lg">
            <h3 className="text-xs uppercase font-black opacity-80">Total Journalier</h3>
            <p className="text-3xl font-black">{totals.daily.toLocaleString()} Ar</p>
        </div>
        <div className="bg-emerald-600 text-white p-6 rounded-3xl shadow-lg">
            <h3 className="text-xs uppercase font-black opacity-80">Total Comptant</h3>
            <p className="text-3xl font-black">{totals.cash.toLocaleString()} Ar</p>
        </div>
        <div className="bg-orange-500 text-white p-6 rounded-3xl shadow-lg">
            <h3 className="text-xs uppercase font-black opacity-80">Total Crédit</h3>
            <p className="text-3xl font-black">{totals.credit.toLocaleString()} Ar</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-black">
                <tr>
                    <th className="p-4">Facture</th>
                    <th className="p-4">Client</th>
                    <th className="p-4">Détails</th>
                    <th className="p-4">Type</th>
                    <th className="p-4 text-right">Total</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {paginatedSales.map(sale => (
                    <tr key={sale.id} className="text-[12px] font-bold text-slate-700">
                        <td className="p-4">{sale.number}</td>
                        <td className="p-4">{sale.clients?.name || 'Anonyme'}</td>
                        <td className="p-4">
                            <button 
                                onClick={() => setSelectedInvoice(sale)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all"
                            >
                                Voir détails
                            </button>
                        </td>
                        <td className="p-4 uppercase font-black text-[10px]">
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
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
            <div className="flex justify-center gap-2 p-4">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="px-4 py-2 bg-slate-100 rounded-lg text-xs font-black">Précédent</button>
                <span className="px-4 py-2 text-xs font-black text-slate-500">Page {currentPage} / {totalPages}</span>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="px-4 py-2 bg-slate-100 rounded-lg text-xs font-black">Suivant</button>
            </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-black text-slate-800">Facture: {selectedInvoice.number}</h3>
                        <p className="text-sm font-bold text-slate-600">Client: {selectedInvoice.clients?.name || selectedInvoice.guest_name || 'Anonyme'}</p>
                        <p className="text-sm font-bold text-slate-600">Contact: {selectedInvoice.guest_contact || 'Non renseigné'}</p>
                    </div>
                    <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-slate-800">Fermer</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
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
                                    <td className="p-2 text-center">{item.quantity}</td>
                                    <td className="p-2 text-center text-[9px] text-slate-500 italic">
                                        {item.produits && item.produits.quantite_par_unite > 1 ? 
                                            `${Math.floor(item.quantity / item.produits.quantite_par_unite)} ${item.produits.unite_superieure || 'Ctn'} + ${item.quantity % item.produits.quantite_par_unite} ${item.produits.unite_base || 'Pce'}` 
                                            : `${item.quantity} ${item.produits?.unite_base || 'Pce'}`
                                        }
                                    </td>
                                    <td className="p-2 text-center text-orange-600">
                                        {item.discount_value ? `${item.discount_value}${item.discount_type || ''}` : '-'}
                                    </td>
                                    <td className="p-2 text-right">{item.price_at_sale?.toLocaleString()} Ar</td>
                                    <td className="p-2 text-right font-black">
                                        {((item.quantity * item.price_at_sale) - (item.discount_value ? (item.discount_type === '%' ? (item.quantity * item.price_at_sale) * (item.discount_value/100) : item.discount_value) : 0)).toLocaleString()} Ar
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                <div className="mt-8 pt-6 border-t border-slate-100">
                    <button 
                        onClick={() => handleCancelInvoice(selectedInvoice)}
                        className="w-full bg-red-600 hover:bg-red-700 text-white p-4 rounded-xl font-black text-sm uppercase shadow-md transition-all"
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
