import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Plus, Search, Edit2, Trash2, Package, Tag, Layers, Truck, 
  Loader2, Warehouse, History, X, ChevronDown, FileText, 
  LayoutGrid, List 
} from 'lucide-react';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [unites, setUnites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false); 
  const [selectedProductForStock, setSelectedProductForStock] = useState(null); 
  const [stockFormData, setStockFormData] = useState({ type: 'in', quantity: '', reason: '', unit: 'base', entry_type: 'physique' });
  const [stockHistoryModal, setStockHistoryModal] = useState(false); 
  const [selectedProductForHistory, setSelectedProductForHistory] = useState(null); 
  const [stockMovements, setStockMovements] = useState([]); 
  const [selectedMovementProduct, setSelectedMovementProduct] = useState(''); 
  const [formData, setFormData] = useState({ 
    name: '', price: '', stock_quantity: '', category_id: '', fournisseur_id: '', description: '',
    unite_base: 'unité', unite_superieure: '', quantite_par_unite: 1,
    unite_standard_id: ''
  });
  const [editingProduct, setEditingProduct] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState('products'); 
  const [productViewMode, setProductViewMode] = useState('grid');
  const [credits, setCredits] = useState([]);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [paymentFormData, setPaymentFormData] = useState({ delivery_note_id: '', amount: '', payment_method: 'cash', notes: '' });

  // ... (inside the component return, specifically after Credit Modal)

      {/* Invoice Preview Modal */}
      {previewInvoice && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 print:hidden">
          <style>{`
            @media print {
              body > *:not(#printable-invoice-container) { display: none !important; }
              #printable-invoice-container { display: block !important; position: absolute; left: 0; top: 0; width: 100%; }
            }
          `}</style>
          <div id="printable-invoice-container" className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 print:hidden">
              <h3 className="font-black text-gray-800">Prévisualisation de la facture</h3>
              <div className="flex gap-2">
                <button onClick={() => setPreviewInvoice(null)} className="px-4 py-2 text-sm font-bold text-gray-500">Fermer</button>
                <button onClick={() => window.print()} className="px-6 py-2 bg-emerald-600 text-white font-black rounded-xl text-sm">Imprimer</button>
              </div>
            </div>
            <div className="p-10 overflow-y-auto flex-1 print:p-0">
                <div id="printable-invoice" className="text-gray-800">
                    <h1 className="text-3xl font-black text-emerald-800 mb-6">Bon de Livraison</h1>
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div>
                            <p className="text-xs uppercase font-bold text-gray-400">Fournisseur</p>
                            <p className="font-bold">{previewInvoice.fournisseurs?.name}</p>
                        </div>
                        <div>
                            <p className="text-xs uppercase font-bold text-gray-400">Date</p>
                            <p className="font-bold">{new Date(previewInvoice.bl_date).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div className="border-t border-b border-gray-200 py-4 mb-4">
                        <div className="flex justify-between font-black text-lg">
                            <span>Total</span>
                            <span>{parseFloat(previewInvoice.total_amount).toLocaleString()} MGA</span>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}

  // Delivery Note States
  const [showDeliveryNoteModal, setShowDeliveryNoteModal] = useState(false);
  const [deliveryNoteFormData, setDeliveryNoteFormData] = useState({
    supplier_id: '',
    bl_date: new Date().toISOString().split('T')[0],
    total_amount: 0,
    payment_type: 'direct_sale',
    credit_frequency: '', // 'daily' or 'monthly'
    advance_amount: 0
  });
  const [deliveryNoteItems, setDeliveryNoteItems] = useState([]);
  const [newItemFormData, setNewItemFormData] = useState({
    product_id: '',
    quantity: '',
    purchase_price_per_unit: '',
    selling_price_per_unit: '',
    unit: 'base'
  });
  const [showPhysicalChoiceModal, setShowPhysicalChoiceModal] = useState(false);
  const [physicalSearchTerm, setPhysicalSearchTerm] = useState('');

  const fetchCredits = async () => {
    console.log("Fetching credits...");
    const { data, error } = await supabase
      .from('delivery_notes')
      .select(`
        *, 
        fournisseurs!delivery_notes_supplier_id_fkey(name), 
        supplier_payments!supplier_payments_delivery_note_id_fkey(amount)
      `)
      .eq('payment_type', 'credit')
      .order('bl_date', { ascending: false });

    if (error) {
      console.error("Error fetching credits details:", JSON.stringify(error, null, 2));
      alert("Erreur de chargement des crédits : " + error.message);
      return;
    }
    
    console.log("Fetched credits data:", data);

    if (data) {
      const formattedCredits = data.map(bl => {
        const totalPaid = (bl.supplier_payments ? bl.supplier_payments.reduce((acc, p) => acc + parseFloat(p.amount), 0) : 0) + parseFloat(bl.advance_amount || 0);
        return { ...bl, totalPaid, remaining: parseFloat(bl.total_amount) - totalPaid };
      });
      setCredits(formattedCredits);
    }
  };

  const handlePayCredit = async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('supplier_payments').insert([{
      ...paymentFormData,
      user_id: user.id
    }]);

    if (error) alert(error.message);
    else {
      console.log("Payment recorded. Finding BL to print:", paymentFormData.delivery_note_id);
      const blToPrint = credits.find(c => c.id === paymentFormData.delivery_note_id);
      console.log("BL Found for printing:", blToPrint);
      
      setShowCreditModal(false);
      setPaymentFormData({ delivery_note_id: '', amount: '', payment_method: 'cash', notes: '' });
      fetchCredits();
      
      if (blToPrint) {
        setTimeout(() => {
          setPreviewInvoice(blToPrint);
        }, 100);
      }
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: prods } = await supabase.from('produits').select('*, categories(name), fournisseurs(name), unites_standards(*)');
      const { data: cats } = await supabase.from('categories').select('*').order('name');
      const { data: sups } = await supabase.from('fournisseurs').select('*').order('name');
      const { data: units } = await supabase.from('unites_standards').select('*').order('nom');
      
      if (prods) {
        setProducts(prods);
        setFilteredProducts(prods);
      }
      if (cats) setCategories(cats);
      if (sups) setSuppliers(sups);
      if (units) setUnites(units);
    } catch (err) {
      console.error("Erreur critique chargement données:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    let currentProducts = [...products];

    if (searchTerm) {
      currentProducts = currentProducts.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory) {
      currentProducts = currentProducts.filter(p => p.category_id === selectedCategory);
    }

    setFilteredProducts(currentProducts);
  }, [products, searchTerm, selectedCategory]);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const inputQuantity = parseInt(formData.stock_quantity) || 0;
    const factor = parseInt(formData.quantite_par_unite) || 1;
    const stockQty = inputQuantity * factor;

    if (stockQty < 0) {
      alert("La quantité en stock ne peut pas être négative.");
      setIsSubmitting(false);
      return;
    }

    const payload = {
      name: formData.name,
      price: parseFloat(formData.price) || 0,
      stock_quantity: stockQty,
      category_id: formData.category_id || null,
      fournisseur_id: formData.fournisseur_id || null,
      description: formData.description || '',
      quantite_par_unite: parseInt(formData.quantite_par_unite) || 1,
      unite_base: formData.unite_base || 'unité',
      unite_superieure: formData.unite_superieure || '',
      unite_standard_id: (formData.unite_standard_id && formData.unite_standard_id !== "") ? formData.unite_standard_id : null
    };

    Object.keys(payload).forEach(key => payload[key] === null && delete payload[key]);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Vous devez être connecté pour gérer le stock.");
      setIsSubmitting(false);
      return;
    }

    if (editingProduct) {
      const oldStockQuantity = editingProduct.stock_quantity;
      const stockDifference = stockQty - oldStockQuantity;

      const { error } = await supabase
        .from('produits')
        .update(payload)
        .eq('id', editingProduct.id);
      
      if (error) alert(error.message);
      else {
        if (stockDifference !== 0) {
          await supabase.from('stock_movements').insert([
            {
              product_id: editingProduct.id,
              type: stockDifference > 0 ? 'in' : 'out',
              quantity: Math.abs(stockDifference),
              price_at_movement: editingProduct.price,
              reason: stockDifference > 0 ? 'Mise à jour (Entrée)' : 'Mise à jour (Sortie)',
              user_id: user.id
            }
          ]);
        }
        resetForm();
        fetchData();
      }
    } else {
      const { data: newProduct, error } = await supabase.from('produits').insert([{ 
        ...payload, 
        user_id: user.id
      }]).select().single();
      if (error) alert(error.message);
      else {
        if (newProduct.stock_quantity > 0) {
          await supabase.from('stock_movements').insert([
            {
              product_id: newProduct.id,
              type: 'in',
              quantity: newProduct.stock_quantity,
              price_at_movement: newProduct.price,
              reason: 'Nouvel ajout de produit (Entrée initiale)',
              user_id: user.id
            }
          ]);
        }
        resetForm();
        fetchData();
      }
    }
    setIsSubmitting(false);
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price,
      stock_quantity: product.stock_quantity,
      category_id: product.category_id || '',
      fournisseur_id: product.fournisseur_id || '',
      description: product.description || '',
      unite_base: product.unite_base || 'unité',
      unite_superieure: product.unite_superieure || '',
      quantite_par_unite: product.quantite_par_unite || 1,
      unite_standard_id: product.unite_standard_id || ''
    });
    setShowModal(true);
  };

  const handleUniteStandardChange = (unitId) => {
    const selectedUnit = unites.find(u => u.id === unitId);
    if (selectedUnit) {
      setFormData(prev => ({
        ...prev,
        unite_standard_id: unitId,
        unite_base: selectedUnit.unite_mesure,
        unite_superieure: selectedUnit.nom,
        quantite_par_unite: selectedUnit.facteur
      }));
    } else {
      setFormData(prev => ({ ...prev, unite_standard_id: '' }));
    }
  };

  const resetForm = () => {
    setFormData({ name: '', price: '', stock_quantity: '', category_id: '', fournisseur_id: '', description: '', unite_base: 'unité', unite_superieure: '', quantite_par_unite: 1, unite_standard_id: '' });
    setEditingProduct(null);
    setShowModal(false);
  };

  const deleteProduct = async (id) => {
    if (confirm('Supprimer ce produit ?')) {
      await supabase.from('produits').delete().eq('id', id);
      fetchData();
    }
  };

  const updateMovementQuantity = async (movementId, newQuantity) => {
    if (isNaN(newQuantity) || newQuantity < 0) {
      alert("Quantité invalide");
      return;
    }
    const { error } = await supabase
      .from('stock_movements')
      .update({ quantity: newQuantity })
      .eq('id', movementId);

    if (error) {
      alert("Erreur mise à jour: " + error.message);
    } else {
      fetchData();
    }
  };

  const handleStockSave = async (e) => {
    e.preventDefault();
    if (!selectedProductForStock || !stockFormData.quantity) return;

    let quantity = parseInt(stockFormData.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      alert("Veuillez entrer une quantité valide.");
      return;
    }

    if (stockFormData.unit === 'superieure') {
      quantity = quantity * (selectedProductForStock.quantite_par_unite || 1);
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Vous devez être connecté pour gérer le stock.");
      return;
    }

    let newStock = selectedProductForStock.stock_quantity;
    if (stockFormData.type === 'in') {
      newStock += quantity;
    } else {
      newStock -= quantity;
    }

    if (newStock < 0) {
      alert("Le stock ne peut pas être négatif.");
      return;
    }

    const { error: productUpdateError } = await supabase
      .from('produits')
      .update({ stock_quantity: newStock })
      .eq('id', selectedProductForStock.id);

    if (productUpdateError) {
      alert("Erreur mise à jour stock produit: " + productUpdateError.message);
      return;
    }

    const { error: movementInsertError } = await supabase
      .from('stock_movements')
      .insert([
        {
          product_id: selectedProductForStock.id,
          type: stockFormData.type,
          quantity: quantity,
          price_at_movement: selectedProductForStock.price,
          reason: `[${stockFormData.entry_type.toUpperCase()}] ` + stockFormData.reason + (stockFormData.unit === 'superieure' ? ` (${stockFormData.quantity} ${selectedProductForStock.unite_superieure})` : ''),
          user_id: user.id
        }
      ]);

    if (movementInsertError) {
      alert("Erreur enregistrement mouvement stock: " + movementInsertError.message);
      return;
    }

    setStockFormData({ type: 'in', quantity: '', reason: '', unit: 'base', entry_type: 'physique' });
    setSelectedProductForStock(null);
    setShowStockModal(false);
    fetchData();
  };

  const fetchStockMovements = async (productId = null) => {
    let query = supabase
      .from('stock_movements')
      .select('*, products:product_id(name, unite_base)')
      .order('created_at', { ascending: false });

    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data, error } = await query;

    if (error) {
      alert("Erreur chargement historique stock: " + error.message);
      return [];
    }
    return data;
  };

  useEffect(() => {
    if (viewMode === 'movements') {
      setLoading(true);
      fetchStockMovements().then(data => {
        setStockMovements(data);
        setLoading(false);
      });
    }
  }, [viewMode]);

  useEffect(() => {
    if (stockHistoryModal && selectedProductForHistory) {
      fetchStockMovements(selectedProductForHistory.id).then(setStockMovements);
    }
  }, [stockHistoryModal, selectedProductForHistory]);

  // Delivery Note Handlers
  const addNewItem = () => {
    if (!newItemFormData.product_id || !newItemFormData.quantity || !newItemFormData.purchase_price_per_unit) {
      alert("Veuillez remplir tous les champs de l'article");
      return;
    }

    const product = products.find(p => p.id === newItemFormData.product_id);
    const newItem = {
      ...newItemFormData,
      productName: product.name,
      total_purchase: parseFloat(newItemFormData.purchase_price_per_unit) * parseInt(newItemFormData.quantity)
    };

    setDeliveryNoteItems([...deliveryNoteItems, newItem]);
    setDeliveryNoteFormData({
      ...deliveryNoteFormData,
      total_amount: deliveryNoteFormData.total_amount + newItem.total_purchase
    });
    setNewItemFormData({
      product_id: '',
      quantity: '',
      purchase_price_per_unit: '',
      selling_price_per_unit: '',
      unit: 'base'
    });
  };

  const removeItem = (index) => {
    const itemToRemove = deliveryNoteItems[index];
    setDeliveryNoteItems(deliveryNoteItems.filter((_, i) => i !== index));
    setDeliveryNoteFormData({
      ...deliveryNoteFormData,
      total_amount: deliveryNoteFormData.total_amount - itemToRemove.total_purchase
    });
  };

  const handleSaveDeliveryNote = async (e) => {
    e.preventDefault();
    if (!deliveryNoteFormData.supplier_id || deliveryNoteItems.length === 0) {
      alert("Veuillez sélectionner un fournisseur et ajouter au moins un article.");
      return;
    }

    setIsSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();

    try {
      // 1. Create the delivery note
      const { data: bl, error: blError } = await supabase
        .from('delivery_notes')
        .insert([{
          supplier_id: deliveryNoteFormData.supplier_id,
          bl_date: deliveryNoteFormData.bl_date,
          total_amount: deliveryNoteFormData.total_amount,
          payment_type: deliveryNoteFormData.payment_type,
          credit_frequency: deliveryNoteFormData.payment_type === 'credit' ? deliveryNoteFormData.credit_frequency : null,
          advance_amount: parseFloat(deliveryNoteFormData.advance_amount) || 0,
          user_id: user.id
        }])
        .select()
        .single();

      if (blError) throw blError;

      // 1b. Record initial advance payment if credit
      const advance = parseFloat(deliveryNoteFormData.advance_amount);
      console.log("Attempting to record advance payment...", { 
        delivery_note_id: bl.id, 
        amount: advance,
        type: deliveryNoteFormData.payment_type 
      });
      
      if (deliveryNoteFormData.payment_type === 'credit' && advance > 0) {
        const { error: paymentError } = await supabase
          .from('supplier_payments')
          .insert([{
            delivery_note_id: bl.id,
            amount: advance,
            payment_method: 'cash',
            notes: 'Avance initiale lors de la création du BL',
            user_id: user.id
          }]);
        
        if (paymentError) {
          console.error("Payment insert error:", paymentError);
          throw paymentError;
        } else {
          console.log("Advance payment recorded successfully!");
        }
      }

      // 2. Create line items and update stock
      for (const item of deliveryNoteItems) {
        const { error: itemError } = await supabase
          .from('delivery_note_items')
          .insert([{
            delivery_note_id: bl.id,
            product_id: item.product_id,
            quantity: parseInt(item.quantity),
            purchase_price_per_unit: parseFloat(item.purchase_price_per_unit),
            selling_price_per_unit: parseFloat(item.selling_price_per_unit) || null,
            line_total_purchase: item.total_purchase,
            unit: item.unit
          }]);

        if (itemError) throw itemError;

        const product = products.find(p => p.id === item.product_id);
        
        // Calculate quantity to add: if unit is 'superieure', multiply by factor
        const quantityToAdd = item.unit === 'superieure' 
          ? parseInt(item.quantity) * (product.quantite_par_unite || 1) 
          : parseInt(item.quantity);

        const newStock = product.stock_quantity + quantityToAdd;
        const updatePayload = { stock_quantity: newStock };
        if (item.selling_price_per_unit) {
          updatePayload.price = parseFloat(item.selling_price_per_unit);
        }

        const { error: productUpdateError } = await supabase
          .from('produits')
          .update(updatePayload)
          .eq('id', item.product_id);

        if (productUpdateError) throw productUpdateError;

        await supabase.from('stock_movements').insert([{
          product_id: item.product_id,
          type: 'in',
          quantity: quantityToAdd,
          price_at_movement: parseFloat(item.purchase_price_per_unit) / (item.unit === 'superieure' ? (product.quantite_par_unite || 1) : 1),
          reason: `Réception BL #${bl.id.slice(0,8)}`,
          user_id: user.id
        }]);
      }

      alert("Bon de Livraison enregistré avec succès !");
      setShowDeliveryNoteModal(false);
      setDeliveryNoteItems([]);
      setDeliveryNoteFormData({
        supplier_id: '',
        bl_date: new Date().toISOString().split('T')[0],
        total_amount: 0,
        payment_type: 'direct_sale',
        credit_frequency: '',
        advance_amount: 0
      });
      fetchData();
    } catch (error) {
      alert("Erreur: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatStock = (quantity, p) => {
    const q = Number(quantity) || 0;
    const qpu = Number(p.quantite_par_unite) || 1;
    const uSup = p.unite_superieure || 'Cartons';
    const uBase = p.unite_base || 'paquet';

    if (qpu > 1) {
      const superior = Math.floor(q / qpu);
      const base = q % qpu;
      return `${superior} ${uSup} (${qpu}${uBase}) + ${base} ${uBase}`;
    }
    return `${q} ${uBase}`;
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-emerald-50 gap-4">
        <div className="flex-1 flex flex-col sm:flex-row gap-4 max-w-2xl">
          {viewMode === 'products' && (
            <>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Rechercher un produit..." 
                  className="w-full bg-white border border-emerald-100 rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-emerald-500/10 transition-all outline-none" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select 
                className="bg-white border border-emerald-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">Toutes les catégories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </>
          )}
        </div>

        <div className="flex bg-emerald-50/50 p-1 rounded-2xl border border-emerald-50/50 w-full sm:w-auto items-center gap-1">
          <button 
            onClick={() => setViewMode('products')}
            className={`flex-1 py-2 px-4 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${viewMode === 'products' ? 'bg-emerald-600 text-white shadow-lg' : 'text-emerald-600 hover:bg-emerald-50'}`}
          >
            Produits
          </button>
          <button 
            onClick={() => setViewMode('movements')}
            className={`flex-1 py-2 px-4 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${viewMode === 'movements' ? 'bg-orange-500 text-white shadow-lg' : 'text-orange-500 hover:bg-orange-50'}`}
          >
            Mouvements
          </button>
          
          {viewMode === 'products' && (
            <div className="flex bg-white rounded-xl p-0.5 border border-emerald-100 ml-2">
              <button 
                onClick={() => setProductViewMode('grid')} 
                className={`p-1.5 rounded-lg transition-all ${productViewMode === 'grid' ? 'bg-emerald-50 text-emerald-600' : 'text-gray-400'}`}
              >
                <LayoutGrid size={16} />
              </button>
              <button 
                onClick={() => setProductViewMode('table')} 
                className={`p-1.5 rounded-lg transition-all ${productViewMode === 'table' ? 'bg-emerald-50 text-emerald-600' : 'text-gray-400'}`}
              >
                <List size={16} />
              </button>
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
            <button 
              onClick={() => { fetchCredits(); setShowCreditModal(true); }}
              className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-purple-200 active:scale-95"
            >
              <FileText size={16} /> <span>Suivi Crédits</span>
            </button>
            <button 
              onClick={() => setShowPhysicalChoiceModal(true)} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-200 active:scale-95"
            >
              <Package size={16} /> <span>Approvisionnement</span>
            </button>
            <button 
              onClick={() => setShowDeliveryNoteModal(true)} 
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-200 active:scale-95"
            >
              <FileText size={16} /> <span>Réception BL</span>
            </button>
        </div>
      </div>

      {/* Credit Modal */}
      {showCreditModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-emerald-900/40 backdrop-blur-md p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-emerald-100">
            <div className="p-8 border-b border-emerald-50 flex justify-between items-center bg-emerald-50/30">
              <h3 className="text-2xl font-black text-gray-800 tracking-tight">Suivi des Crédits Fournisseurs</h3>
              <button onClick={() => setShowCreditModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-400 hover:text-red-500 transition-all text-2xl">&times;</button>
            </div>
            <div className="p-8 max-h-[70vh] overflow-y-auto">
              {credits.length > 0 ? (
                <ul className="space-y-4">
                  {credits.map(c => (
                    <li key={c.id} className="bg-white border border-emerald-50 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <p className="text-lg font-black text-gray-800">{c.fournisseurs?.name || 'Fournisseur inconnu'}</p>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">BL du {new Date(c.bl_date).toLocaleDateString()} | Total: {parseFloat(c.total_amount).toLocaleString()} MGA</p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-black text-emerald-600">Échéance</p>
                          {(() => {
                            const dueDate = new Date(new Date(c.bl_date).getTime() + (c.credit_frequency === 'monthly' ? 30 : 1) * 24 * 60 * 60 * 1000);
                            const today = new Date();
                            const isOverdue = dueDate < today;
                            const isSoon = !isOverdue && (dueDate - today) < (3 * 24 * 60 * 60 * 1000);
                            
                            return (
                                <div className="flex flex-col items-end">
                                    <p className="text-xs font-bold text-gray-600">{dueDate.toLocaleDateString()}</p>
                                    {isOverdue && <span className="text-[9px] font-black uppercase text-red-600 bg-red-50 px-2 py-0.5 rounded-full mt-1">Retard</span>}
                                    {isSoon && <span className="text-[9px] font-black uppercase text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full mt-1">Proche</span>}
                                </div>
                            );
                          })()}
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-black text-gray-400">Reste à payer</p>
                          <p className="text-lg font-black text-red-600">{c.remaining.toLocaleString()} MGA</p>
                        </div>
                        <button 
                          onClick={() => {
                            console.log("Printing invoice for:", c);
                            setPreviewInvoice(c);
                          }}
                          className="bg-gray-100 text-gray-600 font-black px-4 py-3 rounded-2xl text-xs hover:bg-gray-200 transition-all"
                        >
                          Imprimer
                        </button>
                        <button 
                          onClick={() => setPaymentFormData({...paymentFormData, delivery_note_id: c.id})}
                          className="bg-emerald-600 text-white font-black px-6 py-3 rounded-2xl text-xs hover:bg-emerald-700 transition-all"
                        >
                          Encaisser paiement
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-center text-gray-400 py-10 font-bold">Aucun crédit en cours.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Payment Entry Form (within Credit Modal or separate, simple implementation here) */}
      {paymentFormData.delivery_note_id && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <form onSubmit={handlePayCredit} className="bg-white p-8 rounded-3xl w-full max-w-sm space-y-4">
            <h3 className="text-xl font-black text-gray-800">Enregistrer paiement</h3>
            <input required type="number" placeholder="Montant payé" className="w-full bg-emerald-50 rounded-2xl px-4 py-3" value={paymentFormData.amount} onChange={e => setPaymentFormData({...paymentFormData, amount: e.target.value})} />
            <select className="w-full bg-emerald-50 rounded-2xl px-4 py-3" value={paymentFormData.payment_method} onChange={e => setPaymentFormData({...paymentFormData, payment_method: e.target.value})}>
                <option value="cash">Espèces</option>
                <option value="transfer">Virement</option>
            </select>
            <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setPaymentFormData({...paymentFormData, delivery_note_id: ''})} className="flex-1 py-3 font-bold text-gray-400">Annuler</button>
                <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white font-black rounded-2xl">Enregistrer</button>
            </div>
          </form>
        </div>
      )}

      <div className="relative z-10 pb-64">
        {viewMode === 'products' && (
          productViewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {loading ? (
                <p className="col-span-full text-center py-20 text-gray-400">Chargement de l'inventaire...</p>
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map((p) => (
                  <div key={p.id} className="bg-white/60 backdrop-blur-md border border-emerald-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all group min-w-0">
                    <div className="flex justify-between items-start mb-3">
                      <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                        <Package size={20} />
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {setSelectedProductForStock(p); setShowStockModal(true);}} 
                          className="p-1.5 text-gray-400 hover:text-emerald-600 transition-colors"
                          title="Gérer le stock"
                        >
                          <Warehouse size={14} />
                        </button>
                        <button 
                          onClick={() => {setSelectedProductForHistory(p); setStockHistoryModal(true);}} 
                          className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Historique des mouvements"
                        >
                          <History size={14} />
                        </button>
                        <button onClick={() => handleEdit(p)} className="p-1.5 text-gray-400 hover:text-emerald-600 transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => deleteProduct(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <h4 className="text-base font-bold text-gray-800 truncate">{p.name}</h4>
                    <div className="flex flex-wrap gap-1 mb-2">
                      <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <Tag size={9} /> {p.categories?.name || 'Sans catégorie'}
                      </p>
                      {p.fournisseurs && (
                        <p className="text-[9px] text-blue-600 font-bold uppercase tracking-wider flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-full">
                          <Truck size={9} /> {p.fournisseurs.name}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2 h-8">
                      {p.description || 'Aucune description.'}
                    </p>
                    {p.unite_superieure && p.quantite_par_unite > 1 && (
                      <p className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded-lg mt-2 inline-block">
                        {p.quantite_par_unite} {p.unite_base} par {p.unite_superieure}
                      </p>
                    )}
                    
                    <div className="mt-4 pt-4 border-t border-emerald-50 flex justify-between items-end">
                      <div>
                        <p className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">Prix par {p.unite_base || 'unité'}</p>
                        <p className="text-lg font-black text-gray-800">{Number(p.price).toLocaleString('fr-MG')} MGA</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-gray-400 uppercase font-bold tracking-widest mb-1">Stock</p>
                        <span className={`px-2 py-0.5 rounded-lg font-bold text-xs ${p.stock_quantity < 10 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {formatStock(p.stock_quantity, p)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-20 bg-white/40 border-2 border-dashed border-emerald-100 rounded-3xl">
                  <Layers className="mx-auto text-emerald-200 mb-4" size={48} />
                  <p className="text-gray-500 font-medium">Aucun produit trouvé.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white/60 backdrop-blur-md border border-emerald-100 rounded-3xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-emerald-50/50 text-[10px] font-black text-emerald-800 uppercase tracking-widest border-b border-emerald-100">
                      <th className="p-4 pl-6">Produit</th>
                      <th className="p-4">Catégorie</th>
                      <th className="p-4">Stock</th>
                      <th className="p-4">Prix</th>
                      <th className="p-4 pr-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-50">
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-emerald-50/10 transition-colors text-sm group">
                        <td className="p-4 pl-6">
                          <div className="font-bold text-gray-800">{p.name}</div>
                        </td>
                        <td className="p-4">
                          <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold">{p.categories?.name || '-'}</span>
                        </td>
                        <td className="p-4">
                          <span className={`font-bold ${p.stock_quantity < 10 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {formatStock(p.stock_quantity, p)}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-gray-800">
                          {Number(p.price).toLocaleString('fr-MG')} MGA
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => {setSelectedProductForStock(p); setShowStockModal(true);}} className="p-2 text-gray-400 hover:text-emerald-600 transition-colors" title="Gérer le stock"><Warehouse size={16} /></button>
                            <button onClick={() => {setSelectedProductForHistory(p); setStockHistoryModal(true);}} className="p-2 text-gray-400 hover:text-blue-600 transition-colors" title="Historique"><History size={16} /></button>
                            <button onClick={() => handleEdit(p)} className="p-2 text-gray-400 hover:text-emerald-600 transition-colors" title="Modifier"><Edit2 size={16} /></button>
                            <button onClick={() => deleteProduct(p.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors" title="Supprimer"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </div>

      {viewMode === 'movements' && (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-3xl shadow-sm flex items-center justify-between">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Total Entrées</p>
              <p className="text-xl font-black text-gray-800">{stockMovements.filter(m => m.type === 'in').reduce((acc, m) => acc + m.quantity, 0)} unités</p>
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Total Sorties</p>
              <p className="text-xl font-black text-gray-800">{stockMovements.filter(m => m.type === 'out').reduce((acc, m) => acc + m.quantity, 0)} unités</p>
            </div>
            <select 
              className="bg-white border border-emerald-100 rounded-xl px-4 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500/10"
              value={selectedMovementProduct}
              onChange={(e) => setSelectedMovementProduct(e.target.value)}
            >
              <option value="">Tous les produits</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="bg-white/60 backdrop-blur-md border border-emerald-100 rounded-3xl p-5 shadow-sm overflow-x-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-6">Historique des Mouvements de Stock</h3>
            {loading ? (
              <p className="text-center py-10 text-gray-400">Chargement des mouvements...</p>
            ) : stockMovements.filter(m => !selectedMovementProduct || m.product_id === selectedMovementProduct).length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] uppercase text-emerald-700 border-b border-emerald-100">
                    <th className="p-3">Produit</th>
                    <th className="p-3 text-center">In (Entrée)</th>
                    <th className="p-3 text-center">Out (Sortie)</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Raison</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50">
                  {stockMovements.filter(m => !selectedMovementProduct || m.product_id === selectedMovementProduct).map(m => (
                    <tr key={m.id} className="text-xs hover:bg-emerald-50/30">
                      <td className="p-3 font-bold text-gray-800">{m.products?.name}</td>
                      <td className="p-3 text-center text-emerald-600 font-black">
                        {m.type === 'in' ? (
                          <input 
                            type="number" 
                            className="w-16 border rounded px-1 text-center" 
                            defaultValue={m.quantity} 
                            onBlur={(e) => updateMovementQuantity(m.id, parseInt(e.target.value))}
                          />
                        ) : '-'}
                      </td>
                      <td className="p-3 text-center text-orange-600 font-black">
                        {m.type === 'out' ? (
                          <input 
                            type="number" 
                            className="w-16 border rounded px-1 text-center" 
                            defaultValue={m.quantity} 
                            onBlur={(e) => updateMovementQuantity(m.id, parseInt(e.target.value))}
                          />
                        ) : '-'}
                      </td>
                      <td className="p-3 text-gray-500">{new Date(m.created_at).toLocaleDateString()}</td>
                      <td className="p-3 text-gray-500 italic">{m.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-center text-gray-500">Aucun mouvement enregistré.</p>
            )}
          </div>
        </div>
      )}

      {/* Product Management Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-900/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-emerald-50 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">
                {editingProduct ? 'Modifier le PPN' : 'Ajouter un nouveau PPN'}
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-6">
              <input required placeholder="Nom du produit" className="w-full bg-gray-50 border-0 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-emerald-500/20" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Configuration & Stock</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Stock actuel</label>
                    <input required type="number" placeholder="Quantité" className="w-full bg-gray-50 border-0 rounded-2xl px-5 py-4 outline-none" value={formData.stock_quantity} onChange={e => setFormData({...formData, stock_quantity: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Unité Standard</label>
                    <select className="w-full bg-gray-50 border-0 rounded-2xl px-5 py-4 outline-none text-sm text-gray-600" value={formData.unite_standard_id || ''} onChange={e => handleUniteStandardChange(e.target.value)}>
                      <option value="">Aucune</option>
                      {unites.map(u => <option key={u.id} value={u.id}>{u.nom}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">
                      Prix (MGA) {formData.unite_base ? `/ ${formData.unite_base}` : ''}
                    </label>
                    <input required type="number" placeholder={`Prix ${formData.unite_base ? '(' + formData.unite_base + ')' : ''}`} className="w-full bg-gray-50 border-0 rounded-2xl px-5 py-4 outline-none" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Catégorie</label>
                    <select className="w-full bg-gray-50 border-0 rounded-2xl px-5 py-4 outline-none text-sm text-gray-600" value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}>
                      <option value="">Sélectionner...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Paramètres de conditionnement</h4>
                <div className="grid grid-cols-3 gap-3">
                  <input type="number" readOnly={!!formData.unite_standard_id} placeholder="Qté/unité" className={`w-full ${formData.unite_standard_id ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50'} border-0 rounded-2xl px-4 py-3 outline-none`} value={formData.quantite_par_unite} onChange={e => setFormData({...formData, quantite_par_unite: e.target.value})} />
                  <input type="text" readOnly={!!formData.unite_standard_id} placeholder="Unité base" className={`w-full ${formData.unite_standard_id ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50'} border-0 rounded-2xl px-4 py-3 outline-none`} value={formData.unite_base} onChange={e => setFormData({...formData, unite_base: e.target.value})} />
                  <input type="text" readOnly={!!formData.unite_standard_id} placeholder="Unité sup" className={`w-full ${formData.unite_standard_id ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50'} border-0 rounded-2xl px-4 py-3 outline-none`} value={formData.unite_superieure} onChange={e => setFormData({...formData, unite_superieure: e.target.value})} />
                </div>
              </div>
              
              {formData.unite_standard_id && formData.stock_quantity && (
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center">
                  <p className="text-[10px] uppercase font-black text-emerald-600 tracking-widest">Stock total converti</p>
                  <p className="text-xl font-black text-emerald-900 mt-1">
                    {parseInt(formData.stock_quantity) * (unites.find(u => u.id === formData.unite_standard_id)?.facteur || 1)} 
                    <span className="text-sm font-bold ml-1">{unites.find(u => u.id === formData.unite_standard_id)?.unite_mesure}</span>
                  </p>
                </div>
              )}

              <button type="submit" disabled={isSubmitting} className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl shadow-lg mt-4 active:scale-[0.98] transition-all">
                {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={20} /> : (editingProduct ? "Mettre à jour" : "Enregistrer")}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Stock Management Modal */}
      {showStockModal && selectedProductForStock && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-900/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-emerald-50 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">
                Gérer le stock de "{selectedProductForStock.name}"
              </h3>
              <button onClick={() => {setShowStockModal(false); setSelectedProductForStock(null); setStockFormData({ type: 'in', quantity: '', reason: '', unit: 'base', entry_type: 'physique' });}} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <form onSubmit={handleStockSave} className="p-8 space-y-4">
              <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200">
                <button 
                  type="button"
                  onClick={() => setStockFormData(prev => ({ ...prev, type: 'in' }))}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${stockFormData.type === 'in' ? 'bg-emerald-600 text-white shadow-lg' : 'text-emerald-600 hover:bg-emerald-50'}`}
                >
                  Entrée
                </button>
                <button 
                  type="button"
                  onClick={() => setStockFormData(prev => ({ ...prev, type: 'out' }))}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${stockFormData.type === 'out' ? 'bg-orange-500 text-white shadow-lg' : 'text-orange-500 hover:bg-orange-50'}`}
                >
                  Sortie
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Type d'entrée</label>
                  <select 
                    className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all text-sm font-bold"
                    value={stockFormData.entry_type}
                    onChange={e => setStockFormData(prev => ({ ...prev, entry_type: e.target.value }))}
                  >
                    <option value="physique">📦 Stock physique</option>
                    <option value="bl">📄 Par BL (Bon de Livraison)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Quantité</label>
                  <input 
                    type="number" 
                    placeholder="Quantité" 
                    required 
                    className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" 
                    value={stockFormData.quantity} 
                    onChange={e => setStockFormData(prev => ({ ...prev, quantity: e.target.value }))} 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Unité</label>
                  <select 
                    className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all font-bold"
                    value={stockFormData.unit}
                    onChange={e => setStockFormData(prev => ({ ...prev, unit: e.target.value }))}
                  >
                    <option value="base">{selectedProductForStock.unite_base || 'Unité de base'}</option>
                    {selectedProductForStock.unite_superieure && (
                      <option value="superieure">{selectedProductForStock.unite_superieure}</option>
                    )}
                  </select>
                </div>
              </div>

              {stockFormData.quantity && stockFormData.unit === 'superieure' && selectedProductForStock.quantite_par_unite > 1 && (
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center animate-in fade-in slide-in-from-top-1">
                  <p className="text-[10px] uppercase font-black text-emerald-600 tracking-widest">Conversion automatique</p>
                  <p className="text-lg font-black text-emerald-900 mt-1">
                    {stockFormData.quantity} {selectedProductForStock.unite_superieure} = {parseInt(stockFormData.quantity) * selectedProductForStock.quantite_par_unite} 
                    <span className="text-sm font-bold ml-1">{selectedProductForStock.unite_base}</span>
                  </p>
                </div>
              )}
              <textarea 
                placeholder="Raison du mouvement (facultatif)" 
                className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all min-h-[80px]" 
                value={stockFormData.reason} 
                onChange={e => setStockFormData(prev => ({ ...prev, reason: e.target.value }))}
              ></textarea>
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-100 mt-4 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Enregistrer le mouvement"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Stock History Modal */}
      {stockHistoryModal && selectedProductForHistory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-900/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-emerald-50 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">
                Historique de stock pour "{selectedProductForHistory.name}"
              </h3>
              <button onClick={() => {setStockHistoryModal(false); setSelectedProductForHistory(null); setStockMovements([]);}} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="p-8 max-h-[70vh] overflow-y-auto">
              {stockMovements.length > 0 ? (
                <ul className="space-y-4">
                  {stockMovements.map(movement => (
                    <li key={movement.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-800">
                          <span className={`text-[10px] font-black uppercase mr-2 px-2 py-0.5 rounded-full ${movement.type === 'in' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                            {movement.type === 'in' ? 'Entrée' : 'Sortie'}
                          </span>
                          {movement.quantity} {selectedProductForHistory.unite_base || 'unité(s)'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Le: {new Date(movement.created_at).toLocaleString()}
                        </p>
                        {movement.reason && <p className="text-xs text-gray-600 mt-1 italic">Raison: "{movement.reason}"</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-center text-gray-500">Aucun mouvement de stock enregistré.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delivery Note Modal */}
      {showDeliveryNoteModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-emerald-900/40 backdrop-blur-md p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-emerald-100">
            <div className="p-8 border-b border-emerald-50 flex justify-between items-center bg-emerald-50/30">
              <div>
                <h3 className="text-2xl font-black text-gray-800 tracking-tight">Nouveau Bon de Livraison</h3>
                <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest mt-1">Enregistrement des achats</p>
              </div>
              <button onClick={() => {setShowDeliveryNoteModal(false); setDeliveryNoteFormData({ supplier_id: '', bl_date: new Date().toISOString().split('T')[0], total_amount: 0, payment_type: 'direct_sale', credit_frequency: '', advance_amount: 0 }); setDeliveryNoteItems([]);}} className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-400 hover:text-red-500 transition-all text-2xl">&times;</button>
            </div>
            
            <form onSubmit={handleSaveDeliveryNote} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Fournisseur</label>
                  <select 
                    className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all text-sm font-bold"
                    value={deliveryNoteFormData.supplier_id}
                    onChange={e => setDeliveryNoteFormData({...deliveryNoteFormData, supplier_id: e.target.value})}
                  >
                    <option value="">Sélectionner un fournisseur</option>
                    {suppliers.map(sup => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Date du BL</label>
                  <input 
                    type="date" 
                    className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all text-sm font-bold" 
                    value={deliveryNoteFormData.bl_date}
                    onChange={e => setDeliveryNoteFormData({...deliveryNoteFormData, bl_date: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Type de Paiement</label>
                  <select 
                    className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all text-sm font-bold"
                    value={deliveryNoteFormData.payment_type}
                    onChange={e => setDeliveryNoteFormData({...deliveryNoteFormData, payment_type: e.target.value})}
                  >
                    <option value="direct_sale">Vente Directe</option>
                    <option value="credit">Crédit</option>
                  </select>
                </div>
                {deliveryNoteFormData.payment_type === 'credit' && (
                  <>
                    <div>
                      <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Échéance</label>
                      <select 
                        className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all text-sm font-bold"
                        value={deliveryNoteFormData.credit_frequency || ''}
                        onChange={e => setDeliveryNoteFormData({...deliveryNoteFormData, credit_frequency: e.target.value})}
                      >
                        <option value="">Sélectionner échéance</option>
                        <option value="daily">Journalier</option>
                        <option value="monthly">Mensuel</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Avance</label>
                      <input 
                        type="number" 
                        placeholder="Montant avance" 
                        className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all text-sm" 
                        value={deliveryNoteFormData.advance_amount} 
                        onChange={e => setDeliveryNoteFormData({...deliveryNoteFormData, advance_amount: e.target.value})} 
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="pt-4 border-t border-emerald-50">
                <h4 className="text-xl font-black text-gray-800 mb-6">Ajouter un produit</h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-black uppercase text-emerald-600 mb-1 block">Produit</label>
                    <select 
                      className="w-full bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-4 outline-none transition-all font-bold"
                      value={newItemFormData.product_id}
                      onChange={e => {
                        const selectedProduct = products.find(p => p.id === e.target.value);
                        setNewItemFormData({
                          ...newItemFormData, 
                          product_id: e.target.value, 
                          purchase_price_per_unit: '', 
                          selling_price_per_unit: selectedProduct?.price || ''
                        });
                      }}
                    >
                      <option value="">Sélectionner un produit...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  
                  <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="text-[11px] font-black uppercase text-emerald-600 mb-1 block">Quantité</label>
                          <input type="number" placeholder="0" className="w-full bg-white border border-emerald-100 rounded-2xl px-4 py-3" value={newItemFormData.quantity} onChange={e => setNewItemFormData({...newItemFormData, quantity: e.target.value})} />
                      </div>
                      <div>
                          <label className="text-[11px] font-black uppercase text-emerald-600 mb-1 block">Unité</label>
                          <select 
                              className="w-full bg-white border border-emerald-100 rounded-2xl px-4 py-3 font-bold" 
                              value={newItemFormData.unit} 
                              onChange={e => setNewItemFormData({...newItemFormData, unit: e.target.value})}
                          >
                              <option value="base">{products.find(p => p.id === newItemFormData.product_id)?.unite_base || 'Unité base'}</option>
                              {products.find(p => p.id === newItemFormData.product_id)?.unite_superieure && (
                                  <option value="superieure">{products.find(p => p.id === newItemFormData.product_id)?.unite_superieure}</option>
                              )}
                          </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="text-[11px] font-black uppercase text-emerald-600 mb-1 block">Prix Achat</label>
                          <input type="number" placeholder="0 MGA" className="w-full bg-white border border-emerald-100 rounded-2xl px-4 py-3" value={newItemFormData.purchase_price_per_unit} onChange={e => setNewItemFormData({...newItemFormData, purchase_price_per_unit: e.target.value})} />
                      </div>
                      <div>
                          <label className="text-[11px] font-black uppercase text-emerald-600 mb-1 block">Prix Vente</label>
                          <input type="number" placeholder="0 MGA" className="w-full bg-white border border-emerald-100 rounded-2xl px-4 py-3" value={newItemFormData.selling_price_per_unit} onChange={e => setNewItemFormData({...newItemFormData, selling_price_per_unit: e.target.value})} />
                      </div>
                    </div>
                    
                    <button type="button" onClick={addNewItem} className="w-full bg-emerald-600 text-white font-black py-3 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">
                      Ajouter cette ligne
                    </button>
                  </div>
                </div>
                
                {deliveryNoteItems.length > 0 && (
                  <div className="mt-8">
                    <h4 className="text-[10px] font-black uppercase text-gray-400 mb-3 tracking-widest">Articles ajoutés</h4>
                    <ul className="space-y-3">
                      {deliveryNoteItems.map((item, index) => (
                        <li key={index} className="bg-white p-4 rounded-2xl border border-emerald-50 flex items-center justify-between shadow-sm">
                          <div>
                            <p className="font-black text-gray-800">{item.productName}</p>
                            <p className="text-xs text-gray-500 font-bold">{item.quantity} {item.unit} • Achat: {item.purchase_price_per_unit} MGA</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-black text-emerald-600">{item.total_purchase.toLocaleString()} MGA</span>
                            <button onClick={() => removeItem(index)} className="text-gray-300 hover:text-red-500 p-2"><Trash2 size={18} /></button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-emerald-50 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-600">Total Brut:</span>
                <span className="text-lg font-black text-gray-800">{deliveryNoteFormData.total_amount.toLocaleString('fr-MG')} MGA</span>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-lg mt-4 active:scale-[0.98] transition-all">
                {isSubmitting ? <Loader2 className="animate-spin mx-auto" size={20} /> : "Enregistrer le Bon de Livraison"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Physical Choice Modal */}
      {showPhysicalChoiceModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-emerald-900/40 backdrop-blur-md p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-emerald-100">
            <div className="p-8 border-b border-emerald-50 flex justify-between items-center bg-emerald-50/30">
              <div>
                <h3 className="text-2xl font-black text-gray-800 tracking-tight">Entrée de Stock Physique</h3>
                <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest mt-1">Sélectionnez ou créez un produit</p>
              </div>
              <button onClick={() => { setShowPhysicalChoiceModal(false); setPhysicalSearchTerm(''); }} className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-400 hover:text-red-500 transition-all text-2xl">&times;</button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={20} />
                  <input 
                    type="text" 
                    placeholder="Scanner ou rechercher un produit..." 
                    className="w-full bg-emerald-50/50 border-2 border-emerald-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:border-emerald-500 transition-all outline-none" 
                    value={physicalSearchTerm}
                    onChange={(e) => setPhysicalSearchTerm(e.target.value)}
                    autoFocus
                  />
                </div>
                
                {physicalSearchTerm && (
                  <div className="max-h-[300px] overflow-y-auto rounded-2xl border border-emerald-50 divide-y divide-emerald-50 bg-white">
                    {products.filter(p => p.name.toLowerCase().includes(physicalSearchTerm.toLowerCase())).map(p => (
                      <button 
                        key={p.id}
                        onClick={() => {
                          setSelectedProductForStock(p);
                          setShowStockModal(true);
                          setShowPhysicalChoiceModal(false);
                          setPhysicalSearchTerm('');
                        }}
                        className="w-full text-left p-4 hover:bg-emerald-50 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-gray-800">{p.name}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase">{p.categories?.name || 'Sans catégorie'}</p>
                        </div>
                        <ChevronDown size={18} className="text-emerald-200 -rotate-90" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative py-4 flex items-center">
                <div className="flex-grow border-t border-gray-100"></div>
                <span className="flex-shrink mx-4 text-[10px] font-black text-gray-300 uppercase">OU</span>
                <div className="flex-grow border-t border-gray-100"></div>
              </div>
              <button 
                onClick={() => {
                  setShowModal(true);
                  setShowPhysicalChoiceModal(false);
                  setPhysicalSearchTerm('');
                }}
                className="w-full bg-white border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3"
              >
                + Créer un nouveau produit
              </button>

              <button 
                onClick={() => {
                  alert("Fonctionnalité Transfert à développer");
                  setShowPhysicalChoiceModal(false);
                  setPhysicalSearchTerm('');
                }}
                className="w-full bg-white border-2 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 mt-4"
              >
                Transfert (Dépôt → Magasin)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
