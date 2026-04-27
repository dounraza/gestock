import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Clock, CheckCircle2, AlertCircle, Search, FileText, ChevronDown, ChevronUp } from 'lucide-react';

export default function CreditHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedInvoices, setExpandedInvoices] = useState({});
  const [statusFilter, setStatusFilter] = useState('all'); // all, pending, paid

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('echeances_details')
        .select(`
          *,
          factures (
            number,
            guest_name,
            total_amount,
            paid_amount,
            created_at,
            clients (name)
          )
        `)
        .order('date_echeance', { ascending: true });

      if (error) throw error;

      // Groupement par facture
      const grouped = data.reduce((acc, curr) => {
        const factId = curr.facture_id;
        if (!acc[factId]) {
          acc[factId] = {
            id: factId,
            number: curr.factures?.number,
            date: curr.factures?.created_at,
            client: curr.factures?.clients?.name || curr.factures?.guest_name || 'Direct',
            total_amount: curr.factures?.total_amount,
            initial_advance: curr.factures?.paid_amount || 0,
            installments: []
          };
        }
        acc[factId].installments.push(curr);
        return acc;
      }, {});

      setHistory(Object.values(grouped));
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
    setExpandedInvoices(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filtered = history.filter(h => {
    const number = h.number || '';
    const client = h.client || '';
    const matchesSearch = number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    const paidInst = h.installments.filter(i => i.statut === 'paye').length;
    const totalInst = h.installments.length;
    const isFullyPaid = paidInst === totalInst;

    if (statusFilter === 'paid') return isFullyPaid;
    if (statusFilter === 'pending') return !isFullyPaid;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white/60 backdrop-blur-md p-3 px-5 rounded-2xl border border-emerald-50 gap-4 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Clock className="text-emerald-600" size={20} /> Historique Crédits
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

      <div className="flex bg-emerald-50/50 p-1 rounded-2xl border border-emerald-50/50 w-full max-w-sm">
        <button 
          onClick={() => setStatusFilter('all')}
          className={`flex-1 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${statusFilter === 'all' ? 'bg-emerald-600 text-white shadow-lg' : 'text-emerald-600 hover:bg-emerald-50'}`}
        >
          Tous
        </button>
        <button 
          onClick={() => setStatusFilter('pending')}
          className={`flex-1 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${statusFilter === 'pending' ? 'bg-orange-500 text-white shadow-lg' : 'text-orange-500 hover:bg-orange-50'}`}
        >
          En cours
        </button>
        <button 
          onClick={() => setStatusFilter('paid')}
          className={`flex-1 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${statusFilter === 'paid' ? 'bg-blue-600 text-white shadow-lg' : 'text-blue-600 hover:bg-blue-50'}`}
        >
          Soldés
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-center py-10 text-gray-400 text-xs font-bold animate-pulse">Chargement...</p>
        ) : filtered.length > 0 ? (
          filtered.map((inv) => {
            const paidInst = inv.installments.filter(i => i.statut === 'paye').length;
            const totalInst = inv.installments.length;
            const isFullyPaid = paidInst === totalInst;
            const totalPaidFromInst = inv.installments.filter(i => i.statut === 'paye').reduce((sum, i) => sum + i.montant, 0);
            const currentTotalPaid = inv.initial_advance + totalPaidFromInst;

            return (
              <div key={inv.id} className="bg-white/80 border border-emerald-50 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                <div 
                  className="p-4 px-6 cursor-pointer flex flex-wrap items-center justify-between gap-4"
                  onClick={() => toggleExpand(inv.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isFullyPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                      <FileText size={18} />
                    </div>
                    <div>
                      <h4 className="font-black text-gray-800 text-sm">{inv.number}</h4>
                      <div className="flex items-center gap-2">
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest truncate">{inv.client}</p>
                        <span className="text-[9px] text-emerald-300">•</span>
                        <p className="text-[9px] font-bold text-emerald-600/60 uppercase">{new Date(inv.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-6 items-center">
                    <div className="text-center">
                      <p className="text-[7px] font-black text-gray-400 uppercase leading-none mb-1">Mensualités</p>
                      <p className="text-[10px] font-black text-emerald-700">{paidInst} / {totalInst}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[7px] font-black text-gray-400 uppercase leading-none mb-1">Réglé</p>
                      <p className="text-[10px] font-black text-emerald-900">{currentTotalPaid.toLocaleString()} Ar</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${isFullyPaid ? 'bg-emerald-500 text-white' : 'bg-orange-500 text-white shadow-sm'}`}>
                        {isFullyPaid ? 'Soldé' : 'En cours'}
                      </span>
                      {expandedInvoices[inv.id] ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                  </div>
                </div>

                {expandedInvoices[inv.id] && (
                  <div className="border-t border-emerald-50 bg-emerald-50/10 p-4 px-6 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      <div className="bg-white p-3 rounded-xl border border-emerald-50 flex justify-between items-center">
                        <div>
                          <p className="text-[7px] font-black text-emerald-600 uppercase">Avance</p>
                          <p className="text-xs font-black text-emerald-900">{inv.initial_advance.toLocaleString()} Ar</p>
                        </div>
                        <CheckCircle2 className="text-emerald-500" size={14} />
                      </div>

                      {inv.installments.map((inst, index) => (
                        <div key={inst.id} className="bg-white p-3 rounded-xl border border-emerald-50 flex justify-between items-center shadow-sm">
                          <div>
                            <p className="text-[7px] font-black text-gray-400 uppercase"># {index + 1} - {new Date(inst.date_echeance).toLocaleDateString()}</p>
                            <p className="text-xs font-black text-gray-800">{inst.montant.toLocaleString()} Ar</p>
                          </div>
                          {inst.statut === 'paye' ? (
                            <CheckCircle2 className="text-emerald-500" size={14} />
                          ) : (
                            <AlertCircle className="text-orange-400" size={14} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-10 bg-white/40 border-2 border-dashed border-emerald-50 rounded-2xl">
            <Clock className="mx-auto text-emerald-100 mb-2" size={32} />
            <p className="text-gray-400 font-bold uppercase text-[9px] tracking-widest">Aucun historique</p>
          </div>
        )}
      </div>
    </div>
  );
}
