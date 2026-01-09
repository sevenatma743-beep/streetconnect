'use client'
import { useState, useEffect } from 'react'
import { ShoppingCart, Heart, Trash2, ChevronLeft, ChevronRight, ChevronDown, X, ExternalLink, Filter } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Shop() {
  const { user } = useAuth()
  
  // Tabs
  const [activeTab, setActiveTab] = useState('curation') // 'curation' ou 'marketplace'
  
  // Commun
  const [selectedCategory, setSelectedCategory] = useState('Tous')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  
  // Curation (Amazon)
  const [curatedProducts, setCuratedProducts] = useState([])
  const [selectedCuratedProduct, setSelectedCuratedProduct] = useState(null)
  
  // Marketplace (P2P)
  const [marketplaceProducts, setMarketplaceProducts] = useState([])
  const [favorites, setFavorites] = useState([])
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    category: 'Équipement',
    affiliate_url: ''
  })
  const [selectedImages, setSelectedImages] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  const [productImageIndexes, setProductImageIndexes] = useState({})

  useEffect(() => {
    loadCuratedProducts()
    loadMarketplaceProducts()
    if (user) loadFavorites()
  }, [user])

  // ===== CURATION (Amazon) =====
  
  async function loadCuratedProducts() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .is('user_id', null) // Produits sans user_id = curation
        .order('category', { ascending: true })
        .order('name', { ascending: true})

      if (error) throw error
      setCuratedProducts(data || [])
    } catch (e) {
      console.error('Erreur chargement produits curés:', e)
    } finally {
      setLoading(false)
    }
  }

  // ===== MARKETPLACE (P2P) =====
  
  async function loadMarketplaceProducts() {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .not('user_id', 'is', null) // Produits avec user_id = marketplace
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setMarketplaceProducts(data || [])
    } catch (e) {
      console.error('Erreur chargement marketplace:', e)
    }
  }

  async function loadFavorites() {
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('product_id')
        .eq('user_id', user.id)
      
      if (error) throw error
      setFavorites((data || []).map(f => f.product_id))
    } catch (e) {
      console.error('Erreur chargement favoris:', e)
    }
  }

  async function toggleFavorite(productId) {
    if (!user) return alert('Connecte-toi pour ajouter des favoris !')
    
    try {
      const isFavorite = favorites.includes(productId)
      
      if (isFavorite) {
        await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', productId)
        
        setFavorites(favorites.filter(id => id !== productId))
      } else {
        await supabase
          .from('favorites')
          .insert({ user_id: user.id, product_id: productId })
        
        setFavorites([...favorites, productId])
      }
    } catch (e) {
      console.error('Erreur toggle favori:', e)
    }
  }

  function handleImageSelect(e) {
    const files = Array.from(e.target.files).slice(0, 3)
    setSelectedImages(files)
    
    const previews = files.map(file => URL.createObjectURL(file))
    setImagePreviews(previews)
  }

  function removeImage(index) {
    setSelectedImages(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  async function uploadImages() {
    if (selectedImages.length === 0) return []
    
    const uploadedUrls = []
    
    for (const file of selectedImages) {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { upsert: true })
      
      if (error) throw error
      
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName)
      
      uploadedUrls.push(publicUrl)
    }
    
    return uploadedUrls
  }

  async function handleAddProduct(e) {
    e.preventDefault()
    if (!user) return alert('Connecte-toi pour vendre !')
    
    try {
      setUploading(true)
      
      const imageUrls = await uploadImages()
      
      await supabase
        .from('products')
        .insert({
          name: newProduct.name,
          description: newProduct.description,
          price: parseFloat(newProduct.price),
          category: newProduct.category,
          images: imageUrls.length > 0 ? imageUrls : ['https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=400&fit=crop'],
          image_url: imageUrls[0] || 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=400&fit=crop',
          affiliate_url: newProduct.affiliate_url || '#',
          user_id: user.id
        })
      
      alert('✅ Produit ajouté !')
      setShowAddProduct(false)
      setNewProduct({ name: '', description: '', price: '', category: 'Équipement', affiliate_url: '' })
      setSelectedImages([])
      setImagePreviews([])
      await loadMarketplaceProducts()
    } catch (e) {
      console.error('Erreur ajout produit:', e)
      alert('❌ Erreur')
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteProduct(productId) {
    if (!confirm('Supprimer ce produit ?')) return
    
    try {
      await supabase
        .from('products')
        .delete()
        .eq('id', productId)
        .eq('user_id', user.id)
      
      await loadMarketplaceProducts()
    } catch (e) {
      console.error('Erreur suppression:', e)
    }
  }

  function handleCategorySelect(category) {
    setSelectedCategory(category)
    setShowFilterDropdown(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Catégories dynamiques selon l'onglet actif
  const products = activeTab === 'curation' ? curatedProducts : marketplaceProducts
  const allCategories = [...new Set(products.map(p => p.category))].sort()
  const categories = ['Tous', ...allCategories]

  // Filtrage
  const filteredProducts = products.filter(product => {
    const matchCategory = selectedCategory === 'Tous' || product.category === selectedCategory
    const matchSearch = !searchQuery || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.brand && product.brand.toLowerCase().includes(searchQuery.toLowerCase()))
    
    return matchCategory && matchSearch
  })

  return (
    <>
      {/* Modal Ajout Produit (Marketplace) */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-street-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-white">Vendre un article</h2>
              <button
                onClick={() => setShowAddProduct(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Photos (3 max)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-street-700 file:text-white hover:file:bg-street-600"
                />
                
                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {imagePreviews.map((preview, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden">
                        <img src={preview} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Titre *
                </label>
                <input
                  type="text"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                  className="w-full px-4 py-2 bg-street-900 border border-street-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-street-accent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Description *
                </label>
                <textarea
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                  className="w-full px-4 py-2 bg-street-900 border border-street-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-street-accent resize-none"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Prix (€) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                  className="w-full px-4 py-2 bg-street-900 border border-street-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-street-accent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Catégorie *
                </label>
                <select
                  value={newProduct.category}
                  onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                  className="w-full px-4 py-2 bg-street-900 border border-street-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-street-accent"
                >
                  <option>Équipement</option>
                  <option>Vêtements</option>
                  <option>Accessoires</option>
                  <option>Nutrition</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Contact (email, tél, ou lien)
                </label>
                <input
                  type="text"
                  value={newProduct.affiliate_url}
                  onChange={(e) => setNewProduct({...newProduct, affiliate_url: e.target.value})}
                  placeholder="contact@email.com ou 06..."
                  className="w-full px-4 py-2 bg-street-900 border border-street-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-street-accent"
                />
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full bg-street-accent text-street-900 font-bold py-3 rounded-lg hover:bg-street-accentHover disabled:opacity-50 transition"
              >
                {uploading ? 'Envoi...' : '✅ Publier'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Détail Produit Amazon */}
      {selectedCuratedProduct && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-street-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-white">{selectedCuratedProduct.name}</h2>
              <button
                onClick={() => setSelectedCuratedProduct(null)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="aspect-square bg-street-900 rounded-xl overflow-hidden flex items-center justify-center">
                <img
                  src={selectedCuratedProduct.image_url}
                  alt={selectedCuratedProduct.name}
                  className="w-full h-full object-contain"
                  onError={(e) => e.target.src = 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=400&fit=crop'}
                />
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-street-accent font-semibold uppercase">
                      {selectedCuratedProduct.category}
                    </span>
                    {selectedCuratedProduct.brand && (
                      <span className="text-xs text-gray-500 font-medium">
                        {selectedCuratedProduct.brand}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    {selectedCuratedProduct.name}
                  </h3>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {selectedCuratedProduct.description}
                  </p>
                </div>

                {selectedCuratedProduct.price && (
                  <div className="bg-street-900 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Prix indicatif (peut varier)</p>
                    <p className="text-2xl font-bold text-white">
                      {selectedCuratedProduct.price.toFixed(2)}€
                    </p>
                  </div>
                )}

                <a
                  href={selectedCuratedProduct.affiliate_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full block text-center px-6 py-3 bg-street-accent text-street-900 font-bold rounded-lg hover:bg-street-accentHover transition"
                >
                  Voir prix actuel sur Amazon →
                </a>

                <p className="text-xs text-gray-500 text-center">
                  En tant que Partenaire Amazon, StreetConnect réalise un bénéfice sur les achats remplissant les conditions requises
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contenu Principal */}
      <div className="max-w-7xl mx-auto p-4 pb-24 space-y-6">
        {/* Header - SHOP uniquement */}
        <h1 className="font-display text-2xl font-bold text-street-accent">
          SHOP
        </h1>

        {/* Recherche + Filtres */}
        <div className="space-y-3 mb-6">
          {/* Barre recherche */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Rechercher par nom ou marque..."
              className="w-full px-4 py-3 bg-street-800 border border-street-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-street-accent placeholder-gray-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
          
          {/* Bouton Filter uniquement */}
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-2 px-4 py-2.5 bg-street-800 border border-street-700 text-white rounded-lg hover:border-street-accent transition font-semibold"
            >
              <Filter size={16} />
              <span className="text-sm">
                {selectedCategory === 'Tous' ? 'Filtre' : selectedCategory}
              </span>
              <ChevronDown size={16} className={`transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Catégories */}
            {showFilterDropdown && (
              <div className="absolute top-full left-0 mt-2 w-56 bg-street-800 border border-street-700 rounded-lg shadow-xl z-10 max-h-64 overflow-y-auto">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => handleCategorySelect(cat)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition ${
                      selectedCategory === cat
                        ? 'bg-street-accent text-street-900 font-bold'
                        : 'text-white hover:bg-street-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => {
              setActiveTab('curation')
              setSelectedCategory('Tous')
            }}
            className={`flex-1 py-3 rounded-lg font-bold transition ${
              activeTab === 'curation'
                ? 'bg-street-accent text-street-900'
                : 'bg-street-800 text-gray-400 border border-street-700'
            }`}
          >
            ⭐ Curation
          </button>
          <button
            onClick={() => {
              setActiveTab('marketplace')
              setSelectedCategory('Tous')
            }}
            className={`flex-1 py-3 rounded-lg font-bold transition ${
              activeTab === 'marketplace'
                ? 'bg-street-accent text-street-900'
                : 'bg-street-800 text-gray-400 border border-street-700'
            }`}
          >
            🛒 Marketplace
          </button>
        </div>

        {/* Banner Vente (Marketplace uniquement) */}
        {activeTab === 'marketplace' && (
          <div className="mb-6 bg-gradient-to-r from-street-800 to-street-700 rounded-2xl p-4 border border-street-accent/30 flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-base">
                Vends ton matos ou trouve des bonnes affaires
              </p>
              <p className="text-xs text-gray-400">
                100% gratuit • Aucune commission
              </p>
            </div>
            <button
              onClick={() => setShowAddProduct(true)}
              className="bg-street-accent text-street-900 font-bold px-5 py-2.5 rounded-lg hover:bg-street-accentHover transition whitespace-nowrap"
            >
              ➕ Vendre
            </button>
          </div>
        )}

        {/* Grille Produits */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">Chargement...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-2">Aucun produit trouvé</p>
            {(searchQuery || selectedCategory !== 'Tous') && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSelectedCategory('Tous')
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="text-street-accent hover:underline text-sm"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Compteur résultats */}
            {(searchQuery || selectedCategory !== 'Tous') && (
              <div className="text-sm text-gray-400 mb-4">
                {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''} trouvé{filteredProducts.length > 1 ? 's' : ''}
              </div>
            )}
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map(product => {
              if (activeTab === 'curation') {
                // CURATION (Amazon)
                return (
                  <div
                    key={product.id}
                    onClick={() => setSelectedCuratedProduct(product)}
                    className="bg-street-800 border border-street-700 rounded-xl overflow-hidden cursor-pointer hover:border-street-accent transition group"
                  >
                    <div className="aspect-square bg-street-900 flex items-center justify-center overflow-hidden">
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-contain group-hover:scale-105 transition"
                        onError={(e) => e.target.src = 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=400&fit=crop'}
                      />
                    </div>

                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-street-accent font-semibold uppercase">
                          {product.category}
                        </div>
                        {product.brand && (
                          <div className="text-xs text-gray-500 font-medium">
                            {product.brand}
                          </div>
                        )}
                      </div>
                      
                      <h3 className="font-semibold text-white line-clamp-2">
                        {product.name}
                      </h3>
                      <p className="text-sm text-gray-400 line-clamp-2">
                        {product.description}
                      </p>
                      
                      {/* Prix indicatif */}
                      {product.price && (
                        <div className="text-sm text-gray-400 italic">
                          Prix indicatif : {product.price.toFixed(2)}€
                        </div>
                      )}
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(product.affiliate_url, '_blank')
                        }}
                        className="w-full mt-2 px-4 py-2 bg-street-accent text-street-900 font-bold rounded-lg hover:bg-street-accentHover transition flex items-center justify-center space-x-2"
                      >
                        <span>Voir sur Amazon</span>
                        <ExternalLink size={16} />
                      </button>
                    </div>
                  </div>
                )
              } else {
                // MARKETPLACE (P2P)
                const isFavorite = favorites.includes(product.id)
                const isOwner = user && product.user_id === user.id
                const productImages = product.images || [product.image_url]
                const currentImageIndex = productImageIndexes[product.id] || 0
                
                return (
                  <div 
                    key={product.id} 
                    className="bg-street-800 rounded-2xl p-4 border border-street-700 hover:border-street-accent transition-all group relative"
                  >
                    <div className="absolute top-2 right-2 z-10 flex gap-2">
                      {user && (
                        <button
                          onClick={() => toggleFavorite(product.id)}
                          className="bg-street-900/80 backdrop-blur-sm p-2 rounded-full hover:scale-110 transition-transform"
                        >
                          <Heart 
                            size={18} 
                            className={isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'} 
                          />
                        </button>
                      )}
                      {isOwner && (
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="bg-red-500/80 backdrop-blur-sm p-2 rounded-full hover:scale-110 transition-transform"
                        >
                          <Trash2 size={18} className="text-white" />
                        </button>
                      )}
                    </div>

                    <div className="aspect-square rounded-xl bg-street-900 overflow-hidden mb-3 relative">
                      <img 
                        src={productImages[currentImageIndex]} 
                        alt={product.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" 
                      />
                      
                      {productImages.length > 1 && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setProductImageIndexes(prev => ({
                                ...prev,
                                [product.id]: (prev[product.id] || 0) === 0 ? productImages.length - 1 : (prev[product.id] || 0) - 1
                              }))
                            }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 p-1 rounded-full hover:bg-black/70 transition"
                          >
                            <ChevronLeft size={16} className="text-white" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setProductImageIndexes(prev => ({
                                ...prev,
                                [product.id]: (prev[product.id] || 0) === productImages.length - 1 ? 0 : (prev[product.id] || 0) + 1
                              }))
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 p-1 rounded-full hover:bg-black/70 transition"
                          >
                            <ChevronRight size={16} className="text-white" />
                          </button>
                          
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                            {productImages.map((_, i) => (
                              <div
                                key={i}
                                className={`w-1.5 h-1.5 rounded-full ${i === currentImageIndex ? 'bg-white' : 'bg-white/40'}`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    <span className="text-[10px] font-bold text-street-accent uppercase tracking-wider">
                      {product.category}
                    </span>

                    <h3 className="font-bold text-sm text-white mt-1 line-clamp-2 min-h-[2.5rem]">
                      {product.name}
                    </h3>

                    <p className="text-xs text-gray-400 line-clamp-2 mt-2 h-8">
                      {product.description}
                    </p>

                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-lg font-black text-white">
                        {product.price.toFixed(2)}€
                      </span>
                      {product.affiliate_url && product.affiliate_url !== '#' ? (
                        <a 
                          href={
                            product.affiliate_url.startsWith('http') 
                              ? product.affiliate_url 
                              : product.affiliate_url.includes('@')
                              ? `mailto:${product.affiliate_url}`
                              : `tel:${product.affiliate_url.replace(/\s/g, '')}`
                          }
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="bg-street-accent text-street-900 w-9 h-9 rounded-lg flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-lg"
                        >
                          <ShoppingCart size={20} strokeWidth={3} />
                        </a>
                      ) : (
                        <div className="bg-gray-700 w-9 h-9 rounded-lg flex items-center justify-center cursor-not-allowed opacity-50">
                          <ShoppingCart size={20} strokeWidth={3} className="text-gray-500" />
                        </div>
                      )}
                    </div>
                  </div>
                )
              }
            })}
          </div>
          </>
        )}

        {/* Disclaimer (Curation uniquement) */}
        {activeTab === 'curation' && (
          <div className="text-center text-xs text-gray-500 pt-6 border-t border-street-700 mt-8">
            <p>Prix indicatifs - Voir conditions sur Amazon</p>
            <p className="mt-1">StreetConnect participe au Programme Partenaires d'Amazon EU</p>
          </div>
        )}
      </div>
    </>
  )
}