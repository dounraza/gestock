import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar as CalendarIcon, Clock, User, AlertCircle, CheckCircle, Search, FileText, List, LayoutGrid, Table, DollarSign, Loader2, X } from 'lucide-react';

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
        // .eq('statut', 'non_paye')
        .order('date_echeance', { ascending: true });
      
      console.log("Deadlines DEBUG: Data fetched from Supabase:", data);
      
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
    } catch (err) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filtered = deadlines.filter(d => {
    const matchesSearch = d.factures?.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.factures?.clients?.name || d.factures?.guest_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (frequencyFilter === 'all') return matchesSearch;

    // Inférence de fréquence : On regarde les autres échéances de la même facture
    const siblingInstallments = deadlines.filter(sib => sib.facture_id === d.facture_id);
    if (siblingInstallments.length <= 1) return matchesSearch; // Si une seule échéance, on l'affiche partout ou on peut pas deviner

    // Calcul de l'écart moyen en jours entre les échéances
    const dates = siblingInstallments.map(sib => new Date(sib.date_echeance).getTime()).sort();
    const gaps = [];
    for(let i=1; i<dates.length; i++) gaps.push((dates[i] - dates[i-1]) / (1000 * 3600 * 24));
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;

    const isDaily = avgGap < 15; // Moins de 15 jours d'écart = Journalier (souvent 1 jour)
    const result = matchesSearch && (frequencyFilter === 'day' ? isDaily : !isDaily);
    console.log("Filtering debug:", {d, matchesSearch, isDaily, frequencyFilter, result});
    return result;
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

  console.log("Grouped invoices DEBUG:", groupedInvoices);

  const groupedList = Object.values(groupedInvoices).map(inv => {
    // Détection de fréquence par groupe
    if (inv.installments.length > 1) {
      const dates = inv.installments.map(sib => new Date(sib.date_echeance).getTime()).sort();
      const gap = (dates[1] - dates[0]) / (1000 * 3600 * 24);
      inv.is_daily = gap < 15;
    }
    return inv;
  }).sort((a, b) => new Date(a.next_due_date) - new Date(b.next_due_date));

  // Calendrier Logic
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
      <div className="bg-white/80 backdrop-blur-md border border-emerald-50 rounded-[2.5rem] overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-emerald-50/50 border-b border-emerald-100">
              <th className="p-4 text-[10px] font-black text-emerald-700 uppercase">ID</th>
              <th className="p-4 text-[10px] font-black text-emerald-700 uppercase">Facture ID</th>
              <th className="p-4 text-[10px] font-black text-emerald-700 uppercase">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-50">
            {deadlines.map(d => (
              <tr key={d.id}>
                <td className="p-4 text-xs font-bold text-gray-800">{d.id}</td>
                <td className="p-4 text-xs font-bold text-gray-800">{d.facture_id}</td>
                <td className="p-4 text-xs font-bold text-gray-800">{d.statut}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
