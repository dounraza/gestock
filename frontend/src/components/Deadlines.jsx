import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar as CalendarIcon, Clock, User, AlertCircle, CheckCircle, Search, FileText, List, LayoutGrid, Table, DollarSign, Loader2, X, CheckCircle2, Banknote, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Deadlines({ initialSearchTerm, onSearchReset }) {
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
  const [viewMode, setViewMode] = useState('cards'); // 'cards', 'table', 'calendar'
  const [frequencyFilter, setFrequencyFilter] = useState('all'); // 'all', 'day', 'month'
  const [currentDate, setCurrentDate] = useState(new Date());

  const [paymentModal, setPaymentModal] = useState(null); // { echeance: ... }
  const [paymentInfo, setPaymentInfo] = useState({
    method: 'espece',
    reference: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (initialSearchTerm) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  const fetchDeadlines = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('echeances_details')
        .select(`
          *,
          factures (
            number,
            guest_name,
            clients (name, phone)
          )
        `)
        .order('date_echeance', { ascending: true });
      
      if (error) {
        console.error("Error fetching deadlines:", error);
      }
      if (data) setDeadlines(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeadlines();
  }, []);

  const handleMarkAsPaid = async () => {
    if (!paymentModal || !paymentModal.echeance) return;
    const { echeance } = paymentModal;
    
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('echeances_details')
        .update({ 
          statut: 'paye'
        })
        .eq('id', echeance.id);
      
      if (error) throw error;

      // Vérifier si toutes les échéances de cette facture sont payées
      const { data: remaining } = await supabase
        .from('echeances_details')
        .select('id')
        .eq('facture_id', echeance.facture_id)
        .eq('statut', 'non_paye');

      if (remaining && remaining.length === 0) {
        await supabase.from('factures').update({ status: 'paid' }).eq('id', echeance.facture_id);
      }
      
      setPaymentModal(null);
      setPaymentInfo({ method: 'espece', reference: '' });
      fetchDeadlines();
      alert("Paiement enregistré avec succès !");
    } catch (err) {
      alert("Erreur lors de l'enregistrement du paiement : " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filtered = deadlines.filter(d => {
    const matchesSearch = d.factures?.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.factures?.clients?.name || d.factures?.guest_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = d.statut === 'non_paye'; // On montre surtout les non payés par défaut dans l'échéancier
    
    if (frequencyFilter === 'all') return matchesSearch && matchesStatus;

    const siblingInstallments = deadlines.filter(sib => sib.facture_id === d.facture_id);
    if (siblingInstallments.length <= 1) return matchesSearch && matchesStatus;

    const dates = siblingInstallments.map(sib => new Date(sib.date_echeance).getTime()).sort();
    const gaps = [];
    for(let i=1; i<dates.length; i++) gaps.push((dates[i] - dates[i-1]) / (1000 * 3600 * 24));
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

    const isDaily = avgGap < 15;
    return matchesSearch && matchesStatus && (frequencyFilter === 'day' ? isDaily : !isDaily);
  });

  // Groupement par facture pour la vue "Cards"
  const groupedInvoices = filtered.reduce((acc, current) => {
    const factId = current.facture_id;
    if (!acc[factId]) {
      acc[factId] = {
        facture_id: factId,
        number: current.factures?.number,
        client_name: current.factures?.clients?.name || current.factures?.guest_name || 'Client Direct',
        total_remaining: 0,
        installments: [],
        next_due_date: current.date_echeance,
        is_daily: false
      };
    }
    acc[factId].total_remaining += current.montant;
    acc[factId].installments.push(current);
    
    if (new Date(current.date_echeance) < new Date(acc[factId].next_due_date)) {
      acc[factId].next_due_date = current.date_echeance;
    }
    return acc;
  }, {});

  const groupedList = Object.values(groupedInvoices).map(inv => {
    if (inv.installments.length > 1) {
      const dates = inv.installments.map(sib => new Date(sib.date_echeance).getTime()).sort();
      const gap = (dates[1] - dates[0]) / (1000 * 3600 * 24);
      inv.is_daily = gap < 15;
    }
    return inv;
  }).sort((a, b) => new Date(a.next_due_date) - new Date(b.next_due_date));

  // Calendar Logic
  const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    return { firstDay: (firstDay === 0 ? 6 : firstDay - 1), days };
  };
  const { firstDay, days } = getDaysInMonth(currentDate);

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center bg-white/60 backdrop-blur-md p-4 rounded-3xl border border-emerald-50 gap-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher par n° de facture ou client..." 
              className="w-full bg-white border border-emerald-100 rounded-2xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex bg-emerald-50/50 p-1 rounded-2xl border border-emerald-100">
            <button 
              onClick={() => setFrequencyFilter('all')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${frequencyFilter === 'all' ? 'bg-emerald-600 text-white shadow-lg' : 'text-emerald-600 hover:bg-emerald-50'}`}
            >
              Tous
            </button>
            <button 
              onClick={() => setFrequencyFilter('day')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${frequencyFilter === 'day' ? 'bg-emerald-600 text-white shadow-lg' : 'text-emerald-600 hover:bg-emerald-50'}`}
            >
              Journalier
            </button>
            <button 
              onClick={() => setFrequencyFilter('month')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${frequencyFilter === 'month' ? 'bg-emerald-600 text-white shadow-lg' : 'text-emerald-600 hover:bg-emerald-50'}`}
            >
              Mensuel
            </button>
          </div>
        </div>

        <div className="flex bg-gray-100/50 p-1 rounded-2xl border border-gray-100">
          <button 
            onClick={() => setViewMode('cards')}
            className={`p-2 rounded-xl transition-all ${viewMode === 'cards' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400 hover:text-emerald-600'}`}
          >
            <LayoutGrid size={18} />
          </button>
          <button 
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-xl transition-all ${viewMode === 'table' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400 hover:text-emerald-600'}`}
          >
            <Table size={18} />
          </button>
          <button 
            onClick={() => setViewMode('calendar')}
            className={`p-2 rounded-xl transition-all ${viewMode === 'calendar' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400 hover:text-emerald-600'}`}
          >
            <CalendarIcon size={18} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
            <p className="text-sm font-black text-emerald-800 uppercase tracking-widest">Chargement de l'échéancier...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/40 border-2 border-dashed border-emerald-100 rounded-[3rem]">
            <CheckCircle2 size={64} className="text-emerald-100 mb-4" />
            <h3 className="text-lg font-black text-gray-800 uppercase tracking-widest">Tout est à jour</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Aucune échéance en attente pour ces critères.</p>
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groupedList.map((invoice) => (
              <div key={invoice.facture_id} className="bg-white/80 border border-emerald-50 rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                <div className="p-6 bg-emerald-50/30 border-b border-emerald-50 flex justify-between items-center">
                  <div>
                    <h4 className="font-black text-emerald-900 text-lg leading-none mb-1">{invoice.number}</h4>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{invoice.client_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase leading-none mb-1">Total restant</p>
                    <p className="text-lg font-black text-emerald-700">{invoice.total_remaining.toLocaleString()} Ar</p>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {invoice.installments.map((inst, idx) => {
                    const isOverdue = new Date(inst.date_echeance) < new Date();
                    return (
                      <div key={inst.id} className="flex items-center justify-between p-4 rounded-2xl border border-emerald-50/50 bg-white/50 group/item hover:bg-emerald-50/50 transition-all">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${isOverdue ? 'bg-red-50 text-red-500 shadow-sm' : 'bg-emerald-50 text-emerald-600'}`}>
                            {idx + 1}
                          </div>
                          <div>
                            <p className={`text-xs font-black ${isOverdue ? 'text-red-500' : 'text-gray-800'}`}>
                              {new Date(inst.date_echeance).toLocaleDateString()}
                            </p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">{inst.montant.toLocaleString()} Ar</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setPaymentModal({ echeance: inst })}
                          className="bg-emerald-600 text-white p-2.5 rounded-xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all scale-0 group-hover/item:scale-100 origin-right"
                        >
                          <Banknote size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === 'table' ? (
          <div className="bg-white/80 backdrop-blur-md border border-emerald-50 rounded-[2.5rem] overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-emerald-50/50 border-b border-emerald-100">
                  <th className="p-6 text-[10px] font-black text-emerald-700 uppercase tracking-widest">Facture</th>
                  <th className="p-6 text-[10px] font-black text-emerald-700 uppercase tracking-widest">Client</th>
                  <th className="p-6 text-[10px] font-black text-emerald-700 uppercase tracking-widest">Date Échéance</th>
                  <th className="p-6 text-[10px] font-black text-emerald-700 uppercase tracking-widest text-right">Montant</th>
                  <th className="p-6 text-[10px] font-black text-emerald-700 uppercase tracking-widest text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50">
                {filtered.map(d => {
                  const isOverdue = new Date(d.date_echeance) < new Date();
                  return (
                    <tr key={d.id} className="hover:bg-emerald-50/20 transition-colors">
                      <td className="p-6 font-black text-gray-800 text-sm uppercase">{d.factures?.number}</td>
                      <td className="p-6 text-xs font-bold text-gray-400 uppercase tracking-tight">{d.factures?.clients?.name || d.factures?.guest_name}</td>
                      <td className="p-6">
                        <span className={`text-xs font-black uppercase px-3 py-1.5 rounded-lg ${isOverdue ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                          {new Date(d.date_echeance).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="p-6 font-black text-emerald-700 text-right">{d.montant.toLocaleString()} Ar</td>
                      <td className="p-6 text-center">
                        <button 
                          onClick={() => setPaymentModal({ echeance: d })}
                          className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 mx-auto"
                        >
                          <Banknote size={14} /> Payer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-md border border-emerald-50 rounded-[3rem] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-xl font-black text-emerald-900 uppercase tracking-widest flex items-center gap-4">
                <CalendarIcon className="text-emerald-500" /> {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h3>
              <div className="flex gap-2">
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-100 transition-all"><ChevronLeft size={20} /></button>
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-100 transition-all"><ChevronRight size={20} /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-4">
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map(day => (
                <div key={day} className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">{day}</div>
              ))}
              {[...Array(firstDay)].map((_, i) => <div key={`empty-${i}`} />)}
              {[...Array(days)].map((_, i) => {
                const day = i + 1;
                const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayDeadlines = filtered.filter(d => d.date_echeance === dateStr);
                return (
                  <div key={day} className={`aspect-square border rounded-3xl p-3 flex flex-col items-center justify-between transition-all ${dayDeadlines.length > 0 ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-50'}`}>
                    <span className="text-xs font-black text-gray-400">{day}</span>
                    {dayDeadlines.length > 0 && (
                      <div className="flex flex-col gap-1 w-full mt-2">
                        {dayDeadlines.map(d => (
                          <div key={d.id} onClick={() => setPaymentModal({ echeance: d })} className="bg-emerald-600 text-white text-[8px] font-black p-1.5 rounded-lg truncate cursor-pointer hover:bg-emerald-700 shadow-sm">
                            {d.factures?.number} - {d.montant.toLocaleString()}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-emerald-950/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-emerald-50 flex justify-between items-center bg-emerald-50/30">
              <h3 className="text-xl font-black text-emerald-900 uppercase tracking-widest">Enregistrer Paiement</h3>
              <button onClick={() => setPaymentModal(null)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={24} /></button>
            </div>
            <div className="p-10 space-y-8">
              <div className="bg-emerald-50/50 p-6 rounded-[2rem] border border-emerald-50">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Montant à régler</p>
                <p className="text-4xl font-black text-emerald-900">{paymentModal.echeance.montant.toLocaleString()} <span className="text-lg">Ar</span></p>
                <div className="mt-4 pt-4 border-t border-emerald-100 flex items-center gap-3">
                  <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <FileText size={14} className="text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-gray-800 uppercase">{paymentModal.echeance.factures?.number}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase">{paymentModal.echeance.factures?.clients?.name || paymentModal.echeance.factures?.guest_name}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-emerald-700 uppercase ml-2 tracking-widest">Méthode de Paiement</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['espece', 'mobile_money', 'virement', 'cheque'].map(m => (
                      <button 
                        key={m}
                        onClick={() => setPaymentInfo({...paymentInfo, method: m})}
                        className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${paymentInfo.method === m ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white border-emerald-50 text-gray-400 hover:border-emerald-200'}`}
                      >
                        {m.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-emerald-700 uppercase ml-2 tracking-widest">Référence (Optionnel)</label>
                  <input 
                    type="text" 
                    placeholder="N° de transaction, chèque..."
                    className="w-full bg-emerald-50/30 border-2 border-emerald-50 rounded-2xl px-6 py-4 text-sm outline-none focus:border-emerald-500/20 transition-all"
                    value={paymentInfo.reference}
                    onChange={e => setPaymentInfo({...paymentInfo, reference: e.target.value})}
                  />
                </div>
              </div>

              <button 
                onClick={handleMarkAsPaid}
                disabled={isProcessing}
                className="w-full bg-emerald-600 text-white font-black py-6 rounded-[2rem] shadow-xl shadow-emerald-200 active:scale-95 transition-all flex items-center justify-center gap-4 text-sm uppercase tracking-[0.2em] disabled:bg-gray-200 disabled:shadow-none"
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={24} /> Confirmer le Règlement</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
