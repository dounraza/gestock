import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Search, FileText, Trash2, Edit2, Calendar, User, DollarSign, Loader2, CheckCircle, Clock, XCircle, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export default function Billing() {
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  const [formData, setFormData] = useState({
    client_id: '',
    number: '',
    total_amount: '',
    status: 'draft',
    due_date: new Date().toISOString().split('T')[0]
  });

  const fetchData = async () => {
    setLoading(true);
    const { data: invs } = await supabase
      .from('factures')
      .select('*, clients(name, email, phone, address)')
      .order('created_at', { ascending: false });
    
    const { data: cls } = await supabase.from('clients').select('*').order('name');
    
    if (invs) {
      setInvoices(invs);
      setFilteredInvoices(invs);
    }
    if (cls) setClients(cls);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const filtered = invoices.filter(inv => 
      inv.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.clients?.name && inv.clients.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredInvoices(filtered);
  }, [searchTerm, invoices]);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (editingInvoice) {
      const { error } = await supabase
        .from('factures')
        .update({
          client_id: formData.client_id,
          number: formData.number,
          total_amount: parseFloat(formData.total_amount),
          status: formData.status,
          due_date: formData.due_date
        })
        .eq('id', editingInvoice.id);
      
      if (error) alert(error.message);
      else {
        resetForm();
        fetchData();
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('factures').insert([{
        ...formData,
        total_amount: parseFloat(formData.total_amount),
        user_id: user.id
      }]);
      
      if (error) alert(error.message);
      else {
        resetForm();
        fetchData();
      }
    }
    setIsSubmitting(false);
  };

  const handleEdit = (invoice) => {
    setEditingInvoice(invoice);
    setFormData({
      client_id: invoice.client_id || '',
      number: invoice.number,
      total_amount: invoice.total_amount,
      status: invoice.status,
      due_date: invoice.due_date || new Date().toISOString().split('T')[0]
    });
    setShowModal(true);
  };

  const deleteInvoice = async (id) => {
    if (confirm('Supprimer cette facture ?')) {
      await supabase.from('factures').delete().eq('id', id);
      fetchData();
    }
  };

  const cancelInvoice = async (invoice) => {
    if (!confirm('Annuler cette facture et réintégrer les stocks ?')) return;

    try {
      const { data: items, error: itemsError } = await supabase
        .from('facture_items')
        .select('produit_id, quantity')
        .eq('facture_id', invoice.id);

      if (itemsError) throw itemsError;

      for (const item of items) {
        const { data: currentProd } = await supabase
          .from('produits')
          .select('stock_quantity')
          .eq('id', item.produit_id)
          .single();

        const newQty = (currentProd?.stock_quantity || 0) + item.quantity;
        
        await supabase
          .from('produits')
          .update({ stock_quantity: newQty })
          .eq('id', item.produit_id);
      }

      await supabase
        .from('factures')
        .update({ status: 'cancelled' })
        .eq('id', invoice.id);

      alert('Facture annulée et stocks réintégrés !');
      fetchData();
    } catch (error) {
      console.error('Erreur annulation:', error);
      alert('Erreur lors de l\'annulation : ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      client_id: '',
      number: `FAC-${Date.now().toString().slice(-6)}`,
      total_amount: '',
      status: 'draft',
      due_date: new Date().toISOString().split('T')[0]
    });
    setEditingInvoice(null);
    setShowModal(false);
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'paid': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'sent': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'cancelled': return 'bg-red-50 text-red-600 border-red-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid': return <CheckCircle size={14} />;
      case 'sent': return <Clock size={14} />;
      case 'cancelled': return <XCircle size={14} />;
      default: return <FileText size={14} />;
    }
  };

  const downloadPDF = async (inv) => {
    setIsGeneratingPDF(true);
    
    // Fetch items with product names for the invoice
    const { data: items } = await supabase
      .from('facture_items')
      .select('quantity, price_at_sale, produits(name)')
      .eq('facture_id', inv.id);

    const invoiceElement = document.createElement('div');
    invoiceElement.style.position = 'absolute';
    invoiceElement.style.left = '-9999px';
    invoiceElement.style.top = '-9999px';
    invoiceElement.style.width = '800px';
    invoiceElement.style.padding = '40px';
    invoiceElement.style.backgroundColor = '#ffffff';
    invoiceElement.style.fontFamily = 'sans-serif';
    
    const amount = Number(inv.total_amount || 0).toLocaleString('fr-MG');
    
    const itemsHtml = items ? items.map(item => `
      <tr style="border-bottom: 1px solid #f9fafb;">
        <td style="padding: 20px 0; font-size: 14px; font-weight: 700; color: #1f2937;">${item.produits?.name || 'Produit inconnu'}</td>
        <td style="padding: 20px 0; text-align: center; font-size: 14px;">${item.quantity}</td>
        <td style="padding: 20px 0; text-align: right; font-size: 14px;">${Number(item.price_at_sale).toLocaleString('fr-MG')}</td>
        <td style="padding: 20px 0; text-align: right; font-size: 14px; font-weight: 900; color: #1f2937;">${(item.quantity * item.price_at_sale).toLocaleString('fr-MG')} MGA</td>
      </tr>
    `).join('') : '';

    invoiceElement.innerHTML = `
      <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #10b981; padding-bottom: 30px; margin-bottom: 40px;">
        <div style="flex: 1;">
          <h1 style="font-size: 28px; font-weight: 900; color: #059669; margin: 0; text-transform: uppercase;">Gestock PPN</h1>
          <p style="font-size: 14px; color: #6b7280; margin: 5px 0;">Solution de Gestion de Stock PPN</p>
        </div>
        <div style="flex: 1; text-align: right;">
          <h2 style="font-size: 32px; font-weight: 900; color: #e5e7eb; margin: 0; text-transform: uppercase;">FACTURE</h2>
          <p style="font-size: 18px; font-weight: 900; color: #1f2937; margin: 5px 0;">${inv.number}</p>
        </div>
      </div>

      <div style="margin-bottom: 40px;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #f3f4f6;">
              <th style="padding: 15px 0; text-align: left; font-size: 11px; font-weight: 900; color: #9ca3af; text-transform: uppercase;">Produit</th>
              <th style="padding: 15px 0; text-align: center; font-size: 11px; font-weight: 900; color: #9ca3af; text-transform: uppercase;">Qté</th>
              <th style="padding: 15px 0; text-align: right; font-size: 11px; font-weight: 900; color: #9ca3af; text-transform: uppercase;">Prix</th>
              <th style="padding: 15px 0; text-align: right; font-size: 11px; font-weight: 900; color: #9ca3af; text-transform: uppercase;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
      </div>

      <div style="display: flex; justify-content: flex-end;">
        <div style="width: 250px; background-color: #059669; color: #ffffff; padding: 25px; border-radius: 20px; text-align: right;">
          <p style="font-size: 11px; font-weight: 700; text-transform: uppercase; margin: 0 0 5px 0; opacity: 0.8;">Total à payer</p>
          <p style="font-size: 24px; font-weight: 900; margin: 0;">${amount} MGA</p>
        </div>
      </div>
    `;

    document.body.appendChild(invoiceElement);
    
    try {
      // Give the browser a moment to render the element
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(invoiceElement, {
        scale: 2,
        useCORS: true,
        logging: true,
        backgroundColor: '#ffffff',
        width: 800
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`facture-${inv.number}.pdf`);
    } catch (error) {
      console.error('PDF Error:', error);
      alert(`Erreur lors de la génération du PDF: ${error.message}`);
    } finally {
      if (document.body.contains(invoiceElement)) {
        document.body.removeChild(invoiceElement);
      }
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-emerald-50 gap-4">
        <div className="flex gap-4 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher une facture (N° ou client)..." 
              className="w-full bg-white border border-emerald-100 rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-emerald-500/10 transition-all outline-none" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg shadow-emerald-100">
          <Plus size={18} /> <span>Nouvelle Facture</span>
        </button>
      </div>

      {/* Invoice List - Desktop Table */}
      <div className="hidden md:block bg-white/60 backdrop-blur-md border border-emerald-100 rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-emerald-50/50">
              <th className="p-5 text-xs font-bold text-emerald-700 uppercase tracking-widest">N° Facture</th>
              <th className="p-5 text-xs font-bold text-emerald-700 uppercase tracking-widest">Client</th>
              <th className="p-5 text-xs font-bold text-emerald-700 uppercase tracking-widest">Montant</th>
              <th className="p-5 text-xs font-bold text-emerald-700 uppercase tracking-widest">Échéance</th>
              <th className="p-5 text-xs font-bold text-emerald-700 uppercase tracking-widest">Statut</th>
              <th className="p-5 text-xs font-bold text-emerald-700 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-50">
            {loading ? (
              <tr><td colSpan="6" className="p-10 text-center text-gray-400">Chargement des factures...</td></tr>
            ) : filteredInvoices.length > 0 ? (
              filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-emerald-50/20 transition-colors group">
                  <td className="p-5 font-bold text-gray-800 flex items-center gap-2">
                    <FileText size={16} className="text-emerald-500" /> {inv.number}
                  </td>
                  <td className="p-5 text-gray-600 font-medium">
                    {inv.clients?.name || 'Client inconnu'}
                  </td>
                  <td className="p-5 font-black text-gray-800">
                    {inv.total_amount.toLocaleString('fr-MG')} MGA
                  </td>
                  <td className="p-5 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-gray-400" /> {inv.due_date ? new Date(inv.due_date).toLocaleDateString('fr-FR') : '-'}
                    </div>
                  </td>
                  <td className="p-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase border flex items-center gap-1.5 w-fit ${getStatusStyle(inv.status)}`}>
                      {getStatusIcon(inv.status)} {inv.status}
                    </span>
                  </td>
                  <td className="p-5 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => downloadPDF(inv)} 
                        disabled={isGeneratingPDF}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors" 
                        title="Télécharger PDF"
                      >
                        <Download size={16} />
                      </button>
                      {inv.status === 'paid' && (
                        <button onClick={() => cancelInvoice(inv)} className="p-2 text-gray-400 hover:text-orange-600 transition-colors" title="Annuler">
                          <XCircle size={16} />
                        </button>
                      )}
                      <button onClick={() => handleEdit(inv)} className="p-2 text-gray-400 hover:text-emerald-600 transition-colors">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => deleteInvoice(inv.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="6" className="p-10 text-center text-gray-400">Aucune facture enregistrée.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Invoice List - Mobile Cards */}
      <div className="md:hidden space-y-4">
        {loading ? (
          <p className="text-center py-10 text-gray-400">Chargement des factures...</p>
        ) : filteredInvoices.length > 0 ? (
          filteredInvoices.map((inv) => (
            <div key={inv.id} className="bg-white/60 backdrop-blur-md border border-emerald-100 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800">{inv.number}</h4>
                    <p className="text-xs text-gray-500">{inv.clients?.name || 'Client inconnu'}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase border flex items-center gap-1 ${getStatusStyle(inv.status)}`}>
                  {getStatusIcon(inv.status)} {inv.status}
                </span>
              </div>
              
              <div className="flex justify-between items-end pt-2 border-t border-emerald-50">
                <div>
                  <p className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">Montant Total</p>
                  <p className="text-lg font-black text-gray-800">{inv.total_amount.toLocaleString('fr-MG')} MGA</p>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => downloadPDF(inv)} 
                    disabled={isGeneratingPDF}
                    className="p-2 bg-blue-50 text-blue-600 rounded-lg"
                  >
                    <Download size={16} />
                  </button>
                  {inv.status === 'paid' && (
                    <button onClick={() => cancelInvoice(inv)} className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                      <XCircle size={16} />
                    </button>
                  )}
                  <button onClick={() => handleEdit(inv)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => deleteInvoice(inv.id)} className="p-2 bg-red-50 text-red-600 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                <Calendar size={12} />
                <span>Échéance : {inv.due_date ? new Date(inv.due_date).toLocaleDateString('fr-FR') : '-'}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center py-10 text-gray-400">Aucune facture enregistrée.</p>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-900/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-emerald-50 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">
                {editingInvoice ? 'Modifier la facture' : 'Nouvelle facture'}
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">N° Facture</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input required className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" value={formData.number} onChange={e => setFormData({...formData, number: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Client</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <select required className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all appearance-none" value={formData.client_id} onChange={e => setFormData({...formData, client_id: e.target.value})}>
                      <option value="">Choisir...</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Montant Total</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input required type="number" step="0.01" className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" value={formData.total_amount} onChange={e => setFormData({...formData, total_amount: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Échéance</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input required type="date" className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Statut</label>
                <div className="flex gap-2">
                  {['draft', 'sent', 'paid', 'cancelled'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormData({...formData, status: s})}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase border transition-all ${
                        formData.status === s 
                          ? getStatusStyle(s) + ' border-emerald-500 scale-[1.05]' 
                          : 'bg-white text-gray-400 border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-100 mt-4 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (editingInvoice ? "Mettre à jour" : "Créer la facture")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
