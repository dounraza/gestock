import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Truck, Search, FileText, ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SupplierCreditHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNotes, setExpandedNotes] = useState({});

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('delivery_notes')
        .select(`
          *,
          fournisseurs (name)
        `)
        .eq('payment_type', 'credit')
        .order('due_date', { ascending: true });

      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const toggleExpand = (id) => {
    setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filtered = history.filter(h => {
    const number = h.bl_number || '';
    const supplier = h.fournisseurs?.name || '';
    return number.toLowerCase().includes(searchTerm.toLowerCase()) ||
           supplier.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white/60 backdrop-blur-md p-3 px-5 rounded-2xl border border-emerald-50 gap-4 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Truck className="text-emerald-600" size={20} /> Crédits Fournisseurs
        </h3>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400" size={16} />
          <input 
            type="text" 
            placeholder="Rechercher..." 
            className="w-full bg-white border border-emerald-100 rounded-xl py-2 pl-9 pr-4 text-xs outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-center py-10 text-gray-400 text-xs font-bold animate-pulse">Chargement...</p>
        ) : filtered.length > 0 ? (
          filtered.map((note) => (
            <div key={note.id} className="bg-white/80 border border-emerald-50 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all">
              <div 
                className="p-4 px-6 cursor-pointer flex flex-wrap items-center justify-between gap-4"
                onClick={() => toggleExpand(note.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                    <Truck size={18} />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-800 text-sm">{note.bl_number}</h4>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{note.fournisseurs?.name || 'Inconnu'}</p>
                  </div>
                </div>

                <div className="flex gap-6 items-center">
                  <div className="text-right">
                    <p className="text-[7px] font-black text-gray-400 uppercase leading-none mb-1">Montant Total</p>
                    <p className="text-[10px] font-black text-gray-900">{note.total_amount.toLocaleString()} Ar</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[7px] font-black text-gray-400 uppercase leading-none mb-1">Échéance</p>
                    <p className={`text-[10px] font-black ${new Date(note.due_date) < new Date() ? 'text-red-500' : 'text-emerald-700'}`}>
                        {new Date(note.due_date).toLocaleDateString()}
                    </p>
                  </div>
                  {expandedNotes[note.id] ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10 bg-white/40 border-2 border-dashed border-emerald-50 rounded-2xl">
            <p className="text-gray-400 font-bold uppercase text-[9px] tracking-widest">Aucun crédit fournisseur</p>
          </div>
        )}
      </div>
    </div>
  );
}
