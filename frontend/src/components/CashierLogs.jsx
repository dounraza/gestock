import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Clock, Download } from 'lucide-react';

export default function CashierLogs() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    const { data, error } = await supabase
        .from('cashier_logs')
        .select('*, profiles:user_id(full_name)')
        .order('login_time', { ascending: false });
    if (data) setLogs(data);
  };

  const exportCSV = () => {
    const headers = ['Utilisateur', 'Entrée', 'Sortie'];
    const rows = logs.map(log => [
        log.profiles?.full_name || 'Caissier',
        formatDateTime(log.login_time),
        formatDateTime(log.logout_time)
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "historique_pointage.csv");
    link.click();
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="p-8 bg-white rounded-3xl shadow-sm border border-emerald-50">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-gray-800 uppercase flex items-center gap-3">
                <Clock className="text-emerald-500" /> Historique de Pointage
            </h2>
            <button 
                onClick={exportCSV}
                className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-600"
            >
                <Download size={18} /> Exporter
            </button>
        </div>
        <table className="w-full text-left">
            <thead className="bg-emerald-50 text-emerald-800 uppercase text-sm font-black">
                <tr>
                    <th className="p-4">Utilisateur</th>
                    <th className="p-4">Entrée</th>
                    <th className="p-4">Sortie</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-emerald-50">
                {logs.map(log => (
                    <tr key={log.id} className="text-base font-bold text-gray-700">
                        <td className="p-4">{log.profiles?.full_name || 'Caissier'}</td>
                        <td className="p-4 text-emerald-600">{formatDateTime(log.login_time)}</td>
                        <td className="p-4 text-red-600">{formatDateTime(log.logout_time)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
  );
}
