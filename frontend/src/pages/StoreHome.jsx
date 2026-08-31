import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Filter, X, MessageCircle, AlertCircle, Loader2, ImageIcon, ChevronLeft, ChevronRight, Store, Moon, Sun, SlidersHorizontal } from 'lucide-react';

export default function StoreHome() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // --- ESTADOS DE LA TIENDA Y CACHÉ ---
  const [products, setProducts] = useState([]);
  const [storeInfo, setStoreInfo] = useState({ 
    title: 'Cargando Catálogo...', 
    themeColor: '#3b82f6',
    whatsappNumber: '',
    coverImage: ''
  });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // --- MODO OSCURO (Independiente para el cliente B2C) ---
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  // --- FILTROS, MÓVIL Y DEBOUNCE ---
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroDebounced, setFiltroDebounced] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState(''); 
  const [precioMin, setPrecioMin] = useState('');
  const [precioMax, setPrecioMax] = useState('');
  const [ordenPrecio, setOrdenPrecio] = useState(''); 
  const [mostrarFiltrosMovil, setMostrarFiltrosMovil] = useState(false); 

  // --- PAGINACIÓN Y CARRITO ---
  const [paginaActual, setPaginaActual] = useState(1);
  const productosPorPagina = 24; 
  const [mostrarCarrito, setMostrarCarrito] = useState(false);
  const [carrito, setCarrito] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`carrito_tienda_${moduleId}`)) || []; } catch (e) { return []; }
  });

  // --- EFECTOS ---

  // Efecto del Modo Oscuro
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Debounce para el buscador (Anti-lag)
  useEffect(() => {
    const timer = setTimeout(() => setFiltroDebounced(filtroTexto), 300);
    return () => clearTimeout(timer);
  }, [filtroTexto]);

  // 🔥 EFECTO SWR (Caché + Carga en Segundo Plano) 🔥
  useEffect(() => {
    const fetchCatalog = async () => {
      const cacheKey = `store_catalog_${moduleId}`;
      const cachedData = sessionStorage.getItem(cacheKey);

      // Si tenemos caché, lo mostramos INMEDIATAMENTE
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          setProducts(parsed.products);
          setStoreInfo(parsed.storeInfo);
          setCargando(false);
        } catch (e) {}
      }

      // Luego, buscamos silenciosamente en la API para traer novedades
      try {
        const res = await axios.get(`${API_URL}/api/v1/storefront/catalog/${moduleId}`);
        const newProducts = res.data.products || [];
        const newStoreInfo = {
          title: res.data.store_title || res.data.module_name || 'Catálogo', 
          themeColor: res.data.theme_color || '#3b82f6',
          whatsappNumber: res.data.whatsapp_number || '', 
          coverImage: res.data.cover_image || ''          
        };

        setProducts(newProducts);
        setStoreInfo(newStoreInfo);
        
        // Guardamos el nuevo resultado en caché
        sessionStorage.setItem(cacheKey, JSON.stringify({ products: newProducts, storeInfo: newStoreInfo }));
      } catch (err) {
        if (!cachedData) setError(err.response?.data?.detail || 'El catálogo no está disponible o es privado.');
      } finally {
        setCargando(false);
      }
    };
    fetchCatalog();
  }, [moduleId, API_URL]);

  useEffect(() => localStorage.setItem(`carrito_tienda_${moduleId}`, JSON.stringify(carrito)), [carrito, moduleId]);
  useEffect(() => setPaginaActual(1), [filtroDebounced, categoriaFiltro, precioMin, precioMax, ordenPrecio]);

  // --- FUNCIONES DEL CARRITO ---
  const modificarCantidad = (idUnico, cambio) => {
    setCarrito(prev => prev.map(item => {
      if (item.id === idUnico) {
        const nuevaCant = item.cantidad + cambio;
        return { ...item, cantidad: nuevaCant > 0 ? nuevaCant : 1 };
      }
      return item;
    }));
  };

  const eliminarDelCarrito = (idUnico) => setCarrito(prev => prev.filter(item => item.id !== idUnico));

  const enviarCarritoCompletoPorWhatsApp = () => {
    if (carrito.length === 0) return;
    if (!storeInfo.whatsappNumber) {
      alert("El administrador de la tienda aún no ha configurado un número de WhatsApp para recibir pedidos.");
      return;
    }

    let mensaje = `Hola, quiero realizar el siguiente pedido del catálogo *${storeInfo.title}*:\n\n`;
    let total = 0;
    carrito.forEach(item => {
      const subtotal = item.price * item.cantidad;
      total += subtotal;
      mensaje += `▪️ ${item.cantidad}x *${item.title}* -> Gs. ${subtotal.toLocaleString('es-PY')}\n`;
    });
    mensaje += `\n*TOTAL ESTIMADO: Gs. ${total.toLocaleString('es-PY')}*\n\n¿Tienen disponibilidad de estos artículos para coordinar el pago y envío?`;
    window.open(`https://wa.me/${storeInfo.whatsappNumber}?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  const agregarAlCarritoRápido = (producto) => {
    setCarrito(prev => {
      const existe = prev.find(item => item.id === producto.id);
      if (existe) return prev.map(item => item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      return [...prev, { ...producto, cantidad: 1 }];
    });
    setMostrarCarrito(true);
  };

  // --- LÓGICA DE FILTRADO ---
  const categoriasUnicas = [...new Set(products.map(p => p.category).filter(Boolean))]; 

  const productosFiltrados = products.filter((p) => {
    // 🔥 REGLA DE ORO: SI NO HAY STOCK, SE DESCARTA INMEDIATAMENTE 🔥
    if (p.stock <= 0) return false;

    const texto = filtroDebounced.toLowerCase();
    const tituloValido = p.title ? p.title.toLowerCase().includes(texto) : false;
    const catValida = categoriaFiltro === '' || p.category === categoriaFiltro; 

    return tituloValido && catValida &&
           (precioMin === '' || p.price >= parseFloat(precioMin)) &&
           (precioMax === '' || p.price <= parseFloat(precioMax));
  });

  const productosOrdenados = [...productosFiltrados].sort((a, b) => {
    if (ordenPrecio === 'asc') return a.price - b.price; 
    if (ordenPrecio === 'desc') return b.price - a.price; 
    return 0; 
  });

  const totalPaginas = Math.ceil(productosOrdenados.length / productosPorPagina);
  const productosVisibles = productosOrdenados.slice((paginaActual - 1) * productosPorPagina, paginaActual * productosPorPagina);

  const limpiarFiltros = () => { 
    setPrecioMin(''); setPrecioMax(''); setOrdenPrecio(''); setFiltroTexto(''); setCategoriaFiltro(''); 
    setMostrarFiltrosMovil(false); 
  };
  const obtenerTextoPlano = (html) => html ? new DOMParser().parseFromString(html, "text/html").body.textContent || "" : "Sin descripción.";


  // 🔥 NUEVO: Función para Paginación Inteligente (Elipsis) 🔥
  const obtenerPaginasVisibles = () => {
    if (totalPaginas <= 5) {
      return Array.from({ length: totalPaginas }, (_, i) => i + 1);
    }
    if (paginaActual <= 3) {
      return [1, 2, 3, 4, '...', totalPaginas];
    }
    if (paginaActual >= totalPaginas - 2) {
      return [1, '...', totalPaginas - 3, totalPaginas - 2, totalPaginas - 1, totalPaginas];
    }
    return [1, '...', paginaActual - 1, paginaActual, paginaActual + 1, '...', totalPaginas];
  };

  // --- RENDERIZADO ---
  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200">
      <AlertCircle size={64} className="text-red-500 mb-4" />
      <h1 className="text-2xl font-bold mb-2">Acceso Denegado</h1>
      <p className="text-gray-500">{error}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300">
      
      {/* LOADER INICIAL */}
      {cargando && (
        <div className="fixed inset-0 bg-white dark:bg-gray-950 z-[9999] flex flex-col items-center justify-center">
          <Loader2 className="animate-spin w-12 h-12 mb-4" style={{ color: storeInfo.themeColor }} />
          <p className="font-bold tracking-widest uppercase text-sm text-gray-500">Cargando {storeInfo.title}...</p>
        </div>
      )}

      {/* NAVBAR DE LA TIENDA PÚBLICA */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
             {storeInfo.coverImage ? (
                <img src={storeInfo.coverImage} alt={storeInfo.title} className="h-10 object-contain" />
             ) : (
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-md shrink-0" style={{ backgroundColor: storeInfo.themeColor }}>
                  <Store size={20} />
                </div>
             )}
             <h1 className="text-xl md:text-2xl font-black tracking-tight truncate max-w-[200px] md:max-w-md hidden sm:block">{storeInfo.title}</h1>
          </div>
          
          <div className="hidden md:flex flex-1 max-w-xl mx-8 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar productos..." 
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-gray-100 dark:bg-gray-800 border-transparent rounded-full outline-none focus:ring-2 transition-all text-sm"
              style={{ focusRing: storeInfo.themeColor }}
            />
          </div>

          <div className="flex items-center gap-3">
             <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-600 dark:text-gray-300">
               {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
             </button>

             <button onClick={() => setMostrarCarrito(true)} className="relative p-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
               <ShoppingCart size={22} className="text-gray-700 dark:text-gray-200" />
               {carrito.length > 0 && (
                 <span className="absolute -top-1 -right-1 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: storeInfo.themeColor }}>
                   {carrito.reduce((acc, item) => acc + item.cantidad, 0)}
                 </span>
               )}
             </button>
          </div>
        </div>

        {/* Buscador y Botón de Filtros para Móviles */}
        <div className="md:hidden px-4 pb-4 flex gap-2">
            <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input type="text" placeholder="Buscar..." value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-gray-100 dark:bg-gray-800 border-transparent rounded-xl outline-none text-sm" />
            </div>
            <button onClick={() => setMostrarFiltrosMovil(true)} className="p-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl flex items-center justify-center shrink-0">
               <SlidersHorizontal size={20} />
            </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex flex-col md:flex-row gap-8 p-4 md:p-8 max-w-7xl mx-auto relative">
        
        {/* SIDEBAR FILTROS (Modal en móvil, Sidebar en Desktop) */}
        <aside className={`
            fixed inset-0 z-[100] bg-white dark:bg-gray-900 p-6 overflow-y-auto transition-transform transform duration-300
            ${mostrarFiltrosMovil ? 'translate-x-0' : '-translate-x-full'} 
            md:relative md:translate-x-0 md:z-auto md:w-72 md:rounded-2xl md:shadow-sm md:border border-gray-200 dark:border-gray-800 md:h-fit md:sticky md:top-28 shrink-0
        `}>
          <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
             <h2 className="text-lg font-bold flex items-center gap-2"><Filter size={18}/> Filtros</h2>
             <button className="md:hidden p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full" onClick={() => setMostrarFiltrosMovil(false)}>
               <X size={18}/>
             </button>
          </div>
          
          <div className="space-y-6">
            
            {/* SELECTOR DE CATEGORÍA */}
            {categoriasUnicas.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Categoría</label>
                <select value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)} className="w-full p-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg outline-none text-sm">
                  <option value="">Todas las categorías</option>
                  {categoriasUnicas.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Ordenar Precios</label>
              <select value={ordenPrecio} onChange={e => setOrdenPrecio(e.target.value)} className="w-full p-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg outline-none text-sm">
                <option value="">Por relevancia</option>
                <option value="asc">Menor a Mayor</option>
                <option value="desc">Mayor a Menor</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Rango de Precio</label>
              <div className="flex gap-2">
                <input type="number" placeholder="Mín" value={precioMin} onChange={e => setPrecioMin(e.target.value)} className="w-full p-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg outline-none text-sm" />
                <input type="number" placeholder="Máx" value={precioMax} onChange={e => setPrecioMax(e.target.value)} className="w-full p-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg outline-none text-sm" />
              </div>
            </div>

            <button onClick={limpiarFiltros} className="w-full py-3 bg-gray-200 dark:bg-gray-800 hover:bg-red-100 hover:text-red-600 text-gray-700 dark:text-gray-300 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
              <X size={16}/> Limpiar Filtros
            </button>
            
            <button onClick={() => setMostrarFiltrosMovil(false)} className="md:hidden w-full py-3 text-white font-bold rounded-xl transition-all shadow-md" style={{ backgroundColor: storeInfo.themeColor }}>
              Ver Resultados ({productosFiltrados.length})
            </button>
          </div>
        </aside>

        {/* GRILLA DE PRODUCTOS */}
        <main className="flex-1">
          <div className="mb-6">
            <span className="text-sm font-bold bg-gray-200 dark:bg-gray-800 px-4 py-1.5 rounded-full text-gray-600 dark:text-gray-300">{productosOrdenados.length} Resultados</span>
          </div>

          {productosOrdenados.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 p-12 text-center rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center">
              <Store size={48} className="text-gray-300 dark:text-gray-700 mb-4" />
              <h3 className="text-lg font-bold text-gray-500">No encontramos coincidencias</h3>
              <p className="text-sm text-gray-400 mt-2">Intenta modificar tus filtros o términos de búsqueda.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {productosVisibles.map((p) => (
                  <div key={p.id} className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group relative">
                    
                    <button onClick={() => agregarAlCarritoRápido(p)} className="absolute top-4 right-4 w-10 h-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur rounded-full flex items-center justify-center shadow-md z-10 opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110" style={{ color: storeInfo.themeColor }} title="Agregar al carrito">
                      <ShoppingCart size={18} />
                    </button>

                    <div className="h-48 sm:h-56 bg-gray-50 dark:bg-gray-800 flex items-center justify-center overflow-hidden cursor-pointer p-4" onClick={() => navigate(`/p/${moduleId}/${p.id}`)}>
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.title} loading="lazy" className="max-w-full max-h-full object-contain mix-blend-multiply dark:mix-blend-normal group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <ImageIcon size={48} className="text-gray-300 dark:text-gray-700" />
                      )}
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      {p.category && <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 line-clamp-1">{p.category}</span>}
                      <h3 className="font-bold text-lg leading-tight mb-2 line-clamp-2 cursor-pointer hover:underline" onClick={() => navigate(`/p/${moduleId}/${p.id}`)}>{p.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 flex-1 line-clamp-2">{obtenerTextoPlano(p.description)}</p>
                      
                      <div className="flex items-end justify-between mb-4">
                        <div>
                          <span className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Precio</span>
                          <span className="text-xl font-black" style={{ color: storeInfo.themeColor }}>Gs. {p.price.toLocaleString('es-PY')}</span>
                        </div>
                      </div>

                      {/* COMO FILTRAMOS LOS AGOTADOS, AQUÍ SIEMPRE HABRÁ STOCK */}
                      <div className="text-xs font-bold px-3 py-1.5 rounded-lg w-fit mb-4 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                        ✓ {p.stock} Disponibles
                      </div>

                      <button onClick={() => navigate(`/p/${moduleId}/${p.id}`)} className="w-full py-2.5 rounded-xl font-bold text-sm transition-all text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700">
                        Ver Detalles
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* PAGINACIÓN INTELIGENTE */}
              {totalPaginas > 1 && (
                <div className="flex justify-center items-center gap-1.5 sm:gap-2 mt-12 mb-4 flex-wrap">
                  <button 
                    onClick={() => { setPaginaActual(p => Math.max(p - 1, 1)); window.scrollTo({top: 0, behavior: 'smooth'}); }} 
                    disabled={paginaActual === 1} 
                    className="p-2 sm:p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <ChevronLeft size={20} className="text-gray-700 dark:text-gray-300"/>
                  </button>
                  
                  {obtenerPaginasVisibles().map((pag, index) => (
                    pag === '...' ? (
                      <span key={`dots-${index}`} className="px-1 sm:px-2 text-gray-400 dark:text-gray-600 font-bold tracking-widest">
                        ...
                      </span>
                    ) : (
                      <button 
                        key={pag} 
                        onClick={() => { setPaginaActual(pag); window.scrollTo({top: 0, behavior: 'smooth'}); }} 
                        className={`w-9 h-9 sm:w-11 sm:h-11 text-sm sm:text-base rounded-xl font-bold border transition-all duration-300 ${
                          paginaActual === pag 
                            ? 'text-white border-transparent shadow-lg scale-105' 
                            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`} 
                        style={paginaActual === pag ? { backgroundColor: storeInfo.themeColor, boxShadow: `0 4px 14px ${storeInfo.themeColor}40` } : {}}
                      >
                        {pag}
                      </button>
                    )
                  ))}

                  <button 
                    onClick={() => { setPaginaActual(p => Math.min(p + 1, totalPaginas)); window.scrollTo({top: 0, behavior: 'smooth'}); }} 
                    disabled={paginaActual === totalPaginas} 
                    className="p-2 sm:p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <ChevronRight size={20} className="text-gray-700 dark:text-gray-300"/>
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* MODAL DEL CARRITO DESLIZANTE */}
      {mostrarCarrito && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[9999] flex justify-end animate-in fade-in">
          <div className="w-full md:w-[450px] bg-white dark:bg-gray-900 h-full flex flex-col shadow-2xl animate-in slide-in-from-right">
            
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-950">
              <h2 className="text-lg font-black flex items-center gap-2" style={{color: storeInfo.themeColor}}><ShoppingCart size={22} /> Tu Pedido ({carrito.length})</h2>
              <button onClick={() => setMostrarCarrito(false)} className="p-2 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"><X size={20}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {carrito.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                  <ShoppingCart size={64} className="opacity-20"/>
                  <p className="font-medium">Tu carrito está vacío.</p>
                  <button onClick={() => setMostrarCarrito(false)} className="mt-4 px-6 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full text-sm font-bold">Seguir Comprando</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {carrito.map(item => (
                    <div key={item.id} className="flex gap-4 p-4 bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm">
                      <img src={item.image_url} alt={item.title} className="w-20 h-20 object-contain bg-gray-50 dark:bg-gray-800 rounded-xl p-2" />
                      <div className="flex-1 flex flex-col">
                        <h4 className="font-bold text-sm leading-tight mb-1 line-clamp-2">{item.title}</h4>
                        
                        <span className="font-black text-sm" style={{color: storeInfo.themeColor}}>Gs. {Number(item.price).toLocaleString('es-PY')}</span>

                        <div className="flex justify-between items-center mt-auto pt-3">
                          <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-1">
                            <button onClick={() => modificarCantidad(item.id, -1)} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-black dark:hover:text-white font-bold">-</button>
                            <span className="text-xs font-bold w-4 text-center">{item.cantidad}</span>
                            <button onClick={() => modificarCantidad(item.id, 1)} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-black dark:hover:text-white font-bold">+</button>
                          </div>
                          <button onClick={() => eliminarDelCarrito(item.id)} className="text-[11px] font-bold text-red-500 hover:underline">Quitar</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {carrito.length > 0 && (
              <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-gray-500 dark:text-gray-400 font-bold text-sm">Total Estimado</span>
                    <span className="text-2xl font-black" style={{color: storeInfo.themeColor}}>
                        Gs. {carrito.reduce((acc, item) => acc + (item.price * item.cantidad), 0).toLocaleString('es-PY')}
                    </span>
                </div>
                <button onClick={enviarCarritoCompletoPorWhatsApp} className="w-full py-4 bg-[#25D366] hover:bg-[#20b858] text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-green-500/30 transition-all active:scale-95">
                  <MessageCircle size={22} /> Confirmar Pedido (WhatsApp)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}