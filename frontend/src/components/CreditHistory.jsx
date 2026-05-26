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
        .from('factures')
        .select(`
          *,
          clients (name, phone),
          paiements(*),
          echeances_details(*)
        `)
        // Retiré temporairement le filtre pour déboguer
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log("Données brutes factures:", data);
      
      // On filtre en JS pour voir si le type existe
      const creditFactures = data?.filter(f => f.type === 'CRÉDIT' || f.type === 'CREDIT');
      console.log("Factures filtrées:", creditFactures);
      
      setHistory(creditFactures || []);
    } catch (err) {
      console.error("Erreur chargement historique:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filtered = history.filter(h => {
    const matchesSearch = h.number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (h.clients?.name || h.guest_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (statusFilter === 'paid') return h.status === 'paid';
    if (statusFilter === 'pending') return h.status !== 'paid';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center bg-white/60 backdrop-blur-md p-4 rounded-3xl border border-emerald-50 gap-4 shadow-sm">
        <h3 className="text-lg font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
          <Clock className="text-emerald-600" size={20} /> Historique Crédits
        </h3>
        <input 
          type="text" 
          placeholder="Rechercher..." 
          className="bg-white border border-emerald-100 rounded-2xl py-2.5 px-4 text-sm outline-none w-64"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white/80 backdrop-blur-md border border-emerald-50 rounded-[2.5rem] overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-emerald-50/50 border-b border-emerald-100">
              <th className="p-4 text-[9px] font-black text-emerald-700 uppercase tracking-widest">Facture</th>
              <th className="p-4 text-[9px] font-black text-emerald-700 uppercase tracking-widest">Date</th>
              <th className="p-4 text-[9px] font-black text-emerald-700 uppercase tracking-widest">Client</th>
              <th className="p-4 text-[9px] font-black text-emerald-700 uppercase tracking-widest text-right">Crédit</th>
              <th className="p-4 text-[9px] font-black text-emerald-700 uppercase tracking-widest text-right">Avances</th>
              <th className="p-4 text-[9px] font-black text-emerald-700 uppercase tracking-widest text-center">Détails</th>
              <th className="p-4 text-[9px] font-black text-emerald-700 uppercase tracking-widest text-right">Reste</th>
              <th className="p-4 text-[9px] font-black text-emerald-700 uppercase tracking-widest text-center">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-50">
            {loading ? (
                <tr><td colSpan="8" className="p-8 text-center text-[10px] font-black text-gray-400">Chargement...</td></tr>
            ) : filtered.length > 0 ? (
                filtered.map((inv) => {
                    const totalPaid = inv.paiements?.reduce((sum, p) => sum + Number(p.montant), 0) || 0;
                    const totalDue = Number(inv.total_amount || 0);
                    const isFullyPaid = totalPaid >= totalDue;
                    const isExpanded = expandedInvoices[inv.id];
                    const lastPayment = inv.paiements?.slice(-1)[0];

                    return (
                        <>
                            <tr key={inv.id} className={`hover:bg-emerald-50/20 transition-colors cursor-pointer ${isExpanded ? 'bg-emerald-50/10' : ''}`} onClick={() => toggleExpand(inv.id)}>
                                <td className="p-4 font-black text-gray-800 text-xs uppercase">{inv.number}</td>
                                <td className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                                    {new Date(inv.created_at).toLocaleDateString()}
                                </td>
                                <td className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-tight">{inv.clients?.name || inv.guest_name}</td>
                                <td className="p-4 font-black text-gray-800 text-right text-xs">{totalDue.toLocaleString()} Ar</td>
                                <td className="p-4 font-black text-emerald-600 text-right text-xs">{totalPaid.toLocaleString()} Ar</td>
                                <td className="p-4 text-center">
                                    {lastPayment && (
                                        <span className="text-[8px] font-black uppercase bg-gray-100 px-2 py-1 rounded-md">{lastPayment.type_paiement}</span>
                                    )}
                                </td>
                                <td className="p-4 font-black text-orange-600 text-right text-xs">{(totalDue - totalPaid).toLocaleString()} Ar</td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${isFullyPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                                        {isFullyPaid ? 'Soldé' : 'En cours'}
                                    </span>
                                </td>
                            </tr>
                            {isExpanded && (
                                <tr className="bg-gray-50/30">
                                    <td colSpan="8" className="p-4">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            {inv.paiements?.map((p, idx) => (
                                                <div key={p.id} className="bg-white p-2.5 rounded-lg border border-gray-100 shadow-sm">
                                                    <p className="text-[7px] font-black text-gray-400 uppercase">Paiement #{idx + 1} - {new Date(p.date_paiement).toLocaleDateString()}</p>
                                                    <p className="text-[11px] font-black text-gray-800">{Number(p.montant).toLocaleString()} Ar</p>
                                                    <span className="text-[7px] uppercase font-bold text-emerald-600">{p.type_paiement}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </>
                    );
                })
            ) : (
                <tr><td colSpan="8" className="p-8 text-center text-[10px] font-black text-gray-400">Aucun historique trouvé.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
