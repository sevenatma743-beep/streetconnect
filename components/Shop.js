'use client'
import { useState, useEffect } from 'react'
import { ShoppingCart, Heart, Trash2, ChevronLeft, ChevronRight, ChevronDown, X, ExternalLink, Filter } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const CURATION_ENABLED = false

export default function Shop({ onUserClick, onContactSeller, initialProductId, onProductOpened }) {
  const { user } = useAuth()

  // Tabs
  const [activeTab, setActiveTab] = useState('marketplace') // 'curation' ou 'marketplace'
  
  // Commun
  const [selectedCategory, setSelectedCategory] = useState('Tous')
  const [loading, setLoading] = useState(false)
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
  const [formError, setFormError] = useState('')
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    category: 'Équipement',
    city: '',
    listingType: 'vente'
  })
  const [selectedImages, setSelectedImages] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  const [productImageIndexes, setProductImageIndexes] = useState({})
  const [selectedMarketplaceProduct, setSelectedMarketplaceProduct] = useState(null)
  const [modalImageIndex, setModalImageIndex] = useState(0)

  // Signalement
  const [reportTarget, setReportTarget] = useState(null) // { type: 'product'|'user', id: uuid }
  const [reportReason, setReportReason] = useState('Arnaque')
  const [reportDetails, setReportDetails] = useState('')
  const [reportStatus, setReportStatus] = useState(null) // null | 'success' | 'duplicate' | 'error'

  useEffect(() => {
    if (CURATION_ENABLED) loadCuratedProducts()
    loadMarketplaceProducts()
    if (user) loadFavorites()
  }, [user])

  useEffect(() => {
    if (!initialProductId) return
    async function openProductById() {
      const { data } = await supabase
        .from('products')
        .select('*, profiles:user_id(id, username, avatar_url)')
        .eq('id', initialProductId)
        .single()
      if (data) {
        setSelectedMarketplaceProduct(data)
        setModalImageIndex(0)
      }
      if (onProductOpened) onProductOpened()
    }
    openProductById()
  }, [initialProductId])

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
      setLoading(true)
      const { data, error } = await supabase
        .from('products')
        .select('*, profiles:user_id(id, username, avatar_url)')
        .not('user_id', 'is', null) // Produits avec user_id = marketplace
        .order('created_at', { ascending: false })

      if (error) throw error
      setMarketplaceProducts(data || [])
    } catch (e) {
      console.error('Erreur chargement marketplace:', e)
    } finally {
      setLoading(false)
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

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  const MAX_SIZE_MB = 5

  function handleImageSelect(e) {
    const files = Array.from(e.target.files).slice(0, 3)

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setFormError('Format non accepté. Utilise JPG, PNG ou WebP.')
        return
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setFormError(`Chaque image doit faire moins de ${MAX_SIZE_MB} Mo.`)
        return
      }
    }

    setFormError('')
    setSelectedImages(files)
    setImagePreviews(files.map(file => URL.createObjectURL(file)))
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
    setFormError('')

    const isDon = newProduct.listingType === 'don'
    const parsedPrice = isDon ? 0 : parseFloat(newProduct.price.replace(',', '.'))
    if (!isDon && (isNaN(parsedPrice) || parsedPrice <= 0)) {
      setFormError('Le prix doit être supérieur à 0 €.')
      return
    }

    try {
      setUploading(true)

      const imageUrls = await uploadImages()

      await supabase
        .from('products')
        .insert({
          name: newProduct.name,
          description: newProduct.description,
          price: parsedPrice,
          category: newProduct.category,
          images: imageUrls.length > 0 ? imageUrls : ['https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=400&fit=crop'],
          image_url: imageUrls[0] || 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=400&fit=crop',
          city: newProduct.city || null,
          user_id: user.id
        })

      setShowAddProduct(false)
      setFormError('')
      setNewProduct({ name: '', description: '', price: '', category: 'Équipement', city: '', listingType: 'vente' })
      setSelectedImages([])
      setImagePreviews([])
      await loadMarketplaceProducts()
    } catch (e) {
      console.error('Erreur ajout produit:', e)
      setFormError('Une erreur est survenue. Réessaie.')
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

  function openReport(type, id) {
    setReportReason('Arnaque')
    setReportDetails('')
    setReportStatus(null)
    setReportTarget({ type, id })
  }

  function closeReport() {
    setReportTarget(null)
    setReportStatus(null)
    setReportDetails('')
    setReportReason('Arnaque')
  }

  async function handleSubmitReport() {
    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id,
      target_type: reportTarget.type,
      target_id: reportTarget.id,
      reason: reportReason,
      details: reportDetails || null
    })

    if (!error) {
      setReportStatus('success')
    } else if (error.code === '23505') {
      setReportStatus('duplicate')
    } else {
      setReportStatus('error')
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
        <div className="fixed inset-0 bg-black/90 z-[200] flex items-end md:items-center md:justify-center">
          <div
            className="bg-street-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-lg flex flex-col overflow-hidden"
            style={{ maxHeight: 'calc(100vh - 16px)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-street-700 flex-shrink-0">
              <h2 className="text-xl font-black text-white">Déposer une annonce</h2>
              <button
                onClick={() => { setShowAddProduct(false); setFormError('') }}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            {/* Body scrollable */}
            <form id="add-product-form" onSubmit={handleAddProduct} className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* Toggle Vente / Don */}
              <div className="flex gap-2">
                {['vente', 'don'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setNewProduct({ ...newProduct, listingType: type, price: '' })}
                    className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${
                      newProduct.listingType === type
                        ? 'bg-street-accent text-street-900'
                        : 'bg-street-900 border border-street-700 text-gray-400'
                    }`}
                  >
                    {type === 'vente' ? '💰 Vente' : '🎁 Don'}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Photos (3 max)
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleImageSelect}
                  className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-street-700 file:text-white hover:file:bg-street-600"
                />
                <p className="text-xs text-gray-500 mt-1">
                  JPG, PNG ou WebP · 5 Mo max · Sur mobile : maintiens appuyé pour sélectionner plusieurs photos
                </p>

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

              {newProduct.listingType === 'vente' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">
                    Prix (€) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="ex : 25 ou 9,99"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                    className="w-full px-4 py-2 bg-street-900 border border-street-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-street-accent"
                    required
                  />
                </div>
              )}

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
                  Ville *
                </label>
                <input
                  type="text"
                  value={newProduct.city}
                  onChange={(e) => setNewProduct({...newProduct, city: e.target.value})}
                  placeholder="ex : Paris, Lyon..."
                  className="w-full px-4 py-2 bg-street-900 border border-street-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-street-accent"
                  required
                />
              </div>

            </form>

            {/* Footer sticky */}
            <div
              className="p-4 border-t border-street-700 flex-shrink-0 space-y-3"
              style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <p className="text-xs text-gray-500 text-center">
                StreetConnect met en relation vendeurs et acheteurs. La transaction se fait entre particuliers, hors de la plateforme.
              </p>
              {formError && (
                <p className="text-red-400 text-sm text-center">{formError}</p>
              )}
              <button
                type="submit"
                form="add-product-form"
                disabled={uploading}
                className="w-full bg-street-accent text-street-900 font-bold py-3 rounded-lg hover:bg-street-accentHover disabled:opacity-50 transition"
              >
                {uploading ? 'Envoi...' : 'Publier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Détail Produit Amazon */}
      {CURATION_ENABLED && selectedCuratedProduct && (
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

      {/* Modal Détail Produit Marketplace */}
      {selectedMarketplaceProduct && (
        <div className="fixed inset-0 bg-black/90 z-[200] flex items-end md:items-center md:justify-center">
          <div
            className="bg-street-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-lg flex flex-col overflow-hidden"
            style={{ maxHeight: 'calc(100vh - 16px)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-street-700 flex-shrink-0">
              <span className="text-xs font-bold text-street-accent uppercase tracking-wider">
                {selectedMarketplaceProduct.category}
              </span>
              <button onClick={() => setSelectedMarketplaceProduct(null)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            {/* Body scrollable */}
            <div className="flex-1 overflow-y-auto">
              {/* Carousel grand format */}
              <div className="relative aspect-square bg-street-900">
                <img
                  src={(selectedMarketplaceProduct.images || [selectedMarketplaceProduct.image_url])[modalImageIndex]}
                  alt={selectedMarketplaceProduct.name}
                  className="w-full h-full object-cover"
                />
                {(selectedMarketplaceProduct.images || [selectedMarketplaceProduct.image_url]).length > 1 && (
                  <>
                    <button
                      onClick={() => setModalImageIndex(i => i === 0 ? (selectedMarketplaceProduct.images || [selectedMarketplaceProduct.image_url]).length - 1 : i - 1)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 p-2 rounded-full hover:bg-black/70 transition"
                    >
                      <ChevronLeft size={20} className="text-white" />
                    </button>
                    <button
                      onClick={() => setModalImageIndex(i => i === (selectedMarketplaceProduct.images || [selectedMarketplaceProduct.image_url]).length - 1 ? 0 : i + 1)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 p-2 rounded-full hover:bg-black/70 transition"
                    >
                      <ChevronRight size={20} className="text-white" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {(selectedMarketplaceProduct.images || [selectedMarketplaceProduct.image_url]).map((_, i) => (
                        <div key={i} className={`w-2 h-2 rounded-full ${i === modalImageIndex ? 'bg-white' : 'bg-white/40'}`} />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Détails */}
              <div className="p-4 space-y-4">
                <h2 className="text-xl font-black text-white">{selectedMarketplaceProduct.name}</h2>
                <p className="text-sm text-gray-300 leading-relaxed">{selectedMarketplaceProduct.description}</p>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-black">
                    {selectedMarketplaceProduct.price === 0
                      ? <span className="text-street-accent">Don gratuit</span>
                      : <span className="text-white">{selectedMarketplaceProduct.price.toFixed(2)}€</span>
                    }
                  </div>
                  {selectedMarketplaceProduct.city && (
                    <span className="text-sm text-gray-400">📍 {selectedMarketplaceProduct.city}</span>
                  )}
                </div>

                {/* Bloc vendeur */}
                {user && selectedMarketplaceProduct.user_id !== user.id && selectedMarketplaceProduct.profiles && (
                  <button
                    onClick={() => { setSelectedMarketplaceProduct(null); onUserClick(selectedMarketplaceProduct.user_id) }}
                    className="flex items-center gap-3 w-full py-3 px-4 bg-street-900 rounded-xl hover:bg-street-700 transition"
                  >
                    {selectedMarketplaceProduct.profiles.avatar_url ? (
                      <img src={selectedMarketplaceProduct.profiles.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-street-600 flex items-center justify-center text-sm text-gray-300 font-bold flex-shrink-0">
                        {selectedMarketplaceProduct.profiles.username?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="text-left">
                      <p className="text-xs text-gray-500">Vendu par</p>
                      <p className="text-sm font-semibold text-white">@{selectedMarketplaceProduct.profiles.username || 'Vendeur'}</p>
                    </div>
                  </button>
                )}

                {/* Signaler */}
                {user && selectedMarketplaceProduct.user_id !== user.id && (
                  <button
                    onClick={() => openReport('product', selectedMarketplaceProduct.id)}
                    className="text-xs text-gray-600 hover:text-red-400 transition w-full text-center pt-2"
                  >
                    Signaler cette annonce
                  </button>
                )}
              </div>
            </div>

            {/* Footer CTA */}
            <div
              className="p-4 border-t border-street-700 flex-shrink-0 space-y-3"
              style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <p className="text-xs text-gray-500 text-center">
                StreetConnect met en relation vendeurs et acheteurs. La transaction se fait entre particuliers, hors de la plateforme.
              </p>
              {user && selectedMarketplaceProduct.user_id !== user.id ? (
                <button
                  onClick={() => { setSelectedMarketplaceProduct(null); onContactSeller(selectedMarketplaceProduct.user_id) }}
                  className="w-full flex items-center justify-center gap-2 bg-street-accent text-street-900 font-bold py-3 rounded-lg hover:bg-street-accentHover transition"
                >
                  <ShoppingCart size={20} strokeWidth={3} />
                  Contacter le vendeur
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Modal Signalement */}
      {reportTarget && (
        <div className="fixed inset-0 bg-black/90 z-[300] flex items-end md:items-center md:justify-center">
          <div
            className="bg-street-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-md flex flex-col overflow-hidden"
            style={{ maxHeight: 'calc(100vh - 16px)' }}
          >
            <div className="flex items-center justify-between p-4 border-b border-street-700 flex-shrink-0">
              <h2 className="text-base font-black text-white">Signaler une annonce</h2>
              <button onClick={closeReport} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="p-4 space-y-4 flex-1 overflow-y-auto">
              {reportStatus === 'success' && (
                <div className="text-center py-6 space-y-2">
                  <p className="text-white font-bold">Signalement envoyé</p>
                  <p className="text-sm text-gray-400">Merci. Nous examinerons cette annonce.</p>
                  <button onClick={closeReport} className="mt-4 text-sm text-street-accent hover:underline">Fermer</button>
                </div>
              )}

              {reportStatus === 'duplicate' && (
                <div className="text-center py-6 space-y-2">
                  <p className="text-white font-bold">Déjà signalé</p>
                  <p className="text-sm text-gray-400">Tu as déjà signalé cette annonce.</p>
                  <button onClick={closeReport} className="mt-4 text-sm text-street-accent hover:underline">Fermer</button>
                </div>
              )}

              {reportStatus === 'error' && (
                <p className="text-red-400 text-sm text-center">Une erreur est survenue. Réessaie.</p>
              )}

              {!reportStatus && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Raison *</label>
                    {['Arnaque', 'Contenu inapproprié', 'Spam', 'Autre'].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setReportReason(r)}
                        className={`w-full text-left px-4 py-2.5 mb-1.5 rounded-lg text-sm transition ${
                          reportReason === r
                            ? 'bg-red-500/20 border border-red-500/50 text-red-300 font-semibold'
                            : 'bg-street-900 border border-street-700 text-gray-300 hover:border-street-600'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Détails (optionnel)</label>
                    <textarea
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      rows={3}
                      placeholder="Décris le problème..."
                      className="w-full px-4 py-2 bg-street-900 border border-street-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none text-sm placeholder-gray-600"
                    />
                  </div>
                </>
              )}
            </div>

            {!reportStatus && (
              <div
                className="p-4 border-t border-street-700 flex-shrink-0"
                style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
              >
                <button
                  onClick={handleSubmitReport}
                  className="w-full bg-red-500 text-white font-bold py-3 rounded-lg hover:bg-red-600 transition"
                >
                  Envoyer le signalement
                </button>
              </div>
            )}
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
        {CURATION_ENABLED && <div className="flex gap-2 mb-6">
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
        </div>}

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
                    onClick={() => { setSelectedMarketplaceProduct(product); setModalImageIndex(0) }}
                    className="bg-street-800 rounded-2xl p-4 border border-street-700 hover:border-street-accent transition-all group relative cursor-pointer"
                  >
                    <div className="absolute top-2 right-2 z-10 flex gap-2">
                      {user && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id) }}
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
                          onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id) }}
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
                      <div>
                        {product.price === 0 ? (
                          <span className="text-sm font-black text-street-accent uppercase tracking-wide">Don gratuit</span>
                        ) : (
                          <span className="text-lg font-black text-white">{product.price.toFixed(2)}€</span>
                        )}
                        {product.city && (
                          <p className="text-xs text-gray-500 mt-0.5">📍 {product.city}</p>
                        )}
                      </div>
                      {user && !isOwner ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); onContactSeller(product.user_id) }}
                          className="bg-street-accent text-street-900 w-9 h-9 rounded-lg flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-lg"
                        >
                          <ShoppingCart size={20} strokeWidth={3} />
                        </button>
                      ) : null}
                    </div>

                    {!isOwner && product.profiles && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onUserClick(product.user_id) }}
                        className="mt-3 pt-3 border-t border-street-700 flex items-center gap-2 w-full hover:opacity-70 transition"
                      >
                        {product.profiles.avatar_url ? (
                          <img src={product.profiles.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-street-600 flex items-center justify-center text-[10px] text-gray-300 font-bold flex-shrink-0">
                            {product.profiles.username?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <span className="text-xs text-gray-400 truncate">@{product.profiles.username || 'Vendeur'}</span>
                      </button>
                    )}
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