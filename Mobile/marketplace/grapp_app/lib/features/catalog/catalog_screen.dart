import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/theme_provider.dart';
import 'market_service.dart';
import 'product_detail_screen.dart';
import 'favorites_screen.dart';
import '../auth/auth_service.dart';
import 'dart:convert' as dart_convert;

class CatalogScreen extends StatefulWidget {
  final int moduleId;
  final String moduleName;
  final Map<String, dynamic> mapping;
  final bool isDemandMode; // 🔥 NUEVO: Recibe el modo desde el HomeScreen 🔥

  const CatalogScreen({
    super.key,
    required this.moduleId,
    required this.moduleName,
    required this.mapping,
    this.isDemandMode = false, // Por defecto es false
  });

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  final MarketService _marketService = MarketService();
  final AuthService _authService = AuthService();

  List<dynamic> _allOffers = [];
  List<dynamic> _filteredOffers = [];
  Set<int> _favoriteIds = {};
  Map<String, dynamic>? _userData;

  String _searchQuery = '';
  String _sortBy = 'newest';
  bool _showFilters = false;

  Map<String, List<String>> _dynamicFilterOptions = {};
  List<String> _activeFilterKeys = [];
  final Map<String, TextEditingController> _filterControllers = {};

  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    for (var controller in _filterControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final results = await Future.wait([
        _marketService.getOffers(widget.moduleId),
        _authService.getUserProfile(),
        _marketService.getFavorites(),
      ]);
      setState(() {
        _allOffers = results[0] as List<dynamic>;
        _userData = results[1] as Map<String, dynamic>;
        final favs = results[2] as List<dynamic>;
        _favoriteIds = favs.map((f) => f['id'] as int).toSet();

        _extractDynamicFilters();
        _applyFilters();
      });
    } catch (e) {
      setState(
        () => _errorMessage = e.toString().replaceAll('Exception: ', ''),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _extractDynamicFilters() {
    Map<String, Set<String>> tempOptions = {};
    for (var offer in _allOffers) {
      final data = offer['data'] as Map<String, dynamic>;
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
      _filteredOffers = _allOffers.where((offer) {
        final data = offer['data'] as Map<String, dynamic>;
        final title =
            (data[widget.mapping['title'] ?? 'nombre_del_producto'] ??
                    'Oferta #${offer['id']}')
                .toString()
                .toLowerCase();

        final matchText =
            _searchQuery.isEmpty ||
            title.contains(_searchQuery.toLowerCase()) ||
            offer['id'].toString().contains(_searchQuery);

        bool matchesFilters = true;
        for (String key in _activeFilterKeys) {
          final requiredText =
              _filterControllers[key]?.text.trim().toLowerCase() ?? '';
          if (requiredText.isNotEmpty && requiredText != 'todos') {
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

      if (_sortBy == 'newest') {
        _filteredOffers.sort((a, b) => b['id'].compareTo(a['id']));
      } else {
        _filteredOffers.sort((a, b) => a['id'].compareTo(b['id']));
      }
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
    return key.replaceAll('_', ' ').toUpperCase();
  }

  String _getInitials() {
    if (_userData == null) return '--';
    final first = _userData!['first_name']?.toString().trim() ?? '';
    final last = _userData!['last_name']?.toString().trim() ?? '';
    if (first.isNotEmpty && last.isNotEmpty)
      return '${first[0]}${last[0]}'.toUpperCase();
    return 'U';
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
      _loadData();
    }
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.dark);
    // Cambiamos el color de acento si estamos en modo Demanda
    final brandColor = widget.isDemandMode
        ? const Color(0xFF4F46E5)
        : context.watch<ThemeProvider>().themeColor;
    const double bottomArea = 110;

    final availableKeysToAdd = _dynamicFilterOptions.keys
        .where((k) => !_activeFilterKeys.contains(k))
        .toList();

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        toolbarHeight: 60,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.black),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'GRAPP',
          style: TextStyle(
            color: Colors.black,
            fontWeight: FontWeight.w900,
            fontSize: 24,
            letterSpacing: -1.0,
            fontFamily: 'Impact',
          ),
        ),
        centerTitle: false,
        actions: [
          IconButton(
            icon: const Icon(
              Icons.favorite_border,
              color: Colors.black,
              size: 28,
            ),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const FavoritesScreen()),
            ).then((_) => _loadData()),
          ),
          const SizedBox(width: 8),
          CircleAvatar(
            backgroundColor: Colors.black,
            radius: 16,
            child: Text(
              _getInitials(),
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
          ),
          const SizedBox(width: 16),
        ],
      ),
      body: Stack(
        children: [
          Column(
            children: [
              // HEADER Y BUSCADOR
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border(
                    bottom: BorderSide(
                      color: _showFilters
                          ? Colors.transparent
                          : const Color(0xFFEEEEEE),
                      width: 1,
                    ),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          widget.moduleName.toUpperCase(),
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          '${_filteredOffers.length} RESULTADOS',
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Colors.black54,
                            letterSpacing: 1.0,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: Container(
                            height: 48,
                            decoration: BoxDecoration(
                              color: const Color(0xFFF7F7F7),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              children: [
                                const Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 16),
                                  child: Icon(
                                    Icons.search,
                                    color: Colors.black,
                                    size: 24,
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
                                    decoration: InputDecoration(
                                      border: InputBorder.none,
                                      hintText: 'Buscar por nombre o #ID...',
                                      hintStyle: TextStyle(
                                        color: Colors.grey.shade500,
                                        fontSize: 14,
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
                          onTap: () =>
                              setState(() => _showFilters = !_showFilters),
                          child: Container(
                            height: 48,
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            decoration: BoxDecoration(
                              color: _showFilters
                                  ? brandColor.withOpacity(0.1)
                                  : Colors.white,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: _showFilters
                                    ? brandColor
                                    : Colors.grey.shade300,
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.filter_list,
                                  color: _showFilters
                                      ? brandColor
                                      : Colors.black87,
                                  size: 20,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  "Filtros",
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                    color: _showFilters
                                        ? brandColor
                                        : Colors.black87,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // PANEL DE FILTROS DINÁMICOS ESTILO WEB
              if (_showFilters)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.only(
                    left: 16,
                    right: 16,
                    bottom: 24,
                  ),
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
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                    color: Colors.red.shade100,
                                  ),
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
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: brandColor.withOpacity(0.3),
                            ),
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

              // GRILLA DE RESULTADOS
              Expanded(
                child: _isLoading
                    ? Center(
                        child: CircularProgressIndicator(color: brandColor),
                      )
                    : _filteredOffers.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.search_off,
                              color: Colors.grey.shade300,
                              size: 64,
                            ),
                            const SizedBox(height: 16),
                            const Text(
                              "NO HAY RESULTADOS",
                              style: TextStyle(
                                fontWeight: FontWeight.w900,
                                color: Colors.black38,
                                letterSpacing: 1.5,
                              ),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadData,
                        color: Colors.white,
                        backgroundColor: brandColor,
                        child: GridView.builder(
                          padding: const EdgeInsets.only(
                            left: 16,
                            right: 16,
                            top: 16,
                            bottom: bottomArea,
                          ),
                          gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 2,
                                childAspectRatio:
                                    0.48, // 🔥 Hacemos la tarjeta un poco más alta para que quepa la barra de progreso
                                crossAxisSpacing: 12,
                                mainAxisSpacing: 24,
                              ),
                          itemCount: _filteredOffers.length,
                          itemBuilder: (context, index) {
                            final offer = _filteredOffers[index];
                            final data = offer['data'] as Map<String, dynamic>;
                            final titulo =
                                data[widget.mapping['title'] ??
                                    'nombre_del_producto'] ??
                                'Oferta #${offer['id']}';
                            final precio =
                                data[widget.mapping['price'] ?? 'precio'] ??
                                '--';

                            // 🔥 LEEMOS EL STOCK ACTUAL Y EL TOTAL 🔥
                            // Si el admin mapeó un campo "stock", lo leemos. Si no, lo dejamos nulo.
                            final stockFieldKey = widget.mapping['stock'];
                            final currentStock = stockFieldKey != null
                                ? double.tryParse(
                                    data[stockFieldKey].toString(),
                                  )
                                : null;

                            // Para calcular el %, buscamos si hay un "stock inicial" o algo parecido. Si no, no dibujamos la barra.
                            // Por ahora, asumiremos que si hay stock, mostramos solo las toneladas restantes.

                            String imageUrl =
                                data['imagen_1'] ?? data['logo'] ?? '';
                            if (imageUrl.isNotEmpty &&
                                !imageUrl.startsWith('http') &&
                                !imageUrl.startsWith('data:image')) {
                              imageUrl = 'http://127.0.0.1:8000$imageUrl';
                            }
                            return _buildBoutiqueCard(
                              offer,
                              titulo.toString(),
                              precio,
                              imageUrl,
                              currentStock,
                            );
                          },
                        ),
                      ),
              ),
            ],
          ),

          _buildRestoredNavBar(),
        ],
      ),
    );
  }

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
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: Colors.grey.shade300),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: Colors.grey.shade300),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
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
            borderRadius: BorderRadius.circular(8),
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
              items: options
                  .map(
                    (String opt) => DropdownMenuItem<String>(
                      value: opt,
                      child: Text(
                        opt == 'newest' ? 'MÁS RECIENTES' : 'MÁS ANTIGUOS',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Colors.black87,
                        ),
                      ),
                    ),
                  )
                  .toList(),
              onChanged: onChanged,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildRestoredNavBar() {
    const double navBarHeight = 70;
    const double fabSize = 64;
    final brandColor = widget.isDemandMode
        ? const Color(0xFF4F46E5)
        : context.watch<ThemeProvider>().themeColor;

    return Positioned(
      bottom: 20,
      left: 20,
      right: 20,
      child: Stack(
        alignment: Alignment.bottomCenter,
        clipBehavior: Clip.none,
        children: [
          Container(
            height: navBarHeight,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(navBarHeight / 2),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.06),
                  blurRadius: 15,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _buildNavItem(Icons.home_outlined, 0),
                _buildNavItem(Icons.manage_search, 1),
                const SizedBox(width: fabSize),
                _buildNavItem(Icons.shopping_bag_outlined, 2),
                _buildNavItem(Icons.person_outline, 3),
              ],
            ),
          ),
          Positioned(
            bottom: 6,
            child: GestureDetector(
              // 🔥 Le enviamos la palabra 'publish' para que abra el menú
              onTap: () => Navigator.pop(context, 'publish'),
              child: Container(
                width: fabSize,
                height: fabSize,
                decoration: BoxDecoration(
                  color: brandColor,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: brandColor.withOpacity(0.3),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: const Icon(Icons.add, color: Colors.white, size: 32),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNavItem(IconData icon, int index) => IconButton(
    icon: Icon(icon, color: Colors.grey.shade400, size: 28),
    // 🔥 Ahora enviamos el 'index' de la pestaña que queremos abrir
    onPressed: () => Navigator.pop(context, index),
  );

  // 🔥 3. NUEVO: TARJETA CON BARRA DE PROGRESO DE STOCK 🔥
  Widget _buildBoutiqueCard(
    Map<String, dynamic> offer,
    String titulo,
    dynamic precio,
    String imageUrl,
    double? currentStock,
  ) {
    final int caseId = offer['id'];
    final bool isFavorite = _favoriteIds.contains(caseId);

    final data = offer['data'] as Map<String, dynamic>;
    final stockFieldKey = widget.mapping['stock'];

    // 🔥 LEEMOS EL STOCK INICIAL (Si no hay ventas aún, asume que es el actual) 🔥
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
              isDemandMode: widget
                  .isDemandMode, // Le pasamos el modo a la siguiente pantalla
              currentStock:
                  currentStock, // Le pasamos el stock para limitar la compra
              initialStock: initialStock,
            ),
          ),
        ).then((_) => _loadData());
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
                widget.isDemandMode
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

  Widget _buildImagePlaceholder() => const Center(
    child: Icon(
      Icons.image_not_supported_outlined,
      color: Colors.black12,
      size: 40,
    ),
  );
}
