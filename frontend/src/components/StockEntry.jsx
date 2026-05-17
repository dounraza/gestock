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
  Loader2,
  Plus,
  X,
  Trash2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

export default function StockEntry() {
  const [activeTab, setActiveTab] = useState('with-supplier');
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [withSupplierData, setWithSupplierData] = useState([]);
  const [withoutSupplierData, setWithoutSupplierData] = useState([]);

  // BL Creation States
  const [showBLModal, setShowBLModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [depots, setDepots] = useState([]);
  
  const [blFormData, setBLFormData] = useState({
    supplier_id: '',
    bl_number: `BL-${Date.now().toString().slice(-6)}`,
    bl_date: new Date().toISOString().split('T')[0],
    payment_type: 'direct_sale',
    total_amount: 0,
    depot_id: ''
  });

  const [blItems, setBLItems] = useState([]);
  const [newItem, setNewItem] = useState({
    product_id: '',
    quantity: '',
    purchase_price_per_unit: '',
    unit: 'base'
  });

  useEffect(() => {
    fetchData();
  }, [activeTab, startDate, endDate]);

  useEffect(() => {
    fetchSuppliersAndProducts();
  }, []);

  useEffect(() => {
    if (showBLModal) {
      console.log("StockEntry: BL Modal opened, current products count:", products.length);
      if (products.length === 0) {
        fetchSuppliersAndProducts();
      }
    }
  }, [showBLModal]);

  const formatStock = (quantity, p) => {
    const q = Number(quantity) || 0;
    const qpu = Number(p.quantite_par_unite) || 1;
    const uSup = p.unite_superieure || 'Colis';
    const uBase = p.unite_base || 'Unités';

    if (qpu > 1) {
      const superior = Math.floor(q / qpu);
      const base = q % qpu;
      if (superior === 0) return `${base} ${uBase}`;
      if (base === 0) return `${superior} ${uSup}`;
      return `${superior} ${uSup} + ${base} ${uBase}`;
    }
    return `${q} ${uBase}`;
  };

  const fetchSuppliersAndProducts = async () => {
    try {
      setIsSubmitting(true);
      console.log("StockEntry: Fetching suppliers, products and depots...");
      const [sRes, pRes, dRes] = await Promise.all([
        supabase.from('fournisseurs').select('*').order('name'),
        supabase.from('produits').select('*').order('name'),
        supabase.from('depots').select('*').order('name')
      ]);

      if (sRes.error) throw sRes.error;
      if (pRes.error) throw pRes.error;
      if (dRes.error) throw dRes.error;

      if (sRes.data) setSuppliers(sRes.data);
      if (pRes.data) {
        console.log("StockEntry: Products loaded:", pRes.data.length);
        setProducts(pRes.data);
      }
      if (dRes.data) {
        setDepots(dRes.data);
        const principal = dRes.data.find(dep => dep.name.toLowerCase().includes('principal')) || dRes.data[0];
        if (principal && !blFormData.depot_id) {
          setBLFormData(prev => ({ ...prev, depot_id: principal.id }));
        }
      }
    } catch (err) {
      console.error("StockEntry: Error in fetchSuppliersAndProducts:", err);
      alert("Erreur lors du chargement des données : " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

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
              fournisseurs!delivery_notes_supplier_id_fkey (
                name
              )
            ),
            produits!delivery_note_items_product_id_fkey (
              name,
              categories (
                name
              )
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        console.log("StockEntry: Fetched with-supplier data:", data);
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
        console.log("StockEntry: Fetched without-supplier data:", data);
        setWithoutSupplierData(data || []);
      }
    } catch (err) {
      console.error("Error fetching stock entries:", err);
    } finally {
      setLoading(false);
    }
  };

  const addItemToBL = () => {
    if (!newItem.product_id || !newItem.quantity || !newItem.purchase_price_per_unit) {
      alert("Veuillez remplir tous les champs de l'article");
      return;
    }

    const product = products.find(p => p.id === newItem.product_id);
    const qty = parseFloat(newItem.quantity);
    const price = parseFloat(newItem.purchase_price_per_unit);
    const itemTotal = qty * price;
    
    // Calculer la quantité réelle en unité de base pour le stock
    let baseQuantity = qty;
    if (newItem.unit === 'superior' && product.quantite_par_unite) {
      baseQuantity = qty * parseFloat(product.quantite_par_unite);
    }
    
    const unitName = newItem.unit === 'superior' ? (product.unite_superieure || 'Colis') : (product.unite_base || 'Unités');

    setBLItems([...blItems, { 
      ...newItem, 
      productName: product.name, 
      total: itemTotal,
      baseQuantity,
      unitName
    }]);
    
    setBLFormData(prev => ({ ...prev, total_amount: prev.total_amount + itemTotal }));
    
    setNewItem({
      product_id: '',
      quantity: '',
      purchase_price_per_unit: '',
      unit: 'base'
    });
  };

  const removeItemFromBL = (index) => {
    const item = blItems[index];
    setBLItems(blItems.filter((_, i) => i !== index));
    setBLFormData(prev => ({ ...prev, total_amount: prev.total_amount - item.total }));
  };

  const handleSaveBL = async (e) => {
    e.preventDefault();
    if (!blFormData.supplier_id || blItems.length === 0) {
      alert("Veuillez sélectionner un fournisseur et ajouter au moins un article.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Create BL
      const { data: bl, error: blError } = await supabase
        .from('delivery_notes')
        .insert([{
          supplier_id: blFormData.supplier_id,
          bl_number: blFormData.bl_number,
          bl_date: blFormData.bl_date,
          total_amount: blFormData.total_amount,
          payment_type: blFormData.payment_type,
          user_id: user.id
        }])
        .select()
        .single();

      if (blError) throw blError;

      // 2. Create items and update stock
      for (const item of blItems) {
        // Create delivery note item
        await supabase.from('delivery_note_items').insert([{
          delivery_note_id: bl.id,
          product_id: item.product_id,
          quantity: item.quantity,
          purchase_price_per_unit: item.purchase_price_per_unit,
          line_total_purchase: item.total,
          unit: item.unit === 'superior' ? 'superior' : 'base'
        }]);

        // Create stock movement (Always record in base units for calculation consistency)
        await supabase.from('stock_movements').insert([{
          product_id: item.product_id,
          type: 'in',
          quantity: item.baseQuantity,
          price_at_movement: item.purchase_price_per_unit,
          reason: `BL #${blFormData.bl_number}`,
          delivery_note_id: bl.id,
          user_id: user.id,
          unit: 'base'
        }]);

        // Update physical stock in selected depot
        const { data: existingStock } = await supabase
          .from('stocks')
          .select('id, quantity')
          .eq('product_id', item.product_id)
          .eq('depot_id', blFormData.depot_id)
          .maybeSingle();

        if (existingStock) {
          await supabase.from('stocks')
            .update({ quantity: parseFloat(existingStock.quantity) + parseFloat(item.baseQuantity) })
            .eq('id', existingStock.id);
        } else {
          await supabase.from('stocks').insert([{
            product_id: item.product_id,
            depot_id: blFormData.depot_id,
            quantity: item.baseQuantity
          }]);
        }
        
        // Update global product purchase price if needed
        await supabase.from('produits')
          .update({ purchase_price: item.purchase_price_per_unit })
          .eq('id', item.product_id);
      }

      alert("Bon de livraison enregistré avec succès !");
      setShowBLModal(false);
      setActiveTab('with-supplier');
      setBLItems([]);
      setBLFormData({
        supplier_id: '',
        bl_number: `BL-${Date.now().toString().slice(-6)}`,
        bl_date: new Date().toISOString().split('T')[0],
        payment_type: 'direct_sale',
        total_amount: 0,
        depot_id: depots[0]?.id || ''
      });
      fetchData();
    } catch (err) {
      alert("Erreur: " + err.message);
    } finally {
      setIsSubmitting(false);
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
              onClick={() => setShowBLModal(true)}
              className="px-6 py-3 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus size={16} /> Nouveau BL
            </button>
            
            <button 
              onClick={fetchData}
              className="px-6 py-3 bg-white border-2 border-emerald-100 text-gray-600 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-emerald-50 active:scale-95 transition-all flex items-center gap-2"
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

      {/* BL Modal */}
      {showBLModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-950/20 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-emerald-50 flex justify-between items-center bg-emerald-50/30">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100">
                  <FileText className="text-white" size={20} />
                </div>
                <h3 className="text-xl font-black text-emerald-900 uppercase tracking-widest">Nouveau Bon de Livraison (BL)</h3>
                <button 
                  type="button"
                  onClick={fetchSuppliersAndProducts}
                  className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                  title="Rafraîchir les listes"
                >
                  <Search size={16} />
                </button>
              </div>
              <button onClick={() => setShowBLModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <form onSubmit={handleSaveBL} className="space-y-8">
                {/* BL Info */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-emerald-700 uppercase ml-2 tracking-widest">Fournisseur</label>
                    <select 
                      required
                      className="w-full bg-emerald-50/30 border-2 border-emerald-50 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500/20"
                      value={blFormData.supplier_id}
                      onChange={e => setBLFormData({...blFormData, supplier_id: e.target.value})}
                    >
                      <option value="">Choisir un fournisseur</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-emerald-700 uppercase ml-2 tracking-widest">N° Bon de Livraison</label>
                    <input 
                      type="text"
                      required
                      className="w-full bg-emerald-50/30 border-2 border-emerald-50 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500/20"
                      value={blFormData.bl_number}
                      onChange={e => setBLFormData({...blFormData, bl_number: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-emerald-700 uppercase ml-2 tracking-widest">Date du BL</label>
                    <input 
                      type="date"
                      required
                      className="w-full bg-emerald-50/30 border-2 border-emerald-50 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500/20"
                      value={blFormData.bl_date}
                      onChange={e => setBLFormData({...blFormData, bl_date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-emerald-700 uppercase ml-2 tracking-widest">Dépôt Destination</label>
                    <select 
                      required
                      className="w-full bg-emerald-50/30 border-2 border-emerald-50 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500/20"
                      value={blFormData.depot_id}
                      onChange={e => setBLFormData({...blFormData, depot_id: e.target.value})}
                    >
                      {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Add Items Form */}
                <div className="bg-emerald-50/20 p-6 rounded-[2.5rem] border border-emerald-50">
                  <h4 className="text-[11px] font-black text-emerald-800 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <Plus size={14} /> Ajouter des articles
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Désignation Produit</label>
                      <select 
                        className="w-full bg-white border-2 border-emerald-50 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                        value={newItem.product_id}
                        onChange={e => {
                          const p = products.find(prod => prod.id === e.target.value);
                          setNewItem({...newItem, product_id: e.target.value, purchase_price_per_unit: p?.purchase_price || ''});
                        }}
                      >
                        <option value="">{isSubmitting ? "Chargement des produits..." : `Sélectionner un produit (${products.length})`}</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name || p.designation || 'Sans nom'} (Stock actuel: {formatStock(p.stock_quantity, p)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Quantité</label>
                      <input 
                        type="number"
                        className="w-full bg-white border-2 border-emerald-50 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                        value={newItem.quantity}
                        placeholder="Qté"
                        onChange={e => setNewItem({...newItem, quantity: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Unité</label>
                      <select
                        className="w-full bg-white border-2 border-emerald-50 rounded-xl px-2 py-2.5 text-[10px] font-bold outline-none"
                        value={newItem.unit}
                        onChange={e => setNewItem({...newItem, unit: e.target.value})}
                      >
                        <option value="base">{products.find(p => p.id === newItem.product_id)?.unite_base || 'Unité'}</option>
                        {products.find(p => p.id === newItem.product_id)?.unite_superieure && (
                          <option value="superior">{products.find(p => p.id === newItem.product_id)?.unite_superieure}</option>
                        )}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase ml-2">Prix d'Achat Unitaire</label>
                      <input 
                        type="number"
                        className="w-full bg-white border-2 border-emerald-50 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                        value={newItem.purchase_price_per_unit}
                        onChange={e => setNewItem({...newItem, purchase_price_per_unit: e.target.value})}
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={addItemToBL}
                      className="bg-emerald-600 text-white font-black py-3 rounded-xl hover:bg-emerald-700 transition-all text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>

                {/* Items List */}
                {blItems.length > 0 && (
                  <div className="border border-emerald-50 rounded-[2rem] overflow-hidden">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-emerald-50/50 border-b border-emerald-50">
                          <th className="px-6 py-4 text-[9px] font-black text-emerald-800 uppercase">Produit</th>
                          <th className="px-6 py-4 text-[9px] font-black text-emerald-800 uppercase text-center">Quantité</th>
                          <th className="px-6 py-4 text-[9px] font-black text-emerald-800 uppercase text-right">P.A.U</th>
                          <th className="px-6 py-4 text-[9px] font-black text-emerald-800 uppercase text-right">Total</th>
                          <th className="px-6 py-4 text-[9px] font-black text-emerald-800 uppercase text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-50">
                        {blItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-emerald-50/10">
                            <td className="px-6 py-3 text-xs font-bold text-gray-700">{item.productName}</td>
                            <td className="px-6 py-3 text-xs font-black text-emerald-600 text-center">{item.quantity} {item.unitName}</td>
                            <td className="px-6 py-3 text-xs font-bold text-gray-700 text-right">{parseFloat(item.purchase_price_per_unit).toLocaleString()} Ar</td>
                            <td className="px-6 py-3 text-xs font-black text-emerald-800 text-right">{item.total.toLocaleString()} Ar</td>
                            <td className="px-6 py-3 text-center">
                              <button onClick={() => removeItemFromBL(idx)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={16} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-emerald-50/30">
                          <td colSpan="3" className="px-6 py-4 text-[10px] font-black text-emerald-800 uppercase tracking-[0.2em] text-right">Total Général</td>
                          <td className="px-6 py-4 text-sm font-black text-emerald-900 text-right">{blFormData.total_amount.toLocaleString()} Ar</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                <div className="flex justify-end gap-4 pt-6">
                  <button 
                    type="button" 
                    onClick={() => setShowBLModal(false)}
                    className="px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-all"
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting || blItems.length === 0}
                    className="px-10 py-4 bg-emerald-600 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-emerald-200 hover:bg-emerald-700 disabled:bg-gray-200 disabled:shadow-none transition-all flex items-center gap-3"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <><CheckCircle2 size={18} /> Enregistrer le BL</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

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
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100">Fournisseur</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100">N° BL</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100">Désignation</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100 text-center">Qté</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100">Unité</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100 text-right">P.A.U</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100 text-right">P.A.T</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100">Dépôt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50">
                  {withSupplierData.length > 0 ? withSupplierData.map((item) => (
                    <tr key={item.id} className="hover:bg-emerald-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-700">{new Date(item.delivery_notes?.bl_date || item.created_at).toLocaleDateString()}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-black text-emerald-700 uppercase">{item.delivery_notes?.fournisseurs?.name || 'Inconnu'}</p>
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
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="9" className="p-20 text-center text-gray-400 font-bold uppercase text-[10px] tracking-widest">Aucune donnée trouvée</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-emerald-50/50">
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100">Dates</th>
                    <th className="px-6 py-5 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100">Motif</th>
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
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{item.reason || '-'}</p>
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
                      <td colSpan="8" className="p-20 text-center text-gray-400 font-bold uppercase text-[10px] tracking-widest">Aucune donnée trouvée</td>
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
