import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'market_service.dart';
import 'product_detail_screen.dart';

class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  final MarketService _marketService = MarketService();
  List<dynamic> _favorites = [];
  List<dynamic> _filteredFavorites = []; // 🔥 Lista para el buscador
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadFavorites();
  }

  Future<void> _loadFavorites() async {
    try {
      final data = await _marketService.getFavorites();
      setState(() {
        _favorites = data;
        _filteredFavorites = data; // Llenamos el buscador
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  // 🔥 MAGIA: Función del Buscador 🔥
  void _filterFavorites(String query) {
    if (query.isEmpty) {
      setState(() => _filteredFavorites = _favorites);
      return;
    }
    final lowerQuery = query.toLowerCase();
    setState(() {
      _filteredFavorites = _favorites.where((offer) {
        final data = offer['data'] as Map<String, dynamic>;

        String title = data['producto_origen']?.toString() ?? '';
        if (title.isEmpty || title.toLowerCase() == 'no especificado') {
          title = data['nombre_del_producto']?.toString() ?? '';
        }
        if (title.isEmpty) title = data['producto']?.toString() ?? '';
        if (title.isEmpty) title = data['nombre']?.toString() ?? '';

        final idStr = offer['id'].toString();

        return title.toLowerCase().contains(lowerQuery) ||
            idStr.contains(lowerQuery);
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.dark);

    // 🔥 DETECTOR INTELIGENTE 🔥
    // Si canPop es true, significa que entramos desde el botón de arriba (Navigator.push)
    final bool isPushed = Navigator.canPop(context);
    final double bottomArea = isPushed
        ? 110
        : 40; // Más espacio si tenemos que dibujar el menú flotante

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text(
          'MIS FAVORITOS',
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
        // Solo mostramos la flecha de volver si entramos desde el App Bar
        leading: isPushed
            ? IconButton(
                icon: const Icon(Icons.arrow_back_ios, color: Colors.black),
                onPressed: () => Navigator.pop(context),
              )
            : null,
      ),
      body: Stack(
        children: [
          Column(
            children: [
              // 💎 BUSCADOR MINIMALISTA 💎
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
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
                        child: Icon(
                          Icons.search,
                          color: Colors.black,
                          size: 24,
                        ),
                      ),
                      Expanded(
                        child: TextField(
                          onChanged: _filterFavorites, // Conectado al filtro
                          decoration: InputDecoration(
                            border: InputBorder.none,
                            hintText: 'Buscar en favoritos...',
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

              // 💎 GRILLA DE FAVORITOS 💎
              Expanded(
                child: _isLoading
                    ? const Center(
                        child: CircularProgressIndicator(color: Colors.black),
                      )
                    : _filteredFavorites.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: const [
                            Icon(
                              Icons.favorite_border,
                              color: Colors.black12,
                              size: 80,
                            ),
                            SizedBox(height: 16),
                            Text(
                              'NO SE ENCONTRARON FAVORITOS',
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
                        onRefresh: _loadFavorites,
                        color: Colors.white,
                        backgroundColor: Colors.black,
                        child: GridView.builder(
                          padding: EdgeInsets.only(
                            left: 16,
                            right: 16,
                            top: 16,
                            bottom: bottomArea,
                          ),
                          gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 2,
                                childAspectRatio: 0.55,
                                crossAxisSpacing: 12,
                                mainAxisSpacing: 24,
                              ),
                          itemCount: _filteredFavorites.length,
                          itemBuilder: (context, index) {
                            final offer = _filteredFavorites[index];
                            final data = offer['data'] as Map<String, dynamic>;

                            // 🔥 BUSCADOR INTELIGENTE DE NOMBRES 🔥
                            String titulo =
                                data['producto_origen']?.toString() ?? '';
                            if (titulo.isEmpty ||
                                titulo.toLowerCase() == 'no especificado') {
                              titulo =
                                  data['nombre_del_producto']?.toString() ?? '';
                            }
                            if (titulo.isEmpty)
                              titulo = data['producto']?.toString() ?? '';
                            if (titulo.isEmpty)
                              titulo = data['nombre']?.toString() ?? '';
                            if (titulo.isEmpty)
                              titulo = 'OFERTA #${offer['id']}';

                            final precio =
                                data['precio'] ??
                                data['precio_acordado'] ??
                                '--';
                            String imageUrl =
                                data['imagen_1'] ?? data['logo'] ?? '';
                            // 🔥 REPARADOR DE RUTAS DE IMÁGENES 🔥
                            if (imageUrl.isNotEmpty &&
                                !imageUrl.startsWith('http')) {
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

          // 🔥 NAVEGACIÓN FLOTANTE (Solo si fue empujada por encima del MainLayout) 🔥
          if (isPushed) _buildRestoredNavBar(),
        ],
      ),
    );
  }

  // ===============================================
  // WIDGETS DE UI REUTILIZADOS
  // ===============================================

  Widget _buildBoutiqueCard(
    Map<String, dynamic> offer,
    String titulo,
    dynamic precio,
    String imageUrl,
  ) {
    final int caseId = offer['id'];

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
            ),
          ),
        ).then((_) => _loadFavorites());
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
                        ? Image.network(
                            imageUrl,
                            fit: BoxFit.cover,
                            errorBuilder: (c, e, s) => _buildImagePlaceholder(),
                          )
                        : _buildImagePlaceholder(),
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: GestureDetector(
                      onTap: () async {
                        await _marketService.toggleFavorite(caseId);
                        _loadFavorites();
                      },
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.black, width: 1.5),
                        ),
                        child: const Icon(
                          Icons.favorite,
                          color: Colors.redAccent,
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
            const SizedBox(height: 6),
            Text(
              '\$$precio',
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

  Widget _buildRestoredNavBar() {
    const double navBarHeight = 70;
    const double fabSize = 64;

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
                const SizedBox(width: fabSize), // Espacio central
                _buildNavItem(Icons.shopping_bag_outlined, 2),
                _buildNavItem(Icons.person_outline, 3),
              ],
            ),
          ),
          Positioned(
            bottom: 6,
            child: GestureDetector(
              onTap: () => Navigator.pop(context),
              child: Container(
                width: fabSize,
                height: fabSize,
                decoration: BoxDecoration(
                  color: Colors.black,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.2),
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

  Widget _buildNavItem(IconData icon, int index) {
    return IconButton(
      icon: Icon(icon, color: Colors.grey.shade400, size: 28),
      onPressed: () => Navigator.pop(context),
    );
  }
}
