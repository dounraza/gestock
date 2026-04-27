import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Search, Edit2, Trash2, Package, Tag, Layers, Truck, Loader2, Warehouse, History, X } from 'lucide-react';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [unites, setUnites] = useState([]); // New state
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false); 
  const [selectedProductForStock, setSelectedProductForStock] = useState(null); 
  const [stockFormData, setStockFormData] = useState({ type: 'in', quantity: '', reason: '', unit: 'base' }); // Updated
  const [stockHistoryModal, setStockHistoryModal] = useState(false); 
  const [selectedProductForHistory, setSelectedProductForHistory] = useState(null); 
  const [stockMovements, setStockMovements] = useState([]); 
  const [selectedMovementProduct, setSelectedMovementProduct] = useState(''); 
  const [formData, setFormData] = useState({ 
    name: '', price: '', stock_quantity: '', category_id: '', fournisseur_id: '', description: '',
    unite_base: 'unité', unite_superieure: '', quantite_par_unite: 1
  });
  const [editingProduct, setEditingProduct] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState('products'); 

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: prods, error: prodError } = await supabase.from('produits').select('*, categories(name), fournisseurs(name), unites_standards(*)');
      const { data: cats, error: catError } = await supabase.from('categories').select('*').order('name');
      const { data: sups, error: supError } = await supabase.from('fournisseurs').select('*').order('name');
      const { data: units, error: unitError } = await supabase.from('unites_standards').select('*').order('nom');
      
      if (prodError) throw prodError;
      
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
    
    // Conversion sécurisée des données numériques
    const inputQuantity = parseInt(formData.stock_quantity) || 0;
    const factor = parseInt(formData.quantite_par_unite) || 1;
    const stockQty = inputQuantity * factor; // Calcul du stock total en unité de base

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

    // Suppression des clés avec valeur null
    Object.keys(payload).forEach(key => payload[key] === null && delete payload[key]);
    
    const { data: { user } } = await supabase.auth.getUser(); // Get current user
    if (!user) {
      alert("Vous devez être connecté pour gérer le stock.");
      setIsSubmitting(false);
      return;
    }

    if (editingProduct) {
      // Logic for updating an existing product
      const oldStockQuantity = editingProduct.stock_quantity;
      const stockDifference = stockQty - oldStockQuantity;

      const { error } = await supabase
        .from('produits')
        .update(payload)
        .eq('id', editingProduct.id);
      
      if (error) alert(error.message);
      else {
        // Record stock movement if stock quantity changed
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
      // Logic for adding a new product
      const { data: newProduct, error } = await supabase.from('produits').insert([{ 
        ...payload, 
        user_id: user.id
      }]).select().single();
      if (error) alert(error.message);
      else {
        // Record initial stock as an 'in' movement
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
    setFormData({ name: '', price: '', stock_quantity: '', category_id: '', fournisseur_id: '', description: '' });
    setEditingProduct(null);
    setShowModal(false);
  };

  const deleteProduct = async (id) => {
    if (confirm('Supprimer ce produit ?')) {
      await supabase.from('produits').delete().eq('id', id);
      fetchData();
    }
  };

  // Stock Management Functions
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
      fetchData(); // Refresh to ensure data consistency
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

    // Calcul de la quantité en unité de base si nécessaire
    if (stockFormData.unit === 'superieure') {
      const conv = conversions.find(c => c.product_id === selectedProductForStock.id);
      if (conv) {
        quantity = quantity * conv.facteur;
      } else {
        // Fallback sur le multiplicateur de base du produit si aucune ligne de conversion spécifique
        quantity = quantity * (selectedProductForStock.quantite_par_unite || 1);
      }
    }

    const { user } = await supabase.auth.getUser();
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

    // Update product stock
    const { error: productUpdateError } = await supabase
      .from('produits')
      .update({ stock_quantity: newStock })
      .eq('id', selectedProductForStock.id);

    if (productUpdateError) {
      alert("Erreur mise à jour stock produit: " + productUpdateError.message);
      return;
    }

    // Record stock movement
    const { error: movementInsertError } = await supabase
      .from('stock_movements')
      .insert([
        {
          product_id: selectedProductForStock.id,
          type: stockFormData.type,
          quantity: quantity,
          price_at_movement: selectedProductForStock.price,
          reason: stockFormData.reason + (stockFormData.unit === 'superieure' ? ` (${stockFormData.quantity} ${selectedProductForStock.unite_superieure})` : ''),
          user_id: user.id
        }
      ]);

    if (movementInsertError) {
      alert("Erreur enregistrement mouvement stock: " + movementInsertError.message);
      return;
    }

    setStockFormData({ type: 'in', quantity: '', reason: '', unit: 'base' });
    setSelectedProductForStock(null);
    setShowStockModal(false);
    fetchData(); // Refresh product list
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

        <div className="flex bg-emerald-50/50 p-1 rounded-2xl border border-emerald-50/50 w-full sm:w-auto">
          <button 
            onClick={() => setViewMode('products')}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${viewMode === 'products' ? 'bg-emerald-600 text-white shadow-lg' : 'text-emerald-600 hover:bg-emerald-50'}`}
          >
            Produits
          </button>
          <button 
            onClick={() => setViewMode('movements')}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${viewMode === 'movements' ? 'bg-orange-500 text-white shadow-lg' : 'text-orange-500 hover:bg-orange-50'}`}
          >
            Mouvements
          </button>
        </div>
        
        {viewMode === 'products' && (
          <button onClick={() => setShowModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg shadow-emerald-100">
            <Plus size={18} /> <span>Ajouter</span>
          </button>
        )}
      </div>

      {/* Conditional Rendering of Views */}
      {viewMode === 'products' && (
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
                      {p.stock_quantity} {p.unite_base || 'unité(s)'}
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
      )}

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
              
              {/* Calcul dynamique aligné */}
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
              <button onClick={() => {setShowStockModal(false); setSelectedProductForStock(null); setStockFormData({ type: 'in', quantity: '', reason: '' });}} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
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
                <input 
                  type="number" 
                  placeholder="Quantité" 
                  required 
                  className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" 
                  value={stockFormData.quantity} 
                  onChange={e => setStockFormData(prev => ({ ...prev, quantity: e.target.value }))} 
                />
                <select 
                  className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all"
                  value={stockFormData.unit}
                  onChange={e => setStockFormData(prev => ({ ...prev, unit: e.target.value }))}
                >
                  <option value="base">{selectedProductForStock.unite_base || 'Unité de base'}</option>
                  {selectedProductForStock.unite_superieure && (
                    <option value="superieure">{selectedProductForStock.unite_superieure}</option>
                  )}
                </select>
              </div>
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
    </div>
  );
}
