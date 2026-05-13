import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Search, 
  Printer, 
  Filter, 
  ChevronDown, 
  Package, 
  User, 
  Calendar,
  Truck,
  FileText,
  Loader2
} from 'lucide-react';

export default function StockEntry() {
  const [activeTab, setActiveTab] = useState('with-supplier');
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [withSupplierData, setWithSupplierData] = useState([]);
  const [withoutSupplierData, setWithoutSupplierData] = useState([]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'with-supplier') {
        const { data, error } = await supabase
          .from('delivery_note_items')
          .select(`
            id,
            quantity,
            purchase_price_per_unit,
            line_total_purchase,
            unit,
            created_at,
            delivery_notes (
              bl_number,
              bl_date,
              fournisseurs (
                name
              )
            ),
            produits (
              name,
              categories (
                name
              )
            )
          `)
          .gte('created_at', `${startDate}T00:00:00`)
          .lte('created_at', `${endDate}T23:59:59`)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setWithSupplierData(data || []);
      } else {
        const { data, error } = await supabase
          .from('stock_movements')
          .select(`
            id,
            quantity,
            price_at_movement,
            reason,
            created_at,
            unit,
            produits:product_id (
              name
            )
          `)
          .eq('type', 'in')
          .is('delivery_note_id', null)
          .gte('created_at', `${startDate}T00:00:00`)
          .lte('created_at', `${endDate}T23:59:59`)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setWithoutSupplierData(data || []);
      }
    } catch (err) {
      console.error("Error fetching stock entries:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header & Filters */}
      <div className="bg-white/60 backdrop-blur-md border border-emerald-100 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <Package className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-800 tracking-tight">Entrées de Stock</h1>
              <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest mt-1">Gestion des approvisionnements</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
            <div className="flex items-center gap-2 bg-white rounded-2xl border border-emerald-100 p-2 shadow-sm">
              <div className="flex items-center gap-2 px-3">
                <Calendar size={16} className="text-emerald-500" />
                <span className="text-[10px] font-black text-gray-400 uppercase">De</span>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-none text-sm font-bold text-gray-700 outline-none" 
                />
              </div>
              <div className="w-px h-8 bg-emerald-50"></div>
              <div className="flex items-center gap-2 px-3">
                <span className="text-[10px] font-black text-gray-400 uppercase">À</span>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border-none text-sm font-bold text-gray-700 outline-none" 
                />
              </div>
            </div>
            
            <button 
              onClick={fetchData}
              className="px-6 py-3 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-2"
            >
              <Search size={16} /> Valider
            </button>
            
            <button 
              onClick={handlePrint}
              className="px-6 py-3 bg-white border-2 border-emerald-600 text-emerald-600 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-emerald-50 active:scale-95 transition-all flex items-center gap-2"
            >
              <Printer size={16} /> Imprimer
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-emerald-50/50 p-1.5 rounded-[2rem] border border-emerald-100 max-w-md">
        <button 
          onClick={() => setActiveTab('with-supplier')}
          className={`flex-1 py-3.5 rounded-3xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'with-supplier' ? 'bg-white text-emerald-600 shadow-xl shadow-emerald-200/50 border border-emerald-50' : 'text-emerald-400 hover:text-emerald-600'}`}
        >
          Avec Fournisseur
        </button>
        <button 
          onClick={() => setActiveTab('without-supplier')}
          className={`flex-1 py-3.5 rounded-3xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'without-supplier' ? 'bg-white text-emerald-600 shadow-xl shadow-emerald-200/50 border border-emerald-50' : 'text-emerald-400 hover:text-emerald-600'}`}
        >
          Sans Fournisseur
        </button>
      </div>

      {/* Table Area */}
      <div className="bg-white/60 backdrop-blur-md border border-emerald-100 rounded-[2.5rem] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-emerald-500" size={40} />
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Chargement des données...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {activeTab === 'with-supplier' ? (
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-emerald-50/50">
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100">Date</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100">N° Fact Frns</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100">N° BL</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100">Désignation</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100 text-center">Qté</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100">Unité</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100 text-right">P.A.U</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100 text-right">P.A.T</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100">Dépôt</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100">Famille</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50">
                  {withSupplierData.length > 0 ? withSupplierData.map((item) => (
                    <tr key={item.id} className="hover:bg-emerald-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-700">{new Date(item.delivery_notes?.bl_date || item.created_at).toLocaleDateString()}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-gray-400 italic">Non spécifié</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase">
                          {item.delivery_notes?.bl_number || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-700">{item.produits?.name}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <p className="text-sm font-black text-emerald-600">{item.quantity}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{item.unit === 'base' ? 'Unité' : (item.unit || 'Unité')}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-sm font-bold text-gray-700">{parseFloat(item.purchase_price_per_unit).toLocaleString()} Ar</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-sm font-black text-emerald-700">{parseFloat(item.line_total_purchase).toLocaleString()} Ar</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Magasin Principal</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.produits?.categories?.name || 'Standard'}</p>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="10" className="p-20 text-center text-gray-400 font-bold uppercase text-[10px] tracking-widest">Aucune donnée trouvée</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-emerald-50/50">
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100">Dates</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100">N° BL</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100">Désignation</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100 text-center">Qté</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100">Unité</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100 text-right">P.A.U</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100 text-right">P.A.T</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100">Dépôt Destination</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50">
                  {withoutSupplierData.length > 0 ? withoutSupplierData.map((item) => (
                    <tr key={item.id} className="hover:bg-emerald-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-700">{new Date(item.created_at).toLocaleDateString()}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase">
                          {item.reason && item.reason.includes('BL') ? item.reason.split('#')[1] || '-' : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-700">{item.produits?.name}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <p className="text-sm font-black text-emerald-600">{item.quantity}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{item.unit || 'Unité'}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-sm font-bold text-gray-700">{(item.price_at_movement || 0).toLocaleString()} Ar</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-sm font-black text-emerald-700">{(item.quantity * (item.price_at_movement || 0)).toLocaleString()} Ar</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Magasin Principal</p>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="7" className="p-20 text-center text-gray-400 font-bold uppercase text-[10px] tracking-widest">Aucune donnée trouvée</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .bg-white\/60 { background: white !important; border: none !important; }
          .bg-emerald-50\/50 { background: white !important; }
          table, th, td { border: 1px solid #e2e8f0 !important; }
          .overflow-hidden { overflow: visible !important; }
          .overflow-x-auto { overflow: visible !important; }
          .min-w-\[1000px\], .min-w-\[800px\] { min-width: 100% !important; }
          .bg-emerald-600 { color: black !important; background: none !important; }
          .text-emerald-600, .text-emerald-700, .text-emerald-800 { color: black !important; }
          
          /* Show only the table area when printing */
          .overflow-x-auto, .overflow-x-auto * { visibility: visible; }
          .overflow-x-auto { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
