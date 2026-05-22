import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/theme_provider.dart';
import 'market_service.dart';
import 'product_detail_screen.dart';
import 'dart:convert' as dart_convert;

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final MarketService _marketService = MarketService();

  // 🔥 ESTADOS BASE 🔥
  List<dynamic> _allOffers = [];
  List<dynamic> _filteredOffers = [];
  Set<int> _favoriteIds = {};

  // 🔥 ESTADOS DE FILTROS DINÁMICOS 🔥
  String _searchQuery = '';
  String _sortBy = 'newest';
  bool _showFilters = false;

  Map<String, List<String>> _dynamicFilterOptions = {};
  List<String> _activeFilterKeys = [];
  final Map<String, TextEditingController> _filterControllers = {};

  bool _isLoading = true;
  bool _isBuyingMode = true; // 🔥 NUEVO: Modo actual
  Map<String, dynamic>?
  _mobileSettings; // 🔥 NUEVO: Configuración para saber cuál es el módulo de demandas

  @override
  void initState() {
    super.initState();
    _loadAllData();
  }

  @override
  void dispose() {
    for (var controller in _filterControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  // 🔥 Carga global de todos los módulos y favoritos 🔥
  Future<void> _loadAllData() async {
    try {
      final results = await Future.wait([
        _marketService.getCatalogs(),
        _marketService.getFavorites(),
        _marketService.getMobileSettings(), // 🔥 NUEVO
      ]);

      final catalogs = results[0] as List<dynamic>;
      final favs = results[1] as List<dynamic>;
      _mobileSettings = results[2] as Map<String, dynamic>; // 🔥 NUEVO
      _favoriteIds = favs.map((f) => f['id'] as int).toSet();

      List<dynamic> combinedOffers = [];
      for (var cat in catalogs) {
        final moduleId = cat['id'];
        final mapping = cat['mapping'] ?? {};

        try {
          final offers = await _marketService.getOffers(moduleId);
          for (var o in offers) {
            o['__mapping'] = mapping;
            o['__moduleName'] = cat['name'];
            o['__moduleId'] =
                moduleId; // 🔥 NUEVO: Etiquetamos el ID para poder filtrarlo luego
          }
          combinedOffers.addAll(offers);
        } catch (e) {
          continue;
        }
      }

      setState(() {
        _allOffers = combinedOffers;
        _isLoading = false;

        _extractDynamicFilters();
        _applyFilters();
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error cargando datos: $e'),
          backgroundColor: Colors.red,
        ),
      );
      setState(() => _isLoading = false);
    }
  }

  // ==========================================
  // 🔥 LÓGICA DE EXTRACCIÓN DINÁMICA 🔥
  // ==========================================
  void _extractDynamicFilters() {
    Map<String, Set<String>> tempOptions = {};

    for (var offer in _allOffers) {
      final data = offer['data'] as Map<String, dynamic>;

      // En la búsqueda global, le sumamos el nombre del módulo como filtro nativo
      final moduleName = offer['__moduleName']?.toString().trim();
      if (moduleName != null && moduleName.isNotEmpty) {
        if (!tempOptions.containsKey('CATEGORÍA'))
          tempOptions['CATEGORÍA'] = {'Todos'};
        tempOptions['CATEGORÍA']!.add(moduleName);
      }

      data.forEach((key, value) {
        if (value != null && (value is String || value is num)) {
          final valStr = value.toString().trim();
          if (valStr.isNotEmpty) {
            if (!tempOptions.containsKey(key)) tempOptions[key] = {'Todos'};
            tempOptions[key]!.add(valStr);
          }
        }
      });
    }

    setState(() {
      _dynamicFilterOptions = tempOptions.map((key, value) {
        final list = value.toList();
        list.sort();
        return MapEntry(key, list);
      });
    });
  }

  void _applyFilters() {
    setState(() {
      final demandsModuleId = _mobileSettings?['demands_module_id']; // 🔥 NUEVO

      _filteredOffers = _allOffers.where((offer) {
        // 🔥 LÓGICA DEL INTERRUPTOR COMPRAR/VENDER 🔥
        final offerModuleId = offer['__moduleId'];
        if (_isBuyingMode) {
          if (demandsModuleId != null && offerModuleId == demandsModuleId)
            return false;
        } else {
          if (demandsModuleId == null || offerModuleId != demandsModuleId)
            return false;
        }

        final data = offer['data'] as Map<String, dynamic>;
        final mapping = offer['__mapping'] as Map<String, dynamic>;

        String title =
            data[mapping['title'] ?? 'nombre_del_producto']?.toString() ?? '';
        if (title.isEmpty || title.toLowerCase() == 'no especificado') {
          title =
              data['producto']?.toString() ??
              data['nombre']?.toString() ??
              'Oferta #${offer['id']}';
        }
        title = title.toLowerCase();

        // 1. Buscador General
        final matchText =
            _searchQuery.isEmpty ||
            title.contains(_searchQuery.toLowerCase()) ||
            offer['id'].toString().contains(_searchQuery.toLowerCase());

        // 2. Filtros Dinámicos (Select2)
        bool matchesFilters = true;
        for (String key in _activeFilterKeys) {
          final requiredText =
              _filterControllers[key]?.text.trim().toLowerCase() ?? '';

          if (requiredText.isNotEmpty && requiredText != 'todos') {
            // Lógica especial para el filtro de Módulo/Categoría
            if (key == 'CATEGORÍA') {
              final offerCategory = (offer['__moduleName'] ?? '')
                  .toString()
                  .toLowerCase()
                  .trim();
              if (!offerCategory.contains(requiredText)) {
                matchesFilters = false;
                break;
              }
              continue;
            }

            // Lógica normal para los campos de la base de datos
            final offerValue = (data[key] ?? '')
                .toString()
                .toLowerCase()
                .trim();
            if (!offerValue.contains(requiredText)) {
              matchesFilters = false;
              break;
            }
          }
        }

        return matchText && matchesFilters;
      }).toList();

      // 3. Ordenamiento
      if (_sortBy == 'newest')
        _filteredOffers.sort((a, b) => b['id'].compareTo(a['id']));
      else
        _filteredOffers.sort((a, b) => a['id'].compareTo(b['id']));
    });
  }

  void _clearFilters() {
    setState(() {
      _searchQuery = '';
      _sortBy = 'newest';
      _activeFilterKeys.clear();
      for (var controller in _filterControllers.values) {
        controller.dispose();
      }
      _filterControllers.clear();
    });
    _applyFilters();
  }

  void _addFilterKey(String key) {
    if (!_activeFilterKeys.contains(key)) {
      setState(() {
        _activeFilterKeys.add(key);
        final newController = TextEditingController();
        newController.addListener(() => _applyFilters());
        _filterControllers[key] = newController;
      });
    }
  }

  void _removeFilterKey(String key) {
    setState(() {
      _activeFilterKeys.remove(key);
      _filterControllers[key]?.dispose();
      _filterControllers.remove(key);
      _applyFilters();
    });
  }

  String _formatKeyName(String key) {
    if (key == 'CATEGORÍA') return key;
    return key.replaceAll('_', ' ').toUpperCase();
  }

  Future<void> _toggleFavorite(int caseId) async {
    setState(() {
      if (_favoriteIds.contains(caseId))
        _favoriteIds.remove(caseId);
      else
        _favoriteIds.add(caseId);
    });
    try {
      await _marketService.toggleFavorite(caseId);
    } catch (e) {
      _loadAllData();
    }
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.dark);
    final brandColor = context.watch<ThemeProvider>().themeColor;

    final availableKeysToAdd = _dynamicFilterOptions.keys
        .where((k) => !_activeFilterKeys.contains(k))
        .toList();

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text(
          'EXPLORAR',
          style: TextStyle(
            color: Colors.black,
            fontWeight: FontWeight.w900,
            fontSize: 16,
            letterSpacing: 1.0,
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        foregroundColor: Colors.black,
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 🔥 0. INTERRUPTOR MINIMALISTA (TABS) 🔥
          if (!_isLoading)
            Padding(
              padding: const EdgeInsets.only(
                top: 16,
                bottom: 8,
                left: 16,
                right: 16,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  GestureDetector(
                    onTap: () {
                      setState(() => _isBuyingMode = true);
                      _applyFilters();
                    },
                    child: Column(
                      children: [
                        Text(
                          "COMPRAR",
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: _isBuyingMode
                                ? Colors.black
                                : Colors.black38,
                            letterSpacing: 1.0,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Container(
                          height: 3,
                          width: 40,
                          color: _isBuyingMode
                              ? Colors.black
                              : Colors.transparent,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 48),
                  GestureDetector(
                    onTap: () {
                      setState(() => _isBuyingMode = false);
                      _applyFilters();
                    },
                    child: Column(
                      children: [
                        Text(
                          "VENDER",
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: !_isBuyingMode
                                ? Colors.black
                                : Colors.black38,
                            letterSpacing: 1.0,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Container(
                          height: 3,
                          width: 40,
                          color: !_isBuyingMode
                              ? Colors.black
                              : Colors.transparent,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

          // 🔥 1. HEADER Y BUSCADOR (BRUTALISTA) 🔥
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: _showFilters
                      ? Colors.transparent
                      : const Color(0xFFEEEEEE),
                  width: 1,
                ),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    height: 54,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF7F7F7),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: Colors.black, width: 1.5),
                    ),
                    child: Row(
                      children: [
                        const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 16),
                          child: Icon(
                            Icons.search,
                            color: Colors.black,
                            size: 28,
                          ),
                        ),
                        Expanded(
                          child: TextField(
                            controller: TextEditingController.fromValue(
                              TextEditingValue(
                                text: _searchQuery,
                                selection: TextSelection.collapsed(
                                  offset: _searchQuery.length,
                                ),
                              ),
                            ),
                            onChanged: (val) {
                              _searchQuery = val;
                              _applyFilters();
                            },
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                            decoration: InputDecoration(
                              border: InputBorder.none,
                              hintText: _isBuyingMode
                                  ? 'Zanahorias, Tractores...'
                                  : 'Buscar demandas...',
                              hintStyle: TextStyle(
                                color: Colors.grey.shade400,
                                fontSize: 18,
                                fontWeight: FontWeight.normal,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: () => setState(() => _showFilters = !_showFilters),
                  child: Container(
                    height: 54,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    decoration: BoxDecoration(
                      color: _showFilters
                          ? brandColor.withOpacity(0.1)
                          : Colors.white,
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(
                        color: _showFilters ? brandColor : Colors.black,
                        width: 1.5,
                      ),
                    ),
                    child: Icon(
                      Icons.filter_list,
                      color: _showFilters ? brandColor : Colors.black87,
                      size: 28,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 🔥 2. PANEL DE FILTROS DINÁMICOS 🔥
          if (_showFilters)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.only(left: 16, right: 16, bottom: 24),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(
                  bottom: BorderSide(color: Color(0xFFEEEEEE), width: 1),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Color(0x08000000),
                    blurRadius: 10,
                    offset: Offset(0, 5),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        "FILTROS ACTIVOS",
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                          color: Colors.black87,
                          letterSpacing: 1.0,
                        ),
                      ),
                      TextButton(
                        onPressed: _clearFilters,
                        style: TextButton.styleFrom(
                          padding: EdgeInsets.zero,
                          minimumSize: const Size(50, 30),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: Text(
                          "Limpiar Todo",
                          style: TextStyle(
                            color: brandColor,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  ..._activeFilterKeys.map((key) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12.0),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Expanded(
                            child: _buildSelect2(
                              _formatKeyName(key),
                              key,
                              _dynamicFilterOptions[key] ?? [],
                              brandColor,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            height: 48,
                            width: 48,
                            decoration: BoxDecoration(
                              color: Colors.red.shade50,
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: Colors.red.shade100),
                            ),
                            child: IconButton(
                              icon: const Icon(
                                Icons.delete_outline,
                                color: Colors.red,
                              ),
                              onPressed: () => _removeFilterKey(key),
                            ),
                          ),
                        ],
                      ),
                    );
                  }).toList(),

                  if (availableKeysToAdd.isNotEmpty)
                    Container(
                      width: double.infinity,
                      height: 40,
                      margin: const EdgeInsets.only(top: 4, bottom: 12),
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: brandColor.withOpacity(0.05),
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: brandColor.withOpacity(0.3)),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          hint: Text(
                            "+ Añadir regla de filtro...",
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: brandColor,
                            ),
                          ),
                          isExpanded: true,
                          icon: Icon(
                            Icons.keyboard_arrow_down,
                            color: brandColor,
                          ),
                          items: availableKeysToAdd
                              .map(
                                (String k) => DropdownMenuItem<String>(
                                  value: k,
                                  child: Text(
                                    _formatKeyName(k),
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              )
                              .toList(),
                          onChanged: (val) {
                            if (val != null) _addFilterKey(val);
                          },
                        ),
                      ),
                    ),

                  _buildSimpleDropdown(
                    "ORDENAR POR",
                    _sortBy,
                    ['newest', 'oldest'],
                    (val) {
                      if (val != null) {
                        _sortBy = val;
                        _applyFilters();
                      }
                    },
                  ),
                ],
              ),
            ),

          // 💎 TÍTULO RESULTADOS 💎
          if (!_showFilters)
            Padding(
              padding: const EdgeInsets.only(left: 16, top: 16, bottom: 8),
              child: Text(
                _searchQuery.isEmpty
                    ? 'TODAS LAS OFERTAS'
                    : '${_filteredOffers.length} RESULTADOS',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                  color: Colors.black38,
                  letterSpacing: 1.5,
                ),
              ),
            ),

          // 💎 RESULTADOS 💎
          Expanded(
            child: _isLoading
                ? Center(child: CircularProgressIndicator(color: brandColor))
                : _filteredOffers.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: const [
                        Icon(Icons.search_off, color: Colors.black12, size: 80),
                        SizedBox(height: 16),
                        Text(
                          'NO SE ENCONTRARON PRODUCTOS',
                          style: TextStyle(
                            color: Colors.black38,
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.5,
                          ),
                        ),
                      ],
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: _loadAllData,
                    color: Colors.white,
                    backgroundColor: brandColor,
                    child: GridView.builder(
                      padding: const EdgeInsets.only(
                        left: 16,
                        right: 16,
                        top: 8,
                        bottom: 40,
                      ),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            childAspectRatio: 0.55,
                            crossAxisSpacing: 12,
                            mainAxisSpacing: 24,
                          ),
                      itemCount: _filteredOffers.length,
                      itemBuilder: (context, index) {
                        final offer = _filteredOffers[index];
                        final data = offer['data'] as Map<String, dynamic>;
                        final mapping =
                            offer['__mapping'] as Map<String, dynamic>;

                        String titulo =
                            data[mapping['title'] ?? 'nombre_del_producto']
                                ?.toString() ??
                            '';
                        if (titulo.isEmpty ||
                            titulo.toLowerCase() == 'no especificado') {
                          titulo =
                              data['producto']?.toString() ??
                              data['nombre']?.toString() ??
                              'Oferta #${offer['id']}';
                        }
                        final precio =
                            data[mapping['price'] ?? 'precio'] ?? '--';
                        String imageUrl =
                            data['imagen_1'] ?? data['logo'] ?? '';
                        if (imageUrl.isNotEmpty &&
                            !imageUrl.startsWith('http') &&
                            !imageUrl.startsWith('data:image')) {
                          imageUrl = 'http://127.0.0.1:8000$imageUrl';
                        }

                        return _buildBoutiqueCard(
                          offer,
                          titulo,
                          precio,
                          imageUrl,
                        );
                      },
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  // ==========================================
  // 🔥 WIDGET: SELECT2 DINÁMICO 🔥
  // ==========================================
  Widget _buildSelect2(
    String label,
    String key,
    List<String> options,
    Color brandColor,
  ) {
    final filteredOptions = options.where((o) => o != 'Todos').toList();
    final controller = _filterControllers[key]!;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.bold,
            color: Colors.black54,
            letterSpacing: 1.0,
          ),
        ),
        const SizedBox(height: 4),
        LayoutBuilder(
          builder: (context, constraints) {
            return DropdownMenu<String>(
              width: constraints.maxWidth,
              menuHeight: 250,
              hintText: 'Buscar o escribir...',
              controller: controller,
              enableFilter: true,
              enableSearch: true,
              requestFocusOnTap: true,
              textStyle: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Colors.black87,
              ),
              inputDecorationTheme: InputDecorationTheme(
                filled: true,
                fillColor: Colors.white,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(4),
                  borderSide: BorderSide(color: Colors.grey.shade300),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(4),
                  borderSide: BorderSide(color: Colors.grey.shade300),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(4),
                  borderSide: BorderSide(color: brandColor),
                ),
              ),
              dropdownMenuEntries: filteredOptions
                  .map(
                    (opt) => DropdownMenuEntry<String>(
                      value: opt,
                      label: opt.toUpperCase(),
                      style: MenuItemButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 12,
                        ),
                      ),
                    ),
                  )
                  .toList(),
              onSelected: (val) {
                if (val != null) {
                  controller.text = val;
                  controller.selection = TextSelection.fromPosition(
                    TextPosition(offset: controller.text.length),
                  );
                }
              },
            );
          },
        ),
      ],
    );
  }

  Widget _buildSimpleDropdown(
    String label,
    String value,
    List<String> options,
    Function(String?) onChanged,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.bold,
            color: Colors.black54,
            letterSpacing: 1.0,
          ),
        ),
        const SizedBox(height: 4),
        Container(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: Colors.grey.shade300),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: value,
              isExpanded: true,
              icon: const Icon(
                Icons.keyboard_arrow_down,
                color: Colors.black54,
              ),
              items: options.map((String opt) {
                String displayOpt = opt == 'newest'
                    ? 'Más Recientes'
                    : 'Más Antiguos';
                return DropdownMenuItem<String>(
                  value: opt,
                  child: Text(
                    displayOpt.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.black87,
                    ),
                  ),
                );
              }).toList(),
              onChanged: onChanged,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildBoutiqueCard(
    Map<String, dynamic> offer,
    String titulo,
    dynamic precio,
    String imageUrl,
  ) {
    final int caseId = offer['id'];
    final bool isFavorite = _favoriteIds.contains(caseId);

    // 🔥 Leemos el stock actual para la barra FOMO 🔥
    final mapping = offer['__mapping'] as Map<String, dynamic>;
    final data = offer['data'] as Map<String, dynamic>;
    final stockFieldKey = mapping['stock'];

    final currentStock = stockFieldKey != null
        ? double.tryParse(data[stockFieldKey].toString())
        : null;

    // 🔥 LEEMOS EL STOCK INICIAL 🔥
    final initialStock = stockFieldKey != null
        ? double.tryParse(
            data['${stockFieldKey}_inicial']?.toString() ??
                data[stockFieldKey].toString(),
          )
        : null;

    // 🔥 CALCULAMOS EL PORCENTAJE REAL 🔥
    double progressValue = 1.0;
    if (currentStock != null && initialStock != null && initialStock > 0) {
      progressValue = currentStock / initialStock;
    }

    Color stockColor = Colors.black;
    if (currentStock != null && currentStock < 50)
      stockColor = Colors.redAccent;

    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ProductDetailScreen(
              offer: offer,
              titulo: titulo,
              precio: precio,
              imageUrl: imageUrl,
              isDemandMode: !_isBuyingMode,
              currentStock: currentStock,
              initialStock: initialStock, // 🔥 NUEVO: Pasamos el stock inicial
            ),
          ),
        ).then((_) => _loadAllData());
      },
      child: Container(
        color: Colors.transparent,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Stack(
                children: [
                  Container(
                    width: double.infinity,
                    height: double.infinity,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF4F4F4),
                      border: Border.all(color: Colors.black, width: 1.5),
                    ),
                    child: imageUrl.isNotEmpty
                        ? (imageUrl.startsWith('data:image')
                              ? Image.memory(
                                  dart_convert.base64Decode(
                                    imageUrl.split(',').last,
                                  ),
                                  fit: BoxFit.cover,
                                  errorBuilder: (c, e, s) =>
                                      _buildImagePlaceholder(),
                                )
                              : Image.network(
                                  imageUrl,
                                  fit: BoxFit.cover,
                                  errorBuilder: (c, e, s) =>
                                      _buildImagePlaceholder(),
                                ))
                        : _buildImagePlaceholder(),
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: GestureDetector(
                      onTap: () => _toggleFavorite(caseId),
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.black, width: 1.5),
                        ),
                        child: Icon(
                          isFavorite ? Icons.favorite : Icons.favorite_border,
                          color: isFavorite ? Colors.redAccent : Colors.black,
                          size: 16,
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black,
                        borderRadius: BorderRadius.circular(2),
                      ),
                      child: Text(
                        (offer['__moduleName'] ?? '').toString().toUpperCase(),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 8,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(
              titulo.toUpperCase(),
              style: const TextStyle(
                color: Colors.black,
                fontSize: 13,
                fontWeight: FontWeight.w900,
                letterSpacing: 0.5,
                height: 1.2,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),

            // 🔥 LA BARRA DE PROGRESO FOMO 🔥
            if (currentStock != null) ...[
              const SizedBox(height: 8),
              LinearProgressIndicator(
                value: progressValue, // 🔥 BARRA 100% REAL 🔥
                backgroundColor: Colors.grey.shade200,
                valueColor: AlwaysStoppedAnimation<Color>(stockColor),
                minHeight: 4,
              ),
              const SizedBox(height: 4),
              Text(
                !_isBuyingMode
                    ? 'NECESITA $currentStock Unidades'
                    : 'QUEDAN $currentStock Unidades',
                style: TextStyle(
                  color: stockColor,
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.0,
                ),
              ),
            ],

            const SizedBox(height: 6),
            Text(
              '\Gs $precio',
              style: const TextStyle(
                color: Colors.black,
                fontSize: 15,
                fontWeight: FontWeight.w900,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildImagePlaceholder() {
    return const Center(
      child: Icon(
        Icons.image_not_supported_outlined,
        color: Colors.black12,
        size: 40,
      ),
    );
  }
}
