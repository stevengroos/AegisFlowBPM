import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/theme_provider.dart';
import 'market_service.dart';
import 'catalog_screen.dart';
import '../auth/auth_service.dart';
import 'favorites_screen.dart';
import 'notifications_screen.dart';
import 'dart:convert' as dart_convert;

class HomeScreen extends StatefulWidget {
  final Function(int)? onNavigateToTab; // 🔥 Recibe a qué pestaña ir
  final VoidCallback? onTriggerPublish; // 🔥 Recibe si debe abrir el menú '+'

  const HomeScreen({super.key, this.onNavigateToTab, this.onTriggerPublish});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final MarketService _marketService = MarketService();
  final AuthService _authService = AuthService();

  List<dynamic> _catalogs = [];
  List<dynamic> _filteredCatalogs = [];
  Map<String, dynamic>? _userData;
  Map<String, dynamic>? _mobileSettings;
  bool _isLoading = true;

  // 🔥 ESTADO DEL INTERRUPTOR: true = Comprar (Ofertas), false = Vender (Demandas) 🔥
  bool _isBuyingMode = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final results = await Future.wait([
        _marketService.getCatalogs(),
        _authService.getUserProfile(),
        _marketService.getMobileSettings(),
      ]);

      setState(() {
        _catalogs = results[0] as List<dynamic>;
        _userData = results[1] as Map<String, dynamic>;
        _mobileSettings = results[2] as Map<String, dynamic>;

        _applyModeFilter();
      });
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      setState(() => _isLoading = false);
    }
  }

  String _getInitials() {
    if (_userData == null) return '--';
    final first = _userData!['first_name']?.toString().trim() ?? '';
    final last = _userData!['last_name']?.toString().trim() ?? '';
    if (first.isNotEmpty && last.isNotEmpty)
      return '${first[0]}${last[0]}'.toUpperCase();
    if (first.isNotEmpty)
      return first.substring(0, first.length > 1 ? 2 : 1).toUpperCase();
    return 'U';
  }

  // 🔥 MAGIA: Filtrar catálogos según el Modo (Comprar vs Vender) 🔥
  void _applyModeFilter([String query = '']) {
    setState(() {
      final demandsModuleId = _mobileSettings?['demands_module_id'];

      List<dynamic> baseList = _catalogs.where((c) {
        // Si estamos en modo "Vender" (Cubrir demandas), SOLO mostramos el catálogo de demandas
        if (!_isBuyingMode) {
          return demandsModuleId != null && c['id'] == demandsModuleId;
        }
        // Si estamos en modo "Comprar", mostramos todo EXCEPTO el catálogo de demandas
        return c['id'] != demandsModuleId;
      }).toList();

      if (query.isEmpty) {
        _filteredCatalogs = baseList;
      } else {
        _filteredCatalogs = baseList
            .where(
              (c) => c['name'].toString().toLowerCase().contains(
                query.toLowerCase(),
              ),
            )
            .toList();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.dark);
    final brandColor = context.watch<ThemeProvider>().themeColor;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        toolbarHeight: 60,
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
            ),
          ),
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(
                  Icons.mail_outline,
                  color: Colors.black,
                  size: 28,
                ),
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const NotificationsScreen(),
                  ),
                ),
              ),
              Positioned(
                right: 8,
                top: 10,
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(
                    color: Colors.black,
                    shape: BoxShape.circle,
                  ),
                  child: const Text(
                    '!',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: () =>
                widget.onNavigateToTab?.call(3), // Va a la pestaña 3 (Perfil)
            child: CircleAvatar(
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
          ),
          const SizedBox(width: 16),
        ],
      ),
      body: Column(
        children: [
          // 🔥 INTERRUPTOR MINIMALISTA (TABS) 🔥
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
                      _applyModeFilter();
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
                      _applyModeFilter();
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

          // 💎 BUSCADOR MINIMALISTA
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: const BoxDecoration(
              border: Border(
                bottom: BorderSide(color: Color(0xFFEEEEEE), width: 1),
              ),
            ),
            child: Container(
              height: 48,
              decoration: BoxDecoration(
                color: const Color(0xFFF7F7F7),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Row(
                children: [
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16),
                    child: Icon(Icons.search, color: Colors.black, size: 24),
                  ),
                  Expanded(
                    child: TextField(
                      onChanged: _applyModeFilter,
                      decoration: InputDecoration(
                        border: InputBorder.none,
                        hintText: _isBuyingMode
                            ? 'Buscar catálogos...'
                            : 'Buscar demandas...',
                        hintStyle: TextStyle(
                          color: Colors.grey.shade500,
                          fontSize: 16,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: Colors.black),
                  )
                : _filteredCatalogs.isEmpty
                ? Center(
                    child: Text(
                      _isBuyingMode
                          ? "NO HAY CATÁLOGOS DISPONIBLES"
                          : "NO HAY DEMANDAS PUBLICADAS",
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        color: Colors.black38,
                        letterSpacing: 1.5,
                      ),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 24,
                    ),
                    itemCount: _filteredCatalogs.length,
                    separatorBuilder: (context, index) =>
                        const SizedBox(height: 48),
                    itemBuilder: (context, index) {
                      final catalog = _filteredCatalogs[index];
                      return _buildLookbookCard(
                        catalog,
                      ); // Ya no pasamos coverImage estática
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildLookbookCard(Map<String, dynamic> catalog) {
    // 🔥 Extraemos la imagen dinámica en Base64 (si la hay)
    final coverImage = catalog['cover_image']?.toString() ?? '';

    return GestureDetector(
      onTap: () async {
        // 🔥 Esperamos a ver qué botón tocó el usuario en la barra falsa
        final result = await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => CatalogScreen(
              moduleId: catalog['id'],
              moduleName: catalog['name'],
              mapping: catalog['mapping'] ?? {},
              isDemandMode: !_isBuyingMode,
            ),
          ),
        );

        // 🔥 Ejecutamos la acción según lo que respondió
        if (result is int) {
          widget.onNavigateToTab?.call(result); // Cambia la pestaña
        } else if (result == 'publish') {
          widget.onTriggerPublish?.call(); // Abre el menú del botón +
        }
      },
      child: Container(
        color: Colors.transparent,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: AspectRatio(
                aspectRatio: 4 / 3,
                child: Container(
                  color: const Color(0xFFF4F4F4),
                  // 🔥 RENDERIZADO DINÁMICO 🔥
                  child: coverImage.isNotEmpty
                      ? (coverImage.startsWith('data:image')
                            ? Image.memory(
                                // Convertimos el Base64 de la web a bytes nativos
                                dart_convert.base64Decode(
                                  coverImage.split(',').last,
                                ),
                                fit: BoxFit.cover,
                              )
                            : Image.network(
                                coverImage,
                                fit: BoxFit.cover,
                                errorBuilder: (c, e, s) => const Center(
                                  child: Icon(
                                    Icons.image_not_supported_outlined,
                                    color: Colors.black12,
                                    size: 40,
                                  ),
                                ),
                              ))
                      : const Center(
                          child: Icon(
                            Icons.image_not_supported_outlined,
                            color: Colors.black12,
                            size: 40,
                          ),
                        ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              catalog['name'].toString().toUpperCase(),
              style: const TextStyle(
                color: Colors.black,
                fontSize: 22,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              catalog['description'] ?? 'Explora nuestras mejores ofertas.',
              style: const TextStyle(
                color: Colors.black54,
                fontSize: 14,
                fontWeight: FontWeight.w500,
                height: 1.4,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Text(
                  _isBuyingMode ? 'VER PRODUCTOS' : 'VER DEMANDAS',
                  style: const TextStyle(
                    color: Colors.black,
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.0,
                    decoration: TextDecoration.underline,
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(
                  Icons.arrow_forward_ios,
                  color: Colors.black,
                  size: 12,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
