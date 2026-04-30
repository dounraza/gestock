import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, Filter, FileText, User } from 'lucide-react';

export default function SalesDashboard() {
  const [sales, setSales] = useState([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState('all'); 
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchSales();
  }, [filterDate, filterType]);

  // Logic for filtering and pagination
  const filteredSales = useMemo(() => {
      return sales.filter(sale => sale.number.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [sales, searchTerm]);

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
        .select('*, clients(name), facture_items(*, produits(name))')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .neq('status', 'draft');
    
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
        if (sale.status === 'paid') acc.cash += amount;
        else acc.credit += amount;
        acc.daily += amount;
        return acc;
    }, { cash: 0, credit: 0, daily: 0 });
  }, [sales]);

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
            <select onChange={e => setFilterType(e.target.value)} className="p-2 rounded-xl border border-slate-200">
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
                            {sale.status === 'paid' ? (
                                <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">Comptant</span>
                            ) : (
                                <span className="text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">Crédit</span>
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
                    <h3 className="text-lg font-black text-slate-800">Détails Facture: {selectedInvoice.number}</h3>
                    <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-slate-800">Fermer</button>
                </div>
                <div className="space-y-3">
                    {selectedInvoice.facture_items?.map(item => (
                        <div key={item.id} className="flex justify-between p-3 bg-slate-50 rounded-xl">
                            <div>
                                <p className="font-black text-slate-800">{item.produits?.name}</p>
                                <p className="text-[10px] text-slate-500 font-bold">Qté: {item.quantity} | Prix: {item.price_at_sale?.toLocaleString()} Ar</p>
                            </div>
                            <div className="text-right">
                                <p className="font-black text-slate-800">{((item.quantity * item.price_at_sale) - (item.discount ? (item.discount.type === '%' ? (item.quantity * item.price_at_sale) * (item.discount.value/100) : item.discount.value) : 0)).toLocaleString()} Ar</p>
                                {item.discount && <p className="text-[9px] text-orange-500 font-bold">Remise: {item.discount.value}{item.discount.type}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
