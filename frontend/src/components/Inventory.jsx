import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Search, Edit2, Trash2, Package, Tag, Layers, Truck, Loader2 } from 'lucide-react';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', price: '', stock_quantity: '', category_id: '', fournisseur_id: '', description: '',
    unite_base: 'unité', unite_superieure: '', quantite_par_unite: 1
  });
  const [editingProduct, setEditingProduct] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch products with their categories and suppliers
      const { data: prods, error: prodError } = await supabase.from('produits').select('*, categories(name), fournisseurs(name)');
      if (prodError) throw prodError;
      
      const { data: cats, error: catError } = await supabase.from('categories').select('*').order('name');
      const { data: sups, error: supError } = await supabase.from('fournisseurs').select('*').order('name');
      
      if (prods) {
        // Enrich products locally or just show them
        setProducts(prods);
        setFilteredProducts(prods);
      }
      if (cats) setCategories(cats);
      if (sups) setSuppliers(sups);
    } catch (err) {
      console.error("Erreur critique chargement produits:", err);
      alert("Erreur Supabase: " + err.message);
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
    const stockQty = parseInt(formData.stock_quantity) || 0;
    if (stockQty < 0) {
      alert("La quantité en stock ne peut pas être négative.");
      setIsSubmitting(false);
      return;
    }

    const dataToSave = {
      ...formData,
      price: parseFloat(formData.price) || 0,
      stock_quantity: stockQty,
      quantite_par_unite: parseInt(formData.quantite_par_unite) || 1
    };
    
    if (editingProduct) {
      const { error } = await supabase
        .from('produits')
        .update(dataToSave)
        .eq('id', editingProduct.id);
      
      if (error) alert(error.message);
      else {
        resetForm();
        fetchData();
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('produits').insert([{ ...dataToSave, user_id: user.id }]);
      if (error) alert(error.message);
      else {
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
      quantite_par_unite: product.quantite_par_unite || 1
    });
    setShowModal(true);
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

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-emerald-50 gap-4">
        <div className="flex flex-col sm:flex-row gap-4 flex-1 max-w-2xl">
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
        </div>
        <button onClick={() => setShowModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg shadow-emerald-100">
          <Plus size={18} /> <span>Ajouter</span>
        </button>
      </div>

      {/* Grid Layout */}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-emerald-900/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-emerald-50 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">
                {editingProduct ? 'Modifier le PPN' : 'Ajouter un nouveau PPN'}
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-4">
              <input required placeholder="Nom du produit PPN (ex: Riz, Huile...)" className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <input required type="number" placeholder="Prix par unité de base (MGA)" className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
                <input required type="number" placeholder="Stock" className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none" value={formData.stock_quantity} onChange={e => setFormData({...formData, stock_quantity: e.target.value})} />
              </div>
              <p className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Paramètre de conditionnement (ex: 6 bouteille par Cartons)</p>
              <div className="grid grid-cols-3 gap-4">
                <input type="number" placeholder="Qté" className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none" value={formData.quantite_par_unite} onChange={e => setFormData({...formData, quantite_par_unite: e.target.value})} />
                <select required className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none" value={formData.unite_base} onChange={e => setFormData({...formData, unite_base: e.target.value})}>
                  <option value="unité">Unité</option>
                  <option value="Bouteille">Bouteille</option>
                  <option value="Paquet">Paquet</option>
                  <option value="Kg">Kg</option>
                </select>
                <select className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none" value={formData.unite_superieure} onChange={e => setFormData({...formData, unite_superieure: e.target.value})}>
                  <option value="">Sélectionner...</option>
                  <option value="Carton(s)">Carton(s)</option>
                  <option value="Sac">Sac</option>
                  <option value="Sachet">Sachet</option>
                  <option value="Pack">Pack</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Catégorie</label>
                  <select className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all text-sm appearance-none" value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}>
                    <option value="">Sélectionner...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-700 uppercase ml-1">Fournisseur</label>
                  <select className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all text-sm appearance-none" value={formData.fournisseur_id} onChange={e => setFormData({...formData, fournisseur_id: e.target.value})}>
                    <option value="">Sélectionner...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <textarea placeholder="Description..." className="w-full bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/10 transition-all min-h-[100px]" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
              <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-100 mt-4 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (editingProduct ? "Mettre à jour" : "Enregistrer le produit")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
