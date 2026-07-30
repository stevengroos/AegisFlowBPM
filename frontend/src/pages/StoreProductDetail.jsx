import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, ShoppingCart, MessageCircle, AlertTriangle, Loader2, ChevronRight, CheckCircle2, X, Store, ImageIcon, Moon, Sun } from 'lucide-react';

export default function StoreProductDetail() {
  const { moduleId, productId } = useParams();
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // --- ESTADOS ---
  const [producto, setProducto] = useState(null);
  const [storeInfo, setStoreInfo] = useState({ 
    name: 'Cargando...', 
    themeColor: '#3b82f6',
    whatsappNumber: '',
    coverImage: ''
  });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // --- MODO OSCURO (Sincronizado) ---
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  const [varianteSeleccionada, setVarianteSeleccionada] = useState(null);
  const [imagenGaleriaSeleccionada, setImagenGaleriaSeleccionada] = useState(null);

  // --- CUOTERO Y CARRITO ---
  const [modalidad, setModalidad] = useState('financiado'); 
  const [cuotasElegidas, setCuotasElegidas] = useState(3); 
  const tasasExcel = { 2: 6.4, 3: 8.4, 4: 10.4, 5: 12.3, 6: 14.2, 7: 16.0, 8: 17.7, 9: 19.5, 10: 21.2, 11: 22.8, 12: 24.4, 13: 25.9, 14: 27.5, 15: 28.9, 16: 30.4, 17: 31.8, 18: 33.2, 19: 34.5, 20: 35.8, 21: 37.0, 22: 38.3, 23: 39.5, 24: 40.7 };
  
  const [mostrarCarrito, setMostrarCarrito] = useState(false);
  const [carrito, setCarrito] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`carrito_tienda_${moduleId}`)) || []; } catch (e) { return []; }
  });

  // --- EFECTOS ---
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // 🔥 EFECTO SWR (Carga instantánea desde Caché) 🔥
  useEffect(() => {
    const fetchProduct = async () => {
      const cacheKey = `store_catalog_${moduleId}`;
      const cachedData = sessionStorage.getItem(cacheKey);

      // 1. Si venimos del Home, ya tenemos los datos en caché. Los mostramos AL INSTANTE.
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          setStoreInfo(parsed.storeInfo);
          const foundProduct = parsed.products?.find(p => p.id === parseInt(productId));
          if (foundProduct) {
            setProducto(foundProduct);
            setCargando(false);
          }
        } catch (e) {}
      }

      // 2. Fetch silencioso a la API para asegurar que el stock o el precio no hayan cambiado en los últimos minutos
      try {
        const res = await axios.get(`${API_URL}/api/v1/storefront/catalog/${moduleId}`);
        const newStoreInfo = {
          name: res.data.module_name || 'Catálogo',
          themeColor: res.data.theme_color || '#3b82f6',
          whatsappNumber: res.data.whatsapp_number || '', 
          coverImage: res.data.cover_image || ''          
        };
        setStoreInfo(newStoreInfo);
        
        const foundProduct = res.data.products?.find(p => p.id === parseInt(productId));
        if (!foundProduct) throw new Error('Producto no encontrado o fuera de stock.');
        
        setProducto(foundProduct);

        // Actualizamos el caché maestro por si el usuario vuelve atrás
        sessionStorage.setItem(cacheKey, JSON.stringify({ products: res.data.products, storeInfo: newStoreInfo }));
      } catch (err) {
        if (!cachedData || !producto) setError(err.response?.data?.detail || err.message || 'Error al cargar el producto.');
      } finally { 
        setCargando(false); 
      }
    };
    fetchProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, productId, API_URL]);

  useEffect(() => localStorage.setItem(`carrito_tienda_${moduleId}`, JSON.stringify(carrito)), [carrito, moduleId]);

  // --- MATEMÁTICA Y LÓGICA ---
  const precioBase = producto ? Number(producto.price) || 0 : 0;
  
  const variants = producto?.raw_data?.variants || [];
  const gallery = producto?.raw_data?.gallery || [];
  
  let imagenMostrar = varianteSeleccionada?.image_url || imagenGaleriaSeleccionada || producto?.image_url;
  const stockMostrar = varianteSeleccionada ? varianteSeleccionada.stock : (producto?.stock || 0);
  const nombreProductoFinal = varianteSeleccionada ? `${producto?.title} - ${varianteSeleccionada.color_name}` : producto?.title;
  
  const calcularCuotaIndividual = () => {
    if (!producto) return 0;
    const tasa = tasasExcel[cuotasElegidas] || 0;
    const precioFinal = precioBase / (1 - (tasa / 100));
    return Math.round(precioFinal / cuotasElegidas);
  };

  const comprarPorWhatsApp = () => {
    if (!producto) return;

    if (!storeInfo.whatsappNumber) {
      alert("El administrador de la tienda aún no ha configurado un número de WhatsApp para recibir pedidos.");
      return;
    }

    const precioContadoStr = `Gs. ${precioBase.toLocaleString('es-PY')}`;
    const cuotaStr = `Gs. ${calcularCuotaIndividual().toLocaleString('es-PY')}`;
    const mensaje = modalidad === 'financiado' 
      ? `Hola, estoy interesado en el producto *${nombreProductoFinal}* del catálogo *${storeInfo.name}* (Contado: ${precioContadoStr}). \n\nQuiero solicitar el plan de financiación de *${cuotasElegidas} cuotas* de *${cuotaStr}* al mes. ¿Me pasan los requisitos?`
      : `Hola, quiero adquirir el producto *${nombreProductoFinal}* del catálogo *${storeInfo.name}* al contado por el valor de *${precioContadoStr}*. \n\n¿Tienen stock disponible para entrega o retiro inmediato?`;
    
    window.open(`https://wa.me/${storeInfo.whatsappNumber}?text=${encodeURIComponent(mensaje.trim())}`, '_blank');
  };

  const agregarAlCarrito = () => {
    setCarrito(prev => {
      const existe = prev.find(item => item.id === producto.id && item.color_name === varianteSeleccionada?.color_name && item.modalidadElegida === modalidad && item.cuotasElegidas === cuotasElegidas);
      if (existe) {
         return prev.map(item => (item.id === producto.id && item.color_name === varianteSeleccionada?.color_name && item.modalidadElegida === modalidad && item.cuotasElegidas === cuotasElegidas) ? { ...item, cantidad: item.cantidad + 1 } : item);
      }
      return [...prev, { 
         ...producto, 
         idUnicoInterno: Date.now(), 
         cantidad: 1, 
         modalidadElegida: modalidad, 
         cuotasElegidas: modalidad === 'financiado' ? cuotasElegidas : null, 
         valorCuotaCalculado: modalidad === 'financiado' ? calcularCuotaIndividual() : 0, 
         color_name: varianteSeleccionada?.color_name || null, 
         image_url: imagenMostrar 
      }];
    });
    setMostrarCarrito(true); 
  };

  const modificarCantidad = (idUnico, cambio) => {
    setCarrito(prev => prev.map(item => {
      if (item.idUnicoInterno === idUnico) {
        const nuevaCant = item.cantidad + cambio;
        return { ...item, cantidad: nuevaCant > 0 ? nuevaCant : 1 };
      }
      return item;
    }));
  };

  const eliminarDelCarrito = (idUnico) => setCarrito(prev => prev.filter(item => item.idUnicoInterno !== idUnico));

  const enviarCarritoCompletoPorWhatsApp = () => {
    if (carrito.length === 0) return;

    if (!storeInfo.whatsappNumber) {
      alert("El administrador de la tienda aún no ha configurado un número de WhatsApp para recibir pedidos.");
      return;
    }

    let mensaje = `Hola, quiero realizar el siguiente pedido del catálogo *${storeInfo.name}*:\n\n`;
    let total = 0;
    
    carrito.forEach(item => {
      const subtotal = item.price * item.cantidad;
      total += subtotal;
      mensaje += `▪️ ${item.cantidad}x *${item.title}* -> Gs. ${subtotal.toLocaleString('es-PY')}\n`;
    });
    
    mensaje += `\n*TOTAL ESTIMADO: Gs. ${total.toLocaleString('es-PY')}*\n`;
    mensaje += `\n¿Tienen disponibilidad de estos artículos para coordinar el pago y envío?`;
    window.open(`https://wa.me/${storeInfo.whatsappNumber}?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  const formatearDescripcion = (desc) => {
    if (!desc) return "Este artículo no cuenta con una descripción detallada por el momento.";
    if (desc.includes('<p>') || desc.includes('<ul>')) return desc;
    return desc.replace(/\n/g, '<br />');
  };

  // --- RENDERIZADO DE CARGA Y ERRORES ---
  if (cargando && !producto) return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center"><Loader2 className="animate-spin w-12 h-12 mb-4" style={{color: storeInfo.themeColor}}/><p className="text-gray-500 font-bold uppercase tracking-widest">Cargando detalles...</p></div>;
  if (error || !producto) return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center text-red-500 font-bold"><AlertTriangle size={48} className="mb-4"/>{error || 'Producto no encontrado.'}</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300">
      
      {/* NAVBAR PÚBLICO */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/c/${moduleId}`)}>
             {storeInfo.coverImage ? (
                <img src={storeInfo.coverImage} alt={storeInfo.name} className="h-10 object-contain" />
             ) : (
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-md shrink-0" style={{ backgroundColor: storeInfo.themeColor }}>
                  <Store size={20} />
                </div>
             )}
             <h1 className="text-xl md:text-2xl font-black tracking-tight truncate max-w-[150px] sm:max-w-xs md:max-w-md">{storeInfo.name}</h1>
          </div>

          <div className="flex items-center gap-3">
             <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-600 dark:text-gray-300 hidden sm:block">
               {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
             </button>

             <button onClick={() => setMostrarCarrito(true)} className="relative p-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
               <ShoppingCart size={22} className="text-gray-700 dark:text-gray-200" />
               {carrito.length > 0 && (
                 <span className="absolute -top-1 -right-1 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm" style={{ backgroundColor: storeInfo.themeColor }}>
                   {carrito.reduce((acc, item) => acc + item.cantidad, 0)}
                 </span>
               )}
             </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
        <button onClick={() => navigate(`/c/${moduleId}`)} className="flex items-center gap-2 text-sm font-bold mb-6 hover:underline" style={{ color: storeInfo.themeColor }}>
          <ArrowLeft size={16} /> Volver al catálogo
        </button>

        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 p-5 sm:p-6 md:p-10 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
          
          {/* GALERÍA DE IMÁGENES */}
          <div className="flex flex-col gap-4">
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 sm:p-8 border border-gray-100 dark:border-gray-800 flex items-center justify-center aspect-square md:aspect-[4/3] overflow-hidden">
              {imagenMostrar ? (
                 /* 🔥 LAZY LOADING APLICADO AQUÍ 🔥 */
                 <img src={imagenMostrar} alt={producto.title} loading="lazy" className="max-w-full max-h-full object-contain mix-blend-multiply dark:mix-blend-normal" />
              ) : (
                 <ImageIcon size={64} className="text-gray-300 dark:text-gray-700" />
              )}
            </div>

            {gallery.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                <button onClick={() => { setImagenGaleriaSeleccionada(null); setVarianteSeleccionada(null); }} className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white dark:bg-gray-800 border-2 overflow-hidden flex-shrink-0 p-2 transition-all ${(!varianteSeleccionada && !imagenGaleriaSeleccionada) ? 'border-gray-500' : 'border-gray-200 dark:border-gray-700'}`} style={(!varianteSeleccionada && !imagenGaleriaSeleccionada) ? {borderColor: storeInfo.themeColor} : {}}>
                  <img src={producto.image_url} alt="Portada" loading="lazy" className="w-full h-full object-contain" />
                </button>
                {gallery.map((img, i) => (
                  <button key={i} onClick={() => { setImagenGaleriaSeleccionada(img.image_url); setVarianteSeleccionada(null); }} className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white dark:bg-gray-800 border-2 overflow-hidden flex-shrink-0 p-2 transition-all ${imagenGaleriaSeleccionada === img.image_url ? 'border-gray-500' : 'border-gray-200 dark:border-gray-700'}`} style={imagenGaleriaSeleccionada === img.image_url ? {borderColor: storeInfo.themeColor} : {}}>
                    <img src={img.image_url} alt="Galeria" loading="lazy" className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* INFORMACIÓN Y COMPRA */}
          <div className="flex flex-col">
            {producto.category && (
              <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">
                {producto.category}
              </span>
            )}
            
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black leading-tight mb-4">{producto.title}</h1>
            
            {/* VARIANTES */}
            {variants.length > 0 && (
              <div className="mb-6">
                <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Opciones disponibles</span>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => { setVarianteSeleccionada(null); setImagenGaleriaSeleccionada(null); }} className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-sm font-bold border transition-all ${varianteSeleccionada === null ? 'text-white' : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'}`} style={varianteSeleccionada === null ? {backgroundColor: storeInfo.themeColor, borderColor: storeInfo.themeColor} : {}}>
                    Original
                  </button>
                  {variants.map((v, i) => (
                    <button key={i} onClick={() => { setVarianteSeleccionada(v); setImagenGaleriaSeleccionada(null); }} className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-sm font-bold border transition-all ${varianteSeleccionada?.id === v.id ? 'text-white' : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'}`} style={varianteSeleccionada?.id === v.id ? {backgroundColor: storeInfo.themeColor, borderColor: storeInfo.themeColor} : {}}>
                      {v.color_name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* STOCK */}
            <div className="mb-6 flex flex-wrap gap-3">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-bold ${stockMostrar > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800/50'}`}>
                {stockMostrar > 0 ? <><CheckCircle2 size={16}/> {stockMostrar} Disponibles</> : <><AlertTriangle size={16}/> Agotado temporalmente</>}
              </div>
            </div>

            <div className="mb-8 border-b border-gray-200 dark:border-gray-800 pb-6">
              <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">Precio Contado</span>
              <span className="text-3xl sm:text-4xl font-black" style={{color: storeInfo.themeColor}}>Gs. {precioBase.toLocaleString('es-PY')}</span>
            </div>

            {/* WIDGET DEL CUOTERO */}
            <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 p-5 sm:p-6 rounded-3xl mb-8 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1" style={{backgroundColor: storeInfo.themeColor}}></div>
               <div className="flex bg-gray-200/50 dark:bg-gray-800 p-1 rounded-xl mb-6">
                  <button onClick={() => setModalidad('financiado')} className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${modalidad === 'financiado' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}>Pagar en Cuotas</button>
                  <button onClick={() => setModalidad('contado')} className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${modalidad === 'contado' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}>Al Contado</button>
               </div>

               {modalidad === 'financiado' ? (
                 <div className="space-y-4 sm:space-y-5 animate-in fade-in">
                    <div>
                      <label className="block text-[10px] sm:text-xs font-bold text-gray-500 uppercase mb-2">Plazo de Financiación</label>
                      <select value={cuotasElegidas} onChange={e => setCuotasElegidas(parseInt(e.target.value))} className="w-full p-2.5 sm:p-3 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-xl outline-none font-bold text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 text-sm sm:text-base">
                        {Object.keys(tasasExcel).map(mes => <option key={mes} value={mes}>{mes} Cuotas mensuales</option>)}
                      </select>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 sm:p-5 text-center">
                       <span className="text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest block mb-1">Monto de la Cuota</span>
                       <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">Gs. {calcularCuotaIndividual().toLocaleString('es-PY')}</span>
                    </div>
                 </div>
               ) : (
                 <div className="animate-in fade-in text-center p-4 sm:p-6">
                    <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">Total a Pagar</span>
                    <span className="text-2xl sm:text-3xl font-black" style={{color: storeInfo.themeColor}}>Gs. {precioBase.toLocaleString('es-PY')}</span>
                 </div>
               )}
            </div>

            {/* BOTONERA DE ACCIÓN */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8 sm:mb-10">
               <button onClick={comprarPorWhatsApp} disabled={stockMostrar <= 0} className="flex-1 bg-[#25D366] hover:bg-[#20b858] text-white py-3.5 sm:py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base">
                  <MessageCircle size={20}/> {stockMostrar > 0 ? 'Consultar' : 'Agotado'}
               </button>
               <button onClick={agregarAlCarrito} disabled={stockMostrar <= 0} className="flex-1 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border-2 py-3.5 sm:py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base" style={stockMostrar > 0 ? {borderColor: storeInfo.themeColor, color: storeInfo.themeColor} : {borderColor: '#9ca3af', color: '#9ca3af'}}>
                  <ShoppingCart size={20}/> Añadir al Carrito
               </button>
            </div>

            {/* DESCRIPCIÓN */}
            <div>
               <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest border-b border-gray-200 dark:border-gray-800 pb-3 mb-4 flex items-center gap-2">
                 <ChevronRight size={16} style={{color: storeInfo.themeColor}}/> Detalles del Producto
               </h3>
               <div className="prose dark:prose-invert prose-sm max-w-none text-gray-600 dark:text-gray-400 leading-relaxed text-sm sm:text-base" dangerouslySetInnerHTML={{ __html: formatearDescripcion(producto.description) }} />
            </div>

          </div>
        </div>
      </div>

      {/* MODAL DEL CARRITO DESLIZANTE */}
      {mostrarCarrito && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[9999] flex justify-end animate-in fade-in">
          <div className="w-full md:w-[450px] bg-white dark:bg-gray-900 h-full flex flex-col shadow-2xl animate-in slide-in-from-right">
            
            <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-950">
              <h2 className="text-base sm:text-lg font-black flex items-center gap-2" style={{color: storeInfo.themeColor}}><ShoppingCart size={20} /> Tu Pedido ({carrito.length})</h2>
              <button onClick={() => setMostrarCarrito(false)} className="p-2 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"><X size={20}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
              {carrito.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                  <ShoppingCart size={64} className="opacity-20"/>
                  <p className="font-medium text-sm sm:text-base">Tu carrito está vacío.</p>
                  <button onClick={() => setMostrarCarrito(false)} className="mt-4 px-6 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full text-xs sm:text-sm font-bold">Seguir Comprando</button>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {carrito.map(item => (
                    <div key={item.idUnicoInterno} className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm">
                      <img src={item.image_url} alt={item.title} className="w-16 h-16 sm:w-20 sm:h-20 object-contain bg-gray-50 dark:bg-gray-800 rounded-xl p-2" />
                      <div className="flex-1 flex flex-col">
                        <h4 className="font-bold text-xs sm:text-sm leading-tight mb-1 line-clamp-2">{item.title}</h4>
                        {item.color_name && <span className="text-[10px] sm:text-xs text-gray-500 mb-1">Opción: {item.color_name}</span>}
                        
                        {item.modalidadElegida === 'financiado' ? (
                          <span className="text-emerald-500 font-bold text-[10px] sm:text-xs">{item.cuotasElegidas} x Gs. {item.valorCuotaCalculado?.toLocaleString('es-PY')}</span>
                        ) : (
                          <span className="font-black text-xs sm:text-sm" style={{color: storeInfo.themeColor}}>Gs. {Number(item.price).toLocaleString('es-PY')}</span>
                        )}

                        <div className="flex justify-between items-center mt-auto pt-2 sm:pt-3">
                          <div className="flex items-center gap-2 sm:gap-3 bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-1">
                            <button onClick={() => modificarCantidad(item.idUnicoInterno, -1)} className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-gray-500 hover:text-black dark:hover:text-white font-bold">-</button>
                            <span className="text-[10px] sm:text-xs font-bold w-4 text-center">{item.cantidad}</span>
                            <button onClick={() => modificarCantidad(item.idUnicoInterno, 1)} className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-gray-500 hover:text-black dark:hover:text-white font-bold">+</button>
                          </div>
                          <button onClick={() => eliminarDelCarrito(item.idUnicoInterno)} className="text-[10px] sm:text-[11px] font-bold text-red-500 hover:underline">Quitar</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {carrito.length > 0 && (
              <div className="p-5 sm:p-6 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-gray-500 dark:text-gray-400 font-bold text-xs sm:text-sm">Total Estimado</span>
                    <span className="text-xl sm:text-2xl font-black" style={{color: storeInfo.themeColor}}>
                        Gs. {carrito.reduce((acc, item) => acc + (item.price * item.cantidad), 0).toLocaleString('es-PY')}
                    </span>
                </div>
                <button onClick={enviarCarritoCompletoPorWhatsApp} className="w-full py-3.5 sm:py-4 bg-[#25D366] hover:bg-[#20b858] text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-green-500/30 transition-all active:scale-95 text-sm sm:text-base">
                  <MessageCircle size={20} /> Pedir por WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}